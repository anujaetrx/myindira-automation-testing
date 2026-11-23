import { mergeTests } from '@playwright/test';
import { baseTest } from './base.fixture';
import { pagesTest } from './pages.fixture';
import { adminPagesTest } from './admin-pages.fixture';
import { dataTest } from './data.fixture'; // includes api.fixture, which includes auth.fixture

/** The single entry point for specs: `import { test, expect } from '@fixtures'`. */
export const test = mergeTests(baseTest, pagesTest, adminPagesTest, dataTest);
export { expect } from '@utils/assertions';
