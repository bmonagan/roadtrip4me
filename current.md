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

NEXT:
- User: refresh the app and confirm subscription status loads (opaque-token fix). Then log in as alice@example.com + bob@example.com to confirm seeded data + premium link (auto-provisioning by email).
- Test real premium checkout flow end-to-end (Go Premium -> Stripe -> webhook sets isPremium).
