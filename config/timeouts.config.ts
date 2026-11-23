/** Central timeouts (ms). No magic numbers elsewhere. */
export const timeouts = {
  test: 60_000,
  expect: 10_000,
  action: 15_000,
  navigation: 30_000,
  api: 30_000,
  serviceWorker: 15_000,
} as const;
