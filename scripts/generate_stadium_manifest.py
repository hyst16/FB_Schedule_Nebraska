#!/usr/bin/env python3
"""
Generate a manifest of required background images using Trent's
naming convention:

    TeamName-Stadium-State.jpg

- Reads:  data/huskers_schedule_normalized.json
- Writes: data/stadium_manifest.json
"""

import json
from pathlib import Path

IN = Path("data/huskers_schedule_normalized.json")
OUT = Path("data/stadium_manifest.json")
IMAGES_DIR = Path("images/stadiums")

def main():
    if not IN.exists():
        raise SystemExit(f"Missing {IN}")
    data = json.loads(IN.read_text())

    existing = {p.name for p in IMAGES_DIR.glob("*.*")}  # exact filenames present
    items = {}

    for g in data:
        key = g.get("bg_key") or "Unknown-Stadium-XX"
        suggested = f"{key}.jpg"  # convention; png works too if you prefer
        exists = (suggested in existing) or (f"{key}.png" in existing)

        items[key] = {
            "opponent": g.get("opponent"),
            "venue": g.get("home_away_neutral"),
            "date": g.get("date_text"),
            "suggested_filename": suggested,
            "exists": exists
        }

    OUT.write_text(json.dumps({
        "images_directory": "images/stadiums",
        "items": items
    }, indent=2))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()
