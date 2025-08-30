#!/usr/bin/env python3
"""
Normalize the raw scrape into a tiny, UI-friendly array.

- Reads:  data/huskers_schedule.json
- Reads:  data/stadium_overrides.json (optional)
- Writes: data/huskers_schedule_normalized.json

Decisions baked in (per Trent):
- Divider literal: use "vs." / "at"
- City only (no stadium names) in UI
- Months short: Sep/Oct/Nov
"""

import json, re
from pathlib import Path
from datetime import datetime

RAW = Path("data/huskers_schedule.json")
OVR = Path("data/stadium_overrides.json")
OUT = Path("data/huskers_schedule_normalized.json")

STATE_MAP = {
    "Neb.": "NE", "Mo.": "MO", "Md.": "MD", "Minn.": "MN", "Calif.": "CA", "Pa.": "PA", "Iowa": "IA",
    "Neb": "NE", "Mo": "MO", "Md": "MD", "Minn": "MN", "Calif": "CA", "Pa": "PA"
}

OPP_STADIUM_MAP = {
    "Maryland":        {"city": "College Park",   "state": "MD", "stadium": "SECU Stadium"},
    "Minnesota":       {"city": "Minneapolis",    "state": "MN", "stadium": "Huntington Bank Stadium"},
    "UCLA":            {"city": "Pasadena",       "state": "CA", "stadium": "Rose Bowl"},
    "Penn State":      {"city": "University Park","state": "PA", "stadium": "Beaver Stadium"},
    "Nebraska":        {"city": "Lincoln",        "state": "NE", "stadium": "Memorial Stadium"},
}

def short_month(mon: str) -> str:
    # Convert AUG, SEP, OCT, NOV.. to Sep, Oct, Nov for display
    m = mon.strip().title()
    # If already like "Aug" "Sep", return as is
    return m

def parse_location(raw: str):
    if not raw:
        return None, None, None
    parts = [p.strip() for p in raw.split("/")]
    left = parts[0] if parts else ""
    stadium = parts[1].strip() if len(parts) > 1 else None
    m = re.match(r"^(.*?),\s*([A-Za-z\.]+)$", left)
    if m:
        city = m.group(1).strip()
        state_raw = m.group(2).strip()
        state = STATE_MAP.get(state_raw, state_raw.upper())
    else:
        city, state = left, None
    return city, state, stadium

def bg_key_for(venue_type, opponent, city, state, stadium):
    # Build a normalized image key; UI uses City only, but backgrounds prefer stadium if known.
    if venue_type == "HOME":
        city, state, stadium = "Lincoln", "NE", "Memorial Stadium"
    if stadium:
        return f"{state or 'xx'}_{slug(city)}_{slug(stadium)}"
    if venue_type in ("AWAY", "NEUTRAL") and opponent in OPP_STADIUM_MAP:
        info = OPP_STADIUM_MAP[opponent]
        return f"{info['state']}_{slug(info['city'])}_{slug(info['stadium'])}"
    if city and state:
        return f"{state}_{slug(city)}"
    if city:
        return f"xx_{slug(city)}"
    return f"unknown_{slug(opponent) or 'tbd'}"

def slug(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+","_", s)
    return re.sub(r"_+","_", s).strip("_")

def build_game_key(year_guess: int, date_text: str, divider_text: str, opponent: str) -> str:
    # Stable-ish key for overrides: "YYYY-MMM-DD vs. Opponent"
    # date_text like "SEP 6" -> "SEP-06"
    parts = date_text.split()
    if len(parts) == 2:
        mm = parts[0].upper()[:3]
        dd = parts[1].zfill(2)
        return f"{year_guess}-{mm}-{dd} {divider_text.strip()} {opponent}"
    return f"{year_guess}-{date_text.strip()} {divider_text.strip()} {opponent}"

def normalize():
    if not RAW.exists():
        raise SystemExit(f"Missing {RAW}")
    raw = json.loads(RAW.read_text())

    # year guess from scraped_at (UTC ISO)
    scraped_at = raw.get("scraped_at")
    year_guess = datetime.fromisoformat(scraped_at.replace("Z","+00:00")).year if scraped_at else datetime.utcnow().year

    overrides = {}
    if OVR.exists():
        try:
            ov = json.loads(OVR.read_text())
            overrides = ov.get("overrides", {})
        except Exception:
            overrides = {}

    out = []
    for g in raw.get("games", []):
        venue = (g.get("venue_type") or "").upper().strip()               # HOME/AWAY/NEUTRAL
        weekday = (g.get("weekday") or "").strip()
        date_text = (g.get("date_text") or "").strip()                     # e.g., "SEP 6"
        divider = (g.get("divider_text") or "vs.").strip()                 # literal "vs." / "at"
        opponent = (g.get("opponent_name") or "").strip()

        # date shortform normalization: keep e.g., "Sep 6"
        try:
            # Turn "SEP 6" into "Sep 6"
            parts = date_text.split()
            date_display = f"{parts[0].title()} {parts[1]}" if len(parts)==2 else date_text.title()
        except Exception:
            date_display = date_text.title()

        # kickoff display
        kickoff = g.get("kickoff") or "—"
        if kickoff.upper() in ("TBA","TBD"):
            kickoff_display = "—"
        else:
            kickoff_display = kickoff

        # result/outcome
        status = g.get("status") or "tbd"
        outcome = g.get("result",{}).get("outcome") if status == "final" else None
        score = g.get("result",{}).get("score") if status == "final" else None

        # location → city/state/stadium
        city, state, stadium = parse_location(g.get("location") or "")
        # UI: City only ( + state )
        city_display = f"{city}{', ' + state if state else ''}" if city else "—"

        # background key (with overrides)
        k = build_game_key(year_guess, date_text, divider, opponent)
        bg_key = None
        if overrides.get(k):
            bg_key = overrides[k]
        else:
            bg_key = bg_key_for(venue, opponent, city, state, stadium)

        out.append({
            "date_text": date_display,                      # e.g., "Sep 6"
            "weekday": weekday,                             # e.g., "SATURDAY"
            "kickoff_display": kickoff_display,             # e.g., "6:30 PM CDT" or "—"
            "status": status,                               # "final" | "upcoming" | "tbd"
            "outcome": outcome,                             # "W" | "L" | "T" | null
            "score": score,                                 # "20-17" | null
            "home_away_neutral": venue,                     # HOME/AWAY/NEUTRAL
            "divider": divider,                             # literal "vs." / "at"
            "opponent": opponent,
            "city": city,                                   # raw city (for future)
            "state": state,                                 # raw state (USPS if mapped)
            "city_display": city_display,                   # UI: City, ST (no stadium)
            "tv_logo": g.get("tv_network_logo_url"),
            "opp_logo": g.get("opponent_logo_url"),
            "ne_logo": g.get("nebraska_logo_url"),
            "bg_key": bg_key,
            "links": g.get("links", [])
        })

    OUT.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    normalize()
