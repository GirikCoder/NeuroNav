//Scroll Up/Down	Fist + Thumb Up/Down
//Next/Prev Tab	Thumb + Index (Gun)
//Close Tab	Index + Middle (Scissor)
//Restore Tab	Spiderman
//New Tab	Index + Middle + Ring (Three Fingers)
//Reload Tab	Pinky Up (Pinky Promise)
//Minimize	All Fingers Extended (Open Hand Swipe)
//Bookmark	Thumb + Pinky (Call Me Sign)


// ai_bridge.js - Skeleton Overlay & Smooth Adaptive Logic added

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

console.log("NeuroNav: Skeletal Tracking & Smoothing Loading...");
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
                drawSkeletalLines(results.landmarks[0]); // Draw the lines!
                processGestures(results.landmarks[0]);
            } else {
                clearCanvas(); // Hand left screen
                resetGestureState();
            }
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// --- DRAWING THE SKELETON ---
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [5, 9], [9, 10], [10, 11], [11, 12], // Middle
    [9, 13], [13, 14], [14, 15], [15, 16], // Ring
    [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [0, 17] // Wrist to Pinky base
];

function drawSkeletalLines(landmarks) {
    const canvas = document.getElementById("neuronav-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Wipe old lines

    // --- UPDATED: THIN & LIGHT STYLING ---
    ctx.lineWidth = 1.5; // Thinner lines (was 3)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // Light, semi-transparent white
    ctx.fillStyle = "rgba(0, 229, 255, 0.9)"; // Bright cyan for the tiny joints

    // 1. Draw connections (lines)
    HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
    });

    // 2. Draw landmarks (dots)
    landmarks.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 2, 0, 2 * Math.PI); // Smaller dots (was 4)
        ctx.fill();
    });
}

function clearCanvas() {
    const canvas = document.getElementById("neuronav-canvas");
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}


// --- GESTURE LOGIC ---

let holdStartTime = 0;
let currentGestureName = null;
const DWELL_TIME = 550; 
const MINIMIZE_DWELL = 800; 
const SCROLL_SPEED = 8; 

function processGestures(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbMCP = landmarks[2]; 
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const middleTip = landmarks[12];
    const middleMCP = landmarks[9];
    const ringTip = landmarks[16];
    const ringMCP = landmarks[13];
    const pinkyTip = landmarks[20];
    const pinkyMCP = landmarks[17];

    // --- THE SMOOTHNESS SECRET (Distance Adaptive Logic) ---
    // Measure the actual size of the hand right now. 
    // This scales the math so it works up close or far away!
    const handSize = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y);

    function isFolded(tip, mcp) {
        // If the tip is barely further from the wrist than the knuckle, it's folded.
        const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const dMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
        return dTip < dMcp + (handSize * 0.3); 
    }

    function isExtended(tip, mcp) {
        // If the tip is significantly further away from the wrist than the knuckle, it's extended.
        const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const dMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
        return dTip > dMcp + (handSize * 0.6); 
    }

    // Process all fingers with the new smooth math
    const indexFolded = isFolded(indexTip, indexMCP);
    const middleFolded = isFolded(middleTip, middleMCP);
    const ringFolded = isFolded(ringTip, ringMCP);
    const pinkyFolded = isFolded(pinkyTip, pinkyMCP);

    const indexExt = isExtended(indexTip, indexMCP);
    const middleExt = isExtended(middleTip, middleMCP);
    const ringExt = isExtended(ringTip, ringMCP);
    const pinkyExt = isExtended(pinkyTip, pinkyMCP);
    
    // Thumb needs its own specialized logic because it folds sideways
    const thumbExtended = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y) > (handSize * 0.8);
    const thumbFolded = !thumbExtended;

    // --- POSES ---
    const isScrollPose = thumbExtended && indexFolded && middleFolded && ringFolded && pinkyFolded;
    const isCallMePose = thumbExtended && pinkyExt && indexFolded && middleFolded && ringFolded;
    const isGunPose = thumbExtended && indexExt && middleFolded && ringFolded && pinkyFolded;
    const isScissorPose = indexExt && middleExt && ringFolded && pinkyFolded && thumbFolded;
    const isRockPose = indexExt && pinkyExt && middleFolded && ringFolded;
    const isPinkyPose = pinkyExt && indexFolded && middleFolded && ringFolded && thumbFolded;
    const isThreeFingers = indexExt && middleExt && ringExt && pinkyFolded;
    const isOpenHand = indexExt && middleExt && ringExt && pinkyExt && thumbExtended;

    // --- PRIORITY ---

    if (isScrollPose) {
        resetOthers(); 
        const dy = thumbTip.y - thumbMCP.y;
        if (Math.abs(dy) > 0.03) {
             if (dy < 0) window.scrollBy(0, -SCROLL_SPEED); 
             else window.scrollBy(0, SCROLL_SPEED);
        }
        return;
    }

    if (isCallMePose) {
        resetOthers();
        handleHoldGesture("BOOKMARK", "BOOKMARK",null, true);
        return;
    }

    if (isOpenHand) {
        handleHoldGesture("MINIMIZE", "MINIMIZE", MINIMIZE_DWELL);
        return;
    }

    if (isGunPose) {
        resetOthers();
        const dx = indexTip.x - indexMCP.x; 
        if (dx < -0.05) handleHoldGesture("TAB_RIGHT", "TAB_RIGHT");
        if (dx > 0.05) handleHoldGesture("TAB_LEFT", "TAB_LEFT");
        return;
    }

    if (isPinkyPose) {
        resetOthers();
        handleHoldGesture("RELOAD", "RELOAD");
        return;
    }

    if (isRockPose) {
        resetOthers();
        handleHoldGesture("RESTORE", "RESTORE");
        return;
    }

    if (isThreeFingers) {
        resetOthers();
        handleHoldGesture("NEW_TAB", "NEW_TAB");
        return;
    }

    if (isScissorPose) {
        resetOthers();
        handleHoldGesture("CLOSE_TAB", "CLOSE_TAB");
        return;
    }

    resetGestureState();
}

function handleHoldGesture(gestureName, actionCommand, customDwell, lockAfterFire = false) {
    const dwell = customDwell || DWELL_TIME;
    
    // Anti-Machine-Gun Lock (Only triggers if lockAfterFire is true)
    if (currentGestureName === gestureName + "_FIRED") {
        sendFeedback(1); // Keep the blue bar full to show it's locked
        return;
    }

    if (currentGestureName !== gestureName) {
        currentGestureName = gestureName;
        holdStartTime = Date.now();
        sendFeedback(0.1);
    } else {
        const elapsed = Date.now() - holdStartTime;
        const progress = Math.min(elapsed / dwell, 1);
        sendFeedback(progress);
        
        if (elapsed >= dwell) {
            triggerAction(actionCommand);
            
            // If it's a "Locked" gesture (like  Bookmark), wait for hand reset
            if (lockAfterFire) {
                currentGestureName = gestureName + "_FIRED"; 
                holdStartTime = 0;
                setTimeout(() => sendFeedback(0), 500); 
            } else {
                // Normal behavior (reset immediately so you can fire again smoothly)
                currentGestureName = null;
                holdStartTime = 0;
                sendFeedback(0);
            }
        }
    }
}

function resetOthers() { /* */ }

function resetGestureState() {
    currentGestureName = null;
    holdStartTime = 0;
    sendFeedback(0);
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