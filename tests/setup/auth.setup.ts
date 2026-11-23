import { test as setup } from '@playwright/test';
import { authenticateAllRoles } from '@auth/global-setup.auth';

setup('authenticate all roles', async () => {
  await authenticateAllRoles();
});
