# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Releases shipped a stale main process.** `electron/main.cjs` is an esbuild bundle of `electron/main.ts`, but it was committed to the repository and the release workflow never rebuilt it — electron-builder packaged whichever bundle happened to be in the tagged commit. Because the v1.1.5 release commit changed `main.ts` without rebuilding, **the v1.1.5 installer shipped the v1.1.4 main process and none of the 1.1.5 desktop fixes**. Both `.cjs` bundles are now generated-only and gitignored, and `.github/workflows/release.yml` runs `npm run build:electron` before packaging.
- **Splash screen never appeared in the installed app.** `createSplashWindow()` looked for `splash.html` under `app.asar.unpacked/dist/`, but the builder packs it inside the asar at `client/splash.html` and does not unpack it, so a blank always-on-top window was shown. It now resolves the file relative to `app.getAppPath()`.
- **`npm run setup:playwright` installed the wrong package.** `electron/extractor.ts` dynamically imports `playwright-core`, which was never declared as a dependency, so the Playwright fallback extraction engine could never run. `playwright-core` is now an `optionalDependency` (still excluded from the packaged installer) and the script invokes its CLI.
- **`scripts/download-binaries.ts` leaked scratch files on failure.** A missing file inside a downloaded archive threw before the cleanup step, leaving a `temp_*/` directory and its zip behind. Extraction is now wrapped in `try`/`finally`.

### Removed

- Unused code: 25 unreferenced shadcn/ui components, plus `download-item.tsx`, `not-found.tsx`, `web-api.ts`, `api-config.ts`, `formatting.ts`, `use-ws-progress.ts`, `use-settings.ts`, `types/index.ts`, and `electron/utils/logger.ts` — none had an importer.
- `scripts/build.ts` and the `build` script: it emitted `dist/main.cjs` and `dist/preload.cjs`, which electron-builder never packaged. Use `build:win` / `build:mac` / `build:linux`.
- The `prebuild:win` script: npm ran it automatically before `build:win`, then `build:electron` immediately rebuilt and overwrote both bundles, discarding its output.
- `scripts/dev-electron.cjs`: an unreferenced duplicate of `dev-electron.ts`.
- `tsconfig.server.json`: unreferenced; `server/**/*` is already covered by the root `tsconfig.json`.
- 26 unused npm packages, including `framer-motion`, `electron-updater`, `ws`, `recharts`, `date-fns`, `cmdk`, `vaul`, and 12 unused Radix primitives.

### Changed

- Generated artifacts are no longer tracked in git: the two Electron bundles and the icon set built by `npm run generate:icons`.
- Added `.github/workflows/ci.yml` running lint, typecheck, and tests on every push and pull request. Release builds now use `npm ci` instead of `npm install`.
- Enabled `eslint-plugin-react-hooks`, which was installed but never wired into the lint config.

## [1.1.5] - 2026-09-10

### Fixed

**Desktop app (electron/main.ts):**

- **FFmpeg-Required Detection** — `checkFFmpegRequired()` failed to recognize that nearly every real download (default "best" quality, any specific-quality selection) triggers a video+audio merge in `spawnDownload()`. It previously only matched a couple of literal substrings, so the on-demand FFmpeg installer was skipped for most downloads when FFmpeg wasn't yet present, causing a confusing merge failure instead of the intended "downloading FFmpeg first" flow.
- **`save_path` Never Reflected the Real Filename** — The database's `save_path` for yt-dlp downloads was set once at queue time and never updated to the actual on-disk filename (which yt-dlp derives from the video title). After an app restart, cleanup/delete actions referenced a file that never existed. Completion now persists the real resolved path.
- **Incomplete Partial-File Cleanup on Restart** — `deletePartialFile()` (used by `delete-download` and as a fallback in `cancel-download`) only removed a single `.part` file, missing `.ytdl` resume files and `.part-FragN` fragment files that yt-dlp also leaves behind. It now sweeps the containing folder the same way the live-process cleanup path already did.
- **Disk-Space Guard Silently Disabled for Network Shares** — `getFreeSpace()` derived a Windows drive letter by splitting on `:`, which breaks for UNC paths (`\\server\share`) with no drive letter. The PowerShell `Get-PSDrive` command failed silently and the check always reported unlimited free space. Now detects UNC paths and queries them via `fsutil volume diskfree`.
- **`NaN` Written to Downloaded-Bytes Columns** — When yt-dlp reports a progress line without a known total size, `total_bytes`/`received_bytes` were written to the database as `NaN`. The parser now skips the update when the size is unparseable instead of persisting `NaN`.
- **Duplicate-Download Guard Missed Paused Downloads** — Resubmitting a URL that already had a `paused` entry created a second, independent row for the same output file instead of being rejected. `paused` is now included in the duplicate check.
- **Removed Dead Playwright Browser-Launch Code** — `electron/main.ts` had an unused `getPlaywrightBrowser()` helper that duplicated (and was never called in favor of) the working Playwright fallback engine already implemented in `electron/extractor.ts`.
- Fixed the same class of stale-status bug in `client/src/hooks/use-ws-progress.ts` (checked for `status === 'error'` instead of `'failed'`); this hook is currently unused by the desktop UI (`Dashboard.tsx` has its own inline progress handler, which already checked the correct status), so this had no live user impact, but is corrected for correctness.

**Web app (Render deployment, already live via continuous auto-deploy — included here for a complete record):**

- Removed the broken Cobalt API integration — all public instances now require JWT authentication that this app didn't send, so those code paths never worked. Simplified `client/src/lib/api.ts`, `client/src/lib/web-api.ts`, and `server/index.ts` accordingly.
- Added YouTube bot-detection retry logic to the server's video-info/download endpoints for the Render-hosted web version.

**CI/CD & release infrastructure:**

- **GitHub Pages deployment race condition** — `pages.yml` and `deploy-web.yml` both triggered on every push to `main`, both deployed to the same `github-pages` environment, and shared the same Actions concurrency group with contradictory settings. This caused `pages.yml` to be cancelled on nearly every push (confirmed across months of run history). `pages.yml` was redundant — `deploy-web.yml` already uploaded the full `docs/` tree — so it was removed and `deploy-web.yml` simplified to a single, race-free deploy step scoped to `docs/**` changes.
- **Stale/orphaned `docs/web/` build output** — the committed `docs/web/index.html` is a redirect stub to the canonical Render-hosted web app, but `deploy-web.yml` was still rebuilding a full separate React SPA into that same path on every push, silently superseding the stub via the race above. The SPA rebuild step (`build:gh-pages`) has been removed; `docs/web/` is now deployed as the static redirect stub it's committed as, with orphaned build assets from an old SPA build (`docs/web/assets/*.js`, `*.css`, unreferenced by the stub) removed.
- Added `overwrite: true` to the release-asset upload step to prevent duplicate assets on a re-run of the same tag.

### Security

- Ran a dependency audit: 37 vulnerabilities (4 critical, 24 high, 5 moderate, 4 low) down to 2 (both moderate). `npm audit fix` (non-force) and a patch-level `tsx` update resolved 34; `sharp` was bumped to `0.35.4` (verified compatible — `npm run generate:icons` re-run end-to-end). The remaining 2 (`vitest`/`@vitest/mocker`) require `vitest` 5.0.0, whose peer dependencies need a coordinated `@types/node` major bump this repo isn't ready for; deferred as low-risk (devDependency only, zero test files currently exist to exercise it).

### Removed

- Unused dependencies: `zod`, `zod-validation-error`, `chai`, `supertest`, `@types/supertest` — no references anywhere in the codebase; the test-related ones were leftover from a test suite removed in an earlier cleanup pass.
- Dead `@shared`/`@assets` path aliases (`vite.config.ts`, `tsconfig.json`, `vitest.config.ts`) pointing to `shared/` and `attached_assets/` directories that don't exist in the repository.
- `.qwen/settings.json.orig` (orphaned backup file) and `.antigravity/session_summary.md` (stale one-off AI session output).

### Changed

- Redesigned the static marketing/download page (`docs/index.html`) with Apple-inspired design refinements: fixed a layout gap at 560–768px widths, added `prefers-reduced-motion`/`prefers-reduced-transparency`/`prefers-contrast` support and `:focus-visible` states (previously missing entirely), bumped touch targets to ~44px.
- Added `.gitattributes` to normalize line endings across the Windows development environment and the Linux-based CI runners.
- Documented the previously-unreferenced `Dockerfile` in `README.md` as an optional self-hosting path for the web version.

### Documentation

- **README** — Corrected the FFmpeg-bundling claim: the installer force-bundles FFmpeg/ffprobe (per the 1.0.5/1.0.6 "Force-Bundled Binaries" change) rather than downloading FFmpeg on first use to keep the installer under 150MB. The on-demand downloader now correctly described as a fallback recovery path for a missing binary, not the primary distribution strategy.
- **SCRIPTS_DOCUMENTATION.md** — Removed documented scripts that no longer exist (`postinstall`, `build:gh-pages`); added missing entries for `dev:web`, `build:web`, `start:web`, `setup:playwright`, `test`, `lint`, and `format`.

## [1.1.4] - 2026-04-14

### Fixed

- **Version Display** — App version now displays dynamically in the left sidebar (under "Internet Download Hub" header) instead of the Settings panel. Replaced hardcoded `v1.1.2` with live data from `electronAPI.getAppVersion()`.
- **YouTube Quality Lock (360p)** — Switched YouTube `player_client` from `android` (limited to ~360p) to `tv` (full 1080p/4K/8K DASH formats). Applied to both desktop (`electron/ytdlp-args.ts`) and web version (`server/index.ts`).
- **Format Argument Bug** — Fixed fallback format IDs (e.g., `bestvideo[height=1080]+bestaudio/best[height=1080]`) being incorrectly appended with `+bestaudio`, creating invalid yt-dlp syntax. Now detects complete format expressions and uses them as-is.
- **Server YouTube Config** — Added `youtube:player_client=tv` and `--age-limit 99` to both `/api/video-info` and `/api/download` endpoints for consistent full-quality format retrieval.

### Improved

- **Quality Collection** — The `tv` player client returns the complete DASH format inventory including 2160p, 1440p, 1080p (60fps), 720p, 480p, 360p, and audio-only — matching modern yt-dlp best practices.
- **Code Quality** — All changes pass TypeScript compilation (0 errors) and ESLint (0 errors, 0 warnings).

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
