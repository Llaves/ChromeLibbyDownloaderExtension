// downloadHelper.js

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadWithFetch") {
    console.log("Content script received download request:", request);

    // Use fetch with the appropriate headers and add ID3 tags
    fetchAndDownload(request.url, request.filename, request.metadata)
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
   // Add startAudioCapture action
  else if (request.action === "startAudioCapture") {
    startAudioCapture(sendResponse); // Call the function and pass sendResponse
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
              .setFrame('TRCK', String(metadata.trackNumber)) // Track number
              .setFrame('TALB', metadata.album);             // Album Title

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

//Function to start the audio capture and automation
async function startAudioCapture(sendResponse) {
  try {
    const playButtonSelector = 'button[aria-label="Play"].playback-toggle.halo';
    const nextChapterButtonSelector = 'button.chapter-bar-next-button.chapter-bar-jump-button.halo[aria-label*="Next Chapter"]';
    const delay = (ms) => new Promise(res => setTimeout(res, ms)); // Helper function for delay

    let endOfBook = false;

    // 1. Play the audio (using the provided CSS selector)
    const playButton = document.querySelector(playButtonSelector);
    if (playButton) {
      playButton.click();
      console.log("Play button clicked.");
      //Added short delay after clicking to avoid immediate clicking of next button.
      await delay(500);
    } else {
      console.warn("Play button not found.");
      sendResponse({status: "Error: Play button not found."});
      return;
    }

    // 2.  Loop through chapters
    while (!endOfBook) {
      const nextChapterButton = document.querySelector(nextChapterButtonSelector);

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

    sendResponse({status: "Audio capture and automation completed."});

  } catch (error) {
    console.error("Error during audio capture:", error);
    sendResponse({status: "Error during audio capture: " + error.message});
  }
}

// Let the background script know the content script is loaded
chrome.runtime.sendMessage({ action: "contentScriptReady" });
console.log("Download Helper content script initialized");