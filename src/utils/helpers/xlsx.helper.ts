import zlib from 'node:zlib';

/**
 * Minimal .xlsx reader (no dependencies): an .xlsx is a zip of XML parts. Reads the first worksheet as rows of
 * strings. Enough to verify exported reports; not a general spreadsheet library.
 */

/** True when the bytes start with the zip signature "PK\x03\x04" (every .xlsx does). */
export function isZip(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

/** Reads every entry of a zip into memory (stored or deflated entries). */
export function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End of central directory record
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip file (no end-of-central-directory record)');
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lhNameLen = buf.readUInt16LE(localOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(start, start + compSize);
    files.set(name, method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescapeXml = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Returns the first worksheet as rows of cell text (numbers as written in the file, e.g. "2509.0"). */
export function readXlsxRows(buf: Buffer): string[][] {
  const parts = unzip(buf);
  const shared = parts.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const strings = Array.from(shared.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) =>
    unescapeXml(Array.from(m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((t) => t[1]).join('')),
  );
  const sheet = parts.get('xl/worksheets/sheet1.xml')?.toString('utf8');
  if (!sheet) throw new Error('No worksheet found in the workbook');
  return Array.from(sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map((row) =>
    Array.from(row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)).map((c) => {
      const attrs = c[1];
      const body = c[2] ?? '';
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (type === 's' && v !== undefined) return strings[Number(v)] ?? '';
      if (type === 'inlineStr') return unescapeXml(Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((t) => t[1]).join(''));
      return v === undefined ? '' : unescapeXml(v);
    }),
  );
}
