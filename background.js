console.log("NeuroNav: Background Service Worker Running");

// GLOBAL COOLDOWN
let lastActionTime = 0;
const COOLDOWN_MS = 1500;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const now = Date.now();
    
    // Check Global Cooldown (Except for critical actions like Close/Reload)
    if (now - lastActionTime < COOLDOWN_MS) return;

    // 1. CLOSE TAB (Scissor)
    if (request.command === "CLOSE_TAB") {
        console.log("Action: Close Tab");
        lastActionTime = now;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.remove(tabs[0].id);
        });
    }

    // 2. OPEN NEW TAB (Gun Gesture)
    if (request.command === "NEW_TAB") {
        console.log("Action: New Tab");
        lastActionTime = now;
        chrome.tabs.create({});
    }

    // 3. RELOAD TAB (Index Circle)
    if (request.command === "RELOAD") {
        console.log("Action: Reload");
        lastActionTime = now; // Longer cooldown to prevent double reload
        chrome.tabs.reload();
    }

    // 4. MINIMIZE
    if (request.command === "MINIMIZE") {
        console.log("Action: Minimize");
        lastActionTime = now;
        chrome.windows.getCurrent((win) => {
            chrome.windows.update(win.id, { state: "minimized" });
        });
    }

    // 5. TAB SWITCHING
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