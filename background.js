chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["geminiAPIKey"], (result) => {
        if (!result.geminiAPIKey) {
            chrome.tabs.create({ url: "options.html" });// Open options page if API key is not set
        }
    });
});