import type { Role } from '@config/environment';
import type { AuthResult } from '../types';

/**
 * Contract for a login mechanism. A strategy only PRODUCES a result (storage state + token);
 * persistence and expiry are handled elsewhere. AuthManager depends on this interface (DIP/OCP).
 */
export interface IAuthStrategy {
  readonly name: string;
  authenticate(role: Role): Promise<AuthResult>;
}
