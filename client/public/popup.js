// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('downloadList');

  // Load initial state
  refreshList();

  // Add Download Button
  addBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      chrome.runtime.sendMessage({ type: 'ADD_DOWNLOAD', url: url }, () => {
        urlInput.value = '';
        setTimeout(refreshList, 500); // Wait for bg to process
      });
    }
  });

  // Listen for updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DOWNLOAD_UPDATED') {
      refreshList();
    }
  });

  function refreshList() {
    chrome.storage.local.get(['queue'], (result) => {
      const queue = result.queue || [];
      renderList(queue);
    });
  }

  function renderList(queue) {
    list.innerHTML = '';
    
    if (queue.length === 0) {
      list.innerHTML = '<div class="empty-state">No active downloads</div>';
      return;
    }

    queue.forEach(item => {
      // Simulate progress if it's "in_progress" (since we don't have real bytes in this basic demo)
      const progress = item.state === 'complete' ? 100 : (item.state === 'in_progress' ? 45 : 0);
      
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div class="filename" title="${item.url}">${item.filename || item.url}</div>
        <div class="meta">
          <span>${item.state}</span>
          <span>${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      `;
      list.appendChild(el);
    });
  }
});
