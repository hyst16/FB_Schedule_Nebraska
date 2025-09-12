# FB_Schedule_Nebraska

A super simple, no-server web page that shows the Nebraska Huskers **football** schedule.  
It’s built to run on GitHub Pages and is great for TVs/digital signage (PosterBooking, etc.).

---

## What you get

- **Two views**
  - **Next Game** – hero background with a compact info overlay (opponent, date/time, city, TV).
  - **Full Schedule** – a one-screen grid of the whole season.
- **Automatic nightly update** – the repo refreshes data each night and republishes the page.
- **Zero setup on your computer** – everything runs in GitHub.

---

## Quick start (no Terminal needed)

1. **Fork or create** this repo in your GitHub account.
2. **Enable GitHub Pages**
   - Go to **Settings → Pages**
   - **Build and deployment**: “Deploy from a branch”
   - **Branch**: `main` • **Folder**: `/docs`
3. **Run the first build**
   - Open the **Actions** tab → run the “Nightly Husker Schedule” workflow once (this seeds data and publishes the site).
4. **(Optional) Add stadium photos**
   - Put images in `docs/images/stadiums/`
   - Use the keys/filenames that the app expects (see `data/stadium_manifest.json`).
5. **Open your site**
   - `https://<YOUR-USERNAME>.github.io/FB_Schedule_Nebraska/`

---

## Using on a TV/signage player

Point your signage browser at your GitHub Pages URL.  
You can tweak screen behavior with **URL parameters** (below).

**Examples**
- Always show next game:  
  `.../FB_Schedule_Nebraska/?view=next`
- Always show the full schedule:  
  `.../FB_Schedule_Nebraska/?view=all`
- Auto-rotate views every 10s:  
  `.../FB_Schedule_Nebraska/?rot=10`

---

## URL parameters (options)

Add options after a `?` and separate multiples with `&`.

| Parameter | What it does | Values / Examples |
|---|---|---|
| `view` | Lock to a single view. | `next` or `all` → `?view=next` |
| `rot` | Auto-rotate interval (seconds). | Number → `?rot=10` (default is 15) |
| `debug` | Show a tiny tech overlay for troubleshooting. | `1` → `?debug=1` |

> Tip: You can combine them, e.g. `?view=all&debug=1`

---

## Stadium backgrounds & overrides (optional)

- Default backgrounds are matched by stadium key names.
- Put your images here: `docs/images/stadiums/`
- To **force** a specific background for a particular game (e.g., a neutral-site photo), edit:
  - `data/stadium_overrides.json` (follow the pattern inside that file)

---

## How the nightly update works (plain English)

- A scheduled GitHub Action runs a small script that grabs the latest schedule data and rebuilds the static files under `docs/`.
- GitHub Pages serves whatever is in `docs/`, so your public page stays current automatically.

**Change the time it runs:** open `.github/workflows/` and adjust the cron line(s) if desired.

---

## Project structure

.github/workflows/ # the scheduled workflow(s)
data/ # small JSON configs (stadium manifest, overrides, etc.)
docs/ # the actual website (served by GitHub Pages)
scripts/ # scraper/automation that the workflow runs

> The site entry point is `docs/index.html`.

---

## Customize the look

- CSS/HTML live in `docs/`. Tweak layout, fonts, and spacing there.
- You can keep hero images subtle (darken/blur) to improve text readability.
- If you add new stadium images, keep file sizes reasonable so signage loads quickly.

---

## Local preview (optional)

If you want to peek locally instead of GitHub Pages:
- Download the repo as ZIP and open `docs/index.html` in your browser.
- Or use a simple static server (e.g., VS Code’s Live Server extension).

---

## Troubleshooting

**I don’t see my stadium photo.**  
Make sure the image is in `docs/images/stadiums/` and the filename matches the stadium key the app expects (see `data/stadium_manifest.json`). Try a hard refresh (Ctrl/Cmd+Shift+R).

**The page didn’t update today.**  
Open the **Actions** tab, check the latest run. You can re-run the workflow to force an update.

**I only want one view (no rotation).**  
Use `?view=next` or `?view=all`.

---

## Credits

- Data source: Huskers.com schedule page.
- Built to be simple, reliable, and TV-friendly.
