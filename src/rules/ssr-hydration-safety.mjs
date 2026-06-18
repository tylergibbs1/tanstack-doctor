// ssr-hydration-safety (MEDIUM)
// Non-deterministic / browser-only values rendered directly in JSX produce
// hydration mismatches. Detected when the token sits inside a JSX expression
// `{ ... }` on a line that also contains a JSX tag (high precision, ignores
// loaders/useEffect which legitimately use these APIs off-render).

const TOKENS = [
  { re: /\bDate\.now\s*\(/, label: 'Date.now()' },
  { re: /\bMath\.random\s*\(/, label: 'Math.random()' },
  { re: /\bnew Date\s*\(\s*\)/, label: 'new Date()' },
  { re: /\bwindow\.\w/, label: 'window.*' },
  { re: /\bdocument\.\w/, label: 'document.*' },
];

const JSX_LINE = /<\/?[A-Za-z][\w.]*|\/>/; // an opening/closing/self-closing tag

export default {
  id: 'ssr-hydration-safety',
  title: 'Non-deterministic value rendered directly in JSX',
  priority: 'MEDIUM',
  category: 'SSR',
  doc: 'ssr-hydration-safety',
  check(file) {
    if (!file.isTsx) return [];
    const findings = [];

    file.maskedLines.forEach((line, idx) => {
      if (!JSX_LINE.test(line)) return;
      // Inspect each single-line `{ ... }` expression container on the line.
      const braceRe = /\{([^{}]*)\}/g;
      let b;
      while ((b = braceRe.exec(line))) {
        const expr = b[1];
        // Skip event handlers / inline arrows — `onClick={() => window...}` runs
        // on the client at interaction time, never during SSR render.
        if (/=>/.test(expr)) continue;
        for (const t of TOKENS) {
          if (t.re.test(expr)) {
            findings.push({
              line: idx + 1,
              column: b.index + 1,
              message: `${t.label} rendered inside JSX will differ between server and client and cause a hydration mismatch.`,
              fix: 'Compute the value in a loader and read it via Route.useLoaderData(), or defer to useEffect for client-only values.',
            });
            break; // one finding per expression
          }
        }
      }
    });
    return findings;
  },
};
