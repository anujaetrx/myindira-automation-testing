import { test, expect } from '@fixtures';
import { MasterDataApiClient, masterDataListSchema } from '@api/clients/MasterDataApiClient';
import { HttpStatus, Tags } from '@utils/constants';

/**
 * Master Data API: gap review of Jira IUN-3238. READ-ONLY (GET only). The add and bulk-upload endpoints are
 * not called here: they write data that cannot be removed, and calling them without credentials to "prove" a 401
 * would create a record if the endpoint were unprotected. See docs/test-cases/master-data-traceability.md.
 */
const TYPES = ['DEPARTMENT', 'CAMPUS', 'ROLE'] as const;
const CODE_RULE = /^[A-Z0-9_]{2,50}$/; // BR-MD-01

test.describe(`Master Data API gap review ${Tags.api}`, () => {
  test('GAP_MD_A01 the list envelope and every item have exactly the documented fields', async ({ masterDataApi }) => {
    const result = await masterDataApi.list();
    expect(result.status).toBe(HttpStatus.ok);
    expect(result.response.headers()['content-type']).toMatch(/application\/json/);

    const raw = (await result.response.json()) as { data: Record<string, Record<string, unknown>[]> } & Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['code', 'data', 'message', 'success', 'timestamp']);
    expect(Object.keys(raw.data).sort()).toEqual(['campuses', 'departments', 'roles']);
    for (const [list, items] of Object.entries(raw.data)) {
      for (const item of items) expect(Object.keys(item).sort(), `${list} item fields`).toEqual(['code', 'id', 'name']);
    }
    await result.body(masterDataListSchema); // types: id number, code string, name string
  });

  test('GAP_MD_A02 stored codes follow the code rule (uppercase letters, digits, underscore, 2-50 characters)', async ({ masterDataApi }) => {
    // DEVIATION (legacy data): two department codes are 59 characters long, longer than the 50 the story allows.
    test.fail(true, 'BR-MD-01: existing records break the 2-50 character rule (e.g. DEPARTMENT_OF_ELECTRONICS_AND_TELECOMMUNICATION_ENGINEERING)');
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    for (const [list, items] of Object.entries(data)) {
      const bad = items.filter((i) => !CODE_RULE.test(i.code)).map((i) => i.code);
      expect(bad, `${list}: codes outside ^[A-Z0-9_]{2,50}$`).toEqual([]);
    }
  });

  test('GAP_MD_A03 stored codes are uppercase with no spaces (format part of BR-MD-01)', async ({ masterDataApi }) => {
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    for (const [list, items] of Object.entries(data)) {
      const bad = items.filter((i) => !/^[A-Z0-9_]+$/.test(i.code)).map((i) => i.code);
      expect(bad, `${list}: codes with lowercase, spaces or symbols`).toEqual([]);
    }
  });

  test('GAP_MD_A04 names are trimmed, 2-150 characters and unique ignoring case within each list (BR-MD-02)', async ({ masterDataApi }) => {
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    for (const [list, items] of Object.entries(data)) {
      for (const i of items) {
        expect(i.name, `${list} ${i.code}: name has outer spaces`).toBe(i.name.trim());
        expect(i.name.length, `${list} ${i.code}: name length`).toBeGreaterThanOrEqual(2);
        expect(i.name.length, `${list} ${i.code}: name length`).toBeLessThanOrEqual(150);
      }
      const lower = items.map((i) => i.name.trim().toLowerCase());
      expect(lower.filter((n, idx) => lower.indexOf(n) !== idx), `${list}: names repeated ignoring case`).toEqual([]);
      const codes = items.map((i) => i.code.toUpperCase());
      expect(codes.filter((c, idx) => codes.indexOf(c) !== idx), `${list}: codes repeated ignoring case`).toEqual([]);
    }
  });

  test('GAP_MD_A05 two reads return the same data (a GET does not change anything)', async ({ masterDataApi }) => {
    const first = await (await masterDataApi.list()).body(masterDataListSchema);
    const second = await (await masterDataApi.list()).body(masterDataListSchema);
    expect(second.data).toEqual(first.data);
  });

  test('GAP_MD_A06 the list is refused with an invalid token', async ({ apiContext }) => {
    const client = new MasterDataApiClient(apiContext, { Authorization: 'Bearer invalid.token.value' });
    expect([HttpStatus.unauthorized, HttpStatus.forbidden]).toContain((await client.list()).status);
  });

  for (const type of TYPES) {
    test(`GAP_MD_A07 template/${type} is a CSV download with the header line only`, async ({ masterDataApi }) => {
      const result = await masterDataApi.template(type);
      expect(result.status).toBe(HttpStatus.ok);
      const headers = result.response.headers();
      expect(headers['content-type']).toMatch(/text\/csv/);
      expect(headers['content-disposition']).toContain(`filename=${type.toLowerCase()}-template.csv`);
      const lines = (await result.response.text()).split(/\r?\n/).filter(Boolean);
      expect(lines).toHaveLength(1);
      expect(lines[0].toLowerCase().replace(/\s/g, '')).toBe('name,code');
    });
  }

  test('GAP_MD_A08 the three templates have the same header', async ({ masterDataApi }) => {
    const bodies = await Promise.all(TYPES.map(async (t) => (await (await masterDataApi.template(t)).response.text()).trim()));
    expect(new Set(bodies).size).toBe(1);
  });

  test('GAP_MD_A09 the template type is not case-sensitive', async ({ masterDataApi }) => {
    const lower = await masterDataApi.template('role');
    expect(lower.status).toBe(HttpStatus.ok);
    expect(await lower.response.text()).toBe(await (await masterDataApi.template('ROLE')).response.text());
  });

  test('GAP_MD_A10 an unknown template type is a 400 that names the accepted values', async ({ masterDataApi }) => {
    const result = await masterDataApi.template('FOO');
    expect(result.status).toBe(400);
    const body = (await result.response.json()) as { success: boolean; message: string; code: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('DEPARTMENT, CAMPUS, ROLE');
  });

  test('GAP_MD_A11 the template is refused without credentials', async ({ apiContext }) => {
    const res = await apiContext.get('/myindiranew/api/admin/master-data/template/ROLE');
    expect([HttpStatus.unauthorized, HttpStatus.forbidden]).toContain(res.status());
  });
});
