// env-secret-exposure (HIGH)
// In Vite (and TanStack Start on top of it), only env vars with a public prefix
// (VITE_/PUBLIC_/NEXT_PUBLIC_/EXPO_PUBLIC_) are INLINED into the client bundle.
// A non-prefixed `process.env.SECRET` in client code is simply `undefined` at
// runtime — it does not leak the value. The real leak is a secret-looking value
// behind a public prefix, which ships verbatim to every browser.
//
// (a) whole `process.env` interpolated/stringified — can dump every var to a log.
// (b) a public-prefixed var whose name looks secret — inlined into the bundle.

const PUBLIC_PREFIX = /\b(?:import\.meta\.env|process\.env)\.(VITE_|PUBLIC_|NEXT_PUBLIC_|EXPO_PUBLIC_)([A-Z0-9_]+)/g;
const SECRET_NAME = /SECRET|PRIVATE|PASSWORD|PASSWD|CREDENTIAL|API_KEY|ACCESS_KEY/;
const NOT_SECRET = /PUBLIC|PUBLISHABLE|ANON/; // publishable/anon keys are meant to be public
const WHOLE_ENV_LEAK = /\$\{\s*process\.env\s*\}|(?:JSON\.stringify|String)\s*\(\s*process\.env\s*\)/g;

export default {
  id: 'env-secret-exposure',
  title: 'Secret-looking value exposed to the client bundle',
  priority: 'HIGH',
  category: 'Security / Environment',
  doc: 'env-functions',
  check(file) {
    const findings = [];

    file.maskedLines.forEach((line, idx) => {
      // (a) whole-env leak — interpolated into a string or stringified
      let w; WHOLE_ENV_LEAK.lastIndex = 0;
      while ((w = WHOLE_ENV_LEAK.exec(line))) {
        findings.push({
          line: idx + 1,
          column: w.index + 1,
          message: 'The entire `process.env` object is interpolated/stringified — this can leak every secret into a log or error.',
          fix: 'Reference individual, validated variables instead of the whole `process.env` object.',
        });
      }

      // (b) secret-looking value behind a public (client-inlined) prefix
      let m; PUBLIC_PREFIX.lastIndex = 0;
      while ((m = PUBLIC_PREFIX.exec(line))) {
        const rest = m[2];
        if (!SECRET_NAME.test(rest) || NOT_SECRET.test(rest)) continue;
        findings.push({
          line: idx + 1,
          column: m.index + 1,
          message: `\`${m[1]}${rest}\` exposes a secret-looking value to the client bundle — public-prefixed vars are inlined into the browser.`,
          fix: 'Drop the public prefix and read this value server-side only (a *.server.ts module or server function).',
        });
      }
    });

    return findings;
  },
};
