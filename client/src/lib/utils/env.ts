/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Detects whether the app is running inside Electron (desktop) or a browser (web).
 *
 * The Electron preload script exposes `window.electronAPI` with a hidden
 * `__isElectron` flag.  In web mode, `main.tsx` injects a stub `electronAPI`
 * that deliberately omits this flag — so the check is unambiguous.
 */
export const isElectron = () => {
  return typeof window !== 'undefined'
    && !!(window as any).electronAPI
    && (window as any).electronAPI.__isElectron === true;
};
