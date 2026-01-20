// ai_bridge.js - Runs in the "Main World" (The actual webpage)
console.log("NeuroNav: Bridge Script Injected!");

async function startBrain() {
    // 1. Get the URLs (passed from content.js via a hidden element or just hardcoded logic if we could, 
    // but here we will rely on the extension ID being available or passed down).
    // simpler approach: We need the full URL.
    // Since we can't use chrome.runtime.getURL here easily, content.js will pass the base URL.
}

// We need to wait for the Base URL from content.js
window.addEventListener("message", async (event) => {
    // We only accept messages from our own extension content script
    if (event.data.type === "INIT_NEURONAV") {
        const baseUrl = event.data.baseUrl;
        console.log("NeuroNav Bridge: Received Base URL", baseUrl);
        initializeAI(baseUrl);
    }
});

async function initializeAI(baseUrl) {
    try {
        // 1. Dynamic Import of the Bundle
        const bundleUrl = `${baseUrl}vision_bundle.js`;
        
        console.log("NeuroNav Bridge: Importing Bundle from", bundleUrl);
        
        const aiModule = await import(bundleUrl);
        
        // Find the Vision classes
        let Vision = aiModule.FilesetResolver ? aiModule : aiModule.default;
        if (!Vision && window.vision) Vision = window.vision;

        if (!Vision) {
            throw new Error("Could not find Vision classes in bundle");
        }

        const { HandLandmarker, FilesetResolver } = Vision;

        // 2. Initialize the Resolver
        // FIX: The library expects a DIRECTORY, but without a trailing slash.
        // If baseUrl is "chrome-extension://id/", we need "chrome-extension://id"
        // slicing 0 to -1 removes the last character (the slash).
        const wasmDir = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

        console.log("NeuroNav Bridge: Pointing WASM to directory:", wasmDir);

        const filesetResolver = await FilesetResolver.forVisionTasks(wasmDir);

        // 3. Initialize the Landmarker
        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `${baseUrl}hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        console.log("NeuroNav: 🧠 AI Brain Fully Loaded in Main World!");
        
        // Tell content.js we are ready
        window.postMessage({ type: "NEURONAV_READY" }, "*");

    } catch (error) {
        console.error("NeuroNav Bridge Error:", error);
    }
}