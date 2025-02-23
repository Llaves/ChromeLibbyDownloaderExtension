document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const bookTitleInput = document.getElementById('bookTitle');
    const authorNameInput = document.getElementById('authorName');

    // Get button elements
    const clearUrlsBtn = document.getElementById('clearUrlsBtn');
    const downloadUrlsBtn = document.getElementById('downloadUrlsBtn');
    const captureAudioBtn = document.getElementById('captureAudioBtn'); // New button
    const statusDiv = document.getElementById('status');
    const captureStatusDiv = document.getElementById('captureStatus'); // Changed to div
    const progressDiv = document.querySelector('.progress');
    const downloadCountSpan = document.getElementById('downloadCount');
    const totalCountSpan = document.getElementById('totalCount');
    const downloadProgress = document.getElementById('downloadProgress');

    // Load saved metadata if available
    chrome.storage.local.get(['bookTitle', 'authorName'], function(result) {
        if (result.bookTitle) bookTitleInput.value = result.bookTitle;
        if (result.authorName) authorNameInput.value = result.authorName;
    });

    // Save metadata when changed
    bookTitleInput.addEventListener('change', saveMetadata);
    authorNameInput.addEventListener('change', saveMetadata);

    function saveMetadata() {
        chrome.storage.local.set({
            'bookTitle': bookTitleInput.value,
            'authorName': authorNameInput.value
        });
    }

    // Check current capture status and URL count
    updateCaptureStatus();

    function updateCaptureStatus() {
        chrome.storage.local.get(['capturedURLs'], function(result) {
            const count = result.capturedURLs ? result.capturedURLs.length : 0;
            captureStatusDiv.textContent = `Monitoring for media URLs (${count} captured)`; // Use div

            // Disable download button if fields are empty or no URLs captured
            const metadataComplete = bookTitleInput.value.trim() !== '' && authorNameInput.value.trim() !== '';
            downloadUrlsBtn.disabled = count === 0 || !metadataComplete;

            if (count === 0) {
                statusDiv.textContent = "Capture some media URLs first";
            } else if (!metadataComplete) {
                statusDiv.textContent = "Please fill in the book title and author";
            } else {
                statusDiv.textContent = "Ready to download";
            }
        });
    }

    // Update status when input fields change
    bookTitleInput.addEventListener('input', updateCaptureStatus);
    authorNameInput.addEventListener('input', updateCaptureStatus);

    // Add click event listener for Clear URLs button
    clearUrlsBtn.addEventListener('click', function() {
        // Send message to the background script to clear URLs
        chrome.runtime.sendMessage({action: "clearURLs"}, function(response) {
            if (response) {
                statusDiv.textContent = `${response.status}`;
                updateCaptureStatus();
            } else {
                statusDiv.textContent = "Error: Could not communicate with extension background process";
            }
        });
    });

    // Add click event listener for Download URLs button
    downloadUrlsBtn.addEventListener('click', function() {
        // Save metadata before downloading
        saveMetadata();

        const bookTitle = bookTitleInput.value.trim();
        const authorName = authorNameInput.value.trim();

        if (!bookTitle || !authorName) {
            statusDiv.textContent = "Please enter book title and author name";
            return;
        }

        chrome.storage.local.get(['capturedURLs'], async function(result) {
            if (!result.capturedURLs || result.capturedURLs.length === 0) {
                statusDiv.textContent = "No URLs to download";
                return;
            }

            const urls = result.capturedURLs;
            downloadUrlsBtn.disabled = true;
            statusDiv.textContent = `Starting download of ${urls.length} files...`;

            // Show progress
            progressDiv.style.display = 'block';
            totalCountSpan.textContent = urls.length;
            downloadProgress.max = urls.length;

            try {
                for (let i = 0; i < urls.length; i++) {
                    const trackNumber = i + 1;
                    downloadCountSpan.textContent = trackNumber;
                    downloadProgress.value = trackNumber;

                    // Prepare metadata
                    const metadata = {
                        title: `${bookTitle} - Part ${trackNumber}`,
                        artist: authorName,
                        author: authorName,
                        trackNumber: trackNumber,
                        album: bookTitle // Add album title
                    };

                    // Generate filename
                    const filename = `${bookTitle} - Part ${trackNumber}.mp3`;

                    // Download file with ID3 tags
                    await downloadFile(urls[i], filename, metadata);

                    // Update status
                    statusDiv.textContent = `Downloaded ${trackNumber}/${urls.length} files`;
                }
                statusDiv.textContent = `Successfully downloaded all ${urls.length} files!`;
            } catch (error) {
                statusDiv.textContent = `Error downloading: ${error.message}`;
                console.error("Download error:", error);
            } finally {
                downloadUrlsBtn.disabled = false;
            }
        });
    });

    // Function to download a file with ID3 tags
    async function downloadFile(url, filename, metadata) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    action: "downloadURL",
                    url: url,
                    filename: filename,
                    metadata: metadata
                },
                function(response) {
                    if (response && response.success) {
                        resolve();
                    } else {
                        reject(new Error(response ? response.error : "Unknown error"));
                    }
                }
            );
        });
    }

    // Listen for messages from the background script (for author field update)
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === "updateAuthorField") {
        authorNameInput.value = '';
        updateCaptureStatus(); // Refresh the capture status
      }
    });

    //Add click event listener for Capture Audio button
    captureAudioBtn.addEventListener('click', function() {
        // Send message to the background script to trigger capture
        chrome.runtime.sendMessage({action: "captureAudio"}, function(response) {
            if (response && response.status) {
                statusDiv.textContent = response.status;
            } else {
                statusDiv.textContent = "Error triggering audio capture.";
            }
        });
    });
});