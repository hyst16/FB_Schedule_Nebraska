/* assets/app.js
   Husker Schedule — dual views (hero + compact schedule).
   NEW: Auto-density fitter for the schedule rows (#view-all).
*/

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

let schedule = [];
let manifest = null;
let viewIndex = 0;
const views = ["#view-next","#view-all"];

/* ---------------- Rotation between views ---------------- */
function rotate() {
  $$(".view").forEach(v=>v.classList.add("hidden"));
  const target = window.lockView === "next" ? "#view-next"
                : window.lockView === "all"  ? "#view-all"
                : views[viewIndex];
  $(target).classList.remove("hidden");
  if (!window.lockView) viewIndex = (viewIndex + 1) % views.length;
}

/* ---------------- Helpers shared across views ---------------- */
function pickNextGame(games) {
  return games.find(g => g.status !== "final") || games[games.length - 1] || null;
}

function venueFallback(game) {
  const typ = (game.home_away_neutral || "NEUTRAL").toUpperCase();
  const name = typ === "HOME" ? "fallback_home"
            : typ === "AWAY" ? "fallback_away"
            : "fallback_neutral";
  return `images/stadiums/${name}.jpg`;
}

/* Try jpg → jpeg → png for a given bg base; fall back by venue type if none. */
function setBgWithFallbacks(game) {
  const base = (game.bg_file_basename || game.bg_key || "fallback").replace(/\s+/g, "-");
  const candidates = [
    `images/stadiums/${base}.jpg`,
    `images/stadiums/${base}.jpeg`,
    `images/stadiums/${base}.png`,
  ];
  const fallbackUrl = venueFallback(game);
  const has = manifest?.items?.[game.bg_key]?.exists;

  if (!has) {
    $("#next-bg").style.backgroundImage = `url("${fallbackUrl}")`;
    return;
  }

  let i = 0;
  const img = new Image();
  img.onload  = () => { $("#next-bg").style.backgroundImage = `url("${candidates[i]}")`; };
  img.onerror = () => { i += 1; (i < candidates.length) ? img.src = candidates[i]
                                                      : $("#next-bg").style.backgroundImage = `url("${fallbackUrl}")`; };
  img.src = candidates[i];
}

/* ---------------- Hero (next-game) view ---------------- */
function setNextGameView(game) {
  // Title: "Nebraska vs. <Opponent>" or "Nebraska at <Opponent>"
  const oppName = game.opponent || "TBD";
  const divider = (game.divider || "vs.").trim();
  const title = `Nebraska ${divider} ${oppName}`;
  const dateStr = [game.weekday, game.date_text, game.kickoff_display].filter(Boolean).join(" • ");

  $("#divider").textContent = divider;
  $("#next-opponent").textContent = title;   // <- Full title line
  $("#next-datetime").textContent = dateStr;
  $("#next-venue").textContent = game.city_display || "—";

  // Logos
  $("#ne-logo").src  = game.ne_logo  || "";
  $("#opp-logo").src = game.opp_logo || "";

  // TV chip
  const tv = $("#next-tv");
  tv.innerHTML = "";
  if (game.tv_logo) {
    const chip = document.createElement("span");
    chip.className = "tv-chip";
    const img = document.createElement("img");
    img.src = game.tv_logo;
    chip.appendChild(img);
    tv.appendChild(chip);
  }

  // Stadium background
  setBgWithFallbacks(game);
}

/* ================================================================
   Schedule view (one compact row per game)
================================================================ */

function isTimeKnown(t) {
  if (!t) return false;
  const x = t.trim().toUpperCase();
  return x !== "—" && x !== "TBA" && x !== "TBD";
}

/* Tiny chip helpers */
function chip(text, extraClass) {
  if (!text) return null;
  const s = document.createElement("span");
  s.className = `chip ${extraClass||""}`.trim();
  s.textContent = text;
  return s;
}
function tvChip(logoUrl) {
  if (!logoUrl) return null;
  const s = document.createElement("span");
  s.className = "chip tv";
  const img = document.createElement("img");
  img.src = logoUrl;
  s.appendChild(img);
  return s;
}

/* Build a single compact row for game g. */
function buildGameRow(g) {
  const row = document.createElement("div");
  const ven = (g.home_away_neutral || "").toUpperCase();
  row.className = `game-row ${ven === "HOME" ? "is-home" : "is-away"}`;

  /* Left cap: narrow date + weekday (stacked) */
  const when = document.createElement("div");
  when.className = "when";
  const date = document.createElement("div");
  date.className = "date";
  date.textContent = g.date_text || "";
  const dow  = document.createElement("div");
  dow.className = "dow";
  dow.textContent = (g.weekday || "").slice(0,3).toLowerCase().replace(/^\w/, c=>c.toUpperCase());
  when.appendChild(date); when.appendChild(dow);
  row.appendChild(when);

  /* Main line */
  const line = document.createElement("div");
  line.className = "line";

  // Result FIRST (shown only when final)
  if (g.status === "final" && g.outcome && g.score) {
    const r = document.createElement("span");
    r.className = `result ${g.outcome}`; // W | L | T
    r.textContent = `${g.outcome} ${g.score}`;
    line.appendChild(r);
  }

  // Nebraska mark
  if (g.ne_logo) {
    const ne = document.createElement("img");
    ne.className = "mark ne";
    ne.src = g.ne_logo;
    line.appendChild(ne);
  }

  // "vs." or "at"
  const divSpan = document.createElement("span");
  divSpan.className = "divider";
  divSpan.textContent = (g.divider || "vs.").trim();
  line.appendChild(divSpan);

  // Opponent mark
  if (g.opp_logo) {
    const ol = document.createElement("img");
    ol.className = "mark opp";
    ol.src = g.opp_logo;
    line.appendChild(ol);
  }

  // Opponent name
  const opp = document.createElement("span");
  opp.className = "opp-name";
  opp.textContent = g.opponent || "TBD";
  line.appendChild(opp);

  // Chips: time (only if known) • city • TV
  if (isTimeKnown(g.kickoff_display)) {
    line.appendChild(chip(g.kickoff_display, "time"));
  }
  const cityChipEl = chip(g.city_display || "—", "city");
  if (cityChipEl) line.appendChild(cityChipEl);
  const tvC = tvChip(g.tv_logo);
  if (tvC) line.appendChild(tvC);

  row.appendChild(line);
  return row;
}

/* Render all games into #view-all (compact rows) */
function renderScheduleView(games) {
  const wrap = $("#view-all .all-wrap");
  wrap.innerHTML = "";

  const list = document.createElement("div");
  list.className = "rows";
  games.forEach(g => list.appendChild(buildGameRow(g)));

  wrap.appendChild(list);
}

/* ======================= AUTO-DENSITY FITTER =======================
   Goal: Ensure the schedule rows fit vertically in the viewport.
   Strategy:
     1) Start with "normal" (no data-density attribute)
     2) If too tall → set data-density="compact"
     3) If still tall → set data-density="ultra"
   Nothing scales; we only tighten spacing/fonts via CSS tokens.
=================================================================== */
function getSafePx() {
  // Read the CSS --safe value (in px) from :root
  const root = getComputedStyle(document.documentElement);
  const val = root.getPropertyValue('--safe').trim();
  // Accept "25px" or just "25"
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function applyDensity(level) {
  const viewAll = $("#view-all");
  if (!viewAll) return;
  if (level === "normal") viewAll.removeAttribute("data-density");
  else viewAll.setAttribute("data-density", level);
}

function measureScheduleHeight() {
  const list = $("#view-all .rows");
  if (!list) return 0;
  // getBoundingClientRect height gives the on-screen size including gaps
  return list.getBoundingClientRect().height;
}

function availableScheduleHeight() {
  // We want the visible height inside the safe padding
  const safe = getSafePx();
  return window.innerHeight - (safe * 2);
}

function fitSchedule() {
  // Try densities in order until it fits
  const order = ["normal", "compact", "ultra"];
  for (const level of order) {
    applyDensity(level);
    // Force a reflow so the CSS var changes take effect before we measure.
    // eslint-disable-next-line no-unused-expressions
    document.body.offsetHeight;
    const needed = measureScheduleHeight();
    const avail  = availableScheduleHeight();
    if (needed <= avail) return; // fits at this level
  }
  // If even "ultra" doesn't fit, we stay at "ultra".
}

/* ---------------- Load + boot ---------------- */
async function load() {
  const dataUrl     = window.DATA_URL     || "data/huskers_schedule_normalized.json";
  const manifestUrl = window.MANIFEST_URL || "data/stadium_manifest.json";

  const [s, m] = await Promise.all([
    fetch(dataUrl,     { cache:"no-store" }).then(r=>r.json()),
    fetch(manifestUrl, { cache:"no-store" }).then(r=>r.json())
  ]);

  schedule = s;
  manifest = m;

  // Hero (next-game)
  const next = pickNextGame(schedule);
  if (next) setNextGameView(next);

  // Compact schedule list
  renderScheduleView(schedule);

  // Fit rows to viewport
  fitSchedule();

  if (debug) {
    const d = $("#debug");
    d.classList.remove("hidden");
    d.textContent = `Loaded ${new Date().toLocaleString()} • games=${schedule.length}`;
  }

  rotate();
  setInterval(rotate, window.UI.rotateSeconds * 1000);
}

(function init() {
  window.lockView = (new URLSearchParams(location.search)).get("view");
  window.debug = (new URLSearchParams(location.search)).get("debug") === "1";

  window.addEventListener("keydown", (e)=>{
    if (e.key.toLowerCase() === "r") load().catch(console.error);
  });

  // Re-fit on resize/orientation changes (e.g., 1080p ↔︎ 4K, kiosk modes, etc.)
  window.addEventListener("resize", () => {
    // Only affects the schedule view; hero remains untouched
    fitSchedule();
  });

  load().catch(console.error);
})();
