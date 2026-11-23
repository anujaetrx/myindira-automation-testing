import type { ReporterDescription } from '@playwright/test';
import { env } from './environment';

/** Locally: readable console + HTML. In CI: add Allure, JUnit and JSON for tooling. */
export const reporters: ReporterDescription[] = env.isCI
  ? [
      ['github'],
      ['html', { outputFolder: 'reports/html', open: 'never' }],
      ['allure-playwright', { resultsDir: 'reports/allure-results' }],
      ['junit', { outputFile: 'reports/junit/results.xml' }],
      ['json', { outputFile: 'reports/json/results.json' }],
    ]
  : [
      ['list'],
      ['html', { outputFolder: 'reports/html', open: 'never' }],
      ['allure-playwright', { resultsDir: 'reports/allure-results' }],
    ];
