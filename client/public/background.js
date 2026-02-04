// background.js - Service Worker
// Handles downloads, context menus, and message passing

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("TurboDownloader Installed");
  
  // Create Context Menu
  chrome.contextMenus.create({
    id: "download-with-turbo",
    title: "Download with TurboDownloader",
    contexts: ["link", "image", "video", "audio"]
  });

  // Initialize Storage
  chrome.storage.local.set({
    queue: [],
    settings: {
      maxConcurrent: 3,
      theme: 'dark'
    }
  });
});

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "download-with-turbo") {
    const url = info.linkUrl || info.srcUrl;
    if (url) {
      startDownload(url);
    }
  }
});

// Download Logic
function startDownload(url) {
  // Check if it's already in our queue (simulated)
  chrome.storage.local.get(['queue'], (result) => {
    const queue = result.queue || [];
    
    // In a real scenario, we might intercept the download via chrome.downloads.download
    // For this extension, we simply trigger the browser download but track it
    
    chrome.downloads.download({
      url: url,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download failed:", chrome.runtime.lastError);
        return;
      }

      // Add to our internal tracking
      const newItem = {
        id: downloadId,
        url: url,
        filename: 'Pending...', // Will update on change
        state: 'in_progress',
        startTime: new Date().toISOString()
      };
      
      queue.push(newItem);
      chrome.storage.local.set({ queue: queue });
    });
  });
}

// Monitor Download Changes
chrome.downloads.onChanged.addListener((delta) => {
  chrome.storage.local.get(['queue'], (result) => {
    let queue = result.queue || [];
    const index = queue.findIndex(item => item.id === delta.id);
    
    if (index !== -1) {
      // Update our internal state based on browser events
      if (delta.state) {
        queue[index].state = delta.state.current;
      }
      if (delta.filename) {
        queue[index].filename = delta.filename.current;
      }
      
      chrome.storage.local.set({ queue: queue });
      
      // Notify Popup if open
      chrome.runtime.sendMessage({ type: 'DOWNLOAD_UPDATED', data: queue[index] });
    }
  });
});

// Message Listener from Popup/Content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ADD_DOWNLOAD') {
    startDownload(message.url);
    sendResponse({ success: true });
  }
  return true;
});
