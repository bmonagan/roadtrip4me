todo:
Email from logging in with google account says autho0 rather than the roadtrip4me
DONE:
- Icon on top left of main page is broken. [FIXED - public/ not copied in web Dockerfile]
- Internal server error when trying to add new trips. [FIXED - stale DB migrations regenerated]
- Trips tab not working. [FIXED - was caused by the 500s above; API + UI verified]
- Accounts not working add a login page. [DONE - /login dev-mode identity picker; real Auth0 login now configured]
- No ability to add user defined stops. [DONE - Add stop form on Stops page]
- Set up Auth0. [DONE - tenant dev-t5c7ke25qk6ebvx4.us.auth0.com, SPA app registered, auto-provisioning added, deploy pipeline passes VITE_* as build args, auth enforced (x-user-id ignored), AUTH_DISABLED=false. Signup verified: screen_hint=signup reaches Auth0 /u/signup.]
- Signup page. [DONE - /signup route, header "Sign up" button when signed out, signup() triggers Auth0 with screen_hint=signup, cross-links with /login]
- Clean up stale Fly secrets on API app. [DONE - removed REDIS_URL, SESSION_SECRET, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_JWKS_URL, MAPBOX_ACCESS_TOKEN, STRIPE_WEBHOOK_ENDPOINT_SECRET (old name)]
- Stripe secrets + billing. [DONE - valid live key; STRIPE_PRICE_ID=price_1U4SW5H4CqZkjwkbD8Uh5maq ($54/yr); STRIPE_WEBHOOK_SECRET set; webhook endpoint we_1U4bIUH4CqZkjwkb5EkRWPbO repointed to https://api.roadtrip4me.com/api/v1/billing/webhook. Fixed production bug: webhook used sync constructEvent() which fails on Bun (SubtleCryptoProvider) - now constructEventAsync. Verified: valid signed payload -> 201 {"received":true}.]
- Fix "Unable to load subscription status" / all requests 401. [DONE - Auth0 issues OPAQUE access tokens when no audience is requested (not JWTs), so jose.jwtVerify() threw "Invalid Compact JWS" on every request. AuthService now detects token format: JWTs verified via tenant JWKS; opaque tokens validated against /userinfo and profile (sub/email/name/picture) feeds the same resolveAccount path. Deployed 30e6f7d. User can refresh (existing opaque token still valid).]
- Login page improvements. [DONE - header Log in links to /login; login() sends prompt=login so Auth0 always shows its form (no silent auto-login via remembered session). Deployed 280ad3b.]
- Account page. [DONE - header top-right shows an Account link (avatar/initial) instead of login/logout buttons. New /account page: profile, premium status, subscription management (Go Premium / Cancel), log out; dev mode shows identity picker; signed-out users get login/signup links. Deployed 41591be.]
- Performance pass. [DONE - API: findOne() no longer lazily recomputes the paid Google Routes call for unrouted trips on every read (web already has a straight-line fallback). Web: code-split all routes via React.lazy, lazy-load TripMap so the ~1MB mapbox-gl only downloads when a trip is viewed, and drop ReactQueryDevtools from the prod bundle. Initial JS: 2.1MB (607KB gzip) -> 222KB (72KB gzip). Deployed d683cf3.]
- Background route computation. [DONE - all write mutations (create/update/addStop/removeStop/addWaypoint/removeWaypoint) now queue route computation via setImmediate instead of awaiting the paid Google Routes call. Writes return immediately; web polls for the polyline. Deployed 10a34e1.]
- AI recommendation budget cap. [DONE - per-user daily limit (10/day) on recommendation runs (DeepSeek + Places), enforced atomically in consumeDailyBudget(); counter resets at day rollover and rejects with 403 at the limit. Migration 0002 adds recommendationCount + recommendationCountDay. Deployed 10a34e1.]
- Fly.io cost reduction. [DONE - DB machine downsized from performance-2x:4096MB (performance tier ~2x price) to shared-cpu-1x:2048MB; DB stores only 17MB with load 0.02. Destroyed leftover stopped machines on api + web. API/web already auto-stop when idle. Verified health + all routes. NOTE: DB volume is still 50GB provisioned (88MB used ~1%) — costs ~$0.15/GB/mo; shrinking requires creating a smaller volume + restore (risky, deferred).]

NEXT:
- Optional: shrink DB volume 50GB -> 10GB (data migration; DB is only 17MB).
- User: refresh the app and confirm subscription status loads (opaque-token fix). Then log in as alice@example.com + bob@example.com to confirm seeded data + premium link (auto-provisioning by email).
- Test real premium checkout flow end-to-end (Go Premium -> Stripe -> webhook sets isPremium).
- Verify background route computation produces a polyline after editing a trip (jnllnjk has none).
