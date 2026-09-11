/* ══════════════════════════════════════════════════════════════
   INTERNET DOWNLOAD HUB — site behaviour
   Static, no build step, no dependencies.
   ══════════════════════════════════════════════════════════════ */

/* Scroll reveals start hidden only once this file is running. If it fails to
   load or throws before boot, every section stays visible instead of fading
   to nothing. */
document.documentElement.classList.add('js-motion');

const REPO = 'Isaac-Onyango-Dev/Internet-Download-Hub';
const REPO_URL = `https://github.com/${REPO}`;
const PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/';
const WEB_APP_URL = 'https://internet-download-hub.onrender.com/';
const SHARE_TEXT =
  'Internet Download Hub — a free, open source Windows app that grabs video from YouTube, TikTok, Instagram and 1000+ other sites. No ads, no account.';

/* GitHub's unauthenticated limit is 60 requests per hour per IP, so the
   whole payload is cached and reused rather than refetched per visit. */
const CACHE_KEY = 'idh.releases.v2';
const CACHE_TTL = 8 * 60 * 1000; // 8 minutes
const MAX_PAGES = 5;
const NEWS_COUNT = 5;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

/* ── storage helpers (private mode can throw on both read and write) ── */
function cacheRead() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.releases)) return null;
    return { releases: parsed.releases, fresh: Date.now() - parsed.t < CACHE_TTL };
  } catch {
    return null;
  }
}

function cacheWrite(releases) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), releases }));
  } catch {
    /* quota or private mode — the page works fine without it */
  }
}

/* ── scroll reveals ─────────────────────────────────────────── */
function initReveals() {
  const nodes = document.querySelectorAll('.reveal');
  if (REDUCED || !('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('seen'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const wait = Number(e.target.dataset.delay || 0);
        setTimeout(() => e.target.classList.add('seen'), wait);
        io.unobserve(e.target);
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -50px 0px' },
  );
  nodes.forEach((n) => io.observe(n));
}

/* ── blob parallax + sticky nav, one rAF loop ───────────────── */
function initScrollFx() {
  const topbar = $('topbar');
  const blobs = REDUCED ? [] : [...document.querySelectorAll('.blob')];
  let pending = false;

  const paint = () => {
    const y = window.scrollY;
    if (topbar) topbar.dataset.stuck = y > 14 ? '1' : '0';
    for (const b of blobs) {
      b.style.setProperty('--py', `${(y * Number(b.dataset.drift || 0.15) * -1).toFixed(1)}px`);
    }
    pending = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(paint);
    },
    { passive: true },
  );
  paint();
}

/* ── mobile sheet ───────────────────────────────────────────── */
function initSheet() {
  const burger = $('burger');
  const sheet = $('sheet');
  if (!burger || !sheet) return;

  const setOpen = (open) => {
    sheet.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () => setOpen(sheet.hidden));
  sheet.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) {
      setOpen(false);
      burger.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && !sheet.hidden) setOpen(false);
  });
}

/* ── platform detection & picker ────────────────────────────── */
function detectPlatform() {
  const ua = navigator.userAgent || '';
  const uaPlat = navigator.userAgentData?.platform || navigator.platform || '';
  const hay = `${ua} ${uaPlat}`;

  if (/Android/i.test(hay)) return 'android';
  if (/iPhone|iPad|iPod/i.test(hay) || (/Mac/i.test(hay) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Win/i.test(hay)) return 'windows';
  if (/Mac/i.test(hay)) return 'mac';
  if (/Linux|X11|CrOS/i.test(hay)) return 'linux';
  return 'unknown';
}

function initPlatform() {
  const toggle = $('platform-toggle');
  const picker = $('platform-picker');
  const label = $('cta-label');
  const meta = $('cta-meta');
  const primary = $('cta-primary');

  if (toggle && picker) {
    toggle.addEventListener('click', () => {
      const open = picker.hidden;
      picker.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Hide platforms' : 'Other platforms';
    });
  }

  const os = detectPlatform();
  const expand = () => {
    if (picker && toggle && picker.hidden) toggle.click();
  };

  if (os === 'windows') return; // the happy path, copy already says Windows

  if (os === 'android' || os === 'ios') {
    // No mobile build exists, so send them somewhere that actually works.
    if (primary) {
      primary.href = WEB_APP_URL;
      primary.dataset.webapp = '1';
    }
    if (label) label.textContent = 'Open the web app';
    if (meta) meta.textContent = 'The desktop app is Windows-only';
    return;
  }

  if (label) label.textContent = 'Get the Windows build';
  if (meta) {
    meta.textContent =
      os === 'mac'
        ? 'No macOS build yet — it is on the roadmap'
        : 'No native Linux build — self-host the web version instead';
  }
  expand();
}

/* ── GitHub releases ────────────────────────────────────────── */
async function fetchReleases() {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(
      ...batch.map((r) => ({
        tag_name: r.tag_name,
        name: r.name,
        body: r.body,
        draft: r.draft,
        prerelease: r.prerelease,
        published_at: r.published_at,
        html_url: r.html_url,
        assets: (r.assets || []).map((a) => ({
          name: a.name,
          size: a.size,
          download_count: a.download_count,
          browser_download_url: a.browser_download_url,
        })),
      })),
    );
    if (batch.length < 100) break;
  }
  return out;
}

const totalDownloads = (releases) =>
  releases.reduce(
    (sum, r) => sum + (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0),
    0,
  );

const publicReleases = (releases) => releases.filter((r) => !r.draft && !r.prerelease);

function installerAsset(release) {
  return (release.assets || []).find(
    (a) =>
      /\.exe$/i.test(a.name) &&
      !/blockmap/i.test(a.name) &&
      !/uninstall/i.test(a.name),
  );
}

/* ── counter ────────────────────────────────────────────────── */
function countUp(el, target) {
  if (REDUCED) {
    el.textContent = target.toLocaleString();
    return;
  }
  const ms = 1400;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / ms, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString();
  };
  requestAnimationFrame(step);
}

function showCounter(total) {
  const wrap = $('counter');
  const num = $('counter-num');
  if (!wrap || !num) return;

  // Never render 0 or NaN — fall back to the static shields.io badge.
  if (!Number.isFinite(total) || total <= 0) {
    showCounterBadge();
    return;
  }

  wrap.dataset.state = 'ready';
  if (!('IntersectionObserver' in window)) {
    countUp(num, total);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        countUp(num, total);
        io.disconnect();
      });
    },
    { threshold: 0.4 },
  );
  io.observe(wrap);
}

function showCounterBadge() {
  const wrap = $('counter');
  const badge = $('counter-badge');
  if (!wrap || !badge) return;
  wrap.dataset.state = 'badge';
  badge.hidden = false;
}

/* ── release notes: a small, escape-first markdown subset ───── */
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const safeHref = (url) => (/^https?:\/\//i.test(url) ? url : null);

function inline(text) {
  const code = [];
  // Park code spans so their contents are never treated as markup.
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeHref(url);
    return href ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : m;
  });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, lead, url) => {
    const trimmed = url.replace(/[.,;:]+$/, '');
    return `${lead}<a href="${trimmed}" target="_blank" rel="noopener">${trimmed}</a>`;
  });
  s = s.replace(/(^|\s)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\b/g,
    (_, lead, user) => `${lead}<a href="https://github.com/${user}" target="_blank" rel="noopener">@${user}</a>`);
  s = s.replace(/(^|\s)#(\d+)\b/g,
    (_, lead, num) => `${lead}<a href="${REPO_URL}/issues/${num}" target="_blank" rel="noopener">#${num}</a>`);

  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[Number(i)]}</code>`);
}

function renderNotes(markdown) {
  const src = esc(markdown || '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const html = [];
  let list = null;      // 'ul' | 'ol' | null
  let fence = null;     // buffered code-block lines
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*```/.test(line)) {
      if (fence === null) {
        flushAll();
        fence = [];
      } else {
        html.push(`<pre><code>${fence.join('\n')}</code></pre>`);
        fence = null;
      }
      continue;
    }
    if (fence !== null) { fence.push(raw); continue; }

    if (!line.trim()) { flushAll(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 4); // never emit an h1
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[-\s*_]*$/.test(line)) {
      flushAll();
      html.push('<hr />');
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (list !== 'ul') { flushList(); html.push('<ul>'); list = 'ul'; }
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      if (list !== 'ol') { flushList(); html.push('<ol>'); list = 'ol'; }
      html.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  if (fence !== null) html.push(`<pre><code>${fence.join('\n')}</code></pre>`);
  flushAll();
  return html.join('\n');
}

const prettyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

function renderNews(releases) {
  const feed = $('news-feed');
  if (!feed) return;
  feed.setAttribute('aria-busy', 'false');

  const list = publicReleases(releases).slice(0, NEWS_COUNT);
  if (!list.length) {
    feed.innerHTML =
      '<div class="news-empty">Couldn\'t reach the GitHub API just now. ' +
      '<a href="' + REPO_URL + '/releases" target="_blank" rel="noopener">Read the release notes on GitHub</a>.</div>';
    return;
  }

  /* The newest release renders open and in full. Older ones sit behind a
     disclosure the reader controls. Nothing anywhere is clipped, line-clamped
     or capped in height — that failure mode is the whole reason for this
     section's markup. */
  feed.innerHTML = list.map((r, i) => releaseCard(r, i === 0)).join('');
}

function releaseCard(r, latest) {
  const tag = esc(r.tag_name || r.name || 'Release');
  const url = safeHref(r.html_url) || `${REPO_URL}/releases`;
  // GitHub usually sets name to the tag minus its leading "v". That isn't a
  // title, so only show it when it actually says something different.
  const bare = (v) => String(v || '').replace(/^v/i, '').trim();
  const named =
    r.name && bare(r.name) !== bare(r.tag_name)
      ? `<span class="release-name">${esc(r.name)}</span>`
      : '';
  const body =
    renderNotes(r.body) ||
    `<p class="release-none">No notes were published against this tag.
       <a href="${url}" target="_blank" rel="noopener">See the commits on GitHub</a>.</p>`;

  const head =
    `<a class="release-tag" href="${url}" target="_blank" rel="noopener">${tag}</a>
     ${latest ? '<span class="release-new">Latest</span>' : ''}
     <span class="release-date">${prettyDate(r.published_at)}</span>${named}`;

  if (latest) {
    return `<article class="release release--latest">
      <div class="release-head">${head}</div>
      <div class="release-body">${body}</div>
    </article>`;
  }

  return `<details class="release release--older">
    <summary class="release-head">${head}<i aria-hidden="true"></i></summary>
    <div class="release-body">${body}</div>
  </details>`;
}

function applyRelease(releases) {
  const live = publicReleases(releases);
  const latest = live[0] || releases[0];
  if (!latest) return;

  const tag = latest.tag_name || latest.name || '';
  const pill = $('pill-version');
  if (pill) pill.textContent = `${tag} is out — see what changed`;
  const footVer = $('foot-version');
  if (footVer) footVer.textContent = tag || '—';
  const getMeta = $('get-meta');
  if (getMeta && tag) getMeta.textContent = `${tag} · Windows 10 / 11 · 64-bit · MIT licensed`;

  const exe = installerAsset(latest);
  if (!exe) return;

  for (const id of ['cta-primary', 'cta-secondary']) {
    const btn = $(id);
    // Don't hijack the button if platform detection pointed it at the web app.
    if (btn && !btn.dataset.webapp) btn.href = exe.browser_download_url;
  }

  const size = $('get-size');
  if (size && exe.size) {
    size.textContent = `${Math.round(exe.size / 1048576)} MB installer · every engine included`;
  }
}

async function loadGitHub() {
  const cached = cacheRead();

  if (cached?.fresh) {
    applyRelease(cached.releases);
    renderNews(cached.releases);
    showCounter(totalDownloads(cached.releases));
    return;
  }

  try {
    const releases = await fetchReleases();
    if (!releases.length) throw new Error('no releases');
    cacheWrite(releases);
    applyRelease(releases);
    renderNews(releases);
    showCounter(totalDownloads(releases));
  } catch {
    // Rate-limited, offline, or the API is having a day. Use whatever we have.
    if (cached) {
      applyRelease(cached.releases);
      renderNews(cached.releases);
      showCounter(totalDownloads(cached.releases));
    } else {
      showCounterBadge();
      renderNews([]);
      const pill = $('pill-version');
      if (pill) pill.textContent = 'See the latest release';
    }
  }
}

/* ── sharing ────────────────────────────────────────────────── */
function initShare() {
  const url = encodeURIComponent(PAGE_URL);
  const x = $('share-x');
  if (x) x.href = `https://x.com/intent/post?text=${encodeURIComponent(SHARE_TEXT)}&url=${url}`;

  const reddit = $('share-reddit');
  if (reddit) {
    reddit.href = `https://www.reddit.com/submit?url=${url}&title=${encodeURIComponent(
      'Internet Download Hub — free, open source video downloader for Windows',
    )}`;
  }

  const btn = $('copy-btn');
  const label = $('copy-label');
  if (!btn || !label) return;

  btn.addEventListener('click', async () => {
    const done = (text) => {
      label.textContent = text;
      setTimeout(() => { label.textContent = 'Copy link'; }, 2200);
    };
    try {
      await navigator.clipboard.writeText(PAGE_URL);
      done('Copied');
    } catch {
      window.prompt('Copy this link:', PAGE_URL);
      done('Copy link');
    }
  });
}

/* ── screenshot carousel ────────────────────────────────────────
   The strip drifts right-to-left on its own and loops seamlessly. The slides
   are duplicated once, so when the scroll position passes the width of one
   full set it is rewound by exactly that width: the pixels under the viewport
   are identical either side of the rewind, so there is nothing to see.

   One rAF loop owns the scroll position. Arrow presses become an eased tween
   inside that same loop rather than a competing scrollTo, which is what keeps
   a manual press from fighting the drift or snapping. Native swipe and
   trackpad scrolling still work and are detected, not blocked.        */
function initShots() {
  const strip = $('shot-strip');
  const prev = $('shot-prev');
  const next = $('shot-next');
  if (!strip) return;

  const originals = [...strip.querySelectorAll('.shot')];
  if (originals.length < 2) return;

  // A second set to loop through. Hidden from assistive tech so the list is
  // not read out twice.
  for (const node of originals) {
    const copy = node.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.classList.add('shot--clone');
    strip.appendChild(copy);
  }

  const DRIFT = 50; // px per second — slow enough to read a slide as it passes
  const TWEEN_MS = 620;

  let period = 0; // width of one full set, including the gap that follows it
  let step = 0; // one slide plus its gap
  let pos = 0;
  let lastWritten = -1;
  let paused = false;
  let tween = null;
  let last = 0;

  const measure = () => {
    const slides = strip.querySelectorAll('.shot');
    const firstClone = strip.querySelector('.shot--clone');
    if (!firstClone || slides.length < 2) return;
    period = firstClone.offsetLeft - slides[0].offsetLeft;
    step = slides[1].offsetLeft - slides[0].offsetLeft;
  };

  const norm = (p) => (period > 0 ? ((p % period) + period) % period : p);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const nudge = (direction) => {
    if (!step) measure();
    if (!step) return;
    const from = tween ? tween.to : pos; // chain presses instead of restarting
    tween = { from, to: from + direction * step, start: performance.now() };
  };

  const frame = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;

    if (!period) measure();

    if (period > 0) {
      // Someone scrolled or swiped: adopt their position rather than fight it.
      if (lastWritten >= 0 && Math.abs(strip.scrollLeft - lastWritten) > 1) {
        pos = strip.scrollLeft;
        tween = null;
      }

      if (tween) {
        const t = Math.min((now - tween.start) / TWEEN_MS, 1);
        pos = tween.from + (tween.to - tween.from) * easeOutCubic(t);
        if (t >= 1) {
          pos = tween.to;
          tween = null;
        }
      } else if (!paused && !REDUCED) {
        pos += DRIFT * dt;
      }

      pos = norm(pos);
      strip.scrollLeft = pos;
      lastWritten = strip.scrollLeft;
    }

    requestAnimationFrame(frame);
  };

  const setPaused = (v) => { paused = v; };

  // Stop while someone is looking at, touching or tabbing through the strip.
  const frameEl = strip.parentElement;
  if (frameEl) {
    frameEl.addEventListener('pointerenter', () => setPaused(true));
    frameEl.addEventListener('pointerleave', () => setPaused(false));
    frameEl.addEventListener('focusin', () => setPaused(true));
    frameEl.addEventListener('focusout', () => setPaused(false));
  }
  strip.addEventListener('touchstart', () => setPaused(true), { passive: true });
  strip.addEventListener('touchend', () => setPaused(false), { passive: true });
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  if (prev) prev.addEventListener('click', () => nudge(-1));
  if (next) next.addEventListener('click', () => nudge(1));

  // Arrow keys when the strip itself has focus.
  strip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const before = period ? pos / period : 0;
      measure();
      pos = norm(before * period); // hold the same place in the loop
    }, 150);
  });
  window.addEventListener('load', measure);

  measure();
  requestAnimationFrame(frame);
}

/* ── boot ───────────────────────────────────────────────────── */
function boot() {
  const year = $('year');
  if (year) year.textContent = String(new Date().getFullYear());

  initReveals();
  initScrollFx();
  initSheet();
  initPlatform();
  initShots();
  initShare();
  loadGitHub();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
