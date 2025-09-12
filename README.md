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

Add options after a `?` and separate multiples with `&
