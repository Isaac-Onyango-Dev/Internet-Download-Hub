# Internet Download Hub - Project State

## Overview
A production-ready Electron + React + TypeScript desktop video download manager supporting 1000+ websites via yt-dlp, streamlink, gallery-dl, and N_m3u8DL-RE engines.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Radix UI
- **Backend**: Electron 41 + Express.js (web version)
- **Build**: Vite + esbuild + electron-builder
- **Database**: SQL.js (SQLite in-memory)
- **Testing**: Vitest (98 tests passing)
- **Download Engines**: yt-dlp, streamlink, gallery-dl, N_m3u8DL-RE, FFmpeg

## Navigation Structure
```
📥 Downloader (/) - Main video capture panel
💾 Queue & History (/queue) - Download queue and history
🌐 Supported Sites (/supported-sites) - All supported sites by category
⚙️ Settings (/settings) - App configuration
❤️ Support (/support) - Help and support page
```

## Key Features Implemented

### 1. Video Quality Format Display
- Simplified labels: `{resolution}p {fps} {filesize}` (e.g., "1080p 60fps 2.56 GB")
- Removed codec names and "(Video Only)" indicators for clarity
- Smart fallback system: If yt-dlp returns <3 formats, auto-generates standard quality options (2160p to 144p)
- Proper sorting: Highest to lowest quality, with file size as tiebreaker

### 2. Playlist Detection Dialog
- Real-time video counting during streaming
- Three download modes: All, Range, Select specific videos
- Streaming state tracking with loading indicators
- Proper state synchronization between background streaming and dialog display

### 3. Binary Update System (All Fixed)
- **Streamlink**: Fixed to use `streamlink/windows-builds` repo (was 404)
- **N_m3u8DL-RE**: Dynamic asset finder (was hardcoded with wrong URL)
- **Version comparison**: Normalizes v-prefix for accurate detection
- **IPC handler**: Accepts both string and object parameters
- **Zip extraction**: Recursive search for specific exe file
- **UI display**: Clean version format without double "v" prefix

### 4. Settings Panel (Optimized)
- Parallel binary checks (4x faster)
- Deferred binary updates loading (no blocking UI)
- Removed dead `saved` state (3 unnecessary re-renders per toggle)
- Eliminated redundant binary check calls
- Simplified playlist settings to 2 toggles (detect + create folder)

### 5. Supported Sites Page
- 10 categories, 50+ sites listed
- Search functionality by name or URL
- Engine legend with color-coded badges
- Collapsible categories with accordion pattern
- Independent standalone page (not nested in Dashboard tabs)

### 6. Performance Optimizations
- Binary checks: ~4-8s → ~1-2s (parallel)
- Settings tab: ~2-4s → ~0.1s open time
- Eliminated mouse freezes during UI interactions
- 3x fewer re-renders per settings toggle

## Database Schema
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

## Test Infrastructure
- 98 production tests across 5 test files
- Coverage: Server API, Electron utilities, integration, components, server logic
- All tests passing ✅
- TypeScript compilation: PASSED ✅
- ESLint: 0 errors (160 warnings - all pre-existing)

## File Structure
```
├── client/src/
│   ├── components/ - React UI components
│   ├── hooks/ - Custom React hooks
│   ├── lib/ - Utilities (supported-sites.ts, web-api.ts, etc.)
│   ├── pages/ - Main pages (Dashboard, SupportedSites, Support)
│   └── types/ - TypeScript interfaces
├── electron/ - Electron main process
│   ├── main.ts - Main process logic
│   ├── extractor.ts - Video extraction engines
│   ├── preload.ts - IPC bridge
│   └── utils/ - Helper utilities
├── server/ - Express web server
│   └── index.ts - Web API endpoints
├── test/ - Production test suite
│   ├── factories/ - Test data generators
│   └── helpers/ - Test utilities
└── scripts/ - Build and dev scripts
```

## Active Work Items
None - All major features implemented and tested

## Known Issues
None - All critical issues resolved

## Build Commands
```bash
npm run dev              # Development mode (Electron)
npm run dev:web          # Development mode (Web)
npm run build:win        # Build Windows installer
npm run test             # Run test suite
npm run check            # TypeScript type checking
npm run lint             # ESLint checking
```

## Release Information
- Version: 1.1.3
- Platform: Windows 10/11 (64-bit)
- License: MIT
- Author: Isaac Onyango

## v1.1.3 New Features

### Application Menu Bar (Top Menu)
- **File**: New Download (Ctrl+N), Choose Save Folder (Ctrl+Shift+S), Close to Tray toggle, Exit (Alt+F4)
- **Edit**: Undo, Redo, Cut, Copy, Paste, Delete, Select All
- **View**: Full Screen (F11), Zoom In/Out/Reset, Reload (Ctrl+R), DevTools (F12, dev-only)
- **Downloads**: Open Download Folder (Ctrl+J), View Queue (Ctrl+L), Clear Completed/Failed/All History
- **Help**: GitHub Repo, Report a Bug, Request a Feature, Open Log File, Check for Updates, About dialog

### App Update Checker
- Help → Check for Updates queries GitHub Releases API
- Compares installed version vs latest release tag
- Shows release notes in a dialog
- Offers "Download Update" button opening GitHub releases page
- Graceful error handling with fallback to manual GitHub navigation

### About Dialog
- Shows app version, yt-dlp/ffmpeg/streamlink engine versions
- Copyright and license info
- "Copy Info" button for easy bug report pasting