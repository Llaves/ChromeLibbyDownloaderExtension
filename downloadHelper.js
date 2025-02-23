// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadWithFetch") {
    console.log("Content script received download request:", request);

    // Use fetch with the appropriate headers and add ID3 tags
    fetchAndDownload(request.url, request.filename, request.metadata)
      .then(result => {
        console.log("Download completed successfully"); // Add log
        sendResponse({ success: true, message: "Download completed via content script" });
      })
      .catch(error => {
        console.error("Content script download error:", error);
        sendResponse({ success: false, error: error.message });
      })
      .finally(() => { // Ensure response is always sent
        console.log("downloadWithFetch listener completed (success or error)"); // Add log
      });

    return true; // Keep the message channel open for async response
  } else if (request.action === "ping") {
    // Simple ping to check if content script is loaded
    sendResponse({ status: "ready" });
  }
  else if (request.action === "startCapture") {
    startDownloadProcess()
    .then(() => {
        console.log("startDownloadProcess completed successfully");
        sendResponse({ success: true, message: "Capture process completed" });
    })
    .catch(error => {
      console.error("Error during capture process:", error);
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep the message channel open for async response
  }
});

// Function to fetch and download with proper headers and add ID3 tags
async function fetchAndDownload(url, filename, metadata) {
  try {
    console.log(`Content script fetching: ${url}`);
    console.log(`Adding ID3 tags:`, metadata);

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
    let blob = await response.blob();

    // Add ID3 tags if browser-id3-writer is available and metadata is provided
    if (window.ID3Writer && metadata) {
      try {
        // Convert blob to array buffer for ID3 writer
        const arrayBuffer = await blob.arrayBuffer();

        // Create ID3 writer instance
        const writer = new ID3Writer(arrayBuffer);

        // Set tags
        writer.setFrame('TIT2', metadata.title)            // Title
              .setFrame('TPE1', [metadata.artist])         // Artist
              .setFrame('TCOM', [metadata.author])         // Composer (using for Author)
              .setFrame('TRCK', String(metadata.trackNumber)); // Track number

        // Apply changes
        writer.addTag();

        // Get the tagged audio as blob
        const taggedArrayBuffer = writer.arrayBuffer;
        blob = new Blob([taggedArrayBuffer], { type: 'audio/mpeg' });

        console.log("ID3 tags added successfully");
      } catch (tagError) {
        console.error("Error adding ID3 tags:", tagError);
        // Continue with download even if tagging fails
      }
    } else {
      console.warn("ID3Writer not available or no metadata provided");
    }

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

async function startDownloadProcess() {
  console.log("Starting download process...");
  let endOfBook = false;

  // 1. Play the Audiobook
  const playButton = document.querySelector('button[aria-label="Play"].playback-toggle.halo');
  if (playButton) {
    playButton.click();
    await delay(1000); // Give it a second to start playing
  } else {
    console.error("Play button not found.");
    throw new Error("Play button not found."); // Throw error to be caught in popup.js
  }

  // 2.  Loop through chapters
  while (!endOfBook) {
    const nextChapterButton = document.querySelector('button.chapter-bar-next-button.chapter-bar-jump-button.halo[aria-label*="Next Chapter"]');

    if (nextChapterButton) {
      nextChapterButton.click();
      await delay(500); // Adjust delay as needed for Libby to load the next chapter

      //Check for end of book condition immediately after clicking.
      if (nextChapterButton.ariaLabel && nextChapterButton.ariaLabel.includes("End Of Audiobook")) {
          endOfBook = true;
          //Click one more time
           nextChapterButton.click();
           await delay(500);
           break;

        }

    } else {
      console.warn("Next chapter button not found or end of book reached.");
      break;
    }
  }
    console.log("Download process completed.");
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Let the background script know the content script is loaded
chrome.runtime.sendMessage({ action: "contentScriptReady" });
console.log("Download Helper content script initialized");