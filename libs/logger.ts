import type { LogLevel, Logger as SlackLogger } from '@slack/logger';
import pino, { type Logger as PinoLogger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const pinoLogger: PinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'debug',
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
});

function mapToPinoLevel(level: LogLevel | string) {
  const normalized = String(level).toLowerCase();
  switch (normalized) {
    case 'trace':
      return 'trace' as const;
    case 'debug':
      return 'debug' as const;
    case 'info':
      return 'info' as const;
    case 'warn':
    case 'warning':
      return 'warn' as const;
    case 'error':
      return 'error' as const;
    case 'fatal':
      return 'fatal' as const;
    default:
      return 'info' as const;
  }
}

function mapFromPinoLevel(level: string): LogLevel {
  const normalized = String(level).toLowerCase();
  switch (normalized) {
    case 'trace':
      return 'debug' as LogLevel; // closest
    case 'debug':
      return 'debug' as LogLevel;
    case 'info':
      return 'info' as LogLevel;
    case 'warn':
      return 'warn' as LogLevel;
    case 'error':
      return 'error' as LogLevel;
    case 'fatal':
      return 'error' as LogLevel; // closest match in @slack/logger
    default:
      return 'info' as LogLevel;
  }
}

// Slack Bolt expects a logger compatible with @slack/logger
const slackLogger: SlackLogger = {
  // Level controls
  getLevel(): LogLevel {
    return mapFromPinoLevel(pinoLogger.level);
  },
  setLevel(level: LogLevel): void {
    pinoLogger.level = mapToPinoLevel(level);
  },
  setName(_name: string): void {
    // no-op for pino adapter
  },

  // Methods
  debug(...args: unknown[]) {
    pinoLogger.debug(args.length === 1 ? args[0] : args);
  },
  info(...args: unknown[]) {
    pinoLogger.info(args.length === 1 ? args[0] : args);
  },
  warn(...args: unknown[]) {
    pinoLogger.warn(args.length === 1 ? args[0] : args);
  },
  error(...args: unknown[]) {
    pinoLogger.error(args.length === 1 ? args[0] : args);
  },
};

export { pinoLogger };
export default slackLogger;
