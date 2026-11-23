import fs from 'node:fs';
import path from 'node:path';

export type CsvRow = string[];

/** Builds small CSV files for upload tests, always inside a folder the caller owns (e.g. testInfo.outputDir). */
export class CsvBuilder {
  constructor(private readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  private write(fileName: string, content: string | Buffer): string {
    const file = path.join(this.dir, fileName);
    fs.writeFileSync(file, content);
    return file;
  }

  /** header + rows, e.g. csv('a.csv', ['Name','Code'], [['AUTO x','AUTO_X']]) */
  csv(fileName: string, header: string[], rows: CsvRow[]): string {
    return this.write(fileName, [header, ...rows].map((r) => r.join(',')).join('\n') + '\n');
  }

  empty(fileName = 'empty.csv'): string {
    return this.write(fileName, '');
  }

  /** A file of exactly `bytes` size (valid header, then padding). Padding is one long cell, so it holds no usable record. */
  sized(fileName: string, bytes: number): string {
    const header = 'Name,Code\n';
    return this.write(fileName, header + 'x'.repeat(Math.max(0, bytes - header.length)));
  }

  /** Content is irrelevant; the app judges .xlsx by extension when choosing a file. */
  fakeXlsx(fileName = 'sample.xlsx'): string {
    return this.write(fileName, Buffer.from('PK\u0003\u0004placeholder'));
  }

  other(fileName: string, content = 'name,code'): string {
    return this.write(fileName, content);
  }
}
