// env-secret-exposure (HIGH)
// Secrets read via process.env.X in client-reachable files leak into the
// browser bundle. Whole-env references (`${process.env}`) can dump every var.

const PUBLIC_PREFIX = /^(VITE_|NEXT_PUBLIC_|PUBLIC_)/;

export default {
  id: 'env-secret-exposure',
  title: 'Server secret reachable from client code',
  priority: 'HIGH',
  category: 'Security / Environment',
  doc: 'env-functions',
  check(file) {
    const findings = [];

    file.maskedLines.forEach((line, idx) => {
      // (a) whole-env reference, e.g. `${process.env}`, JSON.stringify(process.env)
      const wholeEnv = /process\.env(?!\s*\.)/.exec(line);
      if (wholeEnv) {
        findings.push({
          line: idx + 1,
          column: wholeEnv.index + 1,
          message: 'Reference to the entire `process.env` object can leak every secret (e.g. interpolated into a log or error).',
          fix: 'Read individual, validated variables instead of the whole `process.env` object.',
        });
      }

      // (b) non-public secret accessed in a client-reachable file
      if (!file.isClientReachable) return;
      const re = /process\.env\.([A-Z0-9_]+)/g;
      let m;
      while ((m = re.exec(line))) {
        const name = m[1];
        if (PUBLIC_PREFIX.test(name)) continue;
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
