document.addEventListener("DOMContentLoaded", () => {
  const summaryBtn = document.getElementById("summaryBtn");
  const summaryBox = document.getElementById("summary");
  const summaryTypeSelect = document.querySelector(".dropdown");
  const copyBtn = document.querySelector(".btn-copy");

  // Copy to clipboard functionality
  copyBtn.addEventListener("click", async () => {
  const textToCopy = summaryBox.innerText;
    if (!textToCopy) return;

    // Show feedback immediately
    copyBtn.textContent = "✓";

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      copyBtn.textContent = "Failed!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
      return;
    }

    // Reset after a delay
    setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
  });




  // Function to inject and execute content script
  async function injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    } catch (error) {
      throw new Error("Failed to initialize content script");
    }
  }


  // Function to get API key from storage
  async function getApiKey() {
    try {
      const result = await chrome.storage.sync.get(["geminiApiKey"]);
      return result.geminiApiKey;
    } catch (error) {
      throw new Error("API key not found. Please set it in options.");
    }
  }


  // Function to get summary from Gemini
  async function getGeminiSummary(text, apiKey, summaryType) {
    const maxLength = 20000;
    const truncatedText =
      text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    let prompt;
    switch (summaryType) {
      case "brief":
        prompt = `Provide a brief summary of the following article in 50 words max:\n\n${truncatedText}`;
        break;
      case "detailed":
        prompt = `Provide a detailed summary of the following article. 
          - Structure the output in multiple short paragraphs. 
          - Each paragraph should focus on a distinct key point or theme. 
          - Ensure all major details are covered clearly.\n\n${truncatedText}`;
        break;
      case "bullet-points":
        prompt = `Summarize the following article strictly in 5–7 key points. 
          - Each point MUST start with "- " (dash and a space). 
          - Leave one blank line after each point. 
          - Do not use asterisks (*) or numbers.\n\n${truncatedText}`;
        break;
      case "concise":
        prompt = `Summarize the following article in 2–3 sentences:\n\n${truncatedText}`;
        break;
      default:
        prompt = `Summarize the following article:\n\n${truncatedText}`;
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "API request failed");
      }

      const data = await res.json();
      return (
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No summary available."
      );
    } catch (error) {
      throw error;
    }
  }

  // Function to get page content from content.js
  async function getPageContent(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "GET_ARTICLE_TEXT" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(response);
        }
      );
    });
  }


  // Main click handler
  summaryBtn.addEventListener("click", async () => {
    summaryBox.textContent = "Initializing...";

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Inject content script first
      await injectContentScript(tab.id);

      // Get API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error("Please set your Gemini API key in options");
      }

      // Get summary type (from dropdown, fallback to "concise")
      const summaryType =
        summaryTypeSelect?.value && summaryTypeSelect.value !== ""
          ? summaryTypeSelect.value
          : "concise";

      // Get page content
      summaryBox.textContent = "Extracting content...";
      const response = await getPageContent(tab.id);

      if (response && response.text) {
        // Generate summary
        summaryBox.textContent = "Generating summary...";
        const summary = await getGeminiSummary(
          response.text,
          apiKey,
          summaryType
        );

        // Render summary with line breaks + bullets
        summaryBox.innerHTML = summary
          .replace(/^- /gm, "• ")   
          .replace(/\n/g, "<br><br>");  
      } else {
        summaryBox.textContent = "No content found on this page";
      }
    } catch (error) {
  console.error("Error occurred:", error);

  if (error.message.includes("API key") || error.message.includes("Permission denied")) {
    summaryBox.textContent = "❌ Invalid API key. Please check your Gemini API key.";
  } else if (error.message.includes("content script")) {
    summaryBox.textContent = "⚠️ Failed to load content script. Please refresh.";
  } else if (error.message.includes("<article>") || error.message.includes("<p>")) {
    summaryBox.textContent = "This webpage does not contain readable <article> or <p> content.";
  } else {
    summaryBox.textContent = "⚠️ Unexpected error. Please try again later.";
  }
}
  });
});
