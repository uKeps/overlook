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
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8a7 7 0 0 0 14 0v-4a2 2 0 0 0-4 0"/>',
  select: '<path d="M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M5 21a2 2 0 0 1-2-2M19 21a2 2 0 0 0 2-2M9 3h2M13 3h2M9 21h2M13 21h2M3 9v2M3 13v2M21 9v2M21 13v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  terminal: '<polyline points="4 17 10 12 4 7"/><path d="M12 19h8"/>',
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
const due = () => D.notes.filter((n) => n.review_on && n.review_on <= D.today).sort((a, b) => a.review_on.localeCompare(b.review_on));
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
    item("agents", "Agents", "agents", run) + item("services", "Services", "services", S.services.filter((s) => !s.ok).length) + item("settings", "Settings", "settings") +
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
    reviews: D.notes.filter((n) => n.review_on && (n.review_on === d || (d === D.today && n.review_on < d))),
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
    ...it.reviews.map((n) => row("review", "", `<a href="${noteHref(n.path)}">Review ${esc(n.title)}</a>`)),
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
  for (const n of due()) s.push({ cat: "Review", ic: "review", title: n.title, sub: "Before opening: do you remember what it is about?", meta: [["Due", n.review_on === D.today ? "today" : `${daysBetween(n.review_on, D.today)} d ago`], ["Interval", `${n.interval} d`]], href: "#/review", action: "Review" });
  for (const c of D.captured || []) s.push({ cat: "Captured today", ic: "spark", title: unlink(c), raw: c, sub: "Raw capture. It becomes a note once it fits in one sentence, or it dies.", meta: [["Status", "In the daily note"]], href: obs(dailyPath()), action: "Open in Obsidian" });
  for (const n of inbox()) s.push({ cat: "Inbox", ic: "inbox", title: n.title, sub: "Process: becomes a permanent note or leaves the vault.", meta: [["Arrived", ago(n.mtime)]], href: noteHref(n.path), action: "Open" });
  for (const v of D.missing.slice(0, 3)) s.push({ cat: "Gap", ic: "gap", title: v.target, sub: `Linked ${v.n}× and doesn't exist yet. Write it when you need it, not out of duty.`, meta: [["Linked", `${v.n}×`]], href: `#/w/${encodeURIComponent(v.target)}`, action: "See who links it" });
  for (const n of D.notes.filter((n) => n.type === "project").sort((a, b) => b.mtime - a.mtime).slice(0, 5)) s.push({ cat: "Project", ic: "bolt", title: n.title, sub: plain(n.summary), meta: [["Area", n.area || "-"], ["Touched", ago(n.mtime)]], href: noteHref(n.path), action: "Open" });
  const outside = D.notes.filter((n) => n.type === "concept" && !n.review_on).sort((a, b) => a.mtime - b.mtime).slice(0, 2);
  for (const n of outside) s.push({ cat: "Rediscover", ic: "leaf", title: n.title, sub: plain(n.summary), meta: [["Out of the cycle", "never reviewed"], ["Area", n.area || "-"]], href: noteHref(n.path), action: "Reread" });
  return s.length ? s : [{ cat: "All caught up", ic: "leaf", piece: "bonsai", title: "Nothing needs attention right now", sub: "Capture an idea or open an old note.", meta: [], href: "#/notes", action: "See notes" }];
}

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
  if (uiMode === "minimal") {
    const need = needsYou() + (D.focus?.length ? 0 : 1), run = runningNow();
    main.innerHTML = `<section class="min-home">
        <header class="min-hello"><h1>${esc(dayName(D.today, { weekday: "long", day: "numeric", month: "long" }))}</h1>
          <p>${need ? `${need} ${need === 1 ? "thing needs" : "things need"} you` : "Nothing needs you right now"}${run ? `, ${run} ${run === 1 ? "agent" : "agents"} running` : ""}</p></header>
        <div class="min-queue">
          <div class="min-rows">${SG.map((s, i) => `<div class="min-row ${i === idx ? "on" : ""}" data-i="${i}">
            <button type="button" class="min-sel" data-act="go" data-i="${i}">
              <span class="min-txt"><b>${emLinks(s.raw || s.title)}</b><small>${esc(s.sub)}</small></span>
              <span class="min-cat">${icon(s.ic, 13)} ${esc(s.cat)}</span>
            </button>
            ${cta(s, "min-go", 13)}
          </div>`).join("")}</div>
        </div>
        <aside class="min-stage glass" id="min-stage"></aside>
      </section>
      <section class="tiles" id="tiles"></section>`;
    place(); tiles();
    return;
  }
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

function tiles() {
  const el = $("#tiles");
  if (!el) return;
  const next = D.notes.filter((n) => n.review_on > D.today).sort((a, b) => a.review_on.localeCompare(b.review_on))[0];
  const on = S.services.filter((s) => s.ok).length;
  const names = { claude: "Claude", agy: "AGY", codex: "Codex", gemini: "Gemini" };
  el.innerHTML = `
    <a class="tile glass" href="#/agents"><span class="k">${icon("agents", 16)} Active agents</span><span class="v">${S.agents.length}</span>
      <span class="s">${esc(S.agents.map((a) => `${names[a.name] || a.name} in ${a.cwd.split("/").pop() || "~"}`).join(" · ") || "none running")}</span></a>
    <a class="tile glass" href="#/services"><span class="k">${icon("services", 16)} Services</span><span class="v">${on}/${S.services.length}</span>
      <span class="s">${esc(S.services.map((s) => `${s.ok ? "●" : "○"} ${s.name}`).join("  ")) || "none configured"}</span></a>
    <a class="tile glass" href="#/review"><span class="k">${icon("review", 16)} Review</span><span class="v">${due().length}</span>
      <span class="s">${next ? `next: ${esc(next.title)} ${rel.format(daysBetween(D.today, next.review_on), "day")}` : "no notes in the cycle"}</span></a>
    <a class="tile glass" href="#/notes"><span class="k">${icon("notes", 16)} Notes</span><span class="v">${D.notes.length}</span>
      <span class="s">${D.missing.length} ${D.missing.length === 1 ? "gap" : "gaps"} · ${D.notes.filter((n) => Date.now() - n.mtime < 7 * 864e5).length} touched this week</span></a>`;
}

// ---------------------------------------------------------------- Notes
let filter = "", query = "";
function notes() {
  const count = {};
  for (const n of D.notes) count[n.folder] = (count[n.folder] || 0) + 1;
  main.innerHTML = `<div class="ph"><h1>Notes</h1><p>${D.notes.length} notes in the vault</p>
      <div class="r"><input class="search glass" id="search" placeholder="Filter notes" value="${esc(query)}" autocomplete="off"></div></div>
    <div class="filters">${[["", "All", D.notes.length], ...Object.keys(count).sort().map((k) => [k, folderLabel(k), count[k]])]
      .map(([k, v, c]) => `<button class="fchip ${filter === k ? "on" : ""}" data-act="filter" data-k="${esc(k)}">${esc(v)}<small>${c}</small></button>`).join("")}</div>
    <div class="grid" id="note-grid"></div><div id="text-hits"></div>`;
  grid();
  ambient(art("notes"));
}
// Words a question carries that say nothing about the note ("o que é AWB", "what is AWB").
const STOP = new Set(["o", "a", "os", "as", "que", "e", "de", "do", "da", "what", "is", "the", "of"]);
let textTimer = 0;
function grid() {
  const q = fold(query).trim(), terms = q.split(/\s+/).filter((t) => t && !STOP.has(t));
  const weight = (n) => (!q ? 0 : fold(n.title).startsWith(terms[0] || q) ? 0 : fold(n.title).includes(terms[0] || q) ? 1 : 2);
  const ns = D.notes.filter((n) => (!filter || n.folder === filter) && terms.every((t) => fold(n.title + " " + n.summary + " " + n.tags.join(" ")).includes(t)))
    .sort((a, b) => weight(a) - weight(b) || b.mtime - a.mtime);
  $("#note-grid").innerHTML = ns.map((n, i) => `<a class="nc glass" href="${noteHref(n.path)}" style="animation-delay:${Math.min(i, 12) * 25}ms">
      <h4>${esc(n.title)}</h4>
      <p>${esc(n.type === "daily" ? "Daily note" : plain(n.summary) || "No one-line summary.")}</p>
      <span class="f">${n.type ? `<span class="pill">${esc(n.type)}</span>` : ""}${confKind(n) === "warn" ? `<span class="pill conf warn">${esc(n.confidence)}</span>` : ""}${n.review_on ? '<span class="pill peach">in cycle</span>' : ""}<span>${esc(n.area)}</span><span style="margin-left:auto">${ago(n.mtime)}</span></span></a>`).join("")
    || `<p class="empty">No title matches "${esc(query)}".</p>`;
  // Then the text of the notes, a beat after typing stops.
  const box = $("#text-hits");
  clearTimeout(textTimer);
  if (!box) return;
  box.innerHTML = "";
  if (terms.join("").length < 3) return;
  const shown = new Set(ns.map((n) => n.path)), inFolder = (p) => !filter || (filter === "." ? !p.includes("/") : p.startsWith(`${filter}/`));
  textTimer = setTimeout(async () => {
    const hits = (await api(`/api/search?q=${encodeURIComponent(terms.join(" "))}`).catch(() => [])).filter((h) => !shown.has(h.path) && inFolder(h.path));
    if (fold(query).trim() !== q || !$("#text-hits")) return;
    $("#text-hits").innerHTML = hits.length
      ? `<h3>In the text</h3><div class="list glass">${hits.map((h) => `<a class="row" href="${noteHref(h.path)}"><span class="t">${esc(h.title)}<small>${esc(h.line)}</small></span></a>`).join("")}</div>`
      : ns.length ? "" : `<p class="empty">Not in the text either. <button class="btn glass" data-act="capture">Capture it as a question</button></p>`;
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
        ${n.review_on ? `<p class="empty" style="padding:10px 0 0">In the cycle: review ${n.review_on <= D.today ? "today" : rel.format(daysBetween(D.today, n.review_on), "day")}, interval ${n.interval} d.</p>`
          : `<button class="btn glass" data-act="enroll" data-p="${esc(n.path)}">Add to the review cycle</button>`}</div>
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
let queue = [], pos = 0, revealed = false, done = 0;
function review() {
  queue = due(); pos = 0; revealed = false; done = 0;
  flashcard();
}
function flashcard() {
  const n = queue[pos];
  if (!n) {
    const next = D.notes.filter((x) => x.review_on > D.today).sort((a, b) => a.review_on.localeCompare(b.review_on));
    // What to learn first: concepts, the most linked first (the vocabulary the other notes lean on).
    const inLinks = {};
    for (const x of D.notes) for (const l of new Set(x.links)) inLinks[l] = (inLinks[l] || 0) + 1;
    const pool = D.notes.filter((x) => !x.review_on && x.summary && x.type !== "daily");
    const outside = (pool.some((x) => x.type === "concept") ? pool.filter((x) => x.type === "concept") : pool)
      .sort((a, b) => (inLinks[nameOf(b.path)] || 0) - (inLinks[nameOf(a.path)] || 0) || a.title.localeCompare(b.title)).slice(0, 8);
    const five = outside.slice(0, 5).map((x) => x.path);
    main.innerHTML = `<div class="ph"><h1>${done ? `${done} reviewed. Done.` : "Nothing due today"}</h1>
        <p>Remembered doubles the interval; forgot resets it to 1 day.</p></div>
      <h3>Coming up</h3><div class="list glass">${next.slice(0, 8).map((x) => `<a class="row" href="${noteHref(x.path)}"><span class="t">${esc(x.title)}</span><span class="x">${x.review_on} · ${x.interval} d</span></a>`).join("") || '<p class="empty">No notes in the cycle yet.</p>'}</div>
      <div class="rv-head"><h3>Add to the cycle</h3>${five.length > 1 ? `<button class="btn peach" data-act="enroll-5" data-ps="${esc(JSON.stringify(five))}" title="Five a day keeps the daily review short">Add the top ${five.length}</button>` : ""}</div><div class="list glass">${outside.map((x) => `<div class="row hov"><a class="t" href="${noteHref(x.path)}">${esc(x.title)}<small>${esc(plain(x.summary))}</small></a>
        <button class="btn glass" data-act="enroll" data-p="${esc(x.path)}">Add</button></div>`).join("") || '<p class="empty">All of them already are.</p>'}</div>`;
    ambient(art("review"));
    return;
  }
  main.innerHTML = `<section class="flash glass">
      <span class="n">${pos + 1} of ${queue.length} · ${esc(n.folder)}</span>
      <h2>${esc(n.title)}</h2>
      ${revealed ? `<p class="ans glass">${esc(plain(n.summary) || "No one-line summary. Open the note.")}</p>
        <div class="acts"><button class="btn glass" data-act="no">Forgot <kbd>1</kbd></button><button class="btn peach" data-act="yes">Remembered <kbd>2</kbd></button>
        <a class="btn glass r" href="${noteHref(n.path)}">Read the note</a></div>`
      : `<div class="acts"><button class="btn peach" data-act="show">Show answer <kbd>space</kbd></button></div>`}
    </section>`;
  ambient(art(n.title));
}
async function answer(remembered) {
  const n = queue[pos];
  const r = await api("/api/review", { path: n.path, remembered });
  toast(`${n.title}: back in ${r.interval} d`);
  pos++; revealed = false; done++;
  D = await api("/api"); topBar(); flashcard();
}

// ---------------------------------------------------------------- Graph
// The canvas can't read CSS variables, so the graph takes the theme's colours when it draws.
const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
let PALETTE = [], AREAS = [];
// One colour per area while the palette lasts, then the same colours fainter (hashing put 9 areas on 6 colours).
const areaColor = (a) => { const i = Math.max(0, AREAS.indexOf(a)), c = PALETTE[i % PALETTE.length]; return i < PALETTE.length ? c : alpha(c, .5); };
let graphStop = null;
function graph() {
  main.innerHTML = `<div class="ph"><h1>Graph</h1><p>Click opens the note. Drag to move, scroll to zoom.</p></div>
    <section class="graph glass"><canvas id="cv"></canvas></section>`;
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  AREAS = [...new Set(D.notes.map((n) => n.area).filter(Boolean))].sort();
  PALETTE = ["--p1", "--p2", "--p3", "--p4", "--p5", "--p6"].map(tok);
  const ink = tok("--ink"), accent = tok("--accent"), bg = tok("--bg");
  const nodes = D.notes.filter((n) => n.type !== "daily").map((n) => ({ id: nameOf(n.path), t: n.title, p: n.path, a: n.area, c: n.area ? areaColor(n.area) : alpha(ink, .8) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const v of D.missing) if (!byId.has(v.target)) { const g = { id: v.target, t: v.target, c: alpha(ink, .25), ghost: true }; nodes.push(g); byId.set(v.target, g); }
  const edges = [];
  for (const n of D.notes) for (const l of new Set(n.links)) { const a = byId.get(nameOf(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  const byDeg = [...nodes].sort((a, b) => (deg.get(b) || 0) - (deg.get(a) || 0));
  let W, H, panX = 0, panY = 0, zoom = 1;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 2.5 + Math.sqrt(deg.get(n) || 0) * 0.9; n.m = alpha(ink, .3 + .45 * Math.min(1, (deg.get(n) || 0) / 25)); });
  let hover = null, drag = null, pan = null, down = null, heat = 1;
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
    const near = hover ? new Set(edges.filter(([a, b]) => a === hover || b === hover).flat()) : null;
    for (const [a, b] of edges) {
      ctx.strokeStyle = near && (a === hover || b === hover) ? alpha(accent, .55) : alpha(ink, .06);
      ctx.lineWidth = 1 / zoom; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
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
  // Stops once it settles: only animates again with the mouse over it (saves CPU while the tab sits idle).
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
    else { wake(); hover = find(e); cv.style.cursor = hover ? "pointer" : "grab"; }
  };
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    down = [e.clientX, e.clientY]; drag = find(e); moved = false;
    if (!drag) { pan = [e.clientX - panX, e.clientY - panY]; cv.style.cursor = "grabbing"; }
  };
  cv.onpointerup = cv.onpointercancel = () => {
    if (drag && !moved) location.hash = drag.ghost ? `#/w/${encodeURIComponent(drag.id)}` : noteHref(drag.p);
    drag = pan = null; cv.style.cursor = hover ? "pointer" : "grab";
  };
  cv.onwheel = (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const k = Math.min(4, Math.max(0.25, zoom * Math.exp(-e.deltaY * 0.0015)));
    panX = sx - (sx - panX) * (k / zoom); panY = sy - (sy - panY) * (k / zoom); zoom = k;
    draw();
  };
    ambient(art("graph"));
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

const CANVAS_TOP = 52; // the strip at the top of the canvas where the floating Fleet pill and the canvas HUD sit
const CANVAS_BGS = [
  ["dots", "Dots", "Classic dot matrix", 22],
  ["sparse", "Calm", "Wide soft dots", 44],
  ["grid", "Grid", "Fine hairline grid", 32],
  ["plain", "Solid", "Clean matte surface", 0],
  ["ambient", "Ambient", "Translucent glass", 0],
];
const VALID_BGS = new Set(CANVAS_BGS.map(([k]) => k));
const bgEntry = (k) => CANVAS_BGS.find(([id]) => id === k) || CANVAS_BGS[0];
let orchRole = "", orchCwd = "", orchFilter = "all", orchMode = "tile", orchDir = "cols", orchRatio = 50, orchBg = "dots",
  orchPanX = 24, orchPanY = CANVAS_TOP, orchZoom = 1, orchPanes = [], orchSelected = new Set(), orchActive = "", orchMax = "", orchTool = "select",
  orchRail = true, orchRailMode = "float", orchDeckOpen = false, orchExtra = new Set(), orchTimer = null, orchSigs = new Map(), orchSeq = 1;
let cwdOpen = false, cwdBrowse = "~/dev", cwdHidden = false, cwdQuery = "", cwdData = null, cwdPaneKey = "";
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
    orchMode = c.mode || "tile";
    orchPanX = c.panX ?? 24;
    orchPanY = c.panY ?? CANVAS_TOP;
    orchZoom = c.zoom || 1;
    orchSeq = c.seq || 1;
    if (c.railMode) orchRailMode = c.railMode;
    if (c.bg && VALID_BGS.has(c.bg)) orchBg = c.bg;
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
  const body = JSON.stringify({ wires, names });
  if (body === wiresSent && !force) return;
  wiresSent = body; wiresAt = Date.now();
  api("/api/canvas/wires", { client: CANVAS_CLIENT, wires, names }).catch(() => { wiresSent = ""; });
}
// A TUI's window title leads with a spinner or status glyph ("✳ Fix the build"): the name is what follows it.
const termName = (p) => (terms.get(p.id)?.title || "").replace(/^[^\p{L}\p{N}]+/u, "") || (p.run ? runnerName(p.run.agent) : `Terminal ${p.shell || ""}`.trim());
function saveCanvas() {
  syncWires();
  try {
    localStorage.setItem(CANVAS_BG_KEY, orchBg);
    localStorage.setItem(CANVAS_KEY, JSON.stringify({ panes: orchPanes.map(({ ctx, ...p }) => p), links: orchLinks, mode: orchMode, panX: orchPanX, panY: orchPanY, zoom: orchZoom, seq: orchSeq, railMode: orchRailMode, bg: orchBg, active: orchActive, max: orchMax, dir: orchDir, ratio: orchRatio }));
  } catch {}
}
function setCanvasBg(v, silent = false) {
  orchBg = VALID_BGS.has(v) ? v : "dots";
  saveCanvas();
  applyCanvasTransform();
  $("#orch-bgmenu")?.setAttribute("hidden", "");
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
function newTermPane(cwd) {
  const p = { kind: "terminal", id: `term_${Date.now()}`, shell: prefShell || "", cwd: cwd || $("#run-cwd")?.value || orchCwd || "" };
  if (addPane(p)) { saveCanvas(); if (orchMode === "free") focusPane(paneKey(p)); }
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
function newAgentTerm(agent) {
  $("#orch-newmenu")?.setAttribute("hidden", "");
  if (!S.runners?.find((r) => r.id === agent)?.tui) return newTermPane();
  const p = { kind: "terminal", id: `term_${Date.now()}`, cwd: $("#run-cwd")?.value || orchCwd || "", run: newTuiRun(agent) };
  if (addPane(p)) { saveCanvas(); if (orchMode === "free") focusPane(paneKey(p)); }
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
    if (st.ws !== ws || !terms.has(p.id)) return;
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
  api("/api/pty/close", { id }).catch(() => {});
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
function focusPane(k) {
  const p = orchPanes.find((x) => paneKey(x) === k);
  if (!p) return;
  orchActive = k;
  if (orchMax) orchMax = k;
  const r = $("#orch-canvas")?.getBoundingClientRect();
  if (orchMode === "free" && !orchMax && r && typeof p.x === "number") {
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
      st.term = new x.Terminal({
        // Ghostty ships JetBrains Mono plus Nerd Font symbols built in; a browser needs them installed (prompt icons).
        fontFamily: `${look.fontFamily ? `"${look.fontFamily}", ` : ""}"JetBrainsMono Nerd Font Mono", "JetBrains Mono", "Symbols Nerd Font Mono", monospace`,
        fontSize: Math.round((look.fontSize || 12) * 4 / 3), // Ghostty sizes are points; its default is 12
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
        if (!cell?.width || !cell?.height || !st.term.element) return;
        const w = st.el.clientWidth - 2 * PX, h = st.el.clientHeight - 2 * PY;
        const cols = Math.max(2, Math.floor(w / cell.width)), rows = Math.max(1, Math.floor(h / cell.height));
        const rx = Math.max(0, w - cols * cell.width) / 2, ry = Math.max(0, h - rows * cell.height) / 2;
        st.term.element.style.padding = `${PY + Math.floor(ry)}px ${PX + Math.ceil(rx)}px ${PY + Math.ceil(ry)}px ${PX + Math.floor(rx)}px`;
        if (cols !== st.term.cols || rows !== st.term.rows) st.term.resize(cols, rows);
      } };
      st.term.open(st.el);
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
    badge.hidden = orchSelected.size === 0;
    badge.textContent = `${orchSelected.size} selected`;
  }
  if (delBtn) delBtn.hidden = orchSelected.size === 0;
}
// Closing a terminal pane stops what runs in it (a shell, a claude session mid-turn): ask first.
function closeLiveOk(keys) {
  const n = keys.map((k) => orchPanes.find((p) => paneKey(p) === k)).filter((p) => p?.kind === "terminal").length; // its PTY may run with the socket down
  return !n || confirm(n === 1 ? "Close this terminal? What runs in it will be stopped." : `Close ${n} terminals? What runs in them will be stopped.`);
}
function deleteSelectedPanes() {
  if (!orchSelected.size || !closeLiveOk([...orchSelected])) return;
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


async function loadCwdBrowser(path = cwdBrowse) {
  cwdBrowse = path || "~/dev";
  cwdData = await api(`/api/dirs?path=${encodeURIComponent(cwdBrowse)}&hidden=${cwdHidden ? "1" : "0"}`).catch(() => null);
  paintCwdPop();
}
let lastCwdBtn = null;
// The popover opens under the button that asked for it (or above it, near the bottom of the screen).
function placeCwdPop(btn = lastCwdBtn) {
  const pop = $("#cwd-pop");
  if (!pop || pop.hidden) return;
  if (pop.parentElement !== document.body) document.body.appendChild(pop);
  const target = btn || $("#run-cwd-btn");
  if (!target) return;
  const br = target.getBoundingClientRect();
  const w = Math.min(540, window.innerWidth - 24);
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
function paintCwdPop() {
  const pop = $("#cwd-pop");
  if (!pop) return;
  pop.hidden = !cwdOpen;
  if (!cwdOpen || !cwdData) return;
  requestAnimationFrame(() => placeCwdPop(lastCwdBtn));
  const q = fold(cwdQuery.trim());
  const dirs = (cwdData.dirs || []).filter((d) => !q || fold(d.name).includes(q) || fold(d.short).includes(q));
  const recent = new Set(["", ...(cwdData.roots || []).map((r) => r.short)]);
  for (const a of S.agents || []) if (a.cwd) recent.add(a.cwd);
  for (const b of S.background || []) if (b.cwd) recent.add(b.cwd);
  for (const t of S.tasks || []) if (t.cwd) recent.add(shortCwd(t.cwd));
  if (!pop.querySelector("#cwd-q")) {
    pop.innerHTML = `<div class="cwd-top">
        <input id="cwd-q" type="text" placeholder="Filter folders or type any PC path (e.g. ~/dev, /mnt, /) + Enter…" autocomplete="off">
        <button type="button" class="btn glass orch-icon-btn" data-act="cwd-close" title="Close">${icon("x", 13)}</button>
      </div>
      <div class="cwd-roots" id="cwd-roots"></div>
      <div class="cwd-cur" id="cwd-cur"></div>
      <div class="cwd-list" id="cwd-list"></div>`;
    const inp = pop.querySelector("#cwd-q");
    inp.oninput = () => { cwdQuery = inp.value; paintCwdPop(); };
    inp.onkeydown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); cwdOpen = false; paintCwdPop(); }
      if (e.key === "Enter") {
        e.preventDefault();
        const v = inp.value.trim();
        if (v.startsWith("/") || v.startsWith("~")) { cwdQuery = ""; inp.value = ""; loadCwdBrowser(v); }
        else if (dirs[0]) pickCwd(dirs[0].short);
      }
    };
  }
  $("#cwd-roots").innerHTML = `<button type="button" class="fchip ${!orchCwd ? "on" : ""}" data-act="cwd-pick" data-path="">📁 Vault (${esc(D.vault)})</button>` +
    (cwdData.roots || []).filter((r) => r.label !== "Vault").map((r) =>
      `<button type="button" class="fchip ${ cwdData.short === r.short ? "on" : ""}" data-act="cwd-nav" data-path="${esc(r.path)}">${esc(r.label)}</button>`).join("");
  $("#cwd-cur").innerHTML = `<div class="cwd-path">
      ${cwdData.parent ? `<button type="button" class="btn glass cwd-up" data-act="cwd-nav" data-path="${esc(cwdData.parent)}" title="Parent folder">↑ Up</button>` : ""}
      <code>${esc(cwdData.short)}</code>
    </div>
    <div class="cwd-cur-acts">
      <button type="button" class="fchip ${cwdHidden ? "on" : ""}" data-act="cwd-hidden" title="Show/hide dot-folders">.* Hidden</button>
      <button type="button" class="btn peach cwd-use" data-act="cwd-pick" data-path="${esc(cwdData.short)}">✓ Use ${esc(cwdData.short)}</button>
    </div>`;
  $("#cwd-list").innerHTML = dirs.map((d) => `<div class="cwd-row">
      <button type="button" class="cwd-open" data-act="cwd-nav" data-path="${esc(d.path)}" title="Open ${esc(d.short)}">
        ${icon("folder", 14)} <b>${esc(d.name)}</b> ${d.git ? `<span class="cwd-git">git</span>` : ""} <small>${esc(d.short)}</small>
      </button>
      <button type="button" class="btn glass cwd-sel" data-act="cwd-pick" data-path="${esc(d.short)}">Select</button>
    </div>`).join("") || `<p class="empty">No subfolders matching "${esc(cwdQuery)}" in ${esc(cwdData.short)}.</p>`;
}
function pickCwd(val) {
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
      const pos = `${orchPanX}px ${orchPanY}px`, sz = `${px}px ${px}px`;
      canvas.style.setProperty("--bg-pos", pos);
      canvas.style.setProperty("--bg-size", sz);
      canvas.style.setProperty("--bg-lod", lod.toFixed(2));
      canvas.style.backgroundPosition = pos;
      canvas.style.backgroundSize = sz;
    } else {
      canvas.style.removeProperty("--bg-pos");
      canvas.style.removeProperty("--bg-size");
      canvas.style.removeProperty("--bg-lod");
      canvas.style.backgroundPosition = "";
      canvas.style.backgroundSize = "";
    }
  }
  if (zLbl) zLbl.textContent = `${Math.round(orchZoom * 100)}%`;
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
function addPane(item, x, y) {
  const k = paneKey(item), have = orchPanes.find((p) => paneKey(p) === k), p = have || item;
  if (!have) {
    if (!makeRoom()) return false;
    ensurePaneRect(p, orchPanes.length);
    orchPanes.push(p);
  }
  if (x != null && orchMode === "free") { p.x = Math.round(x - 40); p.y = Math.round(y - 16); }
  orchActive = k; orchMax = ""; orchSigs.clear();
  agentsBody();
  return true;
}
// Wires an agent just used to message another (from /api/pty handoffs, polled with the canvas) are drawn flowing.
let hotWires = new Set();
async function pollHandoffs() {
  if (!orchLinks.length || !orchPanes.some((p) => p.kind === "terminal")) { hotWires = new Set(); return; }

  if (Date.now() - wiresAt > 30_000) syncWires(true); // the server forgets a canvas it hasn't heard from in 90 s (or restarted)
  const r = await api("/api/pty").catch(() => null);
  const next = new Set((r?.handoffs || []).filter((h) => Date.now() - h.at < 6000).map((h) => [`terminal:${h.from}`, `terminal:${h.to}`].sort().join("|")));
  if ([...next].join() !== [...hotWires].join()) { hotWires = next; drawLinks(); }
}
// Links are drawn in canvas coordinates, from the right edge of the source to the left edge of the target.
function drawLinks(tmp) {
  const plane = $("#orch-plane");
  if (!plane) return;
  let svg = plane.querySelector("#orch-links");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "orch-links"; svg.classList.add("orch-links");
    plane.prepend(svg);
  }
  const byKey = new Map(orchPanes.map((p) => [paneKey(p), p]));
  orchLinks = orchLinks.filter((l) => byKey.has(l.a) && byKey.has(l.b));
  const on = orchMode === "free" && !orchMax;
  svg.style.display = on ? "" : "none";
  if (!on) return;
  const curve = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const cx = Math.max(40, Math.abs(dx) * 0.45);
    const sign = dx >= 0 ? 1 : -1;
    return `M${x1},${y1} C${x1 + cx * sign},${y1} ${x2 - cx * sign},${y2} ${x2},${y2}`;
  };
  svg.innerHTML = `<defs><marker id="orch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z"/></marker></defs>`
    + orchLinks.map((l, i) => {
      const a = byKey.get(l.a), b = byKey.get(l.b);
      const fromLeft = a.x > b.x + b.w / 2;
      const x1 = fromLeft ? a.x : a.x + a.w, y1 = a.y + a.h / 2;
      const x2 = fromLeft ? b.x + b.w : b.x, y2 = b.y + b.h / 2;
      const d = curve(x1, y1, x2, y2);
      const hot = hotWires.has([l.a, l.b].sort().join("|"));
      return `<path class="hit" d="${d}" data-act="link-del" data-i="${i}"><title>Click to remove this link</title></path><path class="ln ${hot ? "hot" : ""}" d="${d}" marker-end="url(#orch-arrow)"/>`;
    }).join("")
    + (tmp ? `<path class="ln tmp" d="${curve(...tmp)}"/>` : "");
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
        <div class="seg orch-mode-seg" role="radiogroup" aria-label="Layout">
          <button type="button" class="${orchMode === "tile" ? "on" : ""}" data-act="orch-mode" data-m="tile" title="Split: cards share the space" aria-label="Split">${icon("split", 14)}</button>
          <button type="button" class="${orchMode === "free" ? "on" : ""}" data-act="orch-mode" data-m="free" title="Canvas: free windows, pan and zoom" aria-label="Canvas">${icon("grid", 14)}</button>
        </div>
        <button type="button" class="bar-icon" id="orch-dir-btn" data-act="orch-dir" title="Side by side / stacked" ${orchMode === "tile" && orchPanes.length === 2 && !orchMax ? "" : "hidden"}>${icon(orchDir === "rows" ? "cols" : "split", 14)}</button>
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
      <div class="cwd-pop glass" id="cwd-pop" hidden></div>
    </form>
    <div class="orch-work ${orchRail ? "" : "rail-shut"} ${orchRail && orchRailMode === "float" ? "rail-float" : ""}" id="agents-body"></div>
  </div>`;
  $("#run").onsubmit = (e) => { e.preventDefault(); runPrompt(); };
  $("#run-agent").onchange = () => { orchExtra.delete($("#run-agent").value); runOptions(); renderMultiChips(); };
  $("#run-model").onchange = () => runOptions(true);
  runOptions();
  renderMultiChips();
  loadTerminals();
  $("#run-prompt").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runPrompt(); } };
  agentsBody();
  orchTimer = setInterval(() => { if (route().pg !== "agents") return clearInterval(orchTimer); orchPaint(); pollHandoffs(); }, 2000);
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
const PANE_KEYS = "Ctrl+Alt: ←/→ next/previous card · 1–9 jump · Enter maximize · T terminal · N agent tile · W close · F fit · B background · Z full screen · R reload · / this help · Alt+drag moves a card";
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
function canvasFull(on = !document.body.classList.contains("canvas-full")) {
  document.body.classList.toggle("canvas-full", on);
  if (on) {
    navigator.keyboard?.lock?.(["Escape"])?.catch?.(() => {});
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => navigator.keyboard?.lock?.(["Escape"])?.catch?.(() => {})).catch(() => {});
    }
  } else {
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
  if (e.code === "Space" && !e.target.closest("input, textarea, select, [contenteditable]") && !isSpacePressed) {
    isSpacePressed = true;
    if (orchMode === "free" && !orchMax) $("#orch-canvas")?.classList.add("space-pan");
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") { isSpacePressed = false; $("#orch-canvas")?.classList.remove("space-pan"); }
});
function bindCanvasInteractions(canvas) {

  canvas.addEventListener("pointerdown", (e) => {
    const isBg = e.target === canvas || e.target.id === "orch-plane" || e.target.classList?.contains("orch-links") || e.target.tagName === "svg";
    if (isBg) blurCanvasFocus(e.shiftKey || e.metaKey || e.ctrlKey);
    if (orchMode !== "free" || orchMax) return;
    // Over a card the mouse belongs to it (a terminal's middle-click paste, right-click, selection): only the
    // background pans, with the middle or right button, the Pan tool or Space held.
    if (!isBg && !isSpacePressed) return;

    if (e.button === 1 || e.button === 2 || isSpacePressed || (orchTool === "pan" && e.button === 0 && isBg)) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      const startX = orchPanX, startY = orchPanY, x0 = e.clientX, y0 = e.clientY;
      canvas.classList.add("panning");
      const movePan = (ev) => {
        orchPanX = Math.round(startX + (ev.clientX - x0));
        orchPanY = Math.round(startY + (ev.clientY - y0));
        applyCanvasTransform();
      };
      const upPan = () => {
        window.removeEventListener("pointermove", movePan);
        window.removeEventListener("pointerup", upPan);
        canvas.classList.remove("panning");
        saveCanvas();
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

  canvas.addEventListener("contextmenu", (e) => {
    if (orchMode === "free" && !orchMax && !e.target.closest(".orch-pane")) e.preventDefault(); // right-drag pans the background
  });

  canvas.addEventListener("wheel", (e) => {
    if (orchMode !== "free" || orchMax) return;
    const isBg = e.target === canvas || e.target.id === "orch-plane" || e.target.classList?.contains("orch-links") || e.target.tagName === "svg";
    // Like Maestri: the wheel (or a two-finger swipe) pans the background; Ctrl/Alt + wheel (or a pinch) zooms, over a
    // card too. A plain wheel over a card is the card's (a terminal scrolls back).
    const zoom = e.ctrlKey || e.metaKey || e.altKey;
    if (!isBg && !zoom) return;
    e.preventDefault();
    if (!zoom) {
      orchPanX = Math.round(orchPanX - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX));
      orchPanY = Math.round(orchPanY - (e.shiftKey && !e.deltaX ? 0 : e.deltaY));
      applyCanvasTransform(); drawLinks(); saveCanvas();
      return;
    }
    e.stopPropagation(); // a terminal under the pointer must not scroll as well
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const k = Math.min(2.5, Math.max(0.2, orchZoom * Math.exp(-e.deltaY * 0.002)));
    orchPanX = Math.round(sx - (sx - orchPanX) * (k / orchZoom));
    orchPanY = Math.round(sy - (sy - orchPanY) * (k / orchZoom));
    orchZoom = Math.round(k * 1000) / 1000;
    applyCanvasTransform();
    saveCanvas();
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
      if (orchMode !== "free" || orchMax || e.target.closest("button, a, select, input")) return;
      e.preventDefault();
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
      const startPositions = targets.map((tp) => ({
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
      if (orchMode !== "free" || orchMax) return;
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
function paintNoteList() {
  const box = $("#orch-notes");
  if (!box) return;
  const q = fold((orchNoteQ || "").trim());
  const ns = D.notes.filter((n) => !q || fold(n.title + " " + (n.summary || "") + " " + n.tags.join(" ")).includes(q)).slice(0, 50);
  box.innerHTML = ns.map((n) => `
    <div class="orch-item orch-note-item" draggable="true" data-kind="note" data-id="${esc(n.path)}">
      <button type="button" class="orch-item-main" data-act="orch-add-note" data-path="${esc(n.path)}" title="Open it on the canvas (or drag it there)">
        <span class="orch-info"><b>${esc(n.title)}</b><small>${esc([n.folder || "vault", ...n.tags].join(" · "))}</small></span>
      </button>
    </div>
  `).join("") || `<p class="empty">No notes match "${esc(orchNoteQ)}".</p>`;
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
  const dBtn = $("#orch-dir-btn");
  if (dBtn) {
    dBtn.hidden = !(orchMode === "tile" && orchPanes.length === 2 && !orchMax);
    dBtn.innerHTML = icon(orchDir === "rows" ? "cols" : "split", 14);
  }
  document.querySelectorAll("[data-act='orch-mode']").forEach((b) => b.classList.toggle("on", b.dataset.m === orchMode));
  if (!el.querySelector(".orch-canvas")) {
    el.innerHTML = `<div class="orch-fleet-wrap ${orchRailMode === "float" ? "float" : ""}" id="orch-fleet-wrap">
        <button type="button" class="orch-fleet-pill glass" data-act="orch-rail-open" title="Open Fleet sidebar">${icon("cols", 13)} <span>Fleet <small id="orch-fleet-pill-cnt"></small></span></button>
        <aside class="orch-fleet glass ${orchRailMode === "float" ? "floating" : ""}">
          <div class="orch-fleet-head">
            <div class="orch-fleet-title"><span>Fleet</span> <small id="orch-fleet-badge"></small></div>
            <div class="orch-fleet-acts">
              <button type="button" class="fl-icon ${orchRailMode === "float" ? "" : "on"}" data-act="orch-rail-mode" title="${orchRailMode === "float" ? "Keep the Fleet open beside the canvas" : "Let the Fleet float over the canvas"}">${icon("pin", 13)}</button>
            </div>
          </div>
          <input id="orch-fq" class="orch-fq" type="search" placeholder="Search" autocomplete="off" aria-label="Search sessions and notes">
          <div class="orch-tabs" id="orch-tabs"></div>
          <div class="orch-list" id="orch-list"></div>
          <details class="orch-ledger" id="orch-ledger">
            <summary id="orch-ledger-sum"></summary>
            <div class="orch-ledger-cols" id="orch-ledger-cols"></div>
          </details>
        </aside>
      </div>
      <div class="orch-canvas" id="orch-canvas">
        <div class="orch-plane" id="orch-plane"></div>
        <div class="orch-hud glass" id="orch-hud"></div>
        <div class="orch-newmenu" id="orch-newmenu" hidden></div>
        <div class="orch-newmenu orch-bgmenu" id="orch-bgmenu" hidden></div>
      </div>`;
    bindCanvasInteractions($("#orch-canvas"));
  }
  const fleetBadge = $("#orch-fleet-badge"), fleetPillCnt = $("#orch-fleet-pill-cnt"), pill = el.querySelector(".orch-fleet-pill"), fleetEl = el.querySelector(".orch-fleet"), fleetWrap = $("#orch-fleet-wrap");
  if (fleetBadge) fleetBadge.textContent = counts.all;
  if (fleetPillCnt) fleetPillCnt.textContent = counts.all;
  if (fleetWrap) fleetWrap.classList.toggle("float", orchRailMode === "float");
  if (fleetEl) fleetEl.classList.toggle("floating", orchRailMode === "float");
  const pinnedKeys = new Set(orchPanes.map(paneKey));
  // Two views: the sessions (grouped by what they need from you) and the vault's notes; one search for both.
  const fq = $("#orch-fq");
  if (fq && !fq.oninput) { fq.value = orchNoteQ; fq.oninput = () => { orchNoteQ = fq.value; orchFilter === "notes" ? paintNoteList() : agentsBody(); }; }
  const view = orchFilter === "notes" ? "notes" : "sessions";
  $("#orch-tabs").innerHTML = [["sessions", "Sessions", counts.all], ["notes", "Notes", D.notes.length]].map(([k, l, n]) =>
    `<button type="button" class="orch-tab ${view === k ? "on" : ""}" data-act="orch-tab" data-k="${k}">${l} <small>${n}</small></button>`).join("");
  if (view === "notes") {
    if (!$("#orch-notes")) $("#orch-list").innerHTML = `<div id="orch-notes"></div>`;
    paintNoteList();
  } else {
    const q = fold(orchNoteQ.trim());
    const tuiOn = (it) => it.tui && orchPanes.some((p) => p.kind === "terminal" && p.run && ((it.tui.task && p.run.task === it.tui.task) || (it.tui.key && p.run.key === it.tui.key)));
    const row = (it) => {
      const k = paneKey(it), on = pinnedKeys.has(k) || tuiOn(it);
      const x = it.kind === "terminal" ? `data-act="term-close-session" data-id="${esc(it.id)}" title="Close this terminal"`
        : `data-act="orch-dismiss" data-kind="${it.kind}" data-id="${esc(it.id)}" title="${it.kind === "task" ? "Delete this task" : "Hide from the Fleet"}"`;
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
  }
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
const winHead = (key, title, sub, acts = "") => `<div class="win-lights">
    <button type="button" class="wl close" data-act="orch-unpin" data-key="${esc(key)}" title="Close (Ctrl+Alt+W)" aria-label="Close"></button>
    <button type="button" class="wl min" data-act="orch-collapse" data-key="${esc(key)}" title="Minimize to the title bar" aria-label="Minimize"></button>
    <button type="button" class="wl max" data-act="orch-max" data-key="${esc(key)}" title="Maximize (Ctrl+Alt+Enter)" aria-label="Maximize"></button>
  </div><div class="win-title" title="${esc(title)}"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div><div class="orch-acts">${acts}</div>`;
// A re-render while the user is selecting text in a card would wipe the selection: wait for the next tick.
const selectingIn = (el) => { const s = getSelection(); return !!s && !s.isCollapsed && el.contains(s.anchorNode); };
// The HUD: icons only (names and shortcuts in tooltips). Creating cards works in both layouts; the
  // canvas-only tools (select/pan, arrange, fit, zoom) show on the free canvas.
function paintHud(hud, isFree) {
  if (!hud) return;
  const b = (act, ic, tip, extra = "", on = false) => `<button type="button" class="hud-btn ${on ? "on" : ""}" data-act="${act}" ${extra} title="${tip}" aria-label="${tip}">${icon(ic, 14)}</button>`;
  const full = b("canvas-full", "expand", document.body.classList.contains("canvas-full") ? "Leave full screen (Esc)" : "Full screen (Ctrl+Alt+Z)", "", document.body.classList.contains("canvas-full"));
  const make = b("orch-new", "plus", "New agent or shell (Ctrl+Alt+N opens your agent)") + b("term-canvas", "terminal", "New terminal (Ctrl+Alt+T)") + b("orch-add-sticky", "notes", "New note");
  const bgBtn = b("orch-bg-menu", "canvasBg", `Canvas background: ${bgEntry(orchBg)[1]} (B · Ctrl+Alt+B)`, `data-bg="${esc(orchBg)}"`, !($("#orch-bgmenu")?.hidden ?? true));
  const hudHtml = !isFree ? `${make}<span class="orch-hud-sep"></span>${full}` : `${b("orch-tool", "select", "Select (S) · drag to select several", 'data-tool="select"', orchTool === "select")}${b("orch-tool", "hand", "Pan (H, or hold Space)", 'data-tool="pan"', orchTool === "pan")}
      <span class="orch-hud-sep"></span>${make}<span class="orch-hud-sep"></span>
      ${b("orch-arrange", "grid", "Arrange the windows")}${b("orch-fit", "max", "Fit everything in view (Ctrl+Alt+F)")}
      <span class="orch-hud-sep"></span>
      <button type="button" class="hud-btn" data-act="orch-zoom" data-d="-0.15" title="Zoom out" aria-label="Zoom out">−</button>
      <button type="button" class="hud-btn hud-zoom" data-act="orch-zoom" data-d="0" id="orch-zoom-lbl" title="Back to 100%">${Math.round(orchZoom * 100)}%</button>
      <button type="button" class="hud-btn" data-act="orch-zoom" data-d="0.15" title="Zoom in" aria-label="Zoom in">+</button>
      <span class="orch-hud-sep"></span>${bgBtn}
      <span class="orch-hud-sep"></span>${full}
      <span class="hud-sel" id="orch-sel-cnt" ${orchSelected.size ? "" : "hidden"}>${orchSelected.size} selected</span>
      <button type="button" class="hud-btn danger" data-act="orch-del-sel" id="orch-del-sel" title="Close the selected cards (Delete)" ${orchSelected.size ? "" : "hidden"}>${icon("trash", 14)}</button>`;
  // Rewritten only when it changes: a rewrite every tick drops clicks that straddle it.
  if (hud.dataset.sig !== hudHtml) { hud.innerHTML = hudHtml; hud.dataset.sig = hudHtml; }
}
async function orchPaint(force) {
  reapTerms();
  const canvas = $("#orch-canvas"), plane = $("#orch-plane"), hud = $("#orch-hud");
  if (!canvas || !plane) return;
  if (!orchPanes.length) {
    orchSigs.clear();
    canvas.className = `orch-canvas ${orchMode === "free" ? `free tool-${orchTool}` : "tiled"}`; // keeps its size and dot grid
    plane.className = `orch-plane ${orchMode === "free" ? "free" : "single"}`;
    plane.innerHTML = `<div class="orch-empty glass"><p class="empty">Open an agent with <b>+</b> (or Ctrl+Alt+N), or a session from the Fleet.</p></div>`;
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
      plane.appendChild(card);
    }
    card.classList.toggle("active", key === orchActive);
    card.classList.toggle("collapsed", !!p.collapsed && isFree);
    card.classList.toggle("selected", orchSelected.has(key));
    card.dataset.kind = p.kind;
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
      let ta = feed.querySelector(".orch-sticky-input");
      if (!ta) {
        feed.innerHTML = `<div class="orch-sticky-wrap"><textarea class="orch-sticky-input" placeholder="Write a note… wire it into an agent and it becomes context">${esc(p.text || "")}</textarea></div>`;
        ta = feed.querySelector(".orch-sticky-input");
        ta.oninput = () => { p.text = ta.value; saveCanvas(); };
      } else if (document.activeElement !== ta) {
        ta.value = p.text || "";
      }
      if (form) form.style.display = "none";
      return;
    }
    if (p.kind === "terminal") {
      const sig = `terminal|${p.id}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig && card.querySelector(".orch-term-view")) return;
      orchSigs.set(key, sig);
      const cwd = p.cwd || orchCwd || "";
      const title = terms.get(p.id)?.title || (p.run ? runnerName(p.run.agent || p.agent) || "Agent" : cwdLabel(cwd));
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
    orchFilter = "all"; orchMax = "";
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
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
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
      <div class="img-set glass"><b>Dock</b><small>Navigation bar at the bottom, or a compact pill.</small>${seg("set-dock", dockMode)}</div>
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
const ck = { items: [], sel: 0, timer: 0 };
function cmdkOpen() {
  const d = $("#cmdk");
  if (d.open) return;
  $("#cmdk-q").value = ""; cmdkFill(""); d.showModal(); $("#cmdk-q").focus();
}
function cmdkFill(q) {
  const terms = fold(q).trim().split(/\s+/).filter((t) => t && !STOP.has(t)), has = (s) => terms.every((t) => fold(s).includes(t));
  const acts = [{ ic: "spark", title: "Capture a thought", sub: "Action", run: () => ACTIONS.capture() },
    ...(D.focus?.length || !D.routines ? [] : [{ ic: "target", title: "Start the day", sub: "Action", run: () => ACTIONS["start-day"]() }]),
    ...GO.map(([h, title, ic]) => ({ ic, title, sub: "Page", href: `#/${h}` }))];
  const whole = terms.join(" "), rank = (n) => { const t = fold(n.title); return t === whole ? 0 : t.startsWith(whole) ? 1 : t.includes(terms[0] || "") ? 2 : 3; };
  const notes = terms.length ? D.notes.filter((n) => has(`${n.title} ${n.summary} ${n.tags.join(" ")}`))
    .sort((a, b) => rank(a) - rank(b) || a.title.length - b.title.length).slice(0, 8)
    .map((n) => ({ ic: n.type === "project" ? "bolt" : "notes", title: n.title, sub: folderLabel(n.folder), href: noteHref(n.path) })) : [];
  ck.items = [...notes, ...acts.filter((a) => !terms.length || has(a.title))]; ck.sel = 0; cmdkPaint();
  clearTimeout(ck.timer);
  if (terms.join("").length < 3) return;
  ck.timer = setTimeout(async () => {
    const hits = await api(`/api/search?q=${encodeURIComponent(terms.join(" "))}`).catch(() => []);
    if ($("#cmdk-q").value !== q || !$("#cmdk").open) return;
    const seen = new Set(ck.items.map((it) => it.href));
    const more = hits.filter((h) => !seen.has(noteHref(h.path))).slice(0, 6).map((h) => ({ ic: "notes", title: h.title, sub: h.line, href: noteHref(h.path), text: true }));
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
  if (it.href !== undefined) location.hash = it.href; else it.run();
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

// Dock: icons swell toward the pointer, macOS-style (after the Floating Dock on 21st.dev). Mouse only; off with reduced motion.
const calm = matchMedia("(prefers-reduced-motion: reduce)");
$("#dock").addEventListener("pointermove", (e) => {
  if (calm.matches || e.pointerType !== "mouse") return;
  for (const el of $("#dock").querySelectorAll("a, button")) {
    const r = el.getBoundingClientRect(), s = 1 + .3 * Math.max(0, 1 - Math.abs(e.clientX - (r.left + r.width / 2)) / 110);
    el.style.transform = s > 1.001 ? `translateY(${(-(s - 1) * 26).toFixed(1)}px) scale(${s.toFixed(3)})` : "";
  }
});
$("#dock").addEventListener("pointerleave", () => { for (const el of $("#dock").querySelectorAll("a, button")) el.style.transform = ""; });

const PAGES = { "": [home, "Home"], notes: [notes, "Notes"], n: [reader, "Note"], w: [wiki, "Note"], review: [review, "Review"], graph: [graph, "Graph"], agents: [agents, "Agents"], services: [services, "Services"], images: [imagesPage, "Images"], settings: [settingsPage, "Settings"], s: [service, "Service"], a: [agentPage, "Agent"], t: [taskPage, "Task"] };
function route() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGES[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  if (cwdOpen) { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); }
  if (document.activeElement?.closest?.("#dockwrap")) document.activeElement.blur(); // a floating dock folds after you pick a page
  graphStop?.(); graphStop = null; clearInterval(orchTimer);
  const { pg, arg } = route();
  if (pg !== "agents" && document.body.classList.contains("canvas-full")) canvasFull(false); // full screen is the canvas's
  if (pg !== "s" && document.body.classList.contains("svc-full")) svcFull(false);
  $("#crumb").textContent = pg === "a" ? S.background?.find((x) => x.key === arg)?.title || AGENT_NAME[S.agents.find((x) => x.key === arg)?.name]?.[0] || "Agent" : pg === "s" ? S.services.find((s) => s.id === arg)?.name || "Service" : PAGES[pg][1];
  document.body.classList.toggle("home", !pg);
  document.body.classList.toggle("app", pg === "s"); // an embedded app takes over the week strip's height
  document.body.classList.toggle("agents", pg === "agents" || pg === "a" || pg === "t");
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
  const p = $("#capture-agent-panel");
  if (p) p.hidden = !isAgent;
  const ta = $("#capture-text"), hint = $("#capture-hint"), btn = $("#capture-submit-btn");
  if (isAgent) {
    if (ta) ta.placeholder = "Topic or instructions for the agent… Enter dispatches.";
    if (hint) hint.innerHTML = "Dispatches an agent to research and write a note in your vault.";
    if (btn) btn.textContent = "Dispatch Agent";
    initCaptureAgent();
  } else {
    if (ta) ta.placeholder = "An idea, a link, a question. Enter saves.";
    if (hint) hint.innerHTML = `Goes to the daily note for <span id="capture-day">${esc(D?.today || "")}</span>. Your agent processes it later.`;
    if (btn) btn.textContent = "Save";
  }
}

const ACTIONS = {
  ...CAL_ACTIONS, ...IMG_ACTIONS,
  prev: () => move(-1), next: () => move(1), go: (el) => { idx = Number(el.dataset.i); place(); },
  filter: (el) => { filter = el.dataset.k; notes(); },
  show: () => { revealed = true; flashcard(); }, yes: () => answer(true), no: () => answer(false),
  trash: async (el) => {
    if (!confirm(`Delete "${el.dataset.p}"? It goes to the vault's .trash folder.`)) return;
    try { await api("/api/trash", { path: el.dataset.p }); } catch (e) { return toast(e.message); }
    D = await api("/api"); toast("Moved to .trash"); location.hash = "#/notes";
  },
  cmdk: () => cmdkOpen(),
  "start-day": async () => {
    const agent = (S.runners || []).find((r) => r.ready)?.id;
    if (!agent) return toast("No agent is ready: add one in Settings");
    try { const r = await api("/api/routine", { name: "morning", agent }); S = await api("/api/system"); location.hash = `#/t/${r.id}`; } catch (e) { toast(e.message); }
  },
  "enroll-5": async (el) => {
    const ps = JSON.parse(el.dataset.ps);
    for (const path of ps) await api("/api/review", { path, remembered: false });
    toast(`${ps.length} in the cycle: first review tomorrow`); D = await api("/api"); render();
  },
  enroll: async (el) => { await api("/api/review", { path: el.dataset.p, remembered: false }); toast("In the cycle: first review tomorrow"); D = await api("/api"); render(); },
  routine: async (el) => {
    try {
      const r = await api("/api/routine", { name: el.dataset.k, ...runChoice() });
      S = await api("/api/system");
      if (route().pg === "agents") {
        orchFilter = "all"; orchMax = "";
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
    await loadCwdBrowser(cur || "~/dev");
    placeCwdPop(el);
    $("#cwd-q")?.focus();
  },
  "cwd-close": () => { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); },
  "cwd-nav": async (el) => { await loadCwdBrowser(el.dataset.path ?? "~/dev"); },
  "cwd-pick": (el) => pickCwd(el.dataset.path ?? ""),
  "cwd-hidden": async () => { cwdHidden = !cwdHidden; await loadCwdBrowser(cwdBrowse); },
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
      btn.title = orchRailMode === "float" ? "Keep the Fleet open beside the canvas" : "Let the Fleet float over the canvas";
    }
  },
  "orch-deck-toggle": (el) => {
    orchDeckOpen = !orchDeckOpen;
    $("#run")?.classList.toggle("open", orchDeckOpen);
    document.querySelectorAll('[data-act="orch-deck-toggle"]').forEach((b) => b.classList.toggle("on", orchDeckOpen));
    if (!orchDeckOpen && el) el.blur();
  },
  "term-canvas": (el) => { $("#orch-newmenu")?.setAttribute("hidden", ""); newTermPane(el?.dataset?.cwd); },
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
  "orch-new": (el) => {
    if (el?.dataset?.agent) return newAgentTerm(el.dataset.agent);
    $("#orch-bgmenu")?.setAttribute("hidden", "");
    const menu = $("#orch-newmenu");
    if (!menu) return newAgentTerm(defaultAgent());
    if (!menu.hidden) return menu.setAttribute("hidden", "");
    menu.innerHTML = [...(S.runners || []).filter((r) => r.ready && r.tui).map((r) => `<button type="button" data-act="orch-new" data-agent="${esc(r.id)}">${icon("agents", 14)} ${esc(r.name)}</button>`),
      `<button type="button" data-act="term-canvas">${icon("terminal", 14)} Shell</button>`].join("");
    menu.removeAttribute("hidden");
  },
  "orch-bg-menu": () => {
    $("#orch-newmenu")?.setAttribute("hidden", "");
    const menu = $("#orch-bgmenu");
    if (!menu) return cycleCanvasBg();
    if (!menu.hidden) { menu.setAttribute("hidden", ""); paintHud($("#orch-hud"), orchMode === "free" && !orchMax); return; }
    menu.innerHTML = CANVAS_BGS.map(([k, l, d]) => `<button type="button" class="${orchBg === k ? "on" : ""}" data-act="orch-bg" data-bg="${k}"><span class="bg-sw" data-sw="${k}"></span><span>${l}</span><small>${d}</small></button>`).join("");
    menu.removeAttribute("hidden");
    paintHud($("#orch-hud"), orchMode === "free" && !orchMax);
  },
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
  "orch-add-note": (el) => {
    const path = el.dataset.path;
    if (!path) return;
    addPane({ kind: "note", id: path });
    saveCanvas();
    toast("Note added to canvas");
  },
  "orch-add-sticky": () => {
    const id = String(++orchSeq);
    addPane({ kind: "sticky", id, text: "" });
    saveCanvas();
    toast("Sticky note added");
  },
  "orch-tab": (el) => { orchFilter = el.dataset.k; agentsBody(); },
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
  "orch-unpin": (el) => {
    const k = el.dataset.key;
    if (!closeLiveOk([k])) return;
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
    if (kind === "task" && !confirm("Delete this task and its history from Overlook?")) return;
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
  "capture-close": () => $("#capture").close(),
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
  if (!e.target.closest('#orch-newmenu, [data-act="orch-new"]')) $("#orch-newmenu")?.setAttribute("hidden", "");
  if (!e.target.closest('#orch-bgmenu, [data-act="orch-bg-menu"]')) {
    const bgm = $("#orch-bgmenu");
    if (bgm && !bgm.hidden) { bgm.setAttribute("hidden", ""); paintHud($("#orch-hud"), orchMode === "free" && !orchMax); }
  }
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
  if (e.key === "Delete" && orchSelected.size > 0 && route().pg === "agents" && !orchMax) {
    if (!e.target.closest("input, textarea, select, [contenteditable]")) {
      e.preventDefault();
      deleteSelectedPanes();
      return;
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
  const { pg } = route();
  if (pg === "agents" && orchMode === "free" && !orchMax) {
    if (e.key === "h") { e.preventDefault(); ACTIONS["orch-tool"]({ dataset: { tool: "pan" } }); return; }
    if (e.key === "s") { e.preventDefault(); ACTIONS["orch-tool"]({ dataset: { tool: "select" } }); return; }
    if (e.key === "b" || e.key === "B") { e.preventDefault(); cycleCanvasBg(); return; }
  }
  if (e.key === "c" || e.key === "C") { e.preventDefault(); ACTIONS.capture(); }
  if (e.key === "v" || e.key === "V") { e.preventDefault(); ACTIONS["ui-toggle"](); }
  if (e.key === "/" && pg !== "agents") { e.preventDefault(); cmdkOpen(); }
  if (!pg && (e.key === "ArrowLeft" || (uiMode === "minimal" && e.key === "ArrowUp"))) { e.preventDefault(); move(-1); }
  if (!pg && (e.key === "ArrowRight" || (uiMode === "minimal" && e.key === "ArrowDown"))) { e.preventDefault(); move(1); }
  if (pg === "review" && queue[pos]) {
    if (e.key === " " && !revealed) { e.preventDefault(); ACTIONS.show(); }
    if (revealed && e.key === "1") answer(false);
    if (revealed && e.key === "2") answer(true);
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
  if (!pg) tiles();
  else if (pg === "agents" && !cwdOpen && !document.activeElement?.closest?.(".orch-talk, .orch-sticky-wrap")) agentsBody();
  else if (pg === "services") services();
}, 10000);
setInterval(async () => { await vault(); topBar(); if (!route().pg) tiles(); }, 60000);
addEventListener("focus", async () => { await vault(); topBar(); const { pg } = route(); if (!pg) home(); else if (pg === "notes") grid(); });
setInterval(clock, 1000);
clock();
Promise.all([vault(), system()]).then(render);
