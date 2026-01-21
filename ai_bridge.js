// ai_bridge.js - MASTER: Scissor + Scroll + Minimize + Gun + Circle

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
console.log("NeuroNav: Master V2 Loading...");
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
let previousY = null; // For Minimize
let isMinimizeReady = false;
let scissorState = "CLOSED"; 

// Circle Detection State (Reload)
let circlePoints = []; 
const CIRCLE_HISTORY_SIZE = 30; // Track last 30 frames

// CONFIG
const DWELL_TIME = 500; // 0.5s hold time
const SCROLL_SPEED = 4; 
const MINIMIZE_SWIPE_SPEED = 0.015;

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

    // 1. DETECT POSE PRIMITIVES

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
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) && 
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.2 && 
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.2
    );

    // Gun Pose (Index & Thumb Extended, others Curled)
    const isGunPose = (
        !fingersClosed && !isScissorPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.15 && // Index Out
        Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > 0.15 && // Thumb Out
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.15 && // Middle Curled
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15 && // Ring Curled
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.15    // Pinky Curled
    );

    // Index Point Pose (Only Index Extended, others Curled) -> For Reload Circle
    const isIndexPointPose = (
        !fingersClosed && !isScissorPose && !isGunPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.15 && // Index Out
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.15 && // Middle Curled
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15        // Ring Curled
        // Note: Thumb position doesn't matter much for "Point", but strictly curled is better
    );

    // Open Hand (All extended)
    const fingersOpen = (
        !isScissorPose && !isGunPose && !isIndexPointPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.2 &&
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > 0.2 &&
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) > 0.2 &&
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > 0.2
    );


    // -----------------------------------------------------------
    // PRIORITY 1: SCISSOR (Close Tab)
    // -----------------------------------------------------------
    if (isScissorPose) {
        resetOthers();
        const scissorDist = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y);
        
        if (scissorDist > 0.05) {
            if (scissorState !== "OPEN") {
                console.log("✂️ SCISSOR READY");
                scissorState = "OPEN";
                sendFeedback(0.5); 
            }
        } else if (scissorDist < 0.04) {
            if (scissorState === "OPEN") {
                console.log("✂️ CUT -> CLOSE TAB");
                triggerAction("CLOSE_TAB");
                scissorState = "CLOSED"; 
                sendFeedback(0);
            }
        }
        return; 
    } else {
        if (scissorState === "OPEN") { scissorState = "CLOSED"; sendFeedback(0); }
    }


    // -----------------------------------------------------------
    // PRIORITY 2: GUN (New Tab)
    // -----------------------------------------------------------
    if (isGunPose) {
        resetOthers();
        
        // Logic: Hold for DWELL_TIME
        if (currentGestureName !== "NEW_TAB") {
            currentGestureName = "NEW_TAB";
            holdStartTime = Date.now();
            sendFeedback(0.1);
        } else {
            const elapsed = Date.now() - holdStartTime;
            const progress = Math.min(elapsed / DWELL_TIME, 1);
            sendFeedback(progress);
            
            if (elapsed >= DWELL_TIME) {
                console.log("🔫 GUN FIRED -> NEW TAB");
                triggerAction("NEW_TAB");
                currentGestureName = null;
                holdStartTime = 0;
                sendFeedback(0);
            }
        }
        return; // Priority over others
    }


    // -----------------------------------------------------------
    // PRIORITY 3: INDEX CIRCLE (Reload)
    // -----------------------------------------------------------
    if (isIndexPointPose) {
        resetOthers();
        
        // Track Index Tip History
        circlePoints.push({x: indexTip.x, y: indexTip.y});
        if (circlePoints.length > CIRCLE_HISTORY_SIZE) circlePoints.shift();

        // Detect Circle Logic
        // We check if the points cover all 4 quadrants relative to the center of movement
        if (circlePoints.length > 20) {
            if (detectCircle(circlePoints)) {
                console.log("🔄 CIRCLE DETECTED -> RELOAD");
                triggerAction("RELOAD");
                circlePoints = []; // Clear history to prevent double trigger
            }
        }
        return;
    } else {
        circlePoints = []; // Clear history if pose lost
    }


    // -----------------------------------------------------------
    // PRIORITY 4: MINIMIZE (Open Hand -> Arm -> Swipe)
    // -----------------------------------------------------------
    if (fingersOpen) {
        // ... (Keep existing Minimize logic) ...
        const now = Date.now();
        if (!isMinimizeReady) {
            if (currentGestureName !== "ARMING_MINIMIZE") {
                currentGestureName = "ARMING_MINIMIZE";
                holdStartTime = now;
                sendFeedback(0.1);
            } else {
                const elapsed = now - holdStartTime;
                if (elapsed >= DWELL_TIME) { isMinimizeReady = true; sendFeedback(1); }
                else { sendFeedback(elapsed/DWELL_TIME); }
            }
        } else {
            sendFeedback(1);
            if (previousY !== null) {
                const deltaY = wrist.y - previousY;
                if (deltaY > MINIMIZE_SWIPE_SPEED) {
                    console.log("⬇️ SWIPE -> MINIMIZE");
                    triggerAction("MINIMIZE");
                    resetOthers();
                }
            }
        }
        previousY = wrist.y;
        return;
    } 

    // -----------------------------------------------------------
    // PRIORITY 5: THUMB (Scroll / Switch Tabs)
    // -----------------------------------------------------------
    if (fingersClosed) {
        resetOthers();
        
        const dx = thumbTip.x - thumbMCP.x;
        const dy = thumbTip.y - thumbMCP.y;
        const isHorizontal = Math.abs(dx) > Math.abs(dy);

        // Vertical -> Scroll
        if (!isHorizontal) {
            if (dy < -0.02) window.scrollBy(0, -SCROLL_SPEED);
            else if (dy > 0.02) window.scrollBy(0, SCROLL_SPEED);
        }
        // Horizontal -> Tabs
        else {
            let candidate = null;
            if (dx < -0.02) candidate = "TAB_RIGHT";
            if (dx > 0.02) candidate = "TAB_LEFT";
            
            if (candidate) {
                if (currentGestureName !== candidate) {
                    currentGestureName = candidate;
                    holdStartTime = Date.now();
                    sendFeedback(0.1);
                } else {
                    const elapsed = Date.now() - holdStartTime;
                    sendFeedback(Math.min(elapsed/DWELL_TIME, 1));
                    if (elapsed >= DWELL_TIME) {
                        triggerAction(candidate);
                        currentGestureName = null;
                        holdStartTime = 0;
                        sendFeedback(0);
                    }
                }
            } else {
                resetGestureState();
            }
        }
        return;
    }

    // Nothing detected
    resetGestureState();
    previousY = wrist.y;
}

// --- HELPER FUNCTIONS ---

function resetOthers() {
    isMinimizeReady = false; 
    // We don't reset circlePoints here immediately to allow slight flickers, 
    // but main logic handles it.
}

function resetGestureState() {
    currentGestureName = null;
    holdStartTime = 0;
    sendFeedback(0);
    isMinimizeReady = false;
    circlePoints = [];
}

function detectCircle(points) {
    // 1. Calculate Center of the tracked points
    let sumX = 0, sumY = 0;
    for (let p of points) { sumX += p.x; sumY += p.y; }
    const centerX = sumX / points.length;
    const centerY = sumY / points.length;

    // 2. Check Quadrant Traversal
    // We need to see points in Top-Left, Top-Right, Bottom-Right, Bottom-Left
    let q1=false, q2=false, q3=false, q4=false;
    let width = 0, height = 0;
    
    // Also track bounding box to ensure it's not a tiny wobble
    let minX=1, maxX=0, minY=1, maxY=0;

    for (let p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;

        const dx = p.x - centerX;
        const dy = p.y - centerY;
        
        if (dx > 0 && dy < 0) q1 = true; // Top-Right (Computer Vision Y is inverted sometimes, assuming standard)
        if (dx < 0 && dy < 0) q2 = true; // Top-Left
        if (dx < 0 && dy > 0) q3 = true; // Bottom-Left
        if (dx > 0 && dy > 0) q4 = true; // Bottom-Right
    }

    // 3. Validate
    const boxSize = Math.max(maxX - minX, maxY - minY);
    // Must be large enough (> 0.05) and visit all 4 quadrants
    if (boxSize > 0.05 && q1 && q2 && q3 && q4) {
        return true;
    }
    return false;
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