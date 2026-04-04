# Internet Download Hub — Web Version

A completely free, browser-based video downloader. No installation, no account required.

## Quick Start

1. Open https://isaac-onyango-dev.github.io/Internet-Download-Hub/web/
2. Paste a video URL
3. Select quality
4. Download starts immediately

## Supported Platforms

The web version uses the **Cobalt API** and supports:

- ✅ **YouTube** — Videos, Shorts, Playlists
- ✅ **Social Media** — TikTok, Twitter/X, Instagram, Reddit, Facebook
- ✅ **Video Sites** — Vimeo, Dailymotion, Bilibili, niconico
- ✅ **Streaming** — Twitch clips, Kick, Rumble
- ✅ **Image Boards** — Pixiv, DeviantArt, ArtStation, Flickr
- ✅ **And More** — 50+ additional platforms

**Note:** The web version supports fewer sites than the desktop app (1000+). For extensive platform support, download the [**Desktop Version**](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest).

## Features

- 🌐 **Browser-Based** — Works on Windows, Mac, Linux, and mobile browsers
- ⚡ **Fast** — Single downloads with instant streaming playback support
- 📱 **Responsive** — Optimized for desktop and mobile
- 🔒 **Private** — All processing done locally, no data stored
- 💾 **Download** — Direct browser downloads to your machine
- 🎨 **Multiple Qualities** — Choose from available video resolutions

## Limitations

| Feature | Web | Desktop |
|---------|-----|---------|
| Sites Supported | 50+ (Cobalt API) | 1000+ (yt-dlp) |
| Download History | ❌ Not persistent | ✅ Yes |
| Playlist Batch Downloads | ❌ Single videos only | ✅ Yes |
| Format Conversion | ❌ Basic | ✅ Full (MP3, OPUS, etc.) |
| Parallel Downloads | ❌ Single | ✅ Multiple |
| Pause/Resume | ❌ No | ✅ Yes |
| Video Extraction | ❌ No | ✅ Yes (MP3, audio) |
| Settings Storage | ⚠️ Browser localStorage | ✅ App folder |

## How It Works

1. **Frontend** — React app hosted on GitHub Pages (`/web/`)
2. **Backend** — Community-run Cobalt API instances handle extraction
3. **Processing** — No server logs kept; completely stateless
4. **Download** — Files stream directly to your browser's download folder

The web app is **fully static** and doesn't require our own backend servers.

## Troubleshooting

### "This URL is not supported"
The Cobalt API doesn't support that website. Try:
- The **Desktop Version** (supports 1000+ sites)
- A different video from the same site
- Copy the exact link from the address bar

### Video won't download
- Check your internet connection
- Try refreshing the page
- The Cobalt service may be temporarily unavailable — wait a few minutes
- Try the **Desktop Version** if issues persist

### Mobile/tablet issues
- The web app is responsive but works best on desktop
- Browser download restrictions may apply on some devices
- Consider using the **Desktop Version** for best experience

## Desktop Version

For advanced features, download the full desktop application:

**[Download Desktop Version](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest)**

The desktop app includes:
- 1000+ sites via yt-dlp
- Playlist batch downloads
- Format conversion (MP3, OPUS, etc.)
- Parallel downloads
- Pause/resume functionality
- Complete download history
- No internet service dependencies

## About

- **Source Code** — [GitHub](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub)
- **License** — MIT (completely free to use, modify, and share)
- **Author** — [Isaac Onyango](https://github.com/Isaac-Onyango-Dev)
- **Backend** — [Cobalt API](https://github.com/imputnet/cobalt)

## Privacy

The web version:
- ✅ Operates entirely in your browser
- ✅ No data is sent to our servers
- ✅ Cobalt API may log requests (check their privacy policy)
- ✅ No tracking or analytics

## Feedback & Support

Found a bug? Have suggestions? Open an issue on [GitHub](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/issues).

---

**Want the full experience?** Download the [Desktop Version](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest) for unlimited sites and advanced features.
