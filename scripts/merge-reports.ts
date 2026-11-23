import fs from 'node:fs';
import path from 'node:path';

/**
 * Merges Allure result folders from sharded CI runs (downloaded into reports/shards/<n>/allure-results)
 * into reports/allure-results so a single report can be generated.
 */
const root = path.resolve(__dirname, '..', 'reports');
const shards = path.join(root, 'shards');
const target = path.join(root, 'allure-results');
fs.mkdirSync(target, { recursive: true });

if (!fs.existsSync(shards)) {
  console.log('No shard results found, nothing to merge.');
  process.exit(0);
}

let count = 0;
for (const shard of fs.readdirSync(shards)) {
  const dir = path.join(shards, shard, 'allure-results');
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    fs.copyFileSync(path.join(dir, file), path.join(target, `${shard}-${file}`));
    count++;
  }
}
console.log(`Merged ${count} files into ${target}`);
