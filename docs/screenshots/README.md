# Screenshots

The README embeds `trip-planner.png` from this directory. Add the following
captures (PNG or GIF) before publishing the repo:

| File | What to capture |
|---|---|
| `trip-planner.png` | Trip detail page showing the map with the Route 66 polyline and the stops list (hero image). |
| `stops.png` | Stops feed with categories, scores, and vote buttons. |
| `recommendations.png` | AI recommendation results after clicking **Get recommendations** on a trip. |
| `stays.png` | "Where to stay" affiliate cards (accommodation/activity/car sections). |
| `account.png` | Account page showing Premium status and the upgrade/cancel controls. |
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
