import { test, expect } from '@fixtures';
import { masterDataListSchema } from '@api/clients/MasterDataApiClient';
import { HttpStatus, Tags } from '@utils/constants';

test.describe(`Master Data API ${Tags.api}`, () => {
  test('MD-A01 GET /admin/master-data/list returns the documented shape', async ({ masterDataApi }) => {
    const result = await masterDataApi.list();
    expect(result.status).toBe(HttpStatus.ok);

    const body = await result.body(masterDataListSchema); // throws if the contract changes
    expect(body.success).toBe(true);
    expect(body.data.departments.length).toBeGreaterThan(0);
    expect(body.data.campuses.length).toBeGreaterThan(0);
    expect(body.data.roles).toHaveLength(3);
  });

  test('MD-A02 codes are unique and ids are unique in every list', async ({ masterDataApi }) => {
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);

    for (const [name, items] of Object.entries(data)) {
      const codes = items.map((i) => i.code);
      const ids = items.map((i) => i.id);
      expect(new Set(codes).size, `${name}: duplicate codes`).toBe(codes.length);
      expect(new Set(ids).size, `${name}: duplicate ids`).toBe(ids.length);
    }
  });

  test('MD-A03 role codes are ADMIN, EMPLOYEE and STUDENT', async ({ masterDataApi }) => {
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    expect(data.roles.map((r) => r.code).sort()).toEqual(['ADMIN', 'EMPLOYEE', 'STUDENT']);
  });

  test('MD-A04 the list is not available without credentials', async ({ apiContext }) => {
    const res = await apiContext.get('/myindiranew/api/admin/master-data/list');
    expect([HttpStatus.unauthorized, HttpStatus.forbidden]).toContain(res.status());
  });
});
