import log from 'electron-log';

export const logger = {
  info: (message: string, ...args: any[]) => {
    log.info(message, ...args);
  },
  error: (message: string, error?: Error | any) => {
    log.error(message, error);
  },
  warn: (message: string, ...args: any[]) => {
    log.warn(message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      log.debug(message, ...args);
    }
  }
};
