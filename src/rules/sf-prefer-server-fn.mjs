// sf-prefer-server-fn (LOW)
// Hand-rolled fetch() to an internal /api route for a mutation loses the type
// safety and automatic (de)serialization of createServerFn.

export default {
  id: 'sf-prefer-server-fn',
  title: 'Manual fetch() to internal API instead of a server function',
  priority: 'LOW',
  category: 'Server Functions',
  doc: 'sf-create-server-fn',
  check(file) {
    if (file.isServer) return [];
    const findings = [];
    // Raw source — the URL is a string literal (masked out otherwise).
    const re = /\bfetch\s*\(\s*[`'"]\/api\/[^`'"]*[`'"]([\s\S]{0,160})/g;
    let m;
    while ((m = re.exec(file.source))) {
      const tail = m[1];
      if (!/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(tail)) continue;
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: 'Mutating an internal /api route with a raw fetch() forgoes the type safety and RPC wiring of createServerFn.',
        fix: 'Replace with a createServerFn({ method: "POST" }) called via useServerFn().',
      });
    }
    return findings;
  },
};
