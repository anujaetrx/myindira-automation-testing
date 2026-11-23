import path from 'node:path';
import { env } from '@config/environment';

export const loggerConfig = {
  level: env.logLevel,
  logDir: path.resolve(__dirname, '..', '..', '..', 'artifacts', 'logs'),
  fileName: 'run.log',
} as const;
