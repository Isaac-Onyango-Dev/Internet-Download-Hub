// content.js - Content Script
// Detects media and adds download buttons

console.log("TurboDownloader Content Script Active");

function scanForMedia() {
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  
  videos.forEach(video => {
    if (!video.dataset.turboProcessed) {
      attachDownloadButton(video);
      video.dataset.turboProcessed = "true";
    }
  });
}

function attachDownloadButton(element) {
  // Create wrapper to position button
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  
  // This is a simplified approach. In a complex site like YouTube, 
  // we'd need more specific selectors and overlay logic.
  
  // We won't disrupt the DOM structure aggressively to avoid breaking sites.
  // Instead, we'll try to find the video source and log it for now, 
  // or add a floating button if it's a direct file.
  
  if (element.src) {
    const btn = document.createElement('button');
    btn.innerText = "⬇";
    btn.title = "Download with Turbo";
    btn.style.position = 'absolute';
    btn.style.top = '10px';
    btn.style.left = '10px';
    btn.style.zIndex = '9999';
    btn.style.backgroundColor = '#2563eb';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '50%';
    btn.style.width = '30px';
    btn.style.height = '30px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'ADD_DOWNLOAD', url: element.src });
    };

    // Only append if parent is suitable
    if (element.parentElement) {
       // Ideally we check if parent is relative, otherwise the absolute pos is wrong
       // For this demo, we just try to insert it near the video
       element.parentElement.appendChild(btn);
    }
  }
}

// Run scanner periodically (MutationObserver would be better for prod)
setInterval(scanForMedia, 2000);
scanForMedia();
