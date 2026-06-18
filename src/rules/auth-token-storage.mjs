// auth-token-storage (HIGH)
// Auth tokens kept in localStorage/sessionStorage are readable by any XSS
// payload. Use HTTP-only cookies (see auth-session-management).

export default {
  id: 'auth-token-storage',
  title: 'Auth token stored in web storage (XSS-readable)',
  priority: 'HIGH',
  category: 'Authentication',
  doc: 'auth-session-management',
  check(file) {
    const findings = [];
    // We match against the RAW source so we can read the storage key string.
    const re = /\b(localStorage|sessionStorage)\.setItem\(\s*[`'"]([^`'"]*)[`'"]/g;
    let m;
    while ((m = re.exec(file.source))) {
      const key = m[2];
      if (!/token|jwt|auth|session|secret|credential/i.test(key)) continue;
      const pos = file.posAt(m.index);
      findings.push({
        line: pos.line,
        column: pos.column,
        message: `${m[1]}.setItem("${key}", ...) keeps an auth credential where any injected script can steal it.`,
        fix: 'Store the session in an HTTP-only, Secure, SameSite cookie via useSession() instead.',
      });
    }
    return findings;
  },
};
