// file-separation (MEDIUM)
// Importing a *.server module from client-reachable code drags server-only deps
// (db clients, secrets) into the browser bundle.

export default {
  id: 'file-separation',
  title: 'Client component imports a *.server module',
  priority: 'MEDIUM',
  category: 'File Organization',
  doc: 'file-separation',
  check(file) {
    // Only flag a React component (.tsx/.jsx) importing server-only code — that
    // is what risks bundling db/secrets into the client. A .ts module importing
    // a *.server module is server-to-server (the build resolves it server-side).
    if (!file.isTsx || file.isServer) return [];
    // Next.js App Router special files (page/layout/...) are Server Components
    // unless marked "use client" — importing server code there is fine.
    if (/^(page|layout|template|default|loading|error|not-found|global-error)\.(t|j)sx$/.test(file.base)
        && !/["']use client["']/.test(file.source)) return [];
    const findings = [];
    // Match raw source — the specifier is a string literal (masked out otherwise).
    const re = /\bfrom\s+['"]([^'"]*\.server(?:\.[jt]sx?)?)['"]/g;
    let m;
    while ((m = re.exec(file.source))) {
      // `import type { X } from './x.server'` is safe (erased at build).
      const lineStart = file.source.lastIndexOf('\n', m.index) + 1;
      const stmt = file.source.slice(lineStart, m.index);
      if (/import\s+type\b/.test(stmt)) continue;
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: `Imports "${m[1]}" from a client-reachable file. Server-only code (db, secrets) may end up in the client bundle.`,
        fix: 'Call the logic through a createServerFn in a *.functions.ts module, or use `import type` if you only need types.',
      });
    }
    return findings;
  },
};
