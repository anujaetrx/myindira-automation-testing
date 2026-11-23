import type { Role } from '@config/environment';

export interface HeaderContext {
  role: Role;
  localStorage: Record<string, string>;
  sessionStorage?: Record<string, string>;
}

const PLACEHOLDER = /\$\{(ls|ss):([^}]+)\}|\$\{role\}/g;

/** Reads `key` or `key.path.to.field` (when the stored value is JSON) out of a storage map. */
function lookup(store: Record<string, string> | undefined, expr: string, source: string): string {
  const [key, ...path] = expr.split('.');
  const raw = store?.[key];
  if (raw === undefined) throw new Error(`API auth header placeholder \${${source}:${expr}}: "${key}" is not in the saved session's ${source === 'ls' ? 'localStorage' : 'sessionStorage'}`);
  if (path.length === 0) return raw;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`API auth header placeholder \${${source}:${expr}}: "${key}" is not JSON, so "${path.join('.')}" cannot be read`);
  }
  for (const part of path) value = (value as Record<string, unknown> | null)?.[part];
  if (value === undefined || value === null) throw new Error(`API auth header placeholder \${${source}:${expr}}: field "${path.join('.')}" not found`);
  return String(value);
}

/**
 * Builds the headers the app sends with every API call, from a template (AUTH_API_HEADERS) and the
 * saved session. Nothing secret is stored in config: only WHERE to read each value from.
 *
 *   ${ls:sso_token}                  localStorage item
 *   ${ls:user_profile.officialEmail} field inside a JSON localStorage item
 *   ${ss:sessionId}                  sessionStorage item
 *   ${role}                          the framework role (admin, user)
 */
export const ApiAuthHeaders = {
  resolve(template: Record<string, string>, ctx: HeaderContext): Record<string, string> {
    return Object.fromEntries(
      Object.entries(template).map(([header, value]) => [
        header,
        value.replace(PLACEHOLDER, (match, source: string | undefined, expr: string | undefined) => {
          if (match === '${role}') return ctx.role;
          return lookup(source === 'ls' ? ctx.localStorage : ctx.sessionStorage, expr as string, source as string);
        }),
      ]),
    );
  },
};
