# Web Version Documentation

The web version of Internet Download Hub is a **zero-installation, browser-based downloader** that works instantly in any modern browser. No signup required, no plugins needed.

## Quick Start

1. **Visit**: https://isaac-onyango-dev.github.io/Internet-Download-Hub/web/
2. **Paste**: A URL (YouTube, TikTok, Twitter, Instagram, Reddit, etc.)
3. **Download**: Select quality and click download
4. **Save**: File appears in your browser's Downloads folder

## Supported Sites

- ✅ YouTube (videos, playlists, shorts)
- ✅ TikTok
- ✅ Instagram
- ✅ Twitter/X
- ✅ Reddit
- ✅ Snapchat
- ✅ Pinterest
- ✅ Tumblr
- ✅ And 40+ more sites!

[Full list of supported sites →](https://instances.cobalt.best/)

## User Interface

### Main Download Area
- **URL Input**: Paste any video link and click "Get Info"
- **Video Preview**: Shows title and thumbnail
- **Quality Selector**: Choose download quality (1080p, 720p, or audio-only MP3)
- **Download Button**: One-click download to browser's Downloads folder

### Download History
- **Recent Downloads**: Lists your last 10 downloads with timestamps
- **Clear History**: Remove the list (doesn't delete files)
- **Quick Reference**: See what you've downloaded recently

### Information Panels
- **Web Version Info**: Explains browser-based downloading
- **Browser Support**: Shows which browsers work best
- **Feature Comparison**: Web vs Desktop version differences
- **Download Desktop Version**: Link to full desktop application

## How It Works

### Technical Architecture
- **Frontend**: React app hosted on GitHub Pages (no backend needed)
- **API**: Cobalt API instances for video extraction
- **Authentication**: Backend proxy handles JWT auth for security
- **Downloads**: Direct browser downloads (no server intermediary)
- **History**: Stored locally in browser (localStorage, not cloud)

### Downloading
1. Paste a video URL (e.g., YouTube, TikTok)
2. Click **"Get Info"** - app fetches video details
3. Select quality (video/audio quality options appear)
4. Click **"Download to Browser"**
5. File downloads directly to your browser's default Downloads folder

### Quality Options
- **Best Video (1080p)**: High-quality MP4 video
- **Standard Quality (720p)**: Balanced quality/size MP4 video
- **Audio Only (MP3)**: Just the audio as MP3

### Browser Download Behavior
- ✅ Files go to your configured Downloads folder
- ✅ Browser handles the download normally
- ✅ File can be found in your Downloads folder after
- ⚠️ Large files may take time to download
- ⚠️ Downloads are not recoverable if browser is closed prematurely

## Web vs Desktop Version

| Feature | Web | Desktop |
|---------|-----|---------|
| **Installation** | ✅ None (instant) | ❌ Need to download exe |
| **Ease of Use** | ✅ One-click | ✅ One-click (more features) |
| **Supported Sites** | ✅ 50+ sites | ✅ 1000+ sites |
| **Batch Download** | ❌ One URL at a time | ✅ Multiple URLs together |
| **Video Formats** | ✅ MP4/MP3 | ✅ MP4/MP3/WAV/MKV/AVI/etc. |
| **MP3 Extraction** | ✅ Audio only | ✅ Extract audio from video |
| **Playlist Support** | ❌ Individual videos only | ✅ Download entire playlists |
| **Pause/Resume** | ❌ N/A - browser download | ✅ Full download control |
| **History** | ✅ Recently downloaded (10) | ✅ Full download history |
| **Offline Use** | ❌ Needs internet | ✅ Works offline (cached) |

**Bottom Line**: Use the **web version** for quick one-off downloads. Use the **desktop version** for serious downloading, playlists, and format conversion.

## Browser Requirements

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Chromium | ✅ Full | Best performance, most tested |
| Firefox | ✅ Full | Great compatibility |
| Safari (Mac/iOS) | ✅ Full | Works great on Mac |
| Edge | ✅ Full | Based on Chromium |
| Mobile Safari (iOS) | ⚠️ Limited | Downloads go to Files app |
| Chrome Mobile | ⚠️ Limited | May need manual save |

**Best Experience**: Use on desktop with Chrome or Firefox.

## Download Locations

### Windows
- Default: `C:\Users\YourName\Downloads\`
- Can be changed in browser settings

### macOS
- Default: `~/Downloads/`
- Can be changed in browser preferences

### Linux
- Default: Home directory or `~/Downloads/`
- Browser-dependent

### iOS (Safari)
- Files → Downloads folder
- Or iCloud Drive if configured

### Android (Chrome)
- Usually internal storage or microSD card
- Check browser settings for exact location

## Troubleshooting

### "Could not reach any download service"
- **Cause**: API is temporarily down or URL not supported
- **Fix**: Wait a moment and try again, or check if site is supported

### Download not starting
- **Cause**: Browser download settings or file size too large
- **Fix**: Check browser download settings or try smaller file

### File appears with strange name
- **Cause**: Website doesn't provide metadata
- **Fix**: Rename after download

### Video not found
- **Cause**: Video is private, deleted, or unsupported site
- **Fix**: Try a different video or check if site is supported

### Out of storage
- **Cause**: Downloads folder/disk is full
- **Fix**: Delete old files to make space

## Keyboard Shortcuts

- **Enter** in URL input: Fetch video info
- **Escape**: Clear or close dialogs
- **Ctrl+A**: Select all (in URL field)

## Privacy & Security

### What We Collect
- ❌ We don't collect any personal data
- ❌ We don't track you
- ❌ We don't store download history on our servers
- ℹ️ Download history is stored **only in your browser** (localStorage)

### How It's Secure
- ✅ All requests go through secure HTTPS
- ✅ No account needed
- ✅ No passwords required
- ✅ Open source code available for inspection

### Data Storage
- **Download History**: Stored in browser localStorage (up to 10 recent downloads)
- **Settings**: Stored in browser localStorage (theme, preferences)
- **Browsing**: Not tracked or logged anywhere on our servers
- **Clear Everything**: Clear browser data and all app data is removed

## Tips & Tricks

### Manual Batch Downloading
1. Paste first URL, download
2. Paste second URL, download
3. Continue as needed

### Fastest Download
1. Use **1080p Video** for fastest MP4
2. Use **MP3** for audio (fastest audio-only)
3. Browser download speed depends on internet connection

### Finding Downloads
- **Windows**: Press `Win + E`, go to Downloads folder
- **macOS**: Click Finder → Downloads
- **Linux**: Open file manager, go to Downloads
- **All**: Many browsers show download history with `Ctrl+J`

### Playlist Workaround
- Copy each video URL one at a time
- Web version downloads one video per request
- For playlists, use the **Desktop Version** instead

### Storage Issues
- Large videos can be 500MB - 1GB+ each
- Make sure you have enough disk space
- Delete old downloads to free up space

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/issues)
- **Questions**: [GitHub Discussions](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/discussions)
- **Desktop App**: [Download Latest Release](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest)

## What's New (Web Version)

### Recent Updates
- ✨ **Redesigned Browser UI** - Optimized for web downloads (no fake queue)
- ✨ **Download History** - Track recent downloads in localStorage
- ✨ **Backend Proxy** - Secure API authentication for web clients
- ✨ **Better Error Messages** - Clear feedback on what went wrong
- ✨ **Simple Quality Selection** - Just pick 1080p, 720p, or audio
- ✨ **Browser-Appropriate UX** - Direct downloads, not desktop metaphors

### Coming Soon
- 🔜 Advanced format selection
- 🔜 Subtitle downloads
- 🔜 Direct browser player
- 🔜 More keyboard shortcuts
- 🔜 Theme customization options

## Share This

Love the web version? Share it!
- 📱 Social media: Tweet about us
- 👨‍💻 Tell developers: Mention in projects
- ⭐ GitHub: Star the repository
- 🐛 Report issues: Help us improve

**Direct link to web version**: [https://isaac-onyango-dev.github.io/Internet-Download-Hub/web/](https://isaac-onyango-dev.github.io/Internet-Download-Hub/web/)

## About

- **Source Code** — [GitHub](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub)
- **License** — MIT (completely free to use, modify, and share)
- **Author** — [Isaac Onyango](https://github.com/Isaac-Onyango-Dev)
- **Backend** — [Cobalt API](https://github.com/imputnet/cobalt)

---

**Want more features?** Download the [Desktop Version](https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest) for unlimited sites and advanced features.
