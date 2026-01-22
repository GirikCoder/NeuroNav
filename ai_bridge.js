//Scroll Up/Down	Fist + Thumb Up/Down
//Next/Prev Tab	Thumb + Index (Gun)
//Close Tab	Index + Middle (Scissor)
//Restore Tab	Index + Pinky (Rock Sign)
//New Tab	Index + Middle + Ring (Three Fingers)
//Reload Tab	Pinky Up (Pinky Promise)
//Minimize	All Fingers Extended (Open Hand Swipe)
//Bookmark	Thumb + Pinky (Call Me Sign)


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

console.log("NeuroNav: Master V10 Loading...");
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

    // Helpers
    function isFolded(tip, mcp) {
        return Math.hypot(tip.x - mcp.x, tip.y - mcp.y) < 0.09 || Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < 0.12;
    }
    function isExtended(tip, mcp) {
        return Math.hypot(tip.x - mcp.x, tip.y - mcp.y) > 0.10;
    }

    const indexFolded = isFolded(indexTip, indexMCP);
    const middleFolded = isFolded(middleTip, middleMCP);
    const ringFolded = isFolded(ringTip, ringMCP);
    const pinkyFolded = isFolded(pinkyTip, pinkyMCP);

    const indexExt = isExtended(indexTip, indexMCP);
    const middleExt = isExtended(middleTip, middleMCP);
    const ringExt = isExtended(ringTip, ringMCP);
    const pinkyExt = isExtended(pinkyTip, pinkyMCP);
    const thumbExtended = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y) > 0.12;
    const thumbFolded = !thumbExtended;

    // --- POSES ---

    // 1. SCROLL (Fist + Thumb)
    const isScrollPose = thumbExtended && indexFolded && middleFolded && ringFolded && pinkyFolded;

    // 2. BOOKMARK (Call Me: Thumb + Pinky)
    const isCallMePose = thumbExtended && pinkyExt && indexFolded && middleFolded && ringFolded;

    // 3. GUN (Nav: Thumb + Index)
    const isGunPose = thumbExtended && indexExt && middleFolded && ringFolded && pinkyFolded;

    // 4. SCISSOR (Close: Index + Middle)
    const isScissorPose = indexExt && middleExt && ringFolded && pinkyFolded && thumbFolded;

    // 5. ROCK (Restore: Index + Pinky)
    const isRockPose = indexExt && pinkyExt && middleFolded && ringFolded;

    // 6. PINKY PROMISE (Reload: Pinky Only)
    const isPinkyPose = pinkyExt && indexFolded && middleFolded && ringFolded && thumbFolded;

    // 7. NEW TAB (3 Fingers)
    const isThreeFingers = indexExt && middleExt && ringExt && pinkyFolded;

    // 8. MINIMIZE (Open Hand)
    const isOpenHand = indexExt && middleExt && ringExt && pinkyExt && thumbExtended;


    // --- PRIORITY ---

    // A. SCROLL (Joystick)
    if (isScrollPose) {
        resetOthers(); 
        const dy = thumbTip.y - thumbMCP.y;
        if (Math.abs(dy) > 0.03) {
             if (dy < 0) window.scrollBy(0, -SCROLL_SPEED); 
             else window.scrollBy(0, SCROLL_SPEED);
        }
        return;
    }

    // B. BOOKMARK
    if (isCallMePose) {
        resetOthers();
        handleHoldGesture("BOOKMARK", "BOOKMARK");
        return;
    }

    // C. MINIMIZE
    if (isOpenHand) {
        handleHoldGesture("MINIMIZE", "MINIMIZE", MINIMIZE_DWELL);
        return;
    }

    // D. NAV TABS
    if (isGunPose) {
        resetOthers();
        const dx = indexTip.x - indexMCP.x; 
        if (dx < -0.05) handleHoldGesture("TAB_RIGHT", "TAB_RIGHT");
        if (dx > 0.05) handleHoldGesture("TAB_LEFT", "TAB_LEFT");
        return;
    }

    // E. RELOAD (Pinky)
    if (isPinkyPose) {
        resetOthers();
        handleHoldGesture("RELOAD", "RELOAD");
        return;
    }

    // F. RESTORE
    if (isRockPose) {
        resetOthers();
        handleHoldGesture("RESTORE", "RESTORE");
        return;
    }

    // G. NEW TAB
    if (isThreeFingers) {
        resetOthers();
        handleHoldGesture("NEW_TAB", "NEW_TAB");
        return;
    }

    // H. CLOSE TAB
    if (isScissorPose) {
        resetOthers();
        handleHoldGesture("CLOSE_TAB", "CLOSE_TAB");
        return;
    }

    resetGestureState();
}

function handleHoldGesture(gestureName, actionCommand, customDwell) {
    const dwell = customDwell || DWELL_TIME;
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
            currentGestureName = null;
            holdStartTime = 0;
            sendFeedback(0);
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