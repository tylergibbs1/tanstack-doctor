import { PRIORITY_ORDER } from './rules/index.mjs';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);

const PRIORITY_STYLE = {
  CRITICAL: (s) => c('41;97;1', ` ${s} `), // white on red
  HIGH: (s) => c('31;1', s),
  MEDIUM: (s) => c('33;1', s),
  LOW: (s) => c('36', s),
  INFO: (s) => c('90', s),
};

const tag = (p) => (PRIORITY_STYLE[p] || ((s) => s))(p);

export function reportPretty(findings, { fileCount, ruleCount, docBase }) {
  const out = [];
  out.push('');
  out.push(bold('  TanStack Doctor') + dim(`  ·  ${ruleCount} rules  ·  ${fileCount} files scanned`));
  out.push('');

  if (findings.length === 0) {
    out.push(c('32;1', '  ✓ No issues found. Your TanStack Start code looks healthy.'));
    out.push('');
    console.log(out.join('\n'));
    return;
  }

  // Group findings by file, files sorted by worst severity then path.
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.relPath)) byFile.set(f.relPath, []);
    byFile.get(f.relPath).push(f);
  }
  const rank = Object.fromEntries(PRIORITY_ORDER.map((p, i) => [p, PRIORITY_ORDER.length - i]));
  const files = [...byFile.entries()].sort((a, b) => {
    const aw = Math.max(...a[1].map((x) => rank[x.priority]));
    const bw = Math.max(...b[1].map((x) => rank[x.priority]));
    return bw - aw || a[0].localeCompare(b[0]);
  });

  for (const [relPath, list] of files) {
    list.sort((a, b) => a.line - b.line || a.column - b.column);
    out.push(bold(`  ${relPath}`));
    for (const f of list) {
      const loc = dim(`${f.line}:${f.column}`);
      out.push(`    ${tag(f.priority.padEnd(8))} ${loc}  ${f.message}`);
      const snippet = (f.snippet || '').trim();
      if (snippet) out.push(`        ${dim('│')} ${snippet}`);
      out.push(`        ${c('32', '→')} ${dim(f.fix)}`);
      out.push(`        ${dim(`${docBase}/${f.doc}.md  [${f.ruleId}]`)}`);
      out.push('');
    }
  }

  // Summary line
  const counts = {};
  for (const f of findings) counts[f.priority] = (counts[f.priority] || 0) + 1;
  const parts = PRIORITY_ORDER.filter((p) => counts[p]).map((p) => `${tag(p)} ${counts[p]}`);
  out.push('  ' + bold(`${findings.length} issue${findings.length === 1 ? '' : 's'}`) + dim('  —  ') + parts.join(dim('   ')));
  out.push('');
  console.log(out.join('\n'));
}

export function reportJson(findings, meta) {
  console.log(JSON.stringify({
    summary: {
      issues: findings.length,
      filesScanned: meta.fileCount,
      rules: meta.ruleCount,
      byPriority: findings.reduce((acc, f) => {
        acc[f.priority] = (acc[f.priority] || 0) + 1;
        return acc;
      }, {}),
    },
    findings: findings.map((f) => ({
      rule: f.ruleId,
      priority: f.priority,
      category: f.category,
      file: f.relPath,
      line: f.line,
      column: f.column,
      message: f.message,
      fix: f.fix,
      doc: `${f.doc}.md`,
    })),
  }, null, 2));
}
