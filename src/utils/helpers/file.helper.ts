import fs from 'node:fs';
import path from 'node:path';

export const FileHelper = {
  ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  },
  readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  },
  writeJson(file: string, data: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  },
  exists: (file: string): boolean => fs.existsSync(file),
  ageMs(file: string): number {
    return Date.now() - fs.statSync(file).mtimeMs;
  },
};
