document.addEventListener('DOMContentLoaded', function() {
  // Get button elements
  const showUrlsBtn = document.getElementById('showUrlsBtn');
  const clearUrlsBtn = document.getElementById('clearUrlsBtn');
  const downloadUrlsBtn = document.getElementById('downloadUrlsBtn');
  const statusDiv = document.getElementById('status');
  const captureStatusSpan = document.getElementById('captureStatus');
  const progressDiv = document.querySelector('.progress');
  const downloadCountSpan = document.getElementById('downloadCount');
  const totalCountSpan = document.getElementById('totalCount');
  const downloadProgress = document.getElementById('downloadProgress');
  
  // Check current capture status and URL count
  updateCaptureStatus();
  
  function updateCaptureStatus() {
    chrome.storage.local.get(['capturedURLs'], function(result) {
      const count = result.capturedURLs ? result.capturedURLs.length : 0;
      captureStatusSpan.textContent = `Monitoring for media URLs (${count} captured)`;
    });
  }
  
  // Add click event listener for Show URLs button
  showUrlsBtn.addEventListener('click', function() {
    // Send message to the background script
    chrome.runtime.sendMessage({action: "getURLs"}, function(response) {
      if (response) {
        statusDiv.textContent = `${response.status} (${response.count} URLs)`;
        updateCaptureStatus();
      } else {
        statusDiv.textContent = "Error: Could not communicate with extension background process";
      }
    });
  });
  
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
          downloadCountSpan.textContent = i + 1;
          downloadProgress.value = i + 1;
          
          // Download file
          await downloadFile(urls[i], `UnknownBook - Part ${i + 1}.mp3`);
          
          // Update status
          statusDiv.textContent = `Downloaded ${i + 1}/${urls.length} files`;
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
  
  // Function to download a file
  async function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          action: "downloadURL", 
          url: url, 
          filename: filename 
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
});