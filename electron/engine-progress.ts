import type { Engine } from './url-analyser';

/** What a non-yt-dlp engine reports about a running download. */
export interface EngineProgress {
  /** Absent when the engine cannot know the total, e.g. a live stream. */
  percent?: number;
  size: string;
  speed: string;
  /** HH:MM:SS, or '' when unknown. */
  eta: string;
}

// "[download] Written 17.63 MiB to C:\…\clip.ts (4s @ 8.70 MiB/s)" (--progress=force)
const STREAMLINK = /^\[download\] Written (\S+ \S+) to .*\(\S+?(?: @ (\S+ \S+))?\)$/;

// 0.5: "Vid 1920x1080 | 6221 Kbps ━━  8/64 12.50% 88.37MB/706.98MB 4.34MBps 00:02:46"
// 0.6: "Vid 1920x1080 | 6221 Kbps  1/64 1.56% 5.84MB/373.72MB3.43MBps00:01:26" (no spaces)
// Before the first segment lands the sizes read "-" and the ETA "--:--:--".
const SIZE = String.raw`[\d.]+[KMGT]?i?B`;
const NM3U8DL = new RegExp(
  String.raw`\d+\/\d+\s+([\d.]+)%\s*(?:(${SIZE})\/(${SIZE})|-)\s*(${SIZE}ps)\s*(\d+:\d+:\d+|--:--:--)`,
);

/**
 * N_m3u8DL-RE 0.6 prints its log lines and progress records without line breaks when its
 * output is piped. This puts a break before each, so the line-based parser can read them.
 */
export function splitNm3u8dlOutput(text: string): string {
  return text.replace(
    /(?<=[^\n])(?=\d{2}:\d{2}:\d{2}\.\d{3} [A-Z]+\s*:|(?:Vid|Aud|Sub) [^|\n]*\|)/g,
    '\n',
  );
}

/**
 * Parses one output line from streamlink or N_m3u8DL-RE.
 * yt-dlp keeps its own parser in main.ts; gallery-dl prints one path per saved file.
 */
export function parseEngineProgress(engine: Engine, line: string): EngineProgress | null {
  if (engine === 'streamlink') {
    const m = STREAMLINK.exec(line);
    return m ? { size: `${m[1]} written`, speed: m[2] ?? '', eta: '' } : null;
  }
  if (engine === 'n-m3u8dl') {
    // ponytail: with several tracks selected the lines interleave, so the bar follows
    // whichever track printed last; per-track aggregation if that proves confusing.
    const m = NM3U8DL.exec(line);
    if (!m) return null;
    return {
      percent: parseFloat(m[1]),
      size: m[3] ? `${m[2]} of ${m[3]}` : '',
      speed: m[4].replace(/ps$/, '/s'),
      eta: /^\d+:\d+:\d+$/.test(m[5]) ? m[5] : '',
    };
  }
  return null;
}
