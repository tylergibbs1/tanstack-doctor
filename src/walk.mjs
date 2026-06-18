import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.output', '.vinxi', '.nitro', '.turbo', '.cache', '.vercel',
]);

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs']);

export function collectFiles(target, { ignore = DEFAULT_IGNORE } = {}) {
  const results = [];
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (EXTS.has(path.extname(target))) results.push(target);
    return results;
  }
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') {
        if (ignore.has(entry.name)) continue;
      }
      if (ignore.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && EXTS.has(path.extname(entry.name))) results.push(full);
    }
  };
  walk(target);
  return results;
}
