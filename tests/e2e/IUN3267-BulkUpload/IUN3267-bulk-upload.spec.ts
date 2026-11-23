import fs from 'node:fs';
import { test as base, expect } from '@fixtures';
import { BulkUploadPage, UPLOAD_TYPES, type UploadType } from '@pages/BulkUploadPage';
import { guardWrites } from '@utils/helpers/guard-writes';
import { readXlsxRows } from '@utils/helpers/xlsx.helper';
import {
  buildCsv,
  buildXlsx,
  installUploadSpy,
  STUDENT_HEADER,
  studentRow,
  summaryBody,
  tmpPath,
  writeCsvOfSize,
  writeFile,
} from '@utils/helpers/bulk-upload.helper';

/**
 * IUN-3267 "UMS & MyIndira User Synchronization, Bulk Onboarding (INS & Chanakya Campus) & Microsoft SSO":
 * the part of the story that lives on the Bulk Upload screen. The SSO login itself belongs to IUN-3224 (auth specs);
 * the UMS webhook / JIT sync has no screen. Results and open questions: docs/test-cases/bulk-upload.md
 *
 * SAFETY: an upload creates real users in the shared QA environment and cannot be undone from the UI. Every test
 * that presses Upload runs behind guardWrites() + installUploadSpy(): the POST is answered locally, nothing is
 * created, and the test asserts what the screen sent. Validation results are MOCKED responses (the screen only
 * renders them), so they prove the display, not the server rules.
 *
 * Groups: 1 page + template (read only), 2 file selection, 3 what Upload sends, 4 results display (mocked),
 * 5 history, 6 known deviations (test.fail), 7 gated real upload (not run).
 */
const test = base.extend<{ bulkUploadPage: BulkUploadPage }>({
  bulkUploadPage: async ({ adminPage }, use) => use(new BulkUploadPage(adminPage)),
});

const WRITES_ALLOWED = process.env.ALLOW_BULKUPLOAD_WRITES === 'true';
const MB = 1024 * 1024;
const DASH = '—';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const campusCsv = (): string =>
  buildCsv([STUDENT_HEADER, studentRow(1, 'INS'), studentRow(2, 'Chanakya Campus')]);

// =====================================================================================
// 1. Page structure and template download
// =====================================================================================
test.describe('BU_01 screen @bulk-upload', () => {
  test('BU_01 Bulk Upload opens from the sidebar with every card and nothing enabled', async ({ bulkUploadPage: b, adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.getByText('Bulk Upload', { exact: true }).first().click();
    await b.waitForReady();
    expect(b.currentPath()).toBe('/bulk-upload');
    await expect(b.heading).toBeVisible();
    for (const heading of ['Upload Type Selector', 'Template Download', 'File Upload', 'Upload Actions', 'Validation Summary', 'Row-wise Error Preview', 'Upload History', 'Error Report Download']) {
      await expect(adminPage.getByText(heading, { exact: true })).toBeVisible();
    }
    await expect(b.noFileText).toBeVisible();
    await expect(adminPage.getByText('Accepted: .csv, .xlsx | Max 10MB', { exact: true })).toBeVisible();
    expect(await b.isDisabled(b.upload), 'Upload disabled with no type and no file').toBe(true);
    expect(await b.isDisabled(adminPage.getByRole('button', { name: 'Download Type Template' })), 'template disabled with no type').toBe(true);
    await expect.poll(() => b.summary()).toEqual({ total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 });
    await expect(b.errorsEmpty).toBeVisible();
  });

  test('BU_01 the upload type menu offers exactly STUDENT, EMPLOYEE, ADMIN, BIRTHDAY, TITLE', async ({ bulkUploadPage: b }) => {
    await b.goto();
    await b.openTypeMenu();
    expect(await b.menuItems.allInnerTexts()).toEqual(UPLOAD_TYPES);
  });

  test('BU_01 choosing a type shows it on the selector and enables the template button', async ({ bulkUploadPage: b, adminPage }) => {
    await b.goto();
    await b.selectType('EMPLOYEE');
    await expect(b.typeSelector).toHaveText('EMPLOYEE');
    expect(await b.isDisabled(adminPage.getByRole('button', { name: 'Download EMPLOYEE Template' }))).toBe(false);
    expect(await b.isDisabled(b.upload), 'still no file, so Upload stays disabled').toBe(true);
  });
});

test.describe('BU_02 template download @bulk-upload', () => {
  const expected: Record<UploadType, string[]> = {
    STUDENT: ['fullName', 'officialEmail', 'email', 'mobile', 'department', 'campus', 'status', 'studentCode', 'year', 'semester', 'course', 'division', 'title'],
    EMPLOYEE: ['fullName', 'officialEmail', 'email', 'mobile', 'department', 'campus', 'status', 'employeeCode', 'designation', 'title'],
    ADMIN: ['fullName', 'officialEmail', 'email', 'mobile', 'department', 'campus', 'status'],
    BIRTHDAY: ['email', 'birthDate'],
    TITLE: ['email', 'title'],
  };

  for (const type of UPLOAD_TYPES) {
    test(`BU_02 ${type} template downloads as ${type.toLowerCase()}-template.csv with the expected columns`, async ({ bulkUploadPage: b, adminPage }) => {
      await b.goto();
      await b.selectType(type);
      const req = adminPage.waitForRequest((r) => r.url().includes(`/admin/users/template/${type}`));
      const download = await b.downloadTemplate();
      expect((await req).method()).toBe('GET');
      expect(download.suggestedFilename()).toBe(`${type.toLowerCase()}-template.csv`);
      const file = tmpPath(`${type}.csv`);
      await download.saveAs(file);
      const text = fs.readFileSync(file, 'utf8');
      expect(text.split(/\r?\n/)[0].split(',')).toEqual(expected[type]);
    });
  }

  for (const type of ['STUDENT', 'EMPLOYEE', 'ADMIN'] as UploadType[]) {
    test(`BU_02 ${type} template carries the officialEmail (Microsoft ID) and campus columns (BR-SYNC-02, BR-SYNC-05)`, async ({ bulkUploadPage: b }) => {
      await b.goto();
      await b.selectType(type);
      const download = await b.downloadTemplate();
      const file = tmpPath(`${type}-cols.csv`);
      await download.saveAs(file);
      const header = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].split(',');
      expect(header).toContain('officialEmail');
      expect(header).toContain('campus');
      expect(header).toContain('fullName');
    });
  }

  test('BU_02 downloading shows the "template downloaded" message', async ({ bulkUploadPage: b }) => {
    await b.goto();
    await b.selectType('STUDENT');
    await b.downloadTemplate();
    await expect(b.snackbar('STUDENT template downloaded')).toBeVisible();
  });

  test('BU_02 a failing template request shows "Failed to download template" and no file', async ({ bulkUploadPage: b, adminPage }) => {
    await adminPage.route(/\/admin\/users\/template\//, (route) => route.fulfill({ status: 500, json: { success: false, message: 'boom' } }));
    let downloaded = false;
    adminPage.on('download', () => (downloaded = true));
    await b.goto();
    await b.selectType('STUDENT');
    await b.clickTemplate();
    await expect(b.snackbar('Failed to download template')).toBeVisible();
    expect(downloaded).toBe(false);
  });
});

// =====================================================================================
// 2. File selection and validation in the browser
// =====================================================================================
test.describe('BU_03 file selection @bulk-upload', () => {
  test('BU_03 a .csv is shown by name and can be removed', async ({ bulkUploadPage: b }) => {
    await b.goto();
    const f = writeFile(tmpPath('f'), 'ins-users.csv', campusCsv());
    await b.chooseFile(f);
    await expect(b.removeFileBtn).toBeVisible();
    expect(await b.selectedFileName()).toBe('ins-users.csv');
    await b.removeFile();
    await expect(b.noFileText).toBeVisible();
    await expect(b.removeFileBtn).toBeHidden();
  });

  test('BU_03 a real .xlsx is accepted (and our generated workbook reads back)', async ({ bulkUploadPage: b }) => {
    await b.goto();
    const rows = [STUDENT_HEADER, studentRow(1, 'INS')];
    const f = writeFile(tmpPath('f'), 'ins-users.xlsx', buildXlsx(rows));
    expect(readXlsxRows(fs.readFileSync(f))[1][5], 'campus cell of the generated workbook').toBe('INS');
    await b.chooseFile(f);
    await expect(b.removeFileBtn).toBeVisible();
    expect(await b.selectedFileName()).toBe('ins-users.xlsx');
  });

  test('BU_03 an upper-case extension (.CSV) is accepted', async ({ bulkUploadPage: b }) => {
    await b.goto();
    await b.chooseFile(writeFile(tmpPath('f'), 'USERS.CSV', campusCsv()));
    await expect(b.removeFileBtn).toBeVisible();
    expect(await b.selectedFileName()).toBe('USERS.CSV');
  });

  for (const name of ['users.txt', 'users.pdf', 'users.xls', 'users.csv.exe', 'users']) {
    test(`BU_03 "${name}" is rejected with "Only .csv and .xlsx are allowed" and not attached`, async ({ bulkUploadPage: b }) => {
      await b.goto();
      await b.selectType('STUDENT');
      await b.chooseFile(writeFile(tmpPath('f'), name, 'a,b\n1,2\n'));
      await expect(b.snackbar('Only .csv and .xlsx are allowed')).toBeVisible();
      await expect(b.noFileText).toBeVisible();
      expect(await b.isDisabled(b.upload)).toBe(true);
    });
  }

  test('BU_03 Upload needs BOTH a type and a file', async ({ bulkUploadPage: b }) => {
    await b.goto();
    const f = writeFile(tmpPath('f'), 'a.csv', campusCsv());
    await b.chooseFile(f);
    expect(await b.isDisabled(b.upload), 'file but no type').toBe(true);
    await b.selectType('STUDENT');
    expect(await b.isDisabled(b.upload), 'type and file').toBe(false);
    await b.removeFile();
    expect(await b.isDisabled(b.upload), 'type but no file').toBe(true);
  });

  test('BU_03 an empty (0 byte) .csv can be attached; the server must reject it', async ({ bulkUploadPage: b }) => {
    await b.goto();
    await b.chooseFile(writeFile(tmpPath('f'), 'empty.csv', ''));
    await expect(b.removeFileBtn).toBeVisible();
    expect(await b.selectedFileName()).toBe('empty.csv');
  });
});

test.describe('BU_04 file size limit @bulk-upload', () => {
  test('BU_04 a file of exactly 5 MB is sent (boundary)', async ({ bulkUploadPage: b, adminPage }) => {
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage);
    await b.goto();
    await b.selectType('STUDENT');
    await b.chooseFile(writeCsvOfSize(tmpPath('f'), 'five.csv', 5 * MB));
    await b.clickUpload();
    await expect(adminPage.getByText(/^All \d+ users uploaded successfully$/)).toBeVisible();
    expect(spy.calls).toHaveLength(1);
  });

  test('BU_04 a file 1 byte over 5 MB is blocked with "File size must be under 5 MB" and nothing is sent', async ({ bulkUploadPage: b, adminPage }) => {
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage);
    await b.goto();
    await b.selectType('STUDENT');
    await b.chooseFile(writeCsvOfSize(tmpPath('f'), 'over.csv', 5 * MB + 1));
    await b.clickUpload();
    await expect(b.snackbar('File size must be under 5 MB')).toBeVisible();
    expect(spy.calls).toHaveLength(0);
  });

  test('BU_04 a 7 MB file is accepted because the screen says "Max 10MB"', async ({ bulkUploadPage: b, adminPage }) => {
    test.fail(true, 'The label says Max 10MB but the code rejects anything over 5 MB');
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage);
    await b.goto();
    await b.selectType('STUDENT');
    await b.chooseFile(writeCsvOfSize(tmpPath('f'), 'seven.csv', 7 * MB));
    await b.clickUpload();
    await expect.poll(() => spy.calls.length).toBe(1);
  });
});

// =====================================================================================
// 3. What Upload sends (guarded, never reaches the server)
// =====================================================================================
test.describe('BU_05 upload request @bulk-upload', () => {
  for (const type of UPLOAD_TYPES) {
    test(`BU_05 ${type}: Upload sends one multipart POST to /admin/users/bulk-upload?type=${type}`, async ({ bulkUploadPage: b, adminPage }) => {
      const writes = await guardWrites(adminPage);
      const spy = await installUploadSpy(adminPage);
      await b.goto();
      await b.selectType(type);
      await b.chooseFile(writeFile(tmpPath('f'), 'users.csv', campusCsv()));
      await b.clickUpload();
      await expect(adminPage.getByText(/^All \d+ users uploaded successfully$/)).toBeVisible();
      expect(spy.calls).toHaveLength(1);
      expect(spy.calls[0]).toMatchObject({ method: 'POST', url: '/myindiranew/api/admin/users/bulk-upload', type });
      expect(spy.calls[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
      expect(writes, 'no other write call').toHaveLength(0);
    });
  }

  test('BU_05 the INS and Chanakya Campus rows reach the server untouched (TC_SYNC_003, TC_SYNC_004, BR-SYNC-05)', async ({ bulkUploadPage: b, adminPage }) => {
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage);
    await b.goto();
    await b.selectType('STUDENT');
    const csv = campusCsv();
    await b.chooseFile(writeFile(tmpPath('f'), 'ins-chanakya.csv', csv));
    await b.clickUpload();
    await expect.poll(() => spy.calls.length).toBe(1);
    await expect.poll(async () => (await spy.sent())[0]?.text).toBe(csv);
    const [sent] = await spy.sent();
    expect(sent).toMatchObject({ name: 'ins-chanakya.csv', size: Buffer.byteLength(csv) });
    expect(sent.text).toContain(',INS,');
    expect(sent.text).toContain(',Chanakya Campus,');
  });

  test('BU_05 an .xlsx is sent with the spreadsheet content type', async ({ bulkUploadPage: b, adminPage }) => {
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage);
    await b.goto();
    await b.selectType('EMPLOYEE');
    await b.chooseFile(writeFile(tmpPath('f'), 'staff.xlsx', buildXlsx([STUDENT_HEADER, studentRow(1, 'Chanakya Campus')])));
    await b.clickUpload();
    await expect.poll(() => spy.calls.length).toBe(1);
    await expect.poll(async () => (await spy.sent())[0]?.name).toBe('staff.xlsx');
    expect((await spy.sent())[0].mime).toBe(XLSX_MIME);
    expect(spy.calls[0].type).toBe('EMPLOYEE');
  });

  test('BU_05 while the request is in flight Upload is disabled, so a double click sends it once', async ({ bulkUploadPage: b, adminPage }) => {
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage, { hold: true });
    await b.goto();
    await b.selectType('STUDENT');
    await b.chooseFile(writeFile(tmpPath('f'), 'users.csv', campusCsv()));
    await b.clickUpload();
    await expect.poll(() => spy.calls.length).toBe(1);
    expect(await b.isDisabled(b.upload), 'Upload disabled while loading').toBe(true);
    expect(await b.isDisabled(b.resetBtn), 'Reset disabled while loading').toBe(true);
    await b.upload.click({ force: true }).catch(() => undefined);
    expect(spy.calls).toHaveLength(1);
    spy.release();
    await expect(adminPage.getByText(/^All \d+ users uploaded successfully$/)).toBeVisible();
    expect(spy.calls).toHaveLength(1);
  });

  test('BU_05 a successful upload reloads the history list', async ({ bulkUploadPage: b, adminPage }) => {
    await guardWrites(adminPage);
    await installUploadSpy(adminPage);
    await b.goto();
    await b.selectType('STUDENT');
    await b.chooseFile(writeFile(tmpPath('f'), 'users.csv', campusCsv()));
    const reload = adminPage.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/admin/users/upload-history'));
    await b.clickUpload();
    await reload;
  });
});

// =====================================================================================
// 4. Validation summary and error preview (MOCKED server answers: this proves the display only)
// =====================================================================================
test.describe('BU_06 validation summary and errors @bulk-upload', () => {
  /** Runs one mocked upload and leaves the page showing its outcome. */
  async function uploadWith(b: BulkUploadPage, adminPage: import('@playwright/test').Page, dir: string, body: unknown, status = 200) {
    await guardWrites(adminPage);
    const spy = await installUploadSpy(adminPage, { body, status });
    await b.goto();
    await b.selectType('STUDENT');
    await b.chooseFile(writeFile(dir, 'users.csv', campusCsv()));
    await b.clickUpload();
    await expect.poll(() => spy.calls.length).toBe(1);
    return spy;
  }

  test('BU_06 all rows succeed: summary counters and the "uploaded successfully" message (TC_SYNC_003)', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(b, adminPage, tmpPath('f'), summaryBody({ totalRows: 4, successCount: 4, failureCount: 0, duplicateRows: 0, invalidRows: 0, errors: [] }));
    await expect(b.snackbar('All 4 users uploaded successfully')).toBeVisible();
    await expect.poll(() => b.summary()).toEqual({ total: 4, success: 4, failed: 0, duplicates: 0, invalid: 0 });
    await expect(b.errorsEmpty).toBeVisible();
  });

  test('BU_06 partial success: counters, duplicates, invalid and the row-wise errors (TC_SYNC_006, duplicate Official ID)', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(
      b,
      adminPage,
      tmpPath('f'),
      summaryBody({
        totalRows: 5,
        successCount: 2,
        failureCount: 3,
        duplicateRows: 1,
        invalidRows: 2,
        errors: [
          { rowNumber: 3, fieldName: 'officialEmail', errorMessage: 'Duplicate Official ID in file', rawValue: 'a@x.invalid' },
          { rowNumber: 4, fieldName: 'officialEmail', errorMessage: 'Invalid email format', rawValue: 'not-an-email' },
          { rowNumber: 5, fieldName: 'officialEmail', errorMessage: 'Official ID is required', rawValue: '' },
        ],
      }),
    );
    await expect(b.snackbar(`2 succeeded, 3 failed ${DASH} review errors below`)).toBeVisible();
    await expect.poll(() => b.summary()).toEqual({ total: 5, success: 2, failed: 3, duplicates: 1, invalid: 2 });
    await expect.poll(() => b.errorLines()).toEqual([
      'Row 3 - officialEmail: Duplicate Official ID in file',
      'Row 4 - officialEmail: Invalid email format',
      'Row 5 - officialEmail: Official ID is required',
    ]);
  });

  test('BU_06 every row fails: "All N rows failed" message', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(
      b,
      adminPage,
      tmpPath('f'),
      summaryBody({ totalRows: 2, successCount: 0, failureCount: 2, duplicateRows: 0, invalidRows: 2, errors: [{ rowNumber: 2, fieldName: 'campus', errorMessage: 'Campus must be INS or Chanakya Campus', rawValue: 'XYZ' }] }),
    );
    await expect(b.snackbar(`All 2 rows failed ${DASH} review errors below`)).toBeVisible();
    await expect.poll(() => b.summary()).toMatchObject({ total: 2, success: 0, failed: 2, invalid: 2 });
    await expect.poll(() => b.errorLines()).toEqual(['Row 2 - campus: Campus must be INS or Chanakya Campus']);
  });

  test('BU_06 only the first 20 errors are listed, with a "+N more errors" hint', async ({ bulkUploadPage: b, adminPage }) => {
    const errors = Array.from({ length: 25 }, (_, i) => ({ rowNumber: i + 2, fieldName: 'officialEmail', errorMessage: 'Invalid email format', rawValue: `bad${i}` }));
    await uploadWith(b, adminPage, tmpPath('f'), summaryBody({ totalRows: 25, successCount: 0, failureCount: 25, duplicateRows: 0, invalidRows: 25, errors }));
    await expect.poll(() => b.errorLines()).toHaveLength(21);
    const lines = await b.errorLines();
    expect(lines[0]).toBe('Row 2 - officialEmail: Invalid email format');
    expect(lines[19]).toBe('Row 21 - officialEmail: Invalid email format');
    expect(lines[20]).toBe(`+5 more errors ${DASH} download the error report for the full list`);
  });

  test('BU_06 21 errors: singular "+1 more error"', async ({ bulkUploadPage: b, adminPage }) => {
    const errors = Array.from({ length: 21 }, (_, i) => ({ rowNumber: i + 2, fieldName: 'mobile', errorMessage: 'bad', rawValue: '' }));
    await uploadWith(b, adminPage, tmpPath('f'), summaryBody({ totalRows: 21, successCount: 0, failureCount: 21, duplicateRows: 0, invalidRows: 21, errors }));
    await expect.poll(async () => (await b.errorLines()).at(-1)).toBe(`+1 more error ${DASH} download the error report for the full list`);
  });

  test('BU_06 a file-level error (rowNumber 0) is shown without the "Row" prefix', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(b, adminPage, tmpPath('f'), summaryBody({ totalRows: 0, successCount: 0, failureCount: 0, duplicateRows: 0, invalidRows: 0, errors: [{ rowNumber: 0, fieldName: 'header', errorMessage: 'Missing column: officialEmail', rawValue: '' }] }));
    await expect.poll(() => b.errorLines()).toEqual(['header: Missing column: officialEmail']);
  });

  test('BU_06 a rejected request (HTTP 400) shows the server message as an error row and in the message bar', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(b, adminPage, tmpPath('f'), { success: false, message: 'Unsupported file content', code: 'BAD_REQUEST' }, 400);
    await expect(b.snackbar('Unsupported file content')).toBeVisible();
    await expect.poll(() => b.errorLines()).toEqual(['file: Unsupported file content']);
    await expect.poll(() => b.summary()).toEqual({ total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 });
  });

  test('BU_06 a server failure without a message falls back to a generic error', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(b, adminPage, tmpPath('f'), {}, 500);
    await expect.poll(async () => (await b.errorLines())[0]).toMatch(/^file: .+/);
    expect(await b.errorLines()).toHaveLength(1);
  });

  test('BU_06 Reset clears the file, the summary and the errors but keeps the chosen type', async ({ bulkUploadPage: b, adminPage }) => {
    await uploadWith(b, adminPage, tmpPath('f'), summaryBody({ totalRows: 2, successCount: 0, failureCount: 2, duplicateRows: 0, invalidRows: 2, errors: [{ rowNumber: 2, fieldName: 'x', errorMessage: 'bad', rawValue: '' }] }));
    await expect.poll(async () => (await b.summary()).total).toBe(2);
    await b.clickReset();
    await expect(b.noFileText).toBeVisible();
    await expect(b.errorsEmpty).toBeVisible();
    await expect.poll(() => b.summary()).toEqual({ total: 0, success: 0, failed: 0, duplicates: 0, invalid: 0 });
    await expect(b.typeSelector).toHaveText('STUDENT');
    expect(await b.isDisabled(b.upload)).toBe(true);
  });

  test('BU_06 a second upload replaces the previous result', async ({ bulkUploadPage: b, adminPage }) => {
    const spy = await uploadWith(b, adminPage, tmpPath('f'), summaryBody({ totalRows: 3, successCount: 3, failureCount: 0, duplicateRows: 0, invalidRows: 0, errors: [] }));
    expect(spy.calls).toHaveLength(1);
    await expect.poll(async () => (await b.summary()).total).toBe(3);
    await adminPage.unroute(/\/myindiranew\/api\/admin\/users\/bulk-upload/);
    await installUploadSpy(adminPage, { body: summaryBody({ totalRows: 1, successCount: 0, failureCount: 1, duplicateRows: 0, invalidRows: 1, errors: [{ rowNumber: 2, fieldName: 'officialEmail', errorMessage: 'Invalid email format', rawValue: '' }] }) });
    await b.clickUpload();
    await expect.poll(async () => (await b.summary()).total).toBe(1);
    await expect.poll(() => b.errorLines()).toEqual(['Row 2 - officialEmail: Invalid email format']);
  });
});

// =====================================================================================
// 5. Upload history
// =====================================================================================
test.describe('BU_07 upload history @bulk-upload', () => {
  type Batch = { batchId: number; uploadType: string; uploadedBy: string; uploadedOn: string; totalCount: number; successCount: number; failureCount: number; status: string };

  async function liveHistory(b: BulkUploadPage, adminPage: import('@playwright/test').Page): Promise<Batch[]> {
    const resp = adminPage.waitForResponse((r) => r.url().includes('/admin/users/upload-history') && r.request().method() === 'GET');
    await b.goto();
    const json = (await (await resp).json()) as { data: Batch[] };
    await expect(b.historyRows.first()).toBeVisible();
    return json.data;
  }

  test('BU_07 the screen lists every batch the API returns, in the same order, as "#id | TYPE | user | total/success/failed | STATUS"', async ({ bulkUploadPage: b, adminPage }) => {
    const api = await liveHistory(b, adminPage);
    const shown = await b.readHistory();
    expect(shown).toHaveLength(api.length);
    shown.forEach((row, i) => {
      expect(row.raw).toBe(`#${api[i].batchId} | ${api[i].uploadType} | ${api[i].uploadedBy} | ${api[i].totalCount}/${api[i].successCount}/${api[i].failureCount} | ${api[i].status}`);
    });
  });

  test('BU_07 newest batch is first (ids descending)', async ({ bulkUploadPage: b, adminPage }) => {
    await liveHistory(b, adminPage);
    const ids = (await b.readHistory()).map((r) => r.batchId);
    expect(ids).toEqual([...ids].sort((x, y) => y - x));
  });

  test('BU_07 every batch is consistent: success + failed = total, and the status matches the counts', async ({ bulkUploadPage: b, adminPage }) => {
    await liveHistory(b, adminPage);
    for (const r of await b.readHistory()) {
      expect(r.success + r.failed, `batch #${r.batchId}`).toBe(r.total);
      expect(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'], `status of #${r.batchId}`).toContain(r.status);
      if (r.failed === 0) expect(r.status, `#${r.batchId}`).toBe('SUCCESS');
      else if (r.success === 0) expect(r.status, `#${r.batchId}`).toBe('FAILED');
      else expect(r.status, `#${r.batchId}`).toBe('PARTIAL_SUCCESS');
      expect(UPLOAD_TYPES, `type of #${r.batchId}`).toContain(r.type);
    }
  });

  test('BU_07 the history request is a read (GET) and the list is not editable', async ({ bulkUploadPage: b, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await liveHistory(b, adminPage);
    await b.historyRows.first().click();
    expect(writes).toHaveLength(0);
    expect(b.currentPath()).toBe('/bulk-upload');
  });

  test('BU_07 an empty history renders no rows and no errors', async ({ bulkUploadPage: b, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(/\/admin\/users\/upload-history/, (route) => route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: [] } }));
    await b.goto();
    await expect(b.historyRows).toHaveCount(0);
    await expect(b.heading).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('BU_07 a failing history request leaves the rest of the screen usable', async ({ bulkUploadPage: b, adminPage }) => {
    await adminPage.route(/\/admin\/users\/upload-history/, (route) => route.fulfill({ status: 500, json: { success: false, message: 'boom' } }));
    await b.goto();
    await expect(b.historyRows).toHaveCount(0);
    await b.selectType('STUDENT');
    expect(await b.isDisabled(adminPage.getByRole('button', { name: 'Download STUDENT Template' }))).toBe(false);
  });

  test('BU_07 a campus batch with a long uploader name still renders on one line', async ({ bulkUploadPage: b, adminPage }) => {
    const row = { batchId: 900, uploadType: 'STUDENT', uploadedBy: 'Chanakya Campus Administrator With A Very Long Display Name', uploadedOn: '2026-11-20T08:00:00Z', totalCount: 10, successCount: 9, failureCount: 1, status: 'PARTIAL_SUCCESS' };
    await adminPage.route(/\/admin\/users\/upload-history/, (route) => route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: [row] } }));
    await b.goto();
    const [shown] = await b.readHistory();
    expect(shown.raw).toBe('#900 | STUDENT | Chanakya Campus Administrator With A Very Long Display Name | 10/9/1 | PARTIAL_SUCCESS');
  });
});

// =====================================================================================
// 6. Known deviations: the app differs from the story. test.fail() = green while wrong, red once fixed.
// =====================================================================================
test.describe('BU_08 known deviations from IUN-3267 @bulk-upload', () => {
  test('BU_08 the screen lets the admin pick the campus (INS / Chanakya Campus) (scope, BR-SYNC-05)', async ({ bulkUploadPage: b, adminPage }) => {
    test.fail(true, 'No campus selector: the upload type menu only has STUDENT/EMPLOYEE/ADMIN/BIRTHDAY/TITLE; campus exists only as a CSV column');
    await b.goto();
    await b.selectType('STUDENT');
    await expect(adminPage.getByText(/INS|Chanakya/).first()).toBeVisible({ timeout: 3000 });
  });

  test('BU_08 the template has a Role column (BR-SYNC-05: Campus, Microsoft ID, Full Name, Role)', async ({ bulkUploadPage: b }) => {
    test.fail(true, 'STUDENT/EMPLOYEE/ADMIN templates have no role column (only designation / studentCode)');
    await b.goto();
    await b.selectType('ADMIN');
    const download = await b.downloadTemplate();
    const file = tmpPath('admin.csv');
    await download.saveAs(file);
    expect(fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].toLowerCase().split(',')).toContain('role');
  });

  test('BU_08 the history shows the upload date and time of each batch', async ({ bulkUploadPage: b, adminPage }) => {
    test.fail(true, 'The API returns uploadedOn but the row only shows id, type, user, counts and status');
    await b.goto();
    await expect(b.historyRows.first()).toBeVisible();
    const [first] = await b.readHistory();
    expect(first.raw).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(adminPage.url()).toContain('/bulk-upload');
  });

  test('BU_08 the error report can be downloaded from the screen', async ({ bulkUploadPage: b, adminPage }) => {
    test.fail(true, 'The "Error Report Download" card is only a text ("Use backend endpoints...") with no button or link');
    await b.goto();
    await expect(adminPage.getByRole('button', { name: /download.*(error|report)/i })).toBeVisible({ timeout: 3000 });
  });

  test('BU_08 an empty history shows an empty-state message', async ({ bulkUploadPage: b, adminPage }) => {
    test.fail(true, 'With no batches the Upload History heading is followed by nothing');
    await adminPage.route(/\/admin\/users\/upload-history/, (route) => route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: [] } }));
    await b.goto();
    await expect(adminPage.getByText(/no (uploads|history|batches)/i)).toBeVisible({ timeout: 3000 });
  });

  test('BU_08 there is a place to see UMS / bulk sync status (story title: User Synchronization)', async ({ bulkUploadPage: b }) => {
    test.fail(true, 'No sync status, last-sync time or UMS information anywhere on the screen');
    await b.goto();
    expect(await b.bodyText()).toMatch(/sync|UMS/i);
  });
});

// =====================================================================================
// 7. Gated: a REAL upload (not run)
// =====================================================================================
test.describe('BU_09 real upload @bulk-upload @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Set ALLOW_BULKUPLOAD_WRITES=true. Creates real users that the UI cannot delete, so it is NOT run by default.');

  test('BU_09 a real upload of one synthetic INS user returns a summary (TC_SYNC_003) [no cleanup possible]', async ({ bulkUploadPage: b, adminPage }) => {
    const email = `qa.bulk.${Date.now()}@example.invalid`;
    await b.goto();
    await b.selectType('ADMIN');
    await b.chooseFile(writeFile(tmpPath('f'), 'one.csv', buildCsv([['fullName', 'officialEmail', 'email', 'mobile', 'department', 'campus', 'status'], ['QA Bulk', email, email, '9000000000', 'QA', 'INS', 'ACTIVE']])));
    await b.clickUpload();
    await expect(adminPage.getByText(/Total: [1-9]/)).toBeVisible();
  });
});
