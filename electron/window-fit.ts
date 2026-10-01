/**
 * Window size and interface zoom, worked out from the display the window
 * opens on.
 *
 * Electron measures in device-independent pixels, so a 1920×1080 panel at
 * Windows' 125% scaling is a 1536×864 screen to the app (about 1536×824 once
 * the taskbar is gone). A fixed 1200×800 window filled almost all of that
 * height and the UI, designed for a bigger canvas, overflowed it. Everything
 * here is pure so it can be tested without Electron.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the user picked under Settings → Interface size. */
export type UiScale = 'auto' | string;

export const MIN_WINDOW_WIDTH = 820;
export const MIN_WINDOW_HEIGHT = 560;

/** The fixed choices offered in Settings, as zoom factors. */
export const UI_SCALE_CHOICES = ['0.9', '1', '1.1', '1.25'] as const;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

/** Auto mode treats this much work-area height as "enough" for the design. */
const AUTO_DESIGN_HEIGHT = 900;
const AUTO_ZOOM_FLOOR = 0.85;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * A first-run window that leaves the desktop visible around it: 78% of the
 * work area's width and 85% of its height, held between the minimum size and
 * a ceiling past which a bigger window only adds empty space. Centred.
 */
export function defaultWindowBounds(workArea: Rect): Rect {
  const width = Math.min(clamp(Math.round(workArea.width * 0.78), 960, 1440), workArea.width);
  const height = Math.min(clamp(Math.round(workArea.height * 0.85), 640, 960), workArea.height);
  return {
    width,
    height,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
  };
}

/**
 * Parses the bounds saved at last close. Anything malformed comes back null
 * so the caller falls back to the screen-sized default.
 */
export function parseSavedBounds(raw: unknown): Rect | null {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const b = JSON.parse(raw);
    const nums = [b?.x, b?.y, b?.width, b?.height];
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    if (b.width < MIN_WINDOW_WIDTH / 2 || b.height < MIN_WINDOW_HEIGHT / 2) return null;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    return null;
  }
}

/**
 * Restores saved bounds only when the window would still be reachable: its
 * title bar has to land on some display's work area. A monitor that was
 * unplugged, or a scale change that shrank the desktop, would otherwise open
 * the window off-screen. Oversized windows are shrunk to fit the display
 * they land on.
 */
export function restoreBounds(saved: Rect | null, workAreas: Rect[]): Rect | null {
  if (!saved || workAreas.length === 0) return null;
  // A 100×32 strip at the top-centre of the window: the part you drag.
  const grip = {
    x: saved.x + saved.width / 2 - 50,
    y: saved.y,
    width: 100,
    height: 32,
  };
  const host = workAreas.find(
    (a) =>
      grip.x < a.x + a.width &&
      grip.x + grip.width > a.x &&
      grip.y >= a.y &&
      grip.y + grip.height <= a.y + a.height,
  );
  if (!host) return null;
  const width = Math.min(saved.width, host.width);
  const height = Math.min(saved.height, host.height);
  return {
    width,
    height,
    x: clamp(saved.x, host.x, host.x + host.width - width),
    y: clamp(saved.y, host.y, host.y + host.height - height),
  };
}

/**
 * Auto zoom: shrink the interface a little on short screens, never enlarge
 * it. 1080p at 125% (≈824px of work area) lands on 0.9; 1080p at 100% and
 * anything taller stays at 1.
 */
export function autoZoomFactor(workAreaHeight: number): number {
  const raw = clamp(workAreaHeight / AUTO_DESIGN_HEIGHT, AUTO_ZOOM_FLOOR, 1);
  // Floor to 0.05 steps so 824/900 = 0.916 becomes 0.9, not 0.95.
  return Math.floor(raw * 20 + 1e-9) / 20;
}

/** Turns the saved `ui_scale` setting into the zoom factor to apply. */
export function resolveZoom(scale: UiScale | null | undefined, workAreaHeight: number): number {
  const n = Number(scale);
  if (scale && scale !== 'auto' && Number.isFinite(n) && n > 0) {
    return clamp(n, ZOOM_MIN, ZOOM_MAX);
  }
  return autoZoomFactor(workAreaHeight);
}

/** Steps the zoom for View → Zoom In / Out, rounded so it never drifts. */
export function stepZoom(current: number, direction: 1 | -1): number {
  return clamp(Math.round((current + direction * 0.1) * 100) / 100, ZOOM_MIN, ZOOM_MAX);
}
