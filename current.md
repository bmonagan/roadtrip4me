DONE:
- Icon on top left of main page is broken. [FIXED - public/ not copied in web Dockerfile]
- Internal server error when trying to add new trips. [FIXED - stale DB migrations regenerated]
- Trips tab not working. [FIXED - was caused by the 500s above; API + UI verified]
- Accounts not working add a login page. [DONE - /login dev-mode identity picker; real Auth0 login still pending setup]
- No ability to add user defined stops. [DONE - Add stop form on Stops page]

NEXT:
- Set up Auth0 (currently AUTH_DISABLED=true, dev-mode login only)
- Populate Stripe secrets in GitHub Actions (STRIPE_SECRET_KEY etc.)
