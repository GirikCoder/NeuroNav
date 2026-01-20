console.log("NeuroNav: Background Service Worker Running");

// GLOBAL COOLDOWNS (Different actions need different timers)
let lastTabTime = 0;
let lastWinTime = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const now = Date.now();

    // 1. TAB SWITCHING (Cooldown: 800ms)
    if (request.command === "TAB_LEFT" || request.command === "TAB_RIGHT") {
        if (now - lastTabTime > 800) {
            lastTabTime = now;
            navigateTabs(request.command === "TAB_RIGHT" ? 1 : -1);
        }
    }

    // 2. MINIMIZE (Cooldown: 2 seconds)
    if (request.command === "MINIMIZE") {
        if (now - lastWinTime > 2000) {
            lastWinTime = now;
            chrome.windows.getCurrent((win) => {
                chrome.windows.update(win.id, { state: "minimized" });
            });
        }
    }

    // 3. SPLIT SCREEN (Cooldown: 1.5 seconds)
    if (request.command === "SNAP_LEFT" || request.command === "SNAP_RIGHT") {
        if (now - lastWinTime > 1500) {
            lastWinTime = now;
            snapWindow(request.command === "SNAP_LEFT" ? "LEFT" : "RIGHT");
        }
    }
});

// Helper: Switch Tabs
async function navigateTabs(direction) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(tab => tab.active);
    if (activeTab) {
        // Calculate new index with wrapping (Loop around)
        let nextIndex = activeTab.index + direction;
        if (nextIndex >= tabs.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = tabs.length - 1;
        
        const nextTab = tabs.find(tab => tab.index === nextIndex);
        if (nextTab) chrome.tabs.update(nextTab.id, { active: true });
    }
}

// Helper: Snap Window
async function snapWindow(side) {
    const window = await chrome.windows.getCurrent();
    const display = await chrome.system.display.getInfo();
    // Use primary display for simplicity
    const primary = display.find(d => d.isPrimary) || display[0];
    const workArea = primary.workArea;

    const width = Math.floor(workArea.width / 2);
    const height = workArea.height;
    const top = workArea.top;
    const left = side === "LEFT" ? workArea.left : workArea.left + width;

    chrome.windows.update(window.id, {
        state: "normal", // Must un-maximize to move
        left: left,
        top: top,
        width: width,
        height: height
    });
}