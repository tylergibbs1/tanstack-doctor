// sec-hardcoded-secret (HIGH)
// A credential committed as a literal in source is the worst-case secret leak —
// it lands in git history and ships in any bundle that imports the file. Detects
// the high-signal key formats common in TanStack Start stacks (Stripe, OpenAI/
// Anthropic, AWS, GitHub, Google, Slack) plus PEM private keys.

const SECRETS = [
  { re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/, label: 'Stripe secret/restricted key' },
  { re: /\bwhsec_[A-Za-z0-9]{16,}\b/, label: 'Stripe webhook signing secret' },
  { re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/, label: 'OpenAI/Anthropic API key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id' },
  { re: /\bgh[posru]_[A-Za-z0-9]{36,}\b/, label: 'GitHub token' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, label: 'Google API key' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token' },
  { re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, label: 'PEM private key' },
];

// Obvious placeholders / docs samples — don't cry wolf on these.
const PLACEHOLDER = /x{4,}|X{4,}|your[_-]|example|placeholder|\.\.\.|<[a-z]|0000000000|1234567890/i;

export default {
  id: 'sec-hardcoded-secret',
  title: 'Hardcoded secret/API key committed in source',
  priority: 'HIGH',
  category: 'Security',
  doc: 'env-functions',
  check(file) {
    const findings = [];
    // Raw source: secrets are string literals (masked out otherwise).
    file.lines.forEach((raw, idx) => {
      for (const s of SECRETS) {
        const m = s.re.exec(raw);
        if (!m || PLACEHOLDER.test(m[0])) continue;
        findings.push({
          line: idx + 1,
          column: m.index + 1,
          message: `Hardcoded ${s.label} found in source. Committed secrets leak via git history and any bundle that imports this file.`,
          fix: 'Move it to an environment variable (read server-side via process.env) and rotate the exposed key.',
        });
        break; // one finding per line
      }
    });
    return findings;
  },
};
