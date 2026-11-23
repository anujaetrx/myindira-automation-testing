import { test, expect } from '@fixtures';
import type { Page } from '@playwright/test';
import { CsvBuilder } from '@data/builders/CsvBuilder';
import { masterDataListSchema, type MasterDataApiClient } from '@api/clients/MasterDataApiClient';
import { guardWrites } from '@utils/helpers/guard-writes';
import { writeBomCsv, writeRaw, writeXlsx } from '@utils/helpers/master-data-files.helper';
import type { MasterDataPage, MasterDataType, ValidationSummary } from '@pages/MasterDataPage';

/**
 * Gap review of Jira IUN-3238 (Master Data Management). Adds what the earlier specs did not cover: code/name
 * rules, the add request, duplicate handling, file edge cases, the validation summary, empty/failing lists,
 * retained form state and cross-screen consistency. Traceability: docs/test-cases/master-data-traceability.md
 *
 * SAFETY. The screen has no edit or delete and QA data cannot be removed, so:
 *   - every click that would write runs behind guardWrites + `mockWrites` (answered locally, request asserted);
 *   - server answers (duplicate message, summary numbers, errors) are HAND-BUILT mocks: those tests prove what
 *     the SCREEN does with an answer, not what the server answers;
 *   - tests that really write are in the @writes group, gated by ALLOW_MASTER_DATA_WRITES=true. NOT RUN here.
 *
 * Known deviations use test.fail(true, reason): green while the app differs from the story, red once it is fixed.
 */
const WRITES_ALLOWED = process.env.ALLOW_MASTER_DATA_WRITES === 'true';
const MB = 1024 * 1024;
const LIST_KEY = { Department: 'departments', Campus: 'campuses', Role: 'roles' } as const;
const UPLOAD_TYPE = { Department: 'DEPARTMENT', Campus: 'CAMPUS', Role: 'ROLE' } as const;

test.use({ viewport: { width: 1440, height: 900 } });

const STORY_FILE_ERROR = 'Invalid file. Accepted formats: .csv, .xlsx (Max 10MB).';
const STORY_DUPLICATE_ERROR = 'Entity Name or Code already exists in this category.';
const STORY_HEADER_ERROR = 'Invalid template structure. Required headers: Name, Code.';
const ZERO: ValidationSummary = { total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 };

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------
interface Sent {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Buffer;
  contentType: string;
}
interface Reply {
  status?: number;
  json?: unknown;
  delayMs?: number;
}
const OK_ADD = { success: true, message: 'ok', code: 'OK', data: {} };
const summaryBody = (s: { total: number; success: number; failed: number; dup: number; invalid: number }, errors: unknown[] = []) => ({
  success: true,
  message: 'ok',
  code: 'OK',
  data: { totalRows: s.total, successCount: s.success, failureCount: s.failed, duplicateRows: s.dup, invalidRows: s.invalid, errors },
});

/**
 * Answers Master Data writes locally and records what the screen sent. guardWrites stays underneath as a safety
 * net for any other write call. `replies` lets a test choose the server's answer.
 */
async function mockWrites(
  page: Page,
  replies: { add?: Reply; upload?: Reply } = {},
  onSent?: (s: Sent) => void,
): Promise<Sent[]> {
  await guardWrites(page);
  const sent: Sent[] = [];
  await page.route(/\/myindiranew\/api\/admin\/master-data\/(add|bulk-upload)/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const entry: Sent = {
      method: req.method(),
      path: url.pathname.replace(/^.*\/myindiranew\/api/, ''),
      query: Object.fromEntries(url.searchParams),
      body: req.postDataBuffer() ?? Buffer.alloc(0),
      contentType: req.headers()['content-type'] ?? '',
    };
    sent.push(entry);
    onSent?.(entry);
    const reply = (url.pathname.endsWith('/add') ? replies.add : replies.upload) ?? {};
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    const fallback = url.pathname.endsWith('/add') ? OK_ADD : summaryBody({ total: 1, success: 1, failed: 0, dup: 0, invalid: 0 });
    await route.fulfill({ status: reply.status ?? 200, json: reply.json ?? fallback });
  });
  return sent;
}

type Item = { id: number; code: string; name: string };
const listBody = (data: { departments?: Item[]; campuses?: Item[]; roles?: Item[] }) => ({
  success: true,
  message: 'ok',
  code: 'OK',
  timestamp: new Date().toISOString(),
  data: { departments: data.departments ?? [], campuses: data.campuses ?? [], roles: data.roles ?? [] },
});

/** Replaces the list answer. `reads` counts GET list calls so a test can prove the screen refetched. */
async function mockList(page: Page, answer: () => unknown, status = 200): Promise<{ reads: number }> {
  const counter = { reads: 0 };
  await page.route(/\/myindiranew\/api\/admin\/master-data\/list/, async (route) => {
    counter.reads++;
    await route.fulfill({ status, json: answer() as object });
  });
  return counter;
}

async function openForm(md: MasterDataPage, type?: MasterDataType): Promise<void> {
  await md.goto();
  await md.scrollToForm();
  if (type) await md.chooseType(type);
}

const files = (dir: string) => new CsvBuilder(dir);
const uid = (): string => (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase();

/** story: Total = Success + Failed and Failed = Duplicates + Invalid (the example 10 = 7 + 3, 3 = 2 + 1). */
function expectConsistentSummary(s: ValidationSummary): void {
  expect(s.total, 'Total = Success + Failed').toBe(s.success + s.failed);
  expect(s.failed, 'Failed = Duplicates + Invalid').toBe(s.duplicates + s.invalid);
}

// =====================================================================================
// 1. CODE / NAME RULES (BR-MD-01, validations: CTA state). Nothing is saved.
// =====================================================================================
test.describe('GAP: code and name rules (BR-MD-01) @master-data', () => {
  test('GAP_MD_001 a lowercase code is converted to UPPERCASE on input/blur (Scenario 1, TC_MD_002)', async ({ masterDataPage: md }) => {
    // DEVIATION: the screen keeps what is typed (autoCapitalize only affects phone keyboards).
    test.fail(true, 'BR-MD-01: code is not auto-uppercased on the screen (lab_tech stays lab_tech)');
    await openForm(md, 'Role');
    await md.fillCode('lab_tech');
    await md.code.press('Tab');
    await expect(md.code).toHaveValue('LAB_TECH', { timeout: 1_500 });
  });

  test('GAP_MD_002 leading and trailing spaces in the code are trimmed on blur (BR-MD-01)', async ({ masterDataPage: md }) => {
    test.fail(true, 'BR-MD-01: the field keeps the spaces (they are only trimmed when the request is built, see GAP_MD_005)');
    await openForm(md, 'Role');
    await md.fillCode('  ACAD_HEAD  ');
    await md.code.press('Tab');
    await expect(md.code).toHaveValue('ACAD_HEAD', { timeout: 1_500 });
  });

  const INVALID: [string, string, string][] = [
    ['special character @ in the code (TC_MD_002)', 'Valid Name', 'ACAD@HEAD'],
    ['a space inside the code', 'Valid Name', 'ACAD HEAD'],
    ['a hyphen in the code', 'Valid Name', 'ACAD-HEAD'],
    ['a non-ASCII letter in the code', 'Valid Name', 'ÉCOLE'],
    ['a code of 1 character', 'Valid Name', 'Q'],
    ['a code of 51 characters', 'Valid Name', 'A'.repeat(51)],
    ['a name of 1 character', 'A', 'VALID_CODE'],
    ['a name of 151 characters', 'N'.repeat(151), 'VALID_CODE'],
  ];
  for (const [label, name, code] of INVALID) {
    test(`GAP_MD_003 Add stays disabled for ${label}`, async ({ masterDataPage: md }) => {
      // DEVIATION: the story says Add is disabled until Name (2-150) and Code (2-50, A-Z 0-9 _) are valid.
      // The screen only checks "not empty"; whatever the server decides is the only validation.
      test.fail(true, 'Validations: Add is enabled for values outside the Name 2-150 / Code ^[A-Z0-9_]{2,50}$ rules');
      await openForm(md, 'Role');
      await md.fillRecord(name, code);
      await expect(md.add).toBeDisabled({ timeout: 1_500 });
    });
  }

  const VALID: [string, string, string][] = [
    ['shortest name and code (2 and 2)', 'Ab', 'AB'],
    ['longest name and code (150 and 50)', 'N'.repeat(150), 'C'.repeat(50)],
    ['digits and underscore', 'Role One', 'ROLE_01'],
  ];
  for (const [label, name, code] of VALID) {
    test(`GAP_MD_004 Add is enabled for ${label}`, async ({ masterDataPage: md }) => {
      await openForm(md, 'Role');
      await md.fillRecord(name, code);
      await expect(md.add).toBeEnabled();
      // Not clicked: nothing is saved.
    });
  }
});

// =====================================================================================
// 2. THE ADD REQUEST (what the screen sends) and its feedback. Server answers are mocked.
// =====================================================================================
test.describe('GAP: manual add request and feedback (mocked answers, nothing saved) @master-data', () => {
  for (const type of ['Department', 'Campus', 'Role'] as const) {
    test(`GAP_MD_005 adding a ${type} sends one POST with type, trimmed name and trimmed code`, async ({ adminPage, masterDataPage: md }) => {
      const sent = await mockWrites(adminPage);
      await openForm(md, type);
      await md.fillRecord('  Lab Technician  ', '  LAB_TECH  ');
      await md.add.click();

      await expect(md.toast(`${type} added successfully`)).toBeVisible();
      expect(sent).toHaveLength(1);
      expect(sent[0].method).toBe('POST');
      expect(sent[0].path).toBe('/admin/master-data/add');
      expect(sent[0].query).toEqual({ type: UPLOAD_TYPE[type], name: 'Lab Technician', code: 'LAB_TECH' });
      // After a successful add the form is emptied (and Add is disabled again).
      await expect(md.name).toHaveValue('');
      await expect(md.code).toHaveValue('');
      await expect(md.add).toBeDisabled();
    });
  }

  test('GAP_MD_006 a code typed in lowercase is sent in UPPERCASE (BR-MD-01, Scenario 1)', async ({ adminPage, masterDataPage: md }) => {
    test.fail(true, 'BR-MD-01: the screen sends the code as typed (lab_tech), so only the server can normalise it');
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Role');
    await md.fillRecord('Lab Technician', 'lab_tech');
    await md.add.click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].query.code).toBe('LAB_TECH');
  });

  test('GAP_MD_007 special characters in the name cannot change the other parameters (query is encoded)', async ({ adminPage, masterDataPage: md }) => {
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.fillRecord('R&D / Ops + 100% &code=HACK&type=ROLE', 'RND_OPS');
    await md.add.click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].query.name).toBe('R&D / Ops + 100% &code=HACK&type=ROLE');
    expect(sent[0].query.code).toBe('RND_OPS');
    expect(sent[0].query.type).toBe('DEPARTMENT');
  });

  test('GAP_MD_008 a duplicate rejected by the server shows the server message and keeps the form (Scenario 1)', async ({ adminPage, masterDataPage: md }) => {
    // The message below is a hand-built answer: this proves the SCREEN shows what it receives (verbatim) and does
    // not clear the form. What the real server says is checked by the gated GAP_MD_G01..G04.
    await mockWrites(adminPage, {
      add: { status: 400, json: { success: false, message: STORY_DUPLICATE_ERROR, code: 'VAL_400', data: null } },
    });
    await openForm(md, 'Role');
    await md.fillRecord('Administrator', 'ADMINISTRATION_ROLE');
    await md.add.click();

    // The message appears twice: the screen's own snackbar and a global error toast (OBS: two toasts for one failure).
    await expect(md.toast(STORY_DUPLICATE_ERROR).first()).toBeVisible();
    await expect(md.name).toHaveValue('Administrator');
    await expect(md.code).toHaveValue('ADMINISTRATION_ROLE');
    await expect(md.toast('Role added successfully')).toBeHidden();
  });

  test('GAP_MD_009 a server error without a message shows a failure message and keeps the form', async ({ adminPage, masterDataPage: md }) => {
    await mockWrites(adminPage, { add: { status: 500, json: {} } });
    await openForm(md, 'Role');
    await md.fillRecord('Lab Technician', 'LAB_TECH');
    await md.add.click();

    await expect(md.toast('Failed to add')).toBeVisible();
    await expect(md.toast('Server error. Please try again shortly.')).toBeVisible();
    await expect(md.toast('Role added successfully')).toBeHidden();
    await expect(md.name).toHaveValue('Lab Technician');
  });

  test('GAP_MD_010 a double click on Add sends only one request', async ({ adminPage, masterDataPage: md }) => {
    const sent = await mockWrites(adminPage, { add: { delayMs: 1_500 } });
    await openForm(md, 'Role');
    await md.fillRecord('Lab Technician', 'LAB_TECH');
    await md.add.dblclick();
    await expect(md.toast('Role added successfully')).toBeVisible({ timeout: 10_000 });
    expect(sent.filter((s) => s.path === '/admin/master-data/add')).toHaveLength(1);
  });

  test('GAP_MD_011 BR-MD-04: after a successful add the list is refetched and the count and pill update without a reload', async ({ adminPage, masterDataPage: md }) => {
    // Hand-built lists: the first answer has 2 departments, after the (mocked) add the answer has 3.
    const base: Item[] = [
      { id: 1, code: 'ALPHA', name: 'Alpha Dept' },
      { id: 2, code: 'BETA', name: 'Beta Dept' },
    ];
    let added = false;
    const roles = [{ id: 9, code: 'ADMIN', name: 'Administrator' }];
    await mockWrites(adminPage, {}, () => {
      added = true;
    });
    const list = await mockList(adminPage, () =>
      listBody({ departments: added ? [...base, { id: 3, code: 'GAMMA_NEW', name: 'Gamma New' }] : base, campuses: [{ id: 5, code: 'MAIN', name: 'Main Campus' }], roles }),
    );
    await md.goto();
    await expect(md.sectionHeading('Departments')).toHaveText('Departments (2)');
    const readsBefore = list.reads;

    await md.scrollToForm();
    await md.chooseType('Department');
    await md.fillRecord('Gamma New', 'GAMMA_NEW');
    await md.add.click();

    await expect(md.sectionHeading('Departments')).toHaveText('Departments (3)');
    await expect(adminPageText(adminPage, 'Gamma New (GAMMA_NEW)')).toBeVisible();
    expect(list.reads, 'the list was fetched again').toBeGreaterThan(readsBefore);
    const data = await md.readSections();
    expect(data.Departments.items).toHaveLength(3);
    expect(data.Departments.headingCount).toBe(3);
  });
});

function adminPageText(page: Page, text: string) {
  return page.getByText(text, { exact: true });
}

// =====================================================================================
// 3. TYPE SWITCH AND FORM STATE (Reset, Remove File)
// =====================================================================================
test.describe('GAP: type switch, Reset and Remove File @master-data', () => {
  test('GAP_MD_020 switching the type keeps Name, Code and the chosen file but retitles the form', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await openForm(md, 'Department');
    await md.fillRecord('Keep this name', 'KEEP_THIS');
    await md.chooseFile(files(testInfo.outputDir).csv('keep.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await expect(md.selectedFile('keep.csv')).toBeVisible();

    await md.chooseType('Campus');

    await expect(md.formTitle('Campus')).toBeVisible();
    await expect(md.addButtonFor('Campus')).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Download Campus Template', exact: true })).toBeVisible();
    await expect(md.name).toHaveValue('Keep this name');
    await expect(md.code).toHaveValue('KEEP_THIS');
    await expect(md.selectedFile('keep.csv')).toBeVisible();
    await expect(md.add).toBeEnabled();
  });

  test('GAP_MD_021 after switching the type an upload and an add use the NEW type', async ({ adminPage, masterDataPage: md }, testInfo) => {
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.fillRecord('Switch Name', 'SWITCH_CODE');
    await md.chooseFile(files(testInfo.outputDir).csv('switch.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await md.chooseType('Role');

    await md.clickUpload();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].path).toBe('/admin/master-data/bulk-upload');
    expect(sent[0].query).toEqual({ type: 'ROLE' });

    await md.add.click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1].query.type).toBe('ROLE');
  });

  test('GAP_MD_022 Reset clears a filled Validation Summary, the error list and the file, but keeps the type (TC_MD_005)', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await mockWrites(adminPage, {
      upload: { json: summaryBody({ total: 10, success: 7, failed: 3, dup: 2, invalid: 1 }, [{ rowNumber: 4, fieldName: 'code', errorMessage: 'Duplicate code', rawValue: 'CSE' }]) },
    });
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).csv('ten.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await md.clickUpload();
    await expect(md.rowErrorsTitle).toBeVisible();
    expect(await md.validationSummary()).toEqual({ total: 10, success: 7, failed: 3, duplicates: 2, invalid: 1 });

    await md.clickReset();

    await expect(md.noFileSelected).toBeVisible();
    await expect(md.rowErrorsTitle).toBeHidden();
    expect(await md.validationSummary()).toEqual(ZERO);
    await expect(md.upload).toBeDisabled();
    await expect(md.formTitle('Department')).toBeVisible(); // the chosen type is NOT reset
  });

  test('GAP_MD_023 Remove File clears the file and disables Upload, but leaves an earlier summary on screen', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await mockWrites(adminPage, { upload: { json: summaryBody({ total: 2, success: 2, failed: 0, dup: 0, invalid: 0 }) } });
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).csv('two.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await md.clickUpload();
    await expect.poll(async () => (await md.validationSummary()).total).toBe(2);

    await md.removeFile.click();

    await expect(md.noFileSelected).toBeVisible();
    await expect(md.upload).toBeDisabled();
    expect((await md.validationSummary()).total, 'Remove File does not reset the summary (Reset does)').toBe(2);
  });

  test('GAP_MD_024 Upload stays disabled when a file is chosen but no type is', async ({ masterDataPage: md }, testInfo) => {
    await md.goto();
    await md.scrollToForm();
    await md.chooseFile(files(testInfo.outputDir).csv('notype.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await expect(md.selectedFile('notype.csv')).toBeVisible();
    await expect(md.upload).toBeDisabled();
  });
});

// =====================================================================================
// 4. FILE SELECTION RULES (Scenario 2, TC_MD_004): extension, size, message wording
// =====================================================================================
test.describe('GAP: file extension and size rules (Scenario 2) @master-data', () => {
  const ACCEPTED = ['UPPER.CSV', 'Data.XLSX', 'two.dots.csv', 'with space.csv', 'café.csv'];
  for (const name of ACCEPTED) {
    test(`GAP_MD_030 "${name}" is accepted (extension check is case-insensitive)`, async ({ masterDataPage: md }, testInfo) => {
      await openForm(md, 'Department');
      await md.chooseFile(writeRaw(testInfo.outputDir, name, 'name,code\n'));
      await expect(md.selectedFile(name)).toBeVisible();
      await expect(md.upload).toBeEnabled();
    });
  }

  const REJECTED = ['a.csv.pdf', 'noextension', 'data.csv.exe', 'sheet.xlsm', 'data.tsv', 'data.json'];
  for (const name of REJECTED) {
    test(`GAP_MD_031 "${name}" is rejected with a message and no file is selected`, async ({ masterDataPage: md }, testInfo) => {
      await openForm(md, 'Department');
      await md.chooseFile(writeRaw(testInfo.outputDir, name, 'name,code\n'));
      await expect(md.invalidFileMessage).toBeVisible();
      await expect(md.noFileSelected).toBeVisible();
      await expect(md.upload).toBeDisabled();
    });
  }

  test('GAP_MD_032 the rejection message is the unified story text (Scenario 2, BR validations)', async ({ masterDataPage: md }, testInfo) => {
    // DEVIATION: three different wordings exist. Story: this text. Sheet (TC_MD_026): "Invalid file format. Please
    // upload .csv or .xlsx under 10MB". App: "Only .csv and .xlsx are allowed".
    test.fail(true, 'Story text "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)." is not shown');
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).other('document.pdf', '%PDF-1.4'));
    await expect(md.toast(STORY_FILE_ERROR)).toBeVisible({ timeout: 3_000 });
  });

  test('GAP_MD_033 OBS: a rejected file does not clear an earlier valid choice', async ({ masterDataPage: md }, testInfo) => {
    // Recorded behaviour (not defined by the story): the error appears but the previous valid file stays selected.
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).csv('first.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await expect(md.selectedFile('first.csv')).toBeVisible();
    await md.chooseFile(files(testInfo.outputDir).other('second.pdf', '%PDF-1.4'));
    await expect(md.invalidFileMessage).toBeVisible();
    await expect(md.selectedFile('first.csv')).toBeVisible();
    await expect(md.upload).toBeEnabled();
  });

  test('GAP_MD_034 choosing a second valid file replaces the first', async ({ masterDataPage: md }, testInfo) => {
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).csv('first.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await expect(md.selectedFile('first.csv')).toBeVisible();
    await md.chooseFile(files(testInfo.outputDir).csv('second.csv', ['Name', 'Code'], [['AUTO Two', 'AUTO_TWO']]));
    await expect(md.selectedFile('second.csv')).toBeVisible();
    await expect(md.selectedFile('first.csv')).toBeHidden();
  });

  test('GAP_MD_035 a file of exactly 5 MB is sent to the server', async ({ adminPage, masterDataPage: md }, testInfo) => {
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).sized('five.csv', 5 * MB));
    await md.clickUpload();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].path).toBe('/admin/master-data/bulk-upload');
  });

  test('GAP_MD_036 a 6 MB file (inside the documented 10 MB limit) is sent to the server', async ({ adminPage, masterDataPage: md }, testInfo) => {
    // DEVIATION: the file picker says "Max 10MB" and the story allows 10 MB, but the Upload handler refuses
    // anything over 5 MB with "File size must be under 5 MB" and sends nothing.
    test.fail(true, 'Scenario 2 / Template: limit is 10 MB; the screen enforces 5 MB at Upload time');
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).sized('six.csv', 6 * MB));
    await md.clickUpload();
    await expect.poll(() => sent.length, { timeout: 3_000 }).toBe(1);
  });

  test('GAP_MD_037 a file of exactly 10 MB is sent to the server (boundary)', async ({ adminPage, masterDataPage: md }, testInfo) => {
    test.fail(true, 'Boundary: the file is accepted on selection (TC_MD_029) but Upload then refuses it as over 5 MB');
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).sized('ten.csv', 10 * MB));
    await md.clickUpload();
    await expect.poll(() => sent.length, { timeout: 3_000 }).toBe(1);
  });

  test('GAP_MD_038 a file over 10 MB never reaches the server (Scenario 2)', async ({ adminPage, masterDataPage: md }, testInfo) => {
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).sized('eleven.csv', 11 * MB));
    await md.clickUpload();
    // The screen reports a size problem (its own wording) and sends nothing.
    await expect(md.toast(/File size must be under/)).toBeVisible();
    expect(sent).toHaveLength(0);
  });

  test('GAP_MD_039 a file over 10 MB shows the unified story message (Scenario 2)', async ({ adminPage, masterDataPage: md }, testInfo) => {
    test.fail(true, 'Scenario 2: expected "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)."; app accepts it on selection and says "File size must be under 5 MB" after Upload');
    await mockWrites(adminPage);
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).sized('eleven.csv', 11 * MB));
    // Story: rejected when selected.
    await expect(md.toast(STORY_FILE_ERROR)).toBeVisible({ timeout: 3_000 });
    await expect(md.noFileSelected).toBeVisible();
  });
});

// =====================================================================================
// 5. WHAT THE SCREEN SENDS FOR EDGE FILES (validation of the content is the server's job)
// =====================================================================================
test.describe('GAP: edge-case files are forwarded unchanged to the server (mocked answer) @master-data', () => {
  const EDGE: { label: string; name: string; make: (dir: string) => string; contains: string }[] = [
    { label: 'an empty file', name: 'empty.csv', make: (d) => writeRaw(d, 'empty.csv', ''), contains: '' },
    { label: 'a header-only file', name: 'header-only.csv', make: (d) => writeRaw(d, 'header-only.csv', 'Name,Code\n'), contains: 'Name,Code' },
    { label: 'a file with wrong headers', name: 'wrong-header.csv', make: (d) => writeRaw(d, 'wrong-header.csv', 'Foo,Bar\nx,y\n'), contains: 'Foo,Bar' },
    { label: 'a file with swapped headers', name: 'swapped.csv', make: (d) => writeRaw(d, 'swapped.csv', 'Code,Name\nAUTO_X,AUTO X\n'), contains: 'Code,Name' },
    { label: "the app's own lowercase template header", name: 'lower.csv', make: (d) => writeRaw(d, 'lower.csv', 'name,code\nAUTO X,AUTO_X\n'), contains: 'name,code' },
    { label: 'a file with only one column', name: 'one-col.csv', make: (d) => writeRaw(d, 'one-col.csv', 'Name\nAUTO X\n'), contains: 'Name\r\n'.trim() },
    { label: 'a semicolon-separated file', name: 'semicolon.csv', make: (d) => writeRaw(d, 'semicolon.csv', 'Name;Code\nAUTO X;AUTO_X\n'), contains: 'Name;Code' },
    { label: 'a file with Windows line endings and blank lines', name: 'crlf.csv', make: (d) => writeRaw(d, 'crlf.csv', 'Name,Code\r\nAUTO X,AUTO_X\r\n\r\n\r\n'), contains: 'AUTO X,AUTO_X' },
    { label: 'quoted values with commas and trailing spaces', name: 'quoted.csv', make: (d) => writeRaw(d, 'quoted.csv', 'Name,Code\n"AUTO, Inc. ",  AUTO_Q  \n'), contains: '"AUTO, Inc. "' },
    { label: 'a file with a UTF-8 byte-order mark', name: 'bom.csv', make: (d) => writeBomCsv(d, 'bom.csv', ['Name', 'Code'], [['AUTO X', 'AUTO_X']]), contains: 'AUTO X,AUTO_X' },
  ];
  for (const edge of EDGE) {
    test(`GAP_MD_040 ${edge.label} is sent as it is, in one multipart request`, async ({ adminPage, masterDataPage: md }, testInfo) => {
      const sent = await mockWrites(adminPage);
      await openForm(md, 'Department');
      await md.chooseFile(edge.make(testInfo.outputDir));
      await md.clickUpload();
      await expect.poll(() => sent.length).toBe(1);

      expect(sent[0].method).toBe('POST');
      expect(sent[0].path).toBe('/admin/master-data/bulk-upload');
      expect(sent[0].query).toEqual({ type: 'DEPARTMENT' });
      expect(sent[0].contentType).toMatch(/^multipart\/form-data/);
      const text = sent[0].body.toString('utf8');
      expect(text).toContain(`name="file"; filename="${edge.name}"`);
      // Chromium streams the file part, so its bytes are not visible to request interception: the content itself
      // (BOM, headers, rows) is only verifiable against the real server (gated GAP_MD_G08..G12).
    });
  }

  for (const type of ['Department', 'Campus', 'Role'] as const) {
    test(`GAP_MD_041 a real .xlsx for ${type} is sent with type=${UPLOAD_TYPE[type]}`, async ({ adminPage, masterDataPage: md }, testInfo) => {
      const sent = await mockWrites(adminPage);
      await openForm(md, type);
      await md.chooseFile(writeXlsx(testInfo.outputDir, 'valid.xlsx', ['Name', 'Code'], [['AUTO X', 'AUTO_X']]));
      await md.clickUpload();
      await expect.poll(() => sent.length).toBe(1);
      expect(sent[0].query).toEqual({ type: UPLOAD_TYPE[type] });
      expect(sent[0].body.toString('latin1')).toContain('filename="valid.xlsx"');
    });
  }

  test('GAP_MD_042 Upload is blocked while a request is running (loading state) and a double click sends one request', async ({ adminPage, masterDataPage: md }, testInfo) => {
    const sent = await mockWrites(adminPage, { upload: { delayMs: 1_500 } });
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).csv('slow.csv', ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await md.upload.dblclick();
    await expect(md.reset).toBeDisabled(); // Reset is disabled while uploading
    await expect(md.toast('All records uploaded successfully')).toBeVisible({ timeout: 10_000 });
    expect(sent).toHaveLength(1);
    await expect(md.reset).toBeEnabled();
  });
});

// =====================================================================================
// 6. VALIDATION SUMMARY (Scenario 3, TC_MD_005): how the screen shows the server's numbers
// =====================================================================================
test.describe('GAP: validation summary rendering (hand-built server answers) @master-data', () => {
  const upload = async (md: MasterDataPage, dir: string, name = 'batch.csv') => {
    await md.chooseFile(files(dir).csv(name, ['Name', 'Code'], [['AUTO One', 'AUTO_ONE']]));
    await md.clickUpload();
  };

  test('GAP_MD_050 Scenario 3: Total 10 | Success 7 | Failed 3 | Duplicates 2 | Invalid 1 is shown with the row errors', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await mockWrites(adminPage, {
      upload: {
        json: summaryBody({ total: 10, success: 7, failed: 3, dup: 2, invalid: 1 }, [
          { rowNumber: 3, fieldName: 'code', errorMessage: 'Duplicate code', rawValue: 'CSE' },
          { rowNumber: 5, fieldName: 'name', errorMessage: 'Duplicate name', rawValue: 'Computer Science' },
          { rowNumber: 9, fieldName: 'code', errorMessage: 'Invalid characters', rawValue: 'BAD@CODE' },
        ]),
      },
    });
    await openForm(md, 'Department');
    await upload(md, testInfo.outputDir);

    await expect.poll(async () => (await md.validationSummary()).total).toBe(10);
    const summary = await md.validationSummary();
    expect(summary).toEqual({ total: 10, success: 7, failed: 3, duplicates: 2, invalid: 1 });
    expectConsistentSummary(summary);
    await expect(md.toast('Upload completed with errors')).toBeVisible();
    await expect(md.rowErrorsTitle).toBeVisible();
    await expect(adminPage.getByText('Row 9 - code: Invalid characters', { exact: true })).toBeVisible();
  });

  test('GAP_MD_051 all rows succeed: success message, no error card', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await mockWrites(adminPage, { upload: { json: summaryBody({ total: 3, success: 3, failed: 0, dup: 0, invalid: 0 }) } });
    await openForm(md, 'Role');
    await upload(md, testInfo.outputDir);
    await expect(md.toast('All records uploaded successfully')).toBeVisible();
    expect(await md.validationSummary()).toEqual({ total: 3, success: 3, failed: 0, duplicates: 0, invalid: 0 });
    await expect(md.rowErrorsTitle).toBeHidden();
  });

  test('GAP_MD_052 more than 20 errors: the first 20 rows are listed and the rest is summarised', async ({ adminPage, masterDataPage: md }, testInfo) => {
    const errors = Array.from({ length: 25 }, (_, i) => ({ rowNumber: i + 2, fieldName: 'code', errorMessage: 'Invalid characters', rawValue: `BAD${i}` }));
    await mockWrites(adminPage, { upload: { json: summaryBody({ total: 25, success: 0, failed: 25, dup: 0, invalid: 25 }, errors) } });
    await openForm(md, 'Department');
    await upload(md, testInfo.outputDir);

    await expect(adminPage.getByText('Row 21 - code: Invalid characters', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Row 22 - code: Invalid characters', { exact: true })).toBeHidden();
    // OBS: the text points to a downloadable error report, but this screen offers none.
    await expect(adminPage.getByText(/^\+5 more errors/)).toBeVisible();
  });

  test('GAP_MD_053 an answer without counters shows zeros instead of breaking', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await mockWrites(adminPage, { upload: { json: { success: true, message: 'ok', code: 'OK', data: {} } } });
    await openForm(md, 'Department');
    await upload(md, testInfo.outputDir);
    await expect(md.toast('All records uploaded successfully')).toBeVisible();
    expect(await md.validationSummary()).toEqual(ZERO);
  });

  test('GAP_MD_054 the invalid-header rejection shows the story message (validations: Template Header Validation)', async ({ adminPage, masterDataPage: md }, testInfo) => {
    // The screen itself only says "Upload failed..." (GAP_MD_055), but a global error toast shows the server's message,
    // so the story text reaches the user. The REAL server text is checked by the gated GAP_MD_G08.
    await mockWrites(adminPage, { upload: { status: 400, json: { success: false, message: STORY_HEADER_ERROR, code: 'VAL_400', data: null } } });
    await openForm(md, 'Department');
    await md.chooseFile(files(testInfo.outputDir).csv('no-headers.csv', ['Foo', 'Bar'], [['x', 'y']]));
    await md.clickUpload();
    await expect(md.toast(STORY_HEADER_ERROR).first()).toBeVisible({ timeout: 3_000 });
  });

  test('GAP_MD_055 a failed upload shows a failure message and leaves the counters at zero', async ({ adminPage, masterDataPage: md }, testInfo) => {
    await mockWrites(adminPage, { upload: { status: 500, json: { success: false, message: 'boom', code: 'ERR', data: null } } });
    await openForm(md, 'Department');
    await upload(md, testInfo.outputDir);
    await expect(md.toast('Upload failed. Please review file and retry.')).toBeVisible();
    expect(await md.validationSummary()).toEqual(ZERO);
    await expect(md.rowErrorsTitle).toBeHidden();
  });

  test('GAP_MD_056 a failed upload does not leave the previous file\'s counters on screen', async ({ adminPage, masterDataPage: md }, testInfo) => {
    // Candidate UX defect (low): the story does not say, but counters of a file that is no longer the current
    // attempt are misleading. The screen only replaces them on success.
    test.fail(true, 'Stale counters: after a failed upload the previous summary is still displayed');
    let calls = 0;
    await guardWrites(adminPage);
    await adminPage.route(/\/myindiranew\/api\/admin\/master-data\/bulk-upload/, async (route) => {
      calls++;
      if (calls === 1) await route.fulfill({ json: summaryBody({ total: 4, success: 4, failed: 0, dup: 0, invalid: 0 }) });
      else await route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR', data: null } });
    });
    await openForm(md, 'Department');
    await upload(md, testInfo.outputDir, 'one.csv');
    await expect.poll(async () => (await md.validationSummary()).total).toBe(4);
    await upload(md, testInfo.outputDir, 'two.csv');
    await expect(md.toast('Upload failed. Please review file and retry.')).toBeVisible();
    expect((await md.validationSummary()).total).toBe(0);
  });

  test('GAP_MD_057 BR-MD-04: a successful upload refetches the list', async ({ adminPage, masterDataPage: md }, testInfo) => {
    let uploaded = false;
    await mockWrites(adminPage, { upload: { json: summaryBody({ total: 1, success: 1, failed: 0, dup: 0, invalid: 0 }) } }, () => {
      uploaded = true;
    });
    const base: Item[] = [{ id: 1, code: 'ALPHA', name: 'Alpha Campus' }];
    const list = await mockList(adminPage, () =>
      listBody({ departments: [{ id: 1, code: 'D1', name: 'Dept One' }], campuses: uploaded ? [...base, { id: 2, code: 'BULK_NEW', name: 'Bulk New' }] : base, roles: [{ id: 9, code: 'ADMIN', name: 'Administrator' }] }),
    );
    await md.goto();
    await expect(md.sectionHeading('Campuses')).toHaveText('Campuses (1)');
    const before = list.reads;
    await md.scrollToForm();
    await md.chooseType('Campus');
    await upload(md, testInfo.outputDir);
    await expect(md.sectionHeading('Campuses')).toHaveText('Campuses (2)');
    expect(list.reads).toBeGreaterThan(before);
  });
});

// =====================================================================================
// 7. TEMPLATE DOWNLOAD (reads only: GET template)
// =====================================================================================
test.describe('GAP: template download @master-data', () => {
  for (const type of ['Department', 'Campus', 'Role'] as const) {
    test(`GAP_MD_060 downloading the ${type} template shows a confirmation and gives a CSV with exactly one header line`, async ({ masterDataPage: md }) => {
      await openForm(md, type);
      const toast = expect(md.toast(`${type} template downloaded`)).toBeVisible(); // the toast lasts about 2.5 s
      const { fileName, content } = await md.downloadSampleTemplate();
      await toast;
      expect(fileName).toMatch(/\.csv$/);
      const lines = content.split(/\r?\n/).filter(Boolean);
      expect(lines, 'header line only (the story says "pre-structured CSV containing standard header columns")').toHaveLength(1);
      expect(lines[0].split(',').map((c) => c.trim().toLowerCase())).toEqual(['name', 'code']);
    });
  }

  test('GAP_MD_061 the template header is written exactly as the story names it: Name, Code', async ({ masterDataPage: md }) => {
    test.fail(true, 'Story: headers "Name, Code"; app template is lowercase "name,code" (see also TC_MD_023)');
    await openForm(md, 'Department');
    const { content } = await md.downloadSampleTemplate();
    expect(content.split(/\r?\n/)[0].replace(/\s/g, '')).toBe('Name,Code');
  });

  test('GAP_MD_062 the downloaded template can be chosen again as an upload file (round trip, nothing sent)', async ({ adminPage, masterDataPage: md }, testInfo) => {
    const sent = await mockWrites(adminPage);
    await openForm(md, 'Role');
    const { content } = await md.downloadSampleTemplate();
    await md.chooseFile(writeRaw(testInfo.outputDir, 'role-template.csv', content));
    await expect(md.selectedFile('role-template.csv')).toBeVisible();
    await expect(md.upload).toBeEnabled();
    expect(sent).toHaveLength(0);
  });
});

// =====================================================================================
// 8. EMPTY, FAILING AND ODD LISTS (hand-built list answers)
// =====================================================================================
test.describe('GAP: list states (hand-built list answers) @master-data', () => {
  test('GAP_MD_070 an entity type with no records shows "(0)" and an empty message (TC_MD_002)', async ({ adminPage, masterDataPage: md }) => {
    test.fail(true, 'TC_MD_002: sections with no records are not rendered at all (no heading, no count 0, no message)');
    await mockList(adminPage, () => listBody({ departments: [], campuses: [{ id: 1, code: 'MAIN', name: 'Main Campus' }], roles: [{ id: 9, code: 'ADMIN', name: 'Administrator' }] }));
    await adminPage.goto('/master-data');
    await md.waitForTitle();
    await expect(adminPage.getByText('Departments (0)', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test('GAP_MD_071 with no records at all the page still opens with the form', async ({ adminPage, masterDataPage: md }) => {
    await mockList(adminPage, () => listBody({}));
    await adminPage.goto('/master-data');
    await md.waitForTitle();
    await md.scrollToForm();
    await expect(md.dropdown).toBeVisible();
    await expect(md.sectionHeading('Departments')).toHaveCount(0);
  });

  test('GAP_MD_072 when the list call fails the page does not crash and shows no invented counts', async ({ adminPage, masterDataPage: md }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await mockList(adminPage, () => ({ success: false, message: 'boom', code: 'ERR', data: null }), 500);
    await adminPage.goto('/master-data');
    await md.waitForTitle();
    await md.scrollToForm();
    await expect(md.sectionHeading('Departments')).toHaveCount(0);
    expect(errors, 'uncaught page errors').toEqual([]);
  });

  test('GAP_MD_073 when the list call fails an error message is shown', async ({ adminPage, masterDataPage: md }) => {
    test.fail(true, 'Candidate defect (medium): on a failed list call the screen is silently empty; no error or retry is offered');
    await mockList(adminPage, () => ({ success: false, message: 'boom', code: 'ERR', data: null }), 500);
    await adminPage.goto('/master-data');
    await md.waitForTitle();
    await expect(adminPage.getByText(/failed to load|error loading|something went wrong|unable to|try again|retry/i).first()).toBeVisible({ timeout: 3_000 });
  });

  test('GAP_MD_074 names with HTML and brackets are shown as text (no injection) and keep their code', async ({ adminPage, masterDataPage: md }) => {
    await mockList(adminPage, () =>
      listBody({
        departments: [
          { id: 1, code: 'XSS_TEST', name: '<img src=x onerror=window.__pwned=1> Dept' },
          { id: 2, code: 'RND', name: 'R&D (Labs)' },
        ],
        campuses: [{ id: 3, code: 'MAIN', name: 'Main Campus' }],
        roles: [{ id: 9, code: 'ADMIN', name: 'Administrator' }],
      }),
    );
    await md.goto();
    await expect(md.sectionHeading('Departments')).toHaveText('Departments (2)');
    await expect(adminPage.locator('img[src="x"]')).toHaveCount(0);
    expect(await adminPage.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(adminPage.getByText('<img src=x onerror=window.__pwned=1> Dept (XSS_TEST)', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('R&D (Labs) (RND)', { exact: true })).toBeVisible();
  });
});

// =====================================================================================
// 9. CROSS-SCREEN CONSISTENCY (read only): Master Data feeds the Policies screen
// =====================================================================================
test.describe('GAP: Master Data versus Policies (read only) @master-data', () => {
  test('GAP_MD_080 the Policies department filter offers exactly the Master Data departments', async ({ masterDataPage: md, policiesPage: p, adminPage }) => {
    await md.goto();
    const master = (await md.readSections()).Departments;

    await p.goto();
    await p.openFilter();
    // The flyout is a virtualised list: scroll it and collect the union of what is rendered.
    const box = await p.filterSearchBox.boundingBox();
    if (box) await adminPage.mouse.move(box.x + 20, box.y + 200);
    const seen = new Set<string>();
    let stable = 0;
    for (let i = 0; i < 40 && stable < 3; i++) {
      const before = seen.size;
      for (const n of await p.filterOptionNames()) seen.add(n);
      stable = seen.size === before ? stable + 1 : 0;
      await adminPage.mouse.wheel(0, 500);
      await adminPage.waitForTimeout(150); // let the virtualised rows render
    }
    seen.delete('All');
    expect(seen.size, 'filter options vs Master Data heading count').toBe(master.headingCount);
    expect([...seen].sort()).toEqual(master.items.map((i) => i.name).sort());
  });

  test('GAP_MD_081 the Create Policy department pills equal the Master Data departments', async ({ masterDataPage: md, policiesPage: p }) => {
    await md.goto();
    const master = (await md.readSections()).Departments;

    await p.goto();
    await p.openCreateModal();
    const pills = await p.modalDepartmentNames();
    expect(pills.length, 'pill count vs Master Data heading count').toBe(master.headingCount);
    expect([...pills].sort()).toEqual(master.items.map((i) => i.name).sort());
    // The modal is not submitted and nothing is saved.
  });
});

// =====================================================================================
// 10. GATED: REAL WRITES (ALLOW_MASTER_DATA_WRITES=true). NOT RUN: records cannot be removed from the UI.
// =====================================================================================
test.describe('GAP: real server behaviour (WRITES DATA) @master-data @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Saves records that cannot be deleted from the UI. Set ALLOW_MASTER_DATA_WRITES=true to run.');
  test.describe.configure({ mode: 'serial' });

  async function listOf(api: MasterDataApiClient, type: MasterDataType): Promise<Item[]> {
    const { data } = await (await api.list()).body(masterDataListSchema);
    return data[LIST_KEY[type]];
  }

  /** Types the record, clicks Add (real request) and returns the toast text and the codes that were created. */
  async function addReal(md: MasterDataPage, api: MasterDataApiClient, type: MasterDataType, name: string, code: string) {
    const before = (await listOf(api, type)).map((i) => i.code);
    await openForm(md, type);
    await md.fillRecord(name, code);
    const feedback = await md.captureFeedback(async () => {
      await md.submitAdd();
    });
    const after = (await listOf(api, type)).map((i) => i.code);
    return { feedback, created: after.filter((c) => !before.includes(c)), grew: after.length - before.length };
  }

  async function uploadReal(md: MasterDataPage, api: MasterDataApiClient, type: MasterDataType, file: string) {
    const before = (await listOf(api, type)).map((i) => i.code);
    await openForm(md, type);
    await md.chooseFile(file);
    const feedback = await md.captureFeedback(async () => {
      await md.uploadAndWait();
    });
    const summary = await md.validationSummary();
    const after = (await listOf(api, type)).map((i) => i.code);
    return { feedback, summary, created: after.filter((c) => !before.includes(c)) };
  }

  const rows = (n: number, tag: string): string[][] => Array.from({ length: n }, (_, i) => [`AUTO Gap ${tag} ${i}`, `AUTO_GAP_${tag}_${i}`]);

  test('GAP_MD_G01 Scenario 1: an existing Role NAME is blocked with the story message', async ({ masterDataPage: md, masterDataApi }) => {
    const { feedback, created } = await addReal(md, masterDataApi, 'Role', 'Administrator', `AUTO_G_${uid()}`);
    expect(feedback.join(' | ')).toContain(STORY_DUPLICATE_ERROR);
    expect(created).toEqual([]);
  });

  test('GAP_MD_G02 Scenario 1: an existing Role CODE is blocked with the story message', async ({ masterDataPage: md, masterDataApi }) => {
    const { feedback, created } = await addReal(md, masterDataApi, 'Role', `AUTO Gap ${uid()}`, 'ADMIN');
    expect(feedback.join(' | ')).toContain(STORY_DUPLICATE_ERROR);
    expect(created).toEqual([]);
  });

  test('GAP_MD_G03 BR-MD-02: duplicate names are matched case-insensitively and ignoring outer spaces', async ({ masterDataPage: md, masterDataApi }) => {
    for (const name of ['administrator', 'ADMINISTRATOR', '  Administrator  ']) {
      const { created } = await addReal(md, masterDataApi, 'Role', name, `AUTO_G_${uid()}`);
      expect(created, `name "${name}"`).toEqual([]);
    }
  });

  test('GAP_MD_G04 BR-MD-02: a duplicate code typed in lowercase or with spaces is still a duplicate', async ({ masterDataPage: md, masterDataApi }) => {
    for (const code of ['admin', '  ADMIN  ']) {
      const { created } = await addReal(md, masterDataApi, 'Role', `AUTO Gap ${uid()}`, code);
      expect(created, `code "${code}"`).toEqual([]);
    }
  });

  test('GAP_MD_G05 BR-MD-01: a lowercase code with outer spaces is stored UPPERCASE and trimmed', async ({ masterDataPage: md, masterDataApi }) => {
    const id = uid();
    const { created } = await addReal(md, masterDataApi, 'Role', `AUTO Gap Lower ${id}`, `  auto_gap_lower_${id.toLowerCase()}  `);
    expect(created).toEqual([`AUTO_GAP_LOWER_${id}`]);
  });

  test('GAP_MD_G06 Scenario 3: 10 rows (7 valid, 2 duplicates, 1 invalid code) give Total 10 | Success 7 | Failed 3 | Duplicates 2 | Invalid 1', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const tag = uid();
    const existing = await listOf(masterDataApi, 'Department');
    const data = [
      ...rows(7, tag),
      ['AUTO Gap Dup Code', existing[0].code], // duplicate code
      [existing[1].name, `AUTO_GAP_DUPNAME_${tag}`], // duplicate name, new code
      [`AUTO Gap Bad ${tag}`, 'BAD@CODE'], // invalid special character
    ];
    const { summary, created } = await uploadReal(md, masterDataApi, 'Department', files(testInfo.outputDir).csv('scenario3.csv', ['Name', 'Code'], data));
    expect(summary).toEqual({ total: 10, success: 7, failed: 3, duplicates: 2, invalid: 1 });
    expectConsistentSummary(summary);
    expect(created).toHaveLength(7);
  });

  test('GAP_MD_G07 BR-MD-02: CSV duplicates are case-insensitive and ignore outer spaces (code, name)', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const existing = await listOf(masterDataApi, 'Department');
    const data = [
      ['AUTO Gap Case Code', existing[0].code.toLowerCase()],
      [existing[1].name.toUpperCase(), `AUTO_GAP_CASE_${uid()}`],
      ['AUTO Gap Space Code', `  ${existing[2].code}  `],
    ];
    const { summary, created } = await uploadReal(md, masterDataApi, 'Department', files(testInfo.outputDir).csv('case-dups.csv', ['Name', 'Code'], data));
    expect(created).toEqual([]);
    expect(summary.duplicates).toBe(3);
    expectConsistentSummary(summary);
  });

  test('GAP_MD_G08 validations: a file without Name, Code headers is rejected with the story message', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const { feedback, created } = await uploadReal(md, masterDataApi, 'Department', files(testInfo.outputDir).csv('no-headers.csv', ['Foo', 'Bar'], [['x', 'y']]));
    expect(created).toEqual([]);
    expect(feedback.join(' | ')).toContain(STORY_HEADER_ERROR);
  });

  test('GAP_MD_G09 an empty file and a header-only file add nothing and do not produce a server error', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    for (const [name, content] of [['empty.csv', ''], ['header-only.csv', 'Name,Code\n']] as const) {
      const { created, feedback } = await uploadReal(md, masterDataApi, 'Department', writeRaw(testInfo.outputDir, name, content));
      expect(created, name).toEqual([]);
      expect(feedback.join(' | '), name).not.toMatch(/500|internal server/i);
    }
  });

  test('GAP_MD_G10 a UTF-8 BOM CSV with one valid row is accepted (the BOM does not break the Name header)', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const id = uid();
    const { summary, created } = await uploadReal(md, masterDataApi, 'Department', writeBomCsv(testInfo.outputDir, 'bom.csv', ['Name', 'Code'], [[`AUTO Gap Bom ${id}`, `AUTO_GAP_BOM_${id}`]]));
    expect(summary.success).toBe(1);
    expect(created).toEqual([`AUTO_GAP_BOM_${id}`]);
  });

  test("GAP_MD_G11 the app's own lowercase template header (name,code) is accepted", async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const id = uid();
    const file = writeRaw(testInfo.outputDir, 'template-filled.csv', `name,code\nAUTO Gap Tpl ${id},AUTO_GAP_TPL_${id}\n`);
    const { summary, created } = await uploadReal(md, masterDataApi, 'Campus', file);
    expect(summary.success).toBe(1);
    expect(created).toEqual([`AUTO_GAP_TPL_${id}`]);
  });

  test('GAP_MD_G12 a real .xlsx with 2 valid rows is accepted like a CSV', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const tag = uid();
    const file = writeXlsx(testInfo.outputDir, 'valid.xlsx', ['Name', 'Code'], rows(2, tag));
    const { summary, created } = await uploadReal(md, masterDataApi, 'Campus', file);
    expect(summary).toEqual({ total: 2, success: 2, failed: 0, duplicates: 0, invalid: 0 });
    expect(created).toHaveLength(2);
  });

  test('GAP_MD_G13 validations: a code of 51 characters or with a space inside is counted as Invalid in a CSV', async ({ masterDataPage: md, masterDataApi }, testInfo) => {
    const tag = uid();
    const data = [
      [`AUTO Gap Long ${tag}`, 'A'.repeat(51)],
      [`AUTO Gap Space ${tag}`, 'AUTO GAP SPACE'],
      [`AUTO Gap Short ${tag}`, 'Q'],
      ['N'.repeat(151), `AUTO_GAP_LONGNAME_${tag}`],
    ];
    const { summary, created } = await uploadReal(md, masterDataApi, 'Department', files(testInfo.outputDir).csv('invalid-values.csv', ['Name', 'Code'], data));
    expect(created).toEqual([]);
    expect(summary.invalid).toBe(4);
    expectConsistentSummary(summary);
  });
});
