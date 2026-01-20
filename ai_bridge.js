// ai_bridge.js - Universal Injector + Motion Gestures

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
console.log("NeuroNav: Motion Gestures Loading...");

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

        console.log("NeuroNav: 🧠 AI Ready!");
        const videoElement = document.getElementById("neuronav-video");
        if (videoElement) startDetectionLoop(handLandmarker, videoElement);
    } catch (e) { console.error(e); }
}

function startDetectionLoop(landmarker, video) {
    async function loop() {
        if (!video.paused && !video.ended) {
            const results = await landmarker.detectForVideo(video, performance.now());
            if (results.landmarks && results.landmarks.length > 0) {
                detectAdvancedGesture(results.landmarks[0]);
            }
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// --- GESTURE LOGIC ---
let previousX = null;
let previousY = null; // NEW: Track vertical movement

function detectAdvancedGesture(landmarks) {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexPip = landmarks[6]; 
    const middlePip = landmarks[10]; 

    // 1. Define Poses
    const isTwoFingers = (
        indexTip.y < indexPip.y && 
        middleTip.y < middlePip.y && 
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) < 0.15 && 
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) < 0.15 
    );

    // Strict Open Hand check
    const isOpenHand = (
        !isTwoFingers &&
        Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > 0.2 &&
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y) > 0.2
    );

    // 2. Track Motion
    const currentX = wrist.x;
    const currentY = wrist.y;

    if (previousX !== null && previousY !== null) {
        const deltaX = currentX - previousX;
        const deltaY = currentY - previousY;
        const SWIPE_SPEED = 0.03; // Velocity threshold

        // ACTION 1: TAB SWITICHING (Two Fingers + Horizontal Move)
        if (isTwoFingers) {
            if (deltaX < -SWIPE_SPEED) { 
                 window.postMessage({ type: "NEURONAV_ACTION", action: "TAB_LEFT" }, "*");
            } 
            else if (deltaX > SWIPE_SPEED) { 
                 window.postMessage({ type: "NEURONAV_ACTION", action: "TAB_RIGHT" }, "*");
            }
        }

        // ACTION 2 & 3: OPEN HAND GESTURES
        if (isOpenHand) {
            // A. MINIMIZE (Move Downward)
            // Note: In computer vision, Y increases as you go DOWN the screen.
            // So positive deltaY means moving down.
            if (deltaY > SWIPE_SPEED) {
                console.log("⬇️ SWIPE DOWN DETECTED");
                window.postMessage({ type: "NEURONAV_ACTION", action: "MINIMIZE" }, "*");
            }

            // B. SPLIT SCREEN (Hand at Edges)
            // Only trigger if we aren't swiping down (to avoid conflicts)
            else if (Math.abs(deltaY) < SWIPE_SPEED) {
                if (currentX < 0.15) { // Far Left Edge
                    window.postMessage({ type: "NEURONAV_ACTION", action: "SNAP_RIGHT" }, "*");
                } 
                else if (currentX > 0.85) { // Far Right Edge
                    window.postMessage({ type: "NEURONAV_ACTION", action: "SNAP_LEFT" }, "*");
                }
            }
        }
    }

    // Update history
    previousX = currentX;
    previousY = currentY;
}

window.addEventListener("message", async (e) => {
    if (e.data.type === "INIT_NEURONAV") initializeAI(e.data.baseUrl);
});