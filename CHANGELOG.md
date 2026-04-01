# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
