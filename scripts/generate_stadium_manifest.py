#!/usr/bin/env python3
"""
Generate a manifest of required background images.

- Reads:  data/huskers_schedule_normalized.json
- Writes: data/stadium_manifest.json

Each item shows which bg_key is expected and whether an image with that
name (any extension) exists under images/stadiums/.
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

    have = {p.stem for p in IMAGES_DIR.glob("*.*")}  # stem = filename without extension
    items = {}
    for g in data:
        key = g.get("bg_key")
        if not key: 
            continue
        fn = f"{key}.jpg"  # suggested; png also fine
        items[key] = {
            "opponent": g.get("opponent"),
            "date_text": g.get("date_text"),
            "divider": g.get("divider"),
            "home_away_neutral": g.get("home_away_neutral"),
            "city_display": g.get("city_display"),
            "suggested_filename": fn,
            "exists": key in have
        }

    OUT.write_text(json.dumps({
        "images_directory": "images/stadiums",
        "items": items
    }, indent=2))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()
