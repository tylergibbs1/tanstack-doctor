// Regression guard (from scanning tanstack-ai-demo, tanstarter-plus, ShipFullStack):
// a plain .ts module (db client / SDK setup) is a server utility in practice, so
// reading secrets from process.env here must NOT be flagged — only .tsx component
// files are treated as browser-reachable for the secret check.
export const databaseUrl = process.env.DATABASE_URL;
export const anthropicKey = process.env.ANTHROPIC_API_KEY;
