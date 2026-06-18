import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.output', '.vinxi', '.nitro', '.turbo', '.cache', '.vercel',
  // Test code legitimately does things app code shouldn't (mock tokens,
  // insecure cookies, fixtures) — out of scope for a best-practices linter.
  '__tests__', '__mocks__', '__fixtures__', '__snapshots__', 'e2e', 'cypress',
]);

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs']);

// Test files (foo.test.ts, foo.spec.tsx) and generated declarations are skipped.
const SKIP_FILE = /\.(test|spec)\.[mc]?[jt]sx?$|\.d\.ts$/;

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
      else if (entry.isFile() && EXTS.has(path.extname(entry.name)) && !SKIP_FILE.test(entry.name)) {
        results.push(full);
      }
    }
  };
  walk(target);
  return results;
}
