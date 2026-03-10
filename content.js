// content.js - Video, Canvas, and Collapsible Legend UI

// 1. Setup Video
const videoElement = document.createElement('video');
videoElement.id = "neuronav-video";
Object.assign(videoElement.style, {
    position: "fixed", top: "10px", right: "10px", width: "160px", height: "120px",
    zIndex: "9998", transform: "scaleX(-1)", borderRadius: "10px", objectFit: "cover",
    border: "2px solid rgba(255,255,255,0.2)"
});
videoElement.autoplay = true;
videoElement.muted = true;

// 2. Setup Drawing Canvas (Skeletal Overlay)
const canvasElement = document.createElement('canvas');
canvasElement.id = "neuronav-canvas";
canvasElement.width = 320; 
canvasElement.height = 240;
Object.assign(canvasElement.style, {
    position: "fixed", top: "10px", right: "10px", width: "160px", height: "120px",
    zIndex: "9999", transform: "scaleX(-1)", borderRadius: "10px", pointerEvents: "none"
});

// 3. Setup Status Bar
const statusContainer = document.createElement('div');
Object.assign(statusContainer.style, {
    position: "fixed", top: "135px", right: "10px", width: "160px", height: "4px",
    zIndex: "9999", background: "rgba(0,0,0,0.5)", borderRadius: "2px", overflow: "hidden",
    display: "none"
});
const progressBar = document.createElement('div');
Object.assign(progressBar.style, {
    width: "0%", height: "100%", background: "#00e5ff", transition: "width 0.1s linear"
});
statusContainer.appendChild(progressBar);

// 4. SETUP COLLAPSIBLE LEGEND
const legendContainer = document.createElement('div');
Object.assign(legendContainer.style, {
    position: "fixed", top: "145px", right: "10px", width: "160px",
    zIndex: "9998", background: "rgba(0, 0, 0, 0.75)", color: "#ffffff",
    borderRadius: "8px", padding: "10px", boxSizing: "border-box",
    fontFamily: "Segoe UI, Arial, sans-serif", fontSize: "11px", lineHeight: "1.6",
    backdropFilter: "blur(5px)", border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.3)"
});

// Legend Header with Hide/Show Button
const legendHeader = document.createElement('div');
Object.assign(legendHeader.style, {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontWeight: "bold", color: "#00e5ff", fontSize: "12px", letterSpacing: "0.5px",
    cursor: "pointer", userSelect: "none"
});
legendHeader.innerHTML = `
    <span>NeuroNav</span>
    <span id="nn-toggle" style="padding: 2px 6px; background: rgba(255,255,255,0.15); border-radius: 4px; font-size: 10px; color: #fff;">Hide</span>
`;

// Legend Body (Accurate Icons)
const legendBody = document.createElement('div');
legendBody.style.marginTop = "6px";
legendBody.innerHTML = `
    🖐️ <b>Open Hand:</b> Minimize<br>
    ✌️ <b>Scissor:</b> Close Tab<br>
    👉 <b>Gun:</b> Next/Prev Tab<br>
    👍 <b>Thumb Up/Dn:</b> Scroll<br>
    🤘 <b>Rock:</b> Restore Tab<br>
    🤙 <b>Call Me:</b> Bookmark<br>
    🤞 <b>Pinky Up:</b> Reload<br>
    🖖 <b>3-Fingers:</b> New Tab
`;

// Toggle Logic for Hide/Minimize
let isLegendOpen = true;
legendHeader.onclick = () => {
    isLegendOpen = !isLegendOpen;
    legendBody.style.display = isLegendOpen ? "block" : "none";
    document.getElementById("nn-toggle").innerText = isLegendOpen ? "Hide" : "Show";
};

legendContainer.appendChild(legendHeader);
legendContainer.appendChild(legendBody);

// 5. Camera Access
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => { 
        // Only append UI elements to DOM if camera succeeds
        document.body.appendChild(videoElement);
        document.body.appendChild(canvasElement);
        document.body.appendChild(statusContainer);
        document.body.appendChild(legendContainer);

        videoElement.srcObject = stream; 
        
        // 6. Inject Bridge only when camera is ready
        injectScript("ai_bridge.js");
    })
    .catch(e => console.error("NeuroNav Camera Error:", e));

// 6. Inject Bridge
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

// 7. Handle Messages
window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type === "NEURONAV_FEEDBACK") {
        const progress = event.data.progress; 
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

    if (event.data.type === "NEURONAV_ACTION") {
        chrome.runtime.sendMessage({ 
            command: event.data.action,
            data: { title: document.title, url: window.location.href }
        });
    }
});