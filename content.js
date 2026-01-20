// content.js - Runs in Isolated World

// 1. Setup Video (Same as before)
const videoElement = document.createElement('video');
videoElement.style.position = "fixed";
videoElement.style.top = "10px";
videoElement.style.right = "10px";
videoElement.style.width = "160px";
videoElement.style.height = "120px";
videoElement.style.zIndex = "9999";
videoElement.style.transform = "scaleX(-1)";
videoElement.id = "neuronav-video"; // <--- ADD THIS LINE
videoElement.style.borderRadius = "10px";
videoElement.style.objectFit = "cover";
videoElement.autoplay = true;
videoElement.muted = true;
document.body.appendChild(videoElement);

navigator.mediaDevices.getUserMedia({ video: true })
  .then((stream) => {
    videoElement.srcObject = stream;
    console.log("NeuroNav: Camera access granted.");
  })
  .catch((e) => console.error("NeuroNav Camera Error:", e));


// 2. INJECT the Bridge Script
function injectScript(file_path) {
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    script.setAttribute('src', chrome.runtime.getURL(file_path));
    // When the script loads, we send it the configuration
    script.onload = () => {
        // Send the Extension's base URL to the injected script
        const extensionBaseUrl = chrome.runtime.getURL("");
        window.postMessage({ type: "INIT_NEURONAV", baseUrl: extensionBaseUrl }, "*");
    };
    (document.head || document.documentElement).appendChild(script);
}

// 3. Listen for Success Message from the Bridge
window.addEventListener("message", (event) => {
    // Only listen to our own messages
    if (event.source !== window) return;
    if (event.data.type === "NEURONAV_READY") {
        console.log("NeuroNav Content Script: AI is Ready and Confirming!");
    }
    if (event.data.type === "NEURONAV_ACTION") {
        console.log("NeuroNav Relay: Sending command to Background ->", event.data.action);
        
        // Send to background.js
        chrome.runtime.sendMessage({ command: event.data.action });
    }
});

// Start the Injection
injectScript("ai_bridge.js");