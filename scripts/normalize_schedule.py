#!/usr/bin/env python3
"""
Normalize the raw scrape into a tiny, UI-friendly array.

- Reads:  data/huskers_schedule.json
- Reads:  data/stadium_overrides.json (optional)
- Writes: data/huskers_schedule_normalized.json

Decisions (per Trent):
- Divider literal: "vs." / "at"
- City only (no stadium names) in UI
- Months short: Sep/Oct/Nov
- Background image naming:
  * Human key: TeamName-Stadium-State (bg_key, may contain spaces)
  * File base: TeamName-Stadium-State with spaces -> dashes (bg_file_basename)
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

# Only used when location doesn’t include a stadium; no city-only fallbacks.
OPP_STADIUM_MAP = {
    "Maryland":   {"state": "MD", "stadium": "SECU Stadium"},
    "Minnesota":  {"state": "MN", "stadium": "Huntington Bank Stadium"},
    "UCLA":       {"state": "CA", "stadium": "Rose Bowl"},
    "Penn State": {"state": "PA", "stadium": "Beaver Stadium"},
    "Nebraska":   {"state": "NE", "stadium": "Memorial Stadium"},
}

def dashify(s: str) -> str:
    """Convert spaces to dashes and collapse repeats. Keep case & punctuation → dashes."""
    s = (s or "").strip()
    s = re.sub(r"\s+", "-", s)         # spaces → dash
    s = re.sub(r"-{2,}", "-", s)       # collapse ---
    return s

def parse_location(raw: str):
    """Return (city, stateUSPS, stadium_or_none) from strings like:
       'Kansas City, Mo. / Arrowhead Stadium' or 'Pasadena, Calif.'"""
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
    return city or None, state or None, stadium or None

def month_title_case(date_text: str) -> str:
    # "SEP 6" -> "Sep 6", "OCT 11" -> "Oct 11"
    parts = (date_text or "").split()
    if len(parts) == 2:
        return f"{parts[0].title()} {parts[1]}"
    return (date_text or "").title()

def build_game_key(year_guess: int, date_text: str, divider_text: str, opponent: str) -> str:
    # Key format for overrides: "YYYY-MMM-DD <divider> <Opponent>"
    parts = (date_text or "").split()
    if len(parts) == 2:
        mm = parts[0].upper()[:3]
        dd = parts[1].zfill(2)
        return f"{year_guess}-{mm}-{dd} {divider_text.strip()} {opponent}"
    return f"{year_guess}-{(date_text or '').strip()} {divider_text.strip()} {opponent}"

def compute_bg_fields(venue: str, opponent: str, city: str, state: str, location_stadium: str) -> tuple[str, str, str]:
    """
    Returns (team_name, stadium_name, state_code) for human bg_key: TeamName-Stadium-State
    """
    # HOME → Nebraska at Memorial Stadium, NE
    if venue == "HOME":
        return "Nebraska", "Memorial Stadium", "NE"

    # AWAY/NEUTRAL
    team = opponent or "Unknown"
    # Prefer explicit stadium from location (right side after '/')
    if location_stadium:
        stadium = location_stadium
        st = state or "XX"
        return team, stadium, st

    # Else try the opponent map
    if opponent in OPP_STADIUM_MAP:
        info = OPP_STADIUM_MAP[opponent]
        return team, info["stadium"], info["state"]

    # Last resort: no city-only allowed; use generic "Stadium"
    return team, "Stadium", (state or "XX")

def normalize():
    if not RAW.exists():
        raise SystemExit(f"Missing {RAW}")
    raw = json.loads(RAW.read_text())

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
        venue = (g.get("venue_type") or "").upper().strip()   # HOME/AWAY/NEUTRAL
        weekday = (g.get("weekday") or "").strip()
        date_text = (g.get("date_text") or "").strip()
        divider = (g.get("divider_text") or "vs.").strip()    # literal "vs." / "at"
        opponent = (g.get("opponent_name") or "").strip()

        date_display = month_title_case(date_text)

        kickoff = g.get("kickoff") or "—"
        kickoff_display = "—" if kickoff.upper() in ("TBA","TBD") else kickoff

        status = g.get("status") or "tbd"
        outcome = g.get("result",{}).get("outcome") if status == "final" else None
        score   = g.get("result",{}).get("score")   if status == "final" else None

        city, state, stadium_from_loc = parse_location(g.get("location") or "")
        city_display = f"{city}{', ' + state if state else ''}" if city else "—"

        # Build override key and compute bg parts
        override_key = build_game_key(year_guess, date_text, divider, opponent)
        team_name, stadium_name, state_code = compute_bg_fields(venue, opponent, city, state, stadium_from_loc)

        # Apply override if present (value should be "Team-Stadium-State")
        if overrides.get(override_key):
            ov = overrides[override_key]
            try:
                t, s, st = ov.rsplit("-", 2)
                team_name, stadium_name, state_code = t, s, st
            except Exception:
                team_name = ov  # fallback

        # Human key keeps spaces for readability
        bg_key = f"{team_name}-{stadium_name}-{state_code}"
        # File-safe base and filename (NO SPACES)
        bg_file_basename = dashify(bg_key)
        bg_filename = f"{bg_file_basename}.jpg"

        out.append({
            "date_text": date_display,
            "weekday": weekday,
            "kickoff_display": kickoff_display,
            "status": status,                 # "final" | "upcoming" | "tbd"
            "outcome": outcome,               # "W" | "L" | "T" | null
            "score": score,                   # "20-17" | null
            "home_away_neutral": venue,       # HOME/AWAY/NEUTRAL
            "divider": divider,               # literal "vs." / "at"
            "opponent": opponent,
            "city": city,
            "state": state,
            "city_display": city_display,     # UI uses City, ST (no stadium)
            "tv_logo": g.get("tv_network_logo_url"),
            "opp_logo": g.get("opponent_logo_url"),
            "ne_logo": g.get("nebraska_logo_url"),
            "bg_key": bg_key,                 # human key (can contain spaces)
            "bg_file_basename": bg_file_basename,  # e.g., Nebraska-Memorial-Stadium-NE
            "bg_filename": bg_filename,       # e.g., Nebraska-Memorial-Stadium-NE.jpg
            "links": g.get("links", [])
        })

    OUT.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    normalize()
