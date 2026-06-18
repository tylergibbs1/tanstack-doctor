// Demo fixture — server file. Secrets here are fine; cookie config is not.
import { setResponseHeader } from '@tanstack/react-start/server';

export const config = { stripeSecret: process.env.STRIPE_SECRET_KEY }; // OK: server file

export function setSession(token: string) {
  // VIOLATION auth-cookie-security: no HttpOnly
  setResponseHeader('Set-Cookie', `session=${token}; Path=/`);
}

export function debug() {
  // VIOLATION env-secret-exposure: whole-env reference
  throw new Error(`bad env: ${process.env}`);
}
