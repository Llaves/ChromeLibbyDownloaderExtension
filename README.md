# Libby Audiobook Downloader

## How to install

To install in Chrome, download a .zip file of the archive by clicking on the green "Code" button on the right above the listing of files. Then open the debugger interface by typing "chrome://extensions". In the upper right corner enable "Developer Mode". Then click "Load unpacked". 
Navigate to the unpacked zip file you just downloaded and click on manifest.json. You may be tempted to "pack" the extension into a .crx file so that you don't have to use developer mode. 
This won't work. Chrome will only install signed .crx files from the Chrome store. 

You may want to pin the extension to the toolbar. To do this, click on the puzzle piece in the upper right of your Chrome browser, the click on the pin next to the name of the extension.

## How to download an audiobook

In order to use this extension you must have valid access to your library and you must have checked out the book you wish to download.
Log in to your library Overdrive account. Click on Loans. Click on the title you wish to download. This will open the book in a new tab. Open that tab if it's 
not already open. 

Now click on the icon for the extension (the blue letter "L" with a down arrow). This will open a popup with controls for the download. Fill in the title and author 
(the title should automatically fill from the player). Click "Capture Audio" - the book should start playing and after a few seconds will skip a chapter at a time 
until it reaches the end. The play button will now say "The End" instead of showing the usual play arrow. Now click the "Download with ID3 Tags" button. 
After a few seconds a File Save window will pop up, just like for any download from a web page. Click OK to download your file. Needless to say, 
keep track of where you save the files. A new window will pop up for each .mp3 file. The browser may ask for permission to download multiple 
files from the webpage - just say yes. 

## Limitations

The extension depends on the current protocol used by the Libby player. If that protocol changes, the program will break. The extension is fragile in
the face of poor internet connections. If you experience excessively long latencies or slow download speeds the extension will fail to download the book. 

This extension was developed and tested on the Google Chrome browser. It may
work on other chrome-based browsers, but I have not checked.

## Don't abuse this!

The extension was written to allow users with legitimate access to Libby audiobooks to download their checked out content to devices not supported with Libby apps.
Please do not use this extension to defeat the return period on your loans, and absolutely do not redistribute the .mp3 files to others. 
