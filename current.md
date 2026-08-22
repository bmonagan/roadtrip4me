DONE:
- Icon on top left of main page is broken. [FIXED - public/ not copied in web Dockerfile]
- Internal server error when trying to add new trips. [FIXED - stale DB migrations regenerated]
- Trips tab not working. [FIXED - was caused by the 500s above; API + UI verified]
- Accounts not working add a login page. [DONE - /login dev-mode identity picker; real Auth0 login now configured]
- No ability to add user defined stops. [DONE - Add stop form on Stops page]
- Set up Auth0. [DONE - tenant dev-t5c7ke25qk6ebvx4.us.auth0.com, SPA app registered, auto-provisioning added, deploy pipeline passes VITE_* as build args. Secrets set. Verify live login flow.]

NEXT:
- Verify Auth0 login end-to-end on prod (log in as alice@example.com, confirm premium; create new account, confirm auto-provisioning)
- Populate Stripe secrets in GitHub Actions (STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET etc.)
- Clean up stale Fly secrets on API app (REDIS_URL, SESSION_SECRET, AUTH0_CLIENT_SECRET, AUTH0_JWKS_URL)
