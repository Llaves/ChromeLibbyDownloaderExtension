// Initialize an array to store captured URLs
let capturedURLs = [];

// Function to clear the URL list
function clearCapturedURLs() {
  capturedURLs = [];
  chrome.storage.local.set({capturedURLs: []});
  console.log("Cleared captured URLs list");
}

// Listen for web requests matching our pattern
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // Check if the URL contains our target pattern
    if (details.url.includes('odrmediaclips.cachefly.net') && details.type === 'media') {
      console.log("Captured media URL:", details.url);
      
      // Add the URL to our list if not already present
      if (!capturedURLs.includes(details.url)) {
        capturedURLs.push(details.url);
        
        // Store the updated list in chrome.storage
        chrome.storage.local.set({capturedURLs: capturedURLs});
      }
    }
    // Don't interfere with the request
    return {cancel: false};
  },
  {urls: ["*://*.cachefly.net/*"], types: ["media"]},
  ["requestBody"]
);

// Listen for tab updates to detect page reloads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the page has completed loading
  if (changeInfo.status === 'complete') {
    // Clear the URL list when a page is reloaded/loaded
    clearCapturedURLs();
    console.log("Page loaded/reloaded. URL tracking reset for tab:", tabId);
    
    // Pre-inject the content script to avoid delay on first download
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['downloadHelper.js']
    }).then(() => {
      console.log("Content script pre-injected on page load");
    }).catch(err => {
      console.error("Failed to pre-inject content script:", err);
    });
  }
});

// Ensure content script is loaded before attempting download
async function ensureContentScriptLoaded(tabId) {
  return new Promise((resolve, reject) => {
    // Check if content script is responsive
    chrome.tabs.sendMessage(tabId, { action: "ping" }, response => {
      if (chrome.runtime.lastError || !response) {
        console.log("Content script not ready, injecting it now");
        
        // Inject content script
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          files: ['downloadHelper.js']
        }).then(() => {
          // Wait for content script to initialize
          setTimeout(resolve, 500);
        }).catch(err => {
          reject(new Error(`Cannot inject script: ${err.message}`));
        });
      } else {
        // Content script is already loaded
        resolve();
      }
    });
  });
}

// Use content script to download with the proper headers
async function downloadAudioFile(url, filename) {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }
    
    const activeTab = tabs[0];
    
    // Ensure content script is loaded first
    await ensureContentScriptLoaded(activeTab.id);
    
    // Now send the download message
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        activeTab.id,
        { 
          action: "downloadWithFetch", 
          url: url, 
          filename: filename 
        },
        function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(`Message error: ${chrome.runtime.lastError.message}`));
          } else if (!response || !response.success) {
            reject(new Error(response?.error || "Content script failed to download"));
          } else {
            resolve(true);
          }
        }
      );
    });
  } catch (error) {
    console.error("Download failed:", error);
    throw error;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "getURLs") {
      // Retrieve URLs from storage to ensure persistence
      chrome.storage.local.get(['capturedURLs'], function(result) {
        if (result.capturedURLs && result.capturedURLs.length > 0) {
          // Log each URL to console with the prefix
          result.capturedURLs.forEach(url => {
            console.log("CapturedURL:", url);
          });
          sendResponse({status: "Logged URLs to console", count: result.capturedURLs.length});
        } else {
          sendResponse({status: "No URLs captured yet", count: 0});
        }
      });
      return true; // Required for async sendResponse
    } 
    else if (request.action === "clearURLs") {
      // Clear the URLs
      clearCapturedURLs();
      // Send a response immediately
      sendResponse({status: "URLs cleared", count: 0});
    }
    else if (request.action === "downloadURL") {
      // Download the audio file through content script
      downloadAudioFile(request.url, request.filename)
        .then(() => {
          sendResponse({success: true});
        })
        .catch(error => {
          sendResponse({success: false, error: error.message});
        });
      return true; // Required for async sendResponse
    }
    else if (request.action === "contentScriptReady") {
      console.log("Content script is ready");
    }
    // Return true if we're sending a response asynchronously
    return true;
  }
);

// Clear captured URLs on extension install/update
chrome.runtime.onInstalled.addListener(function() {
  clearCapturedURLs();
  console.log("Libby Audiobook Helper installed/updated. URL tracking initialized.");
});
