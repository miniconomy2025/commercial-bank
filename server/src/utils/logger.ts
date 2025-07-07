import appConfig from '../config/app.config';

type LogLevel = 'warn' | 'error' | 'debug' | 'info' | 'success';

const colors: Record<LogLevel, string> = {
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[36m',
  info: '\x1b[36m',
};

const reset = '\x1b[0m';

const log = (level: LogLevel, ...args: unknown[]) => {
  if (!appConfig.isDev) return;

  const tag = level.toUpperCase();
  const color = colors[level];

  const prefix = `[${color}${tag}${reset}]`;

  switch (level) {
    case 'info':
      console.log(prefix, ...args);
      break;
    case 'warn':
      console.log(prefix, ...args);
      break;
    case 'error':
      console.log(prefix, ...args);
      break;
    case 'success':
      console.log(`${prefix} \x1b[32m`, ...args, reset);
    case 'debug':
      console.log(prefix, ...args);
      break;
  }
};

export const logger = {
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
  success: (...args: unknown[]) => log('success', ...args),
  debug: (...args: unknown[]) => log('debug', ...args),
};
