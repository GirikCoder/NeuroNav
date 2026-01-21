// ai_bridge.js - MASTER VERSION: Scissor + Scroll + Two-Stage Minimize

// --- TRUSTED TYPES BYPASS ---
(function() {
    if (window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) {
        try {
            const policy = window.trustedTypes.createPolicy('neuroNavPolicy_' + Math.random().toString(36).substr(2, 9), {
                createScriptURL: (s) => s
            });
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if (this.tagName === 'SCRIPT' && name === 'src' && value.startsWith('chrome-extension://')) {
                    return originalSetAttribute.call(this, name, policy.createScriptURL(value));
                }
                return originalSetAttribute.call(this, name, value);
            };
        } catch (e) {}
    }
})();

// --- AI SETUP ---
console.log("NeuroNav: Master Logic Loading...");
async function initializeAI(baseUrl) {
    try {
        const bundleUrl = `${baseUrl}vision_bundle.js`;
        const aiModule = await import(bundleUrl);
        let Vision = aiModule.FilesetResolver ? aiModule : aiModule.default;
        if (!Vision && window.vision) Vision = window.vision;

        const { HandLandmarker, FilesetResolver } = Vision;
        const wasmDir = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const filesetResolver = await FilesetResolver.forVisionTasks(wasmDir);
        
        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: { modelAssetPath: `${baseUrl}hand_landmarker.task`, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 1
        });

        const videoElement = document.getElementById("neuronav-video");
        if (videoElement) startDetectionLoop(handLandmarker, videoElement);
    } catch (e) { console.error(e); }
}

function startDetectionLoop(landmarker, video) {
    async function loop() {
        if (!video.paused && !video.ended) {
            const results = await landmarker.detectForVideo(video, performance.now());
            if (results.landmarks && results.landmarks.length > 0) {
                processGestures(results.landmarks[0]);
            } else {
                resetGestureState();
            }
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// --- GESTURE LOGIC ---

// Shared State
let holdStartTime = 0;
let currentGestureName = null;
let previousY = null; // For Minimize Swipe

// Minimize State (The "Two-Stage" Logic)
let isMinimizeReady = false;

// Scissor State
let scissorState = "CLOSED"; 

// CONFIG
const DWELL_TIME = 500; // 0.5s hold time
const SCROLL_SPEED = 4; // Pixels per frame
const MINIMIZE_SWIPE_SPEED = 0.015; // Vertical speed threshold

function processGestures(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbMCP = landmarks[2]; 
    const indexTip = landmarks[8];
    const indexPip = landmarks[6]; // Knuckle
    const middleTip = landmarks[12];
    const middlePip = landmarks[10]; // Knuckle
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // 1. DETECT POSE

    // Fist (4 fingers curled)
    const fingersClosed = (
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) < 0.15 &&
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.15 &&
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15 &&
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.15
    );

    // Scissor Pose (Index/Middle Extended, Ring/Pinky Curled)
    const isScissorPose = (
        !fingersClosed &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) && // Index extended
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) && // Middle extended
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.2 && // Ring curled (relaxed)
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.2 // Pinky curled
    );

    // Open Hand (All fingers extended) - Explicitly NOT Scissor
    const fingersOpen = (
        !isScissorPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.2 &&
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > 0.2 &&
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) > 0.2 &&
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > 0.2
    );

    // -----------------------------------------------------------
    // PRIORITY 1: SCISSOR (Close Tab)
    // -----------------------------------------------------------
    if (isScissorPose) {
        isMinimizeReady = false; // Reset minimize if we switch to scissor

        const scissorDist = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y);
        
        // State A: Open Scissors (Ready)
        if (scissorDist > 0.05) {
            if (scissorState !== "OPEN") {
                console.log("✂️ SCISSOR READY");
                scissorState = "OPEN";
                sendFeedback(0.5); // Blue bar halfway
            }
        }
        // State B: Closed Scissors (Cut!)
        else if (scissorDist < 0.04) {
            if (scissorState === "OPEN") {
                console.log("✂️ CUT -> CLOSE TAB");
                triggerAction("CLOSE_TAB");
                scissorState = "CLOSED"; 
                sendFeedback(0);
            }
        }
        return; // Stop here
    } 
    else {
        // Reset Scissor State silently
        if (scissorState === "OPEN") {
             scissorState = "CLOSED";
             sendFeedback(0);
        }
    }

    // -----------------------------------------------------------
    // PRIORITY 2: MINIMIZE (Open Hand -> Arm -> Swipe)
    // -----------------------------------------------------------
    const now = Date.now();

    if (fingersOpen) {
        
        // Step 1: Arming Phase (Fill the Bar)
        if (!isMinimizeReady) {
            if (currentGestureName !== "ARMING_MINIMIZE") {
                currentGestureName = "ARMING_MINIMIZE";
                holdStartTime = now;
                sendFeedback(0.1);
            } else {
                const elapsed = now - holdStartTime;
                const progress = Math.min(elapsed / DWELL_TIME, 1);
                sendFeedback(progress);
                
                if (elapsed >= DWELL_TIME) {
                    isMinimizeReady = true; // UNLOCKED!
                    sendFeedback(1); // Bar stays green/full
                }
            }
        } 
        
        // Step 2: Trigger Phase (Swipe Down)
        else {
            sendFeedback(1); // Keep visual "Ready" cue
            
            if (previousY !== null) {
                const deltaY = wrist.y - previousY;
                // Positive deltaY = Moving Down
                if (deltaY > MINIMIZE_SWIPE_SPEED) {
                    console.log("⬇️ SWIPE -> MINIMIZE");
                    triggerAction("MINIMIZE");
                    
                    // Reset
                    isMinimizeReady = false; 
                    currentGestureName = null;
                    sendFeedback(0);
                }
            }
        }
    } 
    
    // -----------------------------------------------------------
    // PRIORITY 3: THUMB (Scroll / Switch Tabs)
    // -----------------------------------------------------------
    else if (fingersClosed) {
        isMinimizeReady = false; // Reset minimize

        const dx = thumbTip.x - thumbMCP.x;
        const dy = thumbTip.y - thumbMCP.y;
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        const isVertical = !isHorizontal;

        // A. VERTICAL -> SCROLLING (Immediate)
        if (isVertical) {
            if (dy < -0.02) { 
                window.scrollBy(0, -SCROLL_SPEED); // Scroll Up
                resetGestureState();
                return;
            }
            else if (dy > 0.02) {
                window.scrollBy(0, SCROLL_SPEED); // Scroll Down
                resetGestureState();
                return;
            }
        }

        // B. HORIZONTAL -> TABS (Held)
        let candidateGesture = null;
        if (isHorizontal) {
            if (dx < -0.02) candidateGesture = "TAB_RIGHT"; 
            if (dx > 0.02) candidateGesture = "TAB_LEFT";
        }

        if (candidateGesture) {
            if (currentGestureName !== candidateGesture) {
                currentGestureName = candidateGesture;
                holdStartTime = now;
                sendFeedback(0.1);
            } else {
                const elapsed = now - holdStartTime;
                const progress = Math.min(elapsed / DWELL_TIME, 1);
                sendFeedback(progress);
                
                if (elapsed >= DWELL_TIME) {
                    triggerAction(candidateGesture);
                    currentGestureName = null; 
                    holdStartTime = 0;
                    sendFeedback(0);
                }
            }
        } else {
            // Thumb is neutral? Reset.
            resetGestureState();
        }
    } 
    
    // -----------------------------------------------------------
    // NOTHING DETECTED
    // -----------------------------------------------------------
    else {
        resetGestureState();
    }

    // Update History for Swipe
    previousY = wrist.y;
}

function resetGestureState() {
    if (currentGestureName !== null) {
        currentGestureName = null;
        holdStartTime = 0;
        sendFeedback(0);
    }
    isMinimizeReady = false; // Lose "Ready" status if hand drops
}

function sendFeedback(value) {
    window.postMessage({ type: "NEURONAV_FEEDBACK", progress: value }, "*");
}

function triggerAction(actionName) {
    window.postMessage({ type: "NEURONAV_ACTION", action: actionName }, "*");
}

window.addEventListener("message", async (e) => {
    if (e.data.type === "INIT_NEURONAV") initializeAI(e.data.baseUrl);
});