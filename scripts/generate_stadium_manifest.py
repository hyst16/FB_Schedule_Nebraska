#!/usr/bin/env python3
import json
from pathlib import Path

IN = Path("data/huskers_schedule_normalized.json")
OUT = Path("data/stadium_manifest.json")
IMAGES_DIR = Path("images/stadiums")

def main():
    if not IN.exists():
        raise SystemExit(f"Missing {IN}")
    data = json.loads(IN.read_text())

    existing = {p.name for p in IMAGES_DIR.glob("*.*")}  # exact filenames
    items = {}  # bg_key -> {suggested_filename, exists, used_by: [...]}

    for g in data:
        key = g.get("bg_key") or "Unknown-Stadium-XX"
        suggested = f"{key}.jpg"
        exists = (suggested in existing) or (f"{key}.png" in existing)

        entry = items.setdefault(key, {
            "suggested_filename": suggested,
            "exists": exists,
            "used_by": []
        })
        # if any game has the file present, mark exists true
        entry["exists"] = entry["exists"] or exists
        entry["used_by"].append({
            "date": g.get("date_text"),
            "opponent": g.get("opponent"),
            "venue": g.get("home_away_neutral")
        })

    OUT.write_text(json.dumps({
        "images_directory": "images/stadiums",
        "items": items
    }, indent=2))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()
