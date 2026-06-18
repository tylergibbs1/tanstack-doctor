// sf-input-validation (CRITICAL)
// Server functions that consume `data` must validate it with .validator() /
// .inputValidator(). The network boundary is a trust boundary.

export default {
  id: 'sf-input-validation',
  title: 'Server function consumes input without a validator',
  priority: 'CRITICAL',
  category: 'Server Functions',
  doc: 'sf-input-validation',
  check(file) {
    const findings = [];
    const src = file.masked;
    const re = /createServerFn\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const start = m.index;
      // Find the handler that terminates this chain, without crossing into the
      // next createServerFn call.
      const handlerIdx = src.indexOf('.handler(', start);
      if (handlerIdx === -1) continue;
      const nextFn = src.indexOf('createServerFn(', start + 1);
      if (nextFn !== -1 && nextFn < handlerIdx) continue;

      const chain = src.slice(start, handlerIdx);
      const hasValidator = /\.(input)?[vV]alidator\s*\(/.test(chain);
      if (hasValidator) continue;

      // Does the handler actually read `data`? Capture the arrow params,
      // including a destructuring pattern like `({ data })`.
      const paramsMatch = /\.handler\(\s*(?:async\s*)?(\([^)]*\)|\w+)\s*=>/.exec(src.slice(handlerIdx));
      const params = paramsMatch ? paramsMatch[1] : '';
      const consumesData = /\bdata\b/.test(params);
      if (!consumesData) continue;

      // Read the method from raw source — string contents are masked out.
      const rawChain = file.source.slice(start, handlerIdx);
      const method = (/method\s*:\s*['"](\w+)['"]/.exec(rawChain)?.[1] || 'GET').toUpperCase();
      const pos = file.posAt(start);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: `createServerFn({ method: '${method}' }) reads \`data\` but has no .validator()/.inputValidator(). Untrusted client input is passed straight to the handler.`,
        fix: "Add `.inputValidator(zSchema)` before `.handler()` and never trust raw client data.",
      });
    }
    return findings;
  },
};
