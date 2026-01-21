// ai_bridge.js - Scissor Cut + Smooth Scroll

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
console.log("NeuroNav: Scissor & Scroll Loading...");
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

let holdStartTime = 0;
let currentGestureName = null;
let scissorState = "CLOSED"; // Start assuming closed to prevent instant fire

// CONFIG
const DWELL_TIME_TAB = 500; // 0.5s hold for TABS
const SCROLL_SPEED = 4; // Pixels per frame (Very Low Pace)

function processGestures(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbMCP = landmarks[2]; 
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
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

    // Scissor Pose (Index & Middle Extended, Ring & Pinky Curled)
    const isScissorPose = (
        !fingersClosed &&
        indexTip.y < indexPip.y && // Index Up
        middleTip.y < middlePip.y && // Middle Up
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15 && // Ring curled
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.15 // Pinky curled
    );

    // 2. SCISSOR LOGIC (Close Tab)
    if (isScissorPose) {
        // Calculate distance between Index and Middle tips
        const scissorDist = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y);
        
        // State A: Open Scissors (Ready)
        if (scissorDist > 0.08) {
            if (scissorState !== "OPEN") {
                console.log("✂️ SCISSOR READY");
                scissorState = "OPEN";
                sendFeedback(0.5); // Blue bar halfway to show ready
            }
        }
        // State B: Closed Scissors (Cut!)
        else if (scissorDist < 0.03) {
            if (scissorState === "OPEN") {
                console.log("✂️ SCISSOR CUT -> CLOSE TAB");
                triggerAction("CLOSE_TAB");
                scissorState = "CLOSED"; // Reset
                sendFeedback(0);
            }
        }
        return; // Priority over other gestures
    } else {
        // If we lose the pose, just reset state silently
        if (scissorState === "OPEN") {
             scissorState = "CLOSED";
             sendFeedback(0);
        }
    }


    // 3. THUMB LOGIC (Scroll vs Tabs)
    if (fingersClosed) {
        // Calculate Thumb Vector (Tip relative to Knuckle)
        const dx = thumbTip.x - thumbMCP.x;
        const dy = thumbTip.y - thumbMCP.y; // Remember: Y is usually 0 at top in computer vision
        
        // Determine Dominant Axis
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        const isVertical = !isHorizontal;

        // A. VERTICAL -> SCROLLING (Continuous Action)
        if (isVertical) {
            // Note: In visual coords, smaller Y is higher up.
            // If Tip is ABOVE Knuckle (dy < 0) -> Thumb Up -> Scroll Up
            if (dy < -0.02) { 
                window.scrollBy(0, -SCROLL_SPEED); // Scroll Up
                resetGestureState(); // No holding needed
                return;
            }
            // If Tip is BELOW Knuckle (dy > 0) -> Thumb Down -> Scroll Down
            else if (dy > 0.02) {
                window.scrollBy(0, SCROLL_SPEED); // Scroll Down
                resetGestureState();
                return;
            }
        }

        // B. HORIZONTAL -> TABS (Held Action)
        let candidateGesture = null;
        if (isHorizontal) {
            if (dx < -0.02) candidateGesture = "TAB_RIGHT"; // Left points Right (Mirror)
            if (dx > 0.02) candidateGesture = "TAB_LEFT";
        }

        // Process Hold Timer for Tabs
        if (candidateGesture) {
            const now = Date.now();
            if (currentGestureName !== candidateGesture) {
                currentGestureName = candidateGesture;
                holdStartTime = now;
                sendFeedback(0.1);
            } else {
                const elapsedTime = now - holdStartTime;
                const progress = Math.min(elapsedTime / DWELL_TIME_TAB, 1);
                sendFeedback(progress);
                
                if (elapsedTime >= DWELL_TIME_TAB) {
                    triggerAction(candidateGesture);
                    currentGestureName = null; 
                    holdStartTime = 0;
                    sendFeedback(0);
                }
            }
        } else {
            resetGestureState();
        }
    } 
    else {
        resetGestureState();
    }
}

function resetGestureState() {
    if (currentGestureName !== null) {
        currentGestureName = null;
        holdStartTime = 0;
        sendFeedback(0);
    }
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