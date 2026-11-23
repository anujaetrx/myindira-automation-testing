import type { Role } from '@config/environment';
import type { AuthResult } from '../types';
import type { IAuthStrategy } from './IAuthStrategy';

/**
 * Placeholder for OTP-based login. Implement once the OTP source is known
 * (test-mode static OTP, mailbox API, or authenticator seed). Adding it requires
 * no change to AuthManager beyond selecting it.
 */
export class OtpStrategy implements IAuthStrategy {
  readonly name = 'otp';

  async authenticate(_role: Role): Promise<AuthResult> {
    throw new Error('OtpStrategy is not implemented yet.');
  }
}
