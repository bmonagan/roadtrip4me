# Screenshots

The README embeds these captures. Re-run the steps below if the UI changes.

| File | What it shows |
|---|---|
| `home.png` | Landing page with the "Plan your trip" form (hero image). |
| `trip-planner.png` | Trip detail page with the map route polyline and stops list. |
| `stops.png` | Stops feed with categories, scores, and vote buttons. |
| `recommendations.png` | AI recommendation results after clicking **Get recommendations**. |
| `stays.png` | "Where to stay" affiliate cards (accommodation/activity/car sections). |
| `trips.png` | My Trips list. |
| `premium.png` | Premium page (active subscription + cancel). |
| `account.png` | Account page (dev-mode identity picker). |
| `walkthrough.gif` | Optional 20–40s screen recording of the core flow. |

## How to capture cleanly

1. Start the stack in demo mode (no keys needed for the data):
   ```bash
   docker compose up -d
   bunx prisma migrate deploy && bunx prisma db seed
   bun run dev
   ```
2. Add a free `VITE_MAPBOX_TOKEN` to `apps/web/.env` so the map renders.
3. Log in at `/login` as `alice@example.com` (Premium + Admin).
4. Use a browser window at ~1440×900 and the OS screenshot tool. For the GIF,
   record the flow: open trip → map → add stop → vote → get recommendations.

## Tips

- Crop browser chrome; keep the app UI as the focus.
- Keep image files reasonably small (compress PNGs, cap GIFs at ~10s).
- Alt text is already set in the README — keep the filenames exactly as above.
