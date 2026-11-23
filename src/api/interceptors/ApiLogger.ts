import type { APIResponse } from '@playwright/test';
import { Logger } from '@utils/logger/Logger';
import { StringHelper } from '@utils/helpers/string.helper';

/** Logs API traffic with secrets redacted. Playwright has no interceptors, so clients call this explicitly. */
export class ApiLogger {
  private readonly log = Logger.for('API');

  request(method: string, url: string, body?: unknown): void {
    this.log.debug(`--> ${method} ${url} ${body ? JSON.stringify(StringHelper.redact(body)) : ''}`);
  }

  response(method: string, url: string, res: APIResponse, ms: number): void {
    this.log.info(`<-- ${method} ${url} ${res.status()} (${ms}ms)`);
  }
}
