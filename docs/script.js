const REPO = 'Isaac-Onyango-Dev/Internet-Download-Hub'
const PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub'
const SHARE_TEXT = 'I found this free video downloader that works with YouTube, TikTok, Instagram and 1000+ sites — Internet Download Hub'

// Fetch release info from GitHub API
async function loadReleaseInfo() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) return
    const data = await res.json()

    // Update version text
    const versionEl = document.getElementById('version-text')
    if (versionEl && data.tag_name) {
      versionEl.textContent = `Version ${data.tag_name}` 
    }

    // Find the .exe asset and update download button
    const exeAsset = data.assets?.find(a => a.name.endsWith('.exe'))
    if (exeAsset) {
      const btn = document.getElementById('download-btn')
      if (btn) btn.href = exeAsset.browser_download_url
    }

    // Calculate total downloads across all releases
    const allRes = await fetch(`https://api.github.com/repos/${REPO}/releases`)
    if (!allRes.ok) return
    const allReleases = await allRes.json()
    let totalDownloads = 0
    allReleases.forEach(release => {
      release.assets?.forEach(asset => {
        totalDownloads += asset.download_count || 0
      })
    })

    const dlEl = document.getElementById('total-downloads')
    if (dlEl) {
      dlEl.textContent = totalDownloads > 0
        ? totalDownloads.toLocaleString()
        : '—'
    }

  } catch (err) {
    console.log('Could not load release info:', err.message)
  }
}

// Set up share buttons
function setupShareButtons() {
  const encoded = encodeURIComponent(PAGE_URL)
  const encodedText = encodeURIComponent(SHARE_TEXT)

  const twitter = document.getElementById('share-twitter')
  if (twitter) {
    twitter.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}` 
  }

  const reddit = document.getElementById('share-reddit')
  if (reddit) {
    reddit.href = `https://reddit.com/submit?url=${encoded}&title=${encodedText}` 
  }

  const whatsapp = document.getElementById('share-whatsapp')
  if (whatsapp) {
    whatsapp.href = `https://wa.me/?text=${encodedText}%20${encoded}` 
  }
}

// Copy link to clipboard
function copyLink() {
  navigator.clipboard.writeText(PAGE_URL).then(() => {
    const label = document.getElementById('copy-label')
    if (label) {
      label.textContent = 'Copied!'
      setTimeout(() => { label.textContent = 'Copy Link' }, 2500)
    }
  }).catch(() => {
    prompt('Copy this link:', PAGE_URL)
  })
}

// Donate modal
function showDonateModal() {
  document.getElementById('donate-modal').classList.add('active')
}

function closeDonateModal(event) {
  if (!event || event.target.id === 'donate-modal') {
    document.getElementById('donate-modal').classList.remove('active')
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDonateModal()
})

// Initialise
loadReleaseInfo()
setupShareButtons()
