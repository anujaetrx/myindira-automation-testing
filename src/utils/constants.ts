export const Tags = {
  smoke: '@smoke',
  regression: '@regression',
  pwa: '@pwa',
  api: '@api',
  visual: '@visual',
} as const;

export const HttpStatus = {
  ok: 200,
  created: 201,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
} as const;

/** Header/field names whose values must never be logged. */
export const SENSITIVE_KEYS = ['authorization', 'password', 'token', 'cookie', 'set-cookie'];
