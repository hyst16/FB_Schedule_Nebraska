/* assets/app.js
   Husker Schedule — dual views:
   - #view-next : hero/next-game card (unchanged)
   - #view-all  : compact single-row-per-game schedule (new layout)

   Notes:
   • All schedule-specific styles/markup are scoped under #view-all so we never
     affect the hero view.
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

/* ---------------- Hero (next-game) view — unchanged ---------------- */
function setNextGameView(game) {
  const oppName = game.opponent || "TBD";
  const divider = (game.divider || "vs.").trim(); // literal from site
  const dateStr = [game.weekday, game.date_text, game.kickoff_display].filter(Boolean).join(" • ");
  const cityStr = game.city_display || "—";
  const han = abbrevVenue(game.home_away_neutral);

  $("#divider").textContent = divider;
  $("#next-opponent").textContent = oppName;
  $("#next-datetime").textContent = dateStr;
  $("#next-venue").textContent = [han, cityStr].filter(Boolean).join(" • ");

  // Logos
  $("#ne-logo").src  = game.ne_logo  || "";
  $("#opp-logo").src = game.opp_logo || "";

  // TV (show logo or “TV: TBD”)
  const tv = $("#next-tv");
  tv.innerHTML = "";
  if (game.tv_logo) {
    const img = document.createElement("img");
    img.src = game.tv_logo;
    img.style.height="28px";
    img.style.verticalAlign="middle";
    tv.appendChild(img);
  } else {
    tv.textContent = "TV: TBD";
  }

  // Stadium background (no Ken Burns)
  setBgWithFallbacks(game);
}

/* ================================================================
   Schedule view (one compact row per game)
   ----------------------------------------------------------------
   Structure:

   <div class="game-row is-home|is-away">      // whole row is one card
     <div class="when">                        // narrow left cap
       <div class="date">Sep 6</div>
       <div class="dow">Sat</div>
     </div>

     <div class="line">                        // main sentence of the row
       <img class="mark ne"  src="...">
       <span class="divider">vs.</span>
       <img class="mark opp" src="...">
       <span class="opp-name">Akron</span>

       <span class="chip time">6:30 PM CDT</span>   // “TBA” if TBA or TBD
       <span class="chip city">Lincoln, NE</span>
       <span class="chip tv"><img src="logo.png"></span>

       <span class="result W">W 20–17</span>       // only when final
     </div>
   </div>
================================================================ */

function monthFromDateText(dateText) {
  // "Sep 6" → "Sep"; safe fallback if unexpected
  return (String(dateText || "").split(" ")[0] || "").slice(0,3);
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

  /* Main line: N {vs./at} [opp logo] Opponent + chips + result */
  const line = document.createElement("div");
  line.className = "line";

  // Nebraska mark (small; helps sentence read left→right)
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

  // Time chip — show “TBA” when time is unknown
  const isTBA = !g.kickoff_display || g.kickoff_display === "—";
  const timeChip = chip(isTBA ? "TBA" : g.kickoff_display, "time");
  if (timeChip) line.appendChild(timeChip);

  // City chip (City, ST)
  const cityChip = chip(g.city_display || "—", "city");
  if (cityChip) line.appendChild(cityChip);

  // TV chip (white capsule with the logo)
  const tvC = tvChip(g.tv_logo);
  if (tvC) line.appendChild(tvC);

  // Result pill appears RIGHT AFTER the chips (per your preference)
  if (g.status === "final" && g.outcome && g.score) {
    const r = document.createElement("span");
    r.className = `result ${g.outcome}`; // W | L | T
    r.textContent = `${g.outcome} ${g.score}`;
    line.appendChild(r);
  }

  row.appendChild(line);
  return row;
}

/* Render all games into #view-all (compact rows) */
function renderScheduleView(games) {
  const wrap = $("#view-all .all-wrap");
  wrap.innerHTML = ""; // clear any previous content

  const list = document.createElement("div");
  list.className = "rows";

  games.forEach(g => list.appendChild(buildGameRow(g)));

  wrap.appendChild(list);
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
  window.addEventListener("keydown", (e)=>{
    if (e.key.toLowerCase() === "r") load().catch(console.error);
  });
  load().catch(console.error);
})();
