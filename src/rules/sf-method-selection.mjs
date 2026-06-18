// sf-method-selection (MEDIUM)
// Docs: GET is the default and is for queries; use POST for operations that
// modify data. A server function that performs a DB mutation under the default
// GET method is an anti-pattern (and can be cached/prefetched unexpectedly).

const MUTATION = [
  /\.(create|insert|upsert|createMany|updateMany|deleteMany|remove)\s*\(/,
  /\.delete\s*\(/,
  /\b(db|prisma|tx|trx|client)\b[\s\S]{0,60}?\.update\s*\(/,
];

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

      const bodyEnd = nextFn === -1 ? src.length : nextFn;
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
