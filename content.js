// Function to extract text from the webpage
function getArticleText() {
    // Try to get article content first
    const article = document.querySelector('article');
    if (article) {
        return article.innerText;
    }

    // Fallback to getting all paragraphs
    const paragraphs = document.querySelectorAll('p');
    if (paragraphs.length > 0) {
        return Array.from(paragraphs).map(p => p.innerText).join('\n');
    }

    return 'No article content found';
}

// Set up message listener immediately
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request); // Debug log
    if (request.type === "GET_ARTICLE_TEXT") {
        const text = getArticleText();
        if (!text) {
        sendResponse({
            error: "This webpage does not contain readable <article> or <p> content.",
        });
        } else {
        sendResponse({ text });
        }
    }
    return true; // Keep the message channel open
});

console.log('Content script loaded'); // Debug log