// background.js
console.log("NeuroNav: Background Service Worker Running");

// GLOBAL COOLDOWN
let lastActionTime = 0;
const COOLDOWN_MS = 1500;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const now = Date.now();
    
    // Check Global Cooldown
    if (now - lastActionTime < COOLDOWN_MS) return;

    // 1. CLOSE TAB (Pinky Up)
    if (request.command === "CLOSE_TAB") {
        console.log("Action: Close Tab");
        lastActionTime = now;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.remove(tabs[0].id);
        });
    }

    // 2. OPEN NEW TAB (Gun)
    if (request.command === "NEW_TAB") {
        console.log("Action: New Tab");
        lastActionTime = now;
        chrome.tabs.create({});
    }

    // 3. RESTORE TAB (Rock Sign)
    if (request.command === "RESTORE") {
        console.log("Action: Restore Closed Tab");
        lastActionTime = now;
        if (chrome.sessions && chrome.sessions.restore) {
            chrome.sessions.restore();
        } else {
            console.error("Sessions API not available.");
        }
    }

    // 4. BOOKMARK TAB (Ok Gesture)
    if (request.command === "BOOKMARK") {
        console.log("Action: Bookmark Tab");
        lastActionTime = now;
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.bookmarks.create({
                    title: tabs[0].title,
                    url: tabs[0].url
                }).then(() => {
                    console.log("SUCCESS: Bookmark created!");
                }).catch((error) => {
                    console.error("ERROR: Could not bookmark.", error);
                });
            }
        });
    }

    // 5. RELOAD TAB (Index Circle)
    if (request.command === "RELOAD") {
        console.log("Action: Reload");
        lastActionTime = now; 
        chrome.tabs.reload();
    }

    // 6. MINIMIZE (Open Hand Swipe)
    if (request.command === "MINIMIZE") {
        console.log("Action: Minimize");
        lastActionTime = now;
        chrome.windows.getCurrent((win) => {
            chrome.windows.update(win.id, { state: "minimized" });
        });
    }

    // 7. TAB SWITCHING (Thumb Swipe)
    if (request.command === "TAB_LEFT") {
        console.log("Action: Tab Left");
        lastActionTime = now;
        navigateTabs(-1);
    }

    if (request.command === "TAB_RIGHT") {
        console.log("Action: Tab Right");
        lastActionTime = now;
        navigateTabs(1);
    }
});

async function navigateTabs(direction) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(tab => tab.active);
    if (activeTab) {
        let nextIndex = activeTab.index + direction;
        if (nextIndex >= tabs.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = tabs.length - 1;
        
        const nextTab = tabs.find(tab => tab.index === nextIndex);
        if (nextTab) chrome.tabs.update(nextTab.id, { active: true });
    }
}