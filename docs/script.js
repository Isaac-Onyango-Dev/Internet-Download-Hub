const REPO = 'Isaac-Onyango-Dev/Internet-Download-Hub'
const PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub'
const SHARE_TEXT = 'Check out Internet Download Hub — a free desktop app that downloads videos from YouTube, TikTok, Instagram and 1000+ sites. Completely free and open source.'

// Screenshot carousel functionality
let currentScreenshot = 0
const totalScreenshots = 3

function changeScreenshot(direction) {
  currentScreenshot = (currentScreenshot + direction + totalScreenshots) % totalScreenshots
  updateScreenshotDisplay()
}

function goToScreenshot(index) {
  currentScreenshot = index
  updateScreenshotDisplay()
}

function updateScreenshotDisplay() {
  const slides = document.querySelectorAll('.screenshot-slide')
  const indicators = document.querySelectorAll('.indicator')
  const prevBtn = document.querySelector('.screenshot-nav.prev')
  const nextBtn = document.querySelector('.screenshot-nav.next')
  
  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === currentScreenshot)
  })
  
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('active', index === currentScreenshot)
  })
  
  if (prevBtn) prevBtn.disabled = currentScreenshot === 0
  if (nextBtn) nextBtn.disabled = currentScreenshot === totalScreenshots - 1
}

// Smooth scroll to section without triggering browser favicon reload
function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId)
  if (!element) return

  // Use scrollIntoView for smooth scrolling without changing the URL hash
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })

  // Offset for fixed navbar height
  // scrollIntoView does not account for fixed headers so we adjust manually
  setTimeout(() => {
    const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 64
    const currentScroll = window.scrollY
    window.scrollTo({
      top: currentScroll - navbarHeight,
      behavior: 'smooth'
    })
  }, 50)
}

// Prevent favicon from disappearing during navigation
function protectFavicon() {
  const faviconUrls = {
    ico: 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/favicon.ico',
    png32: 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/favicon-32x32.png',
    png16: 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/favicon-16x16.png'
  }

  function ensureFavicon() {
    // Check if favicon link tags still exist and point to correct files
    let icoLink = document.querySelector('link[rel="icon"][type="image/x-icon"]')
    let png32Link = document.querySelector('link[rel="icon"][sizes="32x32"]')
    let png16Link = document.querySelector('link[rel="icon"][sizes="16x16"]')

    // Recreate missing favicon links
    if (!icoLink) {
      icoLink = document.createElement('link')
      icoLink.rel = 'icon'
      icoLink.type = 'image/x-icon'
      icoLink.href = faviconUrls.ico
      document.head.appendChild(icoLink)
    }

    if (!png32Link) {
      png32Link = document.createElement('link')
      png32Link.rel = 'icon'
      png32Link.type = 'image/png'
      png32Link.setAttribute('sizes', '32x32')
      png32Link.href = faviconUrls.png32
      document.head.appendChild(png32Link)
    }

    if (!png16Link) {
      png16Link = document.createElement('link')
      png16Link.rel = 'icon'
      png16Link.type = 'image/png'
      png16Link.setAttribute('sizes', '16x16')
      png16Link.href = faviconUrls.png16
      document.head.appendChild(png16Link)
    }

    // Force browsers to refresh favicon by appending a cache buster
    // then removing it — this is the most reliable cross-browser trick
    const timestamp = Date.now()
    icoLink.href = `${faviconUrls.ico}?v=${timestamp}` 
    png32Link.href = `${faviconUrls.png32}?v=${timestamp}` 
    png16Link.href = `${faviconUrls.png16}?v=${timestamp}` 
  }

  // Run once immediately on page load
  ensureFavicon()

  // Watch for any DOM changes to the head element
  // and restore favicon if it gets removed
  const observer = new MutationObserver((mutations) => {
    const faviconRemoved = mutations.some(mutation =>
      Array.from(mutation.removedNodes).some(node =>
        node.nodeName === 'LINK' &&
        node.rel?.includes('icon')
      )
    )
    if (faviconRemoved) {
      ensureFavicon()
    }
  })

  observer.observe(document.head, {
    childList: true,
    subtree: false
  })
}

const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'X-GitHub-Api-Version': '2022-11-28',
  // Anonymous quota is low (60/hr/IP); a UA may reduce erroneous blocks.
  'User-Agent': 'Internet-Download-Hub-docs-page'
}

/** All published releases, paginated (GitHub caps per_page at 100). */
async function fetchAllReleases() {
  const all = []
  let page = 1
  const maxPages = 30
  while (page <= maxPages) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,
      { headers: GITHUB_API_HEADERS }
    )
    if (!res.ok) return { ok: false, status: res.status, releases: all }
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page += 1
  }
  return { ok: true, releases: all }
}

/** Matches Shields.io github/downloads/.../total: sum of every asset download_count on all releases. */
function sumAllAssetDownloads(releases) {
  return releases.reduce((sum, r) => {
    const assets = r.assets || []
    return sum + assets.reduce((s, a) => s + (a.download_count || 0), 0)
  }, 0)
}

/** Installer-only total (NSIS setup .exe, excludes blockmap / uninstaller stubs). */
function sumInstallerDownloads(releases) {
  let total = 0
  for (const r of releases) {
    for (const asset of r.assets || []) {
      const n = (asset.name || '').toLowerCase()
      if (n.endsWith('.exe') && !n.includes('blockmap') && !n.includes('uninstaller')) {
        total += asset.download_count || 0
      }
    }
  }
  return total
}

async function loadReleaseInfo() {
  try {
    console.log('[IDH] Fetching latest release from GitHub API...')

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: GITHUB_API_HEADERS
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
      updateDownloadCounter(0)
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

    // Paginated fetch so totals stay correct past 100 releases; align with Shields /total when possible.
    console.log('[IDH] Fetching all releases for total count...')
    const { ok, status, releases: allReleases } = await fetchAllReleases()

    if (ok && allReleases.length >= 0) {
      console.log('[IDH] Total releases:', allReleases.length)
      const shieldStyleTotal = sumAllAssetDownloads(allReleases)
      const installerTotal = sumInstallerDownloads(allReleases)
      console.log('[IDH] Sum all assets (Shields-style):', shieldStyleTotal, 'installer .exe only:', installerTotal)
      // Prefer installer-only for the landing page; falls back to all-assets if no exe rows (older releases)
      const displayTotal = installerTotal > 0 ? installerTotal : shieldStyleTotal
      updateDownloadCounter(displayTotal)
    } else {
      console.warn('[IDH] Could not fetch all releases:', status)
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
    el.textContent =
      count > 0
        ? `${count.toLocaleString()}+`
        : 'Be the first!'
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

function bootDocsPage() {
  setupShareButtons()
  protectFavicon()
  loadReleaseInfo()
}

// Run once: duplicate listeners were firing loadReleaseInfo() twice and burning anonymous GitHub API quota.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootDocsPage)
} else {
  bootDocsPage()
}
