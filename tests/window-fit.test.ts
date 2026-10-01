import { describe, expect, it } from 'vitest';
import {
  autoZoomFactor,
  defaultWindowBounds,
  parseSavedBounds,
  resolveZoom,
  restoreBounds,
  stepZoom,
} from '../electron/window-fit';

// Work areas in DIPs, taskbar removed.
const FHD_125 = { x: 0, y: 0, width: 1536, height: 824 };
const FHD_100 = { x: 0, y: 0, width: 1920, height: 1032 };
const LAPTOP_125 = { x: 0, y: 0, width: 1093, height: 584 };

describe('defaultWindowBounds', () => {
  it('leaves room around the window at 1080p / 125%', () => {
    const b = defaultWindowBounds(FHD_125);
    expect(b.width).toBe(1198);
    expect(b.height).toBe(700);
    expect(b.x).toBe(169);
    expect(b.y).toBe(62);
  });

  it('never exceeds a small work area', () => {
    const b = defaultWindowBounds(LAPTOP_125);
    expect(b.width).toBeLessThanOrEqual(LAPTOP_125.width);
    expect(b.height).toBeLessThanOrEqual(LAPTOP_125.height);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });

  it('caps the size on large displays', () => {
    const b = defaultWindowBounds({ x: 0, y: 0, width: 3840, height: 2100 });
    expect(b.width).toBe(1440);
    expect(b.height).toBe(960);
  });
});

describe('parseSavedBounds / restoreBounds', () => {
  it('rejects junk', () => {
    expect(parseSavedBounds('')).toBeNull();
    expect(parseSavedBounds('{oops')).toBeNull();
    expect(parseSavedBounds('{"x":0,"y":0,"width":"a","height":1}')).toBeNull();
    expect(parseSavedBounds(null)).toBeNull();
  });

  it('restores a window that is still on screen', () => {
    const saved = parseSavedBounds('{"x":100,"y":50,"width":1100,"height":700}');
    expect(restoreBounds(saved, [FHD_125])).toEqual({ x: 100, y: 50, width: 1100, height: 700 });
  });

  it('drops a window left on a monitor that is gone', () => {
    const saved = { x: 2200, y: 100, width: 1100, height: 700 };
    expect(restoreBounds(saved, [FHD_125])).toBeNull();
  });

  it('finds the window on a second monitor', () => {
    const second = { x: 1536, y: 0, width: 1920, height: 1032 };
    const saved = { x: 1700, y: 80, width: 1200, height: 800 };
    expect(restoreBounds(saved, [FHD_125, second])).toEqual(saved);
  });

  it('shrinks a window saved at 100% that no longer fits at 125%', () => {
    const saved = { x: 0, y: 0, width: 1600, height: 1000 };
    const b = restoreBounds(saved, [FHD_125])!;
    expect(b.width).toBe(1536);
    expect(b.height).toBe(824);
  });
});

describe('zoom', () => {
  it('auto shrinks short screens and leaves tall ones alone', () => {
    expect(autoZoomFactor(FHD_125.height)).toBe(0.9);
    expect(autoZoomFactor(FHD_100.height)).toBe(1);
    expect(autoZoomFactor(2000)).toBe(1);
    expect(autoZoomFactor(400)).toBe(0.85);
  });

  it('resolves fixed and auto settings', () => {
    expect(resolveZoom('auto', 824)).toBe(0.9);
    expect(resolveZoom(undefined, 824)).toBe(0.9);
    expect(resolveZoom('1.1', 824)).toBe(1.1);
    expect(resolveZoom('nonsense', 1032)).toBe(1);
    expect(resolveZoom('9', 1032)).toBe(3);
  });

  it('steps without floating-point drift', () => {
    let z = 1;
    for (let i = 0; i < 3; i++) z = stepZoom(z, 1);
    expect(z).toBe(1.3);
    expect(stepZoom(0.5, -1)).toBe(0.5);
  });
});
