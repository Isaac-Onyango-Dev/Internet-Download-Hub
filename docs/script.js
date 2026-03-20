const REPO = 'Isaac-Onyango-Dev/Internet-Download-Hub'
const PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub'
const SHARE_TEXT = 'Check out Internet Download Hub — a free desktop app that downloads videos from YouTube, TikTok, Instagram and 1000+ sites. Completely free and open source.'

async function loadReleaseInfo() {
  try {
    console.log('[IDH] Fetching latest release from GitHub API...')

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )

    console.log('[IDH] API response status:', res.status)

    // Handle rate limit
    if (res.status === 403 || res.status === 429) {
      const resetTime = res.headers.get('X-RateLimit-Reset')
      console.warn('[IDH] GitHub API rate limited. Reset at:', resetTime)
      setCounterFallback()
      return
    }

    // Handle no releases yet
    if (res.status === 404) {
      console.log('[IDH] No releases found')
      updateVersionText('Latest version')
      return
    }

    if (!res.ok) {
      console.warn('[IDH] API error:', res.status, res.statusText)
      setCounterFallback()
      return
    }

    const data = await res.json()
    console.log('[IDH] Latest release:', data.tag_name)
    console.log('[IDH] Assets found:', data.assets?.length || 0)
    console.log('[IDH] Asset names:', data.assets?.map(a => a.name))

    // Update version text
    updateVersionText(`Version ${data.tag_name}`)

    // Find the .exe installer — exclude .blockmap files
    const exeAsset = data.assets?.find(a =>
      a.name.toLowerCase().endsWith('.exe') &&
      !a.name.includes('blockmap') &&
      !a.name.includes('uninstaller')
    )

    console.log('[IDH] Found .exe asset:', exeAsset?.name || 'NOT FOUND')
    console.log('[IDH] .exe download count:', exeAsset?.download_count ?? 'N/A')

    if (exeAsset) {
      // Update download button to point directly to .exe file
      const btn = document.getElementById('download-btn')
      if (btn) {
        btn.href = exeAsset.browser_download_url
        console.log('[IDH] Download button URL set to:', exeAsset.browser_download_url)
      }

      // Update file size
      const sizeEl = document.getElementById('file-size')
      if (sizeEl && exeAsset.size) {
        const mb = (exeAsset.size / (1024 * 1024)).toFixed(0)
        sizeEl.textContent = `~${mb} MB` 
      }
    }

    // Fetch ALL releases to calculate total downloads
    console.log('[IDH] Fetching all releases for total count...')
    const allRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=100`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )

    if (allRes.ok) {
      const allReleases = await allRes.json()
      console.log('[IDH] Total releases:', allReleases.length)

      let total = 0
      allReleases.forEach(release => {
        console.log('[IDH] Release:', release.tag_name, 'assets:', release.assets?.length)
        release.assets?.forEach(asset => {
          console.log('[IDH]   Asset:', asset.name, 'downloads:', asset.download_count)
          // Count only .exe installer downloads
          if (
            asset.name.toLowerCase().endsWith('.exe') &&
            !asset.name.includes('blockmap') &&
            !asset.name.includes('uninstaller')
          ) {
            total += asset.download_count || 0
          }
        })
      })

      console.log('[IDH] Total downloads calculated:', total)
      updateDownloadCounter(total)
    } else {
      console.warn('[IDH] Could not fetch all releases:', allRes.status)
      // Fall back to just the latest release count
      const fallbackCount = exeAsset?.download_count || 0
      updateDownloadCounter(fallbackCount)
    }

  } catch (err) {
    console.error('[IDH] Failed to load release info:', err.message)
    setCounterFallback()
  }
}

function updateVersionText(text) {
  const el = document.getElementById('version-text')
  if (el) el.textContent = text
}

function updateDownloadCounter(count) {
  const el = document.getElementById('total-downloads')
  if (el) {
    el.textContent = count > 0 ? count.toLocaleString() : '0'
    console.log('[IDH] Counter updated to:', count)
  }
}

function setCounterFallback() {
  // Show a dash when API is unavailable rather than 0
  const el = document.getElementById('total-downloads')
  if (el && el.textContent === '—') return  // already set
  if (el) el.textContent = '—'
}

function setupShareButtons() {
  const encoded = encodeURIComponent(PAGE_URL)
  const encodedText = encodeURIComponent(SHARE_TEXT)

  const twitter = document.getElementById('share-twitter')
  if (twitter) twitter.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}` 

  const reddit = document.getElementById('share-reddit')
  if (reddit) reddit.href = `https://reddit.com/submit?url=${encoded}&title=${encodeURIComponent('Internet Download Hub — Free Video Downloader')}` 

  const whatsapp = document.getElementById('share-whatsapp')
  if (whatsapp) whatsapp.href = `https://wa.me/?text=${encodedText}%20${encoded}` 
}

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

function showDonateModal() {
  const modal = document.getElementById('donate-modal')
  if (modal) modal.classList.add('active')
}

function closeDonateModal(event) {
  if (!event || event.target.id === 'donate-modal') {
    const modal = document.getElementById('donate-modal')
    if (modal) modal.classList.remove('active')
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDonateModal()
})

// Run on page load
loadReleaseInfo()
setupShareButtons()
