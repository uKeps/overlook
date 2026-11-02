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
  terminal: '<polyline points="4 17 10 12 4 7"/><path d="M12 19h8"/>',
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
// Opened over Tailscale (phone): embedded apps use the tailnet links, built from the current host.
const remote = location.hostname.endsWith(".ts.net");
const address = (s) => (remote ? (s.tailnet ? `https://${location.hostname}:${s.tailnet}` : "") : s.proxy ? `http://127.0.0.1:${s.proxy}` : s.url);
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
const inbox = () => D.notes.filter((n) => n.folder.startsWith("1 "));
const folderLabel = (f) => f.replace(/^\d+\s*-?\s*/, "");
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
let uiMode = (() => { try { return localStorage.getItem(UI_KEY) === "minimal" ? "minimal" : "classic"; } catch { return "classic"; } })();
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
  for (const f of D.focus || []) { const a = ln(f); s.push({ cat: "Today's focus", ic: "target", title: unlink(f), raw: f, sub: "Picked for today in the daily note.", meta: [["Source", "Daily note"]], href: a ? `#/w/${encodeURIComponent(a)}` : obs(dailyPath()), action: "Open" }); }
  for (const n of due()) s.push({ cat: "Review", ic: "review", title: n.title, sub: "Before opening: do you remember what it is about?", meta: [["Due", n.review_on === D.today ? "today" : `${daysBetween(n.review_on, D.today)} d ago`], ["Interval", `${n.interval} d`]], href: "#/review", action: "Review" });
  for (const c of D.captured || []) s.push({ cat: "Captured today", ic: "spark", title: unlink(c), raw: c, sub: "Raw capture. It becomes a note once it fits in one sentence, or it dies.", meta: [["Status", "In the daily note"]], href: obs(dailyPath()), action: "Open in Obsidian" });
  for (const n of inbox()) s.push({ cat: "Inbox", ic: "inbox", title: n.title, sub: "Process: becomes a permanent note or leaves the vault.", meta: [["Arrived", ago(n.mtime)]], href: noteHref(n.path), action: "Open" });
  for (const v of D.missing.slice(0, 3)) s.push({ cat: "Gap", ic: "gap", title: v.target, sub: `Linked ${v.n}× and doesn't exist yet. Write it when you need it, not out of duty.`, meta: [["Linked", `${v.n}×`]], href: `#/w/${encodeURIComponent(v.target)}`, action: "See who links it" });
  for (const n of D.notes.filter((n) => n.type === "project")) s.push({ cat: "Project", ic: "bolt", title: n.title, sub: plain(n.summary), meta: [["Area", n.area || "-"], ["Touched", ago(n.mtime)]], href: noteHref(n.path), action: "Open" });
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

function home() {
  SG = suggestions();
  idx = Math.min(idx, SG.length - 1);
  if (uiMode === "minimal") {
    main.innerHTML = `<section class="min-home">
        <div class="min-queue">
          <div class="min-qhead"><span>Today's workbench</span><small>${SG.length} ${SG.length === 1 ? "item" : "items"} · ↑↓ or click to preview</small></div>
          <div class="min-rows">${SG.map((s, i) => `<div class="min-row ${i === idx ? "on" : ""}" data-i="${i}">
            <button type="button" class="min-sel" data-act="go" data-i="${i}">
              <span class="min-idx">${String(i + 1).padStart(2, "0")}</span>
              <span class="min-txt"><b>${emLinks(s.raw || s.title)}</b><small>${esc(s.sub)}</small></span>
              <span class="min-cat">${icon(s.ic, 13)} ${esc(s.cat)}</span>
            </button>
            <a class="min-go" href="${esc(s.href)}">${esc(s.action)} ${icon("r", 13)}</a>
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
        <div class="card-foot"><a class="btn peach go" href="${esc(s.href)}">${esc(s.action)} ${icon("r", 16)}</a></div>
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
      const i = idx, s = SG[i], p = pinFor(i), ascii = asciiCards() || !D.pins?.length;
      st.innerHTML = `<div class="min-art ${ascii ? "card-ascii" : ""}">
          ${ascii ? `<ascii-art piece="${scene(s, i)}"></ascii-art>` : `<img src="${art(i)}" alt="">`}
          <div class="min-art-bar">
            ${!ascii && D.pins?.length ? `<button type="button" class="min-pick" data-act="pick-open" data-i="${i}">${icon("image", 13)} ${D.pinCards?.[cardKey(s)] ? "Chosen" : "Choose image"}</button>` : ""}
            <button type="button" class="min-pick" data-act="cycle-art" title="Switch card art (${cardArt})">${ascii ? "Use photo" : "Use ASCII"}</button>
            ${!ascii && p?.link ? `<a class="min-pinlink" href="${esc(p.link)}" target="_blank">pinterest ↗</a>` : ""}
          </div>
        </div>
        <div class="min-focus">
          <div class="min-focus-top"><span class="tag">${icon(s.ic, 13)} ${esc(s.cat)}</span>
            <span class="card-idx">${String(i + 1).padStart(2, "0")} / ${String(SG.length).padStart(2, "0")}</span></div>
          <h2>${emLinks(s.raw || s.title)}</h2>
          <p>${esc(s.sub)}</p>
          ${s.meta.length ? `<div class="min-meta-list">${s.meta.map(([k, v]) => `<span class="min-meta">${esc(k)}: <b>${esc(v)}</b></span>`).join("")}</div>` : ""}
          <div class="min-focus-foot">
            <a class="btn peach" href="${esc(s.href)}">${esc(s.action)} ${icon("r", 14)}</a>
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
      <div class="r"><input class="search glass" id="search" placeholder="Search title or summary  /" value="${esc(query)}" autocomplete="off"></div></div>
    <div class="filters">${[["", "All", D.notes.length], ...Object.keys(count).sort().map((k) => [k, folderLabel(k), count[k]])]
      .map(([k, v, c]) => `<button class="fchip ${filter === k ? "on" : ""}" data-act="filter" data-k="${esc(k)}">${esc(v)}<small>${c}</small></button>`).join("")}</div>
    <div class="grid" id="note-grid"></div>`;
  grid();
  ambient(art("notes"));
}
function grid() {
  const q = fold(query);
  const weight = (n) => (!q ? 0 : fold(n.title).startsWith(q) ? 0 : fold(n.title).includes(q) ? 1 : 2);
  const ns = D.notes.filter((n) => (!filter || n.folder === filter) && (!q || fold(n.title + " " + n.summary + " " + n.tags.join(" ")).includes(q)))
    .sort((a, b) => weight(a) - weight(b) || b.mtime - a.mtime);
  $("#note-grid").innerHTML = ns.map((n, i) => `<a class="nc glass" href="${noteHref(n.path)}" style="animation-delay:${Math.min(i, 12) * 25}ms">
      <h4>${esc(n.title)}</h4>
      <p>${esc(n.type === "daily" ? "Daily note" : plain(n.summary) || "No one-line summary.")}</p>
      <span class="f">${n.type ? `<span class="pill">${esc(n.type)}</span>` : ""}${n.review_on ? '<span class="pill peach">in cycle</span>' : ""}<span>${esc(n.area)}</span><span style="margin-left:auto">${ago(n.mtime)}</span></span></a>`).join("")
    || `<p class="empty">Nothing matches "${esc(query)}".</p>`;
}

// ---------------------------------------------------------------- Reader
async function reader(path) {
  const n = await api(`/api/note?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!n) { main.innerHTML = `<div class="lost"><ascii-art piece="not-found" mono label="Not found"></ascii-art><p class="empty">Note not found.</p></div>`; return; }
  main.innerHTML = `<div class="reader">
    <article class="art glass">
      <div class="in"><h1>${esc(n.title)}</h1>
        <div class="chips">${[n.type, n.area, ...n.tags].filter(Boolean).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
        <div class="prose" id="prose">${n.html}</div></div></article>
    <aside class="rail">
      <div class="box glass">
        <a class="btn peach" href="${obs(n.path)}">Open in Obsidian ${icon("ext", 16)}</a>
        ${n.review_on ? `<p class="empty" style="padding:10px 0 0">In the cycle: review ${n.review_on <= D.today ? "today" : rel.format(daysBetween(D.today, n.review_on), "day")}, interval ${n.interval} d.</p>`
          : `<button class="btn glass" data-act="enroll" data-p="${esc(n.path)}">Add to the review cycle</button>`}
        <button class="btn glass" data-act="trash" data-p="${esc(n.path)}">Delete note</button></div>
      <div class="box glass"><h3>Linked from</h3>${n.backlinks.map((b) => `<a class="l" href="${noteHref(b.path)}">${esc(b.title)}</a>`).join("") || '<p class="empty" style="padding:0">Nothing links here yet.</p>'}</div>
      <div class="box glass"><h3>Links to</h3>${[...new Set(n.links)].map((l) => `<a class="l" href="#/w/${encodeURIComponent(l)}" style="${resolveNote(l) ? "" : "opacity:.5"}">${esc(l)}</a>`).join("") || '<p class="empty" style="padding:0">No links.</p>'}</div>
    </aside></div>`;
  // Obsidian callout: a blockquote starting with [!type] Title.
  document.querySelectorAll("#prose blockquote").forEach((b) => {
    const p = b.querySelector("p");
    const m = p?.innerHTML.match(/^\[!(\w+)\]\s*([^\n<]*)(?:<br\s*\/?>|\n)?/);
    if (!m) return;
    b.classList.add("co", m[1]);
    p.innerHTML = `<span class="ct">${m[2] || m[1]}</span>` + p.innerHTML.slice(m[0].length);
  });
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
    const outside = D.notes.filter((x) => !x.review_on && x.summary && x.type !== "daily").sort((a, b) => b.mtime - a.mtime).slice(0, 8);
    main.innerHTML = `<div class="ph"><h1>${done ? `${done} reviewed. Done.` : "Nothing due today"}</h1>
        <p>Remembered doubles the interval; forgot resets it to 1 day.</p></div>
      <h3>Coming up</h3><div class="list glass">${next.slice(0, 8).map((x) => `<a class="row" href="${noteHref(x.path)}"><span class="t">${esc(x.title)}</span><span class="x">${x.review_on} · ${x.interval} d</span></a>`).join("") || '<p class="empty">No notes in the cycle yet.</p>'}</div>
      <h3>Add to the cycle</h3><div class="list glass">${outside.map((x) => `<div class="row hov"><a class="t" href="${noteHref(x.path)}">${esc(x.title)}<small>${esc(plain(x.summary))}</small></a>
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
let PALETTE = [];
const areaColor = (a) => PALETTE[hash(a) % PALETTE.length];
let graphStop = null;
function graph() {
  main.innerHTML = `<div class="ph"><h1>Graph</h1><p>Click opens the note. Drag to move, scroll to zoom.</p></div>
    <section class="graph glass"><canvas id="cv"></canvas><div class="legend" id="leg"></div></section>`;
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const areas = [...new Set(D.notes.map((n) => n.area).filter(Boolean))].sort();
  PALETTE = ["--p1", "--p2", "--p3", "--p4", "--p5", "--p6"].map(tok);
  const ink = tok("--ink"), accent = tok("--accent");
  const nodes = D.notes.filter((n) => n.type !== "daily").map((n) => ({ id: nameOf(n.path), t: n.title, p: n.path, c: n.area ? areaColor(n.area) : alpha(ink, .8) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const v of D.missing) if (!byId.has(v.target)) { const g = { id: v.target, t: v.target, c: alpha(ink, .25), ghost: true }; nodes.push(g); byId.set(v.target, g); }
  const edges = [];
  for (const n of D.notes) for (const l of new Set(n.links)) { const a = byId.get(nameOf(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  let W, H, panX = 0, panY = 0, zoom = 1;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 4 + Math.sqrt(deg.get(n) || 0) * 2.5; });
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
      ctx.strokeStyle = near && (a === hover || b === hover) ? alpha(accent, .7) : alpha(ink, .1);
      ctx.lineWidth = 1 / zoom; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      ctx.globalAlpha = near && !near.has(n) && n !== hover ? 0.25 : 1;
      ctx.fillStyle = n.c; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      if (n === hover || (!hover && (deg.get(n) || 0) >= 5) || near?.has(n)) {
        ctx.fillStyle = alpha(ink, n.ghost ? .45 : .85);
        ctx.font = "500 12px Inter, sans-serif"; ctx.fillText(n.t.length > 34 ? n.t.slice(0, 32) + "…" : n.t, n.x + n.r + 5, n.y + 4);
      }
    }
    ctx.globalAlpha = 1;
  }
  let alive = true;
  // Stops once it settles: only animates again with the mouse over it (saves CPU while the tab sits idle).
  let idle = false;
  const loop = () => { if (!alive) return; step(); draw(); if (heat > 0.06 || drag) requestAnimationFrame(loop); else idle = true; };
  const wake = () => { if (idle) { idle = false; requestAnimationFrame(loop); } };
  loop();
  graphStop = () => { alive = false; };
  const world = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - panX) / zoom, (e.clientY - r.top - panY) / zoom]; };
  const find = (e) => { const [x, y] = world(e); return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 4 / zoom); };
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
  $("#leg").innerHTML = areas.map((k) => `<span><i style="background:${areaColor(k)}"></i>${esc(k)}</span>`).join("") + '<span><i style="background:rgba(255,255,255,.25)"></i>gap</span>';
  ambient(art("graph"));
}

// ---------------------------------------------------------------- Agents (Maestro Orchestrator)
const ROUTINES = {
  morning: ["Morning", "Builds today's focus in the daily note: reviews, inbox, gaps."],
  inbox: ["Inbox", "Processes the inbox folder: each item becomes a proper note or stays, with the reason."],
};
const ORCH_ROLES = [
  ["", "General", "What should the agent(s) do? Enter dispatches, Shift+Enter adds a line"],
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

let orchRole = "", orchCwd = "", orchFilter = "all", orchMode = "tile", orchDir = "cols", orchRatio = 50,
  orchPanX = 24, orchPanY = 20, orchZoom = 1, orchPanes = [], orchSelected = new Set(), orchActive = "", orchMax = "", orchTool = "select",
  orchRail = true, orchRailMode = "float", orchDeckOpen = false, orchExtra = new Set(), orchTimer = null, orchSigs = new Map(), orchSeq = 1;
let cwdOpen = false, cwdBrowse = "~/dev", cwdHidden = false, cwdQuery = "", cwdData = null, cwdPaneKey = "";
// Canvas links: { a, b } means card a's content goes along as context when you message card b.
let orchLinks = [], orchNoteQ = "";
const CANVAS_KEY = "overlook.canvas", PANE_MIME = "text/x-overlook-pane";
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
  const c = JSON.parse(localStorage.getItem(CANVAS_KEY) || "null");
  if (c) {
    orchPanes = c.panes || [];
    orchLinks = c.links || [];
    orchMode = c.mode || "tile";
    orchPanX = c.panX ?? 24;
    orchPanY = c.panY ?? 20;
    orchZoom = c.zoom || 1;
    orchSeq = c.seq || 1;
    if (c.railMode) orchRailMode = c.railMode;
  }
} catch {}
function saveCanvas() {
  try { localStorage.setItem(CANVAS_KEY, JSON.stringify({ panes: orchPanes.map(({ ctx, ...p }) => p), links: orchLinks, mode: orchMode, panX: orchPanX, panY: orchPanY, zoom: orchZoom, seq: orchSeq, railMode: orchRailMode })); } catch {}
}
function ansiToHtml(str) {
  if (!str) return "";
  const colors = {
    "30": "#5c6370", "31": "#e06c75", "32": "#98c379", "33": "#e5c07b",
    "34": "#61afef", "35": "#c678dd", "36": "#56b6c2", "37": "#abb2bf",
    "90": "#5c6370", "91": "#e06c75", "92": "#98c379", "93": "#e5c07b",
    "94": "#61afef", "95": "#c678dd", "96": "#56b6c2", "97": "#ffffff"
  };
  const escaped = str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] || c);
  let openSpans = 0;
  const formatted = escaped
    .replace(/\u001b\[\?[\d;]*[a-zA-Z]/g, "")
    .replace(/\u001b\][\s\S]*?\u0007/g, "")
    .replace(/\u001b\[(\d+(?:;\d+)*)?m/g, (_, code) => {
      if (!code || code === "0") {
        const closing = "</span>".repeat(openSpans);
        openSpans = 0;
        return closing;
      }
      const parts = code.split(";");
      const c = colors[parts.find((p) => colors[p])];
      const bold = parts.includes("1") ? "font-weight:600;" : "";
      if (c || bold) {
        openSpans++;
        return `<span style="${bold}${c ? `color:${c};` : ""}">`;
      }
      return "";
    });
  return formatted + "</span>".repeat(openSpans);
}

const termPanesState = new Map();

function clearTerminal(id) {
  const state = termPanesState.get(id);
  const out = $(`#term-view-${id} .orch-term-output`);
  if (out) out.innerHTML = "";
  if (state) state.lines = [];
}

function interruptTerminal(id) {
  const state = termPanesState.get(id);
  if (state?.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: "kill" }));
  } else {
    api("/api/terminal/session/kill", { id }).catch(() => {});
  }
  const out = $(`#term-view-${id} .orch-term-output`);
  if (out) {
    const div = document.createElement("div");
    div.className = "orch-term-line system";
    div.textContent = "^C";
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }
}

function mountTerminalPane(card, p) {
  const feed = card.querySelector(".orch-feed");
  if (!feed) return;
  const viewId = `term-view-${p.id}`;
  let view = feed.querySelector(`#${viewId}`);
  if (!view) {
    feed.innerHTML = `
      <div class="orch-term-view" id="${viewId}">
        <pre class="orch-term-output"></pre>
        <form class="orch-term-input-bar">
          <span class="orch-term-prompt">${esc(cwdLabel(p.cwd))} ❯</span>
          <input type="text" class="orch-term-input" placeholder="Type command… (Enter to run, ↑/↓ history, Ctrl+C interrupt)" autocomplete="off" spellcheck="false" />
          <button type="button" class="btn glass orch-term-ctrl-c" data-act="term-interrupt" data-key="terminal:${p.id}" title="Interrupt (Ctrl+C)">^C</button>
          <button type="submit" class="btn peach orch-term-run-btn" title="Run command">Run ${icon("play", 11)}</button>
        </form>
      </div>`;
    view = feed.querySelector(`#${viewId}`);
  }

  const out = view.querySelector(".orch-term-output");
  const form = view.querySelector(".orch-term-input-bar");
  const input = view.querySelector(".orch-term-input");
  const promptSpan = view.querySelector(".orch-term-prompt");

  if (!termPanesState.has(p.id)) {
    termPanesState.set(p.id, {
      history: [],
      historyIdx: 0,
      lines: [`<div class="orch-term-line system">Overlook Terminal (${esc(p.shell || "bash")}) · 📁 ${esc(p.cwd || orchCwd || "")}</div><div class="orch-term-line system">Type commands, press Enter to run, ↑/↓ for history.</div>`],
      ws: null,
      running: false,
    });
  }

  const state = termPanesState.get(p.id);
  out.innerHTML = state.lines.join("");
  out.scrollTop = out.scrollHeight;

  if (!state.ws || state.ws.readyState > 1) {
    try {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${location.host}/ws/terminal?id=${encodeURIComponent(p.id)}&shell=${encodeURIComponent(p.shell || "")}&cwd=${encodeURIComponent(p.cwd || "")}`;
      state.ws = new WebSocket(wsUrl);
      state.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "chunk") {
            const lastLine = out.querySelector(".orch-term-line.active-chunk");
            if (lastLine) {
              lastLine.innerHTML += ansiToHtml(msg.data);
            } else {
              const div = document.createElement("div");
              div.className = "orch-term-line out active-chunk";
              div.innerHTML = ansiToHtml(msg.data);
              out.appendChild(div);
            }
            out.scrollTop = out.scrollHeight;
          } else if (msg.type === "exit") {
            state.running = false;
            const activeChunk = out.querySelector(".active-chunk");
            if (activeChunk) activeChunk.classList.remove("active-chunk");
            if (msg.output && !activeChunk) {
              const div = document.createElement("div");
              div.className = msg.code === 0 ? "orch-term-line out" : "orch-term-line err";
              div.innerHTML = ansiToHtml(msg.output);
              out.appendChild(div);
            }
            if (msg.newCwd && msg.newCwd !== p.cwd) {
              p.cwd = msg.newCwd;
              promptSpan.textContent = `${cwdLabel(p.cwd)} ❯`;
              const cwdCode = card.querySelector(".orch-term-cwd code");
              if (cwdCode) cwdCode.textContent = cwdLabel(p.cwd);
              saveCanvas();
            }
            state.lines.push(out.innerHTML);
            if (state.lines.length > 50) state.lines = [out.innerHTML];
            out.scrollTop = out.scrollHeight;
            input.disabled = false;
            input.focus();
          }
        } catch {}
      };
      state.ws.onerror = () => {};
    } catch {}
  }

  input.onkeydown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (state.history.length > 0 && state.historyIdx > 0) {
        state.historyIdx--;
        input.value = state.history[state.historyIdx] || "";
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (state.historyIdx < state.history.length - 1) {
        state.historyIdx++;
        input.value = state.history[state.historyIdx] || "";
      } else {
        state.historyIdx = state.history.length;
        input.value = "";
      }
    } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      if (!input.value) {
        e.preventDefault();
        interruptTerminal(p.id);
      }
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearTerminal(p.id);
    }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const cmd = input.value;
    input.value = "";
    if (!cmd.trim()) return;

    state.history.push(cmd);
    state.historyIdx = state.history.length;

    if (cmd.trim() === "clear") {
      clearTerminal(p.id);
      return;
    }

    const cmdDiv = document.createElement("div");
    cmdDiv.className = "orch-term-line cmd";
    cmdDiv.innerHTML = `<span class="term-prompt">❯</span> <span>${esc(cmd)}</span>`;
    out.appendChild(cmdDiv);
    out.scrollTop = out.scrollHeight;

    state.running = true;

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      input.disabled = true;
      state.ws.send(JSON.stringify({ type: "run", cmd }));
    } else {
      input.disabled = true;
      try {
        const res = await api("/api/terminal/session/run", { id: p.id, cmd, shell: p.shell, cwd: p.cwd });
        const outDiv = document.createElement("div");
        outDiv.className = res.code === 0 ? "orch-term-line out" : "orch-term-line err";
        outDiv.innerHTML = ansiToHtml(res.output);
        out.appendChild(outDiv);
        if (res.newCwd && res.newCwd !== p.cwd) {
          p.cwd = res.newCwd;
          promptSpan.textContent = `${cwdLabel(p.cwd)} ❯`;
          const cwdCode = card.querySelector(".orch-term-cwd code");
          if (cwdCode) cwdCode.textContent = cwdLabel(p.cwd);
          saveCanvas();
        }
      } catch (err) {
        const errDiv = document.createElement("div");
        errDiv.className = "orch-term-line err";
        errDiv.textContent = `Error: ${err.message}`;
        out.appendChild(errDiv);
      } finally {
        state.running = false;
        input.disabled = false;
        input.focus();
        out.scrollTop = out.scrollHeight;
      }
    }
  };
}

let termList = [], shellList = [], prefTerm = "", prefShell = "", termPopOpen = false;
try { prefTerm = localStorage.getItem("overlook.terminal") || ""; } catch {}
try { prefShell = localStorage.getItem("overlook.shell") || ""; } catch {}

async function loadTerminals() {
  try {
    const data = await api("/api/terminals");
    termList = data.terminals || [];
    shellList = data.shells || [];
    if (!prefTerm) prefTerm = data.defaultTerminal || (termList[0]?.id || "");
    if (!prefShell && prefShell !== "") prefShell = data.defaultShell || "";
    const lbl = $("#orch-term-lbl");
    if (lbl) {
      lbl.textContent = "Terminal";
    }
  } catch {}
}

function paintTermPop() {
  const pop = $("#term-pop");
  if (!pop) return;
  if (!termPopOpen) { pop.hidden = true; $("#orch-term-split")?.classList.remove("open"); return; }
  const split = $("#orch-term-split");
  if (split) {
    const r = split.getBoundingClientRect();
    pop.style.top = `${Math.min(window.innerHeight - 380, r.bottom + 6)}px`;
    pop.style.left = `${Math.max(10, Math.min(window.innerWidth - 305, r.left - 60))}px`;
  }
  const cwd = $("#run-cwd")?.value || orchCwd || "~";
  pop.innerHTML = `<div class="term-pop-head">
      <div class="term-pop-cwd"><span class="term-pop-tag">Folder</span><code>${esc(cwdLabel(cwd))}</code></div>
      <button type="button" class="btn glass orch-icon-btn" data-act="term-menu-close" title="Close">${icon("x", 12)}</button>
    </div>
    <button type="button" class="btn peach" style="width:100%;height:32px;justify-content:center;gap:6px;font-size:12px;margin:2px 0;" data-act="term-canvas-pop">
      ${icon("terminal", 14)} Open Terminal in Canvas
    </button>
    <div class="term-pop-sec-title">Shell</div>
    <div class="term-pop-list">
      <button type="button" class="term-pop-row ${!prefShell ? "on" : ""}" data-act="term-pick-shell" data-id="">
        ${icon("bolt", 13)} <span>Default Login Shell</span>
        ${!prefShell ? '<span class="term-badge default">default</span>' : ""}
      </button>
      ${shellList.map((s) => `<button type="button" class="term-pop-row ${s.id === prefShell ? "on" : ""}" data-act="term-pick-shell" data-id="${esc(s.id)}">
        ${icon("bolt", 13)} <span>${esc(s.name)}</span>
        ${s.id === prefShell ? '<span class="term-badge default">active</span>' : ""}
      </button>`).join("")}
    </div>
    <div class="term-pop-sec-title">External Window (Desktop)</div>
    <div class="term-pop-list">
      ${termList.map((t) => `<button type="button" class="term-pop-row ${t.id === prefTerm ? "on" : ""}" data-act="term-pick-emu" data-id="${esc(t.id)}">
        ${icon("ext", 13)} <span>${esc(t.name)}</span>
        ${t.id === prefTerm ? '<span class="term-badge default">selected</span>' : ""}
      </button>`).join("") || '<small class="empty">No external emulator detected</small>'}
    </div>
    <div class="term-pop-foot">
      <a class="term-pop-config" href="#/settings">${icon("settings", 12)} Settings</a>
      <button type="button" class="btn glass" data-act="term-launch" title="Launch external window">${icon("ext", 11)} Launch App</button>
    </div>`;
  pop.hidden = false;
  $("#orch-term-split")?.classList.add("open");
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
function deleteSelectedPanes() {
  if (!orchSelected.size) return;
  const count = orchSelected.size;
  orchPanes = orchPanes.filter((p) => !orchSelected.has(paneKey(p)));
  orchLinks = orchLinks.filter((l) => !orchSelected.has(l.a) && !orchSelected.has(l.b));
  if (orchSelected.has(orchActive)) orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
  orchSelected.clear();
  toast(`Removed ${count} item${count > 1 ? "s" : ""} from Canvas`);
  saveCanvas();
  orchSigs.clear();
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
  if (typeof p.x !== "number") {
    const col = idx % 2, row = Math.floor(idx / 2);
    p.x = 24 + col * 580 + (idx > 3 ? (idx - 3) * 36 : 0);
    p.y = 20 + row * 430 + (idx > 3 ? (idx - 3) * 36 : 0);
  }
  p.w ??= (p.kind === "sticky" ? 320 : p.kind === "note" ? 480 : p.kind === "terminal" ? 640 : 580);
  p.h ??= (p.kind === "sticky" ? 220 : p.kind === "note" ? 440 : p.kind === "terminal" ? 420 : 430);
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
  orchPanX = 0; orchPanY = 0; orchZoom = 1;
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
  orchZoom = Math.min(1.15, Math.max(0.55, Math.min(rect.width / bw, (rect.height - 40) / bh)));
  orchPanX = Math.round((rect.width - (maxX - minX) * orchZoom) / 2 - minX * orchZoom);
  orchPanY = Math.round(((rect.height - 40) - (maxY - minY) * orchZoom) / 2 - minY * orchZoom);
  applyCanvasTransform();
}
function applyCanvasTransform() {
  const plane = $("#orch-plane"), zLbl = $("#orch-zoom-lbl");
  if (plane) plane.style.transform = orchMode === "free" && !orchMax ? `translate(${orchPanX}px, ${orchPanY}px) scale(${orchZoom})` : "";
  if (zLbl) zLbl.textContent = `${Math.round(orchZoom * 100)}%`;
}
// Puts a card on the workspace (from a click, a drop or the HUD); x/y are canvas coordinates of a drop.
function addPane(item, x, y) {
  const k = paneKey(item), have = orchPanes.find((p) => paneKey(p) === k), p = have || item;
  if (!have) {
    if (orchPanes.length >= (orchMode === "free" ? 18 : 6)) orchPanes.shift();
    ensurePaneRect(p, orchPanes.length);
    orchPanes.push(p);
  }
  if (x != null && orchMode === "free") { p.x = Math.round(x - 40); p.y = Math.round(y - 16); }
  orchActive = k; orchMax = ""; orchSigs.clear();
  agentsBody();
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
  svg.innerHTML = `<defs><marker id="orch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z"/></marker></defs>`
    + orchLinks.map((l, i) => {
      const a = byKey.get(l.a), b = byKey.get(l.b);
      const fromLeft = a.x > b.x + b.w / 2;
      const x1 = fromLeft ? a.x : a.x + a.w, y1 = a.y + a.h / 2;
      const x2 = fromLeft ? b.x + b.w : b.x, y2 = b.y + b.h / 2;
      return `<path class="hit" d="${d}" data-act="link-del" data-i="${i}"><title>Click to remove this link</title></path><path class="ln" d="${d}" marker-end="url(#orch-arrow)"/>`;
    }).join("")
    + (tmp ? `<path class="ln tmp" d="${curve(...tmp)}"/>` : "");
}
const htmlText = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.trim(); };
// What the cards linked into `key` say, shaped as a preamble for the next message (fits within `budget` chars).
async function linkedContext(key, budget) {
  const srcs = orchLinks.filter((l) => l.b === key).map((l) => orchPanes.find((p) => paneKey(p) === l.a)).filter(Boolean);
  if (!srcs.length || budget < 300) return "";
  const parts = await Promise.all(srcs.map(async (p) => {
    if (p.kind === "sticky") return p.text?.trim() ? `### Sticky note\n${p.text.trim()}` : "";
    if (p.kind === "note") {
      const txt = p.ctx || htmlText((await api(`/api/note?path=${encodeURIComponent(p.id)}`).catch(() => null))?.html || "");
      return txt ? `### Vault note: ${p.id}\n${txt}` : "";
    }
    if (p.kind !== "task" && p.kind !== "agent") return "";
    const r = await api(p.kind === "task" ? `/api/task?id=${encodeURIComponent(p.id)}` : `/api/agent?key=${encodeURIComponent(p.id)}`).catch(() => null);
    const last = r?.events?.filter((e) => e.t === "text").at(-1)?.txt;
    return last ? `### Latest answer from ${p.kind === "task" ? `task "${String(r.prompt).slice(0, 80)}"` : r.title || r.name}\n${last}` : "";
  }));
  const each = Math.floor((budget - 140) / srcs.length);
  const body = parts.filter(Boolean).map((s) => (s.length > each ? `${s.slice(0, each)}…` : s)).join("\n\n");
  return body ? `Context from cards linked to this one on the Overlook canvas:\n\n${body}\n\n---\n\n` : "";
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
    const wait = f.state === "blocked" || !!f.needs;
    const act = f.state === "working" || f.state === "running";
    items.push({
      kind: "agent", id: f.key, agent: "claude", ic: "agents",
      title: f.title, sub: `Claude Code · ${f.cwd} · ${ago(f.since)}`,
      group: wait ? "waiting" : act ? "active" : "done",
      dot: wait ? "run" : f.state === "done" ? "idle" : "",
      badge: STATE[f.state] || f.state, peach: wait, needs: f.needs || "",
    });
  }
  for (const p of orchPanes) {
    if (p && p.kind === "terminal") {
      items.push({
        kind: "terminal", id: p.id, agent: "terminal", ic: "terminal",
        title: p.title || `Terminal (${p.shell || "bash"})`,
        sub: `${shortCwd(p.cwd || orchCwd || "")} · terminal`,
        group: "active", dot: "run", badge: p.shell || "shell", peach: true, needs: "",
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
        <div class="orch-cluster orch-cluster-nav">
          <button type="button" class="btn glass orch-rail-btn ${orchRail ? "on" : ""}" data-act="orch-rail" title="Toggle Fleet sidebar">${icon("cols", 14)} <span id="orch-rail-lbl">Fleet</span></button>
          <div class="seg orch-mode-seg" role="radiogroup" aria-label="Workspace mode">
            <button type="button" class="${orchMode === "tile" ? "on" : ""}" data-act="orch-mode" data-m="tile" title="Snapped Split &amp; Resizable Grid">${icon("split", 13)} Split</button>
            <button type="button" class="${orchMode === "free" ? "on" : ""}" data-act="orch-mode" data-m="free" title="Free 2D Maestri Canvas (Drag, Resize, Pan &amp; Zoom)">${icon("grid", 13)} Canvas</button>
          </div>
          <button type="button" class="btn glass orch-split-btn ${orchPanes.length > 1 ? "on" : ""}" id="orch-split-btn" data-act="orch-split" title="Toggle 2-pane split view" ${orchMode === "tile" ? "" : "hidden"}>${icon("split", 13)} <span id="orch-split-lbl">${orchPanes.length > 1 ? `Panes (${orchPanes.length})` : "2x"}</span></button>
          <button type="button" class="btn glass" id="orch-dir-btn" data-act="orch-dir" title="Switch Split between Columns and Rows" ${orchMode === "tile" && orchPanes.length === 2 && !orchMax ? "" : "hidden"}>${orchDir === "rows" ? "═ Rows" : "|| Cols"}</button>
          <button type="button" class="btn glass orch-new-btn" data-act="orch-new" title="Add a new Agent Tile to Split / Canvas">${icon("plus", 13)} Tile</button>
        </div>
        <div class="orch-cluster orch-cluster-prompt">
          <textarea id="run-prompt" rows="1" placeholder="${esc(roleRow[2])}" aria-label="Task for the agent"></textarea>
          <div class="orch-ctx-group">
            <select class="pick" id="run-agent" aria-label="Agent">${(S.runners || []).map((r) => `<option value="${esc(r.id)}" ${r.ready ? "" : "disabled"}>${esc(r.name)}${r.ready ? "" : " (not set up)"}</option>`).join("")}</select>
            <input type="hidden" id="run-cwd" value="${esc(orchCwd)}">
            <button type="button" class="btn glass orch-cwd-btn" id="run-cwd-btn" data-act="cwd-open" title="Browse &amp; select any folder on your PC">
              ${icon("folder", 14)} <span id="run-cwd-lbl">${esc(cwdLabel(orchCwd))}</span> ${icon("fold", 12)}
            </button>
          </div>
          <div class="orch-multi" id="run-multi"></div>
        </div>
        <div class="orch-cluster orch-cluster-act">
          <div class="orch-term-split" id="orch-term-split">
            <button type="button" class="btn glass orch-term-main" data-act="term-canvas" title="Open terminal in Canvas">
              ${icon("terminal", 13)} <span class="orch-term-lbl" id="orch-term-lbl">Terminal</span>
            </button>
            <button type="button" class="btn glass orch-term-drop" data-act="term-menu-toggle" aria-haspopup="true" aria-expanded="false" title="Choose terminal emulator or shell">
              ${icon("fold", 11)}
            </button>
          </div>
          <button type="button" class="btn glass orch-more-btn" data-act="orch-deck-toggle" title="Toggle Role presets, Model &amp; Routines">${icon("fold", 13)} Options</button>
          <button class="btn peach" id="run-submit" type="submit" ${ready.length ? "" : "disabled"}>Run ${icon("play", 14)}</button>
        </div>
      </div>
      <div class="orch-presets">
        <div class="orch-roles" role="radiogroup" aria-label="Role preset">
          ${ORCH_ROLES.map(([k, l]) => `<button type="button" class="fchip ${orchRole === k ? "on" : ""}" data-act="orch-role" data-role="${esc(k)}">${esc(l)}</button>`).join("")}
        </div>
        <div class="orch-routines">
          <select class="pick" id="run-model" aria-label="Model" hidden></select>
          <div class="seg" id="run-effort" role="radiogroup" aria-label="Effort" hidden></div>
          ${Object.entries(ROUTINES).map(([k, [name, desc]]) => {
            const r = S.tasks?.find((t) => t.routine === k && !t.end);
            return `<button type="button" class="fchip orch-rt" data-act="routine" data-k="${k}" title="${esc(desc)}" ${r ? "disabled" : ""}>${icon(k === "inbox" ? "inbox" : "target", 13)} ${esc(name)}</button>`;
          }).join("")}
        </div>
      </div>
      ${ready.length ? "" : "<small>No agent is set up yet: see README › Agents.</small>"}
      <div class="cwd-pop glass" id="cwd-pop" hidden></div>
      <div class="term-pop glass" id="term-pop" hidden></div>
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
  orchTimer = setInterval(() => { if (route().pg !== "agents") return clearInterval(orchTimer); orchPaint(); }, 2000);
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
function bindCanvasInteractions(canvas) {
  let isSpacePressed = false;
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.target.closest("input, textarea, select, [contenteditable]") && !isSpacePressed) {
      isSpacePressed = true;
      if (orchMode === "free" && !orchMax) canvas.classList.add("space-pan");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      isSpacePressed = false;
      canvas.classList.remove("space-pan");
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (orchMode !== "free" || orchMax) return;
    const isBg = e.target === canvas || e.target.id === "orch-plane" || e.target.classList?.contains("orch-links") || e.target.tagName === "svg";
    if (!isBg && e.button !== 1 && e.button !== 2) return;

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
    if (orchMode === "free" && !orchMax) e.preventDefault();
  });

  canvas.addEventListener("wheel", (e) => {
    if (orchMode !== "free" || orchMax) return;
    const isBg = e.target === canvas || e.target.id === "orch-plane" || e.target.classList?.contains("orch-links") || e.target.tagName === "svg";
    if (!isBg && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const k = Math.min(2.5, Math.max(0.2, orchZoom * Math.exp(-e.deltaY * 0.002)));
    orchPanX = Math.round(sx - (sx - orchPanX) * (k / orchZoom));
    orchPanY = Math.round(sy - (sy - orchPanY) * (k / orchZoom));
    orchZoom = Math.round(k * 1000) / 1000;
    applyCanvasTransform();
    saveCanvas();
  }, { passive: false });
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
    head.addEventListener("pointerdown", (e) => {
      if (orchMode !== "free" || orchMax || e.target.closest("button, a, select, input")) return;
      e.preventDefault();
      try { head.setPointerCapture(e.pointerId); } catch {}
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
    });
  }
  const oldBare = card.querySelector(".orch-resize:not([data-corner])");
  if (oldBare) oldBare.remove();
  ["nw", "ne", "sw", "se", "n", "s", "e", "w"].forEach((c) => {
    let r = card.querySelector(`.orch-resize.${c}`);
    if (!r) {
      r = document.createElement("div");
      r.className = `orch-resize ${c}`;
      r.dataset.corner = c;
      r.title = c.length === 1 ? "Drag edge to resize" : "Drag corner to resize";
      card.appendChild(r);
    }
    r.addEventListener("pointerdown", (e) => {
      if (orchMode !== "free" || orchMax) return;
      e.preventDefault(); e.stopPropagation();
      try { r.setPointerCapture(e.pointerId); } catch {}
      ensurePaneRect(p);
      const corner = r.dataset.corner || "se";
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
    <div class="orch-item orch-note-item" draggable="true" data-kind="note" data-id="${esc(n.path)}" title="Drag note onto the Canvas">
      <button type="button" class="orch-item-main" data-act="orch-add-note" data-path="${esc(n.path)}">
        <span class="row-av">${icon("notes", 18)}</span>
        <span class="orch-info">
          <b>${esc(n.title)}</b>
          <small>${esc(n.folder || "vault")}${n.tags.length ? ` · ${n.tags.join(", ")}` : ""}</small>
        </span>
        <span class="pill">${esc(n.type || "note")}</span>
      </button>
      <button type="button" class="orch-pin-btn" data-act="orch-add-note" data-path="${esc(n.path)}" title="Add note to workspace">${icon("plus", 13)}</button>
    </div>
  `).join("") || `<p class="empty">No notes match "${esc(orchNoteQ)}".</p>`;
}
function agentsBody() {
  const el = $("#agents-body");
  if (!el) return;
  el.classList.toggle("rail-shut", !orchRail);
  el.classList.toggle("rail-float", orchRail && orchRailMode === "float");
  const all = fleetItems();
  const counts = {
    all: all.length,
    active: all.filter((x) => x.group === "active").length,
    waiting: all.filter((x) => x.group === "waiting").length,
    done: all.filter((x) => x.group === "done").length,
    notes: D.notes.length,
    terminals: all.filter((x) => x.kind === "terminal").length,
  };
  const list = all.filter((x) => orchFilter === "all" || x.group === orchFilter || (orchFilter === "terminals" && x.kind === "terminal"));
  const validKeys = new Set(all.map(paneKey)), notePaths = new Set(D.notes.map((n) => n.path));
  orchPanes = orchPanes.filter((p) => p && (p.kind === "new" || p.kind === "sticky" || p.kind === "terminal" || (p.kind === "note" ? notePaths.has(p.id) : validKeys.has(paneKey(p)))));
  document.querySelector('[data-act="orch-rail"]')?.classList.toggle("on", orchRail);
  if (!orchPanes.length) {
    const first = list[0] || all[0];
    if (first) {
      orchPanes = [ensurePaneRect({ kind: first.kind, id: first.id }, 0)];
    } else {
      const newId = String(++orchSeq);
      orchPanes = [ensurePaneRect({ kind: "new", id: newId, agent: $("#run-agent")?.value || S.runners?.[0]?.id || "agy", role: orchRole, cwd: orchCwd }, 0)];
    }
  }
  orchPanes.forEach(ensurePaneRect);
  if (!orchPanes.some((p) => paneKey(p) === orchActive)) orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
  if (orchMax && !orchPanes.some((p) => paneKey(p) === orchMax)) orchMax = "";
  const rLbl = $("#orch-rail-lbl"), sBtn = $("#orch-split-btn"), sLbl = $("#orch-split-lbl"), dBtn = $("#orch-dir-btn");
  if (rLbl) rLbl.textContent = `Fleet (${counts.all})`;
  if (sBtn) {
    sBtn.classList.toggle("on", orchPanes.length > 1);
    sBtn.hidden = orchMode === "free";
  }
  if (sLbl) sLbl.textContent = orchPanes.length > 1 ? `Panes (${orchPanes.length})` : "2x";
  if (dBtn) {
    dBtn.hidden = !(orchMode === "tile" && orchPanes.length === 2 && !orchMax);
    dBtn.textContent = orchDir === "rows" ? "═ Rows" : "|| Cols";
  }
  document.querySelectorAll("[data-act='orch-mode']").forEach((b) => b.classList.toggle("on", b.dataset.m === orchMode));
  if (!el.querySelector(".orch-canvas")) {
    el.innerHTML = `<div class="orch-fleet-wrap ${orchRailMode === "float" ? "float" : ""}" id="orch-fleet-wrap">
        <button type="button" class="orch-fleet-pill glass" data-act="orch-rail-open" title="Open Fleet sidebar">${icon("cols", 13)} <span>Fleet <small id="orch-fleet-pill-cnt"></small></span></button>
        <aside class="orch-fleet glass ${orchRailMode === "float" ? "floating" : ""}">
          <div class="orch-fleet-head">
            <div class="orch-fleet-title">
              ${icon("cols", 14)} <span>Fleet</span> <span class="pill" id="orch-fleet-badge"></span>
            </div>
            <div class="orch-fleet-acts">
              <button type="button" class="btn glass orch-icon-btn ${orchRailMode === "float" ? "on" : ""}" data-act="orch-rail-mode" title="${orchRailMode === "float" ? "Dock sidebar to side" : "Float sidebar over canvas"}">${icon(orchRailMode === "float" ? "ext" : "split", 12)}</button>
              <button type="button" class="btn glass orch-icon-btn" data-act="orch-rail" title="Hide Fleet sidebar">${icon("x", 12)}</button>
            </div>
          </div>
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
      </div>`;
    bindCanvasInteractions($("#orch-canvas"));
  }
  const fleetBadge = $("#orch-fleet-badge"), fleetPillCnt = $("#orch-fleet-pill-cnt"), pill = el.querySelector(".orch-fleet-pill"), fleetEl = el.querySelector(".orch-fleet"), fleetWrap = $("#orch-fleet-wrap");
  if (fleetBadge) fleetBadge.textContent = counts.all;
  if (fleetPillCnt) fleetPillCnt.textContent = counts.all;
  if (fleetWrap) fleetWrap.classList.toggle("float", orchRailMode === "float");
  if (fleetEl) fleetEl.classList.toggle("floating", orchRailMode === "float");
  const pinnedKeys = new Set(orchPanes.map(paneKey));
  counts.notes = D.notes.length;
  $("#orch-tabs").innerHTML = [["all", "All"], ["active", "Active"], ["waiting", "Wait"], ["done", "Done"], ["notes", "Notes"], ["terminals", "Terminals"]].map(([k, l]) =>
    `<button type="button" class="orch-tab ${orchFilter === k ? "on" : ""}" data-act="orch-tab" data-k="${k}">${l}<small>${counts[k]}</small></button>`).join("");
  if (orchFilter === "terminals") {
    const termItems = all.filter((x) => x.kind === "terminal");
    $("#orch-list").innerHTML = `
      <div class="orch-fleet-quick-act">
        <button type="button" class="btn peach" data-act="term-new-pane">${icon("plus", 13)} New Terminal</button>
      </div>
      ${termItems.map((it) => {
        const k = paneKey(it), isPin = pinnedKeys.has(k), isAct = orchActive === k;
        return `<div class="orch-item ${isAct ? "on" : ""} ${isPin && orchPanes.length > 1 ? "pinned" : ""}" draggable="true" data-kind="${it.kind}" data-id="${esc(it.id)}" title="Drag onto the canvas">
          <button type="button" class="orch-item-main" data-act="orch-sel" data-kind="${it.kind}" data-id="${esc(it.id)}">
            <span class="live ${it.dot}"></span>
            <span class="row-av">${icon("terminal", 18)}</span>
            <span class="orch-info">
              <b>${esc(it.title)}</b>
              <small>${esc(it.sub)}</small>
            </span>
            <span class="pill peach">${esc(it.badge)}</span>
          </button>
          <div class="orch-item-actions">
            <button type="button" class="orch-pin-btn ${isPin && orchPanes.length > 1 ? "on" : ""}" data-act="orch-pin" data-kind="${it.kind}" data-id="${esc(it.id)}" title="${isPin && orchPanes.length > 1 ? "Remove from workspace" : "Add side-by-side to Split / Canvas"}">${icon(isPin && orchPanes.length > 1 ? "x" : "plus", 13)}</button>
            <button type="button" class="orch-dismiss-btn" data-act="term-close-session" data-id="${esc(it.id)}" aria-label="Close terminal" title="Close terminal">${icon("x", 12)}</button>
          </div>
        </div>`;
      }).join("") || '<p class="empty">No active terminals. Click "+ New Terminal" to open one in the canvas.</p>'}`;
  } else if (orchFilter === "notes") {
    if (!$("#orch-nq")) {
      $("#orch-list").innerHTML = `<input id="orch-nq" class="orch-nq" type="search" placeholder="Search the vault… drag a note onto the canvas" autocomplete="off"><div id="orch-notes"></div>`;
      $("#orch-nq").value = orchNoteQ;
      $("#orch-nq").oninput = (e) => { orchNoteQ = e.target.value; paintNoteList(); };
    }
    paintNoteList();
  } else $("#orch-list").innerHTML = list.map((it) => {
    const k = paneKey(it), isPin = pinnedKeys.has(k), isAct = orchActive === k;
    return `<div class="orch-item ${isAct ? "on" : ""} ${isPin && orchPanes.length > 1 ? "pinned" : ""}" draggable="true" data-kind="${it.kind}" data-id="${esc(it.id)}" title="Drag onto the canvas">
      <button type="button" class="orch-item-main" data-act="orch-sel" data-kind="${it.kind}" data-id="${esc(it.id)}">
        <span class="live ${it.dot}"></span>
        <span class="row-av">${avatar(it.agent, it.ic, 20)}</span>
        <span class="orch-info">
          <b>${esc(it.title)}</b>
          <small>${esc(it.sub)}</small>
          ${it.needs ? `<span class="orch-need">${esc(it.needs)}</span>` : ""}
        </span>
        <span class="pill ${it.peach ? "peach" : ""}">${esc(it.badge)}</span>
      </button>
      <div class="orch-item-actions">
        <button type="button" class="orch-pin-btn ${isPin && orchPanes.length > 1 ? "on" : ""}" data-act="orch-pin" data-kind="${it.kind}" data-id="${esc(it.id)}" title="${isPin && orchPanes.length > 1 ? "Remove from workspace" : "Add side-by-side to Split / Canvas"}">${icon(isPin && orchPanes.length > 1 ? "x" : "plus", 13)}</button>
        <button type="button" class="orch-dismiss-btn" data-act="orch-dismiss" data-kind="${it.kind}" data-id="${esc(it.id)}" aria-label="Dismiss chat" title="Dismiss chat">${icon("x", 12)}</button>
      </div>
    </div>`;
  }).join("") || `<p class="empty">No runs in this view.</p>`;
  $("#orch-ledger-sum").innerHTML = `<span>Vault Ledger</span><small>${D.log.length} runs · ${D.findings.length} findings</small>`;
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

async function orchPaint(force) {
  const canvas = $("#orch-canvas"), plane = $("#orch-plane"), hud = $("#orch-hud");
  if (!canvas || !plane) return;
  if (!orchPanes.length) {
    orchSigs.clear();
    canvas.className = "orch-canvas";
    plane.innerHTML = `<div class="orch-empty glass"><p class="empty">Select a session from the Fleet, drag notes from the sidebar, or click <b>+ Tile</b> to launch on Canvas.</p></div>`;
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
  if (hud) {
    hud.hidden = !isFree;
    if (isFree) {
      hud.innerHTML = `<button type="button" class="fchip ${orchTool === "select" ? "on" : ""}" data-act="orch-tool" data-tool="select" title="Selection tool (S) · Drag to select multiple">${icon("select", 12)} Select</button>
        <button type="button" class="fchip ${orchTool === "pan" ? "on" : ""}" data-act="orch-tool" data-tool="pan" title="Hand tool (H / Space) · Drag to pan">${icon("hand", 12)} Pan</button>
        <span class="orch-hud-sep"></span>
        <button type="button" class="fchip" data-act="orch-new" title="Open a new Agent Tile">${icon("plus", 12)} Agent</button>
        <button type="button" class="fchip" data-act="orch-add-sticky" title="Add a Sticky Note to Canvas">${icon("spark", 12)} Sticky</button>
        <button type="button" class="fchip" data-act="orch-tab" data-k="notes" title="Open Vault Notes list">${icon("notes", 12)} Notes</button>
        <button type="button" class="fchip" data-act="term-canvas" title="Open terminal in Canvas">${icon("terminal", 12)} Terminal</button>
        <button type="button" class="fchip" data-act="orch-arrange" title="Auto-tile floating windows">Arrange</button>
        <button type="button" class="fchip" data-act="orch-fit" title="Fit all windows in view">Fit</button>
        <span class="orch-hud-sep"></span>
        <button type="button" class="fchip" data-act="orch-zoom" data-d="-0.15" title="Zoom out">−</button>
        <button type="button" class="fchip" data-act="orch-zoom" data-d="0" id="orch-zoom-lbl" title="Reset zoom (100%)">${Math.round(orchZoom * 100)}%</button>
        <button type="button" class="fchip" data-act="orch-zoom" data-d="0.15" title="Zoom in">+</button>
        <span class="pill peach" id="orch-sel-cnt" ${orchSelected.size ? "" : "hidden"}>${orchSelected.size} selected</span>
        <button type="button" class="fchip danger" data-act="orch-del-sel" id="orch-del-sel" title="Delete selected cards (${orchSelected.size})" ${orchSelected.size ? "" : "hidden"}>${icon("trash", 12)}</button>`;
    }
  }
  await Promise.all(vis.map(async (p, idx) => {
    const key = paneKey(p);
    ensurePaneRect(p, idx);
    let card = plane.querySelector(`.orch-pane[data-key="${CSS.escape(key)}"]`);
    if (!card) {
      card = document.createElement("section");
      card.className = "orch-pane glass";
      card.dataset.key = key;
      card.dataset.kind = p.kind;
      card.innerHTML = `<div class="orch-head"></div>
        <div class="feed list orch-feed"><p class="empty">Loading…</p></div>
        <div class="orch-needs"></div>
        <form class="talk orch-talk">
          <textarea class="orch-msg" rows="1" placeholder="Reply or send follow-up… Enter sends, Shift+Enter adds a line" aria-label="Follow-up message"></textarea>
          <button class="btn peach" type="submit">Send ${icon("r", 14)}</button>
        </form>
        <div class="orch-resize nw" data-corner="nw" title="Drag corner to resize"></div>
        <div class="orch-resize ne" data-corner="ne" title="Drag corner to resize"></div>
        <div class="orch-resize sw" data-corner="sw" title="Drag corner to resize"></div>
        <div class="orch-resize se" data-corner="se" title="Drag corner to resize"></div>
        <div class="orch-port" title="Drag to connect to another card (provides context)">●</div>`;
      card.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button, a, select, input, textarea, .orch-resize, .orch-port")) return;
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
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
      const head = card.querySelector(".orch-head");
      head.addEventListener("dblclick", (e) => {
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
    card.classList.toggle("selected", orchSelected.has(key));
    card.dataset.kind = p.kind;
    if (isFree) {
      card.style.left = `${p.x}px`; card.style.top = `${p.y}px`;
      card.style.width = `${p.w}px`; card.style.height = `${p.h}px`;
    } else {
      card.style.left = card.style.top = card.style.width = card.style.height = "";
    }
    const inCount = linkCount(key), outCount = orchLinks.filter((l) => l.a === key).length;
    const linkBadge = inCount || outCount
      ? `<span class="pill peach" title="${inCount ? `Receiving context from ${inCount} card(s). ` : ""}${outCount ? `Providing context to ${outCount} card(s).` : ""}">🔗 ${inCount ? `in:${inCount} ` : ""}${outCount ? `out:${outCount}` : ""}</span>`
      : "";
    const paneBtns = `${linkBadge}
      ${!isFree && orchPanes.length > 1 && idx > 0 ? `<button type="button" class="btn glass orch-icon-btn" data-act="orch-swap" data-key="${esc(key)}" title="Move pane first">⇄</button>` : ""}
      ${orchPanes.length > 1 || isFree ? `<button type="button" class="btn glass orch-icon-btn ${orchMax === key ? "on" : ""}" data-act="orch-max" data-key="${esc(key)}" title="${orchMax === key ? "Restore Split / Canvas" : "Maximize pane"}">${icon("max", 13)}</button>` : ""}
      ${orchPanes.length > 1 || isFree ? `<button type="button" class="btn glass orch-icon-btn" data-act="orch-unpin" data-key="${esc(key)}" title="Close pane">${icon("x", 13)}</button>` : ""}`;
    const form = card.querySelector(".orch-talk");
    if (form) form.style.display = (p.kind === "note" || p.kind === "sticky" || p.kind === "terminal") ? "none" : "";
    if (p.kind === "note") {
      const n = await api(`/api/note?path=${encodeURIComponent(p.id)}`).catch(() => null);
      if (!n || !card.isConnected) return;
      const sig = `note|${n.path}|${n.mtime}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig) return;
      orchSigs.set(key, sig);
      p.ctx = htmlText(n.html);
      card.querySelector(".orch-head").innerHTML = `<div class="orch-title"><span class="h-av">${icon("notes", 18)}</span>
          <div><h4>${esc(n.title)}</h4><small>📁 ${esc(n.folder || "vault")}${n.tags?.length ? ` · ${n.tags.join(", ")}` : ""}</small></div></div>
        <div class="orch-acts">
          <a class="btn glass orch-icon-btn" href="#/n/${encodeURIComponent(n.path)}" title="Open in Note reader">${icon("ext", 13)}</a>
          <a class="btn glass orch-icon-btn" href="${obs(n.path)}" title="Open in Obsidian app">${icon("bolt", 13)}</a>
          ${paneBtns}</div>`;
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
      card.querySelector(".orch-head").innerHTML = `<div class="orch-title"><span class="h-av">${icon("spark", 18)}</span>
          <div><h4>Sticky Note</h4><small>Drag ● port to wire into an agent</small></div></div>
        <div class="orch-acts">${paneBtns}</div>`;
      card.querySelector(".orch-needs").innerHTML = "";
      const feed = card.querySelector(".orch-feed");
      let ta = feed.querySelector(".orch-sticky-input");
      if (!ta) {
        feed.innerHTML = `<div class="orch-sticky-wrap"><textarea class="orch-sticky-input" placeholder="Type prompt context or notes here… When wired to an agent card, this text is provided as grounding context!">${esc(p.text || "")}</textarea></div>`;
        ta = feed.querySelector(".orch-sticky-input");
        ta.oninput = () => { p.text = ta.value; saveCanvas(); };
      } else if (document.activeElement !== ta) {
        ta.value = p.text || "";
      }
      if (form) form.style.display = "none";
      return;
    }
    if (p.kind === "terminal") {
      p.w ??= 640; p.h ??= 420;
      const sig = `terminal|${p.id}|${p.shell}|${p.cwd}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig && card.querySelector(".orch-term-view")) return;
      orchSigs.set(key, sig);
      const cwd = p.cwd || orchCwd || "";
      const shellName = p.shell || prefShell || "bash";
      card.querySelector(".orch-head").innerHTML = `<div class="orch-title"><span class="h-av">${icon("terminal", 18)}</span>
          <div>
            <div class="orch-term-head-row">
              <h4>${esc(p.title || `Terminal (${shellName})`)}</h4>
              <span class="pill peach">${esc(shellName)}</span>
            </div>
            <small class="orch-term-cwd" title="${esc(cwd)}">📁 <code>${esc(cwdLabel(cwd))}</code></small>
          </div>
        </div>
        <div class="orch-acts">
          <button type="button" class="btn glass orch-icon-btn" data-act="term-clear" data-key="${esc(key)}" title="Clear screen">${icon("trash", 12)}</button>
          <button type="button" class="btn glass orch-icon-btn" data-act="term-restart" data-key="${esc(key)}" title="Restart shell">${icon("reload", 12)}</button>
          ${paneBtns}
        </div>`;
      card.querySelector(".orch-needs").innerHTML = "";
      if (form) form.style.display = "none";
      mountTerminalPane(card, p);
      return;
    }
    if (p.kind === "new") {
      const sig = `new|${p.agent}|${p.cwd}|${p.role}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig) return;
      orchSigs.set(key, sig);
      const pAgent = p.agent || $("#run-agent")?.value || "agy";
      const pCwd = p.cwd ?? orchCwd;
      const pRole = p.role ?? orchRole;
      card.querySelector(".orch-head").innerHTML = `<div class="orch-title"><span class="h-av">${avatar(pAgent, "spark", 22)}</span>
          <div><h4>New Agent Tile</h4><small>Pick folder, agent &amp; role or open a recent session in this tile</small></div></div>
        <div class="orch-acts">${paneBtns}</div>`;
      card.querySelector(".orch-needs").innerHTML = "";
      card.querySelector(".orch-msg").placeholder = "Describe the task to launch in this tile… Enter dispatches";
      card.querySelector(".orch-feed").innerHTML = `<div class="orch-new-box">
        <div class="orch-new-row">
          <label>Agent</label>
          <div class="orch-roles">${(S.runners || []).filter((r) => r.ready).map((r) =>
            `<button type="button" class="fchip ${pAgent === r.id ? "on" : ""}" data-act="pane-agent" data-key="${esc(key)}" data-v="${esc(r.id)}">${esc(r.name)}</button>`).join("")}</div>
        </div>
        <div class="orch-new-row">
          <label>Workspace Folder (PC)</label>
          <button type="button" class="btn glass orch-cwd-btn" data-act="cwd-open" data-pane="${esc(key)}">
            ${icon("folder", 14)} <span>${esc(cwdLabel(pCwd))}</span> ${icon("fold", 12)}
          </button>
        </div>
        <div class="orch-new-row">
          <label>Role Preset</label>
          <div class="orch-roles">${ORCH_ROLES.map(([k, l]) =>
            `<button type="button" class="fchip ${pRole === k ? "on" : ""}" data-act="pane-role" data-key="${esc(key)}" data-v="${esc(k)}">${esc(l)}</button>`).join("")}</div>
        </div>
        <div class="orch-new-row">
          <label>Or pick an existing session into this tile</label>
          <div class="orch-new-list">${fleetItems().slice(0, 5).map((it) =>
            `<button type="button" class="orch-item-mini" data-act="pane-load" data-key="${esc(key)}" data-kind="${it.kind}" data-id="${esc(it.id)}">
              <span class="live ${it.dot}"></span><b>${esc(it.title)}</b><small>${esc(it.sub)}</small>
            </button>`).join("")}</div>
        </div>
      </div>`;
      return;
    }
    if (p.kind === "task") {
      const t = await api(`/api/task?id=${encodeURIComponent(p.id)}`).catch(() => null);
      if (!t || !card.isConnected) return;
      const qInfo = detectQuota(t);
      const qSig = qInfo ? `${qInfo.exhausted}|${qInfo.model}|${qInfo.resetsIn}` : "";
      const sig = `${t.end}|${t.ok}|${t.events.length}|${t.events.at(-1)?.txt?.length || 0}|${qSig}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig) return;
      orchSigs.set(key, sig);
      const folder = t.cwd ? shortCwd(t.cwd) : "";
      card.querySelector(".orch-head").innerHTML = `<div class="orch-title"><span class="h-av">${avatar(t.agent, "agents", 22)}</span>
          <div><h4>${esc(t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : t.prompt)}</h4>
          <small>${esc([taskMeta(t), folder ? `📁 ${folder}` : "", t.role ? `Role: ${t.role.split(":")[0]}` : "", `started ${ago(Date.parse(t.start))}`].filter(Boolean).join(" · "))}</small></div></div>
        <div class="orch-acts"><span class="live ${liveClass(t)}"></span><small class="orch-status-txt">${taskStatus(t)}</small>
          ${t.end ? "" : `<button class="btn glass" data-act="stop" data-id="${esc(t.id)}">Stop</button>`}
          ${openButtons(S.runners?.find((r) => r.id === t.agent), `data-task="${esc(t.id)}"`, !!t.session)}
          <a class="btn glass orch-icon-btn" href="#/t/${esc(t.id)}" title="Open dedicated page">${icon("ext", 13)}</a>
          ${paneBtns}</div>`;
      card.querySelector(".orch-needs").innerHTML = renderQuotaBanner(t, key);
      card.querySelector(".orch-msg").placeholder = !t.end ? "Running — wait or Stop to send a follow-up…" : "Send a follow-up in this workspace… Enter sends";
      const feed = card.querySelector(".orch-feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
      feed.innerHTML = renderEvents(t.events, runnerName(t.agent)) || `<p class="empty">Waiting for output…</p>`;
      if (atEnd) feed.scrollTop = feed.scrollHeight;
    } else {
      const a = await api(`/api/agent?key=${encodeURIComponent(p.id)}`).catch(() => null);
      if (!a || !card.isConnected) return;
      const sig = `${a.live}|${a.state}|${a.events.length}|${a.events.at(-1)?.txt?.length || 0}|${orchPanes.length}|${orchMax}|${isFree}|${inCount}|${outCount}`;
      if (!force && orchSigs.get(key) === sig) return;
      orchSigs.set(key, sig);
      const name = a.title || AGENT_NAME[a.name]?.[0] || a.name;
      card.querySelector(".orch-head").innerHTML = `<div class="orch-title"><span class="h-av">${avatar(a.name, "agents", 22)}</span>
          <div><h4>${esc(name)}</h4><small>${esc(AGENT_NAME[a.name]?.[0] || a.name)} · 📁 ${esc(a.cwd)}${a.seconds ? ` · ${duration(a.seconds)}` : ""}</small></div></div>
        <div class="orch-acts"><span class="live ${a.live ? "" : a.state === "blocked" ? "run" : "idle"}"></span>
          ${openButtons(S.runners?.find((r) => r.process === a.name), `data-key="${esc(p.id)}"`, true)}
          <a class="btn glass orch-icon-btn" href="#/a/${esc(p.id)}" title="Open dedicated page">${icon("ext", 13)}</a>
          ${paneBtns}</div>`;
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
    if (p.kind === "new") {
      const agent = p.agent || $("#run-agent")?.value || "agy";
      const cwd = (p.cwd ?? orchCwd) || undefined, role = (p.role ?? orchRole) || undefined;
      const r = await api("/api/run", { agent, prompt: fullText, cwd, role });
      t.value = ""; toast("Task started in tile");
      orchSigs.delete(oldKey);
      p.kind = "task"; p.id = r.id;
      rekey(oldKey, paneKey(p));
      card.dataset.key = paneKey(p);
      if (orchActive === oldKey) orchActive = paneKey(p);
      if (orchMax === oldKey) orchMax = paneKey(p);
      saveCanvas();
      S = await api("/api/system"); agentsBody(); orchPaint(true);
    } else if (p.kind === "task") {
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
    if (!t) { main.innerHTML = `<div class="ph"><h1>Task not found</h1><p>Tasks live in memory and are gone after a restart.</p></div><a class="btn glass" href="#/agents">Back to Agents</a>`; return clearInterval(taskTimer); }
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
function services() {
  main.innerHTML = `<div class="ph"><h1>Services</h1><p>Your local apps and Pinterest. Listed in <code>services.json</code>.</p><div class="r"><a class="btn glass" href="#/images">Manage images</a></div></div>
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
      return `<div class="ag glass"><div class="hd"><span class="ic">${icon(s.icon || "services")}</span>
          <div><h4>${esc(s.name)}</h4><small>${esc(s.desc)}</small></div><span class="live ${s.ok ? "" : "off"}" style="margin-left:auto"></span></div>
        <div class="ft"><span class="pill">${esc(new URL(address(s) || s.url).host)}</span><span class="pill">${s.ok ? `${s.ms} ms` : "down"}</span>
          <span style="margin-left:auto;display:flex;gap:6px">${s.ok && address(s) && !s.internal ? `<a class="btn glass" href="#/s/${esc(s.id)}">View here</a>` : ""}
          <a class="btn peach" href="${esc(remote ? address(s) || "#/services" : s.url)}" target="_blank">Open ${icon("ext", 14)}</a></span></div></div>`;
    }).join("") || '<p class="empty">No services yet. Copy <code>services.example.json</code> to <code>services.json</code>.</p>'}</div>`;
  ambient(art("services"));
}

// ---------------------------------------------------------------- Embedded service
function service(id) {
  const s = S.services.find((x) => x.id === id);
  if (!s) { main.innerHTML = '<p class="empty">Service not found in services.json.</p>'; return; }
  const src = address(s), tab = remote ? src : s.url;
  $("#svcbar").innerHTML = `<span class="live ${s.ok ? "" : "off"}"></span><span class="pill">${esc(new URL(src || s.url).host)}${s.ok ? ` · ${s.ms} ms` : " · down"}</span>
    <button class="btn glass" data-act="reload" aria-label="Reload" data-tip="Reload">${icon("reload", 15)}</button>
    <a class="btn glass" href="${esc(tab)}" target="_blank" aria-label="Open in a tab">${icon("ext", 15)}</a>`;
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
      <div class="task-bar"><small>Each service has <code>id</code>, <code>name</code>, <code>url</code> and <code>desc</code> (plus optional <code>icon</code>, <code>dock</code>, <code>width</code>, <code>max</code>, <code>proxy</code>, <code>tailnet</code>).</small>
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
const PAGES = { "": [home, "Home"], notes: [notes, "Notes"], n: [reader, "Note"], w: [wiki, "Note"], review: [review, "Review"], graph: [graph, "Graph"], agents: [agents, "Agents"], services: [services, "Services"], images: [imagesPage, "Images"], settings: [settingsPage, "Settings"], s: [service, "Service"], a: [agentPage, "Agent"], t: [taskPage, "Task"] };
function route() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGES[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  if (cwdOpen) { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); }
  if (document.activeElement?.closest?.("#dockwrap")) document.activeElement.blur(); // a floating dock folds after you pick a page
  graphStop?.(); graphStop = null; clearInterval(orchTimer);
  const { pg, arg } = route();
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
  "orch-rail": (el) => {
    if (el?.closest?.(".orch-fleet-wrap.float")) {
      $("#orch-fleet-wrap")?.classList.remove("open");
      return;
    }
    orchRail = !orchRail;
    document.querySelectorAll('[data-act="orch-rail"]').forEach((b) => b.classList.toggle("on", orchRail));
    $("#agents-body")?.classList.toggle("rail-shut", !orchRail);
    $("#agents-body")?.classList.toggle("rail-float", orchRail && orchRailMode === "float");
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
      btn.classList.toggle("on", orchRailMode === "float");
      btn.title = orchRailMode === "float" ? "Dock sidebar to side" : "Float sidebar over canvas";
      btn.innerHTML = icon(orchRailMode === "float" ? "ext" : "split", 12);
    }
    toast(orchRailMode === "float" ? "Fleet sidebar is now floating" : "Fleet sidebar is now docked");
  },
  "orch-deck-toggle": (el) => {
    orchDeckOpen = !orchDeckOpen;
    $("#run")?.classList.toggle("open", orchDeckOpen);
    document.querySelectorAll('[data-act="orch-deck-toggle"]').forEach((b) => b.classList.toggle("on", orchDeckOpen));
    if (!orchDeckOpen && el) el.blur();
  },
  "term-quick": async (el) => {
    const cwd = el?.dataset?.cwd || $("#run-cwd")?.value || orchCwd;
    try {
      const res = await api("/api/terminal/open", { terminal: prefTerm || undefined, shell: prefShell || undefined, cwd });
      toast(res.fallback ? `${res.terminal} (fallback) opened in ${cwdLabel(res.cwd)}` : `${res.terminal} opened in ${cwdLabel(res.cwd)}`);
    } catch (e) {
      toast(e.message);
    }
  },
  "term-canvas": (el) => {
    const cwd = el?.dataset?.cwd || $("#run-cwd")?.value || orchCwd || "";
    const shell = prefShell || (shellList[0]?.id || "bash");
    const termId = `term_${Date.now()}`;
    const p = { kind: "terminal", id: termId, shell, cwd, title: `Terminal (${shell})` };
    addPane(p);
    saveCanvas();
    toast(`Terminal (${shell}) opened in Canvas`);
  },
  "term-canvas-pop": () => {
    termPopOpen = false;
    paintTermPop();
    const cwd = $("#run-cwd")?.value || orchCwd || "";
    const shell = prefShell || (shellList[0]?.id || "bash");
    const termId = `term_${Date.now()}`;
    const p = { kind: "terminal", id: termId, shell, cwd, title: `Terminal (${shell})` };
    addPane(p);
    saveCanvas();
    toast(`Terminal (${shell}) opened in Canvas`);
  },
  "term-new-pane": () => {
    const cwd = $("#run-cwd")?.value || orchCwd || "";
    const shell = prefShell || (shellList[0]?.id || "bash");
    const termId = `term_${Date.now()}`;
    const p = { kind: "terminal", id: termId, shell, cwd, title: `Terminal (${shell})` };
    addPane(p);
    saveCanvas();
    toast(`New Terminal (${shell}) created in Canvas`);
  },
  "term-clear": (el) => {
    const key = el.dataset.key;
    const p = orchPanes.find((x) => paneKey(x) === key);
    if (p) clearTerminal(p.id);
  },
  "term-restart": (el) => {
    const key = el.dataset.key;
    const p = orchPanes.find((x) => paneKey(x) === key);
    if (p) {
      clearTerminal(p.id);
      api("/api/terminal/session/create", { id: p.id, shell: p.shell, cwd: p.cwd }).catch(() => {});
      toast(`Terminal (${p.shell}) restarted`);
    }
  },
  "term-interrupt": (el) => {
    const key = el.dataset.key;
    const p = orchPanes.find((x) => paneKey(x) === key);
    if (p) interruptTerminal(p.id);
  },
  "term-close-session": async (el) => {
    const id = el.dataset.id;
    orchPanes = orchPanes.filter((p) => !(p.kind === "terminal" && p.id === id));
    saveCanvas();
    await api("/api/terminal/session/close", { id }).catch(() => {});
    agentsBody();
    orchPaint(true);
    toast("Terminal closed");
  },
  "term-menu-toggle": () => {
    termPopOpen = !termPopOpen;
    paintTermPop();
  },
  "term-menu-close": () => {
    termPopOpen = false;
    paintTermPop();
  },
  "term-pick-emu": (el) => {
    prefTerm = el.dataset.id;
    try { localStorage.setItem("overlook.terminal", prefTerm); } catch {}
    const cur = termList.find((t) => t.id === prefTerm);
    const lbl = $("#orch-term-lbl");
    if (lbl) lbl.textContent = cur?.name || "Terminal";
    paintTermPop();
  },
  "term-pick-shell": (el) => {
    prefShell = el.dataset.id;
    try { localStorage.setItem("overlook.shell", prefShell); } catch {}
    paintTermPop();
  },
  "term-launch": async () => {
    termPopOpen = false;
    paintTermPop();
    const cwd = $("#run-cwd")?.value || orchCwd;
    try {
      const res = await api("/api/terminal/open", { terminal: prefTerm || undefined, shell: prefShell || undefined, cwd });
      toast(res.fallback ? `${res.terminal} (fallback) opened in ${cwdLabel(res.cwd)}` : `${res.terminal} opened in ${cwdLabel(res.cwd)}`);
    } catch (e) {
      toast(e.message);
    }
  },
  "orch-mode": (el) => {
    orchMode = (el.dataset.m || el.dataset.mode) === "free" ? "free" : "tile";
    orchMax = "";
    document.querySelectorAll('[data-act="orch-mode"]').forEach((b) => b.classList.toggle("on", (b.dataset.m || b.dataset.mode) === orchMode));
    if (orchMode === "free") orchPanes.forEach(ensurePaneRect);
    orchSigs.clear();
    agentsBody();
    if (orchMode === "free" && orchPanX === 24 && orchPanY === 20 && orchZoom === 1) fitCanvasView();
  },
  "orch-new": () => {
    orchMax = "";
    if (orchPanes.length >= (orchMode === "free" ? 18 : 6)) orchPanes.shift();
    const id = String(++orchSeq);
    const p = { kind: "new", id, agent: $("#run-agent")?.value || S.runners?.[0]?.id || "agy", role: orchRole, cwd: orchCwd };
    if (orchMode === "free") ensurePaneRect(p, orchPanes.length);
    orchPanes.push(p);
    orchActive = paneKey(p);
    orchSigs.clear();
    agentsBody();
  },
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
  "pane-agent": (el) => {
    const p = orchPanes.find((x) => paneKey(x) === el.dataset.key);
    if (!p) return;
    p.agent = el.dataset.v || el.dataset.agent;
    orchSigs.delete(el.dataset.key);
    orchPaint(true);
  },
  "pane-role": (el) => {
    const p = orchPanes.find((x) => paneKey(x) === el.dataset.key);
    if (!p) return;
    p.role = el.dataset.v ?? el.dataset.role ?? "";
    orchSigs.delete(el.dataset.key);
    orchPaint(true);
  },
  "pane-load": (el) => {
    const idx = orchPanes.findIndex((x) => paneKey(x) === el.dataset.key);
    if (idx < 0) return;
    const prev = orchPanes[idx];
    const next = { kind: el.dataset.kind, id: el.dataset.id, x: prev.x, y: prev.y, w: prev.w, h: prev.h };
    orchPanes[idx] = next;
    orchActive = paneKey(next);
    rekey(paneKey(prev), paneKey(next));
    saveCanvas();
    orchSigs.clear();
    agentsBody();
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
  "orch-split": () => {
    orchMax = "";
    if (orchPanes.length > 1) {
      const act = orchPanes.find((p) => paneKey(p) === orchActive) || orchPanes[0];
      orchPanes = act ? [act] : [];
    } else {
      const all = fleetItems().filter((x) => orchFilter === "all" || x.group === orchFilter);
      const cur = orchPanes[0] ? paneKey(orchPanes[0]) : "";
      const next = all.find((x) => paneKey(x) !== cur) || fleetItems().find((x) => paneKey(x) !== cur);
      if (next) orchPanes = [...orchPanes, { kind: next.kind, id: next.id }];
      else {
        const id = String(++orchSeq);
        orchPanes = [...orchPanes, { kind: "new", id, agent: $("#run-agent")?.value || S.runners?.[0]?.id || "agy", role: orchRole, cwd: orchCwd }];
      }
    }
    orchSigs.clear();
    agentsBody();
  },
  "orch-tab": (el) => { orchFilter = el.dataset.k; agentsBody(); },
  "orch-sel": (el) => {
    const item = { kind: el.dataset.kind, id: el.dataset.id }, k = paneKey(item);
    if (orchPanes.some((p) => paneKey(p) === k)) {
      orchActive = k;
      if (orchMax) orchMax = k;
    } else if (orchPanes.length <= 1) {
      orchPanes = [item]; orchActive = k; orchMax = "";
    } else {
      const idx = orchPanes.findIndex((p) => paneKey(p) === orchActive);
      const prev = orchPanes[idx >= 0 ? idx : 0];
      if (prev && typeof prev.x === "number") Object.assign(item, { x: prev.x, y: prev.y, w: prev.w, h: prev.h });
      if (idx >= 0) orchPanes[idx] = item; else orchPanes[0] = item;
      orchActive = k;
      if (orchMax) orchMax = k;
    }
    orchSigs.clear();
    agentsBody();
  },
  "orch-pin": (el) => {
    const item = { kind: el.dataset.kind, id: el.dataset.id }, k = paneKey(item);
    orchMax = "";
    if (orchPanes.some((p) => paneKey(p) === k)) {
      if (orchPanes.length > 1) {
        orchPanes = orchPanes.filter((p) => paneKey(p) !== k);
        if (orchActive === k) orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
      }
    } else {
      if (orchPanes.length >= (orchMode === "free" ? 18 : 6)) orchPanes.shift();
      if (orchMode === "free") ensurePaneRect(item, orchPanes.length);
      orchPanes.push(item);
      orchActive = k;
    }
    orchSigs.clear();
    agentsBody();
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
    orchMax = "";
    orchPanes = orchPanes.filter((p) => paneKey(p) !== k);
    if (orchActive === k) orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
    saveCanvas();
    orchSigs.clear();
    agentsBody();
  },
  "orch-dismiss": async (el) => {
    const kind = el.dataset.kind, id = el.dataset.id;
    if (!kind || !id) return;
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
      if (orchPanes.length === 0) {
        const next = fleetItems().find((x) => paneKey(x) !== targetKey);
        if (next) {
          const item = { kind: next.kind, id: next.id };
          if (orchMode === "free") ensurePaneRect(item, 0);
          orchPanes = [item];
          orchActive = paneKey(next);
        } else {
          const newId = String(++orchSeq);
          const item = { kind: "new", id: newId, agent: $("#run-agent")?.value || S.runners?.[0]?.id || "agy", role: orchRole, cwd: orchCwd };
          if (orchMode === "free") ensurePaneRect(item, 0);
          orchPanes = [item];
          orchActive = `new:${newId}`;
        }
      } else if (orchActive === targetKey) {
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
  if (termPopOpen && !e.target.closest("#term-pop") && !e.target.closest("#orch-term-split")) {
    termPopOpen = false; paintTermPop();
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
  if (e.key === "Escape" && cwdOpen) { cwdOpen = false; cwdPaneKey = ""; paintCwdPop(); return; }
  if (e.key === "Escape" && calDay && !document.querySelector("dialog[open]")) { calDay = ""; calRender(); return; }
  if (e.key === "Escape" && orchSelected.size > 0 && route().pg === "agents") {
    orchSelected.clear();
    updateSelectionUI();
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && orchSelected.size > 0 && route().pg === "agents" && orchMode === "free" && !orchMax) {
    if (!e.target.closest("input, textarea, select, [contenteditable]")) {
      e.preventDefault();
      deleteSelectedPanes();
      return;
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches("input, textarea, select") || document.querySelector("dialog[open]")) return;
  const { pg } = route();
  if (pg === "agents" && orchMode === "free" && !orchMax) {
    if (e.key === "h") { e.preventDefault(); ACTIONS["orch-tool"]({ dataset: { tool: "pan" } }); return; }
    if (e.key === "s") { e.preventDefault(); ACTIONS["orch-tool"]({ dataset: { tool: "select" } }); return; }
  }
  if (e.key === "c" || e.key === "C") { e.preventDefault(); ACTIONS.capture(); }
  if (e.key === "v" || e.key === "V") { e.preventDefault(); ACTIONS["ui-toggle"](); }
  if (e.key === "/" && pg === "notes") { e.preventDefault(); $("#search").focus(); }
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
  else if (pg === "agents" && !cwdOpen && !document.activeElement?.closest?.(".orch-new-box, .orch-talk, .orch-sticky-wrap")) agentsBody();
  else if (pg === "services") services();
}, 10000);
setInterval(async () => { await vault(); topBar(); if (!route().pg) tiles(); }, 60000);
addEventListener("focus", async () => { await vault(); topBar(); const { pg } = route(); if (!pg) home(); else if (pg === "notes") grid(); });
setInterval(clock, 1000);
clock();
Promise.all([vault(), system()]).then(render);
