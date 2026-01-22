

// 1. Setup Video
const videoElement = document.createElement('video');
videoElement.id = "neuronav-video";
Object.assign(videoElement.style, {
    position: "fixed", top: "10px", right: "10px", width: "160px", height: "120px",
    zIndex: "9999", transform: "scaleX(-1)", borderRadius: "10px", objectFit: "cover",
    border: "2px solid rgba(255,255,255,0.2)"
});
videoElement.autoplay = true;
videoElement.muted = true;
document.body.appendChild(videoElement);

// 2. Setup Status Bar (The "Loading" Bar)
const statusContainer = document.createElement('div');
Object.assign(statusContainer.style, {
    position: "fixed", top: "135px", right: "10px", width: "160px", height: "4px",
    zIndex: "9999", background: "rgba(0,0,0,0.5)", borderRadius: "2px", overflow: "hidden",
    display: "none" // Hidden by default
});
const progressBar = document.createElement('div');
Object.assign(progressBar.style, {
    width: "0%", height: "100%", background: "#00e5ff", transition: "width 0.1s linear"
});
statusContainer.appendChild(progressBar);
document.body.appendChild(statusContainer);

// 3. Camera Access
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => { videoElement.srcObject = stream; })
    .catch(e => console.error("Camera Error:", e));

// 4. Inject Bridge
function injectScript(file_path) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = chrome.runtime.getURL(file_path);
    script.onload = () => {
        window.postMessage({ type: "INIT_NEURONAV", baseUrl: chrome.runtime.getURL("") }, "*");
    };
    (document.head || document.documentElement).appendChild(script);
}
injectScript("ai_bridge.js");

// 5. Handle Messages (Feedback & Actions)
window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    // A. Update the Progress Bar
    if (event.data.type === "NEURONAV_FEEDBACK") {
        const progress = event.data.progress; // 0 to 1
        if (progress > 0) {
            statusContainer.style.display = "block";
            progressBar.style.width = (progress * 100) + "%";
            videoElement.style.borderColor = progress === 1 ? "#00ff00" : "#00e5ff";
        } else {
            statusContainer.style.display = "none";
            progressBar.style.width = "0%";
            videoElement.style.borderColor = "rgba(255,255,255,0.2)";
        }
    }

    // B. Send Command to Background (UPDATED FOR BOOKMARK)
    if (event.data.type === "NEURONAV_ACTION") {
        // Send command AND page data (Title + URL) to background
        chrome.runtime.sendMessage({ 
            command: event.data.action,
            data: {
                title: document.title,
                url: window.location.href
            }
        });
    }
});