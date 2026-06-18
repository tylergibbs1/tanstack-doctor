// sf-method-selection (MEDIUM)
// Docs: GET is the default and is for queries; use POST for operations that
// modify data. A server function that performs a DB mutation under the default
// GET method is an anti-pattern (and can be cached/prefetched unexpectedly).

const MUTATION = [
  /\.(create|insert|upsert|createMany|updateMany|deleteMany|remove)\s*\(/,
  /\.delete\s*\(/,
  /\b(db|prisma|tx|trx|client)\b[\s\S]{0,60}?\.update\s*\(/,
];

// Index of the ')' matching the '(' at `open`, scanning masked source (string
// contents already blanked, so parens inside strings don't miscount).
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

export default {
  id: 'sf-method-selection',
  title: 'Mutating server function uses the default GET method',
  priority: 'MEDIUM',
  category: 'Server Functions',
  doc: 'sf-create-server-fn',
  check(file) {
    const findings = [];
    const src = file.masked;
    const re = /createServerFn\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const start = m.index;
      const handlerIdx = src.indexOf('.handler(', start);
      if (handlerIdx === -1) continue;
      const nextFn = src.indexOf('createServerFn(', start + 1);
      if (nextFn !== -1 && nextFn < handlerIdx) continue;

      // Method is read from raw source (string contents are masked).
      const rawChain = file.source.slice(start, handlerIdx);
      const method = (/method\s*:\s*['"](\w+)['"]/.exec(rawChain)?.[1] || 'GET').toUpperCase();
      if (method !== 'GET') continue;

      // Scan only THIS handler's body — paren-match `.handler( ... )` so we
      // don't pick up a mutation in unrelated downstream code.
      const close = matchParen(src, src.indexOf('(', handlerIdx));
      const bodyEnd = close !== -1 ? close : (nextFn === -1 ? src.length : nextFn);
      const body = src.slice(handlerIdx, bodyEnd);
      if (!MUTATION.some((p) => p.test(body))) continue;

      const pos = file.posAt(start);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: 'Server function performs a data mutation but uses the default GET method. GET is for queries; mutations should be POST/PUT/PATCH/DELETE.',
        fix: "Pass an explicit method, e.g. createServerFn({ method: 'POST' }).",
      });
    }
    return findings;
  },
};
