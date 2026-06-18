// api-input-validation (MEDIUM)
// Server/API route handlers (server.handlers) read raw external input via
// `await request.json()`. If that body flows into a DB mutation without a
// runtime schema check (.parse/.safeParse/zodValidator), untrusted data hits
// the database. The server-route analog of sf-input-validation.

const VALIDATION = /\.(safe)?[pP]arse(Async)?\s*\(|zodValidator\s*\(|valibot|\bv\.parse\s*\(|\bassert\w*\s*\(/;
const MUTATION = /\.(create|update|delete|upsert|insert|createMany|updateMany|deleteMany)\s*\(/;

export default {
  id: 'api-input-validation',
  title: 'Server-route handler mutates from an unvalidated request body',
  priority: 'MEDIUM',
  category: 'API Routes / Security',
  doc: 'api-routes',
  check(file) {
    const findings = [];
    const src = file.masked;
    const re = /request\.json\s*\(\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      // Bound the inspection window to THIS handler — stop at the next handler
      // key or the next request.json() so we don't borrow a sibling's validator.
      let end = m.index + 700;
      const rest = src.slice(m.index + 12);
      const nextHandler = rest.search(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/);
      const nextJson = rest.indexOf('request.json');
      if (nextHandler !== -1) end = Math.min(end, m.index + 12 + nextHandler);
      if (nextJson !== -1) end = Math.min(end, m.index + 12 + nextJson);
      const window = src.slice(m.index, end);
      if (VALIDATION.test(window)) continue;   // body is validated — fine
      if (!MUTATION.test(window)) continue;     // no DB write — not this rule
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: 'Parsed `request.json()` body is written to the database with no runtime validation (.parse/.safeParse/zodValidator).',
        fix: 'Validate the body first, e.g. `const parsed = schema.safeParse(body)` and return 400 on failure before touching the DB.',
      });
    }
    return findings;
  },
};
