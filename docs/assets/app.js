/* assets/app.js
   Husker Schedule — dual views:
   - #view-next : hero/next-game card
   - #view-all  : compact single-row-per-game schedule (scale-to-fit)

   Scale-to-fit strategy (schedule only):
   1) Render rows at "natural" size inside .scale-target
   2) Measure target W/H vs the available stage (.scale-viewport)
   3) scale = min(stageW/targetW, stageH/targetH, 1)  // shrink-only
   4) Apply transform: scale(scale) and center within the stage
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
  const oppName = game.opponent || "TBD";
  const divider = (game.divider || "vs.").trim(); // literal from site
  const dateStr = [game.weekday, game.date_text, game.kickoff_display].filter(Boolean).join(" • ");
  const cityStr = game.city_display || "—";
  const han = abbrevVenue(game.home_away_neutral);

  $("#divider").textContent = divider;
  $("#next-opponent").textContent = `Nebraska ${divider} ${oppName}`; // display both names
  $("#next-datetime").textContent = dateStr;

  // Remove the venue abbrev & bullet as requested: show only city
  $("#next-venue").textContent = cityStr;

  // TV: present as a "chip" if we have a logo; else hide the chip entirely
  const tv = $("#next-tv");
  tv.innerHTML = "";
  if (game.tv_logo) {
    tv.classList.add("chip-tv");
    const img = document.createElement("img");
    img.src = game.tv_logo;
    tv.appendChild(img);
  } else {
    tv.classList.remove("chip-tv");
  }

  // Stadium background (no Ken Burns)
  setBgWithFallbacks(game);
}

/* ================================================================
   Schedule view (one compact row per game) + SCALE TO FIT
================================================================ */

function isTimeKnown(t) {
  if (!t) return false;
  const x = t.trim().toUpperCase();
  return x !== "—" && x !== "TBA" && x !== "TBD";
}

function dowFromText(weekday) {
  return (weekday || "").slice(0,3).charAt(0).toUpperCase() + (weekday || "").slice(1,3).toLowerCase();
}

/* Tiny general chip */
function chip(text, extraClass) {
  if (!text) return null;
  const s = document.createElement("span");
  s.className = `chip ${extraClass||""}`.trim();
  s.textContent = text;
  return s;
}

/* White TV chip with logo */
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

  /* Left cap: date + weekday (stacked) */
  const when = document.createElement("div");
  when.className = "when";
  const date = document.createElement("div");
  date.className = "date";
  date.textContent = g.date_text || "";
  const dow  = document.createElement("div");
  dow.className = "dow";
  dow.textContent = dowFromText(g.weekday || "");
  when.appendChild(date);
  when.appendChild(dow);
  row.appendChild(when);

  /* Main line: result (if final) → marks/divider → opponent → chips */
  const line = document.createElement("div");
  line.className = "line";

  // Result pill right after date block
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

  const divSpan = document.createElement("span");
  divSpan.className = "divider";
  divSpan.textContent = (g.divider || "vs.").trim(); // literal
  line.appendChild(divSpan);

  if (g.opp_logo) {
    const ol = document.createElement("img");
    ol.className = "mark opp";
    ol.src = g.opp_logo;
    line.appendChild(ol);
  }

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

/* Render all games into #view-all (compact rows), wrapped in scale containers. */
function renderScheduleView(games) {
  const wrap = $("#view-all .all-wrap");
  wrap.innerHTML = ""; // clear any previous content

  // Build: scale-viewport → scale-target → rows → game-rows
  const viewport = document.createElement("div");
  viewport.className = "scale-viewport";

  const target = document.createElement("div");
  target.className = "scale-target";

  const list = document.createElement("div");
  list.className = "rows";

  games.forEach(g => list.appendChild(buildGameRow(g)));

  target.appendChild(list);
  viewport.appendChild(target);
  wrap.appendChild(viewport);
}

/* Compute and apply a uniform scale so the schedule fits inside the stage. */
function scaleScheduleToFit() {
  const viewport = $("#view-all .scale-viewport");
  const target   = $("#view-all .scale-target");
  if (!viewport || !target) return;

  // Reset transform to measure "natural" size
  target.style.transform = "none";
  target.style.left = "0px";
  target.style.top  = "0px";

  // Available stage size (already inside safe paddings)
  const stageW = viewport.clientWidth;
  const stageH = viewport.clientHeight;

  // Natural content size
  const naturalW = target.offsetWidth;
  const naturalH = target.offsetHeight;

  // Shrink-only scale
  const scale = Math.min(stageW / naturalW, stageH / naturalH, 1);

  // Apply transform
  target.style.transformOrigin = "top left";
  target.style.transform = `scale(${scale})`;

  // Center the scaled box visually inside the stage
  const visualW = naturalW * scale;
  const visualH = naturalH * scale;
  const left = Math.max(0, (stageW - visualW) / 2);
  const top  = Math.max(0, (stageH - visualH) / 2);
  target.style.left = `${left}px`;
  target.style.top  = `${top}px`;
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

  // Schedule list
  renderScheduleView(schedule);

  // First scale pass
  scaleScheduleToFit();

  if (window.debug) {
    const d = $("#debug");
    d.classList.remove("hidden");
    d.textContent = `Loaded ${new Date().toLocaleString()} • games=${schedule.length}`;
  }

  rotate();
  setInterval(rotate, window.UI.rotateSeconds * 1000);
}

// Re-scale on resize/orientation change. Debounced to avoid thrash.
let _resizeTimer = null;
function handleResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(scaleScheduleToFit, 100);
}

(function init() {
  window.lockView = (new URLSearchParams(location.search)).get("view");
  window.debug = (new URLSearchParams(location.search)).get("debug") === "1";

  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  // Quick keyboard reload (handy while tuning)
  window.addEventListener("keydown", (e)=>{
    if (e.key.toLowerCase() === "r") load().catch(console.error);
  });

  load().catch(console.error);
})();
