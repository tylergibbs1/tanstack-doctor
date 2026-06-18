// mw-input-validation (MEDIUM)
// Function middleware (`createMiddleware({ type: 'function' })`) receives the
// same untrusted client `data` as the server function it wraps. If the .server
// handler reads `data` without a .validator(), unvalidated input flows through
// the middleware chain. The middleware analog of sf-input-validation.

export default {
  id: 'mw-input-validation',
  title: 'Function middleware reads `data` without a validator',
  priority: 'MEDIUM',
  category: 'Middleware',
  doc: 'mw-request-middleware',
  check(file) {
    const findings = [];
    const src = file.masked;
    const re = /createMiddleware\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const start = m.index;
      const serverIdx = src.indexOf('.server(', start);
      if (serverIdx === -1) continue;
      const nextMw = src.indexOf('createMiddleware(', start + 1);
      if (nextMw !== -1 && nextMw < serverIdx) continue;

      const chain = src.slice(start, serverIdx);
      if (/\.validator\s*\(/.test(chain)) continue; // already validated

      // Does THIS .server() callback read `data`? Anchor at the call (^) so we
      // don't borrow a later one's params, and tolerate a return-type annotation.
      const paramsMatch = /^\.server\(\s*(?:async\s*)?(\([^)]*\)|\w+)\s*(?::[^=]*?)?=>/.exec(src.slice(serverIdx));
      const params = paramsMatch ? paramsMatch[1] : '';
      if (!/\bdata\b/.test(params)) continue;

      const pos = file.posAt(start);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: 'Function middleware reads `data` but has no .validator() — untrusted input passes through unvalidated.',
        fix: 'Add `.validator(zodValidator(schema))` to the middleware chain before `.server()`.',
      });
    }
    return findings;
  },
};
