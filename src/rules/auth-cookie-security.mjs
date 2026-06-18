// auth-cookie-security (HIGH)
// Session cookies must be HttpOnly. Flags Set-Cookie writes and useSession()
// cookie configs that omit httpOnly.

export default {
  id: 'auth-cookie-security',
  title: 'Session cookie set without HttpOnly',
  priority: 'HIGH',
  category: 'Authentication',
  doc: 'auth-session-management',
  check(file) {
    const findings = [];
    const lines = file.lines; // raw — we need the cookie string contents

    lines.forEach((raw, idx) => {
      // Require a quoted "Set-Cookie" header whose value is an INLINE string or
      // template literal. A variable value (setResponseHeader("Set-Cookie",
      // cookies)) is set by an auth library and can't be verified here — and a
      // bare "Set-Cookie" in a comment/JSDoc must not match.
      const m = /['"]set-cookie['"]\s*,\s*[`'"]/i.exec(raw);
      if (!m) return;
      // Look at this line plus the next two for an HttpOnly attribute.
      const window = [raw, lines[idx + 1] ?? '', lines[idx + 2] ?? ''].join('\n');
      if (/httponly/i.test(window)) return;
      findings.push({
        line: idx + 1,
        column: m.index + 1,
        message: 'A Set-Cookie value is written from an inline string without the HttpOnly attribute — the cookie is readable by JavaScript.',
        fix: 'Set HttpOnly (and Secure + SameSite) on session cookies, e.g. via useSession({ cookie: { httpOnly: true, secure: true, sameSite: "lax" } }).',
      });
    });

    // useSession({ cookie: { ... } }) that never mentions httpOnly
    const re = /useSession\s*\(/g;
    let m;
    while ((m = re.exec(file.masked))) {
      const slice = file.source.slice(m.index, m.index + 500);
      if (/cookie\s*:/.test(slice) && !/httpOnly/.test(slice)) {
        const pos = file.posAt(m.index);
        findings.push({
          line: pos.line,
          column: pos.column,
          message: 'useSession() cookie config does not set `httpOnly: true`.',
          fix: 'Add `httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax"` to the cookie options.',
        });
      }
    }
    return findings;
  },
};
