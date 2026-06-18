// Smoke test for tanstack-doctor. Runs the CLI as a child process and asserts
// the key invariants. Exits non-zero on any failure (used by CI).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'cli.mjs');

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? '' };
  }
}

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

// 1. Clean code produces zero findings and exits 0 even with the strictest gate.
check('clean code → no issues', () => {
  const { stdout } = run(['test/clean', '--json']);
  const report = JSON.parse(stdout);
  assert.equal(report.summary.issues, 0, 'expected 0 issues on clean code');
});
check('clean code → exit 0 with --fail-on LOW', () => {
  assert.equal(run(['test/clean', '--fail-on', 'LOW']).code, 0);
});

// 2. Fixtures trip every rule we expect to fire.
const EXPECTED_RULES = [
  'sf-input-validation', 'sf-weak-validator', 'api-input-validation',
  'mw-input-validation', 'env-secret-exposure', 'auth-token-storage',
  'auth-cookie-security', 'file-separation', 'ssr-hydration-safety',
  'sf-method-selection', 'sf-prefer-server-fn', 'ssr-streaming', 'ssr-prerender',
];
check('fixtures → all expected rules fire', () => {
  const report = JSON.parse(run(['fixtures', '--json']).stdout);
  const fired = new Set(report.findings.map((f) => f.rule));
  for (const id of EXPECTED_RULES) assert.ok(fired.has(id), `rule ${id} did not fire`);
  assert.ok(report.summary.byPriority.CRITICAL >= 1, 'expected a CRITICAL finding');
});

// 3. Exit-code gating works.
check('fixtures → exit 1 with --fail-on CRITICAL', () => {
  assert.equal(run(['fixtures', '--fail-on', 'CRITICAL']).code, 1);
});

// 4. Catalog matches the registry.
check('--list-rules lists every expected rule', () => {
  const out = run(['--list-rules']).stdout;
  for (const id of EXPECTED_RULES) assert.ok(out.includes(id), `${id} missing from --list-rules`);
});

// 5. PR-review diff parsing maps right-side line numbers correctly.
const { commentableLines } = await import('../scripts/pr-review.mjs');
check('commentableLines maps added + context lines on the right side', () => {
  const patch = [
    '@@ -1,3 +1,4 @@',  // new hunk starts at line 1
    ' const a = 1;',    // context  → line 1
    '-const b = 2;',     // removed  → (no right line)
    '+const b = 3;',     // added    → line 2
    '+const c = 4;',     // added    → line 3
    ' const d = 5;',     // context  → line 4
  ].join('\n');
  const lines = commentableLines(patch);
  assert.deepEqual([...lines].sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.equal(commentableLines(undefined).size, 0);
});

console.log(`\n${passed} checks passed.`);
