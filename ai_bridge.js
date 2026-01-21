// ai_bridge.js - MASTER V5: All Gestures Fixed & Integrated

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
console.log("NeuroNav: Master V5 (Final) Loading...");
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
let previousY = null; 
let isMinimizeReady = false;
let scissorState = "CLOSED"; 
let circlePoints = []; 
const CIRCLE_HISTORY_SIZE = 30; 

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

    // Scissor Pose
    const isScissorPose = (
        !fingersClosed &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y) && 
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.2 && 
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.2
    );

    // Gun Pose
    const isGunPose = (
        !fingersClosed && !isScissorPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.15 && 
        Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > 0.15 && 
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.15 && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15 && 
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.15    
    );

    // Korean Heart Pose (Relaxed)
    const thumbIndexDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const isKoreanHeartPose = (
        !fingersClosed && !isScissorPose && !isGunPose &&
        thumbIndexDist < 0.05 && 
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.2 && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.2 && 
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.2    
    );

    // Ok Pose (Index & Thumb touching, others Open)
    const isOkPose = (
        !fingersClosed && !isScissorPose && !isGunPose && !isKoreanHeartPose &&
        thumbIndexDist < 0.05 && 
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > 0.2 && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) > 0.2 && 
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > 0.2    
    );

    // Index Point Pose (Reload)
    const isIndexPointPose = (
        !fingersClosed && !isScissorPose && !isGunPose && !isKoreanHeartPose && !isOkPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.15 && 
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.15 && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15
    );

    // Open Hand (Minimize)
    const fingersOpen = (
        !isScissorPose && !isGunPose && !isIndexPointPose && !isKoreanHeartPose && !isOkPose &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.2 &&
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > 0.2 &&
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) > 0.2 &&
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > 0.2
    );


    // --- PRIORITY 1: SCISSOR ---
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


    // --- PRIORITY 2: GUN (New Tab) ---
    if (isGunPose) {
        resetOthers();
        handleHoldGesture("NEW_TAB", "NEW_TAB");
        return;
    }

    // --- PRIORITY 3: KOREAN HEART (Restore) ---
    if (isKoreanHeartPose) {
        resetOthers();
        handleHoldGesture("RESTORE", "RESTORE");
        return;
    }

    // --- PRIORITY 4: OK GESTURE (Bookmark) ---
    if (isOkPose) {
        resetOthers();
        handleHoldGesture("BOOKMARK", "BOOKMARK");
        return;
    }

    // --- PRIORITY 5: INDEX CIRCLE (Reload) ---
    if (isIndexPointPose) {
        resetOthers();
        circlePoints.push({x: indexTip.x, y: indexTip.y});
        if (circlePoints.length > CIRCLE_HISTORY_SIZE) circlePoints.shift();

        if (circlePoints.length > 20) {
            if (detectCircle(circlePoints)) {
                console.log("🔄 CIRCLE DETECTED -> RELOAD");
                triggerAction("RELOAD");
                circlePoints = []; 
            }
        }
        return;
    } else {
        circlePoints = []; 
    }


    // --- PRIORITY 6: MINIMIZE ---
    if (fingersOpen) {
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

    // --- PRIORITY 7: THUMB ---
    if (fingersClosed) {
        resetOthers();
        const dx = thumbTip.x - thumbMCP.x;
        const dy = thumbTip.y - thumbMCP.y;
        const isHorizontal = Math.abs(dx) > Math.abs(dy);

        if (!isHorizontal) {
            if (dy < -0.02) window.scrollBy(0, -SCROLL_SPEED);
            else if (dy > 0.02) window.scrollBy(0, SCROLL_SPEED);
        }
        else {
            let candidate = null;
            if (dx < -0.02) candidate = "TAB_RIGHT";
            if (dx > 0.02) candidate = "TAB_LEFT";
            if (candidate) handleHoldGesture(candidate, candidate);
            else resetGestureState();
        }
        return;
    }

    resetGestureState();
    previousY = wrist.y;
}

// --- HELPER FUNCTIONS ---

// THIS WAS MISSING AND CAUSED THE ERROR
function handleHoldGesture(gestureName, actionCommand) {
    if (currentGestureName !== gestureName) {
        currentGestureName = gestureName;
        holdStartTime = Date.now();
        sendFeedback(0.1);
    } else {
        const elapsed = Date.now() - holdStartTime;
        const progress = Math.min(elapsed / DWELL_TIME, 1);
        sendFeedback(progress);
        
        if (elapsed >= DWELL_TIME) {
            console.log("🚀 ACTION FIRED:", gestureName);
            triggerAction(actionCommand);
            currentGestureName = null;
            holdStartTime = 0;
            sendFeedback(0);
        }
    }
}

function resetOthers() {
    isMinimizeReady = false; 
}

function resetGestureState() {
    currentGestureName = null;
    holdStartTime = 0;
    sendFeedback(0);
    isMinimizeReady = false;
    circlePoints = [];
}

function detectCircle(points) {
    let sumX = 0, sumY = 0;
    for (let p of points) { sumX += p.x; sumY += p.y; }
    const centerX = sumX / points.length;
    const centerY = sumY / points.length;

    let q1=false, q2=false, q3=false, q4=false;
    let minX=1, maxX=0, minY=1, maxY=0;

    for (let p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;

        const dx = p.x - centerX;
        const dy = p.y - centerY;
        
        if (dx > 0 && dy < 0) q1 = true;
        if (dx < 0 && dy < 0) q2 = true;
        if (dx < 0 && dy > 0) q3 = true;
        if (dx > 0 && dy > 0) q4 = true;
    }

    const boxSize = Math.max(maxX - minX, maxY - minY);
    if (boxSize > 0.05 && q1 && q2 && q3 && q4) return true;
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