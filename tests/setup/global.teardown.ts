import { test as teardown } from '@playwright/test';
import { env } from '@config/environment';
import { SessionStore } from '@auth/SessionStore';

teardown('discard CI sessions', async () => {
  // Locally we keep sessions to speed up the next run (they are re-validated on every use).
  // CI runners are ephemeral, but clearing keeps shared self-hosted runners clean.
  if (env.isCI) new SessionStore().deleteAll();
});
