import { test, expect } from '@fixtures';
import { CsvBuilder } from '@data/builders/CsvBuilder';
import { masterDataListSchema, type MasterDataApiClient } from '@api/clients/MasterDataApiClient';
import type { MasterDataPage, MasterDataType } from '@pages/MasterDataPage';

/**
 * Master Data test cases from the team's sheet (TC_MD_001 .. TC_MD_043). IDs match the sheet.
 * Traceability, expected-vs-actual and open questions: docs/test-cases/master-data-traceability.md
 *
 * Three groups:
 *   1. Run by default: nothing is saved (screen, form state, file selection).
 *   2. Known deviations: the app behaves differently from the sheet. test.fail() keeps the run green while
 *      reporting the difference; the test turns red when the app is fixed (then remove test.fail).
 *   3. Gated (@writes): save or upload data. They run only with ALLOW_MASTER_DATA_WRITES=true because the
 *      screen cannot delete records. NOT yet executed against a live environment.
 */
const WRITES_ALLOWED = process.env.ALLOW_MASTER_DATA_WRITES === 'true';

// The type dropdown renders its popup reliably at this window size.
test.use({ viewport: { width: 1440, height: 900 } });

const TYPES: MasterDataType[] = ['Department', 'Campus', 'Role'];
const LIST_KEY = { Department: 'departments', Campus: 'campuses', Role: 'roles' } as const;
const MB = 1024 * 1024;

const uid = (): string => (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase();

async function codesOf(api: MasterDataApiClient, type: MasterDataType): Promise<string[]> {
  const { data } = await (await api.list()).body(masterDataListSchema);
  return data[LIST_KEY[type]].map((i) => i.code);
}
async function namesOf(api: MasterDataApiClient, type: MasterDataType): Promise<string[]> {
  const { data } = await (await api.list()).body(masterDataListSchema);
  return data[LIST_KEY[type]].map((i) => i.name);
}

async function openForm(md: MasterDataPage, type?: MasterDataType): Promise<void> {
  await md.goto();
  await md.scrollToForm();
  if (type) await md.chooseType(type);
}

// =====================================================================================
// 1. RUN BY DEFAULT (nothing is saved)
// =====================================================================================
test.describe('TC_MD: screen and form state @master-data', () => {
  test('TC_MD_001 inventory sections and counts', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    const data = await masterDataPage.readSections();
    for (const section of ['Departments', 'Campuses', 'Roles'] as const) {
      expect(data[section].headingCount, `${section} count`).toBeGreaterThan(0);
      expect(data[section].items.length, `${section} pills shown vs count`).toBe(data[section].headingCount);
    }
  });

  test('TC_MD_002 an entity with no records shows a count of 0 and an empty message', async ({ masterDataPage }) => {
    await masterDataPage.goto();
    const data = await masterDataPage.readSections();
    const empty = (['Departments', 'Campuses', 'Roles'] as const).filter((s) => data[s].headingCount === 0);
    test.skip(empty.length === 0, 'Needs an entity type with 0 records; every list has records on this environment.');
    for (const section of empty) expect(data[section].items).toHaveLength(0);
  });

  test('TC_MD_003 Select Type offers Department, Campus and Role', async ({ masterDataPage }) => {
    await openForm(masterDataPage);
    await masterDataPage.openTypeDropdown();
    for (const type of TYPES) await expect(masterDataPage.typeOption(type), type).toBeVisible();
  });

  test('TC_MD_004 form title and button adapt to the chosen type', async ({ masterDataPage, adminPage }) => {
    // A fresh page per type: re-opening the dropdown after a type is chosen did not show its options in
    // automation (see OBS-6 in the traceability doc), so each type is checked from a clean form.
    for (const type of TYPES) {
      await openForm(masterDataPage, type);
      await expect(masterDataPage.formTitle(type), `title for ${type}`).toBeVisible();
      await expect(masterDataPage.addButtonFor(type), `Add button for ${type}`).toBeVisible();
      await expect(adminPage.getByRole('button', { name: `Download ${type} Template`, exact: true })).toBeVisible();
    }
  });

  test('TC_MD_005 Add is disabled initially', async ({ masterDataPage }) => {
    await openForm(masterDataPage);
    await expect(masterDataPage.add).toBeDisabled();
  });

  test('TC_MD_006 Name empty (code only): Add disabled', async ({ masterDataPage }) => {
    await openForm(masterDataPage, 'Role');
    await masterDataPage.fillCode('LAB_TECH');
    await expect(masterDataPage.add).toBeDisabled();
  });

  test('TC_MD_007 Code empty (name only): Add disabled', async ({ masterDataPage }) => {
    await openForm(masterDataPage, 'Role');
    await masterDataPage.fillName('Lab Technician');
    await expect(masterDataPage.add).toBeDisabled();
  });

  test('TC_MD_008 whitespace-only fields: Add disabled', async ({ masterDataPage }) => {
    await openForm(masterDataPage, 'Role');
    await masterDataPage.fillRecord('   ', '   ');
    await expect(masterDataPage.add).toBeDisabled();
  });

  test('TC_MD_009 no type selected: Add disabled even with name and code', async ({ masterDataPage }) => {
    await openForm(masterDataPage);
    await masterDataPage.fillRecord('Lab Technician', 'LAB_TECH');
    await expect(masterDataPage.add).toBeDisabled();
  });
});

test.describe('TC_MD: template and file selection (nothing is saved) @master-data', () => {
  test('TC_MD_024 a valid .csv is accepted and Upload is enabled', async ({ masterDataPage }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).csv('valid.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]);
    await openForm(masterDataPage, 'Department');
    await masterDataPage.chooseFile(file);
    await expect(masterDataPage.selectedFile('valid.csv')).toBeVisible();
    await expect(masterDataPage.upload).toBeEnabled();
  });

  test('TC_MD_025 a valid .xlsx is accepted', async ({ masterDataPage }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).fakeXlsx('valid.xlsx');
    await openForm(masterDataPage, 'Department');
    await masterDataPage.chooseFile(file);
    await expect(masterDataPage.selectedFile('valid.xlsx')).toBeVisible();
    await expect(masterDataPage.upload).toBeEnabled();
  });

  test('TC_MD_026 a .pdf is rejected', async ({ masterDataPage }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).other('document.pdf', '%PDF-1.4');
    await openForm(masterDataPage, 'Department');
    await masterDataPage.chooseFile(file);
    await expect(masterDataPage.noFileSelected).toBeVisible();
    await expect(masterDataPage.upload).toBeDisabled();
    await expect(masterDataPage.invalidFileMessage).toBeVisible();
  });

  test('TC_MD_026 (message wording) the rejection message matches the sheet', async ({ masterDataPage, adminPage }, testInfo) => {
    // DEVIATION: the sheet expects 'Invalid file format. Please upload .csv or .xlsx under 10MB'.
    // The app shows 'Only .csv and .xlsx are allowed'. Confirm which wording is correct.
    test.fail(true, 'Message wording differs from the sheet (see traceability doc)');
    const file = new CsvBuilder(testInfo.outputDir).other('document.pdf', '%PDF-1.4');
    await openForm(masterDataPage, 'Department');
    await masterDataPage.chooseFile(file);
    await expect(adminPage.getByText('Invalid file format. Please upload .csv or .xlsx under 10MB', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  for (const name of ['notes.txt', 'legacy.xls', 'program.exe']) {
    test(`TC_MD_027 ${name} is rejected`, async ({ masterDataPage }, testInfo) => {
      const file = new CsvBuilder(testInfo.outputDir).other(name);
      await openForm(masterDataPage, 'Department');
      await masterDataPage.chooseFile(file);
      await expect(masterDataPage.noFileSelected).toBeVisible();
      await expect(masterDataPage.upload).toBeDisabled();
    });
  }

  test('TC_MD_029 a file of exactly 10 MB is accepted on selection', async ({ masterDataPage }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).sized('exactly-10mb.csv', 10 * MB);
    await openForm(masterDataPage, 'Department');
    await masterDataPage.chooseFile(file);
    await expect(masterDataPage.selectedFile('exactly-10mb.csv')).toBeVisible();
    await expect(masterDataPage.upload).toBeEnabled();
  });

  test('TC_MD_033 Upload is disabled when no file is chosen', async ({ masterDataPage }) => {
    await openForm(masterDataPage, 'Department');
    await expect(masterDataPage.upload).toBeDisabled();
  });

  test('TC_MD_023 Download Template returns master_data_template.csv with Name, Code and sample rows', async ({ masterDataPage }) => {
    // DEVIATION: the app returns '<type>-template.csv' containing only the lowercase header 'name,code'.
    test.fail(true, 'Template file name, header case and sample rows differ from the sheet (see traceability doc)');
    await openForm(masterDataPage, 'Department');
    const { fileName, content } = await masterDataPage.downloadSampleTemplate();
    const lines = content.split(/\r?\n/).filter(Boolean);
    expect(fileName).toBe('master_data_template.csv');
    expect(lines[0]).toBe('Name,Code');
    expect(lines.length, 'sample rows after the header').toBeGreaterThan(1);
  });

  test('TC_MD_040 Reset clears the file, the fields and the summary', async ({ masterDataPage }, testInfo) => {
    // DEVIATION: Reset clears the file and summary but leaves Name and Code filled.
    test.fail(true, 'Reset does not clear the Name and Code fields (see traceability doc)');
    const file = new CsvBuilder(testInfo.outputDir).csv('valid.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]);
    await openForm(masterDataPage, 'Department');
    await masterDataPage.fillRecord('Draft name', 'DRAFT_CODE');
    await masterDataPage.chooseFile(file);

    await masterDataPage.clickReset();

    await expect(masterDataPage.noFileSelected).toBeVisible();
    expect(await masterDataPage.validationSummary()).toEqual({ total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 });
    await expect(masterDataPage.name).toHaveValue('');
    await expect(masterDataPage.code).toHaveValue('');
  });
});

test.describe('TC_MD: cases that cannot run yet @master-data', () => {
  test('TC_MD_042 a new department appears in the Policies "create policy" dropdown', async () => {
    test.skip(true, 'Cross-module case: needs the Create Policy screen mapped, and a saved department (gated).');
  });

  test('TC_MD_043 a non-admin (Student) is denied access to /master-data', async () => {
    test.skip(true, 'Blocked: no Student or Employee test account yet. Add STUDENT credentials to enable.');
  });
});

// =====================================================================================
// 3. GATED: these save or upload data (ALLOW_MASTER_DATA_WRITES=true). Not yet run live.
// =====================================================================================
test.describe('TC_MD: adding records manually (WRITES DATA) @master-data @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Saves records that cannot be deleted from the UI. Set ALLOW_MASTER_DATA_WRITES=true to run.');
  test.describe.configure({ mode: 'serial' });

  /** Fills and submits the add form; returns what changed on the server. */
  async function addAndObserve(md: MasterDataPage, api: MasterDataApiClient, type: MasterDataType, name: string, code: string) {
    const before = await codesOf(api, type);
    await openForm(md, type);
    await md.fillRecord(name, code);
    let result: { sent: boolean; status?: number } = { sent: false };
    const feedback = await md.captureFeedback(async () => {
      result = await md.submitAdd();
    });
    const after = await codesOf(api, type);
    const created = after.filter((c) => !before.includes(c));
    test.info().annotations.push({ type: 'feedback', description: feedback.slice(0, 3).join(' | ') || '(none shown)' });
    return { before, after, created, result, feedback };
  }

  test('TC_MD_010 add a Role manually', async ({ masterDataPage, masterDataApi }) => {
    const id = uid();
    const { created, result, before, after } = await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Lab Technician ${id}`, `AUTO_LAB_TECH_${id}`);
    expect(result.sent).toBe(true);
    expect(created).toEqual([`AUTO_LAB_TECH_${id}`]);
    expect(after.length).toBe(before.length + 1);
  });

  test('TC_MD_011 add a Department and a Campus manually', async ({ masterDataPage, masterDataApi }) => {
    for (const type of ['Department', 'Campus'] as const) {
      const id = uid();
      const { created } = await addAndObserve(masterDataPage, masterDataApi, type, `AUTO ${type} ${id}`, `AUTO_${type.toUpperCase()}_${id}`);
      expect(created, type).toEqual([`AUTO_${type.toUpperCase()}_${id}`]);
    }
  });

  test('TC_MD_012 lowercase code is rejected or stored in upper case', async ({ masterDataPage, masterDataApi }) => {
    const id = uid();
    const { created } = await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Lower ${id}`, `auto_lower_${id}`.toLowerCase());
    for (const c of created) expect(c, 'a stored code must not be lowercase').toBe(c.toUpperCase());
  });

  test('TC_MD_013 code with spaces is rejected or trimmed', async ({ masterDataPage, masterDataApi }) => {
    const id = uid();
    const { created } = await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Spaces ${id}`, `AUTO SPACE ${id}`);
    for (const c of created) expect(c, 'a stored code must not contain spaces').not.toMatch(/\s/);
  });

  test('TC_MD_014 code with special characters is rejected (only A-Z, 0-9, _)', async ({ masterDataPage, masterDataApi }) => {
    const id = uid();
    const { created } = await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Special ${id}`, `AUTO-SPECIAL@${id}`);
    expect(created, 'record with special characters must not be saved').toEqual([]);
  });

  test('TC_MD_015 code lengths 2 and 50 are accepted', async ({ masterDataPage, masterDataApi }) => {
    const two = uid().slice(0, 2);
    const fifty = ('AUTO' + uid()).padEnd(50, 'X');
    expect((await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Two ${uid()}`, two)).created).toEqual([two]);
    expect((await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Fifty ${uid()}`, fifty)).created).toEqual([fifty]);
  });

  test('TC_MD_016 code lengths 1 and 51 are rejected', async ({ masterDataPage, masterDataApi }) => {
    const one = 'Q';
    const fiftyOne = ('AUTO' + uid()).padEnd(51, 'X');
    expect((await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO One ${uid()}`, one)).created, '1 character').toEqual([]);
    expect((await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Fifty-one ${uid()}`, fiftyOne)).created, '51 characters').toEqual([]);
  });

  test('TC_MD_017 name lengths 2 and 150 are accepted', async ({ masterDataPage, masterDataApi }) => {
    const names = ['Ab', 'N'.repeat(150)];
    for (const name of names) {
      const code = `AUTO_NAME_${uid()}`;
      expect((await addAndObserve(masterDataPage, masterDataApi, 'Role', name, code)).created, `name length ${name.length}`).toEqual([code]);
    }
  });

  test('TC_MD_018 name lengths 1 and 151 are rejected', async ({ masterDataPage, masterDataApi }) => {
    for (const name of ['A', 'N'.repeat(151)]) {
      const code = `AUTO_NAME_${uid()}`;
      expect((await addAndObserve(masterDataPage, masterDataApi, 'Role', name, code)).created, `name length ${name.length}`).toEqual([]);
    }
  });

  test('TC_MD_019 code with underscore and digits (ROLE_01) is accepted', async ({ masterDataPage, masterDataApi }) => {
    test.skip((await codesOf(masterDataApi, 'Role')).includes('ROLE_01'), 'ROLE_01 already exists from an earlier run');
    const { created } = await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Role ${uid()}`, 'ROLE_01');
    expect(created).toEqual(['ROLE_01']);
  });

  test('TC_MD_020 duplicate code in the same type is rejected', async ({ masterDataPage, masterDataApi }) => {
    const existing = (await codesOf(masterDataApi, 'Department'))[0];
    const { created, after, before } = await addAndObserve(masterDataPage, masterDataApi, 'Department', `AUTO Duplicate ${uid()}`, existing);
    expect(created).toEqual([]);
    expect(after.length).toBe(before.length);
  });

  test('TC_MD_021 the same code is allowed in a different type', async ({ masterDataPage, masterDataApi }) => {
    const existingDeptCode = (await codesOf(masterDataApi, 'Department'))[0];
    test.skip((await codesOf(masterDataApi, 'Role')).includes(existingDeptCode), 'A Role with that code already exists');
    const { created } = await addAndObserve(masterDataPage, masterDataApi, 'Role', `AUTO Cross ${uid()}`, existingDeptCode);
    expect(created).toEqual([existingDeptCode]);
  });

  test('TC_MD_022 duplicate name with a different code: behaviour is recorded', async ({ masterDataPage, masterDataApi }) => {
    const existingName = (await namesOf(masterDataApi, 'Department'))[0];
    const code = `AUTO_DUPNAME_${uid()}`;
    const { created, result } = await addAndObserve(masterDataPage, masterDataApi, 'Department', existingName, code);
    // Business rule to be confirmed: record what happened and make sure the server did not fail.
    test.info().annotations.push({ type: 'behaviour', description: created.length ? 'duplicate name ACCEPTED' : 'duplicate name REJECTED' });
    expect(result.status ?? 200, 'no server error').toBeLessThan(500);
  });

  test('TC_MD_041 count and pills update without a page refresh', async ({ masterDataPage, masterDataApi, adminPage }) => {
    const id = uid();
    const code = `AUTO_LIVE_${id}`;
    await openForm(masterDataPage, 'Role');
    const before = (await masterDataPage.readSections()).Roles.headingCount;
    await masterDataPage.fillRecord(`AUTO Live ${id}`, code);
    await masterDataPage.submitAdd();
    await expect.poll(async () => (await masterDataPage.readSections()).Roles.headingCount, { timeout: 15_000 }).toBe(before + 1);
    await expect(adminPage.getByText(`AUTO Live ${id} (${code})`, { exact: true })).toBeVisible();
    expect(await codesOf(masterDataApi, 'Role')).toContain(code);
  });
});

test.describe('TC_MD: uploading files (WRITES DATA) @master-data @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Uploads can save records that cannot be deleted from the UI. Set ALLOW_MASTER_DATA_WRITES=true to run.');
  test.describe.configure({ mode: 'serial' });

  async function upload(md: MasterDataPage, api: MasterDataApiClient, type: MasterDataType, file: string) {
    const before = await codesOf(api, type);
    await openForm(md, type);
    await md.chooseFile(file);
    let status: number | undefined;
    const feedback = await md.captureFeedback(async () => {
      status = (await md.uploadAndWait()).status;
    });
    const summary = await md.validationSummary();
    const after = await codesOf(api, type);
    test.info().annotations.push({ type: 'feedback', description: feedback.slice(0, 3).join(' | ') || '(none shown)' });
    return { summary, created: after.filter((c) => !before.includes(c)), status, feedback };
  }

  const rows = (n: number, tag: string): string[][] => Array.from({ length: n }, (_, i) => [`AUTO Row ${tag} ${i}`, `AUTO_ROW_${tag}_${i}`]);

  test('TC_MD_028 a 15 MB file is rejected with a size error', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).sized('too-big.csv', 15 * MB);
    const { created, feedback, status } = await upload(masterDataPage, masterDataApi, 'Department', file);
    expect(created).toEqual([]);
    expect(status === undefined || status >= 400 || feedback.length > 0, 'a size error must be reported').toBe(true);
  });

  test('TC_MD_030 a file without Name/Code headers is rejected', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).csv('no-headers.csv', ['Foo', 'Bar'], [['x', 'y']]);
    expect((await upload(masterDataPage, masterDataApi, 'Department', file)).created).toEqual([]);
  });

  test('TC_MD_031 swapped or extra columns are rejected as an invalid template', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).csv('extra-columns.csv', ['Code', 'Name', 'Extra'], [[`AUTO_X_${uid()}`, 'AUTO Swapped', 'z']]);
    expect((await upload(masterDataPage, masterDataApi, 'Department', file)).created).toEqual([]);
  });

  test('TC_MD_032 an empty file is rejected and creates nothing', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const file = new CsvBuilder(testInfo.outputDir).empty();
    expect((await upload(masterDataPage, masterDataApi, 'Department', file)).created).toEqual([]);
  });

  test('TC_MD_034 10 rows: 8 valid, 1 duplicate, 1 missing name', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const tag = uid();
    const existing = (await codesOf(masterDataApi, 'Department'))[0];
    const data = [...rows(8, tag), ['AUTO Duplicate', existing], ['', `AUTO_NONAME_${tag}`]];
    const file = new CsvBuilder(testInfo.outputDir).csv('ten.csv', ['Name', 'Code'], data);
    const { summary, created } = await upload(masterDataPage, masterDataApi, 'Department', file);
    expect(summary).toEqual({ total: 10, success: 8, failed: 2, duplicates: 1, invalid: 1 });
    expect(created).toHaveLength(8);
  });

  test('TC_MD_035 50 rows: 45 new, 3 duplicates, 2 invalid', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const tag = uid();
    const existing = (await codesOf(masterDataApi, 'Department')).slice(0, 3);
    const data = [...rows(45, tag), ...existing.map((c) => ['AUTO Duplicate', c]), ['', `AUTO_NONAME_A_${tag}`], ['', `AUTO_NONAME_B_${tag}`]];
    const file = new CsvBuilder(testInfo.outputDir).csv('fifty.csv', ['Name', 'Code'], data);
    const { summary, created } = await upload(masterDataPage, masterDataApi, 'Department', file);
    expect(summary).toEqual({ total: 50, success: 45, failed: 5, duplicates: 3, invalid: 2 });
    expect(created).toHaveLength(45);
  });

  test('TC_MD_036 duplicates are skipped and valid rows are kept (no rollback)', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const tag = uid();
    const existing = (await codesOf(masterDataApi, 'Department'))[0];
    const data = [...rows(3, tag), ['AUTO Duplicate', existing]];
    const file = new CsvBuilder(testInfo.outputDir).csv('mixed.csv', ['Name', 'Code'], data);
    const { created } = await upload(masterDataPage, masterDataApi, 'Department', file);
    expect(created).toHaveLength(3);
  });

  test('TC_MD_037 a file where every row is invalid adds nothing', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const tag = uid();
    const file = new CsvBuilder(testInfo.outputDir).csv('all-invalid.csv', ['Name', 'Code'], [['', `AUTO_A_${tag}`], ['AUTO B', ''], ['', '']]);
    const { summary, created } = await upload(masterDataPage, masterDataApi, 'Department', file);
    expect(summary.success).toBe(0);
    expect(created).toEqual([]);
  });

  test('TC_MD_038 a code repeated inside the same file: the second occurrence is a duplicate', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const code = `AUTO_REPEAT_${uid()}`;
    const file = new CsvBuilder(testInfo.outputDir).csv('repeat.csv', ['Name', 'Code'], [['AUTO First', code], ['AUTO Second', code]]);
    const { summary, created } = await upload(masterDataPage, masterDataApi, 'Department', file);
    expect(created).toEqual([code]);
    expect(summary.duplicates).toBe(1);
  });

  test('TC_MD_039 the upload applies to the selected type only', async ({ masterDataPage, masterDataApi }, testInfo) => {
    const tag = uid();
    const departmentsBefore = await codesOf(masterDataApi, 'Department');
    const file = new CsvBuilder(testInfo.outputDir).csv('campus.csv', ['Name', 'Code'], rows(2, tag));
    const { created } = await upload(masterDataPage, masterDataApi, 'Campus', file);
    expect(created).toHaveLength(2);
    expect(await codesOf(masterDataApi, 'Department')).toEqual(departmentsBefore);
  });
});
