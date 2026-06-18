// sf-weak-validator (MEDIUM)
// A passthrough validator like `.validator((data) => data)` is a compile-time
// type assertion only — it performs NO runtime validation, so malformed or
// malicious input still reaches the handler. Use a real schema (zod, valibot…).

export default {
  id: 'sf-weak-validator',
  title: 'Passthrough validator performs no runtime validation',
  priority: 'MEDIUM',
  category: 'Server Functions',
  doc: 'sf-input-validation',
  check(file) {
    const findings = [];
    // .validator((data: T) => data)  |  .inputValidator(data => data)
    const re = /\.(?:input)?[vV]alidator\(\s*\(?\s*(\w+)\s*(?::[^)]*)?\)?\s*=>\s*(\w+)\s*\)/g;
    let m;
    while ((m = re.exec(file.masked))) {
      if (m[1] !== m[2]) continue; // returns something other than the input
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: `Validator \`(${m[1]}) => ${m[2]}\` only asserts a type at compile time — it does not validate input at runtime.`,
        fix: 'Validate with a runtime schema, e.g. .inputValidator(z.object({ ... })).',
      });
    }
    return findings;
  },
};
