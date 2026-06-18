// env-secret-exposure (HIGH)
// Secrets read via process.env.X in client-reachable files leak into the
// browser bundle. Whole-env references (`${process.env}`) can dump every var.

const PUBLIC_PREFIX = /^(VITE_|NEXT_PUBLIC_|PUBLIC_|EXPO_PUBLIC_)/;
// Universally-safe, bundler-inlined vars that are fine to read anywhere.
const SAFE = new Set(['NODE_ENV', 'MODE']);
// Whole-env leak only when it's actually interpolated/stringified — not when
// passed as a value (e.g. t3-env's `runtimeEnv: process.env`).
const WHOLE_ENV_LEAK = /\$\{\s*process\.env\s*\}|(?:JSON\.stringify|String)\s*\(\s*process\.env\s*\)/g;

export default {
  id: 'env-secret-exposure',
  title: 'Server secret reachable from client code',
  priority: 'HIGH',
  category: 'Security / Environment',
  doc: 'env-functions',
  check(file) {
    const findings = [];

    file.maskedLines.forEach((line, idx) => {
      // (a) whole-env leak — interpolated into a string or stringified
      let w;
      WHOLE_ENV_LEAK.lastIndex = 0;
      while ((w = WHOLE_ENV_LEAK.exec(line))) {
        findings.push({
          line: idx + 1,
          column: w.index + 1,
          message: 'The entire `process.env` object is interpolated/stringified — this can leak every secret into a log or error.',
          fix: 'Reference individual, validated variables instead of the whole `process.env` object.',
        });
      }

      // (b) non-public secret read in a CLIENT COMPONENT file (.tsx/.jsx), where
      // module-scope access leaks into the browser bundle. Plain .ts modules
      // (db clients, auth config, SDK setup) are server utilities in practice and
      // produce mostly false positives, so we don't flag process.env there.
      if (!file.isClientReachable || !file.isTsx) return;
      const re = /process\.env\.([A-Z0-9_]+)/g;
      let m;
      while ((m = re.exec(line))) {
        const name = m[1];
        if (PUBLIC_PREFIX.test(name) || SAFE.has(name)) continue;
        findings.push({
          line: idx + 1,
          column: m.index + 1,
          message: `\`process.env.${name}\` is read in a client-reachable file. Non-VITE_/PUBLIC_ vars belong in *.server.ts only.`,
          fix: `Move this access into a *.server.ts module, or rename to VITE_${name} if it is genuinely public.`,
        });
      }
    });

    return findings;
  },
};
