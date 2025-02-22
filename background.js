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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    clearCapturedURLs();
    console.log("Page loaded/reloaded. URL tracking reset for tab:", tabId);

    // **ADD THIS URL CHECK:**
    const libbyURLPattern = /^https:\/\/.*\.overdrive\.com\/.*/; 
    if (!tab.url || !libbyURLPattern.test(tab.url)) {
      console.log("Skipping content script injection: URL does not match Libby's domain.");
      return; // Don't inject if not on a Libby page
    }


    // Prevent multiple injections
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['browser-id3-writer.js', 'downloadHelper.js']
        }).then(() => {
          console.log("Content scripts pre-injected on page load");
        }).catch(err => {
          console.error("Failed to pre-inject content scripts:", err);
        });
      } else {
        console.log("Content script already loaded");
      }
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
          files: ['browser-id3-writer.js', 'downloadHelper.js']
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
async function downloadAudioFile(url, filename, metadata) {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }

    const activeTab = tabs[0];

    // Ensure content script is loaded first
    await ensureContentScriptLoaded(activeTab.id);

    // Now send the download message with metadata
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        activeTab.id,
        {
          action: "downloadWithFetch",
          url: url,
          filename: filename,
          metadata: metadata
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
      let responded = false;

      downloadAudioFile(request.url, request.filename, request.metadata)
        .then(() => {
          responded = true;
          sendResponse({ success: true });
        })
        .catch(error => {
          responded = true;
          sendResponse({ success: false, error: error.message });
        });

      // Failsafe timeout to avoid message channel closing unexpectedly
      setTimeout(() => {
        if (!responded) {
          sendResponse({ success: false, error: "Timeout: No response received" });
        }
      }, 5000); // Adjust timeout if needed

      return true; // Keeps the message channel open
    }

    // Check if content script is ready
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