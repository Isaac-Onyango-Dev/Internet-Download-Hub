import log from 'electron-log';

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    log.info(message, ...args);
  },
  error: (message: string, error?: unknown) => {
    log.error(message, error);
  },
  warn: (message: string, ...args: unknown[]) => {
    log.warn(message, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      log.debug(message, ...args);
    }
  },
};
