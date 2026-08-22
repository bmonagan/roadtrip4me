DONE:
- Icon on top left of main page is broken. [FIXED - public/ not copied in web Dockerfile]
- Internal server error when trying to add new trips. [FIXED - stale DB migrations regenerated]
- Trips tab not working. [FIXED - was caused by the 500s above; API + UI verified]
- Accounts not working add a login page. [DONE - /login dev-mode identity picker; real Auth0 login now configured]
- No ability to add user defined stops. [DONE - Add stop form on Stops page]
- Set up Auth0. [DONE - tenant dev-t5c7ke25qk6ebvx4.us.auth0.com, SPA app registered, auto-provisioning added, deploy pipeline passes VITE_* as build args, auth enforced (x-user-id ignored), AUTH_DISABLED=false. Signup verified: screen_hint=signup reaches Auth0 /u/signup.]
- Signup page. [DONE - /signup route, header "Sign up" button when signed out, signup() triggers Auth0 with screen_hint=signup, cross-links with /login]
- Clean up stale Fly secrets on API app. [DONE - removed REDIS_URL, SESSION_SECRET, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_JWKS_URL, MAPBOX_ACCESS_TOKEN, STRIPE_WEBHOOK_ENDPOINT_SECRET (old name)]

NEXT:
- Create users in Auth0 / log in as alice@example.com + bob@example.com to confirm seeded data + premium link (auto-provisioning by email).
- Populate Stripe secrets in GitHub Actions (STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET). Live key is set; need a real Price ID + webhook endpoint secret from the Stripe dashboard.
