#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFiles } from '../src/walk.mjs';
import { SourceFile } from '../src/source.mjs';
import { rules as ALL_RULES, PRIORITY_RANK } from '../src/rules/index.mjs';
import { reportPretty, reportJson, reportGithub } from '../src/report.mjs';

const DOC_BASE = '.claude/skills/tanstack-start-best-practices/rules';

function parseArgs(argv) {
  const opts = { paths: [], format: 'pretty', disable: new Set(), only: null, failOn: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.format = 'json';
    else if (a === '--format') opts.format = (argv[++i] || '').toLowerCase();
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--list-rules') opts.listRules = true;
    else if (a === '--disable') opts.disable = new Set((argv[++i] || '').split(',').filter(Boolean));
    else if (a === '--only') opts.only = new Set((argv[++i] || '').split(',').filter(Boolean));
    else if (a === '--fail-on') opts.failOn = (argv[++i] || '').toUpperCase();
    else if (a.startsWith('-')) { console.error(`Unknown flag: ${a}`); process.exit(2); }
    else opts.paths.push(a);
  }
  if (opts.paths.length === 0) opts.paths = ['.'];
  return opts;
}

const HELP = `
TanStack Doctor — audit a TanStack Start codebase against best practices.

Usage:
  tanstack-doctor [path...] [options]

Options:
  --json              Emit machine-readable JSON (alias for --format json).
  --format <fmt>      Output format: pretty (default) | json | github.
                      'github' emits Actions annotations (inline on the PR).
  --fail-on <level>   Exit non-zero if any finding >= level
                      (CRITICAL|HIGH|MEDIUM|LOW). Default: never fail.
  --only <ids>        Run only these comma-separated rule ids.
  --disable <ids>     Skip these comma-separated rule ids.
  --list-rules        Print the rule catalog and exit.
  -h, --help          Show this help.

Examples:
  tanstack-doctor src
  tanstack-doctor . --fail-on HIGH
  tanstack-doctor app --only sf-input-validation,env-secret-exposure
  tanstack-doctor . --json > report.json
`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return; }

  let rules = ALL_RULES;
  if (opts.only) rules = rules.filter((r) => opts.only.has(r.id));
  if (opts.disable.size) rules = rules.filter((r) => !opts.disable.has(r.id));

  if (opts.listRules) {
    for (const r of ALL_RULES) {
      console.log(`${r.priority.padEnd(8)} ${r.id.padEnd(24)} ${r.title}`);
    }
    return;
  }

  const cwd = process.cwd();
  const findings = [];
  let fileCount = 0;

  for (const p of opts.paths) {
    const abs = path.resolve(cwd, p);
    if (!fs.existsSync(abs)) { console.error(`Path not found: ${p}`); process.exit(2); }
    for (const filePath of collectFiles(abs)) {
      fileCount++;
      let source;
      try { source = fs.readFileSync(filePath, 'utf8'); } catch { continue; }
      const file = new SourceFile(filePath, path.relative(cwd, filePath), source);
      for (const rule of rules) {
        let raw;
        try { raw = rule.check(file) || []; } catch (err) {
          console.error(`Rule ${rule.id} crashed on ${file.relPath}: ${err.message}`);
          continue;
        }
        for (const f of raw) {
          findings.push({
            ...f,
            ruleId: rule.id,
            priority: rule.priority,
            category: rule.category,
            doc: rule.doc,
            relPath: file.relPath,
            snippet: file.rawLine(f.line),
          });
        }
      }
    }
  }

  const meta = { fileCount, ruleCount: rules.length, docBase: DOC_BASE };
  if (opts.format === 'json') reportJson(findings, meta);
  else if (opts.format === 'github') reportGithub(findings);
  else reportPretty(findings, meta);

  if (opts.failOn) {
    const threshold = PRIORITY_RANK[opts.failOn];
    if (threshold === undefined) { console.error(`Invalid --fail-on level: ${opts.failOn}`); process.exit(2); }
    const tripped = findings.some((f) => PRIORITY_RANK[f.priority] >= threshold);
    process.exit(tripped ? 1 : 0);
  }
}

main();
