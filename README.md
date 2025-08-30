# FB_Schedule_Nebraska

Daily-updating Husker Football schedule display for PosterBooking.

- Scrapes: https://huskers.com/sports/football/schedule
- Nightly refresh around **2:00 AM America/Chicago** (dual UTC crons)
- GitHub Pages site (auto-rotates views): `docs/` → Settings → Pages → Deploy from branch (main /docs)

## How to use (no Terminal)

1. Create this folder structure and files in GitHub (Add file → Create new file).
2. In **Settings → Pages**, set:
   - Build and deployment: **Deploy from a branch**
   - Branch: **main**, Folder: **/docs**
3. In **Actions**, run **Nightly Husker Schedule** → **Run workflow** (first-time build).
4. Add stadium images to `images/stadiums/` using names suggested in `data/stadium_manifest.json`.
5. Point PosterBooking to: `https://<your-username>.github.io/FB_Schedule_Nebraska/`

## Views

- **Next Game**: Stadium background + compact overlay (logos, `vs.`/`at`, opponent, date/time, city, TV).
- **Full Schedule**: Single-screen grid (Date | Time | Opponent | H/A/N | City | TV | Result).

## Options (URL params)

- `?rot=10` → rotate every 10s (default 15).
- `?view=next` or `?view=all` → lock a single view.
- `?debug=1` → tiny debug overlay.

## Stadium overrides (optional)

Edit `data/stadium_overrides.json` to force a specific background key per game.
