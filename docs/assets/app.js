/* assets/app.js
   Husker Schedule — dual views:
   - #view-next : hero/next-game card
   - #view-all  : compact schedule (now supports 1 or 2 columns)

   Notes:
   • Two-column mode is opt-in via URL (?cols=2) or window.UI.cols = 2 in index.html.
   • Columns preserve reading order: left column first, then right column.
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

function abbrevVenue(v) {
  const t = (v || "").toUpperCase();
  return t.startsWith("H") ? "H" : t.startsWith("A") ? "A" : "N";
}

function venueFallback(game) {
  const typ = (game.home_away_neutral || "NEUTRAL").toUpperCase();
  const name = typ === "HOME" ? "fallback_home"
            : typ === "AWAY" ? "fallback_away"
            : "fallback_neutral";
  return `images/stadiums/${name}.jpg`;
}

/* Try jpg → jpeg → png; fallback by venue type if manifest says we don't have it */
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
  const oppName = game.opponent || "TBD";
  const divider = (game.divider || "vs.").trim();
  const matchupStr = `Nebraska ${divider} ${oppName}`;

  const dateStr = [game.weekday, game.date_text, game.kickoff_display].filter(Boolean).join(" • ");
  const cityStr = game.city_display || "—";

  $("#divider").textContent = divider;
  $("#next-opponent").textContent = matchupStr;
  $("#next-datetime").textContent = dateStr;
  $("#next-venue").textContent = cityStr || "—";

  $("#ne-logo").src  = game.ne_logo  || "";
  $("#opp-logo").src = game.opp_logo || "";

  const tv = $("#next-tv");
  tv.innerHTML = "";
  if (game.tv_logo) {
    const chip = document.createElement("span");
    chip.className = "tv-chip";
    const img = document.createElement("img");
    img.src = game.tv_logo;
    chip.appendChild(img);
    tv.appendChild(chip);
  } else {
    tv.textContent = "TV: TBD";
  }

  setBgWithFallbacks(game);
}

/* ---------------- Schedule row builder ---------------- */

function isTimeKnown(t) {
  if (!t) return false;
  const x = t.trim().toUpperCase();
  return x !== "—" && x !== "TBA" && x !== "TBD";
}

function dowFromText(weekday) {
  return (weekday || "").slice(0,3).charAt(0).toUpperCase() + (weekday || "").slice(1,3).toLowerCase();
}

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

function buildGameRow(g) {
  const row = document.createElement("div");
  const ven = (g.home_away_neutral || "").toUpperCase();
  row.className = `game-row ${ven === "HOME" ? "is-home" : "is-away"}`;

  const when = document.createElement("div");
  when.className = "when";
  const date = document.createElement("div");
  date.className = "date";
  date.textContent = g.date_text || "";
  const dow  = document.createElement("div");
  dow.className = "dow";
  dow.textContent = dowFromText(g.weekday || "");
  when.appendChild(date); when.appendChild(dow);
  row.appendChild(when);

  const line = document.createElement("div");
  line.className = "line";

  // result (only if final)
  if (g.status === "final" && g.outcome && g.score) {
    const r = document.createElement("span");
    r.className = `result ${g.outcome}`;
    r.textContent = `${g.outcome} ${g.score}`;
    line.appendChild(r);
  }

  if (g.ne_logo) { const ne = document.createElement("img"); ne.className = "mark ne"; ne.src = g.ne_logo; line.appendChild(ne); }
  const divSpan = document.createElement("span");
  divSpan.className = "divider";
  divSpan.textContent = (g.divider || "vs.").trim();
  line.appendChild(divSpan);
  if (g.opp_logo) { const ol = document.createElement("img"); ol.className = "mark opp"; ol.src = g.opp_logo; line.appendChild(ol); }

  const opp = document.createElement("span");
  opp.className = "opp-name";
  opp.textContent = g.opponent || "TBD";
  line.appendChild(opp);

  if (isTimeKnown(g.kickoff_display)) line.appendChild(chip(g.kickoff_display, "time"));
  const cityChipEl = chip(g.city_display || "—", "city");
  if (cityChipEl) line.appendChild(cityChipEl);
  const tvC = tvChip(g.tv_logo);
  if (tvC) line.appendChild(tvC);

  row.appendChild(line);
  return row;
}

/* ---------------- Render: ALWAYS 2 columns ---------------- */
function renderScheduleView(games) {
  const wrap = $("#view-all .all-wrap");
  wrap.innerHTML = "";

  const colsWanted = 2; // <- force two columns

  // Split list in reading order: left col gets first half, right col gets second half
  const mid = Math.ceil(games.length / 2);
  const left  = games.slice(0, mid);
  const right = games.slice(mid);

  const grid = document.createElement("div");
  grid.className = "cols";          // MUST match CSS

  const colL = document.createElement("div");
  colL.className = "col";
  left.forEach(g => colL.appendChild(buildGameRow(g)));

  const colR = document.createElement("div");
  colR.className = "col";
  right.forEach(g => colR.appendChild(buildGameRow(g)));

  grid.appendChild(colL);
  grid.appendChild(colR);
  wrap.appendChild(grid);
}

/* ---------------- Load + boot (unchanged except calls renderScheduleView) ---------------- */

async function load() {
  const dataUrl     = window.DATA_URL     || "data/huskers_schedule_normalized.json";
  const manifestUrl = window.MANIFEST_URL || "data/stadium_manifest.json";

  const [s, m] = await Promise.all([
    fetch(dataUrl,     { cache:"no-store" }).then(r=>r.json()),
    fetch(manifestUrl, { cache:"no-store" }).then(r=>r.json())
  ]);

  schedule = s; manifest = m;

  const next = pickNextGame(schedule);
  if (next) setNextGameView(next);

  renderScheduleView(schedule);

  if (window.debug) {
    const d = $("#debug");
    d.classList.remove("hidden");
    d.textContent = `Loaded ${new Date().toLocaleString()} • games=${schedule.length}`;
  }

  rotate();
  setInterval(rotate, window.UI.rotateSeconds * 1000);
}

(function init() {
  const params = new URLSearchParams(location.search);
  window.lockView = params.get("view");
  window.debug = params.get("debug") === "1";

  window.addEventListener("keydown", (e)=>{
    if (e.key.toLowerCase() === "r") load().catch(console.error);
  });
  load().catch(console.error);
})();
