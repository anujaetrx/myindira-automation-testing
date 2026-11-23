import { hasCredentials, ROLES } from '@config/environment';
import { Logger } from '@utils/logger/Logger';
import { AuthManager } from './AuthManager';

const log = Logger.for('AuthSetup');

/**
 * Authenticates every role that has credentials configured; roles without a test account are skipped
 * with a warning (a spec that needs one fails later with an actionable message). Reuses valid sessions.
 */
export async function authenticateAllRoles(manager = new AuthManager()): Promise<void> {
  for (const role of ROLES) {
    if (!hasCredentials(role)) {
      log.warn(`No credentials for role "${role}": skipped`);
      continue;
    }
    await manager.ensureSession(role);
  }
}
