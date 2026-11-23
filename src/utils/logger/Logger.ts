import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { loggerConfig } from './logger.config';

fs.mkdirSync(loggerConfig.logDir, { recursive: true });

const format = winston.format.printf(({ level, message, timestamp, context }) => {
  const ctx = context ? ` [${String(context)}]` : '';
  return `${String(timestamp)} ${level.toUpperCase().padEnd(5)}${ctx} ${String(message)}`;
});

const root = winston.createLogger({
  level: loggerConfig.level,
  format: winston.format.combine(winston.format.timestamp(), format),
  transports: [
    new winston.transports.Console(),
    // pid in the file name avoids workers clobbering each other
    new winston.transports.File({
      filename: path.join(loggerConfig.logDir, `${process.pid}-${loggerConfig.fileName}`),
    }),
  ],
});

/** Thin wrapper so the rest of the framework never depends on winston directly (DIP). */
export class Logger {
  constructor(private readonly context: string) {}

  static for(context: string): Logger {
    return new Logger(context);
  }

  debug(msg: string): void {
    root.debug(msg, { context: this.context });
  }
  info(msg: string): void {
    root.info(msg, { context: this.context });
  }
  warn(msg: string): void {
    root.warn(msg, { context: this.context });
  }
  error(msg: string): void {
    root.error(msg, { context: this.context });
  }
}
