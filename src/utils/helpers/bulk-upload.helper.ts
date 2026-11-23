import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Helpers for the Bulk Upload specs: tiny CSV / XLSX writers and an upload SPY that answers
 * POST /admin/users/bulk-upload locally (so no user is ever created) and records what the screen sent.
 */

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV text from rows (first row = header). */
export function buildCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Header of the STUDENT template (as served by the app), used to build valid-looking rows. */
export const STUDENT_HEADER = ['fullName', 'officialEmail', 'email', 'mobile', 'department', 'campus', 'status', 'studentCode', 'year', 'semester', 'course', 'division', 'title'];

/** A student row for a campus. The e-mail domain is reserved (.invalid) so it can never belong to a real mailbox. */
export function studentRow(n: number, campus: string, email = `qa.bulk${n}@example.invalid`): string[] {
  return [`QA Bulk ${n}`, email, email, `90000000${String(n).padStart(2, '0')}`, 'QA', campus, 'ACTIVE', `QA${n}`, '1', '1', 'QA Course', 'A', ''];
}

const CRC_TABLE = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Stored (uncompressed) zip: enough for a valid .xlsx that Excel / xlsx.helper can open. */
function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(text);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + data.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colName = (i: number): string => String.fromCharCode(65 + i);

/** Minimal single-sheet .xlsx (inline strings). */
export function buildXlsx(rows: string[][]): Buffer {
  const sheet =
    '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => `<c r="${colName(ci)}${ri + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`)
      .join('') +
    '</sheetData></worksheet>';
  return zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Users" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
  });
}

/**
 * A fresh path under the OS temp folder. Used instead of testInfo.outputPath() because the shared Playwright output
 * folder is wiped by other runs on this machine while a test is still using the file.
 */
export function tmpPath(name: string): string {
  return path.join(os.tmpdir(), 'bulk-upload-qa', `${process.pid}-${Math.random().toString(36).slice(2)}`, name);
}

/** Writes a file under `dir` and returns its absolute path. */
export function writeFile(dir: string, name: string, content: string | Buffer): string {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

/** A CSV of exactly `bytes` bytes (valid rows followed by comment padding in a trailing cell). */
export function writeCsvOfSize(dir: string, name: string, bytes: number): string {
  const head = buildCsv([STUDENT_HEADER, studentRow(1, 'INS')]);
  const buf = Buffer.alloc(bytes, 0x20); // spaces
  buf.write(head, 0, 'utf8');
  buf[bytes - 1] = 0x0a;
  return writeFile(dir, name, buf);
}

// ---------------------------------------------------------------------------------------------
// Upload spy
// ---------------------------------------------------------------------------------------------

export interface UploadCall {
  method: string;
  url: string;
  /** value of the ?type= query parameter */
  type: string | null;
  contentType: string;
}

export interface SentFile {
  name: string;
  size: number;
  mime: string;
  text: string;
}

export interface UploadSpy {
  /** Every request the screen sent to POST /admin/users/bulk-upload. */
  calls: UploadCall[];
  /** The files as the browser put them in the FormData (read in the page, because Chromium hides blob bodies from Playwright). */
  sent: () => Promise<SentFile[]>;
  /** Lets a held response go out. */
  release: () => void;
}

export interface UploadSpyOptions {
  status?: number;
  /** Response body; defaults to a generic success summary. */
  body?: unknown;
  /** Hold the answer until release() is called (to look at the in-flight state). */
  hold?: boolean;
}

export const summaryBody = (data: Record<string, unknown>) => ({ success: true, message: 'ok', code: 'OK', data });

/**
 * Answers the bulk upload POST locally and records it. NOTHING reaches the server. Register it AFTER guardWrites()
 * (a later route wins) or alone; other write calls are not touched by it.
 */
export async function installUploadSpy(page: Page, opts: UploadSpyOptions = {}): Promise<UploadSpy> {
  const calls: UploadCall[] = [];
  let release: () => void = () => undefined;
  const gate = opts.hold ? new Promise<void>((r) => (release = r)) : Promise.resolve();
  await page.addInitScript(() => {
    const w = window as unknown as { __buSent: { name: string; size: number; mime: string; text: string }[] };
    w.__buSent = [];
    const orig = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (body instanceof FormData) {
        const f = body.get('file');
        if (f instanceof File) {
          const rec = { name: f.name, size: f.size, mime: f.type, text: '' };
          w.__buSent.push(rec);
          void f.text().then((t) => (rec.text = t));
        }
      }
      return orig.call(this, body as XMLHttpRequestBodyInit | null);
    };
  });
  await page.route(/\/myindiranew\/api\/admin\/users\/bulk-upload/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push({ method: req.method(), url: url.pathname, type: url.searchParams.get('type'), contentType: req.headers()['content-type'] ?? '' });
    await gate;
    await route.fulfill({
      status: opts.status ?? 200,
      json: opts.body ?? summaryBody({ totalRows: 1, successCount: 1, failureCount: 0, duplicateRows: 0, invalidRows: 0, errors: [] }),
    });
  });
  return {
    calls,
    release,
    sent: () => page.evaluate(() => (window as unknown as { __buSent: SentFile[] }).__buSent),
  };
}
