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
      // High-confidence credential terms only. Bare "session"/"auth" are too
      // broad — analytics sessions and UI state legitimately live in web storage.
      // `authToken`/`accessToken`/`sessionToken` still match via "token".
      if (!/token|jwt|secret|passwd|password|credential|api[_-]?key|private[_-]?key|access[_-]?key/i.test(key)) continue;
      // Skip metadata keys like `*_token_timestamp` — they hold a time/count.
      if (/_(timestamp|time|start|end|at|count|expiry|expires|ttl|updated|created|date|ms|secs?|seconds?)$/i.test(key)) continue;
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
