/* assets/app.js
   Husker Schedule — dual views:
   - #view-next : hero/next-game card
   - #view-all  : compact single-row-per-game schedule (now scales to fit)

   Notes:
   • Schedule-specific DOM/CSS is scoped under #view-all so the hero view stays untouched.
   • We render all rows inside a .fitbox and scale that box to fit the viewport.
   • Background image logic and manifest fallback remain intact.
   • Respects window.DATA_URL / window.MANIFEST_URL (set in index.html).
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

  // When we show the schedule view, ensure scale is up-to-date
  if (target === "#view-all") requestAnimationFrame(scaleSchedule);
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
  // Used by hero background if a stadium photo is missing
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
  // Literal from the site — already "vs." or "at"
  const divider = (game.divider || "vs.").trim();

  // Build “Nebraska vs. Opponent” (or “Nebraska at Opponent”) using the divider
  const matchupStr = `Nebraska ${divider} ${oppName}`;

  const dateStr = [game.weekday, game.date_text, game.kickoff_display].filter(Boolean).join(" • ");
  const cityStr = game.city_display || "—";

  // Top logo row still shows N • divider • Opponent logo
  $("#divider").textContent = divider;
  $("#next-opponent").textContent = matchupStr;
  $("#next-datetime").textContent = dateStr;
  $("#next-venue").textContent = cityStr || "—";

  // Logos
  $("#ne-logo").src  = game.ne_logo  || "";
  $("#opp-logo").src = game.opp_logo || "";

  // TV (chip style if CSS defines .tv-chip)
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

  // Stadium background (no Ken Burns)
  setBgWithFallbacks(game);
}

/* ================================================================
   Schedule view (one compact row per game)
================================================================ */

function isTimeKnown(t) {
  // Treat "—", "TBA", "TBD" (any casing) as unknown -> hide the time chip
  if (!t) return false;
  const x = t.trim().toUpperCase();
  return x !== "—" && x !== "TBA" && x !== "TBD";
}

function dowFromText(weekday) {
  // "SATURDAY" → "Sat"
  return (weekday || "").slice(0,3).charAt(0).toUpperCase() + (weekday || "").slice(1,3).toLowerCase();
}

/* Create a tiny chip span; if content is falsy, returns null (caller can skip). */
function chip(text, extraClass) {
  if (!text) return null;
  const s = document.createElement("span");
  s.className = `chip ${extraClass||""}`.trim();
  s.textContent = text;
  return s;
}

/* Create a white TV chip that houses the TV logo if available. */
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
  // Venue-driven background theme (HOME red wash, AWAY/NEU gray wash)
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
  dow.textContent = dowFromText(g.weekday || "");
  when.appendChild(date);
  when.appendChild(dow);
  row.appendChild(when);

  /* Main line: result (if final) → N {vs./at} [opp logo] Opponent + chips */
  const line = document.createElement("div");
  line.className = "line";

  // Result FIRST, so it appears right after the date block
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
  divSpan.textContent = (g.divider || "vs.").trim(); // literal from scrape
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

/* Render all games into #view-all (compact rows) inside a scale-to-fit box */
function renderScheduleView(games) {
  const wrap = $("#view-all .all-wrap");
  wrap.innerHTML = ""; // clear any previous content

  // Create the fitbox wrapper that we will scale as a single unit
  const fit = document.createElement("div");
  fit.className = "fitbox";

  const list = document.createElement("div");
  list.className = "rows";

  games.forEach(g => list.appendChild(buildGameRow(g)));

  fit.appendChild(list);
  wrap.appendChild(fit);

  // After DOM is in place, run initial scaling
  requestAnimationFrame(scaleSchedule);
}

/* Scale the schedule to fit the viewport without cropping */
function scaleSchedule() {
  const view = $("#view-all");
  const fit  = $("#view-all .fitbox");
  if (!view || !fit) return;

  // Reset transform to measure natural size
  fit.style.transform = "none";

  // Measure natural content size (rows are inside .fitbox)
  const rect = fit.getBoundingClientRect();
  const vw = view.clientWidth;
  const vh = view.clientHeight;

  const scaleX = vw / rect.width;
  const scaleY = vh / rect.height;
  let scale = Math.min(scaleX, scaleY);

  // Clamp so it never scales UP beyond 1 (keeps text crisp).
  // If you want it to scale up on smaller schedules, remove Math.min(1, ...).
  scale = Math.min(1, scale);

  // Apply scale and horizontally center the box
  fit.style.transform = `translateX(-50%) scale(${scale})`;
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

  // Reload data on R
  window.addEventListener("keydown", (e)=>{
    if (e.key.toLowerCase() === "r") load().catch(console.error);
  });

  // Recompute scale on window resize/orientation changes (throttled)
  window.addEventListener("resize", () => {
    clearTimeout(window.__scaleTimer);
    window.__scaleTimer = setTimeout(scaleSchedule, 50);
  });

  // Re-scale after fonts finish loading (text metrics can change)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scaleSchedule).catch(()=>{});
  }

  load().catch(console.error);
})();
