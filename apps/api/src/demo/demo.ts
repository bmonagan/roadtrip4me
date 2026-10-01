/**
 * Demo mode lets the app run fully offline — no Google, DeepSeek, Stripe,
 * Auth0 or affiliate credentials. It is meant for local exploration and for
 * portfolios/screenshots. Enable with `DEMO_MODE=true` (pair with
 * `AUTH_DISABLED=true` so the seeded users are used without an identity
 * provider).
 */
export function isDemoMode(): boolean {
  return process.env['DEMO_MODE'] === 'true';
}
