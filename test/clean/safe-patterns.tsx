// Real-world patterns that must NOT be flagged (regression guard from scanning
// popular TanStack Start repos: tanstarter, tanstack-start-faster, etc.).
import { createFileRoute } from '@tanstack/react-router';

// SAFE: NODE_ENV is bundler-inlined and not a secret.
const isProd = process.env.NODE_ENV === 'production';

// SAFE: t3-env idiom — passing process.env as a value, not interpolating it.
export const env = { runtimeEnv: process.env };

// SAFE: EXPO_PUBLIC_ is a public prefix (like VITE_), meant for the client.
export const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;

// SAFE: publishable / anon keys are designed to be public, even with a prefix.
export const stripePk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const supaAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// SAFE: a non-prefixed secret read inside a server function is server-only and
// is `undefined` in the browser anyway — not a client-bundle leak.
export const getData = createServerFn().handler(async () => {
  const dbUrl = process.env.DATABASE_URL;
  return query(dbUrl);
});

// SAFE: window in an event handler runs on the client at click time, not in SSR.
export function BackButton() {
  return <button type="button" onClick={() => window.history.back()}>Back</button>;
}

// SAFE: metadata keys hold a timestamp/count, not the credential itself.
function trackSession(ts: number) {
  sessionStorage.setItem('did_session_timestamp', String(ts));
  sessionStorage.setItem('auth_session_start', String(ts));
}

// SAFE: two parallel queries is good practice, not a blocking smell.
export const Route = createFileRoute('/widgets')({
  loader: async ({ context: { queryClient } }) => {
    const [a, b] = await Promise.all([
      queryClient.ensureQueryData(widgetQueries.list()),
      queryClient.ensureQueryData(widgetQueries.count()),
    ]);
    return { a, b };
  },
});
