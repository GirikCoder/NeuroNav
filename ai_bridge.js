//Scroll Up/Down	Fist + Thumb Up/Down
//Next/Prev Tab	Thumb + Index (Gun)
//Close Tab	Index + Middle (Scissor)
//Restore Tab	Index + Pinky (Rock Sign)
//New Tab	Index + Middle + Ring (Three Fingers)
//Reload Tab	Pinky Up (Pinky Promise)
//Minimize	All Fingers Extended (Open Hand Swipe)

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
console.log("NeuroNav: Master V9 (Final Fixes) Loading...");
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

// CONFIG
const DWELL_TIME = 550; // 0.55s Standard Hold
const MINIMIZE_DWELL = 800; // 0.8s Hold for Minimize (Safety)
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

    // --- 1. GEOMETRY HELPERS ---
    function isFolded(tip, mcp) {
        return Math.hypot(tip.x - mcp.x, tip.y - mcp.y) < 0.09 || Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < 0.12;
    }
    function isExtended(tip, mcp) {
        return Math.hypot(tip.x - mcp.x, tip.y - mcp.y) > 0.10;
    }

    // Finger States
    const indexFolded = isFolded(indexTip, indexMCP);
    const middleFolded = isFolded(middleTip, middleMCP);
    const ringFolded = isFolded(ringTip, ringMCP);
    const pinkyFolded = isFolded(pinkyTip, pinkyMCP);

    const indexExt = isExtended(indexTip, indexMCP);
    const middleExt = isExtended(middleTip, middleMCP);
    const ringExt = isExtended(ringTip, ringMCP);
    const pinkyExt = isExtended(pinkyTip, pinkyMCP);
    
    // Thumb Extension (Distance from Index Base)
    const thumbExtended = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y) > 0.12;
    // Thumb Folded (Close to Index Base)
    const thumbFolded = !thumbExtended;

    // --- 2. DEFINE POSES ---

    // A. SCROLL (Fist + Thumb Up/Down)
    // Thumb Extended, 4 Fingers Folded.
    const isScrollPose = thumbExtended && indexFolded && middleFolded && ringFolded && pinkyFolded;

    // B. GUN (Next/Prev Tab)
    // Thumb & Index Extended. Middle/Ring/Pinky Folded.
    const isGunPose = thumbExtended && indexExt && middleFolded && ringFolded && pinkyFolded;

    // C. SCISSOR (Close Tab)
    // Index & Middle Extended. Ring & Pinky Folded. Thumb Folded.
    const isScissorPose = indexExt && middleExt && ringFolded && pinkyFolded && thumbFolded;

    // D. ROCK (Restore Tab)
    // Index & Pinky Extended. Middle & Ring Folded.
    const isRockPose = indexExt && pinkyExt && middleFolded && ringFolded;

    // E. PINKY PROMISE (Reload)
    // Pinky Extended. Others Folded.
    const isPinkyPose = pinkyExt && indexFolded && middleFolded && ringFolded;

    // F. THREE FINGERS (New Tab)
    // Index, Middle, Ring Extended. Pinky Folded.
    const isThreeFingers = indexExt && middleExt && ringExt && pinkyFolded;

    // G. OK POSE (Bookmark)
    // Middle, Ring, Pinky Extended. Index & Thumb Touching.
    const isOkPose = middleExt && ringExt && pinkyExt && 
                     Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) < 0.05;

    // H. OPEN HAND (Minimize)
    // All 5 Fingers Extended.
    const isOpenHand = indexExt && middleExt && ringExt && pinkyExt && thumbExtended;


    // --- 3. PRIORITY EXECUTION ---

    // 1. SCROLL (Vertical Joystick) - Zero Latency
    if (isScrollPose) {
        resetOthers(); 
        const dy = thumbTip.y - thumbMCP.y;
        
        // Scroll Logic
        if (Math.abs(dy) > 0.03) {
             if (dy < 0) window.scrollBy(0, -SCROLL_SPEED); // Up
             else window.scrollBy(0, SCROLL_SPEED);         // Down
        }
        return;
    }

    // 2. GUN (Next/Prev Tab)
    if (isGunPose) {
        resetOthers();
        const dx = indexTip.x - indexMCP.x; // Use Index finger direction
        
        let action = null;
        // Check Horizontal Direction of the Gun
        if (dx < -0.05) action = "TAB_RIGHT"; // Pointing Right (Mirrored Left)
        if (dx > 0.05) action = "TAB_LEFT";   // Pointing Left (Mirrored Right)

        if (action) handleHoldGesture(action, action);
        return;
    }

    // 3. MINIMIZE (Open Hand - HOLD)
    if (isOpenHand) {
        // Use longer dwell time for minimize to prevent accidents
        handleHoldGesture("MINIMIZE", "MINIMIZE", MINIMIZE_DWELL);
        return;
    }

    // 4. RELOAD (Pinky Promise)
    if (isPinkyPose) {
        resetOthers();
        handleHoldGesture("RELOAD", "RELOAD");
        return;
    }

    // 5. RESTORE (Rock)
    if (isRockPose) {
        resetOthers();
        handleHoldGesture("RESTORE", "RESTORE");
        return;
    }

    // 6. NEW TAB (3 Fingers)
    if (isThreeFingers) {
        resetOthers();
        handleHoldGesture("NEW_TAB", "NEW_TAB");
        return;
    }

    // 7. CLOSE TAB (Scissor)
    if (isScissorPose) {
        resetOthers();
        handleHoldGesture("CLOSE_TAB", "CLOSE_TAB");
        return;
    }

    // 8. BOOKMARK (Ok Pose)
    if (isOkPose) {
        resetOthers();
        handleHoldGesture("BOOKMARK", "BOOKMARK");
        return;
    }

    // RESET
    resetGestureState();
}

// --- HELPER FUNCTIONS ---

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
            console.log("🚀 ACTION FIRED:", gestureName);
            triggerAction(actionCommand);
            currentGestureName = null;
            holdStartTime = 0;
            sendFeedback(0);
        }
    }
}

function resetOthers() {
    // Placeholder for future logic if needed
}

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