import type { Role } from '@config/environment';
import { Logger } from '@utils/logger/Logger';
import type { AuthResult } from '../types';
import type { IAuthStrategy } from './IAuthStrategy';
import { ApiLoginUnsupportedError } from './ApiTokenStrategy';

/**
 * "API-based login where supported": tries the primary strategy and falls back
 * only when it reports the capability is missing. Real failures (bad password) are NOT masked.
 */
export class AutoStrategy implements IAuthStrategy {
  readonly name = 'auto';
  private readonly log = Logger.for('AutoStrategy');

  constructor(
    private readonly primary: IAuthStrategy,
    private readonly fallback: IAuthStrategy,
  ) {}

  async authenticate(role: Role): Promise<AuthResult> {
    try {
      return await this.primary.authenticate(role);
    } catch (error) {
      if (error instanceof ApiLoginUnsupportedError) {
        this.log.warn(`${this.primary.name} login unsupported (HTTP ${error.status}); using ${this.fallback.name}`);
        return this.fallback.authenticate(role);
      }
      throw error;
    }
  }
}
