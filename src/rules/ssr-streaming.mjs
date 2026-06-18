// ssr-streaming (INFO — advisory)
// A loader that `await Promise.all([...])` over several queries blocks the
// whole document until the slowest one resolves. Awaiting only above-the-fold
// data and streaming the rest (prefetchQuery + <Suspense>) improves TTFB.
//
// Heuristic & advisory: this is a "did you consider" nudge, not a hard error.

export default {
  id: 'ssr-streaming',
  title: 'Loader blocks SSR on multiple queries (consider streaming)',
  priority: 'INFO',
  category: 'SSR',
  doc: 'ssr-streaming',
  check(file) {
    if (!/createFileRoute\s*\(/.test(file.masked)) return [];
    const findings = [];
    const src = file.masked;
    const re = /Promise\.all\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      // Only blocking if awaited.
      const before = src.slice(Math.max(0, m.index - 10), m.index);
      if (!/await\s*$/.test(before)) continue;
      const window = src.slice(m.index, m.index + 600);
      const queries = (window.match(/ensureQueryData\s*\(/g) || []).length;
      if (queries < 2) continue;
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: `Loader awaits ${queries} queries together — the response blocks until the slowest resolves.`,
        fix: 'Await only critical above-the-fold data; prefetchQuery() the rest and stream it with <Suspense> for a faster TTFB.',
      });
    }
    return findings;
  },
};
