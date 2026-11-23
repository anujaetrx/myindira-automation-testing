import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
for (const dir of ['artifacts', 'reports', 'test-results', 'playwright-report']) {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  console.log(`cleaned ${dir}`);
}
