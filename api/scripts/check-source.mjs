import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') return [];
      return sourceFiles(resolved);
    }
    return /\.(?:js|cjs|mjs)$/.test(entry.name) ? [resolved] : [];
  });
}

let failed = false;
for (const file of sourceFiles(apiRoot)) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  }
}

if (failed) process.exit(1);
console.log('ServiceUp API source syntax: OK');
