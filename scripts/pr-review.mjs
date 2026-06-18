#!/usr/bin/env node
// Post tanstack-doctor findings as inline review comments on a pull request.
//
// Usage (inside a GitHub Actions PR job):
//   node bin/cli.mjs ./src --format json > findings.json || true
//   node scripts/pr-review.mjs findings.json
//
// Behavior (react-doctor style):
//   - Only comments on lines that are part of the PR diff (GitHub rejects others).
//   - Reports only NEW findings — dedupes against existing bot comments via a
//     hidden marker, so re-runs don't duplicate.
//   - Findings that fall outside the diff are summarized in the review body so
//     nothing is silently dropped.
//
// Requires env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), GITHUB_EVENT_PATH.
// Needs `permissions: pull-requests: write` in the workflow.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const MARKER = (rule) => `<!-- tanstack-doctor:${rule} -->`;
const MAX_COMMENTS = 50;
const LEVEL_EMOJI = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵', INFO: '⚪' };

// Map a file's unified-diff patch to the set of right-side (new) line numbers
// that can receive a review comment. Exported for testing.
export function commentableLines(patch) {
  const lines = new Set();
  if (!patch) return lines;
  let newLine = 0;
  for (const row of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (hunk) { newLine = parseInt(hunk[1], 10); continue; }
    if (row.startsWith('-')) continue;          // removed — left side only
    if (row.startsWith('\\')) continue;          // "\ No newline at end of file"
    if (row.startsWith('+') || row.startsWith(' ')) { lines.add(newLine); newLine++; }
  }
  return lines;
}

const main = async () => {
  const API = process.env.GITHUB_API_URL || 'https://api.github.com';
  const TOKEN = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPOSITORY;
  const EVENT = process.env.GITHUB_EVENT_PATH;
  const die = (msg) => { console.error(msg); process.exit(0); }; // exit 0 — never fail the build here

  if (!TOKEN || !REPO || !EVENT) die('Not a PR context (missing GITHUB_TOKEN / GITHUB_REPOSITORY / GITHUB_EVENT_PATH). Skipping review.');

  const [owner, repo] = REPO.split('/');
  const event = JSON.parse(fs.readFileSync(EVENT, 'utf8'));
  const pr = event.pull_request;
  if (!pr) die('No pull_request in the event payload. Skipping review.');
  const prNumber = pr.number;
  const headSha = pr.head.sha;

  const findingsPath = process.argv[2] || 'findings.json';
  const report = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
  const findings = report.findings || [];

  async function gh(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'tanstack-doctor',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  async function paginate(path) {
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const batch = await gh('GET', `${path}${sep}per_page=100&page=${page}`);
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }

  const prFiles = await paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);
  const diffLines = new Map(prFiles.map((f) => [f.filename, commentableLines(f.patch)]));

  // Existing bot comments → dedupe key `${path}:${line}:${rule}`.
  const existing = await paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`);
  const seen = new Set();
  for (const c of existing) {
    const rule = /<!-- tanstack-doctor:([\w-]+) -->/.exec(c.body || '')?.[1];
    if (rule) seen.add(`${c.path}:${c.line}:${rule}`);
  }

  const inline = [];
  const offDiff = [];
  for (const f of findings) {
    const onDiff = diffLines.get(f.file)?.has(f.line);
    if (!onDiff) { offDiff.push(f); continue; }
    if (seen.has(`${f.file}:${f.line}:${f.rule}`)) continue; // already commented
    if (inline.length >= MAX_COMMENTS) continue;
    inline.push({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      body: `${LEVEL_EMOJI[f.priority] || ''} **${f.priority} · \`${f.rule}\`** ${MARKER(f.rule)}\n\n${f.message}\n\n**Fix:** ${f.fix}\n\n_TanStack Start best practices · ${f.doc}_`,
    });
  }

  const total = findings.length;
  if (total === 0) { console.log('No findings — nothing to post.'); return; }

  // Build the review summary body.
  const counts = findings.reduce((a, f) => ((a[f.priority] = (a[f.priority] || 0) + 1), a), {});
  const countLine = Object.entries(counts).map(([p, n]) => `${LEVEL_EMOJI[p] || ''} ${p}: ${n}`).join(' · ');
  let body = `### 🩺 TanStack Doctor — ${total} finding${total === 1 ? '' : 's'}\n\n${countLine}\n`;
  if (inline.length) body += `\nPosted ${inline.length} new inline comment${inline.length === 1 ? '' : 's'} on changed lines.\n`;
  if (offDiff.length) {
    body += `\n<details><summary>${offDiff.length} finding(s) outside this PR's diff</summary>\n\n`;
    for (const f of offDiff.slice(0, 50)) body += `- \`${f.file}:${f.line}\` **${f.priority}** ${f.rule} — ${f.message}\n`;
    body += `\n</details>\n`;
  }

  if (inline.length === 0) {
    console.log('No new inline comments to post (all findings are off-diff or already commented).');
    // Still drop a single summary review so the PR shows current status.
    await gh('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, { commit_id: headSha, event: 'COMMENT', body });
    return;
  }

  await gh('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    commit_id: headSha,
    event: 'COMMENT',
    body,
    comments: inline,
  });
  console.log(`Posted a review with ${inline.length} inline comment(s).`);
};

// Only run when invoked directly (so tests can import commentableLines).
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`pr-review failed: ${err.message}`); process.exit(0); });
}
