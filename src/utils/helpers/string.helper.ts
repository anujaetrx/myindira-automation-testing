import { SENSITIVE_KEYS } from '../constants';

export const StringHelper = {
  slugify: (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),

  uniqueSuffix: (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,

  /** Deep-redacts sensitive keys so objects can be logged safely. */
  redact<T>(value: T): T {
    if (Array.isArray(value)) return value.map((v) => StringHelper.redact(v)) as unknown as T;
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          SENSITIVE_KEYS.includes(k.toLowerCase()) ? '***' : StringHelper.redact(v),
        ]),
      ) as T;
    }
    return value;
  },
};
