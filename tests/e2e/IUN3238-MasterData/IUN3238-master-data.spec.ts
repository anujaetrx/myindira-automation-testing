import path from 'node:path';
import { test, expect } from '@fixtures';
import { DashboardPage } from '@pages/DashboardPage';
import { MasterDataApiClient, masterDataListSchema } from '@api/clients/MasterDataApiClient';
import type { MasterDataSection } from '@pages/MasterDataPage';

/**
 * Master Data (Admin). Test-case IDs (MD-xxx) match docs/test-cases/master-data.md.
 *
 * Tests that SAVE data are gated behind ALLOW_MASTER_DATA_WRITES=true: the screen has no delete,
 * so anything created on a shared environment stays there.
 */
const WRITES_ALLOWED = process.env.ALLOW_MASTER_DATA_WRITES === 'true';

// The type dropdown's popup is drawn off-screen at shorter windows (see docs/test-cases/master-data.md, MD-OBS-1),
// so these desktop checks use a window tall enough for it to appear.
test.use({ viewport: { width: 1440, height: 900 } });
const SAMPLE_CSV = path.resolve(__dirname, '../../../src/test-data/files/master-data-sample.csv');
const SECTIONS: MasterDataSection[] = ['Departments', 'Campuses', 'Roles'];

test.describe('Master Data: access and navigation @master-data', () => {
  test('MD-001 admin opens Master Data from the side menu @smoke', async ({ adminPage, masterDataPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.openMasterData();

    await masterDataPage.waitForReady();
    await expect(adminPage).toHaveURL(/\/master-data/);
  });

  test('MD-002 a visitor without a session cannot open Master Data', async ({ page, ssoLoginPage }) => {
    await page.goto('/master-data');
    await ssoLoginPage.expectShown();
  });
});

test.describe('Master Data: lists @master-data', () => {
  test('MD-010 shows Departments, Campuses and Roles, each with a count', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    const data = await masterDataPage.readSections();

    for (const section of SECTIONS) {
      expect(data[section].headingCount, `${section} heading count`).toBeGreaterThan(0);
    }
  });

  test('MD-011 every heading count equals the number of items shown', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    const data = await masterDataPage.readSections();

    for (const section of SECTIONS) {
      expect(data[section].items.length, `${section}: items shown vs heading count`).toBe(data[section].headingCount);
    }
  });

  test('MD-012 Roles contains exactly Administrator, Employee and Student', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    const { Roles } = await masterDataPage.readSections();

    expect(Roles.items).toEqual(
      expect.arrayContaining([
        { name: 'Administrator', code: 'ADMIN' },
        { name: 'Employee', code: 'EMPLOYEE' },
        { name: 'Student', code: 'STUDENT' },
      ]),
    );
    expect(Roles.items).toHaveLength(3);
  });

  test('MD-013 codes are unique within each list', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    const data = await masterDataPage.readSections();

    for (const section of SECTIONS) {
      const codes = data[section].items.map((i) => i.code);
      const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
      expect(duplicates, `${section} has duplicate codes`).toEqual([]);
    }
  });

  test('MD-014 the screen shows the same records the API returns', async ({ adminPage, masterDataPage, masterDataApi }) => {
    const apiResponse = adminPage.waitForResponse((r) => r.url().includes('/admin/master-data/list'));
    await masterDataPage.goto();
    await apiResponse;

    const fromApi = (await (await masterDataApi.list()).body(masterDataListSchema)).data;
    const onScreen = await masterDataPage.readSections();
    const codes = (items: { code: string }[]) => items.map((i) => i.code).sort();

    expect(codes(onScreen.Departments.items)).toEqual(codes(fromApi.departments));
    expect(codes(onScreen.Campuses.items)).toEqual(codes(fromApi.campuses));
    expect(codes(onScreen.Roles.items)).toEqual(codes(fromApi.roles));
  });

  test('MD-015 the page is usable within 5 seconds', async ({ masterDataPage }) => {
    const start = Date.now();
    await masterDataPage.goto();
    await masterDataPage.readSections();
    expect(Date.now() - start).toBeLessThan(5_000);
  });
});

test.describe('Master Data: add form (nothing is saved) @master-data', () => {
  test('MD-020 the type dropdown offers Department, Campus and Role', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();
    await masterDataPage.openTypeDropdown();

    for (const type of ['Department', 'Campus', 'Role'] as const) {
      await expect(masterDataPage.typeOption(type), `option ${type}`).toBeVisible();
    }
  });

  test('MD-021 Add and Download Template are disabled until a type is chosen', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();

    await expect(masterDataPage.add).toBeDisabled();
    await expect(masterDataPage.downloadTemplate).toBeDisabled();
  });

  test('MD-022 Add stays disabled while the type, name or code is missing', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();

    await masterDataPage.chooseType('Department');
    await expect(masterDataPage.add, 'type only').toBeDisabled();

    await masterDataPage.fillName('AUTO Draft Name');
    await expect(masterDataPage.add, 'name only').toBeDisabled();

    await masterDataPage.clearRecord();
    await masterDataPage.fillCode('AUTO_DRAFT_CODE');
    await expect(masterDataPage.add, 'code only').toBeDisabled();
  });

  test('MD-023 Add becomes enabled once type, name and code are filled', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();

    await masterDataPage.chooseType('Campus');
    await masterDataPage.fillRecord('AUTO Draft Campus', 'AUTO_DRAFT_CAMPUS');
    await expect(masterDataPage.add).toBeEnabled();
    // Deliberately NOT clicked: this case must not save anything.
  });

  test('MD-024 whitespace-only name and code do not enable Add', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();

    await masterDataPage.chooseType('Department');
    await masterDataPage.fillRecord('   ', '   ');
    await expect(masterDataPage.add).toBeDisabled();
  });

  test('MD-025 Name and Code inputs have accessible names @a11y', async ({ adminPage, masterDataPage }) => {
    // KNOWN DEFECT: the inputs have no accessible name (no label, aria-label or placeholder), so screen readers
    // cannot announce them. test.fail() keeps the suite green while tracking it; it turns red when the app is fixed.
    test.fail(true, 'Known accessibility defect: Name/Code inputs are unlabeled');
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();

    await expect(adminPage.getByRole('textbox', { name: /^name/i }), 'Name input announced to screen readers').toHaveCount(1);
    await expect(adminPage.getByRole('textbox', { name: /^code/i }), 'Code input announced to screen readers').toHaveCount(1);
  });
});

test.describe('Master Data: CSV / XLSX upload (nothing is saved) @master-data', () => {
  for (const type of ['Department', 'Campus', 'Role'] as const) {
    test(`MD-040 the ${type} sample template is a CSV with name and code columns`, async ({ masterDataPage }) => {
      await masterDataPage.goto();
      await masterDataPage.scrollToForm();
      await masterDataPage.chooseType(type);

      const { fileName, content } = await masterDataPage.downloadSampleTemplate();
      expect(fileName).toBe(`${type.toLowerCase()}-template.csv`);
      const header = content.split(/\r?\n/)[0].replace(/\s/g, '').toLowerCase();
      expect(header).toBe('name,code');
    });
  }

  test('MD-043 Upload CSV is disabled until a file is chosen', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();
    await masterDataPage.chooseType('Department');

    await expect(masterDataPage.upload).toBeDisabled();
    await masterDataPage.chooseFile(SAMPLE_CSV);
    await expect(masterDataPage.upload).toBeEnabled();
    // Deliberately NOT clicked: Upload would save the file's rows.
  });

  test('MD-041 the validation summary starts at zero', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    expect(await masterDataPage.validationSummary()).toEqual({ total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 });
  });

  test('MD-042 Reset clears a chosen file', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    await masterDataPage.scrollToForm();
    await masterDataPage.chooseType('Department');

    await masterDataPage.chooseFile(SAMPLE_CSV);
    await expect(masterDataPage.noFileSelected).toBeHidden();

    await masterDataPage.clickReset();
    await expect(masterDataPage.noFileSelected).toBeVisible();
    expect(await masterDataPage.validationSummary()).toEqual({ total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 });
  });
});

test.describe('Master Data: saving records (writes data) @master-data @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Saves data that cannot be deleted from the UI. Set ALLOW_MASTER_DATA_WRITES=true to run.');
  test.describe.configure({ mode: 'serial' });

  const unique = () => Date.now().toString(36).toUpperCase();

  for (const [type, section] of [
    ['Department', 'Departments'],
    ['Campus', 'Campuses'],
    ['Role', 'Roles'],
  ] as const) {
    test(`MD-03x a new ${type} is saved and appears in the list`, async ({ masterDataPage, masterDataApi }) => {
      const id = unique();
      const code = `AUTO_${type.toUpperCase()}_${id}`;
      const before = (await masterDataApiCount(masterDataApi, section));

      await masterDataPage.goto();
      await masterDataPage.scrollToForm();
      await masterDataPage.chooseType(type);
      await masterDataPage.fillRecord(`AUTO ${type} ${id}`, code);
      await masterDataPage.addRecord();

      await masterDataPage.goto();
      const data = await masterDataPage.readSections();
      expect(data[section].items.map((i) => i.code)).toContain(code);
      expect(data[section].headingCount).toBe(before + 1);
    });
  }

  test('MD-033 a duplicate code is rejected and the list does not grow', async ({ masterDataPage, masterDataApi }) => {
    const before = await masterDataApiCount(masterDataApi, 'Departments');

    await masterDataPage.goto();
    await masterDataPage.scrollToForm();
    await masterDataPage.chooseType('Department');
    await masterDataPage.fillRecord('AUTO Duplicate Attempt', 'CSE'); // CSE already exists
    await masterDataPage.addRecord();

    expect(await masterDataApiCount(masterDataApi, 'Departments')).toBe(before);
  });
});

async function masterDataApiCount(api: MasterDataApiClient, section: MasterDataSection): Promise<number> {
  const { data } = await (await api.list()).body(masterDataListSchema);
  return { Departments: data.departments, Campuses: data.campuses, Roles: data.roles }[section].length;
}
