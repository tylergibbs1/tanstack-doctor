// Regression guard (from scanning pingdotgg/lawn): files in a convex/ directory
// are Convex backend functions — server-only, never bundled to the client — so
// reading secrets from process.env here must NOT be flagged.
export const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
export const secret = process.env.RAILWAY_SECRET_ACCESS_KEY;
