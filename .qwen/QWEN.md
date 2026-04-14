# Internet Download Hub - Project State

## Overview
A production-ready Electron + React + TypeScript desktop video download manager supporting 1000+ websites via yt-dlp, streamlink, gallery-dl, and N_m3u8DL-RE engines. Also ships a fully functional web version on Render.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Radix UI + wouter (routing) + TanStack Query
- **Backend**: Electron 41 (desktop) + Express.js (web version on Render)
- **Build**: Vite + esbuild + electron-builder
- **Database**: SQL.js (SQLite in-memory, desktop only)
- **Testing**: Vitest (passWithNoTests — test files removed per production cleanup)
- **Download Engines**: yt-dlp, streamlink, gallery-dl, N_m3u8DL-RE, FFmpeg
- **Web Downloads**: Cobalt API (for YouTube) + server yt-dlp (for all other sites)

## Navigation Structure

### Desktop (Electron)
```
📥 Downloader (/) - Main video capture panel
💾 Queue & History (/queue) - Download queue and history
🌐 Supported Sites (/supported-sites) - All supported sites by category
⚙️ Settings (/settings) - App configuration
❤️ Support (/support) - Help and support page
```

### Web (Render)
```
📥 Download (/) - Clean single-page web download UI
🌐 Supported Sites (/supported-sites) - Shared page
```

## Environment Detection
- `isElectron()` checks `window.electronAPI.__isElectron === true` (set only by Electron preload)
- Web mode has NO fake `electronAPI` injection — uses `api.ts` fallbacks to server endpoints
- App.tsx routes: Desktop → Dashboard (tabbed), Web → DashboardWeb (single-page)
- EULA gate applies to desktop only — web version skips it entirely

## Key Features Implemented

### Desktop
1. **Application Menu Bar** (v1.1.3)
   - File: New Download, Choose Save Folder, Close to Tray toggle, Exit
   - Edit: Undo, Redo, Cut, Copy, Paste, Delete, Select All
   - View: Full Screen, Zoom In/Out/Reset, Reload, DevTools (dev-only)
   - Downloads: Open Folder, View Queue, Clear Completed/Failed/All History
   - Help: GitHub Repo, Report Bug, Request Feature, Open Log File, Check for Updates, About dialog

2. **App Update Checker**
   - Help → Check for Updates queries GitHub Releases API
   - Compares installed version vs latest release tag
   - Shows release notes with "Download Update" button
   - Graceful fallback to manual GitHub navigation

3. **About Dialog**
   - Shows app version, yt-dlp/ffmpeg/streamlink engine versions
   - Copyright, license info, "Copy Info" button for bug reports

4. **Video Quality Format Display**
   - Simplified labels: `{resolution}p {fps} {filesize}`
   - Smart fallback if yt-dlp returns <3 formats
   - Proper sorting: highest to lowest quality

5. **Playlist Detection Dialog**
   - Real-time video counting during streaming
   - Three modes: All, Range, Select specific videos
   - Streaming state tracking

6. **Binary Update System**
   - All engines: streamlink, N_m3u8DL-RE, gallery-dl, yt-dlp
   - Version comparison, zip extraction, clean UI display

7. **Settings Panel (Optimized)**
   - Parallel binary checks (4x faster)
   - Eliminated redundant re-renders

8. **Supported Sites Page**
   - 10 categories, 50+ sites, search functionality
   - Engine legend with color-coded badges

### Web Version (Redesigned)
1. **Clean Single-Page UX** — paste URL → fetch info → pick quality → download
2. **Smart Per-Site Routing** — YouTube → Cobalt API (bypasses bot detection), all other sites → server yt-dlp endpoint
3. **Cobalt Integration** — server proxy `/api/cobalt` with fallback to 3 direct instances
4. **Recent Downloads** — localStorage-based (last 10)
5. **Top Bar** — Web badge, Supported Sites link, Desktop CTA
6. **Trust Bar** — 1000+ sites, no tracking, works in any browser
7. **Responsive** — mobile to desktop, no desktop UI leakage
8. **No EULA** — web users go straight to the app
9. **Dedicated Top Bar + Footer** — standalone page, no LayoutShell dependency

## Web Version Smart Routing (api.ts)
```
User pastes URL
  ├── YouTube / youtu.be / music.youtube.com
  │     └──→ Server /api/cobalt proxy → 3 Cobalt instances fallback
  │            Bypasses YouTube bot detection on datacenter IPs
  └── TikTok, Twitter, Vimeo, Reddit, etc.
        └──→ Server /api/video-info (yt-dlp -J) → rich metadata
```

## Database Schema (Desktop Only)
```sql
settings (
  id, theme, max_concurrent_downloads, auto_capture, file_types,
  download_path, default_quality, default_format, detect_playlists,
  playlist_download_mode, create_playlist_folder, ffmpeg_downloaded,
  close_to_tray, eula_age_acknowledged, cookies_file_path
)

downloads (
  id, url, filename, thumbnail, duration, uploader, mime_type,
  total_bytes, received_bytes, format_id, state, error, save_path,
  created_at, completed_at, playlist_title, playlist_index, playlist_total
)
```

## File Structure
```
├── client/src/
│   ├── components/ - React UI components (Shadcn/Radix)
│   ├── hooks/ - use-downloads, use-settings, use-video-detect, use-ws-progress, use-toast
│   ├── lib/ - api.ts (unified), web-api.ts (Cobalt fallback), supported-sites.ts, env.ts, queryClient.ts
│   ├── pages/ - Dashboard.tsx (desktop), DashboardWeb.tsx (web), SupportedSites.tsx, Support.tsx
│   └── types/ - TypeScript interfaces + electron.d.ts
├── electron/
│   ├── main.ts - Main process (window, tray, IPC, DB, download queue, menu bar)
│   ├── extractor.ts - Multi-engine video extraction
│   ├── preload.ts - IPC bridge (with __isElectron marker)
│   ├── url-analyser.ts - URL-to-engine mapping
│   └── utils/ - logger, errors, ytdlp-args
├── server/
│   └── index.ts - Express: yt-dlp endpoints + Cobalt proxy + static file serving
├── docs/ - Static marketing site (GitHub Pages)
└── scripts/ - build, download-binaries, generate-icons, dev-electron
```

## Deployments
| Target | URL | Deploy Method |
|--------|-----|---------------|
| Desktop | GitHub Releases | Manual `npm run build:win` + GitHub tag trigger |
| Web App | internet-download-hub.onrender.com | Render auto-deploy on `main` push |
| Docs Site | isaac-onyango-dev.github.io/Internet-Download-Hub/ | GitHub Actions (pages.yml + deploy-web.yml) |

## Build Commands
```bash
npm run dev              # Development mode (Electron)
npm run dev:web          # Development mode (Web: Vite + Express concurrently)
npm run build:win        # Build Windows installer
npm run build:web        # Build web version for Render
npm run start:web        # Start web server in production mode
npm run test             # Run test suite
npm run check            # TypeScript type checking
npm run lint             # ESLint checking
```

## Code Quality
- TypeScript compilation: ✅ 0 errors
- ESLint: ✅ 0 errors, 0 warnings
- All builds passing: Vite, esbuild main, esbuild preload

## Release Information
- **Current Version**: 1.1.4
- **Tag**: `v1.1.4` (published on GitHub Releases)
- **Platform**: Windows 10/11 (64-bit)
- **License**: MIT
- **Author**: Isaac Onyango

## v1.1.4 Changelog Summary

### Version Display Fix
- Sidebar now shows dynamic version from `electronAPI.getAppVersion()`
- Replaced hardcoded `v1.1.2` with live data
- Removed redundant version display from Settings panel

### YouTube Quality Unlock (1080p+)
- Switched YouTube `player_client` from `android` → `tv`
- `android` client was limited to ~360p max
- `tv` client returns full DASH format inventory (2160p, 1440p, 1080p, 720p, etc.)
- Applied to both desktop (`ytdlp-args.ts`) and web (`server/index.ts`)

### Format Argument Bug Fix
- Fixed fallback format IDs like `bestvideo[height=1080]+bestaudio/best[height=1080]`
- Previously incorrectly appended with `+bestaudio` creating invalid yt-dlp syntax
- Now detects complete format expressions and uses them as-is

### Code Quality
- TypeScript compilation: ✅ 0 errors
- ESLint: ✅ 0 errors, 0 warnings

## v1.1.3 Changelog Summary

### Application Menu Bar
- Full 5-menu system (File, Edit, View, Downloads, Help) with keyboard shortcuts
- Menu-to-renderer IPC for reactive navigation and state updates

### Web Version Overhaul
- Fixed `isElectron()` detection — was always returning true in browser
- DashboardWeb now actually renders (was dead code before)
- Complete redesign: single-page, clean UX, dedicated top bar/footer
- Smart per-site routing: YouTube → Cobalt, others → server yt-dlp
- Scroll fix: restored body overflow (was `overflow: hidden`)
- EULA skipped for web users

### Docs Site Redesign
- Complete rewrite with scroll-triggered animations
- New sections: How It Works, Features, Supported Sites, Comparison, FAQ
- Responsive, zero dependencies, pure HTML/CSS/JS

### Security & Code Quality
- DevTools properly gated behind `isDev` (hidden in production)
- `require('electron')` replaced with proper ES module import for clipboard
- All IPC endpoints fully typed in `electron.d.ts`
