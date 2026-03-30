# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-03-31
### Added
- Automated CI/CD Playwright testing suite for core functionality validation.
- Playwright E2E automation workflow in GitHub Actions mapped to every commit.

### Security
- Neutralized Parameter Injection vector where user-controlled URLs could leak command execution parameters into yt-dlp by explicitly enforcing positional flags with \`--\`.

### Fixed
- Fixed silent failures during large batch downloads on full partitions by enforcing a 50MB minimal disk space buffer prior to initiating merging and download pipelines.

## [1.0.2] - 2026-03-30
### Fixed
- Fixed critical startup failure caused by duplicate IPC handler registration for 'add-playlist-to-queue' channel
- Resolved application crash on launch with "Attempted to register a second handler" error
- Maintained enhanced playlist functionality while removing duplicate code

### Changed
- Cleaned up duplicate IPC handler registrations in main process
- Preserved more advanced playlist handler with video info extraction and format detection

## [1.0.1] - 2026-03-30
### Fixed
- Fixed an issue where the download queue would indefinitely hang during the initial FFmpeg fetch by using direct background native stream routing to disk.
- Fixed a bug on Windows where clicking Pause or Cancel left 'yt-dlp' descendant child-processes running out of control, causing UI states to sporadically break. Replaced it with a native 'taskkill' process-tree terminator.

### Changed
- Expanded the 'Clear Download History' UI from a generic action into a Dropdown menu that gives the user fine-tuned control (clear Completed, Failed, or All).

## [1.0.0] - 2024-01-01
### Added
- Initial release
- Video download support via yt-dlp
- Playlist detection and download
- Download queue management
- Settings and preferences
