type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, tag: string, message: string, detail?: string) {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}] [${tag}]`;
  if (detail) {
    console[level === 'debug' ? 'log' : level](`${prefix} ${message} — ${detail}`);
  } else {
    console[level === 'debug' ? 'log' : level](`${prefix} ${message}`);
  }
}

export const logger = {
  info: (tag: string, message: string, detail?: string) => write('info', tag, message, detail),
  warn: (tag: string, message: string, detail?: string) => write('warn', tag, message, detail),
  error: (tag: string, message: string, detail?: string) => write('error', tag, message, detail),
  debug: (tag: string, message: string, detail?: string) => write('debug', tag, message, detail),
};
