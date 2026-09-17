// Headless stand-in for electron, electron-log and electron-updater, so the real main
// process can run under plain Node in tests/engines/run.cjs. No window is ever created.
const path = require('path');

const root = process.env.IDH_ENGINES_HOME;
const state = (globalThis.__idh = { handlers: {}, sent: [], logs: [] });

const any = () =>
  new Proxy(function () {}, {
    get: (_, p) => (p === 'then' ? undefined : p === Symbol.toPrimitive ? () => '' : any()),
    set: () => true,
    apply: () => any(),
    construct: () => any(),
  });
const withFallback = (obj) => new Proxy(obj, { get: (t, p) => (p in t ? t[p] : any()) });

const webContents = withFallback({ send: (ch, data) => state.sent.push([ch, data]) });
class BrowserWindow {
  constructor() {
    return withFallback({ webContents, isDestroyed: () => false });
  }
}

const text = (x) =>
  x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x);
const log =
  (level) =>
  (...args) =>
    state.logs.push(`${level} ${args.map(text).join(' ')}`);
const logger = withFallback({
  info: log('I'),
  warn: log('W'),
  error: log('E'),
  debug: () => {},
  transports: any(),
});

module.exports = withFallback({
  default: logger,
  ...logger,
  app: withFallback({
    isPackaged: false,
    getPath: (name) => path.join(root, name),
    getAppPath: () => process.cwd(),
    getVersion: () => '0.0.0-test',
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: () => true,
    on: () => {},
    quit: () => {},
  }),
  ipcMain: withFallback({ handle: (name, fn) => (state.handlers[name] = fn), on: () => {} }),
  BrowserWindow,
  autoUpdater: any(),
  // A bundled `import { Menu } from 'electron'` copies only own keys, so every named import is listed.
  dialog: any(),
  shell: any(),
  Tray: any(),
  Menu: any(),
  nativeImage: any(),
  powerSaveBlocker: any(),
  Notification: any(),
  clipboard: any(),
});
