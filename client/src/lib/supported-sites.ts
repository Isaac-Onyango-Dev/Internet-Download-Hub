/**
 * Supported Sites Database
 * Categorized list of all supported sites and their download engines
 */

export interface SupportedSite {
  name: string;
  url: string;
  engines: Engine[];
  notes?: string;
}

export type Engine = 'yt-dlp' | 'streamlink' | 'gallery-dl' | 'N_m3u8DL-RE';

export interface SiteCategory {
  category: string;
  icon: string;
  sites: SupportedSite[];
}

export const SUPPORTED_SITES: SiteCategory[] = [
  {
    category: 'Video Platforms',
    icon: '🎬',
    sites: [
      { name: 'YouTube', url: 'youtube.com', engines: ['yt-dlp'], notes: 'Includes YouTube Music, YouTube Gaming' },
      { name: 'Vimeo', url: 'vimeo.com', engines: ['yt-dlp'] },
      { name: 'Dailymotion', url: 'dailymotion.com', engines: ['yt-dlp', 'streamlink'] },
      { name: 'Facebook', url: 'facebook.com', engines: ['yt-dlp'] },
      { name: 'Instagram', url: 'instagram.com', engines: ['yt-dlp'] },
      { name: 'Twitter / X', url: 'twitter.com, x.com', engines: ['yt-dlp'] },
      { name: 'Reddit', url: 'reddit.com', engines: ['yt-dlp'] },
      { name: 'TikTok', url: 'tiktok.com', engines: ['yt-dlp'] },
      { name: 'Bilibili', url: 'bilibili.com', engines: ['yt-dlp'] },
      { name: 'Rumble', url: 'rumble.com', engines: ['yt-dlp', 'streamlink'] },
      { name: 'Odysee', url: 'odysee.com', engines: ['yt-dlp'] },
      { name: 'PeerTube', url: 'instances.joinpeertube.org', engines: ['yt-dlp'], notes: 'All PeerTube instances' },
    ],
  },
  {
    category: 'Live Streaming',
    icon: '📡',
    sites: [
      { name: 'Twitch', url: 'twitch.tv', engines: ['yt-dlp', 'streamlink'] },
      { name: 'Kick', url: 'kick.com', engines: ['yt-dlp', 'streamlink'] },
      { name: 'Trovo', url: 'trovo.live', engines: ['streamlink'] },
      { name: 'VK Live', url: 'vk.com', engines: ['yt-dlp', 'streamlink'] },
    ],
  },
  {
    category: 'Anime & Streaming',
    icon: '🎌',
    sites: [
      { name: 'Crunchyroll', url: 'crunchyroll.com', engines: ['yt-dlp'], notes: 'Requires cookies for premium content' },
      { name: 'Funimation', url: 'funimation.com', engines: ['yt-dlp'] },
      { name: 'niconico', url: 'nicovideo.jp', engines: ['yt-dlp'] },
      { name: 'VRV', url: 'vrv.co', engines: ['yt-dlp'] },
    ],
  },
  {
    category: 'Social Media',
    icon: '💬',
    sites: [
      { name: 'Tumblr', url: 'tumblr.com', engines: ['yt-dlp'] },
      { name: 'Pinterest', url: 'pinterest.com', engines: ['yt-dlp'] },
      { name: 'Snapchat', url: 'snapchat.com', engines: ['yt-dlp'] },
      { name: 'Threads', url: 'threads.net', engines: ['yt-dlp'] },
      { name: 'Mastodon', url: 'mastodon.social', engines: ['yt-dlp'], notes: 'Most Mastodon instances' },
    ],
  },
  {
    category: 'Image Boards & Galleries',
    icon: '🖼️',
    sites: [
      { name: 'Pixiv', url: 'pixiv.net', engines: ['gallery-dl'] },
      { name: 'DeviantArt', url: 'deviantart.com', engines: ['gallery-dl'] },
      { name: 'ArtStation', url: 'artstation.com', engines: ['gallery-dl'] },
      { name: 'Flickr', url: 'flickr.com', engines: ['gallery-dl', 'yt-dlp'] },
      { name: 'Imgur', url: 'imgur.com', engines: ['gallery-dl'] },
      { name: 'Instagram (Images)', url: 'instagram.com', engines: ['gallery-dl'] },
      { name: 'Twitter (Images)', url: 'twitter.com', engines: ['gallery-dl'] },
      { name: 'Reddit (Images)', url: 'reddit.com', engines: ['gallery-dl'] },
    ],
  },
  {
    category: 'Music Platforms',
    icon: '🎵',
    sites: [
      { name: 'SoundCloud', url: 'soundcloud.com', engines: ['yt-dlp'] },
      { name: 'Spotify', url: 'spotify.com', engines: ['yt-dlp'], notes: 'Limited support' },
      { name: 'Bandcamp', url: 'bandcamp.com', engines: ['yt-dlp'] },
      { name: 'Mixcloud', url: 'mixcloud.com', engines: ['yt-dlp'] },
    ],
  },
  {
    category: 'HLS / M3U8 Streams',
    icon: '📺',
    sites: [
      { name: 'Custom HLS Streams', url: '*.m3u8 URLs', engines: ['N_m3u8DL-RE'], notes: 'Any m3u8 stream URL' },
      { name: 'IPTV Streams', url: 'Various', engines: ['N_m3u8DL-RE', 'streamlink'] },
    ],
  },
  {
    category: 'Educational & Courses',
    icon: '📚',
    sites: [
      { name: 'Udemy', url: 'udemy.com', engines: ['yt-dlp'], notes: 'Requires cookies for enrolled courses' },
      { name: 'Skillshare', url: 'skillshare.com', engines: ['yt-dlp'] },
      { name: 'Coursera', url: 'coursera.org', engines: ['yt-dlp'], notes: 'Limited support' },
      { name: 'TED', url: 'ted.com', engines: ['yt-dlp'] },
    ],
  },
  {
    category: 'News & Media',
    icon: '📰',
    sites: [
      { name: 'CNN', url: 'cnn.com', engines: ['yt-dlp'] },
      { name: 'NBC News', url: 'nbcnews.com', engines: ['yt-dlp'] },
      { name: 'Fox News', url: 'foxnews.com', engines: ['yt-dlp'] },
      { name: 'BBC', url: 'bbc.com', engines: ['yt-dlp'] },
      { name: 'CBS News', url: 'cbsnews.com', engines: ['yt-dlp'] },
    ],
  },
];

/**
 * The web version runs yt-dlp alone on a shared cloud server, and some sites refuse
 * cloud IPs outright. This list holds only sites whose public links worked through
 * the live server when checked on 2026-09-17; re-check it before adding to it.
 */
export const WEB_SUPPORTED_SITES: SiteCategory[] = [
  {
    category: 'Video & Social',
    icon: '🎬',
    sites: [
      { name: 'TikTok', url: 'tiktok.com', engines: ['yt-dlp'] },
      { name: 'Twitter / X', url: 'twitter.com, x.com', engines: ['yt-dlp'] },
      { name: 'Instagram', url: 'instagram.com', engines: ['yt-dlp'], notes: 'Public posts only' },
      { name: 'Facebook', url: 'facebook.com', engines: ['yt-dlp'], notes: 'Public videos only' },
      { name: 'Reddit', url: 'reddit.com', engines: ['yt-dlp'] },
      { name: 'Pinterest', url: 'pinterest.com', engines: ['yt-dlp'] },
      { name: 'Imgur', url: 'imgur.com', engines: ['yt-dlp'] },
      { name: 'Vimeo', url: 'player.vimeo.com', engines: ['yt-dlp'], notes: 'Player (embed) links only' },
      { name: 'Streamable', url: 'streamable.com', engines: ['yt-dlp'] },
      { name: 'Loom', url: 'loom.com', engines: ['yt-dlp'] },
      { name: 'Bilibili', url: 'bilibili.com', engines: ['yt-dlp'] },
      { name: 'niconico', url: 'nicovideo.jp', engines: ['yt-dlp'] },
      { name: 'VK', url: 'vk.com', engines: ['yt-dlp'] },
      { name: 'PeerTube', url: 'framatube.org and other instances', engines: ['yt-dlp'] },
      { name: 'Internet Archive', url: 'archive.org', engines: ['yt-dlp'] },
    ],
  },
  {
    category: 'Streaming Clips',
    icon: '📡',
    sites: [
      { name: 'Twitch', url: 'twitch.tv', engines: ['yt-dlp'], notes: 'Clips' },
      { name: 'Kick', url: 'kick.com', engines: ['yt-dlp'], notes: 'Clips' },
    ],
  },
  {
    category: 'Music',
    icon: '🎵',
    sites: [
      { name: 'SoundCloud', url: 'soundcloud.com', engines: ['yt-dlp'] },
      { name: 'Bandcamp', url: 'bandcamp.com', engines: ['yt-dlp'] },
    ],
  },
];

/** Sites that turn away every request from the web server, by the hosts they use. */
const WEB_BLOCKED_SITES = [{ name: 'YouTube', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] }];

/** The site's name when the web version cannot download from this link. */
export function webBlockedSite(url: string): string | null {
  const host = new URL(url).hostname.toLowerCase();
  const site = WEB_BLOCKED_SITES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return site?.name ?? null;
}

/**
 * Get all unique engines used across all sites
 */
export function getUniqueEngines(): Engine[] {
  const engines = new Set<Engine>();
  SUPPORTED_SITES.forEach((cat) =>
    cat.sites.forEach((site) => site.engines.forEach((e) => engines.add(e))),
  );
  return Array.from(engines);
}
