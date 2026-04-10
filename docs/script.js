/* ═══════════════════════════════════════════════
   INTERNET DOWNLOAD HUB — DOCS SITE SCRIPT
   ═══════════════════════════════════════════════ */

const REPO = 'Isaac-Onyango-Dev/Internet-Download-Hub';
const PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub';
const SHARE_TEXT = 'Check out Internet Download Hub — a free desktop app that downloads videos from YouTube, TikTok, Instagram and 1000+ sites. Completely free and open source.';

const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Internet-Download-Hub-docs-page'
};

// ── Intersection Observer: Scroll Animations ───
function initScrollAnimations() {
  const els = document.querySelectorAll('.animate-in');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || '0', 10);
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach(el => observer.observe(el));
}

// ── Navbar Scroll Effect ───────────────────────
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ── Mobile Menu ────────────────────────────────
function initMobileMenu() {
  const toggle = document.getElementById('mobile-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    menu.classList.toggle('open');
  });

  // Close on link click
  menu.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      menu.classList.remove('open');
    });
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggle.classList.remove('active');
      menu.classList.remove('open');
    }
  });
}

// ── Screenshot Carousel ────────────────────────
function initCarousel() {
  const track = document.getElementById('carousel-track');
  const dotsContainer = document.getElementById('carousel-dots');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  if (!track) return;

  const slides = track.querySelectorAll('.carousel-slide');
  const totalSlides = slides.length;
  let current = 0;
  let autoPlayTimer;

  // Build dots
  if (dotsContainer) {
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = `carousel-dot${i === 0 ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });
  }

  function goTo(index) {
    current = ((index % totalSlides) + totalSlides) % totalSlides;
    track.style.transform = `translateX(-${current * 100}%)`;

    // Update dots
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
    }

    // Update buttons
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === totalSlides - 1;

    resetAutoPlay();
  }

  function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    autoPlayTimer = setInterval(() => goTo(current + 1), 6000);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

  // Touch/swipe support
  let startX = 0;
  let isDragging = false;

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goTo(current + (diff > 0 ? 1 : -1));
    }
  }, { passive: true });

  goTo(0);
  resetAutoPlay();
}

// ── Counter Animation ──────────────────────────
function animateCounter(el, target, duration = 1500) {
  const start = performance.now();
  const initial = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(initial + (target - initial) * eased);

    el.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target.toLocaleString();
    }
  }

  requestAnimationFrame(tick);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!('IntersectionObserver' in window)) {
    counters.forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      el.textContent = target.toLocaleString();
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.count, 10);
        animateCounter(entry.target, target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

// ── GitHub Release API ─────────────────────────
async function fetchAllReleases() {
  const all = [];
  let page = 1;
  const maxPages = 30;
  while (page <= maxPages) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,
      { headers: GITHUB_API_HEADERS }
    );
    if (!res.ok) return { ok: false, status: res.status, releases: all };
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return { ok: true, releases: all };
}

function sumAllAssetDownloads(releases) {
  return releases.reduce((sum, r) => {
    const assets = r.assets || [];
    return sum + assets.reduce((s, a) => s + (a.download_count || 0), 0);
  }, 0);
}

async function loadReleaseInfo() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: GITHUB_API_HEADERS }
    );

    if (res.status === 403 || res.status === 429) return;
    if (res.status === 404) {
      updateVersionText('Latest version');
      updateDownloadCounter(0);
      return;
    }
    if (!res.ok) return;

    const data = await res.json();

    // Update version text
    updateVersionText(data.tag_name || 'Latest version');

    // Find installer asset
    const exeAsset = data.assets?.find(a =>
      a.name.toLowerCase().endsWith('.exe') &&
      !a.name.includes('blockmap') &&
      !a.name.includes('uninstaller')
    );

    if (exeAsset) {
      // Update all download buttons to point directly to the installer
      const btns = [
        document.getElementById('download-btn'),
        document.getElementById('hero-download-btn')
      ];
      btns.forEach(btn => {
        if (btn) btn.href = exeAsset.browser_download_url;
      });

      // Update file size display
      const sizeEl = document.getElementById('download-size');
      if (sizeEl && exeAsset.size) {
        const mb = (exeAsset.size / (1024 * 1024)).toFixed(0);
        sizeEl.textContent = `~${mb} MB installer`;
      }
    }

    // Total download count
    const { ok, releases: allReleases } = await fetchAllReleases();
    if (ok && allReleases.length > 0) {
      const total = sumAllAssetDownloads(allReleases);
      updateDownloadCounter(total);
    } else if (exeAsset) {
      updateDownloadCounter(exeAsset.download_count || 0);
    }

  } catch {
    // Silently fail — page works without API
  }
}

function updateVersionText(text) {
  const el = document.getElementById('version-text');
  if (el) el.textContent = text;
  const el2 = document.getElementById('download-version');
  if (el2) el2.textContent = `${text} · Windows 10 / 11 (64-bit)`;
}

function updateDownloadCounter(count) {
  const el = document.getElementById('total-downloads');
  if (el) {
    el.textContent = count > 0 ? count.toLocaleString() : '—';
  }
}

// ── Share Buttons ──────────────────────────────
function setupShareButtons() {
  const encoded = encodeURIComponent(PAGE_URL);
  const encodedText = encodeURIComponent(SHARE_TEXT);

  const twitter = document.getElementById('share-twitter');
  if (twitter) twitter.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}`;

  const reddit = document.getElementById('share-reddit');
  if (reddit) reddit.href = `https://reddit.com/submit?url=${encoded}&title=${encodeURIComponent('Internet Download Hub — Free Video Downloader')}`;
}

function copyLink() {
  navigator.clipboard.writeText(PAGE_URL).then(() => {
    const label = document.getElementById('copy-label');
    if (label) {
      const original = label.textContent;
      label.textContent = 'Copied!';
      setTimeout(() => { label.textContent = original; }, 2500);
    }
  }).catch(() => {
    // Fallback for older browsers
    prompt('Copy this link:', PAGE_URL);
  });
}

// ── Refresh download count after user clicks ───
function refreshCountAfterDownload() {
  const btns = [
    document.getElementById('download-btn'),
    document.getElementById('hero-download-btn')
  ];
  btns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        setTimeout(() => loadReleaseInfo(), 3000);
      });
    }
  });
}

// ── FAQ Accordion: close others when one opens ──
function initFaqAccordion() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        document.querySelectorAll('.faq-item').forEach(other => {
          if (other !== item && other.open) other.open = false;
        });
      }
    });
  });
}

// ── Favicon Protection ─────────────────────────
function protectFavicon() {
  const faviconUrls = {
    ico: 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/favicon.ico',
    png32: 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/favicon-32x32.png',
    png16: 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/favicon-16x16.png'
  };

  function ensureFavicon() {
    let icoLink = document.querySelector('link[rel="icon"][type="image/x-icon"]');
    let png32Link = document.querySelector('link[rel="icon"][sizes="32x32"]');
    let png16Link = document.querySelector('link[rel="icon"][sizes="16x16"]');

    if (!icoLink) {
      icoLink = document.createElement('link');
      icoLink.rel = 'icon';
      icoLink.type = 'image/x-icon';
      icoLink.href = faviconUrls.ico;
      document.head.appendChild(icoLink);
    }

    if (!png32Link) {
      png32Link = document.createElement('link');
      png32Link.rel = 'icon';
      png32Link.type = 'image/png';
      png32Link.setAttribute('sizes', '32x32');
      png32Link.href = faviconUrls.png32;
      document.head.appendChild(png32Link);
    }

    if (!png16Link) {
      png16Link = document.createElement('link');
      png16Link.rel = 'icon';
      png16Link.type = 'image/png';
      png16Link.setAttribute('sizes', '16x16');
      png16Link.href = faviconUrls.png16;
      document.head.appendChild(png16Link);
    }

    const timestamp = Date.now();
    icoLink.href = `${faviconUrls.ico}?v=${timestamp}`;
    png32Link.href = `${faviconUrls.png32}?v=${timestamp}`;
    png16Link.href = `${faviconUrls.png16}?v=${timestamp}`;
  }

  ensureFavicon();

  const observer = new MutationObserver((mutations) => {
    const faviconRemoved = mutations.some(mutation =>
      Array.from(mutation.removedNodes).some(node =>
        node.nodeName === 'LINK' && node.rel?.includes('icon')
      )
    );
    if (faviconRemoved) ensureFavicon();
  });

  observer.observe(document.head, { childList: true, subtree: false });
}

// ── Boot ───────────────────────────────────────
function boot() {
  initScrollAnimations();
  initNavbarScroll();
  initMobileMenu();
  initCarousel();
  initCounters();
  initFaqAccordion();
  setupShareButtons();
  protectFavicon();
  loadReleaseInfo();
  refreshCountAfterDownload();

  // Set footer year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
