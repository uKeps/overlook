// Overlook. Hash routes, data from /api (vault) and /api/system (agents, services, tasks).
const $ = (s, el = document) => el.querySelector(s);
const main = $("#main");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const LOCALE = "en-US";
const rel = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const addDays = (d, n) => new Date(new Date(d + "T12:00").getTime() + n * 864e5).toLocaleDateString("sv");

let D = null; // vault
let S = { agents: [], services: [], runners: [], tasks: [] }; // system

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  notes: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  review: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8.4 6.6l7.2 1M7 8.3l2.2 7.3M16.6 10.1l-5 6"/>',
  agents: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1.5M15 13v1.5"/>',
  services: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  spark: '<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/>',
  l: '<path d="m15 18-6-6 6-6"/>', r: '<path d="m9 18 6-6-6-6"/>', ext: '<path d="M7 17 17 7M9 7h8v8"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  reload: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', play: '<path d="m7 4 13 8-13 8z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  gap: '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 4 8M8 12h4"/><path d="m3 3 18 18"/>',
  pin: '<path d="M12 17v5M8 3h8l-1.5 7 3.5 3.5H6L9.5 10z"/>', fold: '<path d="m6 9 6 6 6-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5-6"/>',
  settings: '<path d="M4 6h3M11 6h9M4 12h9M17 12h3M4 18h3M11 18h9"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
  cols: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  max: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="2"/>', circle: '<circle cx="12" cy="12" r="8"/>',
  arrowR: '<path d="M5 19 19 5M10 5h9v9"/>', front: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>', eraser: '<path d="m7 21-4-4a2 2 0 0 1 0-3L14 3a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L11 21z"/><path d="M7 21h14M9 9l6 6"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8a7 7 0 0 0 14 0v-4a2 2 0 0 0-4 0"/>',
  select: '<path d="M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M5 21a2 2 0 0 1-2-2M19 21a2 2 0 0 0 2-2M9 3h2M13 3h2M9 21h2M13 21h2M3 9v2M3 13v2M21 9v2M21 13v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  terminal: '<polyline points="4 17 10 12 4 7"/><path d="M12 19h8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  clear: '<path d="M4 6h16M7 12h10M10 18h4"/>', map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  canvasBg: '<circle cx="6" cy="6" r="1.3"/><circle cx="12" cy="6" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/><circle cx="6" cy="18" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="18" cy="18" r="1.3"/>',
};
const icon = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || I.services}</svg>`;

async function api(p, body) {
  const r = await fetch(p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function toast(msg) {
  const t = $("#toast");
  if (typeof msg === "string" && msg.includes("<")) t.innerHTML = msg;
  else t.textContent = msg;
  t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 3600);
}
// Opened over Tailscale (phone): embedded apps use the tailnet links, built from the current host (public URLs work directly).
const remote = location.hostname.endsWith(".ts.net");
const isLocalUrl = (u) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::|\/|$)/i.test(u || "");
const address = (s) => (remote ? (s.tailnet ? `https://${location.hostname}:${s.tailnet}` : isLocalUrl(s.url) ? "" : s.url) : s.proxy ? `http://127.0.0.1:${s.proxy}` : s.url);
// Card i gets image i: shifted by the date in random mode, the same every day when the user fixed their starred images.
// A Home card the user gave an image keeps it (keyed by what the card is about, so it follows the card around).
const cardKey = (s) => `${s.cat}|${s.title}`;
const pinFor = (s) => (typeof s === "number" && SG[s] && D?.pinCards?.[cardKey(SG[s])]) ||
  (D?.pins?.length ? D.pins[(typeof s === "number" ? (D.pinMode === "fixed" ? 0 : hash(D.today)) + s : hash(String(s))) % D.pins.length] : null);
const art = (s) => (pinFor(s) ? `/pin/${pinFor(s).id}` : "");
const obs = (p) => `obsidian://open?vault=${encodeURIComponent(D.vault)}&file=${encodeURIComponent(p.replace(/\.md$/, ""))}`;
const noteHref = (p) => `#/n/${encodeURIComponent(p)}`;
const unlink = (s) => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
const emLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<em>${b || a}</em>`);
const withLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<a href="#/w/${encodeURIComponent(a)}">${b || a}</a>`);
const plain = (s) => unlink(s || "").replace(/[*`_]/g, "");
const nameOf = (p) => p.split("/").pop().replace(/\.md$/, "");
const resolveNote = (name) => D.notes.find((n) => nameOf(n.path) === name || n.title === name);
function ago(ms) {
  const s = (ms - Date.now()) / 1000;
  for (const [u, n] of [["day", 86400], ["hour", 3600], ["minute", 60]]) if (Math.abs(s) >= n) return rel.format(Math.round(s / n), u);
  return "now";
}
const duration = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.floor(s / 86400)} d`);
// Review cards (Review.md): due when they have no date yet or it has come. A card points at a note through the first
// [[link]] in its answer (or, for a note with the old review fields, its path) and shows that note's summary as it is now.
const due = () => (D.cards || []).filter((c) => !c.next || c.next <= D.today).sort((a, b) => (a.next || "").localeCompare(b.next || ""));
const cardNote = (c) => (c.path ? D.notes.find((n) => n.path === c.path) : resolveNote(c.a.match(/\[\[([^\]|#]+)/)?.[1]?.trim()));
let cyc = [{}]; // a key no D.cards equals, so the first call builds the set even when the server sends no cards
const inCycle = (n) => { if (cyc[0] !== D.cards) cyc = [D.cards, new Set((D.cards || []).map((c) => cardNote(c)?.path))]; return cyc[1].has(n.path); };
const inbox = () => D.notes.filter((n) => n.folder === D.inbox);
// Confidence (frontmatter confidence / confianca): how far to trust a note before deciding on it, and how old the check is.
const CONF = { medido: "ok", measured: "ok", confirmed: "ok", deducao: "warn", inferred: "warn", hypothesis: "warn" };
const confKind = (n) => CONF[fold(n.confidence || "")] ?? "";
function confChip(n) {
  if (!n.confidence) return "";
  const k = confKind(n), age = /^\d{4}-\d{2}-\d{2}$/.test(n.updated || "") ? daysBetween(n.updated, D.today) : null;
  const tip = k === "warn" ? "Not confirmed: check it before deciding on it" : k === "ok" ? "Checked against its source" : "General knowledge, not checked here";
  return `<span class="pill conf ${k}" title="${tip}${n.updated ? ` · updated ${esc(n.updated)}` : ""}">${esc(n.confidence)}${age === null ? "" : ` · ${age ? `${age} d` : "today"}`}</span>`;
}
const folderLabel = (f) => (f === "." ? "Root" : f.replace(/^\d+\s*-?\s*/, ""));
const dailyPath = () => `${D.daily}/${D.today}`;

// Ambient background: two layers crossfading with the art of what is in focus.
let ambCurrent = "", ambA = false;
function ambient(url) {
  if (!url || url === ambCurrent) return;
  ambCurrent = url; ambA = !ambA;
  const [on, off] = ambA ? [$("#amb1"), $("#amb2")] : [$("#amb2"), $("#amb1")];
  on.style.backgroundImage = `url(${url}?amb)`; on.classList.add("on"); off.classList.remove("on");
}

// ---------------------------------------------------------------- top bar, week, dock
function clock() {
  const d = new Date();
  $("#time").textContent = d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}
function needsYou() { return (D.focus?.length || 0) + due().length + inbox().length + (D.captured?.length || 0); }
function runningNow() { return (S.tasks || []).filter((t) => !t.end).length; }

function topBar() {
  if (!D) return;
  calRender();
  const run = runningNow();
  const { pg, arg } = route();
  // Floating dock: a pill with the current page and the sum of the badges; the dock rises over it on hover.
  const badges = due().length + run + S.services.filter((s) => !s.ok).length;
  const here = { "": ["home", "Home"], notes: ["notes", "Notes"], n: ["notes", "Notes"], w: ["notes", "Notes"], review: ["review", "Review"], graph: ["graph", "Graph"],
    agents: ["agents", "Agents"], a: ["agents", "Agents"], t: ["agents", "Agents"], services: ["services", "Services"], images: ["services", "Images"], s: ["services", "Service"], settings: ["settings", "Settings"] }[pg] || ["home", "Home"];
  $("#dockwrap").classList.toggle("float", dockMode === "float");
  document.body.classList.toggle("dock-float", dockMode === "float");
  const ub = $("#ui-btn");
  if (ub) ub.innerHTML = `${uiMode === "minimal" ? "Classic" : "Minimal"} <kbd>V</kbd>`;
  $("#dock-pill").innerHTML = `${icon(here[0], 16)}<span>${here[1]}</span>${badges ? `<span class="badge">${badges}</span>` : ""}`;
  const item = (id, name, ic, badge = 0) => `<a href="#/${id}" class="${pg === id || (id === "" && !pg) || (pg === "s" && id === `s/${arg}`) || (pg === "images" && id === "services") ? "on" : ""}" data-tip="${name}" aria-label="${name}">${icon(ic, 22)}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  $("#dock").innerHTML = item("", "Home", "home") + '<span class="sep"></span>' +
    item("notes", "Notes", "notes") + item("review", "Review", "review", due().length) + item("graph", "Graph", "graph") +
    item("agents", "Agents", "agents", run) + (S.services.length ? item("services", "Services", "services", S.services.filter((s) => !s.ok).length) : "") + item("settings", "Settings", "settings") +
    (S.services.some((s) => s.dock) ? '<span class="sep app"></span>' + S.services.filter((s) => s.dock).map((s) => item(`s/${s.id}`, s.name, s.icon || "services").replace("<a ", '<a data-app ')).join("") : "") +
    `<span class="sep"></span><button class="spark" data-act="capture" data-tip="Capture (C)" aria-label="Capture">${icon("spark", 22)}</button>` +
    `<button class="dock-fold" data-act="dock-mode" data-tip="${dockMode === "float" ? "Keep the dock open" : "Fold the dock away"}" aria-label="${dockMode === "float" ? "Keep the dock open" : "Fold the dock away"}">${icon(dockMode === "float" ? "pin" : "fold", 18)}</button>`;
  const onDock = $("#dock a.on");
  const dock = $("#dock");
  if (dock && onDock) {
    try {
      const targetLeft = onDock.offsetLeft - (dock.clientWidth - onDock.clientWidth) / 2;
      dock.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    } catch {}
  }
}
// ←/→: the previous or next page in the dock's order (its apps included), wrapping; a note, task or agent page counts as its section.
function dockStep(d) {
  const links = [...document.querySelectorAll("#dock a[href]")], { pg } = route();
  if (!links.length) return;
  const section = { n: "notes", w: "notes", a: "agents", t: "agents", s: "services", images: "services" }[pg];
  let i = links.findIndex((a) => a.classList.contains("on"));
  if (i < 0) i = Math.max(0, links.findIndex((a) => a.getAttribute("href") === `#/${section}`));
  location.hash = links[(i + d + links.length) % links.length].getAttribute("href");
}

// ---------------------------------------------------------------- Calendar: the week strip at the top, or a floating pill
// Items come from Calendar.md (D.calendar) and schedule.json (S.schedule); reviews and daily notes add their own dots.
// Pinned sits under the top bar; floating shrinks to a pill that opens on hover. The choice is per browser.
const CAL_KEY = "overlook.calendar", DOCK_KEY = "overlook.dock", UI_KEY = "overlook.ui";
let uiMode = (() => { try { return localStorage.getItem(UI_KEY) === "classic" ? "classic" : "minimal"; } catch { return "minimal"; } })();
function setUi(v) {
  uiMode = v === "minimal" ? "minimal" : "classic";
  document.documentElement.dataset.ui = uiMode;
  try { localStorage.setItem(UI_KEY, uiMode); } catch {}
  render();
}
let dockMode = (() => { try { return localStorage.getItem(DOCK_KEY) === "float" ? "float" : "pinned"; } catch { return "pinned"; } })();
let calMode = (() => { try { return localStorage.getItem(CAL_KEY) === "float" ? "float" : "pinned"; } catch { return "pinned"; } })();
let calStart = "", calMonth = false, calDay = "", calFormDay = "", calKind = "event";
const REPEAT = { once: "once", daily: "every day", weekdays: "weekdays", weekly: "every week" };
const dayName = (d, o) => new Date(d + "T12:00").toLocaleDateString(LOCALE, o);
// Where a scheduled task lands: its next run, then every day / weekday / week after it.
function occursOn(e, d) {
  const first = e.at.slice(0, 10);
  if (!e.at || d < first) return false;
  if (e.repeat === "once") return d === first;
  const wd = new Date(d + "T12:00").getDay();
  return e.repeat === "daily" || (e.repeat === "weekdays" ? wd > 0 && wd < 6 : wd === new Date(first + "T12:00").getDay());
}
function dayItems(d) {
  return {
    events: (D.calendar || []).filter((e) => e.date === d),
    scheduled: (S.schedule || []).filter((e) => occursOn(e, d)).map((e) => ({ ...e, time: e.at.slice(11) })),
    reviews: (D.cards || []).filter((c) => c.next === d || (d === D.today && (!c.next || c.next < d))),
  };
}
function calDays() {
  const start = calStart || D.today;
  if (!calMonth) return [...Array(7)].map((_, i) => addDays(start, i));
  const first = start.slice(0, 8) + "01", lead = new Date(first + "T12:00").getDay(); // the grid starts on the Sunday before the 1st
  return [...Array(42)].map((_, i) => addDays(first, i - lead));
}
function calCell(d) {
  const it = dayItems(d), month = (calStart || D.today).slice(0, 7);
  const dots = [...it.events.map(() => "e"), ...it.scheduled.map(() => "s"), ...it.reviews.map(() => "r")].slice(0, 4)
    .map((c) => `<i class="${c}"></i>`).join("") + (D.dailies.includes(d) ? '<i class="d"></i>' : "");
  const title = [it.events.length && `${it.events.length} event(s)`, it.scheduled.length && `${it.scheduled.length} agent task(s)`, it.reviews.length && `${it.reviews.length} review(s)`].filter(Boolean).join(" · ");
  return `<button type="button" class="day ${d === D.today ? "today" : ""} ${d === calDay ? "sel" : ""} ${calMonth && d.slice(0, 7) !== month ? "out" : ""}" data-act="cal-day" data-d="${d}" title="${title || "Nothing yet"}">
    ${calMonth ? "" : `<span>${dayName(d, { weekday: "short" })}</span>`}<b>${Number(d.slice(8))}</b><span class="m">${dots}</span></button>`;
}
function calRender() {
  const el = $("#cal");
  if (!el || !D) return;
  if (!el.dataset.ready) {
    el.innerHTML = `<button type="button" class="cal-pill" data-act="cal-open" aria-label="Open the calendar"></button>
      <div class="cal-body">
        <div class="cal-strip">
          <button type="button" class="cal-nav" data-act="cal-prev" aria-label="Previous">${icon("l", 16)}</button>
          <div class="cal-grid" id="cal-grid"></div>
          <button type="button" class="cal-nav" data-act="cal-next" aria-label="Next">${icon("r", 16)}</button>
          <span class="wk-sep"></span><div class="cal-side" id="cal-side"></div>
        </div>
        <div class="cal-dayview" id="cal-dayview" hidden><div class="cd-head" id="cd-head"></div><div class="cd-cols"><div class="cd-list" id="cd-list"></div><form class="cd-add" id="cd-add"></form></div></div>
      </div>`;
    el.dataset.ready = "1";
  }
  el.classList.toggle("float", calMode === "float");
  el.classList.toggle("month", calMonth);
  el.classList.toggle("open", !!calDay);
  document.body.classList.toggle("cal-float", calMode === "float");
  const n = needsYou(), run = runningNow(), live = S.agents.length, todayCount = Object.values(dayItems(D.today)).flat().length;
  el.querySelector(".cal-pill").innerHTML = `${icon("target", 16)}<b>${dayName(D.today, { weekday: "short" })} ${Number(D.today.slice(8))}</b><span>${todayCount ? `${todayCount} today` : "calendar"}</span>`;
  $("#cal-grid").innerHTML = (calMonth ? ["S", "M", "T", "W", "T", "F", "S"].map((w) => `<span class="wd">${w}</span>`).join("") : "") + calDays().map(calCell).join("");
  $("#cal-side").innerHTML = `<button type="button" class="cal-title" data-act="cal-month" title="${calMonth ? "Week view" : "Month view"}">${dayName(calStart || D.today, { month: "long", year: "numeric" })}</button>
    <span class="cal-tools"><button type="button" data-act="cal-today" title="Back to today">Today</button>
      <button type="button" data-act="cal-pin" title="${calMode === "float" ? "Pin it under the top bar" : "Float it in a corner"}">${calMode === "float" ? "Pin" : "Float"}</button></span>
    <a class="chipbox" href="#/review">${icon("target", 18)}<span><b>Needs you</b>${n} ${n === 1 ? "item" : "items"}</span></a>
    <a class="chipbox" href="#/agents">${icon("bolt", 18)}<span><b>Agents</b>${live} active${run ? ` · ${run} ${run === 1 ? "task" : "tasks"}` : ""}</span></a>`;
  calDayRender();
}
function calDayRender() {
  const view = $("#cal-dayview");
  view.hidden = !calDay;
  if (!calDay) return;
  const d = calDay, it = dayItems(d), daily = `${D.daily}/${d}.md`;
  $("#cd-head").innerHTML = `<h3>${dayName(d, { weekday: "long", month: "long", day: "numeric" })}</h3>
    ${D.dailies.includes(d) ? `<a class="btn glass" href="${noteHref(daily)}">Daily note</a>` : ""}
    <button type="button" class="btn glass" data-act="cal-close" aria-label="Close">Close <kbd>Esc</kbd></button>`;
  const row = (ic, time, text, extra = "", del = "") => `<div class="row"><span class="ic">${icon(ic, 15)}</span><span class="x">${time || "all day"}</span><span class="txt">${text}</span>${extra}${del}</div>`;
  const x = (attrs) => `<button type="button" class="del" ${attrs} aria-label="Delete">×</button>`;
  $("#cd-list").innerHTML = [
    ...it.events.map((e) => row("target", e.time, esc(e.title), "", x(`data-act="cal-del" data-date="${e.date}" data-time="${e.time}" data-title="${esc(e.title)}"`))),
    ...it.scheduled.map((e) => row("bolt", e.time, `${esc(e.prompt)}<small>${esc([runnerName(e.agent), e.model, e.effort, REPEAT[e.repeat]].filter(Boolean).join(" · "))}${e.error ? ` · <em>${esc(e.error)}</em>` : ""}</small>`, "", x(`data-act="sched-del" data-id="${esc(e.id)}"`))),
    ...it.reviews.map((c) => row("review", "", `<a href="#/review">Review: ${esc(c.q)}</a>`)),
  ].join("") || `<p class="empty">Nothing on this day yet.</p>`;
  if (calFormDay !== d) { calFormDay = d; calFormRender(); }
}
// The add form is drawn when the day changes, never by the refresh, so what you type survives.
function calFormRender() {
  const f = $("#cd-add");
  f.innerHTML = `<div class="seg" role="radiogroup" aria-label="What to add">${[["event", "Event"], ["task", "Agent task"]].map(([k, l]) =>
      `<button type="button" role="radio" aria-checked="${calKind === k}" class="${calKind === k ? "on" : ""}" data-act="cal-kind" data-k="${k}">${l}</button>`).join("")}</div>
    ${calKind === "event"
      ? `<div class="cd-line"><input type="time" id="cd-time" aria-label="Time (optional)"><input id="cd-title" placeholder="What's happening?" aria-label="Event" maxlength="200" autocomplete="off"></div>`
      : `<div class="cd-line"><input type="time" id="cd-time" required aria-label="Time"><select class="pick" id="cd-repeat" aria-label="Repeat">${Object.entries(REPEAT).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div class="cd-line">${agentPicker("sch")}</div>
        <textarea id="cd-prompt" rows="2" placeholder="What should the agent do?" aria-label="Task for the agent"></textarea>`}
    <div class="cd-line"><small>${calKind === "event" ? "Saved to Calendar.md in your vault." : "Runs at that time while Overlook is on; a missed run happens when it starts."}</small>
      <button class="btn peach" type="submit">${calKind === "event" ? "Add" : "Schedule"}</button></div>`;
  if (calKind === "task") { $("#sch-agent").onchange = () => runOptions(false, "sch"); $("#sch-model").onchange = () => runOptions(true, "sch"); runOptions(false, "sch"); }
  f.onsubmit = async (e) => {
    e.preventDefault();
    const time = $("#cd-time").value;
    try {
      if (calKind === "event") {
        const title = $("#cd-title").value.trim();
        if (!title) return $("#cd-title").focus();
        await api("/api/calendar", { date: calDay, time, title });
        $("#cd-title").value = ""; $("#cd-time").value = ""; toast("Added to the calendar");
      } else {
        const prompt = $("#cd-prompt").value.trim();
        if (!time || !prompt) return (time ? $("#cd-prompt") : $("#cd-time")).focus();
        await api("/api/schedule", { at: `${calDay}T${time}`, repeat: $("#cd-repeat").value, prompt, ...runChoice("sch") });
        $("#cd-prompt").value = ""; toast("Scheduled");
      }
      [D, S] = await Promise.all([api("/api"), api("/api/system")]); calRender();
    } catch (err) { toast(err.message); }
  };
}
const calShift = (dir) => {
  const start = calStart || D.today;
  if (!calMonth) calStart = addDays(start, dir * 7);
  else { const d = new Date(start.slice(0, 8) + "01T12:00"); d.setMonth(d.getMonth() + dir); calStart = d.toLocaleDateString("sv"); }
  calRender();
};
const CAL_ACTIONS = {
  "cal-day": (el) => { calDay = calDay === el.dataset.d ? "" : el.dataset.d; calRender(); },
  "cal-close": () => { calDay = ""; calRender(); },
  "cal-prev": () => calShift(-1), "cal-next": () => calShift(1),
  "cal-today": () => { calStart = ""; calDay = D.today; calRender(); },
  "cal-month": () => { calMonth = !calMonth; calStart = calMonth ? (calStart || D.today).slice(0, 8) + "01" : ""; calRender(); },
  "dock-mode": () => { dockMode = dockMode === "float" ? "pinned" : "float"; try { localStorage.setItem(DOCK_KEY, dockMode); } catch {} document.activeElement?.blur(); topBar(); },
  "cal-pin": () => { calMode = calMode === "float" ? "pinned" : "float"; try { localStorage.setItem(CAL_KEY, calMode); } catch {} calRender(); },
  "cal-open": () => { calDay = calDay || D.today; calRender(); },
  "cal-kind": (el) => { calKind = el.dataset.k; calFormRender(); },
  "cal-del": async (el) => { await api("/api/calendar/delete", { date: el.dataset.date, time: el.dataset.time, title: el.dataset.title }).catch((e) => toast(e.message)); D = await api("/api"); calRender(); },
  "sched-del": async (el) => { await api("/api/schedule/delete", { id: el.dataset.id }).catch((e) => toast(e.message)); S = await api("/api/system"); calRender(); },
  "set-cal": (el) => { calMode = el.dataset.v; try { localStorage.setItem(CAL_KEY, calMode); } catch {} calRender(); el.parentElement.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === el); b.setAttribute("aria-checked", b === el); }); },
  "set-dock": (el) => { dockMode = el.dataset.v; try { localStorage.setItem(DOCK_KEY, dockMode); } catch {} topBar(); el.parentElement.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === el); b.setAttribute("aria-checked", b === el); }); },
};

// ---------------------------------------------------------------- Home: suggestion carousel
function suggestions() {
  const s = [];
  const ln = (txt) => txt.match(/\[\[([^\]|]+)/)?.[1];
  // No focus picked for today: the first card runs the morning routine, the agent that picks it.
  if (!D.focus?.length && D.routines) {
    const run = (S?.tasks || []).find((t) => t.routine === "morning" && !t.end);
    s.push(run ? { cat: "Today", ic: "target", title: "The morning routine is picking today's focus", sub: "An agent is reading the vault and writing up to 3 things for today in the daily note.", meta: [["Started", ago(Date.parse(run.start))]], href: `#/t/${run.id}`, action: "See progress" }
      : { cat: "Today", ic: "target", title: "Pick today's focus", sub: "Runs the morning routine: an agent reads the vault and writes up to 3 things for today in the daily note.", meta: [["Takes", "about a minute"]], href: "#/", act: "start-day", action: "Start the day" });
  }
  for (const f of D.focus || []) { const a = ln(f); s.push({ cat: "Today's focus", ic: "target", title: unlink(f), raw: f, sub: "Picked for today in the daily note.", meta: [["Source", "Daily note"]], href: a ? `#/w/${encodeURIComponent(a)}` : obs(dailyPath()), action: "Open" }); }
  for (const c of due()) s.push({ cat: "Review", ic: "review", title: c.q, sub: "Do you remember the answer? Try before opening it.", meta: [["Due", !c.next || c.next === D.today ? "today" : `${daysBetween(c.next, D.today)} d ago`], ["Interval", `${c.interval || 1} d`]], href: "#/review", action: "Review" });
  for (const c of D.captured || []) s.push({ cat: "Captured today", ic: "spark", title: unlink(c), raw: c, sub: "Raw capture. It becomes a note once it fits in one sentence, or it dies.", meta: [["Status", "In the daily note"]], href: obs(dailyPath()), action: "Open in Obsidian" });
  for (const n of inbox()) s.push({ cat: "Inbox", ic: "inbox", title: n.title, sub: "Process: becomes a permanent note or leaves the vault.", meta: [["Arrived", ago(n.mtime)]], href: noteHref(n.path), action: "Open" });
  for (const v of D.missing.slice(0, 3)) s.push({ cat: "Gap", ic: "gap", title: v.target, sub: `Linked ${v.n}× and doesn't exist yet. Write it when you need it, not out of duty.`, meta: [["Linked", `${v.n}×`]], href: `#/w/${encodeURIComponent(v.target)}`, action: "See who links it" });
  for (const n of D.notes.filter((n) => n.type === "project").sort((a, b) => b.mtime - a.mtime).slice(0, 5)) s.push({ cat: "Project", ic: "bolt", title: n.title, sub: plain(n.summary), meta: [["Area", n.area || "-"], ["Touched", ago(n.mtime)]], href: noteHref(n.path), action: "Open" });
  const outside = D.notes.filter((n) => n.type === "concept" && !inCycle(n)).sort((a, b) => a.mtime - b.mtime).slice(0, 2);
  for (const n of outside) s.push({ cat: "Rediscover", ic: "leaf", title: n.title, sub: plain(n.summary), meta: [["Out of the cycle", "never reviewed"], ["Area", n.area || "-"]], href: noteHref(n.path), action: "Reread" });
  return s.length ? s : [CAUGHT_UP];
}
const CAUGHT_UP = { cat: "All caught up", ic: "leaf", piece: "bonsai", title: "Nothing needs attention right now", sub: "Capture an idea or open an old note.", meta: [], href: "#/notes", action: "See notes" };
// One colour per vault folder (the graph's area palette), so a note's home reads at a glance on every page.
const folderColor = (f) => `var(--p${(hash(f || ".") % 6) + 1})`;
// A note as a card: its folder, title, summary and age; on hover, hand it to an agent or put it on the canvas.
const noteCard = (n, i = 0) => `<div class="nc-wrap" style="--c: ${folderColor(n.folder)}">
    <a class="nc glass" href="${noteHref(n.path)}" style="animation-delay:${Math.min(i, 12) * 25}ms">
      <span class="nc-folder">${esc(folderLabel(n.folder))}</span>
      <h4>${esc(n.title)}</h4>
      <p>${esc(n.type === "daily" ? "Daily note" : plain(n.summary) || "No one-line summary.")}</p>
      <span class="f">${n.type ? `<span class="pill">${esc(n.type)}</span>` : ""}${confKind(n) === "warn" ? `<span class="pill conf warn">${esc(n.confidence)}</span>` : ""}${inCycle(n) ? '<span class="pill peach">in review</span>' : ""}<span>${esc(n.area)}</span><span style="margin-left:auto">${ago(n.mtime)}</span></span>
    </a>
    <div class="nc-acts">
      <button type="button" data-act="note-ask" data-p="${esc(n.path)}" title="Open an agent on the canvas that has read this note">${icon("spark", 13)} Ask an agent</button>
      <button type="button" data-act="note-canvas" data-p="${esc(n.path)}" title="Put this note on the canvas">${icon("grid", 13)} On canvas</button>
    </div>
  </div>`;
// From any page: go to the canvas and run `make` there once it's built (agents() calls it), so the card it adds lands
// in view on the real canvas.
let afterCanvas = null;
function toCanvas(make) {
  if (route().pg === "agents") return make();
  afterCanvas = make;
  location.hash = "#/agents";
}
// A new agent on the canvas, in the vault, that starts on `prompt` (a note to read, a task to do).
function agentOnCanvas(prompt) {
  const agent = defaultAgent();
  if (!agent) return toast("No agent with a terminal is set up yet: see Settings › Agents");
  toCanvas(() => {
    const p = { kind: "terminal", id: `term_${Date.now()}`, cwd: "", run: newTuiRun(agent, prompt) };
    if (addPane(p)) { saveCanvas(); focusPane(paneKey(p)); }
  });
}
// "Ask an agent": it starts by reading the note and waits for questions.
function askAgent(path) {
  const n = D.notes.find((x) => x.path === path);
  agentOnCanvas(`Read the note "${path}" in this vault${n ? ` ("${n.title}")` : ""}. In three short lines, tell me what it is about and what is still open in it, in the language the note is written in. Then wait for my questions.`);
}
const noteToCanvas = (path) => toCanvas(() => { if (addPane({ kind: "note", id: path })) { saveCanvas(); focusPane(`note:${path}`); } });

let idx = 0, SG = [];
// Themes (the colours live in app.css); the choice is per browser and applied before the first paint (index.html).
const THEMES = [["overlook", "Overlook"], ["tokyo-night", "Tokyo Night"], ["dracula", "Dracula"], ["catppuccin-mocha", "Catppuccin Mocha"],
  ["rose-pine", "Rosé Pine"], ["gruvbox", "Gruvbox"], ["nord", "Nord"]];
// Card art: the user's images, or animated ascii scenes (ascii.rest) — "auto" uses images when there are any.
const ART_KEY = "overlook.cardArt";
let cardArt = (() => { try { return localStorage.getItem(ART_KEY) || "auto"; } catch { return "auto"; } })();
const SCENES = ["night-coast", "kyoto-dusk", "aurora-fjord", "lantern-lake", "misty-forest", "ocean-sunset", "desert-night", "tokyo-rain",
  "alpine-dawn", "deep-reef", "earthrise", "storm-plains", "marine-drive", "taj-dawn", "varanasi-ghats"];
const asciiCards = () => cardArt === "ascii" || (cardArt === "auto" && !D.pins?.length);
const scene = (s, i) => s.piece || SCENES[(hash(D.today) + i) % SCENES.length];
// A card's call to action: a link, or a button when the card runs something (data-act).
const cta = (s, cls, ic) => s.act ? `<button type="button" class="${cls}" data-act="${esc(s.act)}">${esc(s.action)} ${icon("r", ic)}</button>`
  : `<a class="${cls}" href="${esc(s.href)}">${esc(s.action)} ${icon("r", ic)}</a>`;

function home() {
  SG = suggestions();
  idx = Math.min(idx, SG.length - 1);
  if (uiMode === "minimal") return todoHome();
  const card = (s, i) => {
    const p = pinFor(i), ascii = asciiCards();
    return `<article class="card ${ascii ? "ascii" : ""}" data-i="${i}" ${ascii ? "" : `style="background-image:url('${art(i)}?amb')"`}>
      <div class="card-main">
        <div class="card-top"><span class="tag glass">${icon(s.ic, 16)} ${esc(s.cat)}</span><span class="card-idx">${i + 1} / ${SG.length}</span></div>
        <div class="body">
          <p class="sub">${esc(s.sub)}</p>
          ${s.meta.length ? `<div class="meta">${s.meta.map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join("")}</div>` : ""}
          <h2 class="${s.title.length > 44 ? "long" : ""}">${emLinks(s.raw || s.title)}</h2>
        </div>
        <div class="card-foot">${cta(s, "btn peach go", 16)}</div>
      </div>
      ${ascii ? `<div class="card-pin card-ascii"><ascii-art piece="${scene(s, i)}"></ascii-art></div>` : `<div class="card-pin"><img src="${art(i)}" alt="">${p?.link ? `<a class="pin-link" href="${esc(p.link)}" target="_blank">pinterest ↗</a>` : ""}
        ${D.pins?.length ? `<button type="button" class="pin-pick" data-act="pick-open" data-i="${i}" aria-label="Choose this card's image">${icon("image", 15)} ${D.pinCards?.[cardKey(s)] ? "Chosen" : "Choose image"}</button>` : ""}</div>`}
    </article>`;
  };
  main.innerHTML = `<section class="car" id="car">${SG.map(card).join("")}
      <button class="navb glass l" data-act="prev" aria-label="Previous">${icon("l")}</button>
      <button class="navb glass r" data-act="next" aria-label="Next">${icon("r")}</button>
      <div class="dots">${SG.map((_, i) => `<i data-act="go" data-i="${i}"></i>`).join("")}</div>
    </section><section class="tiles" id="tiles"></section>`;
  place(); tiles();
}
function place() {
  if (uiMode === "minimal") {
    document.querySelectorAll(".min-row").forEach((r, i) => r.classList.toggle("on", i === idx));
    const st = $("#min-stage");
    if (st && SG[idx]) {
      const i = idx, s = SG[i], p = pinFor(i), ascii = cardArt === "ascii" || !D.pins?.length, showArt = cardArt === "ascii" || !!D.pins?.length;
      st.innerHTML = `${showArt ? `<div class="min-art ${ascii ? "card-ascii" : ""}">
          ${ascii ? `<ascii-art piece="${scene(s, i)}"></ascii-art>` : `<img src="${art(i)}" alt="">`}
          <div class="min-art-bar">
            ${!ascii && D.pins?.length ? `<button type="button" class="min-pick" data-act="pick-open" data-i="${i}">${icon("image", 13)} ${D.pinCards?.[cardKey(s)] ? "Chosen" : "Choose image"}</button>` : ""}
            <button type="button" class="min-pick" data-act="cycle-art" title="Switch card art (${cardArt})">${ascii ? "Use photo" : "Use ASCII"}</button>
            ${!ascii && p?.link ? `<a class="min-pinlink" href="${esc(p.link)}" target="_blank">pinterest ↗</a>` : ""}
          </div>
        </div>` : ""}
        <div class="min-focus">
          <div class="min-focus-top"><span class="tag">${icon(s.ic, 13)} ${esc(s.cat)}</span>
            <span class="min-pos">${i + 1} of ${SG.length}</span></div>
          <h2>${emLinks(s.raw || s.title)}</h2>
          <p>${esc(s.sub)}</p>
          ${s.meta.length ? `<dl class="min-meta-list">${s.meta.map(([k, v]) => `<div class="min-meta"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
          <div class="min-focus-foot">
            ${cta(s, "btn peach", 14)}
            <span class="min-nav"><button type="button" data-act="prev" aria-label="Previous">${icon("l", 14)}</button><button type="button" data-act="next" aria-label="Next">${icon("r", 14)}</button></span>
          </div>
        </div>`;
    }
    return;
  }
  document.querySelectorAll(".card").forEach((c) => {
    const n = SG.length, d = (Number(c.dataset.i) - idx + n) % n;
    const o = n > 2 && d > n / 2 ? d - n : d, a = Math.abs(o); // circular: neighbor on both sides
    c.style.transform = `translateX(${Math.sign(o) * Math.min(a, 1) * 92}%) scale(${o ? 0.84 : 1})`;
    c.style.opacity = a > 1 ? 0 : a ? 0.6 : 1;
    c.style.zIndex = 5 - a;
    c.classList.toggle("side", !!o);
    c.style.pointerEvents = a > 1 ? "none" : "";
  });
  document.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i === idx));
  if (SG[idx] && !asciiCards()) ambient(art(idx));
}
const move = (d) => { idx = (idx + d + SG.length) % SG.length; place(); };

// ---------------------------------------------------------------- Home (Minimal): the to-do list
// Tasks live in Tasks.md in the vault (todos.ts). The page shows today's focus (from the daily note) and today's tasks
// (late ones roll in), adds a task from one typed line ("pagar o servidor dia 15 todo mês"), and edits one in place when
// clicked. Upcoming, someday and done fold into one line. Beside it, "Today": the calendar, the agents, the vault.
let tdOpen = "", tdMore = false, tdTimer = 0, tdGone = null;
const tdAll = () => D.todos || [];
const tdDay = (d) => {
  const n = daysBetween(D.today, d);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 1 && n < 7 ? dayName(d, { weekday: "long" }) : dayName(d, { month: "short", day: "numeric" });
};
const tdSort = (a, b) => b.prio - a.prio || (a.due || "9").localeCompare(b.due || "9") || (a.time || "99").localeCompare(b.time || "99");
const REPEATS = [["", "Never"], ["every day", "Every day"], ["every weekday", "Weekdays"], ["every week", "Every week"], ["every month", "Every month"], ["every year", "Every year"]];
const tdRow = (t, upcoming = false) => {
  if (tdOpen === t.id) return tdEditor(t);
  const late = !t.done && t.due && t.due < D.today;
  return `<div class="td-task ${t.done ? "done" : ""} ${t.prio ? "prio" : ""}">
    <button type="button" class="td-check" data-act="td-done" data-id="${esc(t.id)}" aria-label="${t.done ? "Mark as not done" : "Done"}"></button>
    <button type="button" class="td-text" data-act="td-edit" data-id="${esc(t.id)}" title="Edit">${esc(t.text)}</button>
    <span class="td-meta">${late ? `<span class="late">since ${esc(tdDay(t.due).toLowerCase())}</span>` : ""}${t.time ? `<span>${esc(t.time)}</span>` : ""}${t.repeat ? `<span class="rep" title="${esc(t.repeat)}">↻</span>` : ""}${t.note ? `<span title="Has a note">${icon("notes", 12)}</span>` : ""}</span>
    ${t.done ? "" : `<span class="td-acts">
      ${upcoming ? `<button type="button" data-act="td-move" data-id="${esc(t.id)}" data-d="0" title="Do it today">Today</button>` : `<button type="button" data-act="td-move" data-id="${esc(t.id)}" data-d="1" title="Move it to tomorrow">Tomorrow</button>`}
      <button type="button" data-act="td-agent" data-id="${esc(t.id)}" title="Hand it to an agent on the canvas" aria-label="Hand it to an agent">${icon("spark", 13)}</button>
      <button type="button" data-act="td-del" data-id="${esc(t.id)}" title="Delete" aria-label="Delete">${icon("trash", 13)}</button></span>`}
  </div>`;
};
// A clicked task opens in place: its title, then date, repeat, time and importance as chips, a note, and the hand-offs.
const tdEditor = (t) => `<div class="td-edit" data-id="${esc(t.id)}">
    <div class="td-edit-top"><button type="button" class="td-check" data-act="td-done" data-id="${esc(t.id)}" aria-label="Done"></button>
      <input class="td-title" value="${esc(t.text)}" aria-label="Task" maxlength="300"></div>
    <div class="td-ctl">
      <span class="td-chip ${t.due ? "on" : ""}"><button type="button" data-act="td-pick">${icon("target", 13)} ${t.due ? esc(tdDay(t.due)) : "No date"}</button><input type="date" data-f="due" value="${esc(t.due)}" tabindex="-1" aria-label="Date">${t.due ? `<button type="button" class="td-x" data-act="td-set" data-f="due" data-v="" aria-label="No date">×</button>` : ""}</span>
      <label class="td-chip ${t.repeat ? "on" : ""}">↻ <select data-f="repeat" aria-label="Repeat">${[...REPEATS, ...(t.repeat && !REPEATS.some(([k]) => k === t.repeat) ? [[t.repeat, t.repeat]] : [])].map(([k, l]) => `<option value="${esc(k)}" ${k === t.repeat ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <span class="td-chip ${t.time ? "on" : ""}"><button type="button" data-act="td-pick">${icon("clock", 13)} ${t.time ? esc(t.time) : "No time"}</button><input type="time" data-f="time" value="${esc(t.time)}" tabindex="-1" aria-label="Time">${t.time ? `<button type="button" class="td-x" data-act="td-set" data-f="time" data-v="" aria-label="No time">×</button>` : ""}</span>
      <button type="button" class="td-chip ${t.prio ? "on" : ""}" data-act="td-set" data-f="prio" data-v="${t.prio ? "" : "1"}">! Important</button>
    </div>
    <textarea class="td-note" rows="1" placeholder="Add a note…" aria-label="Note">${esc(t.note)}</textarea>
    <div class="td-foot"><button type="button" data-act="td-agent" data-id="${esc(t.id)}">${icon("spark", 13)} Send to an agent</button><button type="button" class="del" data-act="td-del" data-id="${esc(t.id)}">Delete</button></div>
  </div>`;
function todoHome() {
  main.innerHTML = `<section class="td-home">
      <div class="td-main">
        <header class="td-hello"><h1>${esc(dayName(D.today, { weekday: "long", day: "numeric", month: "long" }))}</h1><p id="td-count"></p></header>
        <form class="td-add" id="td-add"><span class="td-plus">${icon("plus", 17)}</span>
          <input id="td-in" placeholder="Add a task… try &quot;amanhã 9h toda segunda&quot;" autocomplete="off" spellcheck="false" aria-label="Add a task"></form>
        <div class="td-chips" id="td-chips"></div>
        <div id="td-list"></div>
      </div>
      <aside class="td-side" id="td-side" aria-label="Today"></aside>
    </section>`;
  const inp = $("#td-in");
  // While typing, what the line will become: the date, time, repeat and importance read from it.
  inp.oninput = () => {
    clearTimeout(tdTimer);
    const text = inp.value.trim();
    if (!text) { $("#td-chips").innerHTML = ""; return; }
    tdTimer = setTimeout(async () => {
      const p = await api("/api/todos/parse", { text }).catch(() => null);
      if (!p || inp.value.trim() !== text) return;
      $("#td-chips").innerHTML = [p.due && `<span class="chip">${icon("target", 12)} ${esc(tdDay(p.due))}${p.time ? ` · ${esc(p.time)}` : ""}</span>`,
        !p.due && p.time && `<span class="chip">${esc(p.time)}</span>`, p.repeat && `<span class="chip b">↻ ${esc(p.repeat)}</span>`, p.prio && '<span class="chip">! important</span>'].filter(Boolean).join("");
    }, 140);
  };
  $("#td-add").onsubmit = async (e) => {
    e.preventDefault();
    const text = inp.value.trim();
    if (!text) return;
    inp.value = ""; $("#td-chips").innerHTML = "";
    try {
      const r = await api("/api/todos/add", { text });
      D.todos = r.todos; tdRender(true);
      if (r.todo.time && window.Notification?.permission === "default") Notification.requestPermission().catch(() => {});
      if (!r.todo.due || r.todo.due > D.today) toast(r.todo.due ? `Added for ${tdDay(r.todo.due).toLowerCase()}` : "Added to someday");
    } catch (err) { inp.value = text; toast(err.message); }
  };
  tdRender(true); tdSide();
  if (matchMedia("(pointer: fine)").matches) inp.focus();
}
// force: redraw even while a field in the list has the keyboard (after a save); the refreshes leave a typist alone.
function tdRender(force = false) {
  const box = $("#td-list");
  if (!box || (!force && box.contains(document.activeElement) && document.activeElement.matches("input, textarea, select"))) return;
  const open = tdAll().filter((t) => !t.done), now = open.filter((t) => t.due && t.due <= D.today).sort(tdSort);
  const later = open.filter((t) => t.due > D.today).sort(tdSort), someday = open.filter((t) => !t.due);
  const done = tdAll().filter((t) => t.done && t.doneOn === D.today), focus = D.focus || [];
  $("#td-count").textContent = [focus.length && `${focus.length} focus`, now.length ? `${now.length} for today` : open.length ? "nothing left for today" : "nothing to do yet"].filter(Boolean).join(" · ").replace(/^./, (c) => c.toUpperCase());
  // Today's focus, from the daily note: ticking one ticks it there. Without one, the morning routine can pick it.
  const morning = (S?.tasks || []).find((t) => t.routine === "morning" && !t.end);
  const top = focus.length ? `<h4 class="td-group td-focus-h">Focus <span>from today's note</span></h4>
      <div class="td-list">${focus.map((f) => `<div class="td-task focus"><button type="button" class="td-check" data-act="focus-done" data-t="${esc(f)}" aria-label="Done"></button><span class="td-text">${emLinks(f)}</span></div>`).join("")}</div>
      ${now.length ? '<h4 class="td-group">Tasks</h4>' : ""}`
    : morning ? `<a class="td-start" href="#/t/${esc(morning.id)}">${icon("target", 14)} The morning routine is picking today's focus…</a>`
    : D.routines ? `<button type="button" class="td-start" data-act="start-day">${icon("target", 14)} Start the day <small>an agent picks today's focus in the daily note</small></button>` : "";
  const days = [...new Set(later.map((t) => t.due))];
  const fold = [later.length && `${later.length} upcoming`, someday.length && `${someday.length} someday`, done.length && `${done.length} done today`].filter(Boolean).join(" · ");
  box.innerHTML = `${top}<div class="td-list">${now.map((t) => tdRow(t)).join("")}</div>
    ${fold ? `<button type="button" class="td-fold ${tdMore ? "on" : ""}" data-act="td-more">${fold} <span>${tdMore ? "▾" : "▸"}</span></button>` : ""}
    ${tdMore ? `${days.map((d) => `<h4 class="td-group">${esc(tdDay(d))}</h4><div class="td-list">${later.filter((t) => t.due === d).map((t) => tdRow(t, true)).join("")}</div>`).join("")}
      ${someday.length ? `<h4 class="td-group">Someday</h4><div class="td-list">${someday.map((t) => tdRow(t, true)).join("")}</div>` : ""}
      ${done.length ? `<h4 class="td-group">Done today</h4><div class="td-list">${done.map((t) => tdRow(t)).join("")}</div>` : ""}` : ""}`;
  const ed = box.querySelector(".td-edit");
  if (!ed) return;
  const id = ed.dataset.id, title = ed.querySelector(".td-title"), note = ed.querySelector(".td-note");
  const grow = () => { note.style.height = "auto"; note.style.height = `${note.scrollHeight}px`; };
  grow(); note.oninput = grow;
  // Enter keeps the title; Esc puts it back (then closes, below)
  title.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); title.blur(); } if (e.key === "Escape") title.value = tdAll().find((t) => t.id === id)?.text || title.value; };
  title.onchange = () => title.value.trim() && tdSave(id, { text: title.value.trim() });
  note.onchange = () => tdSave(id, { note: note.value });
  ed.onkeydown = (e) => { if (e.key === "Escape") { e.preventDefault(); tdClose(); } };
  ed.querySelectorAll("[data-f]").forEach((f) => { if (f.matches("input, select")) f.onchange = () => tdSave(id, { [f.dataset.f]: f.value }); });
}
// Closing saves what's still typed in the title or the note (their change event wouldn't fire once they're gone).
function tdClose() {
  const ed = $(".td-edit"), t = tdAll().find((x) => x.id === ed?.dataset.id);
  tdOpen = "";
  if (!ed || !t) return tdRender(true);
  ed.querySelectorAll("input, textarea, select").forEach((f) => { f.onchange = null; });
  const text = ed.querySelector(".td-title").value.trim(), note = ed.querySelector(".td-note").value;
  const patch = { ...(text && text !== t.text ? { text } : {}), ...(note !== t.note ? { note } : {}) };
  Object.keys(patch).length ? tdSave(t.id, patch) : tdRender(true);
}
// A click anywhere else closes it (capture: before that click's own action, which reads its element's data either way).
document.addEventListener("click", (e) => { if (tdOpen && !e.target.closest(".td-edit")) tdClose(); }, true);
async function tdSave(id, patch) {
  try {
    const r = await api("/api/todos/edit", { id, ...patch });
    D.todos = r.todos;
    if (patch.time && window.Notification?.permission === "default") Notification.requestPermission().catch(() => {});
  } catch (e) { toast(e.message); D = await api("/api").catch(() => D); }
  tdRender(true);
}
// "Today", beside the list: the calendar's items for today, the agents (who waits for you first), one review card, and the
// vault's living parts (the inbox, today's captures) above the notes you touched last. An empty block isn't drawn.
function tdSide() {
  const el = $("#td-side");
  if (!el) return;
  const it = dayItems(D.today);
  const cal = [...it.events.map((e) => ({ t: e.time, x: esc(e.title) })), ...it.scheduled.map((e) => ({ t: e.time, x: `<i>${icon("bolt", 11)}</i>${esc(e.prompt)}` }))]
    .sort((a, b) => (a.t || "").localeCompare(b.t || ""));
  const fleet = fleetItems().filter((x) => x.group !== "done" && x.kind !== "terminal"), wait = fleet.filter((x) => x.group === "waiting");
  const shown = [...wait, ...fleet.filter((x) => x.group !== "waiting").slice(0, Math.max(1, 3 - wait.length))];
  const name = (x) => { const a = x.kind === "agent" && S.agents?.find((y) => y.key === x.id); return a ? a.cwd.split("/").filter(Boolean).pop() || "~" : x.title; };
  const daily = D.notes.find((n) => n.path === `${D.daily}/${D.today}.md`);
  const card = due()[0];
  const vault = [[inbox().length, "in the inbox", inbox()[0] && noteHref(inbox()[0].path), "Process"],
    [(D.captured || []).length, "captured today", daily && noteHref(daily.path), "Open"]].filter(([n, , href]) => n && href);
  const recent = D.notes.filter((n) => n.type !== "daily" && n.folder !== D.daily).sort((a, b) => b.mtime - a.mtime).slice(0, 3);
  el.innerHTML = [
    cal.length && `<section class="td-blk"><h4>Calendar</h4>${cal.map((c) => `<div class="td-ev"><b>${esc(c.t || "all day")}</b><span>${c.x}</span></div>`).join("")}</section>`,
    fleet.length && `<section class="td-blk"><h4>Agents <a href="#/agents">${fleet.length} working</a></h4>${shown.map((x) => `<button type="button" class="td-ag ${x.group === "waiting" ? "w" : ""}" data-act="home-agent" data-kind="${x.kind}" data-id="${esc(x.id)}" title="Open it on the canvas">
        <span class="d"></span><span class="nm">${esc(name(x))}${x.group === "waiting" ? "<small>waiting for you</small>" : ""}</span>${x.group === "waiting" ? `<b>Answer ${icon("r", 11)}</b>` : ""}</button>`).join("")}</section>`,
    card && `<section class="td-blk td-rv"><h4>Do you remember? <a href="#/review">${due().length} to review</a></h4>${cardFace(card)}</section>`,
    (vault.length || recent.length) && `<section class="td-blk"><h4>Vault <a href="#/notes">${D.notes.length} notes</a></h4>
      ${vault.map(([n, l, href, go]) => `<a class="td-v" href="${esc(href)}"><b>${n}</b>${esc(l)}<span>${go} ${icon("r", 11)}</span></a>`).join("")}
      ${vault.length && recent.length ? '<div class="td-sep"></div>' : ""}
      ${recent.map((n) => `<a class="td-nt" href="${noteHref(n.path)}" style="--c: ${folderColor(n.folder)}"><i></i>${esc(n.title)}</a>`).join("")}</section>`,
  ].filter(Boolean).join("");
}
// A task with a time pings you then: a toast here, and a notification when the browser allows (asked the first time
// you give a task a time). Only within ten minutes of it, so opening the page late doesn't ring the whole morning.
const tdPinged = new Set();
setInterval(() => {
  if (!D?.todos) return;
  const now = new Date(), today = now.toLocaleDateString("sv"), mins = now.getHours() * 60 + now.getMinutes();
  for (const t of D.todos) {
    if (t.done || t.due !== today || !t.time || tdPinged.has(t.id + t.due)) continue;
    const at = Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3));
    if (at > mins || mins - at > 10) continue;
    tdPinged.add(t.id + t.due);
    toast(`${t.time} · ${t.text}`);
    if (window.Notification?.permission === "granted") try { new Notification(t.text, { body: `${t.time} · Overlook`, tag: `todo-${t.id}` }); } catch {}
  }
}, 30000);
function tiles() {
  const el = $("#tiles");
  if (!el) return;
  const next = (D.cards || []).filter((c) => c.next > D.today).sort((a, b) => a.next.localeCompare(b.next))[0];
  const on = S.services.filter((s) => s.ok).length;
  const names = { claude: "Claude", agy: "AGY", codex: "Codex", gemini: "Gemini" };
  el.innerHTML = `
    <a class="tile glass" href="#/agents"><span class="k">${icon("agents", 16)} Active agents</span><span class="v">${S.agents.length}</span>
      <span class="s">${esc(S.agents.map((a) => `${names[a.name] || a.name} in ${a.cwd.split("/").pop() || "~"}`).join(" · ") || "none running")}</span></a>
    <a class="tile glass" href="#/services"><span class="k">${icon("services", 16)} Services</span><span class="v">${on}/${S.services.length}</span>
      <span class="s">${esc(S.services.map((s) => `${s.ok ? "●" : "○"} ${s.name}`).join("  ")) || "none configured"}</span></a>
    <a class="tile glass" href="#/review"><span class="k">${icon("review", 16)} Review</span><span class="v">${due().length}</span>
      <span class="s">${next ? `next: ${esc(next.q)} ${rel.format(daysBetween(D.today, next.next), "day")}` : "no cards yet"}</span></a>
    <a class="tile glass" href="#/notes"><span class="k">${icon("notes", 16)} Notes</span><span class="v">${D.notes.length}</span>
      <span class="s">${D.missing.length} ${D.missing.length === 1 ? "gap" : "gaps"} · ${D.notes.filter((n) => Date.now() - n.mtime < 7 * 864e5).length} touched this week</span></a>`;
}

// ---------------------------------------------------------------- Notes
let filter = "", query = "";
// Notes has two jobs before browsing: ask the vault (an agent answers from the notes, and looks it up when they don't have
// it) and save what you learned (a link or a few lines become a note, written by an agent). Below, what's alive in the
// vault: projects, notes linked but never written, one to rediscover, the collections. A collection opens the grid.
// filter: "" = that overview, "*" = every note, "@project" = the projects, "@check" = the deduced ones, else one folder.
const FILTERS = { "@project": ["Projects", (n) => n.type === "project"], "@check": ["To check", (n) => confKind(n) === "warn"] };
function notes() {
  const count = {};
  for (const n of D.notes) count[n.folder] = (count[n.folder] || 0) + 1;
  const chips = [["", "Overview", ""], ["*", "All", D.notes.length], ...(FILTERS[filter] ? [[filter, FILTERS[filter][0], D.notes.filter(FILTERS[filter][1]).length]] : []),
    ...Object.keys(count).sort().map((k) => [k, folderLabel(k), count[k]])];
  main.innerHTML = `<div class="nt-head"><h1>Notes</h1><p>${D.notes.length} notes in the vault</p></div>
    <div class="nt-ask">
      <textarea id="search" rows="1" placeholder="Ask the vault, or paste something you learned" autocomplete="off" spellcheck="false" aria-label="Ask the vault or search notes">${esc(query)}</textarea>
      <div class="nt-ask-acts" hidden>
        <button type="button" class="btn peach" data-act="vault-ask" title="An agent answers from your notes (and looks it up when they don't have it)">Ask the vault</button>
        <button type="button" class="btn glass" data-act="vault-save" title="An agent writes it into the vault as a note">Save as a note</button>
        <small>Enter asks · Shift+Enter for a new line</small>
      </div>
      <div class="nt-found" id="nt-found"></div>
    </div>
    ${filter ? `<div class="filters">${chips.map(([k, v, c]) => `<button class="fchip ${filter === k ? "on" : ""}" data-act="filter" data-k="${esc(k)}" ${k && !"*@".includes(k[0]) ? `style="--c: ${folderColor(k)}"` : ""}>${esc(v)}${c === "" ? "" : `<small>${c}</small>`}</button>`).join("")}</div>` : ""}
    <div id="nt-overview"></div><div class="grid" id="note-grid"></div><div id="text-hits"></div>`;
  const box = $("#search");
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ACTIONS["vault-ask"](); } };
  grid();
  if (matchMedia("(pointer: fine)").matches) box.focus(); // the page is for asking: type right away
  ambient(art("notes"));
}
function notesOverview() {
  const projects = D.notes.filter((n) => n.type === "project").sort((a, b) => b.mtime - a.mtime);
  const gaps = (D.missing || []).slice(0, 4);
  // one old concept out of the review cycle, a different one each day
  const pool = D.notes.filter((n) => n.type === "concept" && !inCycle(n)).sort((a, b) => a.mtime - b.mtime).slice(0, 8);
  const old = pool.length ? pool[hash(D.today) % pool.length] : null;
  const by = {};
  for (const n of D.notes) by[n.folder] = (by[n.folder] || 0) + 1;
  // written by deduction and never confirmed, the ones other notes lean on most first
  const inLinks = {};
  for (const n of D.notes) for (const l of new Set(n.links)) inLinks[l] = (inLinks[l] || 0) + 1;
  const check = D.notes.filter(FILTERS["@check"][1]).sort((a, b) => (inLinks[nameOf(b.path)] || 0) - (inLinks[nameOf(a.path)] || 0));
  const side = (check.length ? `<section><h4>To check <a href="#/notes" data-act="filter" data-k="@check" title="Written by deduction, never confirmed">All ${check.length} ${icon("r", 11)}</a></h4>
      ${check.slice(0, 4).map((n) => `<div class="nt-gap"><a href="${noteHref(n.path)}" title="${esc(plain(n.summary))}"><b>${esc(n.title)}</b><span>${inLinks[nameOf(n.path)] ? `linked ${inLinks[nameOf(n.path)]}×` : esc(n.confidence)}</span></a>
        <button type="button" data-act="vault-check" data-p="${esc(n.path)}" title="An agent compares it with its source and fixes it">Check it</button></div>`).join("")}</section>` : "")
    + (gaps.length ? `<section><h4>Missing notes <span>linked, never written</span></h4>
      ${gaps.map((g) => `<div class="nt-gap"><a href="#/w/${encodeURIComponent(g.target)}" title="See who links it"><b>${esc(g.target)}</b><span>linked ${g.n}×</span></a>
        <button type="button" data-act="vault-write" data-t="${esc(g.target)}" data-n="${g.n}" title="An agent writes it from the notes that link it">Write it</button></div>`).join("")}</section>` : "")
    + (old ? `<section class="nt-redo" style="--c: ${folderColor(old.folder)}"><h4>Rediscover</h4><a href="${noteHref(old.path)}"><b>${esc(old.title)}</b></a>
      <p>${esc(plain(old.summary) || "Out of the review cycle, untouched for a while.")}</p>
      <div><a href="${noteHref(old.path)}">Reread ${icon("r", 12)}</a><button type="button" data-act="enroll" data-p="${esc(old.path)}">Add to review</button></div></section>` : "");
  return `<div class="nt-alive ${side ? "" : "solo"}">
      ${projects.length ? `<section><h4>Projects <a href="#/notes" data-act="filter" data-k="@project">All ${projects.length} ${icon("r", 11)}</a></h4>
        ${projects.slice(0, 5).map((n) => `<a class="nt-proj" href="${noteHref(n.path)}"><span><b>${esc(n.title)}</b><small>${esc(plain(n.summary) || "No summary yet.")}</small></span><time>${esc(ago(n.mtime))}</time></a>`).join("")}</section>` : ""}
      ${side ? `<div class="nt-side">${side}</div>` : ""}
    </div>
    <section class="nt-cols"><h4>Collections <a href="#/notes" data-act="filter" data-k="*">All ${D.notes.length} ${icon("r", 11)}</a></h4>
      <div class="nt-colrow">${Object.keys(by).sort((a, b) => by[b] - by[a]).map((f) => `<button type="button" class="nt-col" data-act="filter" data-k="${esc(f)}" style="--c: ${folderColor(f)}"><i></i>${esc(folderLabel(f))}<small>${by[f]}</small></button>`).join("")}</div></section>`;
}
// Words a question carries that say nothing about the note ("o que é um frete", "what is a waybill", "quando a gente cobra").
const STOP = new Set(["o", "a", "os", "as", "que", "e", "é", "de", "do", "da", "dos", "das", "um", "uma", "em", "no", "na", "para", "pra", "com", "por", "como", "quando", "qual", "quais", "onde", "porque", "gente", "what", "is", "the", "of", "an", "how", "when", "why", "which", "where", "do", "does", "we", "to", "in", "on", "for"]);
let textTimer = 0;
const hitRow = (n, line = "") => `<a class="nt-hit" href="${noteHref(n.path)}" style="--c: ${folderColor(n.folder)}"><i></i><b>${esc(n.title)}</b><small>${esc(folderLabel(n.folder))}${line ? ` · ${esc(line)}` : n.summary ? ` · ${esc(plain(n.summary))}` : ""}</small></a>`;
function grid() {
  const q = fold(query).trim(), terms = q.split(/\s+/).filter((t) => t && !STOP.has(t));
  const acts = $(".nt-ask-acts"), box = $("#search");
  if (acts) acts.hidden = !query.trim();
  if (box) { box.style.height = "auto"; box.style.height = `${box.scrollHeight}px`; }
  clearTimeout(textTimer);
  if (!filter) return askMatches(q, terms);
  $("#nt-found").innerHTML = "";
  const weight = (n) => (!q ? 0 : fold(n.title).startsWith(terms[0] || q) ? 0 : fold(n.title).includes(terms[0] || q) ? 1 : 2);
  const ns = D.notes.filter((n) => (filter === "*" || (FILTERS[filter] ? FILTERS[filter][1](n) : n.folder === filter)) && terms.every((t) => fold(n.title + " " + n.summary + " " + n.tags.join(" ")).includes(t)))
    .sort((a, b) => weight(a) - weight(b) || b.mtime - a.mtime);
  $("#note-grid").innerHTML = ns.map(noteCard).join("") || `<p class="empty">No title matches "${esc(query)}".</p>`;
  // Then the text of the notes, a beat after typing stops.
  const hitsBox = $("#text-hits");
  if (!hitsBox) return;
  hitsBox.innerHTML = "";
  if (terms.join("").length < 3) return;
  const shown = new Set(ns.map((n) => n.path)), inFolder = (p) => filter === "*" || !!FILTERS[filter] || (filter === "." ? !p.includes("/") : p.startsWith(`${filter}/`));
  textTimer = setTimeout(async () => {
    const hits = (await api(`/api/search?q=${encodeURIComponent(terms.join(" "))}`).catch(() => [])).filter((h) => !shown.has(h.path) && inFolder(h.path));
    if (fold(query).trim() !== q || !$("#text-hits")) return;
    $("#text-hits").innerHTML = hits.length
      ? `<h3>In the text</h3><div class="list glass">${hits.map((h) => `<a class="row" href="${noteHref(h.path)}"><span class="t">${esc(h.title)}<small>${esc(h.line)}</small></span></a>`).join("")}</div>` : "";
  }, 250);
}
// The overview while you type: the notes that already talk about it, inside the box (a question matches on any of its
// words, the most words first, titles ahead), then lines from the text; "See all" opens the grid.
function askMatches(q, terms) {
  $("#note-grid").innerHTML = ""; $("#text-hits").innerHTML = "";
  const ov = $("#nt-overview"), found = $("#nt-found");
  if (ov && (!q || !ov.innerHTML)) ov.innerHTML = notesOverview();
  if (!found) return;
  const words = terms.filter((t) => t.length > 2);
  if (!words.length) { found.innerHTML = ""; return; }
  const score = (n) => { const t = fold(n.title), rest = fold(`${n.summary} ${n.tags.join(" ")}`); return words.reduce((s, w) => s + (t.includes(w) ? 3 : rest.includes(w) ? 1 : 0), 0); };
  const top = D.notes.map((n) => [n, score(n)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1] || b[0].mtime - a[0].mtime).slice(0, 5).map(([n]) => n);
  const paint = (lines = []) => {
    found.innerHTML = top.length || lines.length ? `<h5>Already in the vault</h5>${top.map((n) => hitRow(n)).join("")}${lines.join("")}
      <button type="button" class="nt-all" data-act="filter" data-k="*">See every match ${icon("r", 11)}</button>` : "";
  };
  paint();
  const shown = new Set(top.map((n) => n.path));
  textTimer = setTimeout(async () => {
    const hits = (await api(`/api/search?q=${encodeURIComponent(words.join(" "))}`).catch(() => [])).filter((h) => !shown.has(h.path)).slice(0, 3);
    if (fold(query).trim() !== q || !$("#nt-found")) return;
    paint(hits.map((h) => hitRow(D.notes.find((n) => n.path === h.path) || { path: h.path, title: h.title, folder: "", summary: "" }, h.line)));
  }, 250);
}

// ---------------------------------------------------------------- Reader
async function reader(path) {
  const n = await api(`/api/note?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!n) { main.innerHTML = `<div class="lost"><ascii-art piece="not-found" mono label="Not found"></ascii-art><p class="empty">Note not found.</p></div>`; return; }
  main.innerHTML = `<div class="reader">
    <article class="art glass">
      <div class="in"><h1>${esc(n.title)}</h1>
        <div class="chips">${confChip(n)}${[n.type, n.area, ...n.tags].filter(Boolean).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
        <div class="prose" id="prose">${n.html}</div></div></article>
    <aside class="rail">
      <div class="box glass">
        <a class="btn peach" href="${obs(n.path)}">Open in Obsidian ${icon("ext", 16)}</a>
        <div class="rd-acts"><button class="btn glass" data-act="note-ask" data-p="${esc(n.path)}" title="Open an agent on the canvas that has read this note">${icon("spark", 15)} Ask an agent</button>
          <button class="btn glass" data-act="note-canvas" data-p="${esc(n.path)}" title="Put this note on the canvas">${icon("grid", 15)} On canvas</button>
          <a class="btn glass" href="#/graph/${encodeURIComponent(nameOf(n.path))}" title="This note and what it links to, on the map">${icon("graph", 15)} In the graph</a></div>
        ${((c) => c ? `<p class="empty" style="padding:10px 0 0">In review: ${!c.next || c.next <= D.today ? "due today" : `next ${rel.format(daysBetween(D.today, c.next), "day")}`}.</p>`
          : `<button class="btn glass" data-act="enroll" data-p="${esc(n.path)}">Add to review</button>`)((D.cards || []).find((x) => cardNote(x) === n))}</div>
      <div class="box glass"><h3>Linked from</h3>${n.backlinks.map((b) => `<a class="l" href="${noteHref(b.path)}">${esc(b.title)}</a>`).join("") || '<p class="empty" style="padding:0">Nothing links here yet.</p>'}</div>
      <div class="box glass"><h3>Links to</h3>${[...new Set(n.links)].map((l) => `<a class="l" href="#/w/${encodeURIComponent(l)}" style="${resolveNote(l) ? "" : "opacity:.5"}">${esc(l)}</a>`).join("") || '<p class="empty" style="padding:0">No links.</p>'}</div>
      <button class="quiet-danger" data-act="trash" data-p="${esc(n.path)}">${icon("trash", 14)} Move to trash</button>
    </aside></div>`;
  // Obsidian callout: a blockquote starting with [!type] Title.
  document.querySelectorAll("#prose blockquote").forEach((b) => {
    const p = b.querySelector("p");
    const m = p?.innerHTML.match(/^\[!(\w+)\]\s*([^\n<]*)(?:<br\s*\/?>|\n)?/);
    if (!m) return;
    b.classList.add("co", m[1]);
    p.innerHTML = `<span class="ct">${m[2] || m[1]}</span>` + p.innerHTML.slice(m[0].length);
  });
  // Diagrams: mermaid loads only for a note that has one; offline, the diagram stays as code.
  const mm = [...document.querySelectorAll("#prose code.language-mermaid")];
  if (mm.length) import("https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs").then(async ({ default: m }) => {
    m.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
    const ds = mm.filter((c) => c.isConnected).map((c) => { const d = document.createElement("div"); d.className = "mermaid"; d.textContent = c.textContent; c.parentElement.replaceWith(d); return d; });
    if (ds.length) await m.run({ nodes: ds });
  }).catch(() => {});
  ambient(art(n.title));
  scrollTo({ top: 0 });
}
function wiki(name) {
  const n = resolveNote(name);
  if (n) return location.replace(noteHref(n.path));
  const who = D.notes.filter((x) => x.links.includes(name));
  main.innerHTML = `<div class="ph"><h1>${esc(name)}</h1><p>Gap: doesn't exist yet. A missing link is an honest backlog, not an error.</p></div>
    <h3>Linked from</h3><div class="list glass">${who.map((x) => `<a class="row" href="${noteHref(x.path)}"><span class="t">${esc(x.title)}<small>${esc(x.summary)}</small></span></a>`).join("") || '<p class="empty">Nobody.</p>'}</div>
    <p class="empty" style="padding:18px 0">To write it: ask your agent "write the note ${esc(name)}" or create it in Obsidian. Don't click the missing link just to create an empty file.</p>`;
  ambient(art(name));
}

// ---------------------------------------------------------------- Review
// Cards come back in 1, 2, 4… days until you know them. This page and the Home's "Do you remember?" share the open answer.
let rvShown = "", rvDone = 0;
// The answer as written (its trailing [[note]] becomes a link below); a card that is only a link shows the note's
// summary as it is today, so it doesn't go stale.
const cardText = (c) => unlink(c.a.replace(/\s*\[\[[^\]]*\]\]\s*$/, "")).trim() || plain(cardNote(c)?.summary || "");
function cardAnswer(c) {
  const n = cardNote(c);
  return `<p>${esc(cardText(c) || "No answer written yet. Ask again to get one.")}</p>
    <div class="rv-src">${n ? `<a href="${noteHref(n.path)}">${esc(n.title)} ${icon("r", 11)}</a>` : ""}${c.added ? `<span>asked ${esc(rel.format(-daysBetween(c.added, D.today), "day"))}</span>` : ""}</div>`;
}
function cardFace(c, big) {
  const k = (x) => (big ? ` <kbd>${x}</kbd>` : ""), id = esc(c.id);
  return `<p class="rv-q">${esc(c.q)}</p>${rvShown === c.id ? `<div class="rv-a">${cardAnswer(c)}</div>
    <div class="rv-acts"><button type="button" class="btn glass" data-act="card-no" data-id="${id}">Forgot${k(1)}</button><button type="button" class="btn peach" data-act="card-yes" data-id="${id}">Remembered${k(2)}</button>
      <button type="button" class="rv-rm" data-act="card-rm" data-id="${id}" title="Useless or out of date: take it out">Remove</button></div>`
    : `<div class="rv-acts"><button type="button" class="btn ${big ? "peach" : "glass"}" data-act="card-show" data-id="${id}">Show answer${k("space")}</button>${big ? "<small>Answer it in your head first.</small>" : ""}</div>`}`;
}
function review() {
  const cards = D.cards || [], now = due(), c = now[0];
  const later = cards.filter((x) => x.next > D.today).sort((a, b) => a.next.localeCompare(b.next));
  const when = (x) => (!x.next || x.next <= D.today ? "today" : rel.format(daysBetween(D.today, x.next), "day"));
  // to start with (while there are few cards): the concepts the other notes link most, not in review yet
  const inLinks = {};
  for (const x of D.notes) for (const l of new Set(x.links)) inLinks[l] = (inLinks[l] || 0) + 1;
  const start = cards.length >= 10 ? [] : D.notes.filter((x) => x.type === "concept" && x.summary && !inCycle(x))
    .sort((a, b) => (inLinks[nameOf(b.path)] || 0) - (inLinks[nameOf(a.path)] || 0) || a.title.localeCompare(b.title)).slice(0, 5);
  main.innerHTML = `<div class="nt-head"><h1>Review</h1><p>${cards.length ? `${cards.length} ${cards.length === 1 ? "card" : "cards"} · ` : ""}what you ask the vault comes back in 1, 2, 4… days until you know it</p></div>
    ${c ? `<section class="rv-card"><span class="rv-n">${now.length} to review today</span>${cardFace(c, true)}</section>`
      : `<section class="rv-card rv-done"><p class="rv-q">${rvDone ? `${rvDone} reviewed. That's all for today.` : cards.length ? "Nothing to review today." : "No cards yet."}</p>
        <p>${cards.length ? (later[0] ? `Next: “${esc(later[0].q)}” ${esc(when(later[0]))}.` : "") : 'Ask the vault something on <a href="#/notes">Notes</a>: the question comes back here tomorrow, with the answer the agent gave.'}</p></section>`}
    ${cards.length || start.length ? `<div class="nt-alive ${cards.length && start.length ? "" : "solo"}">
      ${cards.length ? `<section><h4>All cards <span>${cards.length}</span></h4>${[...now, ...later].map((x) => `<div class="rv-row">
        <span><b>${esc(x.q)}</b><small>${esc(cardText(x))}</small></span><time>${esc(when(x))}</time>
        <span class="rv-row-acts"><button type="button" data-act="vault-ask" data-q="${esc(x.q)}" title="An agent answers it again on the canvas">Ask again</button><button type="button" data-act="card-rm" data-id="${esc(x.id)}" title="Take it out">Remove</button></span></div>`).join("")}</section>` : ""}
      ${start.length ? `<section><h4>Start with what the vault leans on</h4>${start.map((x) => `<div class="nt-gap"><a href="${noteHref(x.path)}"><b>${esc(x.title)}</b><span>linked ${inLinks[nameOf(x.path)] || 0}×</span></a>
        <button type="button" data-act="enroll" data-p="${esc(x.path)}" title="Adds the card “${esc(D.cardsFile === "Revisão.md" ? "O que é" : "What is")} ${esc(x.title)}?”">Add</button></div>`).join("")}</section>` : ""}
    </div>` : ""}`;
  ambient(art(c ? c.q : "review"));
}
// Answer or remove a card, then redraw whichever page shows it (this one, or the Home's column).
async function cardDo(what, id, remembered) {
  try {
    const r = await api(`/api/cards/${what}`, { id, remembered });
    D.cards = r.cards; rvShown = "";
    if (what === "answer") rvDone++;
    toast(what === "remove" ? "Card removed" : r.card.retired ? "You know this one: it left the review" : `Back ${rel.format(r.card.interval, "day")}`);
  } catch (e) { toast(e.message); }
  rvRedraw();
}
function rvRedraw() { topBar(); if (route().pg === "review") review(); else if (!route().pg) tdSide(); }

// ---------------------------------------------------------------- Graph
// The canvas can't read CSS variables, so the graph takes the theme's colours when it draws.
const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
let PALETTE = [], AREAS = [];
// One colour per area while the palette lasts, then the same colours fainter (hashing put 9 areas on 6 colours).
const areaColor = (a) => { const i = Math.max(0, AREAS.indexOf(a)), c = PALETTE[i % PALETTE.length]; return i < PALETTE.length ? c : alpha(c, .5); };
let graphStop = null;
// The map: the notes in columns by what they are, data on the left and people on the right (database → table → worker →
// platform → system → process → team → project), so a note sits in the same place every time. Click one to focus it and
// what it links to; "What depends on it" follows the links rightwards, a guess, since links have no direction. A vault
// without these types (fewer than 3 columns) gets the force graph ("Network"), which focuses the same way.
const LANES = [
  ["Databases", ["banco", "database", "db"]],
  ["Tables", ["tabela", "table"]],
  ["Workers", ["worker", "service", "job"]],
  ["Platforms", ["plataforma", "platform", "modulo", "module"]],
  ["Systems", ["sistema", "system", "app"]],
  ["Processes", ["processo", "process"]],
  ["Teams", ["setor", "team", "department", "empresa", "company"]],
  ["Other", []],
  ["Projects", ["project"]],
  ["Concepts", ["concept", "mapa", "map", ""]],
];
const OTHER = 7, PROJECTS = 8, CONCEPTS = 9;
const DOWN = (x, y) => y.lane > x.lane && y.lane < CONCEPTS;
let gMode = "map", gDepth = 1, gImpact = false, gLast = "", gShow = new Set(); // gShow: the optional columns shown (projects, concepts)
// "orders (table)" sits in Tables already: the type in brackets goes
const gmTitle = (x) => x.n.title.replace(/\s*\(([^)]*)\)\s*$/, (m, w) => (w.toLowerCase() === (x.n.type || "").toLowerCase() ? "" : m)) || x.n.title;
function gmModel() {
  const nodes = D.notes.filter((n) => n.type !== "daily").map((n) => {
    const t = (n.type || "").toLowerCase(), i = LANES.findIndex(([, ts]) => ts.includes(t));
    return { id: nameOf(n.path), n, lane: i >= 0 ? i : OTHER, nb: new Set() };
  });
  const byId = new Map(nodes.map((x) => [x.id, x]));
  for (const x of nodes) for (const l of x.n.links) { const y = byId.get(l); if (y && y !== x) { x.nb.add(y); y.nb.add(x); } }
  return { nodes, byId };
}
// Steps from a note along its links (only the ones ok() allows), up to depth: note → steps away.
function gmReach(start, depth, ok = () => true) {
  const d = new Map([[start, 0]]), q = [start];
  while (q.length) { const x = q.shift(); if (d.get(x) >= depth) continue; for (const y of x.nb) if (!d.has(y) && ok(x, y)) { d.set(y, d.get(x) + 1); q.push(y); } }
  return d;
}
// The cheapest chain of links from a to b; going through a note costs more the more it links (a hub like the glossary
// joins everything, so a path through it says little).
function gmPath(a, b) {
  const cost = new Map([[a, 0]]), prev = new Map(), open = new Set([a]);
  while (open.size) {
    let x = null;
    for (const y of open) if (!x || cost.get(y) < cost.get(x)) x = y;
    open.delete(x);
    if (x === b) break;
    for (const y of x.nb) { const c = cost.get(x) + 1 + (y === b ? 0 : y.nb.size / 30); if (c < (cost.get(y) ?? Infinity)) { cost.set(y, c); prev.set(y, x); open.add(y); } }
  }
  if (!cost.has(b)) return null;
  const p = [b];
  while (p[0] !== a) p.unshift(prev.get(p[0]));
  return p;
}
// Notes it doesn't link but shares links with (two or more), shared hubs counting less (Adamic-Adar).
function gmSuggest(me) {
  const s = new Map();
  for (const z of me.nb) for (const y of z.nb) if (y !== me && !me.nb.has(y)) { const o = s.get(y) || { k: 0, w: 0 }; o.k++; o.w += 1 / Math.log(2 + z.nb.size); s.set(y, o); }
  return [...s].filter(([, o]) => o.k >= 2).sort((a, b) => b[1].w - a[1].w).slice(0, 4);
}
const laneColor = (i) => `var(--p${(i % 6) + 1})`;
function graph(arg = "") {
  graphStop?.(); graphStop = null; // redrawn in place (depth, layout) as well as from the route
  if (arg !== gLast) { gImpact = false; gLast = arg; }
  const [fid = "", tid = ""] = arg.split("/"), m = gmModel(), me = m.byId.get(fid), to = me && m.byId.get(tid), path = to ? gmPath(me, to) : null;
  const canMap = new Set(m.nodes.map((x) => x.lane).filter((l) => l !== CONCEPTS && l !== OTHER)).size >= 3, mode = canMap ? gMode : "net";
  const down = me ? gmReach(me, 2, DOWN) : null;
  if (down?.size === 1) gImpact = false;
  const reach = me ? (path ? new Map(path.map((x, i) => [x, i])) : gImpact ? down : gmReach(me, gDepth)) : null;
  const vis = new Set(reach ? reach.keys() : m.nodes.filter((x) => mode === "net" || (x.lane !== CONCEPTS && x.lane !== PROJECTS) || gShow.has(x.lane)));
  const opt = [[PROJECTS, "Projects"], [CONCEPTS, "Concepts"]].map(([l, t]) => [l, t, m.nodes.filter((x) => x.lane === l).length]).filter(([, , n]) => n);
  main.innerHTML = `<div class="nt-head"><h1>Graph</h1><p>${path ? `From ${esc(me.n.title)} to ${esc(to.n.title)}` : me ? (gImpact ? `What may depend on ${esc(me.n.title)}` : `${esc(me.n.title)} and what it links to`)
      : mode === "map" ? "Your notes by what they are: data on the left, people on the right. Click one to see what it touches." : "Every note and its links. Click one to see what it touches; drag to move, scroll to zoom."}</p></div>
    <div class="gm-bar">
      <input id="gm-find" list="gm-names" placeholder="Focus on a note…" autocomplete="off" spellcheck="false" aria-label="Focus on a note"><datalist id="gm-names">${m.nodes.map((x) => `<option value="${esc(x.n.title)}">`).join("")}</datalist>
      ${me && !path ? `<div class="gm-seg" role="group" aria-label="How far from it">${[1, 2, 3].map((d) => `<button type="button" class="${!gImpact && gDepth === d ? "on" : ""}" data-act="gm-depth" data-d="${d}">${d === 1 ? "Its links" : `${d} steps`} <kbd>${d}</kbd></button>`).join("")}</div>
        <a class="gm-clear" href="#/graph">Whole vault <kbd>Esc</kbd></a>`
      : !me && mode === "map" ? opt.map(([l, t, n]) => `<button type="button" class="gm-chip ${gShow.has(l) ? "on" : ""}" data-act="gm-lane" data-l="${l}" title="Show the ${t.toLowerCase()} column too">${t} <small>${n}</small></button>`).join("") : ""}
      ${canMap ? `<div class="gm-seg gm-mode" role="group" aria-label="Layout">${[["map", "Map"], ["net", "Network"]].map(([k, l]) => `<button type="button" class="${mode === k ? "on" : ""}" data-act="gm-mode" data-m="${k}">${l}</button>`).join("")}</div>` : ""}
    </div>
    ${path ? gmPathCard(path) : me ? gmCard(me, down, to) : ""}<div class="gm-wrap"><div id="gm-view"></div></div>`;
  const find = $("#gm-find");
  const pick = (input, go) => { input.onchange = () => { const x = m.nodes.find((y) => y.n.title === input.value.trim()); if (x) location.hash = go(x); }; };
  pick(find, (x) => `#/graph/${encodeURIComponent(x.id)}`);
  if ($("#gm-to")) pick($("#gm-to"), (x) => `#/graph/${encodeURIComponent(me.id)}/${encodeURIComponent(x.id)}`);
  if (mode === "map") gmDraw($("#gm-view"), m, vis, me, reach);
  else graphNet($("#gm-view"), reach ? new Set([...vis].map((x) => x.id)) : null, arg);
  ambient(art("graph"));
}
// The note in focus, above the map (the map lists what it links to, so the full width goes to the map).
function gmCard(me, down, to) {
  const n = me.n, ring = (h) => [...down.values()].filter((d) => d === h).length, sugg = gImpact ? [] : gmSuggest(me);
  return `<section class="gm-card" style="--c: ${laneColor(me.lane)}">
    <div><span class="gm-type"><i></i>${esc(n.type || "note")}</span><h3>${esc(n.title)}</h3>${n.summary ? `<p>${esc(plain(n.summary))}</p>` : ""}
      ${gImpact ? `<p class="gm-note">${ring(1)} link to it directly and ${ring(2)} through those. Read from the links between notes, which have no direction: some may not really depend on it.</p>` : ""}</div>
    <div class="gm-acts"><a class="btn peach" href="${noteHref(n.path)}">Open the note</a>
      ${down.size > 1 ? `<button type="button" class="btn glass" data-act="gm-impact">${gImpact ? "Back to its links" : `What depends on it <small>${down.size - 1}</small>`}</button>` : ""}
      ${gImpact ? '<button type="button" class="btn glass" data-act="gm-ask" title="An agent reads these notes and says what would break">Ask an agent what breaks</button>' : ""}</div>
    ${gImpact ? "" : `<div class="gm-foot">
      <input id="gm-to" list="gm-names" placeholder="Path to another note…" autocomplete="off" spellcheck="false" aria-label="Path to another note">
      ${to ? `<span class="gm-note">No chain of links reaches ${esc(to.n.title)}.</span>` : ""}
      ${sugg.length ? `<div class="gm-sugg"><span>Might relate, not linked:</span>${sugg.map(([x, o]) => `<span class="gm-s" style="--c: ${laneColor(x.lane)}"><a href="#/graph/${encodeURIComponent(x.id)}" title="${o.k} links in common"><i></i>${esc(gmTitle(x))}</a><button type="button" data-act="gm-link" data-id="${esc(x.id)}" title="An agent reads both and links them if they really relate">Link</button></span>`).join("")}</div>` : ""}
    </div>`}
  </section>`;
}
function gmPathCard(path) {
  const a = path[0], b = path.at(-1);
  return `<section class="gm-card" style="--c: ${laneColor(a.lane)}">
    <div><span class="gm-type"><i></i>Path · ${path.length - 1} ${path.length === 2 ? "step" : "steps"}</span><h3>${esc(a.n.title)} → ${esc(b.n.title)}</h3>
      <div class="gm-chain">${path.map((x) => `<a href="#/graph/${encodeURIComponent(x.id)}" style="--c: ${laneColor(x.lane)}"><i></i>${esc(gmTitle(x))}</a>`).join('<span aria-hidden="true">→</span>')}</div></div>
    <div class="gm-acts"><a class="btn glass" href="#/graph/${encodeURIComponent(a.id)}">Back to ${esc(gmTitle(a))}</a>
      <button type="button" class="btn glass" data-act="gm-explain" title="An agent reads the chain and explains how one leads to the other">Ask an agent to explain it</button></div>
  </section>`;
}
function gmDraw(el, m, vis, me, reach) {
  const cols = LANES.map(() => []);
  for (const x of m.nodes) if (vis.has(x)) cols[x.lane].push(x);
  for (const c of cols) c.sort((a, b) => a.n.title.localeCompare(b.n.title));
  // A few sweeps moving each note toward the rows of what it links in the columns beside it, so lines run flatter.
  const pos = new Map(), at = () => cols.forEach((c) => c.forEach((x, i) => pos.set(x, (i + 0.5) / c.length)));
  at();
  for (let s = 0; s < 4; s++) for (const [i, c] of s % 2 ? [...cols.entries()].reverse() : [...cols.entries()]) {
    const bc = new Map(c.map((x) => { const ys = [...x.nb].filter((y) => vis.has(y) && (s % 2 ? y.lane > i : y.lane < i)); return [x, ys.length ? ys.reduce((t, y) => t + pos.get(y), 0) / ys.length : pos.get(x)]; }));
    c.sort((a, b) => bc.get(a) - bc.get(b)); at();
  }
  el.className = `gm${me ? " focus" : ""}`;
  el.innerHTML = `<svg aria-hidden="true"></svg>${cols.map((c, i) => c.length ? `<div class="gm-lane" style="--c: ${laneColor(i)}"><h4>${LANES[i][0]} <small>${c.length}</small></h4>
    ${c.map((x) => `<button type="button" class="gm-n ${x === me ? "me" : reach ? `h${reach.get(x)}` : ""}" data-act="gm-focus" data-id="${esc(x.id)}" title="${esc(x.n.title)}${x.n.summary ? ` · ${esc(plain(x.n.summary))}` : ""}"><i></i><span>${esc(gmTitle(x))}</span></button>`).join("")}</div>` : "").join("")}`;
  const btn = new Map([...el.querySelectorAll(".gm-n")].map((b) => [m.byId.get(b.dataset.id), b]));
  const pairs = [];
  // focused, only the lines from one ring to the next (the whole tangle between them says nothing); the ones to it stand out
  for (const x of btn.keys()) for (const y of x.nb) if (btn.has(y) && x.lane < y.lane && (!me || Math.abs(reach.get(x) - reach.get(y)) === 1)) pairs.push([x, y]);
  const lit = (a, b) => !!me && (gImpact || a === me || b === me);
  const svg = el.querySelector("svg");
  const paint = () => {
    const o = el.getBoundingClientRect();
    svg.innerHTML = pairs.map(([a, b]) => {
      const r = btn.get(a).getBoundingClientRect(), s = btn.get(b).getBoundingClientRect();
      const x1 = r.right - o.left + 2, y1 = r.top + r.height / 2 - o.top, x2 = s.left - o.left - 2, y2 = s.top + s.height / 2 - o.top, k = Math.max(20, (x2 - x1) / 2);
      return `<path class="${lit(a, b) ? "on" : ""}" data-a="${esc(a.id)}" data-b="${esc(b.id)}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + k).toFixed(1)} ${y1.toFixed(1)} ${(x2 - k).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    }).join("");
  };
  const ro = new ResizeObserver(paint);
  ro.observe(el);
  graphStop = () => ro.disconnect();
  // hovering a note lights it, its links and the lines between them
  let hot = null;
  const hl = (x) => {
    if (x === hot) return;
    hot = x; el.classList.toggle("hl", !!x);
    for (const [y, b] of btn) b.classList.toggle("on", !!x && (y === x || x.nb.has(y)));
    for (const p of svg.children) p.classList.toggle("hot", !!x && (p.dataset.a === x.id || p.dataset.b === x.id));
  };
  el.onpointerover = (e) => { const b = e.target.closest(".gm-n"); hl(b ? m.byId.get(b.dataset.id) : null); };
  el.onpointerleave = () => hl(null);
}
// Network: every note and link as a force graph. keep (ids) narrows it to a focused note's neighbourhood.
function graphNet(el, keep, focus) {
  el.className = "";
  el.innerHTML = '<section class="graph glass"><canvas id="cv"></canvas></section>';
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  AREAS = [...new Set(D.notes.map((n) => n.area).filter(Boolean))].sort();
  PALETTE = ["--p1", "--p2", "--p3", "--p4", "--p5", "--p6"].map(tok);
  const ink = tok("--ink"), accent = tok("--accent"), bg = tok("--bg");
  const nodes = D.notes.filter((n) => n.type !== "daily" && (!keep || keep.has(nameOf(n.path)))).map((n) => ({ id: nameOf(n.path), t: n.title, p: n.path, a: n.area, c: n.area ? areaColor(n.area) : alpha(ink, .8) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!keep) for (const v of D.missing) if (!byId.has(v.target)) { const g = { id: v.target, t: v.target, c: alpha(ink, .25), ghost: true }; nodes.push(g); byId.set(v.target, g); }
  const edges = [];
  for (const n of D.notes) for (const l of new Set(n.links)) { const a = byId.get(nameOf(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  const byDeg = [...nodes].sort((a, b) => (deg.get(b) || 0) - (deg.get(a) || 0));
  let W, H, panX = 0, panY = 0, zoom = 1;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 2.5 + Math.sqrt(deg.get(n) || 0) * 0.9; n.m = alpha(ink, .3 + .45 * Math.min(1, (deg.get(n) || 0) / 25)); });
  let hov = null, drag = null, pan = null, down = null, heat = 1;
  // ponytail: O(n²) repulsion; fine up to ~500 notes, quadtree if the vault grows.
  function step() {
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01, f = 2400 / d2;
      a.vx += dx * f * 0.05; a.vy += dy * f * 0.05;
    }
    for (const [a, b] of edges) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 120) * 0.004;
      a.vx += dx / d * f * d * 0.1; a.vy += dy / d * f * d * 0.1; b.vx -= dx / d * f * d * 0.1; b.vy -= dy / d * f * d * 0.1;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002;
      // Springs grow with distance², so a note with dozens of links overshoots and the layout blows up to NaN: cap the step.
      const sp = Math.hypot(n.vx, n.vy); if (sp > 40) { n.vx *= 40 / sp; n.vy *= 40 / sp; }
      if (n !== drag) { n.x += n.vx * heat; n.y += n.vy * heat; }
      n.vx *= 0.6; n.vy *= 0.6;
    }
    heat = Math.max(0.05, heat * 0.99);
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);
    const hover = hov || byId.get(focus) || null; // a focused note stays lit while the mouse is elsewhere
    const near = hover ? new Set(edges.filter(([a, b]) => a === hover || b === hover).flat()) : null;
    // two strokes (faint, lit) instead of one per edge: ~2500 edges in a vault of 200 notes
    ctx.lineWidth = 1 / zoom;
    for (const on of [false, true]) {
      ctx.beginPath();
      for (const [a, b] of edges) if ((a === hover || b === hover) === on) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.strokeStyle = on ? alpha(accent, .55) : alpha(ink, .06); ctx.stroke();
    }
    for (const n of nodes) {
      // Grey at rest; hovering a note gives it and its neighbours their area's colour. A missing note is just a ring.
      const lit = n === hover || near?.has(n);
      ctx.globalAlpha = near && !lit ? 0.2 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7);
      if (n.ghost) { ctx.strokeStyle = alpha(ink, .35); ctx.lineWidth = 1 / zoom; ctx.stroke(); }
      else { ctx.fillStyle = lit ? n.c : n.m; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // Labels after the dots, the most linked first (all of them when zoomed in); one that would overlap is skipped.
    const want = hover ? [hover, ...byDeg.filter((n) => n !== hover && near.has(n))] : zoom > 1.8 ? byDeg : byDeg.slice(0, 25);
    const placed = [], k = 1 / Math.min(zoom, 1); // zoomed out, labels keep 12px on screen instead of shrinking with the dots
    ctx.font = `500 ${12 * k}px "Instrument Sans", system-ui, sans-serif`; ctx.lineJoin = "round"; ctx.lineWidth = 3 * k; ctx.strokeStyle = bg;
    for (const n of want) {
      const t = n.t.length > 34 ? n.t.slice(0, 32) + "…" : n.t, label = n === hover && n.a ? `${t} · ${n.a}` : t, x = n.x + n.r + 5 * k, y = n.y + 4 * k, w = ctx.measureText(label).width;
      if (placed.some(([px, py, pw]) => x < px + pw + 4 * k && x + w + 4 * k > px && Math.abs(y - py) < 14 * k)) continue;
      placed.push([x, y, w]);
      ctx.strokeText(label, x, y);
      ctx.fillStyle = alpha(ink, n.ghost ? .45 : .9); ctx.fillText(label, x, y);
    }
  }
  // Settle most of the layout before the first frame (300 ms at most), then frame it: no flying start, nothing off the canvas.
  const t0 = performance.now();
  while (heat > 0.12 && performance.now() - t0 < 300) step();
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 150, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30; // labels sit to the right
  const top = 16, base = 90, h = H - top - base; // the dock floats over the bottom
  if (nodes.length) { zoom = Math.min(1.5, W / (x1 - x0), h / (y1 - y0)); panX = (W - (x0 + x1) * zoom) / 2; panY = top + (h - (y0 + y1) * zoom) / 2; }
  let alive = true;
  // Stops once it settles: only animates again while a note is dragged (saves CPU while the tab sits idle).
  let idle = false;
  const loop = () => { if (!alive) return; step(); draw(); if (heat > 0.06 || drag) requestAnimationFrame(loop); else idle = true; };
  const wake = () => { if (idle) { idle = false; requestAnimationFrame(loop); } };
  loop();
  graphStop = () => { alive = false; };
  const world = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - panX) / zoom, (e.clientY - r.top - panY) / zoom]; };
  const find = (e) => { const [x, y] = world(e); return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 6 / zoom); };
  let moved = false;
  cv.onpointermove = (e) => {
    if (drag) { [drag.x, drag.y] = world(e); if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 3) moved = true; heat = Math.max(heat, 0.3); wake(); }
    else if (pan) { panX = e.clientX - pan[0]; panY = e.clientY - pan[1]; draw(); }
    else { const h = find(e); if (h !== hov) { hov = h; draw(); } cv.style.cursor = hov ? "pointer" : "grab"; } // redraw only when the note under the mouse changes
  };
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    down = [e.clientX, e.clientY]; drag = find(e); moved = false;
    if (!drag) { pan = [e.clientX - panX, e.clientY - panY]; cv.style.cursor = "grabbing"; }
  };
  cv.onpointerup = cv.onpointercancel = () => {
    if (drag && !moved) location.hash = drag.ghost ? `#/w/${encodeURIComponent(drag.id)}` : drag.id === focus ? noteHref(drag.p) : `#/graph/${encodeURIComponent(drag.id)}`;
    drag = pan = null; cv.style.cursor = hov ? "pointer" : "grab";
  };
  cv.onwheel = (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const k = Math.min(4, Math.max(0.25, zoom * Math.exp(-e.deltaY * 0.0015)));
    panX = sx - (sx - panX) * (k / zoom); panY = sy - (sy - panY) * (k / zoom); zoom = k;
    draw();
  };
}


// ---------------------------------------------------------------- Agents (Maestro Orchestrator)
const ROUTINES = {
  morning: ["Morning", "Builds today's focus in the daily note: reviews, inbox, gaps."],
  inbox: ["Inbox", "Processes the inbox folder: each item becomes a proper note or stays, with the reason."],
};
const ORCH_ROLES = [
  ["", "General", "What should the agent(s) do?"],
  ["Vault curator: organize, link, and write Markdown notes following the vault's conventions.", "Vault note", "Describe the note, topic, or inbox item to curate in the vault…"],
  ["Deep researcher: investigate thoroughly, verify facts, and synthesize clear findings.", "Research", "What topic, question, or codebase area should be researched?"],
  ["Senior engineer: inspect the workspace, diagnose the root cause, implement the minimal fix, and verify.", "Code / Fix", "Describe the bug, feature, or system issue to diagnose and fix…"],
  ["Principal auditor: review architecture, edge cases, and security without unnecessary changes.", "Audit", "What should be audited or stress-tested?"],
];
const AGENT_NAME = { claude: ["Claude Code", "agents"], agy: ["Antigravity", "bolt"], codex: ["Codex", "agents"], gemini: ["Gemini", "spark"] };
const runnerName = (id) => S.runners?.find((r) => r.id === id)?.name || id;
// An agent's picture when the user set one in Settings, else its icon. Takes a runner id or a process name.
const avatar = (key, ic = "agents", size = 20) => {
  const r = S.runners?.find((x) => x.id === key || x.process === key);
  return r?.avatar ? `<img class="av" src="/avatar/${esc(r.id)}?v=${r.avatar}" alt="" width="${size}" height="${size}">` : icon(ic, size);
};
const taskStatus = (t) => (!t.end ? "running" : t.ok ? "finished" : "failed");
const liveClass = (t) => (!t.end ? "run" : t.ok ? "" : "off");
const shortCwd = (c) => String(c || "").replace(/^\/home\/[^/]+/, "~");
const paneKey = (p) => (p ? `${p.kind}:${p.id}` : "");
const rekey = (from, to) => { for (const l of orchLinks) { if (l.a === from) l.a = to; if (l.b === from) l.b = to; } };
const cwdLabel = (c) => (c ? shortCwd(c) : `Vault (${D?.vault || "vault"})`);

const CANVAS_TOP = 60; // the strip at the top of the canvas where the ☰ button, the Fleet pill and the tools float
const CANVAS_BGS = [
  ["dots", "Dots", "Classic dot matrix", 22],
  ["sparse", "Calm", "Wide soft dots", 44],
  ["grid", "Grid", "Fine hairline grid", 32],
  ["plain", "Solid", "Clean matte surface", 0],
  ["ambient", "Ambient", "Translucent glass", 0],
];
const VALID_BGS = new Set(CANVAS_BGS.map(([k]) => k));
const bgEntry = (k) => CANVAS_BGS.find(([id]) => id === k) || CANVAS_BGS[0];
let orchRole = "", orchCwd = "", orchMode = "free", orchDir = "cols", orchRatio = 50, orchBg = "dots",
  orchPanX = 24, orchPanY = CANVAS_TOP, orchZoom = 1, orchPanes = [], orchSelected = new Set(), orchActive = "", orchMax = "", orchTool = "select",
  orchRail = true, orchRailMode = "float", orchDeckOpen = false, orchMapOpen = true, orchExtra = new Set(), orchTimer = null, orchSigs = new Map(), orchSeq = 1;
let drawing = null; // a card being drawn: { kind, layer, sheet } (drawCard)
let cwdOpen = false, cwdBrowse = "~/dev", cwdQuery = "", cwdData = null, cwdPaneKey = "", cwdItems = [], cwdIdx = 0, cwdStart = "";
// Folders picked in the folder popover, latest first: they head its Recent list.
const RECENT_CWDS = "overlook.recent-cwds";
const recentCwds = () => { try { return JSON.parse(localStorage.getItem(RECENT_CWDS) || "[]"); } catch { return []; } };
orchCwd = recentCwds()[0] || ""; // Ctrl+Alt+N and the task bar start in the last folder you picked
// Canvas links: { a, b } means card a's content goes along as context when you message card b.
let orchLinks = [], orchNoteQ = "";
const CANVAS_KEY = "overlook.canvas", CANVAS_BG_KEY = "overlook.canvas-bg", PANE_MIME = "text/x-overlook-pane";
const DISMISSED_KEY = "overlook:dismissed-sessions";
let dismissedSessions = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")); } catch { return new Set(); }
})();
function saveDismissedSessions() {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedSessions])); } catch {}
}
try {
  orchRailMode = localStorage.getItem("overlook.rail-mode") || "float";
} catch {}
function saveRailMode() {
  try { localStorage.setItem("overlook.rail-mode", orchRailMode); } catch {}
}
try {
  const savedBg = localStorage.getItem(CANVAS_BG_KEY);
  if (savedBg && VALID_BGS.has(savedBg)) orchBg = savedBg;
  const c = JSON.parse(localStorage.getItem(CANVAS_KEY) || "null");
  if (c) {
    orchPanes = c.panes || [];
    orchLinks = c.links || [];
    // The canvas is the default layout; a split is kept only when it was chosen after that change (layout: 2).
    orchMode = c.mode === "tile" && c.layout === 2 ? "tile" : "free";
    orchPanX = c.panX ?? 24;
    orchPanY = c.panY ?? CANVAS_TOP;
    orchZoom = c.zoom || 1;
    orchSeq = c.seq || 1;
    if (c.railMode) orchRailMode = c.railMode;
    if (c.bg && VALID_BGS.has(c.bg)) orchBg = c.bg;
    orchMapOpen = c.map ?? true;
    // Where you were: the focused and maximized card, the split direction and divider.
    orchActive = c.active || ""; orchMax = c.max || "";
    if (c.dir) orchDir = c.dir;
    if (c.ratio) orchRatio = c.ratio;
  }
} catch {}
// The server only lets terminals talk across wires it knows (agent hand-off): send the terminal↔terminal wires and
// the cards' names whenever they change.
let wiresSent = "", wiresAt = 0;
// One id per browser, so the server keeps each open canvas's wires apart (see setWires).
const CANVAS_CLIENT = (() => { try { let id = localStorage.getItem("overlook.client"); if (!id) localStorage.setItem("overlook.client", (id = crypto.randomUUID())); return id; } catch { return crypto.randomUUID(); } })();
function syncWires(force) {
  const term = (k) => (k.startsWith("terminal:") ? k.slice(9) : "");
  const wires = orchLinks.map((l) => [term(l.a), term(l.b)]).filter(([a, b]) => a && b);
  const names = Object.fromEntries(orchPanes.filter((p) => p.kind === "terminal").map((p) => [p.id, termName(p)]));
  // Whatever is wired to a terminal (either way round: notes, vault notes, other terminals) is context for the agent in
  // it; the server hands it over (deliverWired in tasks.ts).
  const ctx = {};
  for (const l of orchLinks) for (const [t, o] of [[l.a, l.b], [l.b, l.a]]) {
    const p = term(t) && orchPanes.find((x) => paneKey(x) === o), add = (item) => (ctx[term(t)] ||= []).push({ key: o, name: paneLabel(p), ...item });
    if (p?.kind === "sticky") add({ text: p.text || "" });
    if (p?.kind === "note") add({ path: p.id });
    if (p?.kind === "terminal") add({ term: p.id });
  }
  const sketch = sketchText(sketchEls), body = JSON.stringify({ wires, names, ctx, sketch });
  if (body === wiresSent && !force) return;
  wiresSent = body; wiresAt = Date.now();
  api("/api/canvas/wires", { client: CANVAS_CLIENT, wires, names, ctx, sketch }).catch(() => { wiresSent = ""; });
}
// A TUI's window title leads with a spinner or status glyph ("✳ Fix the build"): the name is what follows it.
const termName = (p) => p.name || (terms.get(p.id)?.title || "").replace(/^[^\p{L}\p{N}]+/u, "") || (p.run ? runnerName(p.run.agent) : `Terminal ${p.shell || ""}`.trim());
// The wheel fires 60+ times a second: save once it stops, not on every step.
let saveT = 0;
const saveCanvasSoon = () => { clearTimeout(saveT); saveT = setTimeout(saveCanvas, 250); };
function saveCanvas() {
  syncWires();
  try {
    localStorage.setItem(CANVAS_BG_KEY, orchBg);
    localStorage.setItem(CANVAS_KEY, JSON.stringify({ panes: orchPanes.map(({ ctx, ...p }) => p), links: orchLinks, mode: orchMode, layout: 2, panX: orchPanX, panY: orchPanY, zoom: orchZoom, seq: orchSeq, railMode: orchRailMode, bg: orchBg, map: orchMapOpen, active: orchActive, max: orchMax, dir: orchDir, ratio: orchRatio }));
  } catch {}
}
function setCanvasBg(v, silent = false) {
  orchBg = VALID_BGS.has(v) ? v : "dots";
  saveCanvas();
  applyCanvasTransform();
  paintHud($("#orch-hud"), orchMode === "free" && !orchMax);
  if (!silent) toast(`Canvas background: ${bgEntry(orchBg)[1]}`);
}
function cycleCanvasBg() {
  const idx = CANVAS_BGS.findIndex(([k]) => k === orchBg);
  const next = CANVAS_BGS[(idx + 1) % CANVAS_BGS.length][0];
  setCanvasBg(next);
}
// Canvas terminal panes: xterm.js (the terminal of VS Code) on a real PTY (/ws/pty), in the user's Ghostty colors and font.
// p.run picks what the PTY runs: { task } / { key } resumes an agent session's TUI, { agent, prompt } starts one, none = a shell.
// (ghostty-web was dropped: its WASM core corrupted rows on a column resize of a colourful screen — a prompt line per
// resize — and could fault. xterm.js reflows like a native terminal, and its DOM text stays crisp at any canvas zoom.)
let termLib, termBg = ""; // termBg: the Ghostty theme background, also the terminal window's color
const termLoad = () => (termLib ??= Promise.all([
  import("/vendor/xterm.mjs"),
  api("/api/ghostty-theme").catch(() => ({})),
  document.fonts?.load?.("16px 'JetBrainsMono Nerd Font Mono'").catch(() => {}),
]).then((r) => {
  if (!$("#xterm-css")) document.head.insertAdjacentHTML("beforeend", '<link id="xterm-css" rel="stylesheet" href="/vendor/xterm.css">');
  return r;
}).catch((e) => { termLib = null; throw e; }));
const terms = new Map(); // pane id -> { el, term, fit, ws, title, dead }
// `at`: canvas coordinates (a right-click), or a drawn rect {x, y, w, h}: the card opens there and the view stays put.
// `extra`: more fields for the card (a name).
function newTermPane(cwd, at, extra) {
  const p = { kind: "terminal", id: `term_${Date.now()}`, shell: prefShell || "", cwd: cwd || $("#run-cwd")?.value || orchCwd || "", ...extra };
  if (addAt(p, at)) { saveCanvas(); if (orchMode === "free") focusPane(paneKey(p), !!at); }
}
// Turns a pane into a terminal running the agent's own TUI, in place (same spot, size and links); a pane for a session
// that already has its terminal on the canvas just goes.
function tuiInPlace(p, run) {
  const old = paneKey(p), twin = orchPanes.find((x) => x !== p && x.kind === "terminal" && x.run && ((run.task && x.run.task === run.task) || (run.key && x.run.key === run.key)));
  if (twin) { orchPanes = orchPanes.filter((x) => x !== p); rekey(old, paneKey(twin)); if (orchActive === old) orchActive = paneKey(twin); return; }
  Object.assign(p, { kind: "terminal", id: `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, run });
  rekey(old, paneKey(p));
  if (orchActive === old) orchActive = paneKey(p);
  if (orchMax === old) orchMax = paneKey(p);
}
function paneToTui(p, run) { tuiInPlace(p, run); saveCanvas(); orchSigs.clear(); agentsBody(); }
// A new agent is a terminal running it (in the bar's folder); one without a TUI opens a shell.
function newAgentTerm(agent, at, extra) {
  if (!S.runners?.find((r) => r.id === agent)?.tui) return newTermPane(undefined, at, extra);
  const p = { kind: "terminal", id: `term_${Date.now()}`, cwd: $("#run-cwd")?.value || orchCwd || "", run: newTuiRun(agent), ...extra };
  if (addAt(p, at)) { saveCanvas(); if (orchMode === "free") focusPane(paneKey(p), !!at); }
}
const defaultAgent = () => [$("#run-agent")?.value, "claude", ...(S.runners || []).map((r) => r.id)].find((id) => S.runners?.find((r) => r.id === id)?.tui);
// A new agent TUI: claude gets --session-id up front so the pane can resume it later.
const newTuiRun = (agent, prompt, model, effort) => ({ agent, session: crypto.randomUUID(), fresh: "1", ...(prompt ? { prompt } : {}), ...(model ? { model } : {}), ...(effort ? { effort } : {}) });
function termConnect(st, p) {
  const q = new URLSearchParams({ id: p.id, cols: st.term.cols, rows: st.term.rows });
  for (const [k, v] of Object.entries(p.run || { shell: p.shell })) if (v) q.set(k, v);
  if (p.cwd) q.set("cwd", p.cwd);
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/pty?${q}`);
  // The first prompt runs once: from now on the pane resumes its session (see ptySpec).
  ws.onopen = () => { if (p.run?.fresh) { delete p.run.fresh; delete p.run.prompt; delete p.run.model; delete p.run.effort; saveCanvas(); } };
  ws.onmessage = (e) => st.term.write(e.data);
  const note = (m) => st.term.write(`\r\n\x1b[2m[${m}]\x1b[0m\r\n`);
  ws.onclose = async (e) => {
    if (st.ws !== ws || terms.get(p.id) !== st) return; // a restarted card has a new one under the same id
    st.ws = null;
    // The shell ended (`exit`, Ctrl+D): the card closes, like a terminal window does.
    if (e.code === 4001) {
      orchPanes = orchPanes.filter((x) => !(x.kind === "terminal" && x.id === p.id));
      termClose(p.id); saveCanvas(); orchSigs.clear(); agentsBody();
      return;
    }
    // A drop after it worked (Overlook restarting, the network): reconnect quietly, like a terminal that just keeps
    // going; the server replays the screen (or resumes the session), onto a clean screen.
    if (st.opened && (st.retry ?? 0) < 6) {
      setTimeout(() => { if (terms.get(p.id) === st && !st.ws) { st.term.reset(); termConnect(st, p); } }, Math.min(8000, 400 * 2 ** ++st.retry));
      return;
    }
    // Refused (session expired or busy, agent gone): the browser can't read why, so ask.
    st.dead = true;
    const why = await fetch(`/api/pty/check?${q}`).then((r) => (r.ok ? "" : r.text())).catch(() => "");
    note(`${why || "can't reach Overlook"} · press Enter to retry`);
  };
  ws.addEventListener("open", () => { st.opened = true; st.dead = false; st.retry = 0; });
  st.ws = ws;
}
const termSend = (st, d) => {
  if (st.ws?.readyState === 1) st.ws.send(d);
  // The server replays the PTY's history on connect: start from a clean screen, or everything shows twice.
  else if (st.dead && d === "\r") { st.dead = false; st.retry = 0; st.term.reset(); termConnect(st, orchPanes.find((x) => x.kind === "terminal" && terms.get(x.id) === st)); }
};

function termClose(id) {
  const st = terms.get(id);
  if (!st) return;
  terms.delete(id);
  st.ws?.close();
  st.ro?.disconnect();
  st.term?.dispose();
  return api("/api/pty/close", { id }).catch(() => {});
}
// What a terminal pane shows (its rendered screen plus recent scrollback), as plain text for linked context.
function termText(id, max = 80) {
  const b = terms.get(id)?.term?.buffer?.active;
  if (!b) return "";
  const out = [];
  for (let i = Math.max(0, b.length - 400); i < b.length; i++) out.push(b.getLine(i)?.translateToString(true) ?? "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().split("\n").slice(-max).join("\n");
}
// The composer under an agent terminal: pasted (bracketed, so a multi-line prompt stays one message), then Enter.
function termPrompt(id, text) {
  const st = terms.get(id);
  if (!st?.ws || st.ws.readyState !== 1) return false;
  st.term.paste(text);
  setTimeout(() => termSend(st, "\r"), 60);
  return true;
}
// An idle agent session opens as the agent's own TUI (a terminal card), like in Maestri; one that is running
// somewhere else keeps the read-only transcript card. Returns false when it isn't a TUI case.
function openTui(item) {
  const run = fleetItems().find((x) => x.kind === item.kind && x.id === item.id)?.tui;
  if (!run) return false;
  const have = orchPanes.find((p) => p.kind === "terminal" && p.run && ((run.task && p.run.task === run.task) || (run.key && p.run.key === run.key)));
  if (have) { focusPane(paneKey(have)); return true; }
  if (!makeRoom()) return true;
  addPane({ kind: "terminal", id: `term_${Date.now()}`, run });
  saveCanvas();
  return true;
}
// Brings a card into view (centered on the free canvas, at the current zoom), focuses it and flashes it.
// stay: the card is already where you look (opened at a right-click): focus it without moving the view.
function focusPane(k, stay = false) {
  const p = orchPanes.find((x) => paneKey(x) === k);
  if (!p) return;
  orchActive = k;
  if (orchMax) orchMax = k;
  const r = $("#orch-canvas")?.getBoundingClientRect();
  if (!stay && orchMode === "free" && !orchMax && r && typeof p.x === "number") {
    orchPanX = Math.round(r.width / 2 - (p.x + p.w / 2) * orchZoom);
    orchPanY = Math.round(CANVAS_TOP + (r.height - CANVAS_TOP) / 2 - (p.y + p.h / 2) * orchZoom);
  }
  saveCanvas(); orchSigs.clear(); orchPaint(true);
  setTimeout(() => {
    const card = $(`.orch-pane[data-key="${CSS.escape(k)}"]`);
    card?.classList.add("pane-flash"); setTimeout(() => card?.classList.remove("pane-flash"), 700); // not "flash": the Home's card uses that name
    const st = p.kind === "terminal" && terms.get(p.id);
    if (st?.term) st.term.focus(); else card?.querySelector(".orch-msg:not([disabled])")?.focus();
  }, 60);
}
// Every path that drops a terminal pane (replace, split, cap, routine…) ends here: its PTY must not live on unseen.
function reapTerms() {
  for (const id of [...terms.keys()]) if (!orchPanes.some((p) => p.kind === "terminal" && p.id === id)) termClose(id);
}

async function mountTerminalPane(card, p) {
  const feed = card.querySelector(".orch-feed");
  if (!feed) return;
  let st = terms.get(p.id);
  if (!st) {
    st = { el: document.createElement("div") };
    st.el.className = "orch-term-view";
    terms.set(p.id, st);
    st.ready = termLoad().then(([x, look]) => {
      if (terms.get(p.id) !== st) return; // closed while loading
      const theme = look.theme || {};
      termBg = theme.background || termBg;
      if (termBg) st.el.closest(".orch-pane")?.style.setProperty("--win-bg", termBg);
      st.font0 = Math.round((look.fontSize || 12) * 4 / 3); // Ghostty sizes are points; its default is 12
      st.term = new x.Terminal({
        // Ghostty ships JetBrains Mono plus Nerd Font symbols built in; a browser needs them installed (prompt icons).
        fontFamily: `${look.fontFamily ? `"${look.fontFamily}", ` : ""}"JetBrainsMono Nerd Font Mono", "JetBrains Mono", "Symbols Nerd Font Mono", monospace`,
        fontSize: p.fontSize || st.font0, // p.fontSize: this card's own size, from its right-click menu
        cursorStyle: ["block", "underline"].includes(look.cursorStyle) ? look.cursorStyle : "bar", // Ghostty shows a bar at a prompt
        cursorBlink: false, scrollback: 10000, allowProposedApi: true,
        // The card paints the window (95% over a blur, like Ghostty under Hyprland): the terminal itself is see-through.
        allowTransparency: true, theme: { ...theme, background: "#00000000" },
      });
      // Fit: as many whole cells as the box holds inside xterm's padding. (FitAddon also kept 14px for a scrollbar, but
      // xterm 6's scrollbar floats over the text: that left a wide empty band on the right.)
      // The space left over by whole cells is shared out evenly around them, like Ghostty's balanced padding.
      const PX = 12, PY = 10;
      st.fit = { fit: () => {
        const cell = st.term?._core?._renderService?.dimensions?.css?.cell;
        // a hidden box (minimized card, maximized neighbour) measures 0: keep the size, or the PTY shrinks to 2x1 and
        // the scrollback rewraps to 2 columns for good
        if (!cell?.width || !cell?.height || !st.term.element || !st.el.clientWidth || !st.el.clientHeight) return;
        const w = st.el.clientWidth - 2 * PX, h = st.el.clientHeight - 2 * PY;
        const cols = Math.max(2, Math.floor(w / cell.width)), rows = Math.max(1, Math.floor(h / cell.height));
        const rx = Math.max(0, w - cols * cell.width) / 2, ry = Math.max(0, h - rows * cell.height) / 2;
        st.term.element.style.padding = `${PY + Math.floor(ry)}px ${PX + Math.ceil(rx)}px ${PY + Math.ceil(ry)}px ${PX + Math.floor(rx)}px`;
        if (cols !== st.term.cols || rows !== st.term.rows) st.term.resize(cols, rows);
      } };
      st.term.open(st.el);
      // The canvas zooms with a CSS scale: xterm turns a click into a cell from the scaled box but unscaled cells, so at
      // 60% a click landed rows below the pointer. Its mouse service (selection, links, mouse reporting) gets the point
      // mapped back into the terminal's own units first.
      // ponytail: xterm's private _mouseService; if an update renames it, clicks are off at zoom again, nothing breaks.
      const ms = st.term._core?._mouseService;
      if (ms) {
        const unscaled = (e, el) => {
          const r = el.getBoundingClientRect(), k = el.offsetWidth ? r.width / el.offsetWidth : 1;
          return Math.abs(k - 1) < 1e-3 ? e : { clientX: r.left + (e.clientX - r.left) / k, clientY: r.top + (e.clientY - r.top) / k };
        };
        const coords = ms.getCoords.bind(ms), report = ms.getMouseReportCoords.bind(ms);
        ms.getCoords = (e, el, ...rest) => coords(unscaled(e, el), el, ...rest);
        ms.getMouseReportCoords = (e, el) => report(unscaled(e, el), el);
      }
      st.fit.fit();
      // Resize once the size settles (end of a drag), not every frame: each resize is a SIGWINCH and a prompt redraw.
      st.ro = new ResizeObserver(() => { clearTimeout(st.rt); st.rt = setTimeout(() => st.fit?.fit(), 70); });
      st.ro.observe(st.el);
      document.fonts?.ready.then(() => st.fit?.fit()); // cell size changes when the real font arrives
      st.term.onData((d) => termSend(st, d));
      st.term.onResize(({ cols, rows }) => termSend(st, "\0" + JSON.stringify({ cols, rows })));
      st.term.onTitleChange((t) => { if (!t) return; st.title = t; syncWires(); });
      // Ctrl+Shift+C / V copy and paste (Ctrl+C stays the shell's interrupt); Ctrl/Alt + wheel zooms the canvas.
      st.term.attachCustomKeyEventHandler((e) => {
        // Delete closes the card on the free canvas (after the confirm), even while typing in it: the shell loses forward-delete.
        if (e.type === "keydown" && e.key === "Delete" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && orchMode === "free" && !orchMax) {
          const k = paneKey(p);
          if (!orchSelected.has(k)) { orchSelected.clear(); orchSelected.add(k); updateSelectionUI(); }
          deleteSelectedPanes();
          return false;
        }
        if (e.type !== "keydown" || !e.ctrlKey || !e.shiftKey || e.altKey) return true;
        if (e.code === "KeyC") { const sel = st.term.getSelection(); if (sel) navigator.clipboard?.writeText(sel).catch(() => {}); return false; }
        if (e.code === "KeyV") { navigator.clipboard?.readText().then((t) => t && st.term.paste(t)).catch(() => {}); return false; }
        return true;
      });
      st.term.attachCustomWheelEventHandler((e) => !(e.ctrlKey || e.altKey));
      // Which card has the keyboard: a ring and a blinking cursor on that one only.
      st.el.addEventListener("focusin", () => {
        const pane = st.el.closest(".orch-pane");
        if (pane) {
          pane.classList.add("typing", "active");
          orchActive = pane.dataset.key || paneKey(p);
          $("#orch-plane")?.querySelectorAll(".orch-pane").forEach((n) => { if (n !== pane) n.classList.remove("active"); });
        }
        st.term.options.cursorBlink = true;
      });
      st.el.addEventListener("focusout", () => { st.el.closest(".orch-pane")?.classList.remove("typing"); st.term.options.cursorBlink = false; });
    });
  }
  if (st.el.parentNode !== feed) { feed.innerHTML = ""; feed.appendChild(st.el); }
  try { await st.ready; } catch { if (terms.get(p.id) === st) terms.delete(p.id); return; } // load failed: the next paint retries
  if (terms.get(p.id) !== st || !st.term) return; // closed while loading
  st.fit.fit();
  if (!st.ws) termConnect(st, p);
  if (!st.mounted) {
    st.mounted = true;
    if (orchActive === paneKey(p) && !document.activeElement?.closest?.(".orch-talk, input, textarea:not(.xterm-helper-textarea)")) st.term.focus();
  }
}

let termList = [], shellList = [], prefTerm = "", prefShell = "";
try { prefTerm = localStorage.getItem("overlook.terminal") || ""; } catch {}
try { prefShell = localStorage.getItem("overlook.shell") || ""; } catch {}

async function loadTerminals() {
  try {
    const data = await api("/api/terminals");
    termList = data.terminals || [];
    shellList = data.shells || [];
    if (!prefTerm) prefTerm = data.defaultTerminal || (termList[0]?.id || "ghostty");
    if (!prefShell) prefShell = data.defaultShell || "";
  } catch {}
}

function updateSelectionUI() {
  const plane = $("#orch-plane");
  if (plane) {
    plane.querySelectorAll(".orch-pane").forEach((n) => {
      n.classList.toggle("selected", orchSelected.has(n.dataset.key));
    });
  }
  const badge = $("#orch-sel-cnt"), delBtn = $("#orch-del-sel");
  if (badge) {
    badge.hidden = orchSelected.size < 2;
    badge.textContent = `${orchSelected.size} selected`;
  }
  if (delBtn) delBtn.hidden = orchSelected.size < 2;
}
// Closing a terminal pane stops what runs in it (a shell, a claude session mid-turn): ask first.
async function closeLiveOk(keys) {
  const n = keys.map((k) => orchPanes.find((p) => paneKey(p) === k)).filter((p) => p?.kind === "terminal").length; // its PTY may run with the socket down
  return !n || askOk(n === 1 ? "Close this terminal?" : `Close ${n} terminals?`, `What runs in ${n === 1 ? "it" : "them"} will be stopped.`, n === 1 ? "Close terminal" : `Close ${n} terminals`);
}
// The app's own confirm: the browser's confirm() is unstyled and drops full screen. Enter confirms, Esc cancels.
function askOk(msg, sub, ok) {
  const d = $("#ask");
  $("#ask-msg").textContent = msg; $("#ask-sub").textContent = sub; $("#ask-ok").textContent = ok;
  d.returnValue = ""; d.showModal(); $("#ask-ok").focus();
  return new Promise((res) => d.addEventListener("close", () => res(d.returnValue === "ok"), { once: true }));
}
async function deleteSelectedPanes() {
  if (!orchSelected.size || !(await closeLiveOk([...orchSelected]))) return;
  const count = orchSelected.size;
  for (const k of orchSelected) {
    const pane = orchPanes.find((p) => paneKey(p) === k);
    if (pane && pane.kind === "terminal") termClose(pane.id);
  }
  orchPanes = orchPanes.filter((p) => !orchSelected.has(paneKey(p)));
  orchLinks = orchLinks.filter((l) => !orchSelected.has(l.a) && !orchSelected.has(l.b));
  if (orchSelected.has(orchActive)) orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
  orchSelected.clear();
  updateSelectionUI();
  toast(`Closed ${count} selected pane${count > 1 ? "s" : ""}`);
  saveCanvas();
  orchSigs.clear();
  agentsBody();
  orchPaint(true);
}


// `start`: the popover is opening here (an empty field, Recent shown while you stay in this folder).
async function loadCwdBrowser(path = cwdBrowse, start = false) {
  const d = await api(`/api/dirs?path=${encodeURIComponent(path || "~/dev")}`).catch(() => null);
  if (d || !cwdData) { cwdBrowse = path || "~/dev"; cwdData = d; } // a path that isn't there keeps you where you are
  if (start) { cwdPath.key = null; cwdStart = cwdData?.short ?? ""; cwdQuery = ""; cwdIdx = 0; const inp = $("#cwd-q"); if (inp) inp.value = ""; }
  paintCwdPop();
}
// A typed path completes like a shell: "~/dev/pla" lists ~/dev (fetched live) filtered by "pla".
// cwdSplit: [the folder to list, what Tab keeps before the name, the partial name].
const cwdSplit = (v) => { const i = v.lastIndexOf("/"); return i < 0 ? [v, `${v}/`, ""] : [v.slice(0, i) || "/", v.slice(0, i + 1), v.slice(i + 1)]; };
const isCwdPath = (v) => /^[~/]/.test(v);
let cwdPath = { key: null, data: null }, cwdPathT = 0;
function cwdPathLoad() {
  const v = cwdQuery.trim();
  if (!isCwdPath(v)) return;
  const [d] = cwdSplit(v);
  clearTimeout(cwdPathT);
  if (d === cwdPath.key) return;
  cwdPathT = setTimeout(async () => {
    const data = await api(`/api/dirs?path=${encodeURIComponent(d)}`).catch(() => null);
    if (cwdSplit(cwdQuery.trim())[0] !== d) return; // typed on meanwhile
    cwdPath = { key: d, data }; cwdIdx = 0; paintCwdPop();
  }, 120);
}
let lastCwdBtn = null;
// The popover opens under the button that asked for it (or above it, near the bottom of the screen).
function placeCwdPop(btn = lastCwdBtn) {
  const pop = $("#cwd-pop");
  if (!pop || pop.hidden) return;
  if (pop.parentElement !== document.body) document.body.appendChild(pop);
  const target = btn || $("#run-cwd-btn");
  if (!target) return;
  const br = target.getBoundingClientRect?.() ?? { left: target.x, right: target.x, top: target.y, bottom: target.y, width: 0 };
  const w = Math.min(440, window.innerWidth - 24);
  pop.style.width = `${w}px`;
  const h = pop.offsetHeight || 340;
  let left = br.left + (br.width / 2) - (w / 2);
  left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
  let top = br.bottom + 6;
  if (top + h > window.innerHeight - 12) {
    top = Math.max(12, br.top - h - 6);
  }
  pop.style.position = "fixed";
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.style.right = "auto";
  pop.style.bottom = "auto";
  pop.style.zIndex = "999";
}
// One field, one list: recent folders (where you start), the folders here, the vault. ↑/↓ walk it, Enter picks,
// Tab goes into a folder, Backspace on an empty field goes up, a path (~/…, /…) + Enter goes there.
function paintCwdPop() {
  const pop = $("#cwd-pop");
  if (!pop) return;
  pop.hidden = !cwdOpen;
  if (!cwdOpen) sheetCwd();
  if (!cwdOpen || !cwdData) return;
  requestAnimationFrame(() => placeCwdPop(lastCwdBtn));
  // "planeit" finds plane-it-frontend: case, accents and separators don't count.
  const norm = (x) => fold(x).replace(/[^\p{L}\p{N}]/gu, ""), q = norm(cwdQuery.trim()), hit = (...t) => !q || t.some((x) => norm(x).includes(q));
  const base = (c) => c.split("/").filter(Boolean).pop() || c, dir = (c) => c.replace(/\/[^/]+\/?$/, "");
  const atStart = cwdData.short === cwdStart;
  const recent = atStart ? [...new Set([...recentCwds(), ...[...(S.agents || []), ...(S.background || []), ...(S.tasks || [])].map((x) => shortCwd(x.cwd))])].filter((c) => c && c !== "~" && c !== cwdData.short && hit(c)).slice(0, 5) : [];
  const pv = isCwdPath(cwdQuery.trim()) && cwdSplit(cwdQuery.trim()), pd = pv && cwdPath.key === pv[0] ? cwdPath.data : undefined;
  if (pv) {
    const [, pre, part] = pv, pq = norm(part), rank = (n) => (n === part) * 2 + n.startsWith(part); // exact, then prefix, then the rest
    cwdItems = !pd ? [] : [
      ...(!part ? [{ ic: "check", name: "This folder", sub: pd.short, path: pd.short }] : []),
      ...pd.dirs.filter((d) => !pq || norm(d.name).includes(pq)).sort((a, b) => rank(b.name) - rank(a.name))
        .map((d) => ({ ic: "folder", name: d.name, path: d.short, nav: d.path, fill: `${pre}${d.name}/` })),
    ];
  } else cwdItems = [
    ...(!atStart && !q ? [{ ic: "check", name: "This folder", sub: cwdData.short, path: cwdData.short }] : []),
    ...recent.map((c) => ({ ic: "clock", name: base(c), sub: dir(c), path: c, nav: c })),
    ...(cwdData.dirs || []).filter((d) => !recent.includes(d.short) && hit(d.name)).map((d) => ({ ic: "folder", name: d.name, path: d.short, nav: d.path })),
    ...(q ? (cwdData.deep || []).filter((d) => !recent.includes(d.short) && hit(d.name)).slice(0, 30).map((d) => ({ ic: "folder", name: d.name, sub: dir(d.short), path: d.short, nav: d.path })) : []),
    ...(hit("vault", D.vault || "") ? [{ ic: "book", name: "Vault", sub: D.vault, path: "" }] : []),
  ];
  cwdIdx = Math.min(cwdIdx, Math.max(0, cwdItems.length - 1));
  if (!pop.querySelector("#cwd-q")) {
    pop.innerHTML = `<input id="cwd-q" class="cwd-q" type="text" autocomplete="off" spellcheck="false" aria-label="Filter folders or type a path">
      <div class="cwd-list" id="cwd-list" role="listbox"></div>
      <div class="cwd-foot" id="cwd-foot"></div>`;
    const inp = pop.querySelector("#cwd-q");
    inp.oninput = () => { cwdQuery = inp.value; cwdIdx = 0; cwdPathLoad(); paintCwdPop(); };
    inp.onkeydown = (e) => {
      const it = cwdItems[cwdIdx], v = inp.value.trim();
      if (e.key === "Escape") { e.preventDefault(); cwdOpen = false; paintCwdPop(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        cwdIdx = (cwdIdx + (e.key === "ArrowDown" ? 1 : -1) + cwdItems.length) % (cwdItems.length || 1);
        paintCwdPop(); $("#cwd-list .on")?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (it) pickCwd(it.path);
        else if (isCwdPath(v)) cwdGo(v); // the list hasn't loaded yet
      } else if (e.key === "Tab" && it?.fill) { e.preventDefault(); inp.value = it.fill; inp.oninput(); }
      else if (e.key === "Tab" && it?.nav && !isCwdPath(v)) { e.preventDefault(); cwdGo(it.nav); }
      else if (e.key === "Tab") e.preventDefault();
      else if (e.key === "Backspace" && !inp.value && cwdData.parent) { e.preventDefault(); cwdGo(cwdData.parent); }
    };
  }
  pop.querySelector("#cwd-q").placeholder = "Choose a folder…";
  $("#cwd-list").innerHTML = cwdItems.map((it, i) => `<div class="cwd-row ${i === cwdIdx ? "on" : ""}" role="option" aria-selected="${i === cwdIdx}">
      <button type="button" class="cwd-open" data-act="cwd-pick" data-path="${esc(it.path)}" title="${esc(it.path || D.vault)}">${icon(it.ic, 15)}<b>${esc(it.name)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</button>
      ${it.nav ? `<button type="button" class="cwd-in" data-act="cwd-nav" data-path="${esc(it.nav)}" title="Go inside (Tab)" aria-label="Go inside ${esc(it.name)}">${icon("r", 14)}</button>` : ""}
    </div>`).join("") || `<p class="cwd-empty">${!pv ? `Nothing matches "${esc(cwdQuery)}". Type a path, like ~/projects.` : pd === undefined ? "…" : pd === null ? `${esc(pv[0])} doesn't exist` : `Nothing in ${esc(pd.short)} matches "${esc(pv[2])}"`}</p>`;
  $("#cwd-foot").innerHTML = `${cwdData.parent ? `<button type="button" class="cwd-up" data-act="cwd-nav" data-path="${esc(cwdData.parent)}" title="Up (Backspace)" aria-label="Parent folder">${icon("l", 13)}</button>` : ""}<span class="cwd-where">${esc(pv ? pd?.short ?? pv[0] : cwdData.short)}</span><span class="cwd-keys">↵ open · Tab ${pv ? "complete" : "inside"} · Esc</span>`;
}
function cwdGo(path) {
  cwdQuery = ""; cwdIdx = 0;
  const inp = $("#cwd-q"); if (inp) { inp.value = ""; inp.focus(); }
  loadCwdBrowser(path);
}
function pickCwd(val) {
  if (val) try { localStorage.setItem(RECENT_CWDS, JSON.stringify([val, ...recentCwds().filter((c) => c !== val)].slice(0, 8))); } catch {}
  if (cwdPaneKey) {
    const p = orchPanes.find((x) => paneKey(x) === cwdPaneKey);
    if (p) { p.cwd = val; orchSigs.delete(cwdPaneKey); }
  } else {
    orchCwd = val;
    const inp = $("#run-cwd"), lbl = $("#run-cwd-lbl");
    if (inp) inp.value = val;
    if (lbl) lbl.textContent = cwdLabel(val);
  }
  cwdOpen = false; cwdPaneKey = "";
  paintCwdPop();
  orchPaint(true);
}

const mdCache = new Map();
async function stickyShow(view, ta, text = "") {
  const empty = !text.trim();
  view.hidden = empty; ta.hidden = !empty;
  if (empty) return;
  if (!mdCache.has(text)) {
    const html = (await api("/api/md", { text }).catch(() => null))?.html;
    if (html == null) { view.hidden = true; ta.hidden = false; return; } // server down: plain text still works
    if (mdCache.size > 200) mdCache.clear();
    mdCache.set(text, html);
  }
  if (document.activeElement !== ta) { view.innerHTML = mdCache.get(text); view.querySelectorAll("a[href^='http']").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; }); }
}

// The real Excalidraw, bundled by the server on first use (/vendor/excalidraw.js).
let excalidrawLib = null;
const loadExcalidraw = () => (excalidrawLib ??= (async () => {
  window.EXCALIDRAW_ASSET_PATH = `${location.origin}/vendor/excalidraw/`;
  document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="/vendor/excalidraw/index.css">`);
  return import("/vendor/excalidraw.js");
})().catch((e) => { excalidrawLib = null; throw e; }));
// What the sketch says, for an agent (overlook sketch): its texts, and which labelled shapes the arrows join.
function sketchText(els) {
  const byId = new Map(els.map((x) => [x.id, x]));
  const label = (x) => x && (x.type === "text" ? x.text : els.find((y) => y.type === "text" && y.containerId === x.id)?.text || x.type);
  const lines = els.filter((x) => x.type === "text" && !x.containerId).map((x) => `- ${x.text.replace(/\n/g, " ")}`);
  for (const x of els) if (x.type === "rectangle" || x.type === "ellipse" || x.type === "diamond") { const t = label(x); if (t !== x.type) lines.push(`- [${x.type}] ${t.replace(/\n/g, " ")}`); }
  for (const x of els) if (x.type === "arrow" && (x.startBinding || x.endBinding)) {
    lines.push(`- ${label(byId.get(x.startBinding?.elementId)) || "?"} → ${label(byId.get(x.endBinding?.elementId)) || "?"}`.replace(/\n/g, " "));
  }
  // What has no words (strokes, empty shapes) still says where the user marked: by the card it's on or nearest to.
  const where = new Map();
  for (const x of els) {
    if (x.type === "text" || x.type === "arrow" || x.containerId || (label(x) !== x.type && x.type !== "freedraw")) continue;
    const cx = x.x + (x.width || 0) / 2, cy = x.y + (x.height || 0) / 2;
    const near = orchPanes.filter((p) => typeof p.x === "number").map((p) => ({ p, d: Math.hypot(Math.max(p.x - cx, 0, cx - p.x - p.w), Math.max(p.y - cy, 0, cy - p.y - p.h)) })).sort((a, b) => a.d - b.d)[0];
    const at = near && near.d < 200 ? `${near.d === 0 ? "on" : "next to"} card "${paneLabel(near.p)}"` : "on the open canvas";
    const kind = x.type === "freedraw" ? "freehand stroke" : `empty ${x.type}`, k = `${kind}|${at}`;
    where.set(k, (where.get(k) || 0) + 1);
  }
  for (const [k, n] of where) { const [kind, at] = k.split("|"); lines.push(`- ${n} ${kind}${n > 1 ? "s" : ""} ${at}`); }
  return lines.join("\n");
}

// The sketch layer (Maestri's "draw your reasoning"): one Excalidraw over the whole canvas, moving with its pan and
// zoom. Off, it only shows the drawing and lets every click through; on (the pencil, or D), it takes the pointer, with a
// small toolbar of ours instead of Excalidraw's own UI. The scene has its own storage key.
// Colors are Excalidraw's own palette: its dark theme inverts the canvas (swatches get the same filter, so they match).
const SKETCH_KEY = "overlook.sketch";
const SKETCH_COLORS = [["#1e1e1e", "White"], ["#e03131", "Red"], ["#9c36b5", "Violet"], ["#1971c2", "Blue"], ["#2f9e44", "Green"]];
const SKETCH_FILLS = [["#ffc9c9", "Red"], ["#ffec99", "Yellow"], ["#a5d8ff", "Blue"], ["#b2f2bb", "Green"]];
let sketchEls = (() => { try { return JSON.parse(localStorage.getItem(SKETCH_KEY) || "[]"); } catch { return []; } })();
let sketchApi = null, sketchOn = false, sketchColor = SKETCH_COLORS[0][0], sketchToolNow = "freedraw";
const sketchBox = (e) => { const xs = e.points ? e.points.map((p) => e.x + p[0]) : [e.x, e.x + e.width], ys = e.points ? e.points.map((p) => e.y + p[1]) : [e.y, e.y + e.height]; return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
const sketchView = () => ({ scrollX: orchPanX / orchZoom, scrollY: orchPanY / orchZoom, zoom: { value: orchZoom } });
const sameView = (a, b) => Math.abs(a.scrollX - b.scrollX) < 0.05 && Math.abs(a.scrollY - b.scrollY) < 0.05 && Math.abs(a.zoom.value - b.zoom.value) < 1e-4;
function syncSketchView() {
  if (!sketchApi) return;
  const v = sketchView();
  if (!sameView(sketchApi.getAppState(), v)) sketchApi.updateScene({ appState: v });
}
// The canvas DOM is rebuilt on every visit: a fresh layer each time, Excalidraw only once there's something to show.
function addSketchLayer(canvas) {
  sketchApi = null;
  canvas.querySelector("#orch-plane").insertAdjacentHTML("afterend", `<div class="orch-sketch ${sketchOn ? "on" : ""}" id="orch-sketch"></div><div class="cv-island orch-sketchbar" id="orch-sketchbar" role="toolbar" aria-label="Drawing tools" ${sketchOn ? "" : "hidden"}></div>`);
  if (sketchOn) paintSketchBar();
  if (sketchOn || sketchEls.length) mountSketch();
}
async function mountSketch() {
  const el = $("#orch-sketch");
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = "1";
  const lib = await loadExcalidraw().catch(() => null);
  if (!lib) { el.dataset.mounted = ""; toast("Couldn't load the drawing tools"); return; }
  let t = 0, last = sketchEls.map((x) => `${x.id}:${x.version}`).join();
  lib.mount(el, {
    theme: "dark",
    initialData: { elements: sketchEls, appState: { theme: "dark", viewBackgroundColor: "transparent", currentItemStrokeColor: sketchColor, ...sketchView() } },
    excalidrawAPI: (a) => { sketchApi = a; },
    onChange: (els, st) => {
      const selId = Object.keys(st.selectedElementIds || {})[0], selColor = selId && els.find((x) => x.id === selId)?.strokeColor;
      if (sketchOn && (st.activeTool?.type !== sketchToolNow || (selColor && selColor !== sketchColor))) { if (selColor) sketchColor = selColor; paintSketchBar(st.activeTool?.type); }
      clearTimeout(t);
      t = setTimeout(() => {
        const live = els.filter((x) => !x.isDeleted), sig = live.map((x) => `${x.id}:${x.version}`).join();
        if (sig === last) return;
        last = sig; sketchEls = live;
        try { localStorage.setItem(SKETCH_KEY, JSON.stringify(live)); } catch {}
        syncWires(); drawMap();
      }, 400);
    },
    // Panning or zooming inside the drawing moves the canvas with it.
    onScrollChange: (scrollX, scrollY, zoom) => {
      if (!sketchOn || sameView({ scrollX, scrollY, zoom }, sketchView())) return;
      orchZoom = zoom.value; orchPanX = scrollX * zoom.value; orchPanY = scrollY * zoom.value;
      applyCanvasTransform(); saveCanvasSoon();
    },
  });
  new ResizeObserver(() => sketchApi?.refresh()).observe(el);
}
async function setSketch(on, tool = "freedraw") {
  if (orchMode !== "free" || orchMax) { if (on) toast("Drawing works on the free canvas"); return; }
  sketchOn = on;
  $("#orch-sketch")?.classList.toggle("on", on);
  const bar = $("#orch-sketchbar");
  if (bar) bar.hidden = !on;
  paintHud($("#orch-hud"), true);
  if (!on) { sketchApi?.updateScene({ appState: { selectedElementIds: {}, editingTextElement: null } }); sketchApi?.setActiveTool({ type: "selection" }); return; }
  paintSketchBar();
  await mountSketch();
  for (let n = 0; n < 50 && !sketchApi; n++) await new Promise((r) => setTimeout(r, 100));
  sketchApi?.setActiveTool({ type: tool }); // the pen from the toolbar or D; the selection when a shape was clicked
  paintSketchBar(tool);
  sketchApi?.refresh();
  $("#orch-sketch .excalidraw")?.focus(); // its keys (Delete, Ctrl+Z, tool letters) work only while it has the focus
}
const SKETCH_TOOLS = [["selection", "select", "Select and move (V)"], ["freedraw", "edit", "Pen (P)"], ["rectangle", "rect", "Box (R)"], ["ellipse", "circle", "Ellipse (O)"],
  ["arrow", "arrowR", "Arrow (A): drag from one shape to another and it sticks"], ["text", "type", "Text (T)"], ["eraser", "eraser", "Eraser (E)"]];
function paintSketchBar(tool) {
  if (tool) sketchToolNow = tool;
  const bar = $("#orch-sketchbar");
  if (!bar) return;
  bar.innerHTML = SKETCH_TOOLS.map(([t, ic, tip]) => `<button type="button" class="hud-btn ${t === sketchToolNow ? "on" : ""}" data-act="sketch-tool" data-tool="${t}" title="${esc(tip)}" aria-label="${esc(tip)}">${icon(ic, 16)}</button>`).join("")
    + '<span class="orch-hud-sep"></span>'
    + SKETCH_COLORS.map(([c, n]) => `<button type="button" class="hud-btn sketch-c ${c === sketchColor ? "on" : ""}" data-act="sketch-color" data-c="${c}" title="${n}" aria-label="Color ${n}"><i style="background:${c}"></i></button>`).join("")
    + `<span class="orch-hud-sep"></span><button type="button" class="hud-btn" data-act="orch-sketch" title="Done (Esc)" aria-label="Stop drawing">${icon("x", 16)}</button>`;
}
// The topmost shape under a screen point (its box plus a few px; `edge`: only near its outline), or null. A label
// inside a box counts as the box. ponytail: boxes ignore rotation; Excalidraw's own hit test if that ever matters.
function sketchHit(cx, cy, edge = false) {
  const lay = $("#orch-sketch");
  if (!sketchApi || !lay) return null;
  const r = lay.getBoundingClientRect(), x = (cx - r.left - orchPanX) / orchZoom, y = (cy - r.top - orchPanY) / orchZoom, pad = 8 / orchZoom;
  const els = sketchApi.getSceneElements();
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i], xs = e.points ? e.points.map((p) => e.x + p[0]) : [e.x, e.x + e.width], ys = e.points ? e.points.map((p) => e.y + p[1]) : [e.y, e.y + e.height];
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    // A stroke, line or arrow is hit on its path, not its box (so a scribble over a card doesn't swallow the card).
    if (e.points && e.points.length > 1 && !e.points.some((p, j) => j && segDist(x, y, e.x + e.points[j - 1][0], e.y + e.points[j - 1][1], e.x + p[0], e.y + p[1]) < pad)) continue;
    if (edge && !e.points && x > x0 + 2 * pad && x < x1 - 2 * pad && y > y0 + 2 * pad && y < y1 - 2 * pad) continue;
    return e.containerId ? els.find((c) => c.id === e.containerId) || e : e;
  }
  return null;
}
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
// Every shape whose path (sampled along each segment) or box touches the canvas-space area; selects them (plus `keep`).
function sketchPickIn(x0, y0, x1, y1, keep = []) {
  if (!sketchApi) return [];
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const touched = (el) => {
    if (el.containerId || el.locked) return false;
    if (!el.points) { const bx = sketchBox(el); return bx.x <= x1 && bx.x + bx.w >= x0 && bx.y <= y1 && bx.y + bx.h >= y0; }
    return el.points.some((p, j) => { const q = el.points[j - 1] || p; return [0, .25, .5, .75, 1].some((t) => inside(el.x + q[0] + (p[0] - q[0]) * t, el.y + q[1] + (p[1] - q[1]) * t)); });
  };
  const ids = [...new Set([...keep, ...sketchApi.getSceneElements().filter(touched).map((el) => el.id)])];
  sketchApi.updateScene({ appState: { selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])) } });
  return ids;
}
const sketchSelected = () => Object.keys(sketchApi?.getAppState().selectedElementIds || {});
const sketchSelect = (id) => sketchApi?.updateScene({ appState: { selectedElementIds: id ? { [id]: true } : {} } });
// Change the selected shapes (their labels too) and what's drawn next; undoable with Ctrl+Z.
function sketchPaint(patch) {
  const sel = new Set(sketchSelected());
  if (patch.strokeColor) sketchColor = patch.strokeColor;
  const next = { strokeColor: "currentItemStrokeColor", backgroundColor: "currentItemBackgroundColor", strokeWidth: "currentItemStrokeWidth", fillStyle: "currentItemFillStyle" };
  sketchApi?.updateScene({
    appState: Object.fromEntries(Object.entries(patch).filter(([k]) => next[k]).map(([k, v]) => [next[k], v])),
    elements: sketchApi.getSceneElements().map((e) => sel.has(e.id) || sel.has(e.containerId) ? { ...e, ...(e.type === "text" ? { strokeColor: patch.strokeColor ?? e.strokeColor } : patch), version: e.version + 1, versionNonce: (Math.random() * 2 ** 31) | 0, updated: Date.now() } : e),
    captureUpdate: "IMMEDIATELY",
  });
  paintSketchBar();
}
// Excalidraw's own actions (duplicate, layer order, delete) through their shortcuts, so links and labels stay intact.
const sketchKey = (key, code, mods = {}) => $("#orch-sketch .excalidraw")?.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...mods }));
function sketchMenu(cx, cy) {
  const hit = sketchHit(cx, cy);
  if (hit && !sketchSelected().includes(hit.id)) sketchSelect(hit.id);
  const n = sketchSelected().length;
  const sw = (list, key, extra = {}) => list.map(([c, name]) => ({ label: name, dot: c, run: () => sketchPaint({ [key]: c, ...extra }) }));
  ctxMenu(cx, cy, n ? [
    { label: "Color", ic: "edit", sub: sw(SKETCH_COLORS, "strokeColor") },
    { label: "Fill", ic: "rect", sub: [{ label: "None", ic: "x", run: () => sketchPaint({ backgroundColor: "transparent" }) }, ...sw(SKETCH_FILLS, "backgroundColor", { fillStyle: "solid" })] },
    { label: "Thickness", ic: "type", sub: [["Thin", 1], ["Medium", 2], ["Bold", 4]].map(([l, w]) => ({ label: l, run: () => sketchPaint({ strokeWidth: w }) })) },
    "-",
    { label: "Duplicate", ic: "copy", kbd: "Ctrl+D", run: () => sketchKey("d", "KeyD", { ctrlKey: true }) },
    { label: "Bring to front", ic: "front", run: () => sketchKey("]", "BracketRight", { ctrlKey: true, shiftKey: true }) },
    { label: "Send to back", ic: "back", run: () => sketchKey("[", "BracketLeft", { ctrlKey: true, shiftKey: true }) },
    "-",
    { label: n > 1 ? `Delete ${n}` : "Delete", ic: "trash", kbd: "Del", danger: true, run: () => sketchKey("Delete", "Delete") },
  ] : [
    { label: "Select all", ic: "select", kbd: "Ctrl+A", off: !sketchEls.length, run: () => sketchApi?.updateScene({ appState: { selectedElementIds: Object.fromEntries(sketchApi.getSceneElements().map((e) => [e.id, true])) } }) },
    { label: "Stop drawing", ic: "x", kbd: "Esc", run: () => setSketch(false) },
  ]);
}
// Clicks around the sketch: a shape clicked while drawing is off opens it for editing (selected); while drawing with the
// selection tool, a click on a card (not on a shape) leaves drawing so the next click reaches the card. Right-click on
// the sketch gets Overlook's menu instead of Excalidraw's long one.
function bindSketchClicks(canvas) {
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || orchMode !== "free" || orchMax) return;
    if (e.altKey && !sketchOn && onCanvasBg(e.target, canvas)) { e.preventDefault(); e.stopImmediatePropagation(); quickInk(e, canvas); return; }
    if (!sketchApi) return;
    const onCard = !!e.target.closest(".orch-pane"), hit = sketchHit(e.clientX, e.clientY, onCard);
    if (!sketchOn && hit && (onCard ? !e.target.closest("button, .orch-port, .orch-resize") : onCanvasBg(e.target, canvas))) {
      e.preventDefault(); e.stopImmediatePropagation();
      // The same press goes on to Excalidraw once drawing is on, so press-and-drag moves the shape in one gesture.
      let up = false;
      addEventListener("pointerup", () => { up = true; }, { once: true });
      const opts = { clientX: e.clientX, clientY: e.clientY, button: 0, buttons: 1, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true, bubbles: true, cancelable: true };
      setSketch(true, "selection").then(() => {
        const cv = $("#orch-sketch canvas.interactive");
        if (!cv) return sketchSelect(hit.id);
        cv.dispatchEvent(new PointerEvent("pointerdown", opts));
        if (up) cv.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 })); // already released: a click
        if (!sketchSelected().includes(hit.id)) sketchSelect(hit.id);
      });
    } else if (sketchOn && sketchToolNow === "selection" && !hit && document.elementsFromPoint(e.clientX, e.clientY).some((el) => el.closest(".orch-pane"))) {
      e.preventDefault(); e.stopPropagation();
      setSketch(false);
    }
  }, true);
  // The selection box on the sketch is ours, not Excalidraw's (which selects only what fits entirely inside): it picks
  // every shape with a point of its path, or its box, in the area, live as it's dragged. Excalidraw never sees the press.
  canvas.addEventListener("pointerdown", (e) => {
    if (!sketchOn || e.button !== 0 || sketchToolNow !== "selection" || !e.target.closest?.(".orch-sketch") || sketchHit(e.clientX, e.clientY)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const r = canvas.getBoundingClientRect(), at = (ev) => [(ev.clientX - r.left - orchPanX) / orchZoom, (ev.clientY - r.top - orchPanY) / orchZoom], a = at(e);
    const keep = e.shiftKey ? sketchSelected() : []; // Shift adds to what was selected
    canvas.insertAdjacentHTML("beforeend", '<div class="orch-sketch-box" id="orch-sketch-box"></div>');
    const boxEl = canvas.querySelector("#orch-sketch-box");
    const pick = (ev) => {
      const b = at(ev), x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      Object.assign(boxEl.style, { left: `${x0 * orchZoom + orchPanX}px`, top: `${y0 * orchZoom + orchPanY}px`, width: `${(x1 - x0) * orchZoom}px`, height: `${(y1 - y0) * orchZoom}px` });
      sketchPickIn(x0, y0, x1, y1, keep);
    };
    pick(e);
    addEventListener("pointermove", pick);
    addEventListener("pointerup", () => { removeEventListener("pointermove", pick); boxEl.remove(); $("#orch-sketch .excalidraw")?.focus(); }, { once: true });
  }, true);
  // Drawing off: the canvas's own selection box (for cards) also picks the sketch it touches, live; on release, if it
  // caught any of it, drawing turns on with that selected (to move, recolor or delete it).
  canvas.addEventListener("pointerdown", (e) => {
    if (sketchOn || !sketchApi || e.button !== 0 || e.altKey || orchTool !== "select" || isSpacePressed || !onCanvasBg(e.target, canvas) || orchMode !== "free" || orchMax) return;
    const r = canvas.getBoundingClientRect(), at = (ev) => [(ev.clientX - r.left - orchPanX) / orchZoom, (ev.clientY - r.top - orchPanY) / orchZoom], a = at(e);
    let ids = [];
    const pick = (ev) => { const b = at(ev); if (Math.abs(b[0] - a[0]) * orchZoom > 4 || Math.abs(b[1] - a[1]) * orchZoom > 4) ids = sketchPickIn(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])); };
    addEventListener("pointermove", pick);
    addEventListener("pointerup", () => {
      removeEventListener("pointermove", pick);
      if (ids.length) setSketch(true, "selection").then(() => sketchApi?.updateScene({ appState: { selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])) } }));
    }, { once: true });
  }, true);
  canvas.addEventListener("contextmenu", (e) => {
    if (!e.target.closest?.(".orch-sketch.on")) return;
    e.preventDefault(); e.stopPropagation();
    sketchMenu(e.clientX, e.clientY);
  }, true);
}
// Esc leaves drawing, before anything else sees it: not while a label is being typed (Esc ends that first) or a menu is open.
window.addEventListener("keydown", (e) => {
  if (!sketchOn || e.key !== "Escape" || ctxEl || sketchApi?.getAppState().editingTextElement || document.querySelector("dialog[open]")) return;
  e.preventDefault(); e.stopPropagation();
  setSketch(false);
}, true);
// Alt + drag on the empty canvas: a quick freehand stroke without entering drawing (shown live, then added to the sketch).
function quickInk(e, canvas) {
  const r = canvas.getBoundingClientRect(), pts = [[e.clientX - r.left, e.clientY - r.top]];
  canvas.insertAdjacentHTML("beforeend", `<svg class="orch-ink" id="orch-ink"><polyline points="" /></svg>`);
  const line = canvas.querySelector("#orch-ink polyline");
  line.style.stroke = sketchColor; // the svg has the sketch's dark-theme filter, so it looks as it will once added
  const move = (ev) => { pts.push([ev.clientX - r.left, ev.clientY - r.top]); line.setAttribute("points", pts.join(" ")); };
  const up = async () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up);
    if (pts.length > 2) {
      const sc = pts.map(([x, y]) => [(x - orchPanX) / orchZoom, (y - orchPanY) / orchZoom]), [x, y] = sc[0];
      const rel = sc.map(([a, b]) => [a - x, b - y]), xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
      await mountSketch();
      for (let n = 0; n < 50 && !sketchApi; n++) await new Promise((res) => setTimeout(res, 100));
      const lib = await loadExcalidraw().catch(() => null);
      if (sketchApi && lib) {
        const [el] = lib.restoreElements([{ type: "freedraw", id: `ink${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, x, y, points: rel, pressures: [], simulatePressure: true,
          width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), strokeColor: sketchColor, strokeWidth: 2 }], null);
        sketchApi.updateScene({ elements: [...sketchApi.getSceneElements(), el], captureUpdate: "IMMEDIATELY" });
      }
    }
    $("#orch-ink")?.remove();
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}
// An agent's `overlook draw`: Mermaid becomes shapes, placed right of the agent's card.
async function sketchFromMermaid(src, parent) {
  if (!$("#orch-sketch")) return "the canvas isn't showing";
  await mountSketch();
  for (let n = 0; n < 50 && !sketchApi; n++) await new Promise((r) => setTimeout(r, 100));
  const lib = await loadExcalidraw().catch(() => null);
  if (!sketchApi || !lib) return "the drawing tools didn't load";
  let els;
  try { els = await lib.fromMermaid(src); } catch (e) { return `Mermaid: ${String(e?.message || e).slice(0, 160)}`; }
  const x0 = (parent?.x ?? 0) + (parent?.w ?? 0) + 60, y0 = parent?.y ?? 0;
  const minX = Math.min(...els.map((e) => e.x)), minY = Math.min(...els.map((e) => e.y));
  for (const e of els) { e.x += x0 - minX; e.y += y0 - minY; }
  sketchApi.updateScene({ elements: [...sketchApi.getSceneElements(), ...els] });
  return "";
}

function ensurePaneRect(p, idx = 0) {
  // A terminal opens at about a Ghostty window's size (~95 columns: a fastfetch greeting fits on one line).
  p.w ??= (p.kind === "sticky" ? 320 : p.kind === "note" ? 480 : p.kind === "terminal" ? 940 : 580);
  p.h ??= (p.kind === "sticky" ? 220 : p.kind === "note" ? 440 : p.kind === "terminal" ? 600 : 430);
  if (typeof p.x !== "number") {
    // A new card opens where you're looking (the middle of the visible canvas), stepped down-right off any card there.
    const r = orchMode === "free" ? $("#orch-canvas")?.getBoundingClientRect() : null;
    let x = r?.width ? Math.round((r.width / 2 - orchPanX) / orchZoom - p.w / 2) : 24 + (idx % 2) * (p.w + 40);
    let y = r?.height ? Math.round(((r.height + CANVAS_TOP) / 2 - orchPanY) / orchZoom - p.h / 2) : 20 + Math.floor(idx / 2) * (p.h + 40);
    // Not on top of another card: step right past whatever it would cover (the view then goes to it, see focusPane).
    const hit = () => orchPanes.find((q) => q !== p && typeof q.x === "number" && x < q.x + q.w + 24 && x + p.w + 24 > q.x && y < q.y + q.h + 24 && y + p.h + 24 > q.y);
    for (let n = 0, q; n < 40 && (q = hit()); n++) x = q.x + q.w + 40;
    p.x = x; p.y = y;
  }
  return p;
}
function arrangeCanvasPanes() {
  const vis = orchPanes.map((p, i) => {
    const cols = orchPanes.length === 1 ? 1 : 2;
    const col = i % cols, row = Math.floor(i / cols);
    const w = cols === 1 ? 860 : 560, h = orchPanes.length <= 2 ? 490 : 390;
    p.x = 24 + col * (w + 20);
    p.y = 20 + row * (h + 20);
    p.w = w; p.h = h;
    return p;
  });
  orchPanX = 0; orchPanY = CANVAS_TOP; orchZoom = 1;
  orchSigs.clear();
  orchPaint(true);
  return vis;
}
function fitCanvasView() {
  const canvas = $("#orch-canvas");
  if (!canvas || !orchPanes.length) return;
  orchPanes.forEach(ensurePaneRect);
  const minX = Math.min(...orchPanes.map((p) => p.x)), minY = Math.min(...orchPanes.map((p) => p.y));
  const maxX = Math.max(...orchPanes.map((p) => p.x + p.w)), maxY = Math.max(...orchPanes.map((p) => p.y + p.h));
  const bw = Math.max(400, maxX - minX + 48), bh = Math.max(300, maxY - minY + 68);
  const rect = canvas.getBoundingClientRect();
  orchZoom = Math.min(1.15, Math.max(0.55, Math.min(rect.width / bw, (rect.height - CANVAS_TOP) / bh)));
  orchPanX = Math.round((rect.width - (maxX - minX) * orchZoom) / 2 - minX * orchZoom);
  orchPanY = Math.round(CANVAS_TOP + ((rect.height - CANVAS_TOP) - (maxY - minY) * orchZoom) / 2 - minY * orchZoom);
  applyCanvasTransform();
}
function applyCanvasTransform() {
  const plane = $("#orch-plane"), zLbl = $("#orch-zoom-lbl"), canvas = $("#orch-canvas");
  const free = orchMode === "free" && !orchMax;
  if (plane) plane.style.transform = free && orchPanes.length ? `translate(${orchPanX}px, ${orchPanY}px) scale(${orchZoom})` : "";
  plane?.style.setProperty("--z", orchZoom);
  const sk = $("#orch-sketch");
  if (sk) { sk.hidden = !free; syncSketchView(); }
  // Patterned backgrounds move and scale with the plane; octave step-doubling (LOD) and alpha attenuation keep
  // low zoom levels (>16px on-screen period) free of moiré shimmer or dot crowding.
  if (canvas) {
    const [bgId, , , baseStep] = bgEntry(orchBg);
    canvas.dataset.bg = bgId;
    if (free && baseStep > 0) {
      let step = baseStep;
      while (step * orchZoom < 16) step *= 2;
      const px = Math.round(step * orchZoom * 100) / 100;
      const lod = orchZoom < 0.85 ? Math.max(0.42, Math.min(1, (orchZoom - 0.1) / 0.75)) : 1;
      // background-position/size go straight on the canvas: as CSS variables they'd be inherited by every card, and each
      // pan step then restyled the whole canvas (~10 ms a wheel event)
      canvas.style.setProperty("--bg-lod", lod.toFixed(2));
      canvas.style.backgroundPosition = `${orchPanX}px ${orchPanY}px`;
      canvas.style.backgroundSize = `${px}px ${px}px`;
    } else {
      canvas.style.removeProperty("--bg-lod");
      canvas.style.backgroundPosition = "";
      canvas.style.backgroundSize = "";
    }
  }
  if (zLbl) zLbl.textContent = `${Math.round(orchZoom * 100)}%`;
  drawMap();
}
// Room for one more card (split: 6, canvas: 18): the oldest viewer card goes, never a terminal or a sticky.
function makeRoom() {
  const cap = orchMode === "free" ? 18 : 6;
  if (orchPanes.length < cap) return true;
  const i = orchPanes.findIndex((p) => p.kind !== "terminal" && p.kind !== "sticky");
  if (i < 0) { toast(`The ${orchMode === "free" ? "canvas" : "split"} is full (${cap} cards): close one first`); return false; }
  orchPanes.splice(i, 1);
  return true;
}
// Puts a card on the workspace (from a click, a drop or the HUD); x/y are canvas coordinates of a drop.
const bornKeys = new Set(); // cards just added: they fade in once (orchPaint)
function addPane(item, x, y) {
  const k = paneKey(item), have = orchPanes.find((p) => paneKey(p) === k), p = have || item;
  if (!have) {
    if (!makeRoom()) return false;
    ensurePaneRect(p, orchPanes.length);
    orchPanes.push(p);
    bornKeys.add(k);
  }
  if (x != null && orchMode === "free") { p.x = Math.round(x - 40); p.y = Math.round(y - 16); }
  orchActive = k; orchMax = ""; orchSigs.clear();
  agentsBody();
  return true;
}
// Cards an agent asked for (`overlook spawn` / `overlook note`, see takeSpawns in tasks.ts): each opens right of the card
// that asked, below the others there, wired to it, without taking the focus; the server hears how it went on the next poll.
let spawnDone = [];
async function takeSpawns() {
  const panes = orchPanes.filter((p) => p.kind === "terminal").map((p) => p.id);
  if (!panes.length && !spawnDone.length) return;
  const done = spawnDone; spawnDone = [];
  const r = await api("/api/canvas/spawns", { panes, done }).catch(() => { spawnDone.push(...done); return null; });
  if (!r?.spawns?.length) return;
  const active = orchActive;
  for (const s of r.spawns) {
    const parent = orchPanes.find((p) => p.kind === "terminal" && p.id === s.parent);
    // An agent wrote into a sticky wired to it (overlook write): the text changes in place.
    if (s.kind === "write") {
      const note = orchPanes.find((p) => p.kind === "sticky" && paneKey(p) === s.target);
      if (note) note.text = s.text;
      spawnDone.push({ id: s.id, ...(note ? {} : { why: "that note is no longer on the canvas" }) });
      continue;
    }
    if (s.kind === "draw") {
      sketchFromMermaid(s.text, parent).then((why) => spawnDone.push({ id: s.id, ...(why ? { why } : {}) }));
      continue;
    }
    const p = s.kind === "sticky" ? { kind: "sticky", id: String(++orchSeq), text: s.text }
      : { kind: "terminal", id: s.id, cwd: s.cwd, ...(s.kind === "agent" ? { run: newTuiRun(s.agent, s.prompt) } : { shell: prefShell || "" }) };
    if (parent && typeof parent.x === "number") {
      ensurePaneRect(p);
      p.x = parent.x + parent.w + 40; p.y = parent.y;
      const hit = () => orchPanes.find((q) => typeof q.x === "number" && p.x < q.x + q.w + 24 && p.x + p.w + 24 > q.x && p.y < q.y + q.h + 24 && p.y + p.h + 24 > q.y);
      for (let n = 0, q; n < 40 && (q = hit()); n++) p.y = q.y + q.h + 40;
    }
    if (!parent || !addPane(p)) { spawnDone.push({ id: s.id, why: parent ? "the canvas is full: ask the user to close a card" : "your card is no longer on the canvas" }); continue; }
    orchLinks.push({ a: paneKey(parent), b: paneKey(p) });
    spawnDone.push({ id: s.id });
  }
  orchActive = active;
  saveCanvas(); orchSigs.clear(); agentsBody();
}
// Wires an agent just used to message another (from /api/pty handoffs, polled with the canvas) are drawn flowing.
let hotWires = new Set();
async function pollHandoffs() {
  if (!orchLinks.length || !orchPanes.some((p) => p.kind === "terminal")) { hotWires = new Set(); return; }

  if (Date.now() - wiresAt > 30_000) syncWires(true); // the server forgets a canvas it hasn't heard from in 90 s (or restarted)
  const r = await api("/api/pty").catch(() => null);
  const next = new Set((r?.handoffs || []).filter((h) => Date.now() - h.at < 6000).map((h) => [h.from.includes(":") ? h.from : `terminal:${h.from}`, `terminal:${h.to}`].sort().join("|")));
  if ([...next].join() !== [...hotWires].join()) { hotWires = next; drawLinks(); }
}
// The map (bottom right, like Maestri's): the cards as coloured blocks, the screen as a frame, the rest dimmed. Its own
// zoom follows you: it frames the cards and, as you pan or zoom away from them, eases out to keep the frame in view.
// Click a card to go to it, click elsewhere to centre the view there, drag (the frame, or anywhere) to move, wheel to
// zoom. mapXf maps canvas coordinates to the map; it eases toward mapGoal, during a drag too, so the map zooms live.
let mapXf = null, mapGoal = null, mapRaf = 0;
const mapView = () => {
  const r = $("#orch-canvas").getBoundingClientRect();
  return { x: -orchPanX / orchZoom, y: -orchPanY / orchZoom, w: r.width / orchZoom, h: r.height / orchZoom };
};
const mapNear = (a, b) => !!a && !!b && Math.abs(a.k - b.k) < a.k * .002 && Math.abs(a.ox - b.ox) < .3 && Math.abs(a.oy - b.oy) < .3;
function drawMap() {
  const box = $("#orch-map");
  if (!box || !$("#orch-canvas")) return;
  const on = orchMapOpen && orchMode === "free" && !orchMax;
  box.hidden = !on;
  if (!on) { mapXf = null; return; }
  const svg = box.querySelector("svg"), W = svg.clientWidth, H = svg.clientHeight;
  if (!W || !H) return;
  const all = [...orchPanes.filter((p) => typeof p.x === "number"), mapView(), ...sketchEls.map(sketchBox)];
  const x0 = Math.min(...all.map((p) => p.x)), y0 = Math.min(...all.map((p) => p.y));
  const x1 = Math.max(...all.map((p) => p.x + p.w)), y1 = Math.max(...all.map((p) => p.y + p.h));
  const pad = Math.max(x1 - x0, y1 - y0) * .08, k = Math.min(W / (x1 - x0 + 2 * pad), H / (y1 - y0 + 2 * pad));
  mapGoal = { k, ox: W / 2 - ((x0 + x1) / 2) * k, oy: H / 2 - ((y0 + y1) / 2) * k };
  if (!mapXf || calm.matches) mapXf = { ...mapGoal };
  paintMap();
  if (!mapRaf && !mapNear(mapXf, mapGoal)) mapRaf = requestAnimationFrame(mapEase);
}
function mapEase() {
  mapRaf = 0;
  if (!mapXf || !mapGoal || $("#orch-map")?.hidden) return;
  for (const c of ["k", "ox", "oy"]) mapXf[c] += (mapGoal[c] - mapXf[c]) * .2;
  if (mapNear(mapXf, mapGoal)) mapXf = { ...mapGoal };
  paintMap();
  if (!mapNear(mapXf, mapGoal)) mapRaf = requestAnimationFrame(mapEase);
}
function paintMap() {
  const svg = $("#orch-map svg");
  if (!svg || !mapXf) return;
  const { k, ox, oy } = mapXf, W = svg.clientWidth, H = svg.clientHeight, v = mapView();
  const box = (x, y, w, h) => [x * k + ox, y * k + oy, Math.max(3, w * k), Math.max(3, h * k)].map((n) => Math.round(n * 10) / 10);
  const blocks = orchPanes.filter((p) => typeof p.x === "number").map((p) => {
    const [x, y, w, h] = box(p.x, p.y, p.w, p.collapsed ? 34 : p.h);
    return `<rect class="mb m-${p.kind}${paneKey(p) === orchActive ? " on" : ""}" data-key="${esc(paneKey(p))}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(4, w / 4, h / 4).toFixed(1)}"><title>${esc(paneLabel(p))}</title></rect>`;
  }).join("");
  const ink = sketchEls.map((e) => {
    if (e.points) return `<polyline class="map-ink" points="${e.points.map((p) => [(e.x + p[0]) * k + ox, (e.y + p[1]) * k + oy].map((n) => n.toFixed(1)).join(",")).join(" ")}"/>`;
    if (e.type === "text") return "";
    const [x, y, w, h] = box(e.x, e.y, e.width, e.height);
    return `<${e.type === "ellipse" ? `ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"` : `rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"`} class="map-ink"/>`;
  }).join("");
  const [fx, fy, fw, fh] = box(v.x, v.y, v.w, v.h);
  svg.innerHTML = `${ink}${blocks}<path class="map-dim" fill-rule="evenodd" d="M-2 -2H${W + 2}V${H + 2}H-2Z M${fx} ${fy}h${fw}v${fh}h${-fw}Z"/>`
    + `<rect class="map-frame" x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="4"/>`;
}
function bindMap(box) {
  const svg = box?.querySelector("svg");
  if (!svg) return;
  const at = (ev) => { const b = svg.getBoundingClientRect(); return [(ev.clientX - b.left - mapXf.ox) / mapXf.k, (ev.clientY - b.top - mapXf.oy) / mapXf.k]; };
  const centre = (x, y) => {
    const r = $("#orch-canvas").getBoundingClientRect();
    orchPanX = Math.round(r.width / 2 - x * orchZoom); orchPanY = Math.round(r.height / 2 - y * orchZoom);
    applyCanvasTransform();
  };
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !mapXf) return;
    e.preventDefault(); e.stopPropagation();
    try { svg.setPointerCapture(e.pointerId); } catch {}
    const v = mapView(), [px, py] = at(e), key = e.target.closest?.("rect.mb")?.dataset.key;
    const inFrame = px >= v.x && px <= v.x + v.w && py >= v.y && py <= v.y + v.h;
    // The view's centre follows the pointer's moves at the map's current scale. The map keeps easing while you drag:
    // pull the frame away from the cards and it zooms out under you (each move then covers more ground), bring it back
    // and it zooms in. Pressing outside the frame first brings the view there.
    let cx = v.x + v.w / 2, cy = v.y + v.h / 2, lx = e.clientX, ly = e.clientY, moved = false;
    const jump = () => { [cx, cy] = at(e); centre(cx, cy); };
    if (!inFrame && !key) jump();
    box.classList.add("dragging");
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) return;
      if (!moved && !inFrame && key) jump(); // dragging from a card outside the frame: start from there
      moved = true;
      cx += (ev.clientX - lx) / mapXf.k; cy += (ev.clientY - ly) / mapXf.k; lx = ev.clientX; ly = ev.clientY;
      centre(cx, cy);
    };
    const up = () => {
      svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerup", up); svg.removeEventListener("pointercancel", up);
      box.classList.remove("dragging");
      if (!moved && key) return focusPane(key); // a click on a card: go to it
      saveCanvas();
    };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  });
  // the wheel over the map zooms the canvas around the middle of the screen
  svg.addEventListener("wheel", (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = $("#orch-canvas").getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
    const z = Math.min(2.5, Math.max(0.2, orchZoom * Math.exp(-e.deltaY * 0.002)));
    orchPanX = Math.round(cx - (cx - orchPanX) * (z / orchZoom)); orchPanY = Math.round(cy - (cy - orchPanY) * (z / orchZoom));
    orchZoom = Math.round(z * 1000) / 1000;
    applyCanvasTransform(); saveCanvasSoon();
  }, { passive: false });
}
// Links are drawn in canvas coordinates, from the right edge of the source to the left edge of the target.
function drawLinks(tmp) {
  const plane = $("#orch-plane");
  if (!plane) return;
  drawMap(); // a card moved or resized
  // Two layers: the wires over the cards (a note dropped on a terminal still shows its wire), and their click targets
  // under them (a click on a card never removes a wire that crosses it). Hovering a target marks its wire.
  const layer = (id, top) => {
    let el = plane.querySelector(`#${id}`);
    if (!el) {
      el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.id = id; el.classList.add("orch-links");
      if (top) el.classList.add("over"); else el.onmouseover = el.onmouseout = (e) => svg.querySelector(`g[data-i="${e.target.dataset.i}"]`)?.classList.toggle("del", e.type === "mouseover");
      top ? plane.append(el) : plane.prepend(el);
    }
    return el;
  };
  const svg = layer("orch-links", true), hits = layer("orch-wire-hits", false);
  const byKey = new Map(orchPanes.map((p) => [paneKey(p), p]));
  orchLinks = orchLinks.filter((l) => byKey.has(l.a) && byKey.has(l.b));
  const on = orchMode === "free" && !orchMax;
  svg.style.display = hits.style.display = on ? "" : "none";
  if (!on) return;
  const curve = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const cx = Math.max(40, Math.abs(dx) * 0.45);
    const sign = dx >= 0 ? 1 : -1;
    return `M${x1},${y1} C${x1 + cx * sign},${y1} ${x2 - cx * sign},${y2} ${x2},${y2}`;
  };
  // A wire hangs from each card at the side that faces the other one (across the wider gap: a note under a terminal
  // links bottom to top), at the point of that side closest to the other card.
  const box = (p) => ({ x: p.x, y: p.y, w: p.w, h: p.collapsed ? 34 : p.h });
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const route = (a, b) => {
    const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    const midY = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2, midX = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
    const at = (p, dir, x = midX, y = midY) => dir === "r" || dir === "l"
      ? { x: dir === "r" ? p.x + p.w : p.x, y: clamp(y, p.y + 16, p.y + p.h - 16), nx: dir === "r" ? 1 : -1, ny: 0 }
      : { x: clamp(x, p.x + 16, p.x + p.w - 16), y: dir === "d" ? p.y + p.h : p.y, nx: 0, ny: dir === "d" ? 1 : -1 };
    let s, t;
    if (gx < 0 && gy < 0) {
      // One card over the other: both ends leave by the edge the two cards have closest, a little apart, and the cable
      // loops outside them.
      const e = { r: Math.abs(a.x + a.w - b.x - b.w), l: Math.abs(a.x - b.x), d: Math.abs(a.y + a.h - b.y - b.h), u: Math.abs(a.y - b.y) };
      const dir = Object.keys(e).reduce((m, k) => (e[k] < e[m] ? k : m));
      t = at(b, dir);
      const side = dir === "r" || dir === "l", room = side ? a.y + a.h - 16 - t.y : a.x + a.w - 16 - t.x, off = room >= 80 ? 80 : -80;
      s = side ? at(a, dir, 0, t.y + off) : at(a, dir, t.x + off);
    } else {
      // Apart: from the edges facing each other, across the wider gap (side by side: left/right; one above the other:
      // bottom/top), each end at the point of its edge nearest the other card, so it slides along as a card moves.
      const dir = gx >= gy ? (b.x + b.w / 2 >= a.x + a.w / 2 ? "r" : "l") : (b.y + b.h / 2 >= a.y + a.h / 2 ? "d" : "u");
      s = at(a, dir); t = at(b, { r: "l", l: "r", d: "u", u: "d" }[dir]);
    }
    return { s, t };
  };
  const smooth = (p) => {
    const f = (n) => Math.round(n * 10) / 10, mid = (u, v) => `${f((u.x + v.x) / 2)},${f((u.y + v.y) / 2)}`;
    return `M${f(p[0].x)},${f(p[0].y)} ` + p.slice(1, -1).map((q, i) => `Q${f(q.x)},${f(q.y)} ${mid(q, p[i + 2])}`).join(" ") + ` L${f(p.at(-1).x)},${f(p.at(-1).y)}`;
  };
  // The DOM only changes when the set of wires does; the ropes then move their paths' d.
  const keys = orchLinks.map((l) => `${l.a}>${l.b}`), sig = keys.join(",");
  if (svg.dataset.sig !== sig) {
    svg.dataset.sig = sig;
    hits.innerHTML = keys.map((_, i) => `<path class="hit" data-act="link-del" data-i="${i}"><title>Click to remove this link</title></path>`).join("");
    svg.innerHTML = keys.map((_, i) => `<g data-i="${i}"><path class="ln"/></g>`).join("");
    for (const k of ropes.keys()) if (!keys.includes(k)) ropes.delete(k);
  }
  orchLinks.forEach((l, i) => {
    const r = rope(keys[i], route(box(byKey.get(l.a)), box(byKey.get(l.b))));
    r.ln = svg.children[i]?.firstChild; r.hit = hits.children[i];
    svg.children[i]?.classList.toggle("hot", hotWires.has([l.a, l.b].sort().join("|")));
  });
  ropePaint = () => { for (const r of ropes.values()) { const d = smooth(r.pts); r.ln?.setAttribute("d", d); r.hit?.setAttribute("d", d); } };
  let tp = svg.querySelector("path.tmp");
  if (tmp) { tp ||= svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path")); tp.setAttribute("class", "ln tmp"); tp.setAttribute("d", curve(...tmp)); } else tp?.remove();
  ropeKick();
}
// Wires are ropes (Verlet: points that remember where they were, pulled down by gravity, held at a fixed distance
// from each other): they hang loose between the cards, drop when wired, and swing when a card moves. The simulation
// runs only while something moves, and settles at once with reduced motion.
const ropes = new Map(); // wire ("a>b") -> { pts: [{ x, y, px, py }], seg, s, t, ln, hit }
const ROPE_N = 16, GRAVITY = .45, DAMPING = .965, SLACK = 1.12;
let ropeRaf = 0, ropeStill = 0, ropePaint = () => {};
function rope(key, { s, t }) {
  let r = ropes.get(key);
  if (!r) {
    // It starts bowed out the way its ends face (a rope hung on two left edges falls to the left, not into the cards).
    const len = Math.hypot(t.x - s.x, t.y - s.y), ox = (s.nx + t.nx) / 2 * len * .3, oy = (s.ny + t.ny) / 2 * len * .3;
    r = { pts: Array.from({ length: ROPE_N + 1 }, (_, i) => {
      const u = i / ROPE_N, bow = Math.sin(Math.PI * u), x = s.x + (t.x - s.x) * u + ox * bow, y = s.y + (t.y - s.y) * u + oy * bow;
      return { x, y, px: x, py: y };
    }) };
    ropes.set(key, r);
  }
  // As long as the ends are apart, plus slack as far as the ends are side by side: lying across it hangs loose, the
  // further the more; standing up (one card under the other) extra rope would only pile up in a kink.
  const len = Math.hypot(t.x - s.x, t.y - s.y), across = len ? Math.abs(t.x - s.x) / len : 0;
  r.seg = (len * (1 + (SLACK - 1) * across) + 30 * across + 2) / ROPE_N; r.s = s; r.t = t;
  return r;
}
function ropeStep(r) {
  const p = r.pts, n = p.length - 1;
  let moved = 0;
  for (let i = 1; i < n; i++) {
    const q = p[i], vx = (q.x - q.px) * DAMPING, vy = (q.y - q.py) * DAMPING;
    q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + GRAVITY;
    moved = Math.max(moved, Math.abs(vx) + Math.abs(vy));
  }
  p[0].x = r.s.x; p[0].y = r.s.y; p[n].x = r.t.x; p[n].y = r.t.y; // the ends ride on their cards
  for (let k = 0; k < 24; k++) for (let i = 0; i < n; i++) {
    const a = p[i], b = p[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - r.seg) / d;
    const wa = i === 0 ? 0 : 1, wb = i + 1 === n ? 0 : 1, w = wa + wb;
    if (!w) continue;
    a.x += dx * f * wa / w; a.y += dy * f * wa / w; b.x -= dx * f * wb / w; b.y -= dy * f * wb / w;
  }
  return moved;
}
function ropeTick() {
  ropeRaf = 0;
  if (!$("#orch-links")?.isConnected) return; // left the canvas
  let moved = 0;
  for (const r of ropes.values()) moved = Math.max(moved, ropeStep(r));
  ropePaint();
  ropeStill = moved < .02 ? ropeStill + 1 : 0;
  if (ropeStill < 30) ropeRaf = requestAnimationFrame(ropeTick);
}
function ropeKick() {
  ropeStill = 0;
  if (calm.matches) { for (let i = 0; i < 400; i++) for (const r of ropes.values()) ropeStep(r); ropePaint(); return; }
  if (!ropeRaf) ropeRaf = requestAnimationFrame(ropeTick);
}
const htmlText = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.trim(); };
// What the cards linked into `key` say, shaped as a preamble for the next message (fits within `budget` chars).
async function linkedContext(key, budget) {
  const srcs = orchLinks.filter((l) => l.b === key).map((l) => orchPanes.find((p) => paneKey(p) === l.a)).filter(Boolean);
  if (budget < 300 || (!srcs.length && !orchLinks.some((l) => l.a === key || l.b === key))) return "";
  const parts = await Promise.all(srcs.map(async (p) => {
    if (p.kind === "sticky") return p.text?.trim() ? `### Sticky note\n${p.text.trim()}` : "";
    if (p.kind === "note") {
      const txt = p.ctx || htmlText((await api(`/api/note?path=${encodeURIComponent(p.id)}`).catch(() => null))?.html || "");
      return txt ? `### Vault note: ${p.id}\n${txt}` : "";
    }
    if (p.kind === "terminal") {
      const txt = termText(p.id);
      return txt ? `### Screen of terminal "${termName(p)}" (last lines)\n${txt}` : "";
    }
    if (p.kind !== "task" && p.kind !== "agent") return "";
    const r = await api(p.kind === "task" ? `/api/task?id=${encodeURIComponent(p.id)}` : `/api/agent?key=${encodeURIComponent(p.id)}`).catch(() => null);
    const last = r?.events?.filter((e) => e.t === "text").at(-1)?.txt;
    return last ? `### Latest answer from ${p.kind === "task" ? `task "${String(r.prompt).slice(0, 80)}"` : r.title || r.name}\n${last}` : "";
  }));
  const each = Math.floor((budget - 140) / Math.max(1, srcs.length));
  const body = parts.filter(Boolean).map((s) => (s.length > each ? `${s.slice(0, each)}…` : s)).join("\n\n");
  // A terminal wired to other terminals can talk to them itself: say how (the ids are what `overlook` takes).
  // (agents told at start, through their `canvas` args, don't need it on every message)
  const target = orchPanes.find((p) => paneKey(p) === key), knows = S.runners?.find((r) => r.id === target?.run?.agent)?.canvas;
  const peers = key.startsWith("terminal:") && !knows ? orchLinks.filter((l) => l.a === key || l.b === key).map((l) => (l.a === key ? l.b : l.a)).filter((k) => k.startsWith("terminal:")) : [];
  const how = peers.length ? `You can also talk to the wired terminals yourself: ${peers.map((k) => `"${termName(orchPanes.find((p) => paneKey(p) === k) || { id: k.slice(9) })}" = card ${k.slice(9)}`).join(", ")}. Run \`overlook send <card> "message"\` to hand work to one (it lands there as a prompt), \`overlook read <card>\` to see its screen.\n\n` : "";
  return body || how ? `${body ? `Context from cards linked to this one on the Overlook canvas:\n\n${body}\n\n` : ""}${how}---\n\n` : "";
}
const linkCount = (key) => orchLinks.filter((l) => l.b === key).length;

function fleetItems() {
  const items = [], seen = new Set();
  for (const t of S.tasks || []) {
    const folder = t.cwd ? shortCwd(t.cwd) : "";
    items.push({
      kind: "task", id: t.id, agent: t.agent, ic: "agents",
      title: t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : t.prompt,
      sub: [taskMeta(t), folder, ago(Date.parse(t.start))].filter(Boolean).join(" · "),
      group: !t.end ? "active" : "done", dot: liveClass(t), badge: taskStatus(t), peach: !t.end, needs: "",
      tui: S.runners?.find((r) => r.id === t.agent)?.tui && t.session && t.end ? { task: t.id, agent: t.agent } : null,
    });
  }
  for (const a of S.agents || []) {
    if (dismissedSessions.has(a.key)) continue;
    seen.add(a.key);
    const [name, ic] = AGENT_NAME[a.name] || [a.name, "agents"];
    items.push({
      kind: "agent", id: a.key, agent: a.name, ic,
      title: name, sub: `${a.cwd} · ${duration(a.seconds)}`,
      group: "active", dot: "", badge: "live", peach: false, needs: "",
    });
  }
  for (const f of S.background || []) {
    if (seen.has(f.key) || dismissedSessions.has(f.key)) continue;
    const gone = f.resumable === false, wait = !gone && (f.state === "blocked" || !!f.needs);
    const act = f.state === "working" || f.state === "running";
    items.push({
      kind: "agent", id: f.key, agent: "claude", ic: "agents",
      title: f.title, sub: `${gone ? "transcript expired · " : ""}Claude Code · ${f.cwd} · ${ago(f.since)}`,
      group: wait ? "waiting" : act && !gone ? "active" : "done",
      dot: wait ? "run" : f.state === "done" ? "idle" : "",
      badge: STATE[f.state] || f.state, peach: wait, needs: gone ? "" : f.needs || "",
      tui: !gone && f.state === "done" && S.runners?.find((r) => r.id === "claude")?.tui ? { key: f.key, agent: "claude" } : null,
    });
  }
  for (const p of orchPanes) {
    if (p && p.kind === "terminal") {
      const what = p.run ? runnerName(p.run.agent) || "Agent" : p.shell || "shell";
      items.push({
        kind: "terminal", id: p.id, agent: "terminal", ic: "terminal",
        title: p.run ? `${what} TUI` : `Terminal (${what})`,
        sub: shortCwd(p.cwd || orchCwd || ""),
        group: "active", dot: "run", badge: what, peach: true, needs: "",
      });
    }
  }
  const rank = { waiting: 0, active: 1, done: 2 };
  return items.sort((a, b) => rank[a.group] - rank[b.group]);
}

// The task form is drawn once; the 10 s refresh redraws only #agents-body, so what you type survives.
function agents() {
  clearInterval(orchTimer); orchSigs.clear();
  document.querySelectorAll("#cwd-pop").forEach((n) => n.remove());
  const ready = (S.runners || []).filter((r) => r.ready);
  const roleRow = ORCH_ROLES.find(([k]) => k === orchRole) || ORCH_ROLES[0];
  main.innerHTML = `<div class="orch-shell">
    <form class="task glass orch-deck ${orchDeckOpen ? "open" : ""}" id="run">
      <div class="orch-bar">
        <div class="orch-cluster-prompt">
          <textarea id="run-prompt" rows="1" placeholder="${esc(roleRow[2])}" aria-label="Task for the agent"></textarea>
          <div class="orch-ctx-group">
            <select class="pick" id="run-agent" aria-label="Agent">${(S.runners || []).map((r) => `<option value="${esc(r.id)}" ${r.ready ? "" : "disabled"}>${esc(r.name)}${r.ready ? "" : " (not set up)"}</option>`).join("")}</select>
            <input type="hidden" id="run-cwd" value="${esc(orchCwd)}">
            <button type="button" class="orch-cwd-btn" id="run-cwd-btn" data-act="cwd-open" title="Folder the agent works in">${icon("folder", 13)} <span id="run-cwd-lbl">${esc(cwdLabel(orchCwd))}</span></button>
          </div>
        </div>
        <button type="button" class="bar-icon orch-more-btn ${orchDeckOpen ? "on" : ""}" data-act="orch-deck-toggle" title="Role, model, effort, more agents, routines" aria-label="Options">${icon("settings", 15)}</button>
        <button class="btn peach" id="run-submit" type="submit" ${ready.length ? "" : "disabled"}>Run ${icon("play", 13)}</button>
      </div>
      <div class="orch-presets">
        <div class="orch-roles" role="radiogroup" aria-label="Role preset">
          ${ORCH_ROLES.map(([k, l]) => `<button type="button" class="fchip ${orchRole === k ? "on" : ""}" data-act="orch-role" data-role="${esc(k)}">${esc(l)}</button>`).join("")}
        </div>
        <div class="orch-multi" id="run-multi"></div>
        <div class="orch-routines">
          <select class="pick" id="run-model" aria-label="Model" hidden></select>
          <div class="seg" id="run-effort" role="radiogroup" aria-label="Effort" hidden></div>
          ${Object.entries(D?.routines ? ROUTINES : {}).map(([k, [name, desc]]) => {
            const r = S.tasks?.find((t) => t.routine === k && !t.end);
            return `<button type="button" class="fchip orch-rt" data-act="routine" data-k="${k}" title="${esc(desc)}" ${r ? "disabled" : ""}>${icon(k === "inbox" ? "inbox" : "target", 13)} ${esc(name)}</button>`;
          }).join("")}
        </div>
      </div>
      ${ready.length ? "" : "<small>No agent is set up yet: see README › Agents.</small>"}
      <div class="cwd-pop" id="cwd-pop" hidden></div>
    </form>
    <div class="orch-work ${orchRail ? "" : "rail-shut"} ${orchRail && orchRailMode === "float" ? "rail-float" : ""}" id="agents-body"></div>
  </div>`;
  // The task bar floats over the canvas (the ✦ button): it folds away once a task started (the prompt is cleared).
  const ran = () => { if (!$("#run-prompt")?.value) deckShow(false); };
  $("#run").onsubmit = (e) => { e.preventDefault(); runPrompt().then(ran); };
  $("#run-agent").onchange = () => { orchExtra.delete($("#run-agent").value); runOptions(); renderMultiChips(); };
  $("#run-model").onchange = () => runOptions(true);
  runOptions();
  renderMultiChips();
  loadTerminals();
  $("#run-prompt").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runPrompt().then(ran); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); deckShow(false); }
  };
  agentsBody();
  if (afterCanvas) { const make = afterCanvas; afterCanvas = null; make(); } // a hand-off from another page (toCanvas)
  orchTimer = setInterval(() => { if (route().pg !== "agents") return clearInterval(orchTimer); orchPaint(); pollHandoffs(); takeSpawns(); }, 2000);
  ambient(art("agents"));
}
function renderMultiChips() {
  const box = $("#run-multi");
  if (!box) return;
  const primary = $("#run-agent")?.value;
  const others = (S.runners || []).filter((r) => r.ready && r.id !== primary);
  box.innerHTML = others.map((r) => `<button type="button" class="fchip ${orchExtra.has(r.id) ? "on" : ""}" data-act="orch-extra" data-id="${esc(r.id)}" title="Also dispatch in parallel to ${esc(r.name)}">+ ${esc(r.name)}</button>`).join("");
  const sub = $("#run-submit"), n = 1 + orchExtra.size;
  if (sub) sub.innerHTML = `Run${n > 1 ? ` (${n})` : ""} ${icon("play", 14)}`;
}
// Canvas shortcuts, tmux-style, on Ctrl+Alt so they work even while a terminal has the keyboard (capture phase,
// before the terminal sees the key) without taking keys a shell or TUI uses.
const PANE_KEYS = "Right-click: the menu of a card or of the canvas · Ctrl+Alt: ←/→ next/previous card · 1–9 jump · Enter maximize · T terminal · N agent · W close · F fit · B background · M map · Z full screen · R reload · / this help · Alt+drag moves a card";
// Full screen: the canvas takes the whole monitor (the page chrome hides, the window goes fullscreen).
// While a terminal or card has focus, Esc belongs to it (Keyboard Lock stops the browser from eating the first Esc);
// clicking an empty spot on the canvas blurs the card so Esc leaves full screen.
const inCanvasCardFocus = () => Boolean(
  document.activeElement?.closest?.(".orch-pane, input, textarea, select, [contenteditable]") ||
  document.querySelector(".orch-pane.typing")
);
function blurCanvasFocus(keepSel = false) {
  for (const st of terms.values()) st.term?.blur?.();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  $("#orch-plane")?.querySelectorAll(".orch-pane").forEach((n) => n.classList.remove("typing", "active"));
  document.querySelectorAll(".orch-item.on").forEach((n) => n.classList.remove("on"));
  orchActive = "";
  if (!keepSel && orchSelected.size) { orchSelected.clear(); updateSelectionUI(); }
}
// The whole app in the browser's full screen (no tabs or address bar) on any page: F or the header button.
// It survives page changes; the canvas's and an embedded app's full screen leave it on when they close.
// Esc stays with the page (dialogs, terminals); F, the button or holding Esc leave it.
let appFull = false;
function appFullToggle(on = !document.fullscreenElement) {
  appFull = on;
  if (on) document.documentElement.requestFullscreen?.().then(() => navigator.keyboard?.lock?.(["Escape"])?.catch?.(() => {})).catch(() => { appFull = false; });
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
document.addEventListener("fullscreenchange", () => {
  const on = !!document.fullscreenElement, b = $("#full-btn");
  if (!on) { appFull = false; navigator.keyboard?.unlock?.(); }
  if (b) { b.classList.toggle("on", on); b.title = on ? "Leave full screen (F)" : "Full screen (F)"; }
});
function canvasFull(on = !document.body.classList.contains("canvas-full")) {
  document.body.classList.toggle("canvas-full", on);
  if (on) {
    navigator.keyboard?.lock?.(["Escape"])?.catch?.(() => {});
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => navigator.keyboard?.lock?.(["Escape"])?.catch?.(() => {})).catch(() => {});
    }
  } else if (!appFull) {
    navigator.keyboard?.unlock?.();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  orchSigs.clear(); setTimeout(() => orchPaint(true), 60); // terminals refit to the new size
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("canvas-full") && !inCanvasCardFocus()) canvasFull(false);
});
window.addEventListener("keydown", (e) => {
  if (!e.ctrlKey || !e.altKey || e.metaKey || route().pg !== "agents") return;
  const keys = orchPanes.map(paneKey), i = keys.indexOf(orchActive);
  const act = {
    ArrowRight: () => keys.length && focusPane(keys[(i + 1) % keys.length]),
    ArrowLeft: () => keys.length && focusPane(keys[(i - 1 + keys.length) % keys.length]),
    Enter: () => { if (orchActive) { orchMax = orchMax ? "" : orchActive; orchSigs.clear(); agentsBody(); setTimeout(() => focusPane(orchActive), 80); } },
    KeyT: () => newTermPane(),
    KeyN: () => newAgentTerm(defaultAgent()),
    KeyW: () => orchActive && ACTIONS["orch-unpin"]({ dataset: { key: orchActive } }),
    KeyF: () => { if (orchMode === "free") { fitCanvasView(); saveCanvas(); } },
    KeyB: () => { if (orchMode === "free") cycleCanvasBg(); },
    KeyZ: () => canvasFull(),
    KeyR: () => location.reload(),
    Slash: () => toast(PANE_KEYS),
  }[e.code];
  const digit = /^Digit([1-9])$/.exec(e.code);
  const run = digit ? () => keys[digit[1] - 1] && focusPane(keys[digit[1] - 1]) : act;
  if (!run) return;
  e.preventDefault(); e.stopPropagation();
  run();
}, true);
// Space held = pan; bound once (the canvas element is rebuilt on every visit to #/agents).
let isSpacePressed = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.closest("input, textarea, select, [contenteditable], .orch-sketch") && !isSpacePressed) {
    isSpacePressed = true;
    if (orchMode === "free" && !orchMax) $("#orch-canvas")?.classList.add("space-pan");
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") { isSpacePressed = false; $("#orch-canvas")?.classList.remove("space-pan"); }
});
// Windows fires contextmenu after the button comes up: on the menu that just opened, or on the card a right-drag ended
// over. Neither should get a menu (the browser's, or the card's).
let rightPanAt = 0;
document.addEventListener("contextmenu", (e) => {
  if (e.target.closest?.(".ctx-menu") || Date.now() - rightPanAt < 400) { e.preventDefault(); e.stopPropagation(); }
}, true);
// The empty canvas (and its hint, which covers it when there are no cards); not an icon in a button or a card.
const onCanvasBg = (t, canvas) => t === canvas || t.id === "orch-plane" || t.classList?.contains("orch-links") || !!t.closest?.(".orch-empty");
function bindCanvasInteractions(canvas) {

  canvas.addEventListener("pointerdown", (e) => {
    const isBg = onCanvasBg(e.target, canvas);
    if (isBg) blurCanvasFocus(e.shiftKey || e.metaKey || e.ctrlKey);
    if (isBg) deckShow(false); // a click on the canvas folds the task bar away, like a popover
    if (orchMode !== "free" || orchMax) return;
    // Over a card the mouse belongs to it (a terminal's middle-click paste, right-click, selection): only the
    // background pans, with the middle or right button, the Pan tool or Space held.
    if (!isBg && !isSpacePressed) return;

    if (e.button === 1 || e.button === 2 || isSpacePressed || (orchTool === "pan" && e.button === 0 && isBg)) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      const startX = orchPanX, startY = orchPanY, x0 = e.clientX, y0 = e.clientY;
      let moved = false;
      canvas.classList.add("panning");
      const movePan = (ev) => {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 4) moved = true;
        orchPanX = Math.round(startX + (ev.clientX - x0));
        orchPanY = Math.round(startY + (ev.clientY - y0));
        applyCanvasTransform();
      };
      const upPan = () => {
        window.removeEventListener("pointermove", movePan);
        window.removeEventListener("pointerup", upPan);
        canvas.classList.remove("panning");
        saveCanvas();
        // A right-click that didn't drag is a click: the canvas menu (here, not on contextmenu, which fires on the
        // press on Linux and macOS, before we know whether it's a drag).
        if (e.button === 2) { rightPanAt = Date.now(); if (!moved) canvasMenu(x0, y0); }
      };
      window.addEventListener("pointermove", movePan);
      window.addEventListener("pointerup", upPan);
      return;
    }

    if (e.button === 0 && isBg) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      const x0 = e.clientX, y0 = e.clientY;
      const r = canvas.getBoundingClientRect();
      const sx0 = x0 - r.left, sy0 = y0 - r.top;
      
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        orchSelected.clear();
        updateSelectionUI();
      }
      const initialSelection = new Set(orchSelected);

      let marquee = canvas.querySelector(".orch-marquee");
      if (!marquee) {
        marquee = document.createElement("div");
        marquee.className = "orch-marquee";
        canvas.appendChild(marquee);
      }
      marquee.style.display = "none";
      let hasDragged = false;

      const moveMarquee = (ev) => {
        const curX = ev.clientX, curY = ev.clientY;
        const curSx = curX - r.left, curSy = curY - r.top;
        const left = Math.min(sx0, curSx), top = Math.min(sy0, curSy);
        const width = Math.abs(curSx - sx0), height = Math.abs(curSy - sy0);

        if (width > 3 || height > 3) {
          hasDragged = true;
          marquee.style.display = "block";
          marquee.style.left = `${left}px`;
          marquee.style.top = `${top}px`;
          marquee.style.width = `${width}px`;
          marquee.style.height = `${height}px`;

          const boxX1 = (left - orchPanX) / orchZoom;
          const boxY1 = (top - orchPanY) / orchZoom;
          const boxX2 = (left + width - orchPanX) / orchZoom;
          const boxY2 = (top + height - orchPanY) / orchZoom;

          for (const p of orchPanes) {
            ensurePaneRect(p);
            const k = paneKey(p);
            const pX1 = p.x, pY1 = p.y, pX2 = p.x + p.w, pY2 = p.y + p.h;
            const intersects = (pX1 < boxX2 && pX2 > boxX1 && pY1 < boxY2 && pY2 > boxY1);
            if (intersects) orchSelected.add(k);
            else if (!initialSelection.has(k)) orchSelected.delete(k);
          }
          updateSelectionUI();
        }
      };

      const upMarquee = () => {
        window.removeEventListener("pointermove", moveMarquee);
        window.removeEventListener("pointerup", upMarquee);
        if (marquee) marquee.style.display = "none";
        if (!hasDragged && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          orchSelected.clear();
          updateSelectionUI();
        }
      };
      window.addEventListener("pointermove", moveMarquee);
      window.addEventListener("pointerup", upMarquee);
    }
  });

  // Right-click: a card's menu, or the canvas's (free canvas: opened on release, as right-drag pans). Text fields keep the
  // browser's own menu (spelling, paste).
  canvas.addEventListener("contextmenu", (e) => {
    if (e.target.closest("textarea:not(.xterm-helper-textarea), input, .orch-sketch")) return; // Excalidraw has its own menu
    e.preventDefault();
    const card = e.target.closest(".orch-pane");
    if (card) paneMenu(card.dataset.key, e.clientX, e.clientY);
    else if (orchMode !== "free" || orchMax) canvasMenu(e.clientX, e.clientY);
  });

  canvas.addEventListener("wheel", (e) => {
    if (orchMode !== "free" || orchMax) return;
    const isBg = onCanvasBg(e.target, canvas);
    // Like Maestri: the wheel (or a two-finger swipe) pans the background; Ctrl/Alt + wheel (or a pinch) zooms, over a
    // card too. A plain wheel over a card is the card's (a terminal scrolls back).
    const zoom = e.ctrlKey || e.metaKey || e.altKey;
    if (!isBg && !zoom) return;
    e.preventDefault();
    if (!zoom) {
      orchPanX = Math.round(orchPanX - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX));
      orchPanY = Math.round(orchPanY - (e.shiftKey && !e.deltaX ? 0 : e.deltaY));
      applyCanvasTransform(); saveCanvasSoon(); // the links move with the plane: no redraw
      return;
    }
    e.stopPropagation(); // a terminal under the pointer must not scroll as well
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const k = Math.min(2.5, Math.max(0.2, orchZoom * Math.exp(-e.deltaY * 0.002)));
    orchPanX = Math.round(sx - (sx - orchPanX) * (k / orchZoom));
    orchPanY = Math.round(sy - (sy - orchPanY) * (k / orchZoom));
    orchZoom = Math.round(k * 1000) / 1000;
    applyCanvasTransform();
    saveCanvasSoon();
  }, { passive: false, capture: true }); // capture: xterm's scroller stops the wheel before it bubbles
  // Fleet chats and vault notes are dragged in from the left rail (HTML drag and drop).
  canvas.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes(PANE_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; canvas.classList.add("drop"); } });
  canvas.addEventListener("dragleave", (e) => { if (!canvas.contains(e.relatedTarget)) canvas.classList.remove("drop"); });
  canvas.addEventListener("drop", (e) => {
    canvas.classList.remove("drop");
    const raw = e.dataTransfer.getData(PANE_MIME);
    if (!raw) return;
    e.preventDefault();
    const { kind, id } = JSON.parse(raw), r = canvas.getBoundingClientRect();
    addPane({ kind, id }, (e.clientX - r.left - orchPanX) / orchZoom, (e.clientY - r.top - orchPanY) / orchZoom);
  });
}
function bindPaneDragResize(card, p) {
  const head = card.querySelector(".orch-head"), port = card.querySelector(".orch-port");
  if (head) {
    const startMove = (e) => {
      if (orchMode !== "free" || orchMax || e.button !== 0 || e.target.closest("button, a, select, input")) return;
      e.preventDefault();
      // preventDefault keeps focus where it was: a terminal typed into before would still take Delete, not the canvas.
      if (document.activeElement?.closest?.(".orch-pane")) document.activeElement.blur();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      const curKey = paneKey(p);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (orchSelected.has(curKey)) orchSelected.delete(curKey);
        else orchSelected.add(curKey);
      } else if (!orchSelected.has(curKey)) {
        orchSelected.clear();
        orchSelected.add(curKey);
      }
      orchActive = curKey;
      updateSelectionUI();

      const plane = $("#orch-plane");
      const targets = (orchSelected.has(curKey) && orchSelected.size > 0)
        ? [...orchSelected].map((k) => orchPanes.find((x) => paneKey(x) === k)).filter(Boolean)
        : [p];
      targets.forEach(ensurePaneRect);
      const startPositions = targets.filter((tp) => !tp.locked).map((tp) => ({
        p: tp,
        x: tp.x,
        y: tp.y,
        el: plane ? plane.querySelector(`.orch-pane[data-key="${CSS.escape(paneKey(tp))}"]`) : null
      }));

      const x0 = e.clientX, y0 = e.clientY;
      let moved = false;
      const move = (ev) => {
        const dx = Math.round((ev.clientX - x0) / orchZoom);
        const dy = Math.round((ev.clientY - y0) / orchZoom);
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        for (const item of startPositions) {
          item.p.x = item.x + dx;
          item.p.y = item.y + dy;
          if (item.el) {
            item.el.style.left = `${item.p.x}px`;
            item.el.style.top = `${item.p.y}px`;
          }
        }
        drawLinks();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!moved && !e.shiftKey && !e.metaKey && !e.ctrlKey && orchSelected.size > 1) {
          orchSelected.clear();
          orchSelected.add(curKey);
          updateSelectionUI();
        }
        saveCanvas();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    head.addEventListener("pointerdown", startMove);
    // Alt+drag moves a card from anywhere, like a window manager: a bare terminal has no title bar to grab.
    card.addEventListener("pointerdown", (e) => { if (e.altKey && e.button === 0) { e.stopPropagation(); startMove(e); } }, true);
  }
  // Invisible edges and corners: only the cursor says "resize" (no highlight, no tooltip).
  ["nw", "ne", "sw", "se", "n", "s", "e", "w"].forEach((c) => {
    const r = document.createElement("div");
    r.className = `orch-resize ${c}`;
    card.appendChild(r);
    r.addEventListener("pointerdown", (e) => {
      if (orchMode !== "free" || orchMax || p.locked) return;
      e.preventDefault(); e.stopPropagation();
      try { r.setPointerCapture(e.pointerId); } catch {}
      ensurePaneRect(p);
      const corner = c; // which edge or corner this handle moves: n/s/e/w and their pairs
      const x0 = e.clientX, y0 = e.clientY;
      const startX = p.x, startY = p.y, startW = p.w, startH = p.h;
      const move = (ev) => {
        const dx = (ev.clientX - x0) / orchZoom;
        const dy = (ev.clientY - y0) / orchZoom;
        let nextW = startW, nextH = startH, nextX = startX, nextY = startY;

        if (corner.includes("e")) {
          nextW = Math.max(280, Math.min(2600, Math.round(startW + dx)));
        } else if (corner.includes("w")) {
          const clampedW = Math.max(280, Math.min(2600, Math.round(startW - dx)));
          nextX = Math.round(startX + (startW - clampedW));
          nextW = clampedW;
        }

        if (corner.includes("s")) {
          nextH = Math.max(180, Math.min(1800, Math.round(startH + dy)));
        } else if (corner.includes("n")) {
          const clampedH = Math.max(180, Math.min(1800, Math.round(startH - dy)));
          nextY = Math.round(startY + (startH - clampedH));
          nextH = clampedH;
        }

        p.x = nextX; p.y = nextY; p.w = nextW; p.h = nextH;
        card.style.left = `${p.x}px`; card.style.top = `${p.y}px`;
        card.style.width = `${p.w}px`; card.style.height = `${p.h}px`;
        drawLinks();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        saveCanvas();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  });
  // Drag from the ● port to another card: this card's content then goes along as context when you message that one.
  if (port) {
    port.addEventListener("pointerdown", (e) => {
      if (orchMode !== "free" || orchMax) return;
      e.preventDefault(); e.stopPropagation();
      try { port.setPointerCapture(e.pointerId); } catch {}
      const from = card.dataset.key, cr = $("#orch-canvas").getBoundingClientRect();
      const move = (ev) => drawLinks([p.x + p.w, p.y + p.h / 2, (ev.clientX - cr.left - orchPanX) / orchZoom, (ev.clientY - cr.top - orchPanY) / orchZoom]);
      const up = (ev) => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
        const to = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".orch-pane")?.dataset.key;
        if (to && to !== from && !orchLinks.some((l) => l.a === from && l.b === to)) {
          orchLinks.push({ a: from, b: to });
          saveCanvas();
          toast("Linked: this card now goes along as context");
          orchSigs.clear(); orchPaint(true);
        } else drawLinks();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }
}
function agentsBody() {
  const el = $("#agents-body");
  if (!el) return;
  el.classList.toggle("rail-shut", !orchRail);
  el.classList.toggle("rail-float", orchRail && orchRailMode === "float");
  const all = fleetItems();
  const counts = { all: all.length };
  const validKeys = new Set(all.map(paneKey)), notePaths = new Set(D.notes.map((n) => n.path));
  orchPanes = orchPanes.filter((p) => p && (p.kind === "sticky" || p.kind === "terminal" || (p.kind === "note" ? notePaths.has(p.id) : validKeys.has(paneKey(p)))));
  // Agents run in terminals (like Maestri): a task or session card turns into its own TUI as soon as nothing else
  // drives it; only a session running elsewhere (another terminal, a waiting background job) stays a read-only card.
  for (const p of [...orchPanes]) if (p.kind === "task" || p.kind === "agent") {
    const run = all.find((x) => x.kind === p.kind && x.id === p.id)?.tui;
    if (run) tuiInPlace(p, run);
  }
  orchPanes.forEach(ensurePaneRect);
  if (orchActive && !orchPanes.some((p) => paneKey(p) === orchActive)) orchActive = orchMode === "free" ? "" : (orchPanes[0] ? paneKey(orchPanes[0]) : "");
  if (!orchActive && orchMode !== "free" && orchPanes[0]) orchActive = paneKey(orchPanes[0]);
  if (orchMax && !orchPanes.some((p) => paneKey(p) === orchMax)) orchMax = "";
  document.querySelectorAll("[data-act='orch-mode']").forEach((b) => b.classList.toggle("on", b.dataset.m === orchMode));
  if (!el.querySelector(".orch-canvas")) {
    el.innerHTML = `<div class="orch-fleet-wrap ${orchRailMode === "float" ? "float" : ""}" id="orch-fleet-wrap">
        <button type="button" class="orch-fleet-pill glass" data-act="orch-rail-open" title="Sessions (A)">${icon("cols", 13)} <span>Sessions <small id="orch-fleet-pill-cnt"></small></span></button>
        <aside class="orch-fleet glass ${orchRailMode === "float" ? "floating" : ""}">
          <div class="orch-fleet-head">
            <div class="orch-fleet-title"><span>Sessions</span> <small id="orch-fleet-badge"></small></div>
            <div class="orch-fleet-acts">
              <button type="button" class="fl-icon ${orchRailMode === "float" ? "" : "on"}" data-act="orch-rail-mode" title="${orchRailMode === "float" ? "Keep Sessions open beside the canvas" : "Let Sessions float over the canvas"}">${icon("pin", 13)}</button>
            </div>
          </div>
          <input id="orch-fq" class="orch-fq" type="search" placeholder="Search sessions" autocomplete="off" aria-label="Search sessions">
          <div class="orch-list" id="orch-list"></div>
          <details class="orch-ledger" id="orch-ledger">
            <summary id="orch-ledger-sum"></summary>
            <div class="orch-ledger-cols" id="orch-ledger-cols"></div>
          </details>
        </aside>
      </div>
      <div class="orch-canvas" id="orch-canvas">
        <div class="orch-plane" id="orch-plane"></div>
        <nav class="cv-island cv-tl" aria-label="Canvas menu">
          <button type="button" class="cv-tl-btn" data-act="cv-menu" title="Menu: search, capture, layout" aria-label="Menu">${icon("menu", 18)}</button>
        </nav>
        <div class="cv-island orch-hud" id="orch-hud" role="toolbar" aria-label="Canvas tools"></div>
        <div class="cv-island orch-hud cv-br" id="orch-hud-br" role="toolbar" aria-label="View"></div>
        <div class="cv-island cv-map" id="orch-map" hidden>
          <svg role="img" aria-label="Map of the canvas: click or drag to move the view"></svg>
          <button type="button" class="cv-map-x" data-act="orch-map" title="Close the map (M)" aria-label="Close the map">${icon("x", 12)}</button>
        </div>
      </div>`;
    bindCanvasInteractions($("#orch-canvas"));
    addSketchLayer($("#orch-canvas"));
    bindSketchClicks($("#orch-canvas"));
    magnify($(".cv-tl"), 0, true); magnify($("#orch-hud"), 10); magnify($("#orch-hud-br"), -10);
    bindMap($("#orch-map"));
    hoverMenu($('.cv-tl [data-act="cv-menu"]'), mainMenu);
  }
  const fleetBadge = $("#orch-fleet-badge"), fleetPillCnt = $("#orch-fleet-pill-cnt"), pill = el.querySelector(".orch-fleet-pill"), fleetEl = el.querySelector(".orch-fleet"), fleetWrap = $("#orch-fleet-wrap");
  if (fleetBadge) fleetBadge.textContent = counts.all;
  const waiting = all.filter((x) => x.group === "waiting").length;
  if (fleetPillCnt) fleetPillCnt.textContent = waiting ? `${waiting} waiting` : "";
  pill?.classList.toggle("wait", waiting > 0);
  if (fleetWrap) fleetWrap.classList.toggle("float", orchRailMode === "float");
  if (fleetEl) fleetEl.classList.toggle("floating", orchRailMode === "float");
  const pinnedKeys = new Set(orchPanes.map(paneKey));
  // The sessions, grouped by what they need from you, and one search over them.
  const fq = $("#orch-fq");
  if (fq && !fq.oninput) { fq.value = orchNoteQ; fq.oninput = () => { orchNoteQ = fq.value; agentsBody(); }; }
  const q = fold(orchNoteQ.trim());
  const tuiOn = (it) => it.tui && orchPanes.some((p) => p.kind === "terminal" && p.run && ((it.tui.task && p.run.task === it.tui.task) || (it.tui.key && p.run.key === it.tui.key)));
  const row = (it) => {
    const k = paneKey(it), on = pinnedKeys.has(k) || tuiOn(it);
    const x = it.kind === "terminal" ? `data-act="term-close-session" data-id="${esc(it.id)}" title="Close this terminal"`
      : `data-act="orch-dismiss" data-kind="${it.kind}" data-id="${esc(it.id)}" title="${it.kind === "task" ? "Delete this task" : "Hide from Sessions"}"`;
    return `<div class="orch-item ${it.group} ${orchActive === k ? "on" : ""} ${on ? "oncanvas" : ""}" draggable="true" data-kind="${it.kind}" data-id="${esc(it.id)}">
      <button type="button" class="orch-item-main" data-act="orch-sel" data-kind="${it.kind}" data-id="${esc(it.id)}" title="${on ? "Show it on the canvas" : "Open it on the canvas"}">
        <span class="fl-dot"></span>
        <span class="orch-info"><b>${esc(it.title)}</b><small>${esc(it.needs || [on ? "on canvas" : "", it.sub].filter(Boolean).join(" · "))}</small></span>
      </button>
      <div class="orch-item-actions"><button type="button" class="orch-dismiss-btn" ${x} aria-label="Remove">${icon("x", 11)}</button></div>
    </div>`;
  };
  const hits = all.filter((it) => !q || fold(`${it.title} ${it.sub} ${it.needs}`).includes(q));
  $("#orch-list").innerHTML = [["waiting", "Needs you"], ["active", "Running"], ["done", "Recent"]].map(([g, l]) => {
    const xs = hits.filter((it) => it.group === g);
    return xs.length ? `<div class="fl-group">${l} <small>${xs.length}</small></div>${xs.map(row).join("")}` : "";
  }).join("") || `<p class="empty">${q ? "Nothing matches." : "No sessions yet. Start one from the bar above."}</p>`;
  // The vault's agent log, folded at the bottom: 9 Agent isn't a notes folder, so this is where Overlook shows it.
  $("#orch-ledger-sum").innerHTML = `<span>Vault log</span><small>${D.log.length} runs · ${D.findings.length} findings</small>`;
  $("#orch-ledger-cols").innerHTML = `<div><h3>Log</h3><div class="list">${D.log.slice(0, 12).map((l) => {
      const [when, who, ...rest] = l.split(" · ");
      return `<div class="row"><span class="who">${esc(who)}</span><span class="txt">${withLinks(rest.join(" · "))}</span><span class="x">${esc(when.slice(5).replace("-", "/"))}</span></div>`;
    }).join("") || '<p class="empty">No runs logged.</p>'}</div></div>
    <div><h3>Findings</h3><div class="list">${D.findings.slice(0, 10).map((a) => {
      const [d, ...t] = a.split(" · ");
      return `<div class="row"><span class="txt">${esc(t.join(" · "))}</span><span class="x">${esc(d)}</span></div>`;
    }).join("") || '<p class="empty">No findings yet.</p>'}</div></div>`;
  orchPaint();
}
function bindSplitResizer(plane) {
  let bar = plane.querySelector(".orch-resizer");
  if (orchMode !== "tile" || orchMax || orchPanes.length !== 2 || orchDir === "grid") {
    bar?.remove();
    plane.style.gridTemplateColumns = "";
    plane.style.gridTemplateRows = "";
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.className = `orch-resizer ${orchDir}`;
    bar.innerHTML = "<i></i>";
    bar.title = "Drag to resize split · Double-click to reset 50/50";
    bar.ondblclick = () => { orchRatio = 50; bindSplitResizer(plane); };
    bar.onpointerdown = (e) => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      bar.classList.add("dragging");
      const rect = plane.getBoundingClientRect();
      const move = (ev) => {
        const pct = orchDir === "rows" ? ((ev.clientY - rect.top) / rect.height) * 100 : ((ev.clientX - rect.left) / rect.width) * 100;
        orchRatio = Math.max(22, Math.min(78, Math.round(pct)));
        bindSplitResizer(plane);
      };
      const up = () => { bar.classList.remove("dragging"); bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); };
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", up);
    };
    plane.appendChild(bar);
  }
  bar.className = `orch-resizer ${orchDir}`;
  const panes = [...plane.querySelectorAll(".orch-pane")];
  if (panes.length === 2 && bar.previousElementSibling !== panes[0]) plane.insertBefore(bar, panes[1]);
  if (orchDir === "rows") {
    plane.style.gridTemplateColumns = "minmax(0, 1fr)";
    plane.style.gridTemplateRows = `minmax(0, ${orchRatio}fr) 10px minmax(0, ${100 - orchRatio}fr)`;
  } else {
    plane.style.gridTemplateRows = "minmax(0, 1fr)";
    plane.style.gridTemplateColumns = `minmax(0, ${orchRatio}fr) 10px minmax(0, ${100 - orchRatio}fr)`;
  }
}
function detectQuota(t) {
  if (!t) return null;
  if (t.quota?.exhausted) {
    let resetsIn = t.quota.resetsIn || t.quota.resetIn;
    if (!resetsIn && t.quota.resetAt) {
      const ms = Math.max(0, new Date(t.quota.resetAt).getTime() - Date.now());
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      resetsIn = `${h}h${m}m${s}s`;
    } else if (resetsIn && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(resetsIn)) {
      const ms = Math.max(0, new Date(resetsIn).getTime() - Date.now());
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      resetsIn = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    return {
      exhausted: true,
      message: t.quota.message || "Individual quota reached for this model.",
      resetsIn: resetsIn || "",
      model: t.quota.model || t.model,
      agent: t.agent,
    };
  }
  const evs = t.events || [];
  for (let i = evs.length - 1; i >= 0; i--) {
    const e = evs[i], txt = e?.txt || "";
    if (/RESOURCE_EXHAUSTED|429|Individual quota reached|quota exceeded|rate limit exceeded/i.test(txt)) {
      const resetMatch = txt.match(/resets in\s+([0-9a-z\s]+?)(?:\.|\n|$)/i);
      const resetsIn = resetMatch ? resetMatch[1].trim() : "";
      return {
        exhausted: true,
        message: txt.length > 200 ? txt.slice(0, 200) + "…" : txt,
        resetsIn,
        model: t.model,
        agent: t.agent,
      };
    }
  }
  return null;
}

function renderQuotaBanner(t, paneKeyStr) {
  const q = detectQuota(t);
  if (!q) return "";
  const runner = (S.runners || []).find((r) => r.id === t.agent);
  const ms = (runner?.models || []).map((m) => typeof m === "string" ? { id: m, label: m } : { id: m.id, label: m.label || m.id });
  const otherModels = ms.filter((m) => m.id !== (t.model || q.model));
  const suggested = otherModels.find((m) => /flash/i.test(m.id) || /flash/i.test(m.label))
    || otherModels.find((m) => /haiku/i.test(m.id) || /haiku/i.test(m.label))
    || otherModels.find((m) => /sonnet/i.test(m.id) || /sonnet/i.test(m.label))
    || otherModels[0];
  
  let actionsHtml = "";
  if (suggested) {
    actionsHtml = `<button type="button" class="btn peach quota-cta-btn" data-act="quota-retry" data-task="${esc(t.id)}" data-model="${esc(suggested.id)}" data-pane="${esc(paneKeyStr || "")}" data-agent="${esc(t.agent || "")}" data-prompt="${esc(t.prompt || "")}" data-effort="${esc(t.effort || "")}">Switch to ${esc(suggested.label)} &amp; Retry</button>`;
    if (otherModels.length > 1) {
      actionsHtml += `<div class="quota-dropdown-wrap">
        <select class="pick quota-model-sel" aria-label="Select alternate model">
          ${otherModels.map((m) => `<option value="${esc(m.id)}" ${m.id === suggested.id ? "selected" : ""}>${esc(m.label)}</option>`).join("")}
        </select>
        <button type="button" class="btn glass quota-custom-btn" data-act="quota-retry-sel" data-task="${esc(t.id)}" data-pane="${esc(paneKeyStr || "")}" data-agent="${esc(t.agent || "")}" data-prompt="${esc(t.prompt || "")}" data-effort="${esc(t.effort || "")}">Retry</button>
      </div>`;
    }
  } else {
    actionsHtml = `<button type="button" class="btn peach quota-cta-btn" data-act="quota-retry" data-task="${esc(t.id)}" data-model="${esc(t.model || "")}" data-pane="${esc(paneKeyStr || "")}" data-agent="${esc(t.agent || "")}" data-prompt="${esc(t.prompt || "")}" data-effort="${esc(t.effort || "")}">Retry</button>`;
  }

  return `<div class="quota-alert glass" data-task-id="${esc(t.id)}">
    <div class="quota-head">
      <span class="quota-badge"><span class="quota-badge-dot"></span> Quota Exhausted</span>
      ${q.resetsIn ? `<span class="quota-countdown">${icon("clock", 13)} Resets in ${esc(q.resetsIn)}</span>` : ""}
    </div>
    <div class="quota-msg">${fmt(q.message)}</div>
    <div class="quota-actions">${actionsHtml}</div>
  </div>`;
}

async function retryTask(taskId, model, paneKeyStr, opts = {}) {
  const cachedTask = S?.tasks?.find((x) => x.id === taskId) || {};
  const btn = $(`[data-task="${taskId}"]`);
  const agent = opts.agent || btn?.dataset?.agent || cachedTask.agent;
  const prompt = opts.prompt || btn?.dataset?.prompt || cachedTask.prompt;
  const effort = opts.effort || btn?.dataset?.effort || cachedTask.effort;
  model = model || opts.model || btn?.dataset?.model || cachedTask.model;

  let res;
  try {
    toast(`Switching to ${model || "alternate model"} & retrying…`);
    res = await api("/api/task/retry", { id: taskId, model });
    if (!res || !res.id) throw new Error("Retry did not return a valid task ID");
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("404") || /task not found/i.test(msg)) {
      toast("Task session expired. Re-dispatching as a new task…");
      if (prompt && agent) {
        try {
          res = await api("/api/run", { agent, prompt, model, effort });
          if (!res || !res.id) throw new Error("Re-dispatch did not return a valid task ID");
        } catch (dispatchErr) {
          return toast(`Re-dispatch failed: ${dispatchErr.message}`);
        }
      } else {
        return;
      }
    } else {
      return toast(`Retry failed: ${err.message}`);
    }
  }

  if (!res || !res.id) return;
  if (paneKeyStr || (route().pg === "agents" && orchPanes.some((x) => x.kind === "task" && x.id === taskId))) {
    const p = orchPanes.find((x) => (paneKeyStr && paneKey(x) === paneKeyStr) || (x.kind === "task" && x.id === taskId));
    if (p) {
      const oldKey = paneKey(p);
      p.id = res.id;
      const newKey = paneKey(p);
      rekey(oldKey, newKey);
      orchSigs.delete(oldKey);
      orchSigs.delete(newKey);
      if (orchActive === oldKey) orchActive = newKey;
      if (orchMax === oldKey) orchMax = newKey;
      saveCanvas();
    }
    S = await api("/api/system");
    agentsBody();
    orchPaint(true);
    toast(`Switched to ${model || "new task"} & retrying in tile`);
    return;
  }
  
  toast(`Switched to ${model || "new task"} & retrying`);
  location.hash = `#/t/${encodeURIComponent(res.id)}`;
}

// Every card is a window: traffic lights (close · minimize · maximize), a centered title, actions on hover.
// A name the user gave the card (right-click › Rename) wins over the title it would show.
const winHead = (key, title0, sub, acts = "", title = orchPanes.find((x) => paneKey(x) === key)?.name || title0) => `<div class="win-lights">
    <button type="button" class="wl close" data-act="orch-unpin" data-key="${esc(key)}" title="Close (Ctrl+Alt+W)" aria-label="Close"></button>
    <button type="button" class="wl min" data-act="orch-collapse" data-key="${esc(key)}" title="Minimize to the title bar" aria-label="Minimize"></button>
    <button type="button" class="wl max" data-act="orch-max" data-key="${esc(key)}" title="Maximize (Ctrl+Alt+Enter)" aria-label="Maximize"></button>
  </div><div class="win-title" title="${esc(title)}"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div><div class="orch-acts">${acts}</div>`;
// A re-render while the user is selecting text in a card would wipe the selection: wait for the next tick.
const selectingIn = (el) => { const s = getSelection(); return !!s && !s.isCollapsed && el.contains(s.anchorNode); };
// The canvas chrome, Maestri-style: small islands floating over the canvas. Top centre, the tools (select/pan, new
// agent, terminal, note, vault note, folder, task); bottom right, the view (background, fit, zoom, full screen);
// top left, the menu. Names and shortcuts live in tooltips; everything else is in the right-click menus.
function paintHud(hud, isFree) {
  if (!hud) return;
  const b = (act, ic, tip, extra = "", on = false) => `<button type="button" class="hud-btn ${on ? "on" : ""}" data-act="${act}" ${extra} title="${esc(tip)}" aria-label="${esc(tip)}">${icon(ic, 16)}</button>`;
  const sep = '<span class="orch-hud-sep"></span>', isFull = document.body.classList.contains("canvas-full");
  const full = b("canvas-full", "expand", isFull ? "Leave full screen (Esc)" : "Full screen (Ctrl+Alt+Z)", "", isFull);
  const tools = (isFree ? b("orch-tool", "select", "Select (S) · drag to select several", 'data-tool="select"', orchTool === "select") + b("orch-tool", "hand", "Pan (H, or hold Space)", 'data-tool="pan"', orchTool === "pan") + sep : "")
    + b("draw-card", "agents", "New agent: drag where it goes (Ctrl+Alt+N)", 'data-kind="agent"', drawing?.kind === "agent") + b("draw-card", "terminal", "New terminal: drag where it goes (Ctrl+Alt+T)", 'data-kind="terminal"', drawing?.kind === "terminal") + b("draw-card", "notes", "New note: drag where it goes", 'data-kind="sticky"', drawing?.kind === "sticky") + b("orch-sketch", "edit", sketchOn ? "Stop drawing (Esc)" : "Draw on the canvas (D)", "", sketchOn)
    + b("orch-vault-note", "book", "Open a vault note")
    + sep + b("orch-deck-show", "spark", "New task: a prompt for one or more agents", "", !!$("#run")?.classList.contains("show"))
    // the split has no bottom-right island (it would cover a card): its layout and full screen join the tools
    + (isFree ? "" : sep + b("orch-mode", "grid", "Canvas: free windows, pan and zoom", 'data-m="free"')
      + (orchPanes.length === 2 && !orchMax ? b("orch-dir", orchDir === "rows" ? "cols" : "split", "Side by side / stacked") : "") + full);
  // the selection shows from two cards up (one card is simply the card you clicked)
  const view = `<span class="hud-sel" id="orch-sel-cnt" ${orchSelected.size > 1 ? "" : "hidden"}>${orchSelected.size} selected</span>
    <button type="button" class="hud-btn danger" data-act="orch-del-sel" id="orch-del-sel" title="Close the selected cards (Delete)" aria-label="Close the selected cards" ${orchSelected.size > 1 ? "" : "hidden"}>${icon("trash", 16)}</button>
    ${b("orch-bg-menu", "canvasBg", `Background: ${bgEntry(orchBg)[1]} (B)`)}${b("orch-map", "map", orchMapOpen ? "Hide the map (M)" : "Show the map (M)", "", orchMapOpen)}${b("orch-fit", "max", "Fit everything in view (Ctrl+Alt+F)")}${sep}
    <button type="button" class="hud-btn" data-act="orch-zoom" data-d="-0.15" title="Zoom out" aria-label="Zoom out"><span>−</span></button>
    <button type="button" class="hud-btn hud-zoom" data-act="orch-zoom" data-d="0" title="Back to 100%"><span id="orch-zoom-lbl">${Math.round(orchZoom * 100)}%</span></button>
    <button type="button" class="hud-btn" data-act="orch-zoom" data-d="0.15" title="Zoom in" aria-label="Zoom in"><span>+</span></button>${sep}${full}`;
  // Rewritten only when it changes: a rewrite every tick drops clicks that straddle it.
  const put = (el, html) => { if (el && el.dataset.sig !== html) { el.innerHTML = html; el.dataset.sig = html; } };
  put(hud, tools);
  const br = $("#orch-hud-br");
  put(br, isFree ? view : "");
  if (br) br.hidden = !isFree;
}
// The task bar (agent, folder, role, model, a prompt for one or more agents) floats under the tools while it's open.
function deckShow(on = !$("#run")?.classList.contains("show")) {
  const deck = $("#run");
  if (!deck || deck.classList.contains("show") === on) return;
  deck.classList.toggle("show", on);
  if (on) setTimeout(() => $("#run-prompt")?.focus(), 30);
  paintHud($("#orch-hud"), orchMode === "free" && !orchMax);
}

// One menu for the canvas: right-click on a card or on the background, and the floating buttons. An item is
// { label, ic, sw (a background swatch), kbd, on (checked), off (disabled), danger, run, sub: [items] }, or "-" for a
// separator; falsy items are skipped, so a menu can list `cond && item`.
let ctxEl = null, ctxFrom = null;
function ctxClose() { ctxEl?.remove(); ctxEl = null; ctxFrom = null; }
function ctxBuild(items) {
  const box = document.createElement("div");
  box.className = "ctx-menu"; box.setAttribute("role", "menu");
  for (const it of items.filter(Boolean)) {
    if (it === "-") { if (box.lastChild && !box.lastChild.classList.contains("ctx-sep")) box.insertAdjacentHTML("beforeend", '<div class="ctx-sep" role="separator"></div>'); continue; }
    const b = document.createElement("button");
    b.type = "button"; b.className = `ctx-item${it.danger ? " danger" : ""}`; b.disabled = !!it.off; b.setAttribute("role", "menuitem");
    b.innerHTML = `<span class="ctx-ic">${it.dot ? `<i class="ctx-dot" style="background:${esc(it.dot)}"></i>` : it.sw ? `<span class="bg-sw" data-sw="${esc(it.sw)}"></span>` : it.ic ? icon(it.ic, 15) : ""}</span><span class="ctx-lbl">${esc(it.label)}</span>${it.on ? `<span class="ctx-on">${icon("check", 14)}</span>` : ""}${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ""}${it.sub ? `<span class="ctx-more">${icon("r", 13)}</span>` : ""}`;
    if (!it.sub) {
      b.onclick = (e) => { e.stopPropagation(); ctxClose(); it.run?.(e); };
      box.appendChild(b);
      continue;
    }
    const row = document.createElement("div"), sub = ctxBuild(it.sub);
    row.className = "ctx-row"; sub.classList.add("ctx-sub");
    row.append(b, sub);
    // Opens on hover, or a click / Enter (touch, keyboard), beside its row: to the left when the right has no room,
    // kept inside the window. Fixed, so a menu that scrolls (taller than the window) doesn't clip it.
    const open = () => {
      row.classList.add("open");
      const r = row.getBoundingClientRect(), w = sub.offsetWidth, h = sub.offsetHeight;
      sub.style.left = `${Math.round(r.right + w + 6 <= innerWidth ? r.right - 2 : Math.max(8, r.left - w + 2))}px`;
      sub.style.top = `${Math.round(Math.max(8, Math.min(r.top - 5, innerHeight - h - 8)))}px`;
    };
    row.addEventListener("mouseenter", open);
    row.addEventListener("mouseleave", () => row.classList.remove("open"));
    b.onclick = (e) => { e.stopPropagation(); open(); sub.querySelector(".ctx-item:not(:disabled)")?.focus(); };
    box.appendChild(row);
  }
  if (box.lastChild?.classList.contains("ctx-sep")) box.lastChild.remove();
  return box;
}
function ctxMenu(x, y, items, from = null) {
  ctxClose();
  const m = ctxBuild(items);
  if (!m.children.length) return;
  document.body.appendChild(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${Math.round(Math.max(8, Math.min(x, innerWidth - w - 8)))}px`;
  m.style.top = `${Math.round(Math.max(8, y + h > innerHeight - 8 ? y - h : y))}px`;
  ctxEl = m; ctxFrom = from;
}
// A floating button's menu opens under it (over it in the lower half of the screen); a second click closes it.
function ctxAt(btn, items) {
  if (ctxFrom === btn && ctxEl?.dataset.hover) return delete ctxEl.dataset.hover; // opened by hover: a click pins it
  if (ctxFrom === btn) return ctxClose();
  const r = btn.getBoundingClientRect();
  ctxMenu(r.left, r.bottom + 6, items, btn);
  if (ctxEl && r.top > innerHeight / 2) ctxEl.style.top = `${Math.round(Math.max(8, r.top - 6 - ctxEl.offsetHeight))}px`;
}
document.addEventListener("pointerdown", (e) => { if (ctxEl && !e.target.closest(".ctx-menu") && !ctxFrom?.contains(e.target)) ctxClose(); }, true);
// A button whose menu also opens on hover (mouse): opened that way, it folds once the pointer has left both the button
// and the menu for a moment; a click on the button pins it open like a clicked one.
function hoverMenu(btn, open) {
  if (!btn) return;
  let t = 0;
  const stay = () => clearTimeout(t);
  const leave = () => { clearTimeout(t); t = setTimeout(() => { if (ctxFrom === btn && ctxEl?.dataset.hover) ctxClose(); }, 350); };
  btn.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    stay();
    if (ctxFrom === btn) return;
    open(btn);
    if (ctxFrom !== btn) return;
    ctxEl.dataset.hover = "1";
    ctxEl.addEventListener("pointerenter", stay);
    ctxEl.addEventListener("pointerleave", leave);
  });
  btn.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") leave(); });
}
addEventListener("wheel", (e) => { if (ctxEl && !e.target.closest(".ctx-menu")) ctxClose(); }, { capture: true, passive: true });
for (const ev of ["resize", "blur", "hashchange"]) addEventListener(ev, () => ctxClose());
// Esc closes it; ↑/↓ walk its items (Enter runs one, or opens its submenu).
document.addEventListener("keydown", (e) => {
  if (!ctxEl) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ctxClose(); return; }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault(); e.stopPropagation();
  const list = [...ctxEl.querySelectorAll(".ctx-item:not(:disabled)")].filter((b) => b.offsetParent);
  const i = list.indexOf(document.activeElement);
  list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
}, true);

// Where a right-click landed in canvas coordinates: a card made from the menu opens there (free canvas only).
const canvasPt = (cx, cy) => {
  const r = $("#orch-canvas")?.getBoundingClientRect();
  return r && orchMode === "free" && !orchMax ? { x: (cx - r.left - orchPanX) / orchZoom, y: (cy - r.top - orchPanY) / orchZoom } : null;
};
const agentItems = () => [...(S.runners || []).filter((r) => r.ready && r.tui).map((r) => ({ label: r.name, ic: "agents", run: () => drawCard("agent", r.id) })),
  "-", { label: "Shell", ic: "terminal", run: () => drawCard("terminal") }];
const bgItems = () => CANVAS_BGS.map(([k, l]) => ({ label: l, sw: k, on: orchBg === k, run: () => setCanvasBg(k) }));
const paneLabel = (p) => p.name || (p.kind === "terminal" ? termName(p)
  : p.kind === "sticky" ? (p.text || "").trim().split("\n")[0].slice(0, 40) || "Note"
  : p.kind === "note" ? D.notes.find((n) => n.path === p.id)?.title || p.id
  : p.kind === "task" ? String(S.tasks?.find((t) => t.id === p.id)?.prompt || "Task").slice(0, 40)
  : S.background?.find((b) => b.key === p.id)?.title || "Session");
const copyText = (t) => navigator.clipboard?.writeText(t).then(() => toast("Copied"), () => toast("The browser didn't allow copying"));
// "Open a vault note…": the search, where the chosen note goes onto the canvas (where you right-clicked, if you did).
function openVaultNotes(at) {
  cmdkOpen((path) => { if (addPane({ kind: "note", id: path }, at?.x, at?.y)) saveCanvas(); });
}
function addSticky(at) {
  const p = { kind: "sticky", id: String(++orchSeq), text: "" };
  if (!addAt(p, at)) return;
  saveCanvas();
  setTimeout(() => $(`.orch-pane[data-key="${CSS.escape(paneKey(p))}"] .orch-sticky-input`)?.focus(), 80);
}
// `at`: a canvas point (the card's corner goes near it) or a drawn rect {x, y, w, h} (the card fills it).
const addAt = (p, at) => (at?.w ? addPane(Object.assign(p, { x: Math.round(at.x), y: Math.round(at.y), w: Math.round(at.w), h: Math.round(at.h) })) : addPane(p, at?.x, at?.y));
// A new card is drawn, Maestri-style: pick agent / terminal / note (top bar or right-click), the cursor turns into a
// crosshair, drag where it goes and how big (a click: the default size there; Esc or a right-click cancels). An agent or
// a terminal then asks, in a small sheet at that spot, what runs, its name and its folder; Shift on release skips the
// sheet (the last agent, the last folder). The split has nothing to draw on: the sheet opens straight away.
const LAST_NEW = "overlook.new-agent";
function drawCard(kind, agent) {
  endDraw();
  const canvas = $("#orch-canvas");
  if (orchMode !== "free" || orchMax || !canvas) return drawn(kind, agent, null, false);
  const layer = document.createElement("div");
  layer.className = "draw-layer";
  canvas.appendChild(layer);
  drawing = { kind, layer };
  paintHud($("#orch-hud"), true);
  // the canvas rect from corner a to b, held to the sizes a card can be resized to
  const box = (a, b) => {
    const w = Math.min(2600, Math.max(280, Math.abs(b.x - a.x))), h = Math.min(1800, Math.max(180, Math.abs(b.y - a.y)));
    return { x: b.x < a.x ? a.x - w : a.x, y: b.y < a.y ? a.y - h : a.y, w, h };
  };
  const show = (el, r) => Object.assign(el.style, { left: `${r.x * orchZoom + orchPanX}px`, top: `${r.y * orchZoom + orchPanY}px`, width: `${r.w * orchZoom}px`, height: `${r.h * orchZoom}px` });
  layer.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); endDraw(); };
  layer.onpointerdown = (e) => {
    e.stopPropagation();
    if (e.button !== 0 || drawing?.sheet) { if (e.button === 0) endDraw(); return; } // a click beside the sheet cancels
    layer.setPointerCapture(e.pointerId);
    const a = canvasPt(e.clientX, e.clientY), el = document.createElement("div");
    el.className = "draw-box";
    layer.appendChild(el);
    layer.onpointermove = (ev) => show(el, box(a, canvasPt(ev.clientX, ev.clientY)));
    layer.onpointerup = (ev) => {
      layer.onpointermove = layer.onpointerup = null;
      const d = ensurePaneRect({ kind: kind === "sticky" ? "sticky" : "terminal", x: 0 });
      const r = Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 4 ? box(a, canvasPt(ev.clientX, ev.clientY)) : { x: a.x, y: a.y, w: d.w, h: d.h };
      show(el, r);
      drawn(kind, agent, r, ev.shiftKey);
    };
  };
}
function drawn(kind, agent, at, skip) {
  if (kind === "sticky") { endDraw(); return addSticky(at); }
  const opts = [...(S.runners || []).filter((r) => r.ready && r.tui).map((r) => [r.id, r.name, "agents"]), ["", "Shell", "terminal"]];
  let last = "";
  try { last = localStorage.getItem(LAST_NEW) || ""; } catch {}
  let pick = kind === "agent" ? [agent, last, defaultAgent()].find((id) => id && opts.some((o) => o[0] === id)) || "" : "";
  if (skip) { endDraw(); return pick ? newAgentTerm(pick, at) : newTermPane(undefined, at); }
  const sheet = document.createElement("div");
  sheet.className = "ns-sheet";
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "New terminal");
  sheet.innerHTML = `<div class="ns-title">New terminal</div>
    <div class="ns-quick" role="radiogroup" aria-label="Quick start">${opts.map(([id, name, ic]) => `<button type="button" role="radio" data-id="${esc(id)}">${icon(ic, 18)}<span>${esc(name)}</span></button>`).join("")}</div>
    <label class="ns-field"><span>Name</span><input class="ns-name" type="text" autocomplete="off" spellcheck="false"></label>
    <div class="ns-field"><span>Folder</span><button type="button" class="ns-cwd" data-act="cwd-open" title="The folder it works in">${icon("folder", 14)}<span class="ns-cwd-lbl"></span></button></div>
    <div class="ns-foot"><button type="button" class="btn ns-cancel">Cancel</button><button type="button" class="btn peach ns-ok">Create <kbd>↵</kbd></button></div>`;
  document.body.appendChild(sheet);
  drawing = { ...drawing, kind, sheet };
  const name = sheet.querySelector(".ns-name"), radios = [...sheet.querySelectorAll("[role=radio]")];
  const choose = (id) => {
    pick = id;
    for (const b of radios) { b.setAttribute("aria-checked", b.dataset.id === id); b.tabIndex = b.dataset.id === id ? 0 : -1; }
    name.placeholder = opts.find((o) => o[0] === id)[1];
  };
  const ok = () => {
    const extra = name.value.trim() ? { name: name.value.trim() } : {};
    if (pick) try { localStorage.setItem(LAST_NEW, pick); } catch {}
    endDraw();
    if (pick) newAgentTerm(pick, at, extra); else newTermPane(undefined, at, extra);
  };
  sheet.onclick = (e) => {
    const r = e.target.closest("[role=radio]");
    if (r) { choose(r.dataset.id); name.focus(); } else if (e.target.closest(".ns-ok")) ok(); else if (e.target.closest(".ns-cancel")) endDraw();
  };
  sheet.onkeydown = (e) => {
    e.stopPropagation(); // the page's own keys (arrows, letters, Ctrl+K) stay out of the sheet; Esc is caught before
    if (e.key === "Enter" && !e.target.closest(".ns-cancel, .ns-cwd")) { e.preventDefault(); ok(); }
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target.matches("[role=radio]")) {
      e.preventDefault();
      const i = opts.findIndex((o) => o[0] === pick), n = opts.length;
      choose(opts[(i + (e.key === "ArrowRight" ? 1 : -1) + n) % n][0]);
      sheet.querySelector('[aria-checked="true"]').focus();
    }
  };
  choose(pick);
  // over the middle of the drawn rect (of the canvas, in the split), inside the window
  const cr = $("#orch-canvas")?.getBoundingClientRect() ?? { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const sr = at ? { x: cr.left + at.x * orchZoom + orchPanX, y: cr.top + at.y * orchZoom + orchPanY, w: at.w * orchZoom, h: at.h * orchZoom } : { x: cr.left, y: cr.top, w: cr.width, h: cr.height };
  const w = sheet.offsetWidth, h = sheet.offsetHeight;
  sheet.style.left = `${Math.round(Math.max(8, Math.min(sr.x + sr.w / 2 - w / 2, innerWidth - w - 8)))}px`;
  sheet.style.top = `${Math.round(Math.max(8, Math.min(sr.y + sr.h / 2 - h / 2, innerHeight - h - 8)))}px`;
  sheetCwd();
}
// The sheet's folder is the last one picked (the bar's); the folder popover changes it, and gives the focus back.
function sheetCwd() {
  const s = drawing?.sheet;
  if (!s) return;
  s.querySelector(".ns-cwd-lbl").textContent = cwdLabel($("#run-cwd")?.value || orchCwd);
  if (!s.contains(document.activeElement)) s.querySelector(".ns-name").focus();
}
function endDraw() {
  if (!drawing) return;
  const { layer, sheet } = drawing;
  drawing = null;
  layer?.remove();
  if (sheet) {
    sheet.classList.add("out");
    setTimeout(() => sheet.remove(), 150);
    if (cwdOpen) { cwdOpen = false; paintCwdPop(); }
  }
  paintHud($("#orch-hud"), orchMode === "free" && !orchMax);
}
addEventListener("keydown", (e) => { if (drawing && e.key === "Escape" && !cwdOpen) { e.preventDefault(); e.stopPropagation(); endDraw(); } }, true);
addEventListener("hashchange", () => endDraw());
// Copy card / Duplicate: what it takes to make the card again. A terminal starts fresh in the same folder, an agent
// starts a new session of the same agent; notes, tasks and sessions are one card each, so they have none.
let canvasClip = null;
function paneSpec(p) {
  if (p.kind === "sticky") return { kind: "sticky", text: p.text || "", w: p.w, h: p.h };
  if (p.kind === "terminal") return { kind: "terminal", shell: p.shell || "", cwd: p.cwd || "", agent: p.run?.agent || "", fontSize: p.fontSize, w: p.w, h: p.h };
  return null;
}
function placeSpec(s, at) {
  if (!s) return;
  const p = s.kind === "sticky" ? { kind: "sticky", id: String(++orchSeq), text: s.text }
    : { kind: "terminal", id: `term_${Date.now()}`, shell: s.shell, cwd: s.cwd, ...(S.runners?.find((r) => r.id === s.agent)?.tui ? { run: newTuiRun(s.agent) } : {}) };
  Object.assign(p, { w: s.w, h: s.h }, s.fontSize ? { fontSize: s.fontSize } : {});
  if (addPane(p, at?.x, at?.y)) { saveCanvas(); focusPane(paneKey(p), !!at); }
}
function toggleLink(a, b) {
  const i = orchLinks.findIndex((l) => l.a === a && l.b === b);
  if (i >= 0) orchLinks.splice(i, 1); else orchLinks.push({ a, b });
  saveCanvas(); orchSigs.clear(); orchPaint(true);
  toast(i >= 0 ? "Link removed" : "Linked: this card now goes along as context");
}
// Text size per terminal (d = +1 / -1 px, 0 = back to the Ghostty size).
function termFont(p, d) {
  const st = terms.get(p.id);
  if (!st?.term) return;
  if (d) p.fontSize = Math.max(8, Math.min(32, (p.fontSize || st.font0) + d)); else delete p.fontSize;
  st.term.options.fontSize = p.fontSize || st.font0;
  requestAnimationFrame(() => st.fit?.fit()); // the cell size is measured on the next frame
  saveCanvas(); st.term.focus();
}
// Restart: the PTY goes and a new one starts in the same card (a shell starts over, an agent resumes its session).
const restarting = new Set(); // pane ids whose old PTY is closing: no repaint mounts them until it's gone
async function termRestart(p) {
  restarting.add(p.id);
  await termClose(p.id);
  restarting.delete(p.id);
  orchSigs.delete(paneKey(p)); orchPaint(true);
}
// Rename in place: the title turns into a field; Enter or a click away keeps it, Esc cancels, empty goes back.
function renamePane(p) {
  const key = paneKey(p), t = $(`.orch-pane[data-key="${CSS.escape(key)}"] .win-title`);
  if (!t) return;
  const inp = document.createElement("input");
  inp.className = "win-rename"; inp.value = paneLabel(p); inp.setAttribute("aria-label", "Card name");
  const v0 = inp.value; // unchanged = no name, so the title keeps following the shell, the agent or the note
  t.replaceChildren(inp); t.classList.add("editing");
  inp.focus(); inp.select();
  let done = false;
  const end = (save) => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    if (save && v !== v0) { if (v) p.name = v; else delete p.name; saveCanvas(); }
    inp.remove(); t.classList.remove("editing"); orchSigs.delete(key); orchPaint(true);
  };
  inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") end(true); if (e.key === "Escape") end(false); };
  inp.onblur = () => end(true);
}
function canvasMenu(cx, cy) {
  const at = canvasPt(cx, cy), free = orchMode === "free" && !orchMax, any = orchPanes.length > 0;
  ctxMenu(cx, cy, [
    { label: "New agent", ic: "agents", sub: agentItems() },
    { label: "New terminal", ic: "terminal", kbd: "Ctrl+Alt+T", run: () => drawCard("terminal") },
    { label: "New note", ic: "notes", run: () => drawCard("sticky") },
    { label: "Draw on the canvas", ic: "edit", run: () => setSketch(true) },
    { label: "Open a vault note…", ic: "book", run: () => openVaultNotes(at) },
    { label: "New task…", ic: "spark", run: () => deckShow(true) },
    "-",
    { label: "Paste card", ic: "paste", off: !canvasClip, run: () => placeSpec(canvasClip, at) },
    free && { label: "Select all", ic: "select", off: !any, run: () => { orchPanes.forEach((p) => orchSelected.add(paneKey(p))); updateSelectionUI(); } },
    "-",
    free && { label: "Arrange windows", ic: "grid", off: !any, run: arrangeCanvasPanes },
    free && { label: "Fit everything", ic: "max", kbd: "Ctrl+Alt+F", off: !any, run: () => { fitCanvasView(); saveCanvas(); } },
    free && { label: "Zoom to 100%", ic: "search", run: () => ACTIONS["orch-zoom"]({ dataset: { d: "0" } }) },
    free && { label: "Background", ic: "canvasBg", sub: bgItems() },
    { label: orchMode === "free" ? "Switch to split" : "Switch to canvas", ic: orchMode === "free" ? "split" : "grid", run: () => ACTIONS["orch-mode"]({ dataset: { m: orchMode === "free" ? "tile" : "free" } }) },
    { label: document.body.classList.contains("canvas-full") ? "Leave full screen" : "Full screen", ic: "expand", kbd: "Ctrl+Alt+Z", run: () => canvasFull() },
    "-",
    { label: "Keyboard shortcuts", run: () => toast(PANE_KEYS) },
  ]);
}
function paneMenu(key, cx, cy) {
  const p = orchPanes.find((x) => paneKey(x) === key);
  if (!p) return;
  const free = orchMode === "free" && !orchMax;
  // Several cards selected, this one among them: the menu acts on all of them.
  if (free && orchSelected.size > 1 && orchSelected.has(key)) {
    const sel = orchPanes.filter((x) => orchSelected.has(paneKey(x))), locked = sel.every((x) => x.locked);
    return ctxMenu(cx, cy, [
      { label: locked ? `Unlock ${sel.length} cards` : `Lock ${sel.length} cards in place`, ic: "lock", run: () => { sel.forEach((x) => { x.locked = !locked; }); saveCanvas(); orchPaint(); } },
      "-",
      { label: `Close ${sel.length} cards`, ic: "trash", danger: true, kbd: "Delete", run: deleteSelectedPanes },
    ]);
  }
  const term = p.kind === "terminal" ? terms.get(p.id)?.term : null, card = $(`.orch-pane[data-key="${CSS.escape(key)}"]`);
  const ws = getSelection(), picked = term ? term.getSelection() : ws && !ws.isCollapsed && card?.contains(ws.anchorNode) ? ws.toString() : "";
  const others = orchPanes.filter((x) => x !== p), spec = paneSpec(p);
  ctxMenu(cx, cy, [
    term && { label: "Copy", ic: "copy", kbd: "Ctrl+Shift+C", off: !picked, run: () => copyText(picked) },
    term && { label: "Paste", ic: "paste", kbd: "Ctrl+Shift+V", run: () => navigator.clipboard?.readText().then((t) => { if (t) term.paste(t); term.focus(); }, () => toast("The browser didn't allow reading the clipboard")) },
    term && { label: "Select all", ic: "select", run: () => term.selectAll() },
    term && { label: "Clear screen", ic: "clear", run: () => { term.clear(); term.focus(); } },
    !term && picked && { label: "Copy", ic: "copy", run: () => copyText(picked) },
    p.kind === "sticky" && { label: "Copy text", ic: "copy", off: !p.text, run: () => copyText(p.text) },
    p.kind === "note" && { label: "Open in the reader", ic: "book", run: () => { location.hash = `#/n/${encodeURIComponent(p.id)}`; } },
    (p.kind === "task" || p.kind === "agent") && { label: "Open its page", ic: "ext", run: () => { location.hash = `#/${p.kind === "task" ? "t" : "a"}/${encodeURIComponent(p.id)}`; } },
    "-",
    term && { label: "Text size", ic: "type", sub: [
      { label: "Larger", run: () => termFont(p, 1) },
      { label: "Smaller", run: () => termFont(p, -1) },
      { label: "Default", off: !p.fontSize, run: () => termFont(p, 0) },
    ] },
    term && { label: p.run ? "Restart (resumes the session)" : "Restart", ic: "reload", run: () => termRestart(p) },
    p.kind === "terminal" && !p.run && { label: "Open in desktop terminal", ic: "ext", run: () => ACTIONS["term-launch-app"]({ dataset: { key } }) },
    p.cwd && { label: "Copy folder path", ic: "folder", run: () => copyText(p.cwd) },
    "-",
    { label: "Rename…", ic: "edit", run: () => renamePane(p) },
    free && { label: p.collapsed ? "Expand" : "Minimize", ic: "fold", run: () => ACTIONS["orch-collapse"]({ dataset: { key } }) },
    { label: orchMax === key ? "Restore" : "Maximize", ic: "max", kbd: "Ctrl+Alt+Enter", run: () => ACTIONS["orch-max"]({ dataset: { key } }) },
    free && others.length && { label: "Give context to", ic: "link", sub: others.map((o) => ({ label: paneLabel(o), on: orchLinks.some((l) => l.a === key && l.b === paneKey(o)), run: () => toggleLink(key, paneKey(o)) })) },
    orchLinks.some((l) => l.a === key || l.b === key) && { label: "Remove its links", ic: "gap", run: () => { orchLinks = orchLinks.filter((l) => l.a !== key && l.b !== key); saveCanvas(); orchSigs.clear(); orchPaint(true); } },
    "-",
    spec && { label: "Duplicate", ic: "copy", run: () => placeSpec(spec, free ? { x: p.x + 70, y: p.y + 46 } : null) },
    spec && { label: "Copy card", ic: "copy", run: () => { canvasClip = spec; toast("Card copied: right-click the canvas › Paste card"); } },
    free && { label: p.locked ? "Unlock" : "Lock in place", ic: "lock", run: () => { p.locked = !p.locked; saveCanvas(); orchPaint(); } },
    "-",
    { label: "Close", ic: "trash", danger: true, kbd: "Ctrl+Alt+W", run: () => ACTIONS["orch-unpin"]({ dataset: { key } }) },
  ]);
}
// The ☰ button: everything the page header and the dock held, now that the canvas takes the whole screen.
function mainMenu(btn) {
  const go = (h) => () => { location.hash = h; };
  ctxAt(btn, [
    { label: "Sessions", ic: "cols", kbd: "A", run: () => $("#orch-fleet-wrap")?.classList.add("open") },
    { label: "New task…", ic: "spark", run: () => deckShow(true) },
    { label: "Search", ic: "search", kbd: "Ctrl+K", run: () => cmdkOpen() },
    { label: "Capture", ic: "inbox", kbd: "C", run: () => ACTIONS.capture() },
    "-",
    { label: "Home", ic: "home", run: go("#/") },
    { label: "Notes", ic: "notes", run: go("#/notes") },
    { label: "Review", ic: "review", run: go("#/review") },
    { label: "Graph", ic: "graph", run: go("#/graph") },
    { label: "Services", ic: "services", run: go("#/services") },
    ...(S.services || []).filter((s) => s.dock).map((s) => ({ label: s.name, ic: s.icon || "services", run: go(`#/s/${s.id}`) })),
    { label: "Settings", ic: "settings", run: go("#/settings") },
    "-",
    { label: "Layout", ic: orchMode === "free" ? "grid" : "split", sub: [
      { label: "Canvas", ic: "grid", on: orchMode === "free", run: () => ACTIONS["orch-mode"]({ dataset: { m: "free" } }) },
      { label: "Split", ic: "split", on: orchMode === "tile", run: () => ACTIONS["orch-mode"]({ dataset: { m: "tile" } }) },
    ] },
    { label: orchRailMode === "float" ? "Keep Sessions open" : "Let Sessions float", ic: "pin", run: () => ACTIONS["orch-rail-mode"]() },
    { label: document.body.classList.contains("canvas-full") ? "Leave full screen" : "Full screen", ic: "expand", kbd: "Ctrl+Alt+Z", run: () => canvasFull() },
    { label: "Keyboard shortcuts", run: () => toast(PANE_KEYS) },
  ]);
}
async function orchPaint(force) {
  reapTerms();
  const canvas = $("#orch-canvas"), plane = $("#orch-plane"), hud = $("#orch-hud");
  if (!canvas || !plane) return;
  if (!orchPanes.length) {
    orchSigs.clear();
    canvas.className = `orch-canvas ${orchMode === "free" ? `free tool-${orchTool}` : "tiled"}`; // keeps its size and dot grid
    plane.className = `orch-plane ${orchMode === "free" ? "free" : "single"}`;
    plane.innerHTML = `<div class="orch-empty glass"><p class="empty">Right-click anywhere to open an agent, a terminal or a note.<br><small>Or use the tools above, or a session from Sessions (A).</small></p></div>`;
    applyCanvasTransform();
    paintHud(hud, orchMode === "free");
    drawLinks();
    return;
  }
  const vis = orchMax ? orchPanes.filter((p) => paneKey(p) === orchMax) : orchPanes;
  const visKeys = new Set(vis.map(paneKey));
  if (plane.querySelector(".orch-empty")) plane.innerHTML = "";
  for (const node of [...plane.querySelectorAll(".orch-pane")]) {
    if (!visKeys.has(node.dataset.key)) { orchSigs.delete(node.dataset.key); node.remove(); }
  }
  const isFree = orchMode === "free" && !orchMax;
  canvas.className = `orch-canvas ${isFree ? `free tool-${orchTool}` : "tiled"}`;
  plane.className = `orch-plane ${isFree ? "free" : vis.length === 1 ? "single" : vis.length === 2 ? `split-${orchDir}` : "grid"}`;
  applyCanvasTransform();
  paintHud(hud, isFree);
  await Promise.all(vis.map(async (p, idx) => {
    const key = paneKey(p);
    ensurePaneRect(p, idx);
    let card = plane.querySelector(`.orch-pane[data-key="${CSS.escape(key)}"]`);
    if (!card) {
      card = document.createElement("section");
      card.className = "orch-pane";
      card.dataset.key = key;
      card.dataset.kind = p.kind;
      card.innerHTML = `<div class="orch-head"></div>
        <div class="feed list orch-feed"><p class="empty">Loading…</p></div>
        <div class="orch-needs"></div>
        <form class="talk orch-talk">
          <textarea class="orch-msg" rows="1" placeholder="Reply or send follow-up… Enter sends, Shift+Enter adds a line" aria-label="Follow-up message"></textarea>
          <button class="btn peach" type="submit">Send ${icon("r", 14)}</button>
        </form>
        <div class="orch-port" title="Drag onto another card to give it this one's context"></div>`;
      // The card can be rekeyed in place (new tile -> task), so handlers read its key at event time.
      card.addEventListener("pointerdown", (e) => {
        const key = card.dataset.key;
        if (e.target.closest("button, a, select, input, textarea, .orch-resize, .orch-port, .dot")) return;
        // Selection (for Delete / multi-move) only exists on the free canvas.
        if (orchMode !== "free" || orchMax) orchSelected.clear();
        else if (e.shiftKey || e.metaKey || e.ctrlKey) {
          if (orchSelected.has(key)) orchSelected.delete(key);
          else orchSelected.add(key);
        } else if (!orchSelected.has(key)) {
          orchSelected.clear();
          orchSelected.add(key);
        }
        if (orchActive !== key) {
          orchActive = key;
          plane.querySelectorAll(".orch-pane").forEach((n) => n.classList.toggle("active", n.dataset.key === orchActive));
          document.querySelectorAll(".orch-item").forEach((n) => {
            const b = n.querySelector(".orch-item-main");
            if (b) n.classList.toggle("on", `${b.dataset.kind}:${b.dataset.id}` === orchActive);
          });
        }
        updateSelectionUI();
      });
      const form = card.querySelector(".orch-talk"), msg = card.querySelector(".orch-msg");
      form.onsubmit = (e) => { e.preventDefault(); orchSend(p, card); };
      msg.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); orchSend(p, card); } };
      // Each card keeps its unsent draft across re-renders and reloads.
      msg.value = p.draft || "";
      msg.oninput = () => { p.draft = msg.value; saveCanvas(); };
      const head = card.querySelector(".orch-head");
      head.addEventListener("dblclick", (e) => {
        const key = card.dataset.key;
        if (e.target.closest("button, a, select, input, textarea")) return;
        orchMax = orchMax === key ? "" : key;
        orchActive = key;
        orchSigs.clear();
        agentsBody();
      });
      bindPaneDragResize(card, p);
      if (bornKeys.delete(key)) card.classList.add("pane-in");
      plane.appendChild(card);
    }
    card.classList.toggle("active", key === orchActive);
    card.classList.toggle("collapsed", !!p.collapsed && isFree);
    card.classList.toggle("selected", orchSelected.has(key));
    card.classList.toggle("locked", !!p.locked && isFree);
    card.dataset.kind = p.kind;
    if (card.querySelector(".win-rename")) return; // being renamed: a repaint would wipe the field
    if (isFree) {
      card.style.left = `${p.x}px`; card.style.top = `${p.y}px`;
      card.style.width = `${p.w}px`; card.style.height = `${p.h}px`;
    } else {
      card.style.left = card.style.top = card.style.width = card.style.height = "";
    }
    const inCount = linkCount(key), outCount = orchLinks.filter((l) => l.a === key).length;
    const linkBadge = !isFree && (inCount || outCount)
      ? `<small title="${inCount ? `Receives context from ${inCount} card(s). ` : ""}${outCount ? `Gives context to ${outCount} card(s).` : ""}">${inCount ? `← ${inCount}` : ""}${inCount && outCount ? " · " : ""}${outCount ? `${outCount} →` : ""}</small>`
      : "";
    const paneBtns = `${linkBadge}
      ${!isFree && orchPanes.length > 1 && idx > 0 ? `<button type="button" class="btn glass orch-icon-btn" data-act="orch-swap" data-key="${esc(key)}" title="Move pane first">⇄</button>` : ""}
`;
    const form = card.querySelector(".orch-talk");
    // A terminal is typed into directly; its message line only shows when wires bring other cards' context to it.
    // Between terminals a wire is a hand-off (overlook send), so a terminal's message line only shows when a note or a
    // sticky is wired into it, to bring their text along.
    const ctxIn = orchLinks.filter((l) => l.b === key && !l.a.startsWith("terminal:")).length;
    if (form) form.style.display = (p.kind === "note" || p.kind === "sticky" || (p.kind === "terminal" && !(p.run && ctxIn))) ? "none" : "";
    if (p.kind === "note") {
      const n = await api(`/api/note?path=${encodeURIComponent(p.id)}`).catch(() => null);
      if (!n || !card.isConnected) return;
      const sig = `note|${n.path}|${n.mtime}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig) return;
      orchSigs.set(key, sig);
      p.ctx = htmlText(n.html);
      card.querySelector(".orch-head").innerHTML = winHead(key, n.title, n.folder || "vault", `${paneBtns}
          <a class="btn orch-icon-btn" href="#/n/${encodeURIComponent(n.path)}" title="Open in the note reader">${icon("ext", 12)}</a>
          <a class="btn orch-icon-btn" href="${obs(n.path)}" title="Open in Obsidian">${icon("bolt", 12)}</a>`);
      card.querySelector(".orch-needs").innerHTML = "";
      const feed = card.querySelector(".orch-feed");
      feed.innerHTML = `<div class="orch-note-view prose">${n.html}</div>`;
      if (form) form.style.display = "none";
      return;
    }
    if (p.kind === "sticky") {
      p.w ??= 320; p.h ??= 220;
      const sig = `sticky|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig) return;
      orchSigs.set(key, sig);
      card.querySelector(".orch-head").innerHTML = winHead(key, "Note", "", paneBtns);
      card.querySelector(".orch-needs").innerHTML = "";
      const feed = card.querySelector(".orch-feed");
      // Read as markdown; a click (not on a link) edits the text, leaving the field shows it rendered again.
      let ta = feed.querySelector(".orch-sticky-input");
      if (!ta) {
        feed.innerHTML = `<div class="orch-sticky-wrap"><div class="orch-sticky-view prose" title="Click to edit"></div><textarea class="orch-sticky-input" spellcheck="false" placeholder="Write a note (markdown)… wire it into an agent and it becomes context">${esc(p.text || "")}</textarea></div>`;
        ta = feed.querySelector(".orch-sticky-input");
        const view = feed.querySelector(".orch-sticky-view");
        ta.oninput = () => { p.text = ta.value; saveCanvasSoon(); };
        ta.onblur = () => stickyShow(view, ta, p.text);
        view.onclick = (e) => { if (e.target.closest("a")) return; view.hidden = true; ta.hidden = false; ta.focus(); };
        stickyShow(view, ta, p.text);
      } else if (document.activeElement !== ta) {
        ta.value = p.text || "";
        stickyShow(feed.querySelector(".orch-sticky-view"), ta, p.text);
      }
      if (form) form.style.display = "none";
      return;
    }
    if (p.kind === "terminal") {
      if (restarting.has(p.id)) return;
      const cwd = p.cwd || orchCwd || "";
      const title = terms.get(p.id)?.title || (p.run ? runnerName(p.run.agent || p.agent) || "Agent" : cwdLabel(cwd));
      // the title is in the signature: the slim title bar follows what the shell or the agent names the window
      const sig = `terminal|${p.id}|${title}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig && card.querySelector(".orch-term-view")) return;
      orchSigs.set(key, sig);
      card.querySelector(".orch-head").innerHTML = winHead(key, title, "", `${paneBtns}
          ${p.run ? "" : `<button type="button" class="btn orch-icon-btn" data-act="term-launch-app" data-key="${esc(key)}" title="Open this folder in your desktop terminal">${icon("ext", 12)}</button>`}`);
      if (termBg) card.style.setProperty("--win-bg", termBg); // the window is the terminal: its Ghostty theme color
      card.querySelector(".orch-needs").innerHTML = "";
      if (p.run) card.querySelector(".orch-msg").placeholder = `Message ${runnerName(p.run.agent) || "the agent"}… Enter sends · linked cards add their context`;
      mountTerminalPane(card, p);
      return;
    }
    if (p.kind === "task") {
      const t = await api(`/api/task?id=${encodeURIComponent(p.id)}`).catch(() => null);
      if (!t || !card.isConnected) return;
      const qInfo = detectQuota(t);
      const qSig = qInfo ? `${qInfo.exhausted}|${qInfo.model}|${qInfo.resetsIn}` : "";
      const sig = `${t.end}|${t.ok}|${t.events.length}|${t.events.at(-1)?.txt?.length || 0}|${qSig}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && (orchSigs.get(key) === sig || selectingIn(card))) return;
      orchSigs.set(key, sig);
      const folder = t.cwd ? shortCwd(t.cwd) : "";
      card.querySelector(".orch-head").innerHTML = winHead(key, t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : t.prompt, [runnerName(t.agent), folder].filter(Boolean).join(" · "), `${paneBtns}
          <span class="live ${liveClass(t)}"></span><small class="orch-status-txt">${taskStatus(t)}</small>
          ${t.end ? "" : `<button class="btn" data-act="stop" data-id="${esc(t.id)}">Stop</button>`}
          ${S.runners?.find((r) => r.id === t.agent)?.tui && t.session && t.end ? `<button class="btn orch-open-btn" data-act="pane-tui" data-key="${esc(key)}" data-agent="${esc(t.agent)}" title="Continue this session in the agent's own terminal UI">${icon("terminal", 12)} <span class="orch-btn-lbl">TUI</span></button>` : ""}
          ${openButtons(S.runners?.find((r) => r.id === t.agent), `data-task="${esc(t.id)}"`, !!t.session)}
          <a class="btn orch-icon-btn" href="#/t/${esc(t.id)}" title="Open the task page">${icon("ext", 12)}</a>`);
      card.querySelector(".orch-needs").innerHTML = renderQuotaBanner(t, key);
      card.querySelector(".orch-msg").placeholder = !t.end ? "Running — wait or Stop to send a follow-up…" : "Send a follow-up in this workspace… Enter sends";
      const feed = card.querySelector(".orch-feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
      feed.innerHTML = renderEvents(t.events, runnerName(t.agent)) || `<p class="empty">Waiting for output…</p>`;
      if (atEnd) feed.scrollTop = feed.scrollHeight;
    } else {
      const a = await api(`/api/agent?key=${encodeURIComponent(p.id)}`).catch(() => null);
      if (!a || !card.isConnected) return;
      const sig = `${a.live}|${a.state}|${a.events.length}|${a.events.at(-1)?.txt?.length || 0}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && (orchSigs.get(key) === sig || selectingIn(card))) return;
      orchSigs.set(key, sig);
      const name = a.title || AGENT_NAME[a.name]?.[0] || a.name;
      card.querySelector(".orch-head").innerHTML = winHead(key, name, [AGENT_NAME[a.name]?.[0] || a.name, a.cwd].filter(Boolean).join(" · "), `${paneBtns}
          <span class="live ${a.live ? "" : a.state === "blocked" ? "run" : "idle"}"></span>
          ${S.runners?.find((r) => r.process === a.name)?.tui && !a.live && a.resumable !== false ? `<button class="btn orch-open-btn" data-act="pane-tui" data-key="${esc(key)}" data-agent="${esc(a.name)}" title="Continue this session in the agent's own terminal UI">${icon("terminal", 12)} <span class="orch-btn-lbl">TUI</span></button>` : ""}
          ${openButtons(S.runners?.find((r) => r.process === a.name), `data-key="${esc(p.id)}"`, true)}
          <a class="btn orch-icon-btn" href="#/a/${esc(p.id)}" title="Open the session page">${icon("ext", 12)}</a>`);
      card.querySelector(".orch-needs").innerHTML = a.needs ? `<div class="needs orch-needs-bar"><b>Needs you:</b> <span>${fmt(a.needs)}</span></div>` : "";
      card.querySelector(".orch-msg").placeholder = a.name === "agy" ? "Reply in AGY… Enter sends, Shift+Enter adds a line" : "Reply in background (claude --bg --resume)… Enter sends";
      const feed = card.querySelector(".orch-feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
      feed.innerHTML = renderEvents(a.events, AGENT_NAME[a.name]?.[0] || a.name) || `<p class="empty">Nothing to show yet.</p>`;
      if (atEnd) feed.scrollTop = feed.scrollHeight;
    }
  }));
  bindSplitResizer(plane);
  drawLinks();
  saveCanvas();
}
async function orchSend(p, card) {
  const t = card?.querySelector(".orch-msg"), text = t?.value.trim();
  if (!text || t.disabled || !p) return;
  t.disabled = true;
  const oldKey = paneKey(p);
  const ctx = await linkedContext(oldKey, 4000);
  const fullText = ctx ? `${ctx}${text}` : text;
  try {
    if (p.kind === "terminal") {
      if (!termPrompt(p.id, fullText)) return toast("This terminal is not connected — press Enter in it to reconnect");
      t.value = ""; p.draft = ""; saveCanvas();
      if (ctx && linkCount(oldKey)) toast(`Sent with context from ${linkCount(oldKey)} linked card(s)`);
      return;
    }
    if (p.kind === "task") {
      await api("/api/task/talk", { id: p.id, text: fullText });
      t.value = ""; toast("Follow-up started");
      orchSigs.delete(oldKey);
      S = await api("/api/system"); agentsBody(); orchPaint(true);
    } else if (p.kind === "agent") {
      const r = await api("/api/talk", { key: p.id, text: fullText });
      t.value = ""; toast("Message sent");
      orchSigs.delete(oldKey);
      if (r.key && r.key !== p.id) {
        rekey(oldKey, `agent:${r.key}`);
        p.id = r.key;
        card.dataset.key = paneKey(p);
        if (orchActive === oldKey) orchActive = paneKey(p);
        if (orchMax === oldKey) orchMax = paneKey(p);
      }
      saveCanvas();
      S = await api("/api/system"); setTimeout(() => { agentsBody(); orchPaint(true); }, 1200);
    }
  } catch (e) { toast(`Not sent: ${e.message}`); } finally { t.disabled = false; t.focus(); }
}

// Model and effort pickers follow the chosen agent: only what agents.json lists for it. Effort levels can differ per model.
function runOptions(keepModel, p = "run") {
  const r = S.runners?.find((x) => x.id === $(`#${p}-agent`)?.value) || {}, ms = r.models || [], sel = $(`#${p}-model`);
  if (sel && !keepModel) { sel.hidden = !ms.length; sel.innerHTML = ms.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join(""); }
  const es = ms.find((m) => m.id === sel?.value)?.efforts || r.efforts || [], pick = es.includes(r.effort) ? r.effort : es[0];
  const seg = $(`#${p}-effort`);
  if (seg) {
    seg.hidden = !es.length;
    seg.innerHTML = es.map((e) => `<button type="button" role="radio" aria-checked="${e === pick}" class="${e === pick ? "on" : ""}" data-act="effort" data-v="${esc(e)}">${esc(e)}</button>`).join("");
  }
  const mWrap = $(`#${p}-model-wrap`);
  if (mWrap) mWrap.hidden = !ms.length;
  const eRow = $(`#${p}-effort-row`);
  if (eRow) eRow.hidden = !es.length;
}
const runChoice = (p = "run") => ({ agent: $(`#${p}-agent`)?.value, model: $(`#${p}-model`)?.hidden ? undefined : $(`#${p}-model`)?.value, effort: $(`#${p}-effort`)?.hidden ? undefined : $(`#${p}-effort .on`)?.dataset.v });
// Agent, model and effort pickers; runOptions(false, p) fills the last two for the chosen agent.
const agentPicker = (p) => `<select class="pick" id="${p}-agent" aria-label="Agent">${(S.runners || []).map((r) => `<option value="${esc(r.id)}" ${r.ready ? "" : "disabled"}>${esc(r.name)}${r.ready ? "" : " (not set up)"}</option>`).join("")}</select>
  <select class="pick" id="${p}-model" aria-label="Model" hidden></select><div class="seg" id="${p}-effort" role="radiogroup" aria-label="Effort" hidden></div>`;
// "Open in…" buttons: the commands agents.json gives the agent; the ones that need a session only when there is one.
const openButtons = (runner, attrs, hasSession) => (runner?.open || []).filter((o) => !o.session || hasSession)
  .map((o) => `<button class="btn glass orch-open-btn" data-act="open" data-via="${esc(o.label)}" title="${esc(o.label)}" ${attrs}>${icon("ext", 12)} <span class="orch-btn-lbl">${esc(o.label)}</span></button>`).join("");
const taskMeta = (t) => [runnerName(t.agent), t.model, t.effort].filter(Boolean).join(" · ");
async function runPrompt() {
  const t = $("#run-prompt"), prompt = t.value.trim();
  if (!prompt || t.disabled) return;
  t.disabled = true;
  const cwd = ($("#run-cwd")?.value ?? orchCwd) || undefined, role = orchRole || undefined, primary = runChoice();
  const ctx = orchActive ? await linkedContext(orchActive, 4000) : "";
  const fullPrompt = ctx ? `${ctx}${prompt}` : prompt;
  try {
    // Agents with a TUI open as windows running the prompt (one each, in parallel); others run headless as before.
    const picked = [primary, ...[...orchExtra].map((id) => ({ agent: id }))];
    if (picked.every((x) => S.runners?.find((r) => r.id === x.agent)?.tui)) {
      const text = role ? `[Role: ${role}]\n\n${fullPrompt}` : fullPrompt;
      const opened = picked.filter((x, i) => addPane({ kind: "terminal", id: `term_${Date.now()}_${i}`, cwd: cwd || "", run: newTuiRun(x.agent, text, x.model, x.effort) }));
      if (!opened.length) return; // no room: makeRoom said so, and the prompt stays
      t.value = ""; saveCanvas();
      return toast(picked.length > 1 ? `${picked.length} agents started on the canvas` : `${runnerName(primary.agent)} started`);
    }
    const payload = orchExtra.size
      ? { agents: [primary, ...[...orchExtra].map((id) => ({ agent: id }))], prompt: fullPrompt, cwd, role }
      : { ...primary, prompt: fullPrompt, cwd, role };
    const r = await api("/api/run", payload);
    t.value = "";
    S = await api("/api/system");
    orchMax = "";
    if (r.ids?.length > 1) {
      orchPanes = r.ids.slice(0, 4).map((id, i) => ensurePaneRect({ kind: "task", id }, i));
      orchActive = `task:${r.ids[0]}`;
    } else if (orchPanes.length > 1) {
      const idx = orchPanes.findIndex((p) => paneKey(p) === orchActive);
      const next = ensurePaneRect({ kind: "task", id: r.id }, idx >= 0 ? idx : orchPanes.length);
      if (idx >= 0) orchPanes[idx] = next; else orchPanes.push(next);
      orchActive = `task:${r.id}`;
    } else {
      orchPanes = [ensurePaneRect({ kind: "task", id: r.id }, 0)];
      orchActive = `task:${r.id}`;
    }
    agentsBody(); orchPaint(true);
    toast(r.ids?.length > 1 ? `Dispatched ${r.ids.length} agents in parallel on Canvas` : "Task started");
  } catch (e) { toast(`Not started: ${e.message}`); } finally { t.disabled = false; }
}

// ---------------------------------------------------------------- Task
let taskTimer = null, taskLast = "";
async function taskPage(id) {
  clearInterval(taskTimer); taskLast = "";
  main.innerHTML = `<div class="ph" id="task-head"></div><div id="task-needs"></div><div class="feed list glass" id="feed"><p class="empty">Loading…</p></div>
    <form class="talk glass" id="task-talk"><textarea id="task-msg" rows="2" placeholder="Send a follow-up prompt… Enter sends, Shift+Enter adds a line" aria-label="Follow-up prompt"></textarea>
      <button class="btn peach" type="submit">Continue ${icon("r", 14)}</button><small id="task-hint">Continues this task session in the same workspace.</small></form>`;
  const paint = async () => {
    if (route().pg !== "t" || route().arg !== id) return clearInterval(taskTimer);
    const t = await api(`/api/task?id=${encodeURIComponent(id)}`).catch(() => null);
    if (!t) { main.innerHTML = `<div class="ph"><h1>Task not found</h1><p>Overlook keeps the last 50 tasks; older ones are gone.</p></div><a class="btn glass" href="#/agents">Back to Agents</a>`; return clearInterval(taskTimer); }
    const qInfo = detectQuota(t);
    const qSig = qInfo ? `${qInfo.exhausted}|${qInfo.model}|${qInfo.resetsIn}` : "";
    const signature = `${t.end}|${t.events.length}|${t.events.at(-1)?.txt?.length || 0}|${qSig}`;
    if (signature === taskLast) return;
    taskLast = signature;
    $("#task-head").innerHTML = `<h1><span class="h-av">${avatar(t.agent, "agents", 30)}</span>${esc(t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : "Task")}</h1><p>${esc([taskMeta(t), t.cwd ? shortCwd(t.cwd) : "", `started ${ago(Date.parse(t.start))}`].filter(Boolean).join(" · "))}</p>
      <div class="r"><span class="live ${liveClass(t)}"></span><small style="color:var(--muted)">${taskStatus(t)}</small>${t.end ? "" : `<button class="btn glass" data-act="stop" data-id="${esc(t.id)}">Stop</button>`}
        ${openButtons(S.runners?.find((r) => r.id === t.agent), `data-task="${esc(t.id)}"`, !!t.session)}</div>`;
    $("#task-needs").innerHTML = renderQuotaBanner(t, "");
    const feed = $("#feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.innerHTML = renderEvents(t.events, runnerName(t.agent)) || `<p class="empty">Waiting for output…</p>`;
    if (atEnd) feed.scrollTop = feed.scrollHeight;
  };
  const send = async () => {
    const inp = $("#task-msg"), text = inp.value.trim();
    if (!text || inp.disabled) return;
    inp.disabled = true;
    try { await api("/api/task/talk", { id, text }); inp.value = ""; taskLast = ""; toast("Follow-up started"); await paint(); }
    catch (e) { toast(`Not started: ${e.message}`); } finally { inp.disabled = false; inp.focus(); }
  };
  $("#task-talk").onsubmit = (e) => { e.preventDefault(); send(); };
  $("#task-msg").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  await paint();
  taskTimer = setInterval(paint, 2000);
  ambient(art(`task ${id}`));
}

// ---------------------------------------------------------------- Live agent
// Reads the conversation from disk (Claude: the session .jsonl; AGY: SQLite) every 3 s, only while the page is open.
// The message box is drawn once; only the header and feed update, so what you type isn't wiped.
const WHO = { you: "you", result: "result" };
// Minimal Markdown (links, bold, code, heading) applied AFTER escaping: conversation text never becomes HTML.
const fmt = (s) => esc(s)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)&]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  .replace(/`([^`\n]+)`/g, "<code>$1</code>")
  .replace(/^#{1,4} (.+)$/gm, "<b>$1</b>");
function renderEvents(events, whoLabel) {
  return (events || []).map((e) => {
    const tm = e.at ? new Date(e.at).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : "";
    if (e.t === "you" || e.t === "text") {
      return `<div class="chat-msg ${e.t}">
        <div class="chat-meta"><span class="chat-who">${esc(e.t === "you" ? "You" : whoLabel)}</span>${tm ? `<span class="chat-time">${tm}</span>` : ""}</div>
        <div class="chat-txt">${fmt(e.txt)}</div>
      </div>`;
    }
    return `<div class="row ev chat-tool ${e.t}">
      <span class="who">${esc(e.t === "tool" ? `⚙ ${e.name}` : e.t === "result" ? "↳ output" : e.t)}</span>
      <div class="txt">${esc(e.txt)}</div>
      ${tm ? `<span class="x">${tm}</span>` : ""}
    </div>`;
  }).join("");
}
const STATE = { blocked: "waiting for you", working: "working", running: "working", done: "finished", idle: "idle" };
let agTimer = null, agLast = "";
async function agentPage(key) {
  clearInterval(agTimer); agLast = "";
  main.innerHTML = `<div class="ph" id="agent-head"></div><div id="agent-needs"></div><div class="feed list glass" id="feed"><p class="empty">Reading the conversation…</p></div>
    <form class="talk glass" id="talk"><textarea id="msg" rows="2" placeholder="Send a message… Enter sends, Shift+Enter adds a line" aria-label="Message to the agent"></textarea>
      <button class="btn peach" type="submit">Send ${icon("r", 14)}</button><small id="talk-hint"></small></form>`;
  const paint = async () => {
    if (route().pg !== "a" || route().arg !== key) return clearInterval(agTimer);
    const a = await api(`/api/agent?key=${encodeURIComponent(key)}`).catch(() => null);
    if (!a) { main.innerHTML = `<div class="ph"><h1>Conversation not found</h1></div><a class="btn glass" href="#/agents">Back to Agents</a>`; return clearInterval(agTimer); }
    const signature = a.live + a.state + a.events.length + (a.events.at(-1)?.txt || "");
    if (signature === agLast) return;
    agLast = signature;
    const name = a.title || AGENT_NAME[a.name]?.[0] || a.name;
    $("#agent-head").innerHTML = `<h1><span class="h-av">${avatar(a.name, "agents", 30)}</span>${esc(name)}</h1><p>${esc(AGENT_NAME[a.name]?.[0] || a.name)} · ${esc(a.cwd)}${a.seconds ? ` · ${duration(a.seconds)}` : ""}</p>
      <div class="r"><span class="live ${a.live ? "" : a.state === "blocked" ? "run" : "idle"}"></span>
        ${openButtons(S.runners?.find((r) => r.process === a.name), `data-key="${esc(key)}"`, true)}</div>`;
    $("#agent-needs").innerHTML = a.needs ? `<div class="needs glass"><b>Needs you</b>${fmt(a.needs)}</div>` : "";
    $("#talk-hint").textContent = a.name === "agy" ? "Continues this conversation in AGY (agy -p --conversation)."
      : a.live ? "This session is open in a terminal: the reply comes in a background copy, and the terminal stays intact."
      : "Continues this session in the background (claude --bg --resume).";
    const feed = $("#feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.innerHTML = renderEvents(a.events, AGENT_NAME[a.name]?.[0] || a.name) || `<p class="empty">Nothing to show yet.</p>`;
    if (atEnd) feed.scrollTop = feed.scrollHeight;
  };
  const send = async () => {
    const t = $("#msg"), text = t.value.trim();
    if (!text || t.disabled) return;
    t.disabled = true;
    try {
      const r = await api("/api/talk", { key, text });
      t.value = ""; toast("Message sent");
      if (r.key !== key) { location.hash = `#/a/${r.key}`; return; } // Claude opened a background copy: follow it
      agLast = ""; setTimeout(paint, 1500);
    } catch (e) { toast(`Not sent: ${e.message}`); } finally { t.disabled = false; t.focus(); }
  };
  $("#talk").onsubmit = (e) => { e.preventDefault(); send(); };
  $("#msg").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  await paint();
  agTimer = setInterval(paint, 3000);
  ambient(art(`agent ${key}`));
}

// ---------------------------------------------------------------- Images (what the cards show)
// Two sources: a folder of your own photos and the Pinterest board. Hide an image and it never shows; star some and
// switch to "Starred only" to fix which images the cards use, in that order.
let imgTimer = null, imgSource = "";
async function imagesPage() {
  clearTimeout(imgTimer);
  const p = await api("/api/images").catch(() => null);
  if (route().pg !== "images") return;
  if (!p) { main.innerHTML = '<p class="empty">Images are not available.</p>'; return; }
  const pin = p.pinterest, visible = p.images.filter((i) => !p.hidden.includes(i.id));
  const starred = p.starred.filter((id) => visible.some((i) => i.id === id));
  const inUse = p.mode === "fixed" && starred.length ? starred.length : visible.length;
  const count = (src) => p.images.filter((i) => i.source === src).length;
  const list = p.images.filter((i) => !imgSource || i.source === imgSource);
  const boardUrl = pin.board ? `https://www.pinterest.com/${pin.board.replace(/^\/|\/$/g, "")}/` : "";
  main.innerHTML = `<div class="ph"><h1>Images</h1><p>${p.images.length} images · ${inUse} in use on the cards</p></div>
    <div class="img-sources">
      <form class="img-set glass" id="img-folder">
        <b>Your photos</b><small>${p.folder ? (p.folderOk ? `${count("folder")} in the folder` : "folder not found") : "a folder on this computer"}</small>
        <input id="img-folder-path" value="${esc(p.folder)}" placeholder="~/Pictures/my-photos" autocomplete="off" aria-label="Folder with your photos">
        <button class="btn glass" type="submit">Save</button>
      </form>
      <form class="img-set glass" id="img-board-form">
        <b>Pinterest</b><small>${pin.board ? `${count("pinterest")} from <a href="${esc(boardUrl)}" target="_blank">${esc(pin.board)} ↗</a>` : "a board"}${pin.status === "error" ? ` · <em class="bad">${esc(pin.error)}</em>` : ""}</small>
        <input id="img-board" value="${esc(pin.board)}" placeholder="user/board" autocomplete="off" aria-label="Pinterest board">
        <button class="btn glass" type="submit">Save</button>
        <button class="btn glass" type="button" data-act="pinsync" ${pin.syncing || !pin.board ? "disabled" : ""}>${pin.syncing ? "Syncing…" : "Sync"}</button>
      </form>
    </div>
    <div class="img-bar">
      <div class="seg" role="radiogroup" aria-label="Show">${[["", `All ${p.images.length}`], ["folder", `Your photos ${count("folder")}`], ["pinterest", `Pinterest ${count("pinterest")}`]].map(([k, l]) =>
        `<button type="button" role="radio" aria-checked="${imgSource === k}" class="${imgSource === k ? "on" : ""}" data-act="img-source" data-k="${k}">${l}</button>`).join("")}</div>
      <span class="sp"></span>
      <div class="seg" role="radiogroup" aria-label="Which images the cards use">${[["random", "Random, changes daily"], ["fixed", `Starred only${starred.length ? ` (${starred.length})` : ""}`]].map(([k, l]) =>
        `<button type="button" role="radio" aria-checked="${p.mode === k}" class="${p.mode === k ? "on" : ""}" data-act="img-mode" data-k="${k}">${l}</button>`).join("")}</div>
    </div>
    ${p.mode === "fixed" && !starred.length ? '<p class="empty">No starred images yet, so the cards still rotate. Star the ones you want.</p>' : ""}
    <div class="img-grid">${list.map((im) => {
      const off = p.hidden.includes(im.id), n = p.starred.indexOf(im.id) + 1;
      return `<figure class="img ${off ? "off" : ""} ${n ? "star" : ""}">
        <img src="/pin/${im.id}?thumb" loading="lazy" alt="${esc(im.title || "Image")}">
        ${n ? `<span class="n">${n}</span>` : ""}<span class="src">${im.source === "folder" ? "yours" : "pinterest"}</span>
        <figcaption><button type="button" data-act="img-star" data-id="${im.id}" aria-pressed="${!!n}" title="${n ? "Unstar" : "Star: use it when the cards show starred images only"}">${n ? "★ Starred" : "☆ Star"}</button>
          <button type="button" data-act="img-hide" data-id="${im.id}" aria-pressed="${off}">${off ? "Show" : "Hide"}</button>
          ${im.link ? `<a href="${esc(im.link)}" target="_blank" aria-label="Open on Pinterest">↗</a>` : ""}</figcaption></figure>`;
    }).join("") || `<p class="empty">${p.images.length ? "Nothing here." : "No images yet: point to a folder of your photos, or set a Pinterest board."}</p>`}</div>`;
  $("#img-folder").onsubmit = async (e) => { e.preventDefault(); if (await savePrefs({ folder: $("#img-folder-path").value })) toast("Folder saved"); };
  $("#img-board-form").onsubmit = async (e) => { e.preventDefault(); if (await savePrefs({ board: $("#img-board").value })) toast("Board saved, syncing it now"); };
  if (pin.syncing) imgTimer = setTimeout(imagesPage, 2500); // follow a sync in progress
  ambient(art("images"));
}
async function savePrefs(change) {
  let ok = true;
  try { await api("/api/images/prefs", change); } catch (e) { toast(e.message); ok = false; }
  D = await api("/api");
  imagesPage();
  return ok;
}
// The picker: every visible image, to give a Home card its image (Automatic hands it back) or an agent its icon.
let pickKey = "", pickAgent = "";
const IMG_ACTIONS = {
  "pick-open": async (el) => {
    const s = SG[Number(el.dataset.i)];
    if (!s) return;
    pickKey = cardKey(s); pickAgent = "";
    openPicker(`Image for “${esc(s.title)}”`, D.pinCards?.[pickKey]?.id, '<button type="button" class="btn glass" data-act="pick" data-id="">Automatic</button>');
  },
  // The same picker sets an agent's icon from the card images.
  "avatar-pick": (el) => { pickAgent = el.dataset.id; openPicker(`Icon for ${esc(runnerName(pickAgent))}`, "", ""); },
  "pick-close": () => $("#picker").close(),
  pick: async (el) => {
    if (pickAgent) {
      try { await api("/api/avatar", { agent: pickAgent, image: el.dataset.id }); } catch (e) { return toast(e.message); }
      $("#picker").close(); S = await api("/api/system"); settingsPage(); return toast("Icon saved");
    }
    try { await api("/api/images/prefs", { cards: { [pickKey]: el.dataset.id || null } }); } catch (e) { return toast(e.message); }
    $("#picker").close(); D = await api("/api"); home(); toast(el.dataset.id ? "Image chosen for this card" : "Back to automatic");
  },
};
async function openPicker(title, cur, extra) {
  const p = await api("/api/images").catch(() => null);
  if (!p) return toast("Images are not available");
  const imgs = p.images.filter((i) => !p.hidden.includes(i.id));
  $("#picker").innerHTML = `<div class="pk-head"><h3>${title}</h3>${extra}
        <button type="button" class="btn glass" data-act="pick-close" aria-label="Close">Close <kbd>Esc</kbd></button></div>
      <div class="pk-grid">${imgs.map((im) => `<button type="button" class="${im.id === cur ? "on" : ""}" data-act="pick" data-id="${im.id}" aria-label="${esc(im.title || "Image")}"><img src="/pin/${im.id}?thumb" loading="lazy" alt=""></button>`).join("")
        || '<p class="empty">No images yet: add a photo folder or a Pinterest board in Images.</p>'}</div>`;
  $("#picker").showModal();
}
Object.assign(IMG_ACTIONS, {
  "img-mode": (el) => savePrefs({ mode: el.dataset.k }),
  "img-source": (el) => { imgSource = el.dataset.k; imagesPage(); },
  "img-hide": async (el) => { const p = await api("/api/images"), id = el.dataset.id; savePrefs({ hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id] }); },
  "img-star": async (el) => { const p = await api("/api/images"), id = el.dataset.id; savePrefs({ starred: p.starred.includes(id) ? p.starred.filter((x) => x !== id) : [...p.starred, id] }); },
});

// ---------------------------------------------------------------- Services
function renderDeploy(s) {
  const d = s.deploy;
  if (!d || typeof d !== "object") return "";
  const apps = Array.isArray(d.apps) ? d.apps : [];
  const rows = apps.map((a) => {
    const dot = a.status === "running" ? "" : a.status === "building" ? "run" : a.status === "idle" ? "idle" : "off";
    const name = a.url ? `<a class="deploy-name" href="${esc(a.url)}" target="_blank">${esc(a.name)} ${icon("ext", 11)}</a>` : `<span class="deploy-name">${esc(a.name)}</span>`;
    return `<div class="deploy-item"><span class="live ${dot}"></span>${name}<span class="pill">${esc(a.status)}</span>
      <span class="deploy-acts">${a.canDeploy ? `<button type="button" class="btn glass" data-act="svc-deploy" data-service="${esc(s.id)}" data-app="${esc(a.id)}" data-kind="${esc(a.kind || "")}" data-action="deploy">Deploy</button>` : ""}
      ${a.canRestart ? `<button type="button" class="btn glass" data-act="svc-deploy" data-service="${esc(s.id)}" data-app="${esc(a.id)}" data-kind="${esc(a.kind || "")}" data-action="restart" aria-label="Restart ${esc(a.name)}" data-tip="Restart">${icon("reload", 12)}</button>` : ""}</span></div>`;
  }).join("");
  const note = d.status === "no-token" || (!d.status && d.provider) ? `<small class="deploy-note">Set <code>${esc(d.key || "COOLIFY_TOKEN")}</code> in <code>.env</code> to list &amp; trigger ${esc(d.provider)} deploys.</small>`
    : d.status === "error" ? `<small class="deploy-note">${esc(d.provider || "deploy")}: ${esc(d.error || "error")}</small>`
    : !apps.length ? `<small class="deploy-note">No apps found.</small>` : "";
  return `<div class="deploy-list">${rows}${note}</div>`;
}
function services() {
  main.innerHTML = `<div class="ph"><h1>Services</h1><p>Your local apps. Listed in <code>services.json</code>.</p><div class="r"><a class="btn glass" href="#/images">Manage images</a></div></div>
    <div class="cards">${S.services.map((s) => {
      if (s.internal === "pinterest") {
        const p = s.pinterest || {};
        const board = p.board ? `https://www.pinterest.com/${p.board.replace(/^\/|\/$/g, "")}/` : s.url;
        return `<div class="ag glass"><div class="hd"><span class="ic">${icon(s.icon || "book")}</span>
            <div><h4>${esc(s.name)}</h4><small>${esc(p.status === "error" ? p.error : s.desc)}</small></div><span class="live ${s.ok ? "" : p.status === "error" ? "off" : "idle"}" style="margin-left:auto"></span></div>
          <div class="ft"><span class="pill">${esc(p.board || "pinterest")}</span><span class="pill">${p.total ?? 0} images</span>
            <span style="margin-left:auto;display:flex;gap:6px"><button class="btn glass" data-act="pinsync" ${p.syncing ? "disabled" : ""}>${p.syncing ? "Syncing…" : "Sync"}</button>
            <a class="btn glass" href="${esc(board)}" target="_blank" aria-label="Open the board on Pinterest" data-tip="Open on Pinterest">${icon("ext", 14)}</a>
            <a class="btn peach" href="#/images">Manage images</a></span></div></div>`;
      }
      const apps = Array.isArray(s.deploy?.apps) ? s.deploy.apps : [];
      const canView = Boolean(s.ok && address(s) && !s.internal);
      return `<div class="ag glass ${s.deploy ? "has-deploy" : ""}"><div class="hd"><span class="ic">${icon(s.icon || "services")}</span>
          <div><h4>${esc(s.name)}</h4><small>${esc(s.desc)}</small></div><span class="live ${s.ok ? "" : "off"}" style="margin-left:auto"></span></div>
        ${renderDeploy(s)}
        <div class="ft"><span class="pill">${esc(new URL(address(s) || s.url).host)}</span><span class="pill">${s.ok ? `${s.ms} ms` : "down"}</span>
          ${apps.length ? `<span class="pill">${apps.filter((a) => a.status === "running").length}/${apps.length} up</span>` : ""}
          <span style="margin-left:auto;display:flex;gap:6px">${s.deploy ? `<button type="button" class="btn glass" data-act="svc-refresh" data-service="${esc(s.id)}" aria-label="Refresh deploys" data-tip="Refresh deploys">${icon("reload", 14)}</button>` : ""}
          ${canView ? `<a class="btn peach" href="#/s/${esc(s.id)}">View here</a>` : ""}
          <a class="btn ${canView ? "glass" : "peach"}" href="${esc(remote ? address(s) || "#/services" : s.url)}" target="_blank">Open ${icon("ext", 14)}</a></span></div></div>`;
    }).join("") || '<p class="empty">No services yet. Copy <code>services.example.json</code> to <code>services.json</code>.</p>'}</div>`;
  ambient(art("services"));
}

// ---------------------------------------------------------------- Embedded service
function svcFull(on = !document.body.classList.contains("svc-full")) {
  document.body.classList.toggle("svc-full", on);
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement && !appFull) document.exitFullscreen?.().catch(() => {});
  const btn = $('[data-act="svc-full"]');
  if (btn) {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-label", on ? "Exit full screen" : "Toggle full screen");
    btn.dataset.tip = on ? "Exit full screen (Esc)" : "Full screen";
  }
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("svc-full")) svcFull(false);
});

function service(id) {
  const s = S.services.find((x) => x.id === id);
  if (!s) { main.innerHTML = '<p class="empty">Service not found in services.json.</p>'; return; }
  const src = address(s), tab = remote ? src : s.url;
  const embeddable = (S.services || []).filter((x) => !x.internal && address(x));
  const switcher = embeddable.length ? `<div class="svc-switch">${embeddable.map((x) =>
    `<a class="svc-tab ${x.id === s.id ? "on" : ""}" href="#/s/${esc(x.id)}" title="${esc(x.name)}">${icon(x.icon || "services", 13)}<span>${esc(x.name)}</span></a>`
  ).join("")}</div>` : "";
  const isFull = document.body.classList.contains("svc-full");
  $("#svcbar").innerHTML = `${switcher}<span class="live ${s.ok ? "" : "off"}"></span><span class="pill">${esc(new URL(src || s.url).host)}${s.ok ? ` · ${s.ms} ms` : " · down"}</span>
    <button class="btn glass" data-act="reload" aria-label="Reload" data-tip="Reload">${icon("reload", 15)}</button>
    <a class="btn glass" href="${esc(tab)}" target="_blank" aria-label="Open in a tab" data-tip="Open in tab">${icon("ext", 15)}</a>
    <button class="btn glass ${isFull ? "on" : ""}" data-act="svc-full" aria-label="${isFull ? "Exit full screen" : "Toggle full screen"}" data-tip="${isFull ? "Exit full screen (Esc)" : "Full screen"}">${icon("expand", 15)}</button>`;
  main.innerHTML = `<div class="frame ${s.width ? "phone" : ""}" style="${s.width ? `--w:${s.width}px` : s.max ? `max-width:${s.max}px;margin:0 auto` : ""}">
      ${!src ? `<p class="empty">${esc(s.name)} isn't published on Tailscale ("tailnet" field in services.json).</p>`
        : s.ok ? `<iframe id="svcf" src="${esc(src)}" title="${esc(s.name)}"></iframe>` : `<p class="empty">${esc(s.name)} is down.</p>`}</div>`;
  ambient(art(s.name));
}

// ---------------------------------------------------------------- Settings
async function settingsPage() {
  const cfg = await api("/api/settings").catch(() => null);
  if (route().pg !== "settings") return;
  if (!cfg) { main.innerHTML = '<p class="empty">Settings are not available.</p>'; return; }
  const seg = (act, cur) => `<div class="seg" role="radiogroup">${[["pinned", "Pinned"], ["float", "Floating"]].map(([k, l]) =>
    `<button type="button" role="radio" aria-checked="${cur === k}" class="${cur === k ? "on" : ""}" data-act="${act}" data-v="${k}">${l}</button>`).join("")}</div>`;
  main.innerHTML = `<div class="ph"><h1>Settings</h1><p>One place for layout, vault, card images, agents and services.</p></div>
    <h3>Appearance</h3>
    <div class="img-sources">
      <div class="img-set glass"><b>Interface</b><small>Classic glass &amp; carousel, or Minimal matte workbench.</small>
        <div class="seg" role="radiogroup">${[["classic", "Classic"], ["minimal", "Minimal"]].map(([k, l]) =>
          `<button type="button" role="radio" aria-checked="${uiMode === k}" class="${uiMode === k ? "on" : ""}" data-act="set-ui" data-v="${k}">${l}</button>`).join("")}</div></div>
      <div class="img-set glass"><b>Calendar</b><small>Week strip under the top bar, or a pill that opens on hover.</small>${seg("set-cal", calMode)}</div>
      <div class="img-set glass"><b>Dock</b><small>Navigation bar at the bottom, or a compact pill that opens on hover. The canvas follows it too.</small>${seg("set-dock", dockMode)}</div>
      <div class="img-set glass"><b>Card art</b><small>Your images, animated ascii scenes, or images when you have them.</small>
        <div class="seg" role="radiogroup">${[["auto", "Auto"], ["images", "Images"], ["ascii", "ASCII"]].map(([k, l]) =>
          `<button type="button" role="radio" aria-checked="${cardArt === k}" class="${cardArt === k ? "on" : ""}" data-act="set-art" data-v="${k}">${l}</button>`).join("")}</div></div>
      <div class="img-set glass"><b>Canvas</b><small>Background surface for the free-form agent workbench.</small>
        <div class="seg" role="radiogroup">${CANVAS_BGS.map(([k, l, d]) =>
          `<button type="button" role="radio" aria-checked="${orchBg === k}" class="${orchBg === k ? "on" : ""}" data-act="set-canvas-bg" data-v="${k}" title="${esc(d)}">${l}</button>`).join("")}</div></div>
    </div>
    <h3>Theme</h3>
    <div class="themes">${THEMES.map(([k, l]) => `<button type="button" class="theme-sw ${(document.documentElement.dataset.theme || "overlook") === k ? "on" : ""}" data-act="set-theme" data-v="${k}">
      <span class="sw" data-theme="${k}"><i style="background:var(--surface-2)"></i><i style="background:var(--accent)"></i><i style="background:var(--accent-2)"></i><i style="background:var(--ink)"></i></span>${l}</button>`).join("")}</div>
    <h3>Vault &amp; server</h3>
    <form class="task glass" id="set-vault">
      <div class="set-row">
        <label>Vault path <input id="set-vault-dir" value="${esc(cfg.vaultDir)}" autocomplete="off"></label>
        <label>Language <select class="pick" id="set-vault-lang"><option value="en" ${cfg.vaultLang === "en" ? "selected" : ""}>English (en)</option><option value="pt" ${cfg.vaultLang === "pt" ? "selected" : ""}>Portuguese (pt)</option></select></label>
        <label>Port <input id="set-port" type="number" min="1024" max="65535" value="${esc(cfg.port)}"></label>
        <button class="btn peach" type="submit">Save</button>
      </div>
      <small>Vault path and language apply immediately and persist to <code>.env</code>; port takes effect on the next restart.</small>
    </form>
    <h3>Terminal &amp; Shell</h3>
    <form class="task glass" id="set-terminal">
      <div class="set-row">
        <label>Primary emulator
          <select class="pick" id="set-term-primary">
            ${(cfg.terminals || []).map((t) => `<option value="${esc(t.id)}" ${t.id === cfg.defaultTerminal ? "selected" : ""}>${esc(t.name)}</option>`).join("") || '<option value="">None detected</option>'}
          </select>
        </label>
        <label>Fallback emulator
          <select class="pick" id="set-term-fallback">
            <option value="" ${!cfg.fallbackTerminal ? "selected" : ""}>None</option>
            ${(cfg.terminals || []).map((t) => `<option value="${esc(t.id)}" ${t.id === cfg.fallbackTerminal ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
          </select>
        </label>
        <label>Default shell
          <select class="pick" id="set-term-shell">
            ${(cfg.shells || []).map((s) => `<option value="${esc(s.id)}" ${s.id === cfg.defaultShell ? "selected" : ""}>${esc(s.name)}</option>`).join("") || '<option value="bash">Bash</option>'}
          </select>
        </label>
        <button class="btn peach" type="submit">Save</button>
      </div>
      <small>Auto-detects installed emulators (Ghostty, Kitty, etc.). Falls back to secondary emulator if primary is unavailable.</small>
    </form>
    <h3>Card images</h3>
    <form class="task glass" id="set-images">
      <div class="set-row">
        <label>Photo folder <input id="set-folder" value="${esc(cfg.folder)}" placeholder="~/Pictures/my-photos" autocomplete="off"></label>
        <label>Pinterest board <input id="set-board" value="${esc(cfg.board)}" placeholder="user/board" autocomplete="off"></label>
        <a class="btn glass" href="#/images">Manage images</a>
        <button class="btn peach" type="submit">Save</button>
      </div>
      <small>Saved in <code>pinterest.json</code>. Use Manage images to star, hide or pick images per card.</small>
    </form>
    <h3>Agents (<code>agents.json</code>)</h3>
    <form class="task glass" id="set-agents-form">
      <textarea class="code" id="set-agents" rows="10" spellcheck="false" aria-label="Agents JSON">${esc(JSON.stringify(cfg.agents, null, 2))}</textarea>
      <div class="task-bar"><small>Each agent has <code>id</code>, <code>name</code>, and <code>run</code> (CLI command with <code>{prompt}</code>, <code>{model}</code>, <code>{effort}</code>, <code>{session}</code>) or <code>api</code> (<code>anthropic</code> / <code>openai</code>), plus optional <code>models</code>, <code>efforts</code> and <code>open</code> commands.</small>
        <button class="btn peach" type="submit">Save</button></div>
    </form>
    <h3>Agent icons</h3>
    <div class="av-grid">${(S.runners || []).map((r) => `<div class="av-item glass">
        <span class="av-pic">${avatar(r.id, "agents", 56)}</span><b>${esc(r.name)}</b>
        <button type="button" class="btn glass" data-act="avatar-pick" data-id="${esc(r.id)}">From your images</button>
        <label class="btn glass">From a file…<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-avatar="${esc(r.id)}" hidden></label>
        ${r.avatar ? `<button type="button" class="btn glass" data-act="avatar-remove" data-id="${esc(r.id)}">Remove</button>` : ""}</div>`).join("") || '<p class="empty">No agents yet.</p>'}</div>
    <h3>Services (<code>services.json</code>)</h3>
    <form class="task glass" id="set-services-form">
      <textarea class="code" id="set-services" rows="8" spellcheck="false" aria-label="Services JSON">${esc(JSON.stringify(cfg.services, null, 2))}</textarea>
      <div class="task-bar"><small>Each service has <code>id</code>, <code>name</code>, <code>url</code> and <code>desc</code> (plus optional <code>icon</code>, <code>dock</code>, <code>width</code>, <code>max</code>, <code>proxy</code>, <code>tailnet</code>, and <code>deploy</code> for Coolify, Dokploy or custom <code>targets</code>).</small>
        <button class="btn peach" type="submit">Save</button></div>
    </form>`;
  // A picked file goes up as a data URL; the server squares it to 256 px.
  main.querySelectorAll("[data-avatar]").forEach((inp) => inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    if (f.size > 2_000_000) return toast("Pick an image under 2 MB");
    const rd = new FileReader();
    rd.onload = async () => {
      try { await api("/api/avatar", { agent: inp.dataset.avatar, data: rd.result }); S = await api("/api/system"); settingsPage(); toast("Icon saved"); } catch (err) { toast(err.message); }
    };
    rd.readAsDataURL(f);
  });
  $("#set-vault").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/settings", { vaultDir: $("#set-vault-dir").value, vaultLang: $("#set-vault-lang").value, port: Number($("#set-port").value) });
      [D, S] = await Promise.all([api("/api"), api("/api/system")]); topBar(); toast("Vault & server settings saved");
    } catch (err) { toast(err.message); }
  };
  $("#set-terminal").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/settings", {
        defaultTerminal: $("#set-term-primary").value,
        fallbackTerminal: $("#set-term-fallback").value,
        defaultShell: $("#set-term-shell").value,
      });
      prefTerm = $("#set-term-primary").value;
      prefShell = $("#set-term-shell").value;
      try {
        localStorage.setItem("overlook.terminal", prefTerm);
        localStorage.setItem("overlook.shell", prefShell);
      } catch {}
      toast("Terminal preferences saved");
      settingsPage();
    } catch (err) { toast(err.message); }
  };
  $("#set-images").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/settings", { folder: $("#set-folder").value, board: $("#set-board").value });
      D = await api("/api"); toast("Card image sources saved");
    } catch (err) { toast(err.message); }
  };
  $("#set-agents-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const list = JSON.parse($("#set-agents").value);
      await api("/api/settings", { agents: list });
      S = await api("/api/system"); topBar(); toast("Agents saved");
    } catch (err) { toast(err.message); }
  };
  $("#set-services-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const list = JSON.parse($("#set-services").value);
      await api("/api/settings", { services: list });
      S = await api("/api/system"); topBar(); toast("Services saved");
    } catch (err) { toast(err.message); }
  };
  ambient(art("settings"));
}

// ---------------------------------------------------------------- routes and events
// ---------------------------------------------------------------- Command bar: "/" or Ctrl/⌘+K from any page
// One field for notes (title, then text), pages and actions; after Apple Spotlight and the Combobox on 21st.dev.
const GO = [["", "Home", "home"], ["notes", "Notes", "notes"], ["review", "Review", "review"], ["graph", "Graph", "graph"],
  ["agents", "Agents", "agents"], ["services", "Services", "services"], ["settings", "Settings", "settings"]];
const ck = { items: [], sel: 0, timer: 0, pick: null };
// pick(path): a chosen note goes there instead of opening, and only notes are listed (the canvas's note picker).
function cmdkOpen(pick = null) {
  const d = $("#cmdk");
  if (d.open) return;
  ck.pick = pick;
  $("#cmdk-q").placeholder = pick ? "Find a note to put on the canvas" : "Search notes, pages and actions";
  $("#cmdk-q").value = ""; cmdkFill(""); d.showModal(); $("#cmdk-q").focus();
}
function cmdkFill(q) {
  const terms = fold(q).trim().split(/\s+/).filter((t) => t && !STOP.has(t)), has = (s) => terms.every((t) => fold(s).includes(t));
  const acts = [{ ic: "spark", title: "Capture a thought", sub: "Action", run: () => ACTIONS.capture() },
    ...(D.focus?.length || !D.routines ? [] : [{ ic: "target", title: "Start the day", sub: "Action", run: () => ACTIONS["start-day"]() }]),
    ...GO.map(([h, title, ic]) => ({ ic, title, sub: "Page", href: `#/${h}` }))];
  const whole = terms.join(" "), rank = (n) => { const t = fold(n.title); return t === whole ? 0 : t.startsWith(whole) ? 1 : t.includes(terms[0] || "") ? 2 : 3; };
  const notes = (terms.length ? D.notes.filter((n) => has(`${n.title} ${n.summary} ${n.tags.join(" ")}`))
    .sort((a, b) => rank(a) - rank(b) || a.title.length - b.title.length) : ck.pick ? D.notes : []).slice(0, 8)
    .map((n) => ({ ic: n.type === "project" ? "bolt" : "notes", title: n.title, sub: folderLabel(n.folder), href: noteHref(n.path), path: n.path }));
  ck.items = [...notes, ...(ck.pick ? [] : acts.filter((a) => !terms.length || has(a.title)))]; ck.sel = 0; cmdkPaint();
  clearTimeout(ck.timer);
  if (terms.join("").length < 3) return;
  ck.timer = setTimeout(async () => {
    const hits = await api(`/api/search?q=${encodeURIComponent(terms.join(" "))}`).catch(() => []);
    if ($("#cmdk-q").value !== q || !$("#cmdk").open) return;
    const seen = new Set(ck.items.map((it) => it.href));
    const more = hits.filter((h) => !seen.has(noteHref(h.path))).slice(0, 6).map((h) => ({ ic: "notes", title: h.title, sub: h.line, href: noteHref(h.path), path: h.path, text: true }));
    if (more.length) { ck.items = [...ck.items, ...more]; cmdkPaint(); }
  }, 200);
}
function cmdkPaint() {
  $("#cmdk-list").innerHTML = ck.items.map((it, i) => `${it.text && !ck.items[i - 1]?.text ? '<div class="ck-sep">In the text</div>' : ""}
    <button type="button" class="ck-row ${i === ck.sel ? "on" : ""}" data-i="${i}" role="option" aria-selected="${i === ck.sel}">${icon(it.ic, 16)}<span class="ck-t">${esc(it.title)}</span><span class="ck-s">${esc(it.sub)}</span></button>`).join("")
    || `<div class="ck-empty">Nothing matches. <button type="button" class="btn glass" data-ck="capture">Capture it as a question</button></div>`;
}
function cmdkGo(i) {
  const it = ck.items[i];
  if (!it) return;
  $("#cmdk").close();
  if (ck.pick && it.path) ck.pick(it.path); else if (it.href !== undefined) location.hash = it.href; else it.run();
}
$("#cmdk-q").addEventListener("input", (e) => cmdkFill(e.target.value));
$("#cmdk").addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    ck.sel = (ck.sel + (e.key === "ArrowDown" ? 1 : -1) + ck.items.length) % Math.max(1, ck.items.length);
    cmdkPaint(); $("#cmdk-list .ck-row.on")?.scrollIntoView({ block: "nearest" });
  }
  if (e.key === "Enter") { e.preventDefault(); cmdkGo(ck.sel); }
});
$("#cmdk").addEventListener("click", (e) => {
  if (e.target.id === "cmdk") return e.target.close(); // the backdrop
  if (e.target.closest("[data-ck=capture]")) { $("#cmdk").close(); return ACTIONS.capture(); }
  const row = e.target.closest(".ck-row");
  if (row) cmdkGo(Number(row.dataset.i));
});
$("#cmdk-list").addEventListener("pointermove", (e) => {
  const row = e.target.closest(".ck-row");
  if (row && Number(row.dataset.i) !== ck.sel) { ck.sel = Number(row.dataset.i); $("#cmdk-list").querySelectorAll(".ck-row").forEach((r) => r.classList.toggle("on", r === row)); }
});

// Icons swell toward the pointer, macOS-style (after the Floating Dock on 21st.dev): the dock and the canvas's floating
// bars. lift: how far the nearest button moves at full swell (negative = up, for a bar at the bottom; positive = down,
// for one at the top). inside: only what the buttons show (icon, label) swells, within their outline (the ☰ / Home pill).
// Mouse only; off with reduced motion. Bound once per bar: its buttons can be redrawn freely.
const calm = matchMedia("(prefers-reduced-motion: reduce)");
function magnify(bar, lift = -26, inside = false) {
  if (!bar) return;
  const parts = () => [...bar.querySelectorAll("a, button")].flatMap((el) => (inside ? [...el.children] : [el]));
  bar.addEventListener("pointermove", (e) => {
    if (calm.matches || e.pointerType !== "mouse") return;
    for (const el of bar.querySelectorAll("a, button")) {
      const r = el.getBoundingClientRect(), k = Math.max(0, 1 - Math.abs(e.clientX - (r.left + r.width / 2)) / 110);
      if (inside) { for (const c of el.children) c.style.transform = k > .005 ? `scale(${(1 + .22 * k).toFixed(3)})` : ""; continue; }
      const s = 1 + .3 * k;
      el.style.transform = s > 1.001 ? `translateY(${(lift * (s - 1)).toFixed(1)}px) scale(${s.toFixed(3)})` : "";
    }
  });
  bar.addEventListener("pointerleave", () => { for (const el of parts()) el.style.transform = ""; });
}
magnify($("#dock"));

const PAGES = { "": [home, "Home"], notes: [notes, "Notes"], n: [reader, "Note"], w: [wiki, "Note"], review: [review, "Review"], graph: [graph, "Graph"], agents: [agents, "Agents"], services: [services, "Services"], images: [imagesPage, "Images"], settings: [settingsPage, "Settings"], s: [service, "Service"], a: [agentPage, "Agent"], t: [taskPage, "Task"] };
function route() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGES[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  if (cwdOpen) { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); }
  if (document.activeElement?.closest?.("#dockwrap, .crumb")) document.activeElement.blur(); // a floating dock folds after you pick a page; no ring left on the name
  graphStop?.(); graphStop = null; clearInterval(orchTimer);
  const { pg, arg } = route();
  // the canvas's layout stays on the canvas; leaving it from the dock keeps the browser in full screen
  if (pg !== "agents" && document.body.classList.contains("canvas-full")) { appFull ||= !!document.fullscreenElement; canvasFull(false); }
  if (pg !== "s" && document.body.classList.contains("svc-full")) svcFull(false);
  $("#crumb").textContent = pg === "a" ? S.background?.find((x) => x.key === arg)?.title || AGENT_NAME[S.agents.find((x) => x.key === arg)?.name]?.[0] || "Agent" : pg === "s" ? S.services.find((s) => s.id === arg)?.name || "Service" : PAGES[pg][1];
  document.body.classList.toggle("home", !pg);
  document.body.classList.toggle("app", pg === "s"); // an embedded app takes over the week strip's height
  document.body.classList.toggle("agents", pg === "agents" || pg === "a" || pg === "t");
  document.body.classList.toggle("canvas-page", pg === "agents"); // the canvas takes the whole screen: no header; the dock stays
  if (pg !== "s") $("#svcbar").innerHTML = "";
  main.style.animation = "none"; main.offsetHeight; main.style.animation = "";
  topBar();
  PAGES[pg][0](arg);
}

let captureMode = "daily";
function initCaptureAgent() {
  const agentSel = $("#capture-agent");
  if (!agentSel) return;
  const runners = (S.runners || []).filter((r) => r.ready);
  const cur = agentSel.value;
  agentSel.innerHTML = (runners.length ? runners : S.runners || []).map((r) => `<option value="${esc(r.id)}" ${r.ready ? "" : "disabled"}>${esc(r.name)}${r.ready ? "" : " (not set up)"}</option>`).join("");
  if (cur && (S.runners || []).some((r) => r.id === cur)) agentSel.value = cur;
  agentSel.onchange = () => runOptions(false, "capture");
  const modelSel = $("#capture-model");
  if (modelSel) modelSel.onchange = () => runOptions(true, "capture");
  runOptions(false, "capture");
}
function setCaptureMode(mode) {
  captureMode = mode;
  const isAgent = mode === "agent";
  document.querySelectorAll(".capture-tabs button").forEach((b) => {
    const on = b.dataset.tab === mode;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  $("#capture-agent-panel").hidden = !isAgent;
  $("#capture-hint").hidden = isAgent;
  $("#capture-text").placeholder = isAgent ? "What should the agent research and write up?" : "An idea, a link, a question";
  $("#capture-submit-btn span").textContent = isAgent ? "Send to agent" : "Save";
  if (isAgent) initCaptureAgent();
}

const ACTIONS = {
  ...CAL_ACTIONS, ...IMG_ACTIONS,
  prev: () => move(-1), next: () => move(1), go: (el) => { idx = Number(el.dataset.i); place(); },
  filter: (el) => { filter = el.dataset.k; notes(); },
  "card-show": (el) => { rvShown = el.dataset.id; rvRedraw(); },
  "card-yes": (el) => cardDo("answer", el.dataset.id, true), "card-no": (el) => cardDo("answer", el.dataset.id, false), "card-rm": (el) => cardDo("remove", el.dataset.id),
  trash: async (el) => {
    if (!(await askOk(`Delete "${el.dataset.p}"?`, "It goes to the vault's .trash folder.", "Delete note"))) return;
    try { await api("/api/trash", { path: el.dataset.p }); } catch (e) { return toast(e.message); }
    D = await api("/api"); toast("Moved to .trash"); location.hash = "#/notes";
  },
  cmdk: () => cmdkOpen(),
  "start-day": async () => {
    const agent = (S.runners || []).find((r) => r.ready)?.id;
    if (!agent) return toast("No agent is ready: add one in Settings");
    try { const r = await api("/api/routine", { name: "morning", agent }); S = await api("/api/system"); location.hash = `#/t/${r.id}`; } catch (e) { toast(e.message); }
  },
  // A note into review: the card "What is X?", answered by the note's summary.
  enroll: async (el) => {
    try { const r = await api("/api/cards/add", { path: el.dataset.p }); D.cards = r.cards; toast(`In review: “${esc(r.card.q)}” comes back tomorrow`); } catch (e) { toast(e.message); }
    render();
  },
  routine: async (el) => {
    try {
      const r = await api("/api/routine", { name: el.dataset.k, ...runChoice() });
      S = await api("/api/system");
      if (route().pg === "agents") {
        orchMax = "";
        orchPanes = [{ kind: "task", id: r.id }]; orchActive = `task:${r.id}`;
        agentsBody(); orchPaint(true); toast("Routine started");
      } else location.hash = `#/t/${r.id}`;
    } catch (e) { toast(e.message); }
  },
  "cwd-open": async (el) => {
    const pane = el.dataset.pane || "";
    if (cwdOpen && cwdPaneKey === pane) { cwdOpen = false; paintCwdPop(); return; }
    cwdPaneKey = pane;
    lastCwdBtn = el;
    cwdOpen = true;
    const cur = pane ? (orchPanes.find((p) => paneKey(p) === pane)?.cwd ?? orchCwd) : orchCwd;
    await loadCwdBrowser(cur || "~/dev", true);
    placeCwdPop(el);
    $("#cwd-q")?.focus();
  },
  "cwd-close": () => { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); },
  "cwd-nav": (el) => cwdGo(el.dataset.path ?? "~/dev"),
  "cwd-pick": (el) => pickCwd(el.dataset.path ?? ""),
  "orch-role": (el) => {
    orchRole = el.dataset.role;
    el.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
    const row = ORCH_ROLES.find(([k]) => k === orchRole) || ORCH_ROLES[0];
    const inp = $("#run-prompt"); if (inp) { inp.placeholder = row[2]; inp.focus(); }
  },
  "orch-extra": (el) => {
    const id = el.dataset.id;
    if (orchExtra.has(id)) orchExtra.delete(id); else orchExtra.add(id);
    renderMultiChips();
  },
  "orch-rail-open": () => {
    $("#orch-fleet-wrap")?.classList.toggle("open");
  },
  "orch-rail-mode": () => {
    orchRailMode = orchRailMode === "float" ? "dock" : "float";
    saveRailMode();
    saveCanvas();
    const wrap = $("#orch-fleet-wrap");
    if (wrap) wrap.classList.toggle("float", orchRailMode === "float");
    const body = $("#agents-body");
    if (body) body.classList.toggle("rail-float", orchRail && orchRailMode === "float");
    const fleet = document.querySelector(".orch-fleet");
    if (fleet) fleet.classList.toggle("floating", orchRailMode === "float");
    const btn = document.querySelector('[data-act="orch-rail-mode"]');
    if (btn) {
      btn.classList.toggle("on", orchRailMode !== "float");
      btn.title = orchRailMode === "float" ? "Keep Sessions open beside the canvas" : "Let Sessions float over the canvas";
    }
  },
  "orch-deck-toggle": (el) => {
    orchDeckOpen = !orchDeckOpen;
    $("#run")?.classList.toggle("open", orchDeckOpen);
    document.querySelectorAll('[data-act="orch-deck-toggle"]').forEach((b) => b.classList.toggle("on", orchDeckOpen));
    if (!orchDeckOpen && el) el.blur();
  },
  "cv-menu": (el) => mainMenu(el),
  "orch-deck-show": () => deckShow(),
  "orch-vault-note": () => openVaultNotes(),
  "note-ask": (el) => askAgent(el.dataset.p),
  // Ask the vault: an agent on the canvas answers from the notes, says which, and looks it up when they don't have it.
  // The question comes back as a review card: the agent adds it to Review.md once it has answered.
  "vault-ask": (el) => {
    const q = (el?.dataset?.q ?? query).trim();
    if (!q) return $("#search")?.focus();
    agentOnCanvas(`My question: ${q}\n\nAnswer it from this vault's notes first: search them (titles and text) and cite the ones you used as [[links]]. If the vault doesn't have it, say so, look it up, answer, and ask me whether to save what you found as a note (following AGENTS.md). Answer in the language of my question.\n\nOnce you have answered, add my question as a review card, so it comes back to me in a few days: one line at the end of ${D.cardsFile || "Review.md"} at the vault root (create the file if it's missing): \`- <my question, short> :: <your answer in one or two plain sentences> [[<the note it comes from, if any>]]\`. If that question is already there, replace its line.`);
  },
  // Save as a note: a link or a few lines (what you just learned) become a note, filed by an agent following AGENTS.md.
  "vault-save": async () => {
    const q = query.trim();
    if (!q) return $("#search")?.focus();
    try {
      const r = await api("/api/note/agent", { topic: q });
      query = ""; if (route().pg === "notes") notes();
      toast(`An agent is writing the note · <a href="#/t/${esc(r.id)}">See it</a>`);
    } catch (e) { toast(e.message); }
  },
  // Check a deduced note: an agent compares it with its source, fixes it and marks it confirmed.
  "vault-check": (el) => {
    const n = D.notes.find((x) => x.path === el.dataset.p);
    if (n) agentOnCanvas(`Check the note [[${nameOf(n.path)}]] (${n.path}): its confidence is "${n.confidence}", written by deduction and never confirmed. Compare what it says with its source (the code, the database, the documents it cites), fix what's wrong, and once it's confirmed update its confidence and date as AGENTS.md says. Tell me what changed. Answer in the language of the note.`);
  },
  // Write a missing note: an agent writes it from the notes that already link it.
  "vault-write": async (el) => {
    try {
      const r = await api("/api/note/agent", { topic: `${el.dataset.t}: the vault links [[${el.dataset.t}]] ${el.dataset.n} times but the note doesn't exist yet. Read the notes that link it first, then write it from what they say` });
      toast(`An agent is writing "${esc(el.dataset.t)}" · <a href="#/t/${esc(r.id)}">See it</a>`);
    } catch (e) { toast(e.message); }
  },
  "note-canvas": (el) => noteToCanvas(el.dataset.p),
  // Graph: click a note to focus it (again: open it), how far around it, what depends on it, the layout.
  "gm-focus": (el) => {
    const id = el.dataset.id, n = D.notes.find((x) => nameOf(x.path) === id);
    location.hash = id === route().arg.split("/")[0] && n ? noteHref(n.path) : `#/graph/${encodeURIComponent(id)}`;
  },
  "gm-depth": (el) => { gDepth = +el.dataset.d; gImpact = false; graph(route().arg); },
  "gm-impact": () => { gImpact = !gImpact; graph(route().arg); },
  "gm-link": (el) => {
    const m = gmModel(), me = m.byId.get(route().arg.split("/")[0]), x = m.byId.get(el.dataset.id);
    if (!me || !x) return;
    const common = [...me.nb].filter((z) => x.nb.has(z)).map((z) => `[[${z.id}]]`).join(", ");
    agentOnCanvas(`[[${me.id}]] and [[${x.id}]] don't link each other but both link ${common}. Read the two notes: if they really relate, add a [[${x.id}]] link in [[${me.id}]] where it fits (and the other way, if it makes sense), following AGENTS.md. If they don't, say so and change nothing. Answer in the language of the notes.`);
  },
  "gm-explain": () => {
    const [a, b] = route().arg.split("/"), m = gmModel(), p = m.byId.get(a) && m.byId.get(b) && gmPath(m.byId.get(a), m.byId.get(b));
    if (p) agentOnCanvas(`In this vault [[${a}]] connects to [[${b}]] through ${p.map((x) => `[[${x.id}]]`).join(" → ")}. Read those notes and explain in a few sentences how one leads to the other, and anything in between I should know. Answer in the language of the notes.`);
  },
  "gm-lane": (el) => { const l = +el.dataset.l; gShow.has(l) ? gShow.delete(l) : gShow.add(l); graph(route().arg); },
  "gm-mode": (el) => { gMode = el.dataset.m; graph(route().arg); },
  "gm-ask": () => {
    const me = gmModel().byId.get(route().arg);
    if (!me) return;
    const down = gmReach(me, 2, DOWN), ring = (h) => [...down].filter(([, d]) => d === h).map(([x]) => `[[${x.id}]]`).join(", ") || "none";
    agentOnCanvas(`I'm thinking of changing [[${me.id}]] (${me.n.type || "a note"}). In this vault these notes link to it and may depend on it:\n- directly: ${ring(1)}\n- through those: ${ring(2)}\n\nRead [[${me.id}]] and those notes, then tell me what would break or need changing if it changed, and what to check first. The list comes from links between notes, which have no direction, so say which ones don't really depend on it. Answer in the language of the notes.`);
  },
  "focus-done": async (el) => {
    el.classList.add("ticking");
    try { const r = await api("/api/focus/done", { text: el.dataset.t }); setTimeout(() => { D.focus = r.focus; tdRender(true); }, 180); } catch (e) { el.classList.remove("ticking"); toast(e.message); }
  },
  "td-done": (el) => { const t = tdAll().find((x) => x.id === el.dataset.id); if (!t) return; el.classList.add("ticking"); setTimeout(() => tdSave(t.id, { done: !t.done }), 180); },
  "td-edit": (el) => { tdOpen = el.dataset.id; tdRender(true); $(".td-edit .td-title")?.focus(); },
  "td-move": (el) => tdSave(el.dataset.id, { due: addDays(D.today, Number(el.dataset.d)) }),
  "td-set": (el) => { const id = el.closest(".td-edit")?.dataset.id; if (id) tdSave(id, el.dataset.f === "prio" ? { prio: !!el.dataset.v } : { [el.dataset.f]: el.dataset.v, ...(el.dataset.f === "due" && !el.dataset.v ? { time: "" } : {}) }); },
  "td-pick": (el) => { const i = el.parentElement.querySelector("input"); try { i.showPicker(); } catch { i.focus(); } },
  "td-more": () => { tdMore = !tdMore; tdRender(true); },
  "td-agent": (el) => { const t = tdAll().find((x) => x.id === el.dataset.id); if (t) agentOnCanvas(`A task from my to-do list: ${t.text}${t.note ? `\n\nNotes:\n${t.note}` : ""}\n\nWork on it in this vault; tell me first, in two lines, what you will do.`); },
  "td-del": async (el) => {
    const t = tdAll().find((x) => x.id === el.dataset.id);
    if (!t) return;
    tdOpen = "";
    try { const r = await api("/api/todos/delete", { id: t.id }); D.todos = r.todos; tdGone = t; tdRender(true); toast(`Deleted "${esc(t.text)}" · <button type="button" class="toast-act" data-act="td-undo">Undo</button>`); }
    catch (e) { toast(e.message); }
  },
  // Undo a delete: the task comes back with its date, repeat, time, importance and note (as a new line at the end).
  "td-undo": async () => {
    const t = tdGone;
    if (!t) return;
    tdGone = null;
    try {
      const r = await api("/api/todos/add", { text: t.text });
      await tdSave(r.todo.id, { text: t.text, due: t.due, time: t.time, repeat: t.repeat, prio: t.prio, note: t.note });
    } catch (e) { toast(e.message); }
  },
  "home-agent": (el) => toCanvas(() => ACTIONS["orch-sel"]({ dataset: { kind: el.dataset.kind, id: el.dataset.id } })),
  "orch-map": () => { orchMapOpen = !orchMapOpen; saveCanvas(); drawMap(); paintHud($("#orch-hud"), orchMode === "free" && !orchMax); },
  "term-new-pane": () => newTermPane(),
  "term-launch-app": async (el) => {
    const key = el.dataset.key;
    const p = orchPanes.find((x) => paneKey(x) === key);
    const cwd = p?.cwd || $("#run-cwd")?.value || orchCwd;
    const terminal = p?.emulator || prefTerm || "ghostty";
    try {
      const res = await api("/api/terminal/open", { terminal, shell: p?.shell || prefShell || undefined, cwd });
      toast(res.fallback ? `${res.terminal} (fallback) opened in ${cwdLabel(res.cwd)}` : `${res.terminal} opened in ${cwdLabel(res.cwd)}`);
    } catch (e) {
      toast(e.message);
    }
  },
  "term-close-session": async (el) => {
    const id = el.dataset.id;
    orchPanes = orchPanes.filter((p) => !(p.kind === "terminal" && p.id === id));
    saveCanvas();
    termClose(id);
    agentsBody();
    orchPaint(true);
    toast("Terminal closed");
  },
  "orch-mode": (el) => {
    orchMode = (el.dataset.m || el.dataset.mode) === "free" ? "free" : "tile";
    orchMax = "";
    document.querySelectorAll('[data-act="orch-mode"]').forEach((b) => b.classList.toggle("on", (b.dataset.m || b.dataset.mode) === orchMode));
    if (orchMode === "free") orchPanes.forEach(ensurePaneRect);
    orchSigs.clear();
    agentsBody();
    if (orchMode === "free" && orchPanX === 24 && orchPanY === CANVAS_TOP && orchZoom === 1) fitCanvasView();
  },
  "draw-card": (el) => (drawing?.kind === el.dataset.kind ? endDraw() : drawCard(el.dataset.kind)),
  "orch-bg-menu": (el) => ctxAt(el, bgItems()),
  "orch-bg": (el) => setCanvasBg(el.dataset.bg || el.dataset.v),
  "set-canvas-bg": (el) => { setCanvasBg(el.dataset.v); if (route().pg === "settings") settingsPage(); },
  "orch-dir": () => {
    orchDir = orchDir === "cols" ? "rows" : "cols";
    orchSigs.clear();
    agentsBody();
  },
  "orch-arrange": () => arrangeCanvasPanes(),
  "orch-fit": () => fitCanvasView(),
  "orch-zoom": (el) => {
    const d = Number(el.dataset.d || 0);
    const canvas = $("#orch-canvas");
    const r = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
    const cx = r.width / 2, cy = r.height / 2;
    if (d === 0) {
      const prevZoom = orchZoom;
      orchZoom = 1;
      orchPanX = Math.round(cx - (cx - orchPanX) * (orchZoom / prevZoom));
      orchPanY = Math.round(cy - (cy - orchPanY) * (orchZoom / prevZoom));
    } else {
      const prevZoom = orchZoom;
      const nextZoom = Math.min(2.5, Math.max(0.2, Math.round((orchZoom + d) * 100) / 100));
      orchPanX = Math.round(cx - (cx - orchPanX) * (nextZoom / prevZoom));
      orchPanY = Math.round(cy - (cy - orchPanY) * (nextZoom / prevZoom));
      orchZoom = nextZoom;
    }
    applyCanvasTransform();
    saveCanvas();
  },
  "orch-del-sel": () => deleteSelectedPanes(),
  "orch-tool": (el) => {
    orchTool = el.dataset.tool || "select";
    const canvas = $("#orch-canvas");
    if (canvas) {
      canvas.classList.toggle("tool-pan", orchTool === "pan");
      canvas.classList.toggle("tool-select", orchTool === "select");
    }
    const hud = $("#orch-hud");
    if (hud) {
      hud.querySelectorAll("button[data-act='orch-tool']").forEach((b) => b.classList.toggle("on", b.dataset.tool === orchTool));
    }
  },
  "orch-swap": (el) => {
    const k = el.dataset.key, idx = orchPanes.findIndex((p) => paneKey(p) === k);
    if (idx < 0 || orchPanes.length < 2) return;
    const nextIdx = (idx + 1) % orchPanes.length;
    const tmp = orchPanes[idx]; orchPanes[idx] = orchPanes[nextIdx]; orchPanes[nextIdx] = tmp;
    orchSigs.clear();
    orchPaint(true);
  },
  "canvas-full": () => canvasFull(),
  "app-full": () => appFullToggle(),
  "orch-collapse": (el) => {
    const p = orchPanes.find((x) => paneKey(x) === el.dataset.key);
    if (!p) return;
    if (orchMode !== "free" || orchMax) return toast("Minimize works on the free canvas");
    p.collapsed = !p.collapsed;
    saveCanvas(); orchSigs.clear(); orchPaint(true);
  },
  "pane-tui": (el) => {
    const p = orchPanes.find((x) => paneKey(x) === el.dataset.key);
    if (!p) return;
    const agent = p.kind === "task" ? el.dataset.agent : S.runners?.find((r) => r.process === el.dataset.agent)?.id;
    delete p.cwd; // the server takes the folder from the session
    paneToTui(p, p.kind === "task" ? { task: p.id, agent } : { key: p.id, agent });
  },
  "link-del": (el) => {
    const i = Number(el.dataset.i);
    if (i >= 0 && i < orchLinks.length) {
      orchLinks.splice(i, 1);
      saveCanvas();
      orchSigs.clear();
      orchPaint(true);
      toast("Link removed");
    }
  },
  "orch-sketch": () => setSketch(!sketchOn),
  "sketch-tool": (el) => { sketchApi?.setActiveTool({ type: el.dataset.tool }); paintSketchBar(el.dataset.tool); },
  "sketch-color": (el) => sketchPaint({ strokeColor: el.dataset.c }),
  // A Fleet row opens its session on the canvas (as a TUI when idle) or brings it into view; it never replaces a card.
  "orch-sel": (el) => {
    const item = { kind: el.dataset.kind, id: el.dataset.id }, k = paneKey(item);
    if (orchPanes.some((p) => paneKey(p) === k)) return focusPane(k);
    if (openTui(item)) return;
    addPane(item);
  },
  "orch-max": (el) => {
    const k = el.dataset.key;
    orchMax = orchMax === k ? "" : k;
    orchActive = k;
    orchSigs.clear();
    agentsBody();
  },
  "orch-unpin": async (el) => {
    const k = el.dataset.key;
    if (!(await closeLiveOk([k]))) return;
    orchMax = "";
    const pane = orchPanes.find((p) => paneKey(p) === k);
    if (pane && pane.kind === "terminal") termClose(pane.id);
    orchPanes = orchPanes.filter((p) => paneKey(p) !== k);
    orchSelected.delete(k);
    updateSelectionUI();
    if (orchActive === k) orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
    saveCanvas();
    orchSigs.clear();
    agentsBody();
    orchPaint(true);
  },
  "orch-dismiss": async (el) => {
    const kind = el.dataset.kind, id = el.dataset.id;
    if (!kind || !id) return;
    if (kind === "task" && !(await askOk("Delete this task?", "Its history leaves Overlook too.", "Delete task"))) return;
    const targetKey = `${kind}:${id}`;
    orchSelected.delete(targetKey);
    updateSelectionUI();
    orchLinks = orchLinks.filter((l) => l.a !== targetKey && l.b !== targetKey);
    if (kind === "task") {
      try { await api("/api/task/delete", { id }); } catch (e) { return toast(e.message); }
      if (S?.tasks) S.tasks = S.tasks.filter((t) => t.id !== id);
    } else if (kind === "agent") {
      dismissedSessions.add(id);
      saveDismissedSessions();
    }
    const wasInPanes = orchPanes.some((p) => paneKey(p) === targetKey);
    if (wasInPanes) {
      orchPanes = orchPanes.filter((p) => paneKey(p) !== targetKey);
      const paneKeys = new Set(orchPanes.map(paneKey));
      orchLinks = orchLinks.filter((l) => paneKeys.has(l.a) && paneKeys.has(l.b));
      if (orchActive === targetKey) {
        orchActive = paneKey(orchPanes[0]);
      }
      if (orchMax === targetKey) orchMax = "";
      saveCanvas();
    } else if (orchActive === targetKey) {
      orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
      if (orchMax === targetKey) orchMax = "";
      saveCanvas();
    }
    try { S = await api("/api/system"); } catch {}
    orchSigs.clear();
    agentsBody();
    toast("Chat dismissed");
  },
  open: async (el) => {
    try { await api("/api/open", { via: el.dataset.via, key: el.dataset.key, task: el.dataset.task }); toast(`Opening in ${el.dataset.via}`); } catch (e) { toast(e.message); }
  },
  effort: (el) => el.parentElement.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === el); b.setAttribute("aria-checked", b === el); }),
  "avatar-remove": async (el) => { await api("/api/avatar", { agent: el.dataset.id, remove: true }).catch((e) => toast(e.message)); S = await api("/api/system"); settingsPage(); },
  "set-theme": (el) => { document.documentElement.dataset.theme = el.dataset.v; try { localStorage.setItem("overlook.theme", el.dataset.v); } catch {} settingsPage(); },
  "set-art": (el) => { cardArt = el.dataset.v; try { localStorage.setItem(ART_KEY, cardArt); } catch {} settingsPage(); toast(`Card art: ${el.textContent}`); },
  "set-ui": (el) => { setUi(el.dataset.v); toast(`Interface: ${el.textContent}`); },
  "ui-toggle": () => { setUi(uiMode === "minimal" ? "classic" : "minimal"); toast(`Interface: ${uiMode === "minimal" ? "Minimal" : "Classic"}`); },
  "cycle-art": () => { cardArt = asciiCards() ? "images" : "ascii"; try { localStorage.setItem(ART_KEY, cardArt); } catch {} place(); toast(`Card art: ${cardArt === "ascii" ? "ASCII" : "Images"}`); },
  stop: async (el) => { await api("/api/task/stop", { id: el.dataset.id }).catch(() => {}); toast("Stopping…"); S = await api("/api/system"); if (route().pg === "agents") { agentsBody(); orchPaint(true); } },
  pinsync: async (el) => {
    el.disabled = true; el.textContent = "Syncing…";
    try {
      const p = await api("/api/pinterest/sync", {});
      toast(p.status === "ok" ? `${p.images.length} images in the cache` : p.error || "Sync failed");
    } catch (e) { toast(e.message); }
    [D, S] = await Promise.all([api("/api"), api("/api/system")]); render();
  },
  reload: () => { const f = $("#svcf"); f.src = f.src; },
  "svc-full": () => svcFull(),
  "svc-deploy": async (el) => {
    const { service, app, action, kind } = el.dataset;
    el.disabled = true;
    if (action === "deploy") el.textContent = "Deploying…";
    try {
      const r = await api("/api/deploy", { service, app, action, kind });
      toast(r.output ? `${action === "restart" ? "Restarted" : "Deploy triggered"}: ${r.output}` : `${action === "restart" ? "Restart" : "Deploy"} triggered`);
    } catch (e) { toast(e.message); }
    S = await api("/api/system");
    if (route().pg === "services") services();
  },
  "svc-refresh": async (el) => {
    el.disabled = true;
    try { await api("/api/deploy", { refresh: true }); } catch {}
    S = await api("/api/system");
    if (route().pg === "services") services();
  },
  capture: () => {
    setCaptureMode("daily");
    initCaptureAgent();
    $("#capture-day").textContent = D?.today || "";
    $("#capture").showModal();
    $("#capture-text").focus();
  },
  "capture-tab": (el) => setCaptureMode(el.dataset.tab),
  "capture-save": async () => {
    const ta = $("#capture-text");
    const text = ta.value.trim();
    if (!text) return;
    if (captureMode === "agent") {
      const { agent, model, effort } = runChoice("capture");
      ta.value = "";
      $("#capture").close();
      try {
        const res = await api("/api/note/agent", { topic: text, agent, model, effort });
        const taskId = res?.id || res?.taskId;
        if (taskId) {
          toast(`<a href="#/t/${esc(taskId)}">Agent dispatched: "${esc(text)}"</a>`);
          if (route().pg === "agents") {
            orchPanes.push({ kind: "task", id: taskId });
            orchActive = `task:${taskId}`;
            saveCanvas();
            S = await api("/api/system");
            agentsBody();
            orchPaint(true);
          } else {
            location.hash = `#/t/${encodeURIComponent(taskId)}`;
          }
        } else {
          toast(`Agent dispatched: "${text}"`);
        }
      } catch (e) {
        toast(`Dispatch failed: ${e.message}`);
      }
    } else {
      ta.value = "";
      $("#capture").close();
      await api("/api/capture", { text });
      toast("Captured in the daily note");
      D = await api("/api");
      if (!route().pg) home();
      topBar();
    }
  },
  "quota-retry": (el) => retryTask(el.dataset.task, el.dataset.model, el.dataset.pane, { agent: el.dataset.agent, prompt: el.dataset.prompt, effort: el.dataset.effort }),
  "quota-retry-sel": (el) => {
    const sel = el.parentElement?.querySelector(".quota-model-sel");
    retryTask(el.dataset.task, sel?.value, el.dataset.pane, { agent: el.dataset.agent, prompt: el.dataset.prompt, effort: el.dataset.effort });
  },
};
document.addEventListener("click", (e) => {
  if (e.target.closest("a[target]")) return;
  if (cwdOpen && !e.target.closest("#cwd-pop") && !e.target.closest('[data-act="cwd-open"]')) {
    cwdOpen = false; cwdPaneKey = ""; paintCwdPop();
  }
  if (!e.target.closest("#dockwrap") || e.target.closest("#dock a")) $("#dockwrap")?.classList.remove("open");
  if (!e.target.closest("#orch-fleet-wrap")) $("#orch-fleet-wrap")?.classList.remove("open");
  const el = e.target.closest("[data-act]");
  if (el) { e.preventDefault(); ACTIONS[el.dataset.act]?.(el); return; }
  const res = e.target.closest(".ev.result");
  if (res && !getSelection().toString()) res.classList.toggle("open");
  const side = e.target.closest(".card.side");
  if (side) { e.preventDefault(); idx = Number(side.dataset.i); place(); }
});
document.addEventListener("input", (e) => { if (e.target.id === "search") { query = e.target.value; grid(); } });
$("#capture-text").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  ACTIONS["capture-save"]();
});
document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }
  });
});
$("#dock-pill")?.addEventListener("click", () => {
  $("#dockwrap")?.classList.toggle("open");
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k" && !(route().pg === "agents" && e.target.closest("input, textarea, [contenteditable]"))) { e.preventDefault(); cmdkOpen(); return; }
  if (e.key === "Escape" && cwdOpen) { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); return; }
  if (e.key === "Escape" && calDay && !document.querySelector("dialog[open]")) { calDay = ""; calRender(); return; }
  if (e.key === "Escape" && document.body.classList.contains("svc-full")) { svcFull(false); return; }
  if (e.key === "Escape" && route().pg === "agents" && !document.querySelector("dialog[open]") && !inCanvasCardFocus()) {
    if (orchSelected.size > 0) {
      orchSelected.clear();
      updateSelectionUI();
      return;
    }
    if (document.body.classList.contains("canvas-full")) {
      e.preventDefault();
      canvasFull(false);
      return;
    }
  }
  if (e.key === "Delete" && orchSelected.size > 0 && route().pg === "agents" && !orchMax && !document.querySelector("dialog[open]")) {
    if (!sketchOn && !e.target.closest("input, textarea, select, [contenteditable]")) {
      e.preventDefault();
      deleteSelectedPanes();
      return;
    }
  }
  // ←/→ walk the dock's pages, also from an empty text field (Home and Notes focus theirs on open; there the arrows move
  // nothing), never from the canvas's fields or a terminal. The Classic Home's carousel keeps them for its cards.
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !document.querySelector("dialog[open]")
    && (!e.target.closest("input, textarea, select, [contenteditable]") || (e.target.matches("textarea, input:is(:not([type]), [type=text], [type=search])") && !e.target.value && !e.target.closest(".orch-shell")))) {
    e.preventDefault();
    const d = e.key === "ArrowLeft" ? -1 : 1;
    if (!route().pg && $("#car")) move(d); else dockStep(d);
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
  const { pg } = route();
  if (sketchOn) return; // letters are Excalidraw's tools (Esc is handled first, below bindSketchClicks)
  if (pg === "agents" && (e.key === "d" || e.key === "D") && orchMode === "free" && !orchMax) { e.preventDefault(); setSketch(true); return; }
  // A shows or hides Sessions; hiding also takes the focus out of it (a clicked row or the log keeps it open otherwise).
  if (pg === "agents" && (e.key === "a" || e.key === "A")) {
    e.preventDefault();
    const w = $("#orch-fleet-wrap"), shown = !!w?.matches(".open, :focus-within");
    w?.classList.toggle("open", !shown);
    if (shown && w.contains(document.activeElement)) document.activeElement.blur();
    return;
  }
  if (pg === "agents" && orchMode === "free" && !orchMax) {
    if (e.key === "h") { e.preventDefault(); ACTIONS["orch-tool"]({ dataset: { tool: "pan" } }); return; }
    if (e.key === "s") { e.preventDefault(); ACTIONS["orch-tool"]({ dataset: { tool: "select" } }); return; }
    if (e.key === "b" || e.key === "B") { e.preventDefault(); cycleCanvasBg(); return; }
    if (e.key === "m" || e.key === "M") { e.preventDefault(); ACTIONS["orch-map"](); return; }
  }
  if (e.key === "c" || e.key === "C") { e.preventDefault(); ACTIONS.capture(); }
  if (e.key === "v" || e.key === "V") { e.preventDefault(); ACTIONS["ui-toggle"](); }
  if (e.key === "f" || e.key === "F") { e.preventDefault(); appFullToggle(); }
  if (e.key === "/" && pg !== "agents") { e.preventDefault(); cmdkOpen(); }
  if (pg === "graph" && route().arg) {
    if (e.key === "1" || e.key === "2" || e.key === "3") { gDepth = +e.key; gImpact = false; graph(route().arg); }
    if (e.key === "Escape") location.hash = "#/graph";
  }
  const card = pg === "review" && due()[0];
  if (card) {
    if (e.key === " " && rvShown !== card.id) { e.preventDefault(); rvShown = card.id; review(); }
    if (rvShown === card.id && (e.key === "1" || e.key === "2")) cardDo("answer", card.id, e.key === "2");
  }
});
// Swipe on the carousel (pointer + touch).
let x0 = null, touchStartX = null, touchStartY = null;
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") return;
  x0 = e.target.closest("#car") ? e.clientX : null;
});
document.addEventListener("pointerup", (e) => {
  if (e.pointerType === "touch") return;
  if (x0 !== null && Math.abs(e.clientX - x0) > 60) move(e.clientX < x0 ? 1 : -1);
  x0 = null;
});
document.addEventListener("touchstart", (e) => {
  if (e.target.closest("#car")) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (touchStartX !== null && touchStartY !== null && e.changedTouches?.length) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = null; touchStartY = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
  }
}, { passive: true });
document.addEventListener("touchcancel", () => {
  touchStartX = null; touchStartY = null;
}, { passive: true });
document.addEventListener("dragstart", (e) => {
  const item = e.target.closest?.("[draggable][data-kind]");
  if (!item) return;
  const payload = { kind: item.dataset.kind, id: item.dataset.id };
  e.dataTransfer.setData(PANE_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copyMove";
});
window.addEventListener("resize", () => { if (cwdOpen) placeCwdPop(lastCwdBtn); });

addEventListener("hashchange", render);
async function vault() { D = await api("/api"); }
async function system() { S = await api("/api/system"); }
// Live: system every 10 s (agents, services), vault when you come back to the tab and every minute.
setInterval(async () => {
  await system(); topBar();
  const { pg } = route();
  if (!pg) { tiles(); tdSide(); }
  else if (pg === "agents" && !cwdOpen && !document.activeElement?.closest?.(".orch-talk, .orch-sticky-wrap")) agentsBody();
  else if (pg === "services") services();
}, 10000);
setInterval(async () => { await vault(); topBar(); if (!route().pg) { tiles(); tdRender(); tdSide(); } }, 60000); // Tasks.md edited in Obsidian shows up
// (the to-do list redraws unless you're typing in it: a draft survives switching windows)
addEventListener("focus", async () => { await vault(); topBar(); const { pg } = route(); if (!pg) uiMode === "minimal" ? (tdRender(), tdSide()) : home(); else if (pg === "notes") grid(); });
setInterval(clock, 1000);
clock();
Promise.all([vault(), system()]).then(render);
