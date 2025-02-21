// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadWithFetch") {
    console.log("Content script received download request:", request);
    
    // Use fetch with the appropriate headers
    fetchAndDownload(request.url, request.filename)
      .then(result => {
        sendResponse({ success: true, message: "Download completed via content script" });
      })
      .catch(error => {
        console.error("Content script download error:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  else if (request.action === "ping") {
    // Simple ping to check if content script is loaded
    sendResponse({ status: "ready" });
  }
});

// Function to fetch and download with proper headers
async function fetchAndDownload(url, filename) {
  try {
    console.log(`Content script fetching: ${url}`);
    
    // Fetch the file with custom headers
    const response = await fetch(url, {
      headers: {
        "Origin": "https://libbyapp.com"
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Convert response to blob
    const blob = await response.blob();
    
    // Create download link
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    
    return { success: true };
  } catch (error) {
    console.error("Fetch download error:", error);
    throw error;
  }
}

// Let the background script know the content script is loaded
chrome.runtime.sendMessage({ action: "contentScriptReady" });
console.log("Download Helper content script initialized");
