import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'reports/**', 'artifacts/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'page',
          property: 'waitForTimeout',
          message: 'Hard waits are flaky. Use web-first assertions or auto-waiting locators.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Playwright fixtures require a destructuring pattern even when nothing is used.
    files: ['src/fixtures/**/*.ts'],
    rules: { 'no-empty-pattern': 'off' },
  },
  {
    // Specs must go through page objects, not raw locators.
    files: ['tests/e2e/**/*.ts', 'tests/smoke/**/*.ts', 'tests/regression/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='page'][callee.property.name='locator']",
          message: 'Use page objects/components instead of page.locator() in specs.',
        },
      ],
    },
  },
);
