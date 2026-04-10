# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-04-10

### Added

- **Application Menu Bar** — Fully functional top menu (File, Edit, View, Downloads, Help):
  - **File** → New Download (`Ctrl+N`), Choose Save Folder (`Ctrl+Shift+S`), Close to Tray toggle, Exit (`Alt+F4`)
  - **Edit** → Undo, Redo, Cut, Copy, Paste, Delete, Select All
  - **View** → Full Screen (`F11`), Zoom In/Out/Reset (`Ctrl++/-/0`), Reload (`Ctrl+R`), Dev Tools (`F12`, dev-only)
  - **Downloads** → Open Download Folder (`Ctrl+J`), View Queue (`Ctrl+L`), Clear Completed/Failed/All History
  - **Help** → GitHub Repo, Report a Bug, Request a Feature, Open Log File, Check for Updates, About dialog
- **App Update Checker** — Help → Check for Updates now queries GitHub Releases API, compares installed vs latest version, shows release notes, and offers a direct download link
- **About Dialog** — Displays app version, yt-dlp/ffmpeg/streamlink engine versions, copyright info, and a "Copy Info" button for bug reports
- **Menu-to-Renderer IPC** — New events (`navigate-to-tab`, `settings-updated`, `downloads-cleared`) so menu actions update the UI reactively
- **Supported Sites Page** — Standalone page listing 50+ supported sites across 10 categories with search functionality

### Improved

- **DevTools Security** — Properly gated behind `isDev` check; hidden entirely in production builds
- **Type Safety** — All new IPC endpoints fully typed in `electron.d.ts`
- **Web Compatibility** — Menu event stubs added to `web-api.ts` for zero-crash parity between desktop and web
- **Clipboard Access** — Replaced `require('electron')` with proper ES module import

### Fixed

- **ESLint** — 0 errors, 0 warnings across entire codebase
- **TypeScript** — 0 compilation errors
- **Build Pipeline** — Vite, esbuild (main + preload) all pass cleanly

## [1.1.2] - 2026-04-07

### Fixed

- **TypeScript Compilation**: Resolved all 29 TypeScript errors across 5 files (calendar, chart, resizable, Dashboard, DashboardWeb)
- **ESLint Errors**: Fixed all 5 blocking ESLint errors and reduced warnings from 162 to 158
- **react-day-picker v9**: Updated calendar component API from deprecated `IconLeft`/`IconRight` to `Chevron`
- **react-resizable-panels v4**: Migrated from `PanelGroup`/`PanelResizeHandle` to `Group`/`Separator`
- **recharts v3**: Fixed tooltip component type compatibility with explicit prop interfaces
- **DashboardWeb.tsx**: Added missing dependency arrays to all `useCallback` hooks
- **Security**: Added `rel="noreferrer"` to external `target="_blank"` links
- **Windows Compatibility**: Fixed `start:web` script to use `cross-env` for NODE_ENV
- **Build Configuration**: Moved `tsBuildInfoFile` out of `node_modules` to prevent loss on reinstall
- **cross-env Version**: Corrected from non-existent v10.1.0 to stable v7.0.3

### Added

- **Professional UI/UX**: Complete design system polish across all pages
- **Support Page Overhaul**: 
  - Replaced emoji icons with Lucide components
  - Added proper Tabs component with Share/Donate sections
  - Improved platform share buttons with brand colors
  - Enhanced payment options with Card components and icon mapping
  - Professional modal for "Coming Soon" features
- **Sidebar Enhancements**:
  - Version badge display (v1.1.2)
  - Active state indicators with left border accent
  - Hover animations with icon scale transitions
  - Footer with web version link and copyright
- **404 Page Redesign**: 
  - Large "404" watermark
  - Professional icon and messaging
  - Dual action buttons (Go Back / Return to App)
  - Entrance animation
- **Design Token Consistency**: Replaced all hardcoded colors with CSS variables
- **Page Entrance Animations**: Added fade-in transitions to all major pages
- **Card Component Usage**: Standardized card styling across Support and Settings pages

### Changed

- **Import Cleanup**: Removed 12+ unused imports across multiple files
- **Button Standardization**: Consistent sizing and styling using shadcn variants
- **Color System**: All gray-* values replaced with muted/card/foreground tokens
- **Typography**: Improved hierarchy and consistency
- **Spacing**: Standardized padding and margins

### Improved

- **Developer Experience**: Clean TypeScript build with zero errors
- **Code Quality**: Proper type annotations throughout
- **Maintainability**: Consistent design system usage
- **Accessibility**: Better contrast ratios and semantic HTML

## [Unreleased] - Web Version Updates

### Added

- **Web-Optimized Dashboard**: New `DashboardWeb.tsx` component designed specifically for browser-based downloading with appropriate UX patterns
- **Download History in Web**: Track recent downloads (up to 10) stored in browser localStorage
- **Backend Cobalt Proxy**: Express endpoint at `/api/cobalt` that handles JWT authentication transparently for web clients
- **Fallback API Logic**: Web version tries backend proxy first, falls back to direct Cobalt API calls for GitHub Pages deployment
- **Enhanced Web Documentation**: Comprehensive web version user guide covering features, limitations, troubleshooting, privacy, and operations

### Changed

- **Web Version UI**: Removed desktop-like Queue/History tabs in favor of simple, browser-appropriate interface
- **App Routing**: App now detects Electron environment and uses appropriate dashboard (desktop or web)
- **Quality Selector**: Simplified to 1080p, 720p, and audio-only (no complex format selection)
- **Error Handling**: Improved error messages for failed video info fetches and downloads

### Fixed

- **CORS Authentication**: Resolved "Could not reach any Cobalt download service" error by implementing backend proxy that adds JWT tokens server-side

### Improved

- **Web UX**: Single-page workflow optimized for browser downloads (paste URL → get info → select quality → download)
- **Download Flow**: Downloads now go directly to browser's Downloads folder without fake queue management
- **Error Messages**: Clear, actionable error messages for different failure scenarios (network, unsupported site, etc.)
- **Build Configuration**: Added Vite proxy for seamless development API calls between frontend (5173) and backend (5005)

## [1.0.9] - 2026-04-04

### Fixed

- **Code Quality**: Removed `@ts-nocheck` directives from UI components (calendar, chart, resizable) for proper type checking.
- **React Component**: Fixed unknown property `cmdk-input-wrapper` to use valid `data-cmdk-input-wrapper` attribute in command.tsx.
- **Imports**: Cleaned up unused imports in download-item.tsx and Dashboard.tsx.
- **Build Process**: Removed debug log files and test artifacts from the repository.

### Removed

- Build log files (`build_log.txt`, `root_build_log.txt`, `root_build_log_2.txt`)
- ESLint debug reports (`.gemini_lint_errors.txt`, `.gemini_lint_errors_2.txt`)
- Manual test files (`test-app.cjs`, `test-app.js`, `test-extract.ts`, `test3.cjs`)
- Empty `tests/` directory
- Corrupted artifacts (`$null`, `output.json`)

## [1.0.8] - 2026-04-03

### Fixed

- **Playlist downloads**: Fixed critical bug where playlist videos bypassed the queue and downloaded simultaneously. Now properly adds to queue and respects `max_concurrent_downloads` setting.
- **URL analyzer**: Fixed host matching to prevent false positives (e.g., `fakeyoutube.com` incorrectly matching YouTube).
- **Type definitions**: Fixed `addPlaylistToQueue` return type to match actual implementation.

### Changed

- Removed dead code from SettingsPanel (duplicate playlist dialog code).
- Improved domain matching in URL analyzer to use proper exact/subdomain matching.

## [1.0.7] - 2026-04-01

### Fixed

- **Build Pipeline**: Corrected the FFmpeg/ffprobe download URLs in the build scripts which was causing the 1.0.6 release to fail during the binary acquisition phase.

## [1.0.6] - 2026-04-01

### Added

- **Full Engine Suite Bundled**: The installer now includes **all** download engines: yt-dlp, FFmpeg, ffprobe, gallery-dl, streamlink, and N_m3u8DL-RE. No background downloads required for any video format.

### Improved

- **Rigorous Build Verification**: Expanded the release pipeline to verify the existence of all six engines before every build.

## [1.0.5] - 2026-04-01

### Added

- **Force-Bundled Binaries**: The installer now comes pre-shipped with all core download engines (`yt-dlp`, `ffmpeg`, etc.). The app is now fully functional immediately after installation without needing background binary downloads.

### Improved

- **Build Pipeline**: Added strict verification steps to the release workflow to ensure no "broken" builds without essential binaries are ever published.
- **Binary Acquisition**: Enhanced the internal downloader with proper User-Agent headers and robust extraction handling.

## [1.0.4] - 2026-04-01

### Fixed

- Resolved "Download operation timed out" false positive error banner in the Dashboard.
- Decoupled FFmpeg binary acquisition from the main IPC response to prevent UI hangs during first-time setup.

### Improved

- Implemented asynchronous promise locking for backend binary downloads to prevent concurrent process collisions.

## [1.0.3] - 2026-03-31

### Added

- Automated CI/CD Playwright testing suite for core functionality validation.
- Playwright E2E automation workflow in GitHub Actions mapped to every commit.

### Security

- Neutralized Parameter Injection vector where user-controlled URLs could leak command execution parameters into yt-dlp by explicitly enforcing positional flags with `--`.

### Fixed

- Fixed silent failures during large batch downloads on full partitions by enforcing a 50MB minimal disk space buffer prior to initiating merging and download pipelines.

## [1.0.2] - 2026-03-30
...
