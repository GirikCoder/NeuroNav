console.log("NeuroNav: Background Service Worker Running");

let lastActionTime = 0;
const COOLDOWN_MS = 1500;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const now = Date.now();
    if (now - lastActionTime < COOLDOWN_MS) return;

    // 1. CLOSE TAB
    if (request.command === "CLOSE_TAB") {
        console.log("Action: Close Tab");
        lastActionTime = now;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.remove(tabs[0].id);
        });
    }

    // 2. NEW TAB
    if (request.command === "NEW_TAB") {
        console.log("Action: New Tab");
        lastActionTime = now;
        chrome.tabs.create({});
    }

    // 3. RESTORE TAB
    if (request.command === "RESTORE") {
        console.log("Action: Restore");
        lastActionTime = now;
        if (chrome.sessions && chrome.sessions.restore) chrome.sessions.restore();
    }

    // 4. BOOKMARK (Two-Way Toggle Logic)
    if (request.command === "BOOKMARK") {
        console.log("Action: Bookmark Toggle");
        lastActionTime = now;
        const pageTitle = request.data ? request.data.title : "New Bookmark";
        const pageUrl = request.data ? request.data.url : null;

        if (pageUrl) {
            // Check if the URL is already bookmarked
            chrome.bookmarks.search({ url: pageUrl }, (results) => {
                if (results && results.length > 0) {
                    // ALREADY BOOKMARKED -> REMOVE IT
                    console.log("Removing existing bookmark...");
                    results.forEach(bm => chrome.bookmarks.remove(bm.id));
                } else {
                    // NOT BOOKMARKED -> ADD IT
                    console.log("Adding new bookmark...");
                    chrome.bookmarks.create({ parentId: '1', title: pageTitle, url: pageUrl }, () => {
                        if (chrome.runtime.lastError) {
                            chrome.bookmarks.create({ title: pageTitle, url: pageUrl });
                        }
                    });
                }
            });
        }
    }

    // 5. RELOAD 
    if (request.command === "RELOAD") {
        console.log("Action: Reload");
        lastActionTime = now; 
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        });
    }

    // 6. MINIMIZE
    if (request.command === "MINIMIZE") {
        console.log("Action: Minimize");
        lastActionTime = now;
        chrome.windows.getCurrent((win) => chrome.windows.update(win.id, { state: "minimized" }));
    }

    // 7. TAB NAV
    if (request.command === "TAB_LEFT") {
        lastActionTime = now;
        navigateTabs(-1);
    }
    if (request.command === "TAB_RIGHT") {
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