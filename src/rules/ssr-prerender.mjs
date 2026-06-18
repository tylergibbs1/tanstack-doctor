// ssr-prerender (INFO — advisory)
// A route that looks static (about, pricing, contact…) but fetches data in its
// loader on every request, with no Cache-Control, is a candidate for build-time
// prerendering or ISR (setHeaders Cache-Control).
//
// Heuristic & advisory: only fires when the route path matches a known-static
// list, the loader awaits data, and the file sets no cache headers/prerender.

const STATIC_PATH = /^\/(about|pricing|contact|terms|privacy|faq|changelog|legal|imprint|docs|blog)(\/|$)/;

export default {
  id: 'ssr-prerender',
  title: 'Static-looking route fetches uncached data on every request',
  priority: 'INFO',
  category: 'SSR',
  doc: 'ssr-prerender',
  check(file) {
    // Guards run against masked source so comments/strings can't trip them.
    const masked = file.masked;
    if (!/createFileRoute\s*\(/.test(masked)) return [];
    // Skip if the file already opts into caching (setHeaders Cache-Control).
    if (/setHeaders\s*\(/.test(masked)) return [];
    // Needs a loader that actually awaits data.
    if (!/loader\s*:/.test(masked) || !/\bawait\b/.test(masked)) return [];

    const findings = [];
    // Route path is a string literal — read it from raw source.
    const re = /createFileRoute\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(file.source))) {
      const routePath = m[1];
      if (routePath.includes('$')) continue; // dynamic param — different advice
      if (!STATIC_PATH.test(routePath)) continue;
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: `Route "${routePath}" looks static but its loader fetches on every request with no Cache-Control.`,
        fix: "Prerender it at build time (server.prerender.routes) or add ISR: setHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }).",
      });
    }
    return findings;
  },
};
