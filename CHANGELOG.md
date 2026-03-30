# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
