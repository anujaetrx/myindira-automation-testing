import { test, expect } from '@playwright/test';
import { ApiAuthHeaders } from '@auth/ApiAuthHeaders';

const ctx = {
  role: 'admin' as const,
  localStorage: {
    sso_token: 'sso-abc',
    internal_token: 'int-xyz',
    user_profile: JSON.stringify({ officialEmail: 'a@b.test', nested: { role: 'ADMIN' } }),
  },
  sessionStorage: { sessionId: 'sess-1' },
};

test.describe('ApiAuthHeaders', () => {
  test('fills localStorage, JSON-field, sessionStorage and role placeholders', () => {
    const headers = ApiAuthHeaders.resolve(
      {
        Authorization: 'Bearer ${ls:sso_token}',
        'x-auth-token': '${ls:internal_token}',
        email: '${ls:user_profile.officialEmail}',
        nested: '${ls:user_profile.nested.role}',
        sid: '${ss:sessionId}',
        userrole: '${role}',
        tokentype: 'employee',
      },
      ctx,
    );
    expect(headers).toEqual({
      Authorization: 'Bearer sso-abc',
      'x-auth-token': 'int-xyz',
      email: 'a@b.test',
      nested: 'ADMIN',
      sid: 'sess-1',
      userrole: 'admin',
      tokentype: 'employee',
    });
  });

  test('a missing key fails with a message naming the placeholder, not a value', () => {
    expect(() => ApiAuthHeaders.resolve({ h: '${ls:nope}' }, ctx)).toThrow(/"nope" is not in the saved session/);
    expect(() => ApiAuthHeaders.resolve({ h: '${ls:sso_token.field}' }, ctx)).toThrow(/not JSON/);
    expect(() => ApiAuthHeaders.resolve({ h: '${ls:user_profile.missing}' }, ctx)).toThrow(/not found/);
  });
});
