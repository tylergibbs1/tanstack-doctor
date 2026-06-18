// Demo fixture — SSR / client-leak violations.
import { config } from './app.server'; // VIOLATION file-separation

// VIOLATION env-secret-exposure: a secret behind a public (client-inlined) prefix
const stripe = import.meta.env.VITE_STRIPE_SECRET_KEY;

function login(token: string) {
  // VIOLATION auth-token-storage
  localStorage.setItem('authToken', token);
}

async function savePost(body: unknown) {
  // VIOLATION sf-prefer-server-fn: raw fetch mutation to an internal API
  await fetch('/api/posts', { method: 'POST', body: JSON.stringify(body) });
}

export function Dashboard() {
  return (
    <div>
      {/* VIOLATION ssr-hydration-safety */}
      <span>Generated at: {Date.now()}</span>
      <h1>{['Hi', 'Hey'][Math.floor(Math.random() * 2)]}</h1>
      <span>Width: {window.innerWidth}px</span>
    </div>
  );
}

// This is fine — Date.now in a loader is correct, must NOT be flagged.
export const loader = async () => ({ generatedAt: Date.now() });
