// Regression guard: obvious placeholder/sample keys must NOT be flagged as
// hardcoded secrets (they show up in READMEs, .env examples, and config stubs).
// (No real-looking key literal here — that would trip secret scanners.)
export const openaiExample = 'sk-your-api-key-goes-here-placeholder';
export const fromEnv = process.env.STRIPE_SECRET_KEY;
