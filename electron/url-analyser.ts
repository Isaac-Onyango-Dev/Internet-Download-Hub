export type Engine = 'yt-dlp' | 'streamlink' | 'n-m3u8dl' | 'gallery-dl' | 'playwright';

export interface AnalysisResult {
  engineOrder: Engine[];
  isPlaylist: boolean;
}

// Helper function for proper domain matching (prevents fakeyoutube.com matching youtube.com)
function matchesDomain(host: string, domains: string[]): boolean {
  for (const domain of domains) {
    if (domain.includes('/')) {
      // Handle path-based matching (e.g., 'youtube.com/live')
      const [domainPart] = domain.split('/');
      if (host === domainPart || host.endsWith('.' + domainPart)) {
        return true;
      }
    } else {
      // Exact match or subdomain match
      if (host === domain || host.endsWith('.' + domain)) {
        return true;
      }
    }
  }
  return false;
}

const YTDLP_NATIVE = [
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'vimeo.com',
  'reddit.com',
  'dailymotion.com',
  'vk.com',
  'twitch.tv',
  'vlive.tv',
  'bilibili.com',
  'nicovideo.jp',
  'rumble.com',
  'bitchute.com',
  'brightcove.com',
  'odysee.com',
  'peer-tube.org',
];

const ANIME_STREAMING = [
  'crunchyroll.com',
  'funimation.com',
  'hidive.com',
  'vrv.co',
  'animelab.com',
  'anime-planet.com',
  'gogoanime.vc',
  '9anime.to',
  'kissanime.ru',
  'viz.com',
];

const GALLERY_DL_NATIVE = [
  'deviantart.com',
  'pixiv.net',
  'artstation.com',
  'flickr.com',
  'imgur.com',
  'pinterest.com',
  'tumblr.com',
  'danbooru.donmai.us',
  'gelbooru.com',
  'yande.re',
];

const STREAMLINK_NATIVE = [
  'twitch.tv',
  'kick.com',
  'trovo.live',
  'afreecatv.com',
  'dlive.tv',
  'mixer.com',
  'bigo.tv',
  'nonolive.com',
  'spooncast.net',
];

export function analyseUrl(url: string): AnalysisResult {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    let engineOrder: Engine[] = ['yt-dlp', 'playwright'];

    if (matchesDomain(host, YTDLP_NATIVE)) {
      engineOrder = ['yt-dlp', 'playwright'];
    } else if (matchesDomain(host, ANIME_STREAMING)) {
      engineOrder = ['n-m3u8dl', 'yt-dlp', 'playwright'];
    } else if (matchesDomain(host, GALLERY_DL_NATIVE)) {
      engineOrder = ['gallery-dl', 'yt-dlp', 'playwright'];
    } else if (matchesDomain(host, STREAMLINK_NATIVE)) {
      engineOrder = ['streamlink', 'yt-dlp', 'playwright'];
    }

    return {
      engineOrder,
      isPlaylist: parsed.searchParams.has('list'),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('valid URL')) throw error;
    throw new Error('Please enter a valid URL');
  }
}
