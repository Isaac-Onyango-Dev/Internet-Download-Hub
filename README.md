<div align="center">
  <img src="docs/icon.png" alt="Internet Download Hub" width="128" height="128" />
  <h1>Internet Download Hub</h1>
  <p>Grab any video, anywhere. A free, open source desktop video downloader for Windows.</p>

  <p><strong><a href="https://isaac-onyango-dev.github.io/Internet-Download-Hub/">internet download hub — download page</a></strong></p>

  <!-- Build Status Badge - Add your CI badge here -->
  <!-- ![Build Status](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/actions/workflows/ci.yml/badge.svg) -->

  <a href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest">
    <img src="https://img.shields.io/github/v/release/Isaac-Onyango-Dev/Internet-Download-Hub?label=Download&style=for-the-badge&color=FF2E9A&labelColor=0B0B12" alt="Download the latest release" />
  </a>
  <a href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases">
    <img src="https://img.shields.io/github/downloads/Isaac-Onyango-Dev/Internet-Download-Hub/total?style=for-the-badge&color=8B2FE0&labelColor=0B0B12" alt="Total downloads across all GitHub Releases" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows%2010%2F11-22D3EE?style=for-the-badge&labelColor=0B0B12" alt="Windows 10 and 11" />
  <img src="https://img.shields.io/badge/License-MIT-FF7A2F?style=for-the-badge&labelColor=0B0B12" alt="MIT licensed" />
</div>

---

## What is Internet Download Hub?

Internet Download Hub is a free Windows desktop application that lets you download videos from over 1000 websites including YouTube, Twitter, TikTok, Instagram, Facebook, Vimeo, Reddit, and many more. No browser extension required — just paste the video link and download.

## Web Version

A fully free web-based version of Internet Download Hub is available for quick downloads **without installation**.

- **Web App**: [internet-download-hub.onrender.com](https://internet-download-hub.onrender.com/)
- **No installation required** — works directly in your browser
- **Server-side yt-dlp** — an Express backend runs the same download engine as the desktop app
- **Hosted on Render** — see `render.yaml` and `server/index.ts`

**Web Version Limitations:**
- Shared free-tier server, so downloads are slower and large files may time out
- No persistent download history
- Basic quality selection
- Supported sites: YouTube, TikTok, Twitter, Instagram, Reddit, Vimeo, and 50+ other platforms
- For advanced features (playlists, scheduling, format conversion), use the **desktop version**

**Desktop Version Advantages:**
- All 1000+ sites supported by yt-dlp
- Download history and queue
- Playlist downloads with auto-naming
- Audio extraction and format conversion
- Parallel downloads with pause/resume
- Customizable output folder

## Tech Stack

| Component              | Technology                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | [Electron](https://www.electronjs.org/)                                                                                                                                       |
| **Language**           | [TypeScript](https://www.typescriptlang.org/)                                                                                                                                 |
| **Build Tool**         | [Vite](https://vitejs.dev/)                                                                                                                                                   |
| **Styling**            | [Tailwind CSS](https://tailwindcss.com/)                                                                                                                                      |
| **Download Engines**   | [yt-dlp](https://github.com/yt-dlp/yt-dlp), [FFmpeg](https://ffmpeg.org/), [streamlink](https://streamlink.github.io/), [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) |
| **Browser Automation** | [Playwright](https://playwright.dev/) — optional dev-only fallback engine, not bundled in the installer                                                                     |

## Supported Sites

Internet Download Hub supports downloading from **1000+ websites**, including:

| Category              | Sites                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| **Video Platforms**   | YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Vimeo, Dailymotion, Bilibili, Odyspace |
| **Live Streaming**    | Twitch, Kick, Rumble, VK Live                                                                   |
| **Anime & Streaming** | Crunchyroll, Funimation, niconico                                                               |
| **Image Boards**      | Pixiv, DeviantArt, ArtStation, Flickr                                                           |
| **Social Media**      | Tumblr, Pinterest, Reddit                                                                       |
| **And many more...**  | 1000+ sites supported via yt-dlp                                                                |

## Screenshots

|                   Downloader                   |                Active Queue                 |                 Empty Queue                 |                  Settings                  |
| :--------------------------------------------: | :-----------------------------------------: | :-----------------------------------------: | :----------------------------------------: |
| ![Downloader](docs/screenshots/downloader.jpg) | ![Active Queue](docs/screenshots/queue.jpg) | ![Empty Queue](docs/screenshots/queue2.jpg) | ![Settings](docs/screenshots/settings.jpg) |

## Features

- Download from 1000+ sites — YouTube, Twitter, TikTok, Instagram, Facebook, Reddit, Vimeo and more
- Multiple quality options — 1080p, 720p, 480p, 360p, Audio Only
- Fast parallel downloading with real-time progress tracking
- Automatic audio and video merging via FFmpeg
- Smart fallback engine system — yt-dlp, streamlink, gallery-dl, N_m3u8DL-RE
- Download queue with pause, resume, and cancel
- Download history
- Customizable save location
- No installation of Python or yt-dlp required — all engines (yt-dlp, FFmpeg, streamlink, gallery-dl, N_m3u8DL-RE) are bundled in the installer, fully functional immediately after install

## Download

**[Download the latest version for Windows](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest)**

Requirements: Windows 10 or Windows 11 (64-bit)

## Installation

1. Download `Internet Download Hub Setup X.X.X.exe` from the link above
2. Double click the installer
3. Follow the installation steps
4. Open Internet Download Hub from your Start Menu or Desktop

## How to Use

1. Copy a video link from any supported website
2. Paste it into the URL field in the app
3. Click **Get Video Info**
4. Select your preferred quality
5. Click **Download**

## Roadmap

Planned features and improvements:

- [ ] **macOS support** — Native app for Mac users
- [ ] **Browser extension** — Quick capture from browser
- [ ] **Batch URL import** — Download multiple videos at once from a list
- [ ] **Dark/Light theme toggle** — Theme customization option
- [ ] **Scheduled downloads** — Queue downloads for later
- [ ] **Download history search** — Find past downloads easily
- [ ] **Custom output templates** — Advanced filename customization

## FAQ

### Do I need to download FFmpeg separately?

No. FFmpeg (and every other engine — yt-dlp, streamlink, gallery-dl, N_m3u8DL-RE) ships bundled inside the installer, so high-quality video/audio merging works immediately after install with no extra downloads. If the bundled FFmpeg is ever missing (e.g. manually deleted from the app's install folder), the app will automatically fetch a replacement on first use as a fallback.

### Do I need Python installed?

No! Unlike other yt-dlp-based tools, Internet Download Hub bundles all required binaries (yt-dlp, FFmpeg, streamlink, etc.) directly with the app. You don't need to install Python or any other dependencies.

### Which video quality should I choose?

For the best quality, select **Highest Quality Available**. The app will automatically download the best video and audio tracks and merge them. For smaller files, choose 720p or 480p.

### How do I download age-restricted videos?

Some videos on YouTube and other sites require you to be signed in. In Settings, you can import your browser cookies (Netscape format) to access these videos. See the Settings page in the app for instructions.

### Is this app safe to use?

Internet Download Hub is open source under the MIT license. You can review the source code on GitHub. The app only downloads content that is publicly available or accessible with your own account credentials.

## Building from Source

```cmd
git clone https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub.git
cd Internet-Download-Hub
npm install
npm run dev
```

To build the Windows installer:

```cmd
npm run build:win
```

### Self-hosting the web version with Docker

The [Dockerfile](Dockerfile) builds a standalone container running the web version's Express server (the same one deployed on Render), with `ffmpeg` and `yt-dlp` installed automatically:

```bash
docker build -t internet-download-hub .
docker run -p 3001:3001 internet-download-hub
```

This is an alternative to the hosted [web app](https://internet-download-hub.onrender.com/) for self-hosting; it is not used by the project's own CI/CD or deployments.

## Releasing

`package.json` is the single source of truth for the version. Everything else is
derived from it or from the published GitHub Release, so no version number is
ever typed twice.

To cut a release:

1. Move the `## [Unreleased]` entries in [CHANGELOG.md](./CHANGELOG.md) under a
   new `## [X.Y.Z] - YYYY-MM-DD` heading.
2. Bump `version` in `package.json` to the same `X.Y.Z`.
3. Commit, then push the matching tag:

```cmd
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag push runs [`.github/workflows/release.yml`](.github/workflows/release.yml),
which:

- refuses to continue if the tag and `package.json` disagree, or if
  `CHANGELOG.md` has no section for that version;
- builds the release notes from that CHANGELOG section
  (`scripts/release-notes.ts`), with GitHub's generated commit list appended;
- downloads and verifies every bundled engine, builds the installer, and
  attaches it to the GitHub Release;
- redeploys the GitHub Pages site as its final step.

Nothing after step 3 is manual. The badges above read the current version and
the total download count from the GitHub API, and the download page reads the
version, the installer link and the changelog from the same place, so both
update on their own once the release is published.

A tag-push convention is used rather than `semantic-release` because releases
here are cut deliberately, the installer build is the slow and failure-prone
part of the pipeline, and the CHANGELOG is written for people rather than
derived from commit subjects. Automating the version bump would not remove a
step; it would only move where the version is decided.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute.

## Support

If you find this app useful please consider sharing it with others. The
[download page](https://isaac-onyango-dev.github.io/Internet-Download-Hub/) has
share links, and bugs belong in the [issue tracker](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/issues).

## End-user agreement (EULA)

**Internet Download Hub is intended for adults only** (18+, or the age of majority where you live, whichever is greater). By installing or using the app you agree to the [EULA.txt](./EULA.txt). The Windows installer shows this text before installation.

## License

The **source code** is licensed under the MIT License — see [LICENSE](./LICENSE) for details. The EULA governs **use** of the distributed application; the MIT license governs the **software** as a project.
