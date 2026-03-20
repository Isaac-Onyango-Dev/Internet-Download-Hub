export type Engine = 'yt-dlp' | 'streamlink' | 'n-m3u8dl' | 'gallery-dl' | 'playwright';

export interface AnalysisResult {
  engineOrder: Engine[];
  isPlaylist: boolean;
}

const YTDLP_NATIVE = [
  'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com',
  'instagram.com', 'facebook.com', 'vimeo.com', 'reddit.com',
  'dailymotion.com', 'vk.com', 'twitch.tv', 'vlive.tv', 'bilibili.com',
  'nicovideo.jp', 'rumble.com', 'bitchute.com', 'brightcove.com',
  'odysee.com', 'peer-tube.org'
];

const ANIME_STREAMING = [
  'crunchyroll.com', 'funimation.com', 'hidive.com', 'vrv.co',
  'animelab.com', 'anime-planet.com', 'gogoanime.vc', '9anime.to',
  'kissanime.ru', 'viz.com'
];

const GALLERY_DL_NATIVE = [
  'deviantart.com', 'pixiv.net', 'artstation.com', 'flickr.com',
  'imgur.com', 'pinterest.com', 'tumblr.com', 'danbooru.donmai.us',
  'gelbooru.com', 'yande.re'
];

const STREAMLINK_NATIVE = [
  'twitch.tv', 'youtube.com/live', 'kick.com', 'trovo.live',
  'afreecatv.com', 'dlive.tv', 'mixer.com', 'bigo.tv',
  'nonolive.com', 'spooncast.net'
];

export function analyseUrl(url: string): AnalysisResult {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace('www.', '');
    const path = parsed.pathname.toLowerCase();

    // Check for YouTube Playlist
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (parsed.searchParams.has('list') && !parsed.searchParams.has('v')) {
        throw new Error('YouTube Playlists are not supported directly here. Please use the individual video links.');
      }
    }

    let engineOrder: Engine[] = ['yt-dlp', 'playwright'];

    if (YTDLP_NATIVE.some(h => host.includes(h))) {
      engineOrder = ['yt-dlp', 'playwright'];
    } else if (ANIME_STREAMING.some(h => host.includes(h))) {
      engineOrder = ['n-m3u8dl', 'yt-dlp', 'playwright'];
    } else if (GALLERY_DL_NATIVE.some(h => host.includes(h))) {
      engineOrder = ['gallery-dl', 'yt-dlp', 'playwright'];
    } else if (STREAMLINK_NATIVE.some(h => host.includes(h))) {
      engineOrder = ['streamlink', 'yt-dlp', 'playwright'];
    }

    return {
      engineOrder,
      isPlaylist: parsed.searchParams.has('list')
    };
  } catch (error: any) {
    if (error.message.includes('YouTube Playlists')) throw error;
    throw new Error('Please enter a valid URL');
  }
}
