const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

let schedule = [];
let manifest = null;
let viewIndex = 0;
const views = ["#view-next","#view-all"];

function rotate() {
  $$(".view").forEach(v=>v.classList.add("hidden"));
  const target = window.lockView === "next" ? "#view-next"
                : window.lockView === "all"  ? "#view-all"
                : views[viewIndex];
  $(target).classList.remove("hidden");
  if (!window.lockView) viewIndex = (viewIndex + 1) % views.length;
}

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

function setBgWithFallbacks(game) {
  // prefer precomputed dashified base from normalized JSON;
  // otherwise dashify the human key here
  const base = (game.bg_file_basename || game.bg_key || "fallback").replace(/\s+/g, "-");

  const candidates = [
    `images/stadiums/${base}.jpg`,
    `images/stadiums/${base}.jpeg`,
    `images/stadiums/${base}.png`,
  ];
  const fallbackUrl = venueFallback(game);

  // if manifest says we don't have this, jump to venue fallback
  const has = manifest?.items?.[game.bg_key]?.exists;
  if (!has) {
    $("#next-bg").style.backgroundImage = `url("${fallbackUrl}")`;
    return;
  }

  // try jpg → jpeg → png, then venue fallback
  let i = 0;
  const img = new Image();
  img.onload = () => { $("#next-bg").style.backgroundImage = `url("${candidates[i]}")`; };
  img.onerror = () => {
    i += 1;
    if (i < candidates.length) img.src = candidates[i];
    else $("#next-bg").style.backgroundImage = `url("${fallbackUrl}")`;
  };
  img.src = candidates[i];
}

function setNextGameView(game) {
  const oppName = game.opponent || "TBD";
  const divider = (game.divider || "vs.").trim(); // literal
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

  // TV
  const tv = $("#next-tv");
  tv.innerHTML = "";
  if (game.tv_logo) {
    const img = document.createElement("img");
    img.src = game.tv_logo; img.style.height="28px"; img.style.verticalAlign="middle";
    tv.appendChild(img);
  } else {
    tv.textContent = "TV: TBD";
  }

  // Background (no Ken Burns)
  setBgWithFallbacks(game);
}

function addHeaderRow(tbl) {
  ["Date","Time","Opponent","H/A/N","City","TV","Result"]
    .forEach(t => {
      const d = document.createElement("div");
      d.className = "header";
      d.textContent = t;
      tbl.appendChild(d);
    });
}

function addGameRow(tbl, g) {
  const d1 = document.createElement("div"); d1.textContent = g.date_text || ""; tbl.appendChild(d1);
  const d2 = document.createElement("div"); d2.textContent = g.kickoff_display || "—"; tbl.appendChild(d2);

  const d3 = document.createElement("div"); d3.className = "cell-opp"; d3.style.display="flex"; d3.style.alignItems="center";
  if (g.opp_logo) { const i = document.createElement("img"); i.src = g.opp_logo; d3.appendChild(i); }
  const t = document.createElement("span"); t.textContent = " " + (g.opponent || "");
  d3.appendChild(t); tbl.appendChild(d3);

  const d4 = document.createElement("div"); d4.textContent = abbrevVenue(g.home_away_neutral); tbl.appendChild(d4);
  
  const d5 = document.createElement("div"); d5.textContent = g.city_display || "—"; tbl.appendChild(d5);

  const d6 = document.createElement("div"); d6.className = "cell-tv";
  if (g.tv_logo) { const i = document.createElement("img"); i.src = g.tv_logo; d6.appendChild(i); }
  else { d6.textContent = "—"; }
  tbl.appendChild(d6);

  const d7 = document.createElement("div");
  if (g.status === "final" && g.outcome && g.score) {
    const b = document.createElement("span"); b.className = `badge ${g.outcome}`; b.textContent = `${g.outcome} ${g.score}`;
    d7.appendChild(b);
  } else { d7.textContent = "—"; }
  tbl.appendChild(d7);
}

async function load() {
  const [s, m] = await Promise.all([
    fetch("data/huskers_schedule_normalized.json", {cache:"no-store"}).then(r=>r.json()),
    fetch("data/stadium_manifest.json", {cache:"no-store"}).then(r=>r.json())
  ]);
  schedule = s; manifest = m;

  const next = pickNextGame(schedule);
  if (next) setNextGameView(next);

  const tbl = $("#schedule-table");
  addHeaderRow(tbl);
  schedule.forEach(g => addGameRow(tbl, g));

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
