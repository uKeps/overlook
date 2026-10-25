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
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5-6"/>',
};
const icon = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || I.services}</svg>`;

async function api(p, body) {
  const r = await fetch(p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600);
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
  const item = (id, name, ic, badge = 0) => `<a href="#/${id}" class="${pg === id || (id === "" && !pg) || (pg === "s" && id === `s/${arg}`) || (pg === "images" && id === "services") ? "on" : ""}" data-tip="${name}" aria-label="${name}">${icon(ic, 22)}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  $("#dock").innerHTML = item("", "Home", "home") + '<span class="sep"></span>' +
    item("notes", "Notes", "notes") + item("review", "Review", "review", due().length) + item("graph", "Graph", "graph") +
    item("agents", "Agents", "agents", run) + item("services", "Services", "services", S.services.filter((s) => !s.ok).length) +
    (S.services.some((s) => s.dock) ? '<span class="sep app"></span>' + S.services.filter((s) => s.dock).map((s) => item(`s/${s.id}`, s.name, s.icon || "services").replace("<a ", '<a data-app ')).join("") : "") +
    `<span class="sep"></span><button class="spark" data-act="capture" data-tip="Capture (C)" aria-label="Capture">${icon("spark", 22)}</button>`;
}

// ---------------------------------------------------------------- Calendar: the week strip at the top, or a floating pill
// Items come from Calendar.md (D.calendar) and schedule.json (S.schedule); reviews and daily notes add their own dots.
// Pinned sits under the top bar; floating shrinks to a pill that opens on hover. The choice is per browser.
const CAL_KEY = "overlook.calendar";
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
  "cal-pin": () => { calMode = calMode === "float" ? "pinned" : "float"; try { localStorage.setItem(CAL_KEY, calMode); } catch {} calRender(); },
  "cal-open": () => { calDay = calDay || D.today; calRender(); },
  "cal-kind": (el) => { calKind = el.dataset.k; calFormRender(); },
  "cal-del": async (el) => { await api("/api/calendar/delete", { date: el.dataset.date, time: el.dataset.time, title: el.dataset.title }).catch((e) => toast(e.message)); D = await api("/api"); calRender(); },
  "sched-del": async (el) => { await api("/api/schedule/delete", { id: el.dataset.id }).catch((e) => toast(e.message)); S = await api("/api/system"); calRender(); },
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
  return s.length ? s : [{ cat: "All caught up", ic: "leaf", title: "Nothing needs attention right now", sub: "Capture an idea or open an old note.", meta: [], href: "#/notes", action: "See notes" }];
}

let idx = 0, SG = [];
function home() {
  SG = suggestions();
  idx = Math.min(idx, SG.length - 1);
  const card = (s, i) => {
    const p = pinFor(i);
    return `<article class="card" data-i="${i}" style="background-image:url('${art(i)}?amb')">
      <div class="card-main">
        <div class="card-top"><span class="tag glass">${icon(s.ic, 16)} ${esc(s.cat)}</span><span class="card-idx">${i + 1} / ${SG.length}</span></div>
        <div class="body">
          <p class="sub">${esc(s.sub)}</p>
          ${s.meta.length ? `<div class="meta">${s.meta.map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join("")}</div>` : ""}
          <h2 class="${s.title.length > 44 ? "long" : ""}">${emLinks(s.raw || s.title)}</h2>
        </div>
        <div class="card-foot"><a class="btn peach go" href="${esc(s.href)}">${esc(s.action)} ${icon("r", 16)}</a></div>
      </div>
      <div class="card-pin"><img src="${art(i)}" alt="">${p?.link ? `<a class="pin-link" href="${esc(p.link)}" target="_blank">pinterest ↗</a>` : ""}
        ${D.pins?.length ? `<button type="button" class="pin-pick" data-act="pick-open" data-i="${i}" aria-label="Choose this card's image">${icon("image", 15)} ${D.pinCards?.[cardKey(s)] ? "Chosen" : "Choose image"}</button>` : ""}</div>
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
  if (SG[idx]) ambient(art(idx));
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
  if (!n) { main.innerHTML = `<p class="empty">Note not found.</p>`; return; }
  main.innerHTML = `<div class="reader">
    <article class="art glass">
      <div class="in"><h1>${esc(n.title)}</h1>
        <div class="chips">${[n.type, n.area, ...n.tags].filter(Boolean).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
        <div class="prose" id="prose">${n.html}</div></div></article>
    <aside class="rail">
      <div class="box glass">
        <a class="btn peach" href="${obs(n.path)}">Open in Obsidian ${icon("ext", 16)}</a>
        ${n.review_on ? `<p class="empty" style="padding:10px 0 0">In the cycle: review ${n.review_on <= D.today ? "today" : rel.format(daysBetween(D.today, n.review_on), "day")}, interval ${n.interval} d.</p>`
          : `<button class="btn glass" data-act="enroll" data-p="${esc(n.path)}">Add to the review cycle</button>`}</div>
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
const PALETTE = ["#f4b88f", "#8fc7f4", "#c9a3ff", "#9be3b5", "#f2cf7a", "#ff8f80"];
const areaColor = (a) => PALETTE[hash(a) % PALETTE.length];
let graphStop = null;
function graph() {
  main.innerHTML = `<div class="ph"><h1>Graph</h1><p>Click opens the note. Drag to move.</p></div>
    <section class="graph glass"><canvas id="cv"></canvas><div class="legend" id="leg"></div></section>`;
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const areas = [...new Set(D.notes.map((n) => n.area).filter(Boolean))].sort();
  const nodes = D.notes.filter((n) => n.type !== "daily").map((n) => ({ id: nameOf(n.path), t: n.title, p: n.path, c: n.area ? areaColor(n.area) : "#d8d2ca" }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const v of D.missing) if (!byId.has(v.target)) { const g = { id: v.target, t: v.target, c: "rgba(255,255,255,.25)", ghost: true }; nodes.push(g); byId.set(v.target, g); }
  const edges = [];
  for (const n of D.notes) for (const l of new Set(n.links)) { const a = byId.get(nameOf(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  let W, H;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 4 + Math.sqrt(deg.get(n) || 0) * 2.5; });
  let hover = null, drag = null, heat = 1;
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
    ctx.clearRect(0, 0, W, H);
    const near = hover ? new Set(edges.filter(([a, b]) => a === hover || b === hover).flat()) : null;
    for (const [a, b] of edges) {
      ctx.strokeStyle = near && (a === hover || b === hover) ? "rgba(244,184,143,.7)" : "rgba(255,255,255,.1)";
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      ctx.globalAlpha = near && !near.has(n) && n !== hover ? 0.25 : 1;
      ctx.fillStyle = n.c; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      if (n === hover || (!hover && (deg.get(n) || 0) >= 5) || near?.has(n)) {
        ctx.fillStyle = n.ghost ? "rgba(243,239,233,.45)" : "rgba(243,239,233,.85)";
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
  const find = (e) => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 4); };
  let moved = false;
  cv.onpointermove = (e) => { wake(); if (drag) { const r = cv.getBoundingClientRect(); drag.x = e.clientX - r.left; drag.y = e.clientY - r.top; moved = true; heat = Math.max(heat, 0.3); } else { hover = find(e); cv.style.cursor = hover ? "pointer" : "grab"; } };
  cv.onpointerdown = (e) => { drag = find(e); moved = false; };
  cv.onpointerup = () => { if (drag && !moved) location.hash = drag.ghost ? `#/w/${encodeURIComponent(drag.id)}` : noteHref(drag.p); drag = null; };
  $("#leg").innerHTML = areas.map((k) => `<span><i style="background:${areaColor(k)}"></i>${esc(k)}</span>`).join("") + '<span><i style="background:rgba(255,255,255,.25)"></i>gap</span>';
  ambient(art("graph"));
}

// ---------------------------------------------------------------- Agents
const ROUTINES = {
  morning: ["Morning", "Builds today's focus in the daily note: reviews, inbox, gaps."],
  inbox: ["Inbox", "Processes the inbox folder: each item becomes a proper note or stays, with the reason."],
};
const AGENT_NAME = { claude: ["Claude Code", "agents"], agy: ["Antigravity", "bolt"], codex: ["Codex", "agents"], gemini: ["Gemini", "spark"] };
const runnerName = (id) => S.runners?.find((r) => r.id === id)?.name || id;
const taskStatus = (t) => (!t.end ? "running" : t.ok ? "finished" : "failed");
const liveClass = (t) => (!t.end ? "run" : t.ok ? "" : "off");
// The task form is drawn once; the 10 s refresh redraws only #agents-body, so what you type survives.
function agents() {
  const ready = (S.runners || []).filter((r) => r.ready);
  main.innerHTML = `<div class="ph"><h1>Agents</h1><p>Put any agent from <code>agents.json</code> to work on the vault, or watch the ones already running.</p></div>
    <h3>Put an agent to work</h3>
    <form class="task glass" id="run">
      <textarea id="run-prompt" rows="2" placeholder="What should it do in the vault? Enter runs, Shift+Enter adds a line" aria-label="Task for the agent"></textarea>
      <div class="task-bar">
        ${agentPicker("run")}
        <button class="btn peach" type="submit" ${ready.length ? "" : "disabled"}>Run ${icon("play", 14)}</button>
      </div>
      <small>${ready.length ? "CLI agents run in the vault folder; API agents can only list, search, read and write notes." : "No agent is set up yet: see README › Agents."}</small></form>
    <div id="agents-body"></div>`;
  $("#run").onsubmit = (e) => { e.preventDefault(); runPrompt(); };
  $("#run-agent").onchange = () => runOptions();
  $("#run-model").onchange = () => runOptions(true);
  runOptions();
  $("#run-prompt").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runPrompt(); } };
  agentsBody();
  ambient(art("agents"));
}
function agentsBody() {
  const el = $("#agents-body");
  if (!el) return;
  el.innerHTML = `${S.tasks?.length ? `<h3>Tasks</h3><div class="list glass">${S.tasks.map((t) => `<a class="row" href="#/t/${t.id}"><span class="live ${liveClass(t)}"></span>
        <span class="t">${esc(t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : t.prompt)}<small>${esc(taskMeta(t))} · ${taskStatus(t)}</small></span><span class="x">${ago(Date.parse(t.start))}</span></a>`).join("")}</div>` : ""}
    <h3>Running now</h3><div class="cards">${S.agents.map((a) => {
      const [name, ic] = AGENT_NAME[a.name] || [a.name, "agents"];
      return `<a class="ag glass link" href="#/a/${a.key}"><div class="hd"><span class="ic">${icon(ic)}</span><div><h4>${name}</h4><small>${esc(a.cwd)}</small></div><span class="live" style="margin-left:auto"></span></div>
        <div class="ft"><span class="pill">pid ${a.pid}</span><span class="pill">${duration(a.seconds)}</span><span class="watch">watch live ${icon("r", 14)}</span></div></a>`;
    }).join("") || '<p class="empty">No agents running.</p>'}</div>
    ${S.background?.length ? `<h3>In the background</h3><div class="cards">${S.background.map((f) => `<a class="ag glass link" href="#/a/${f.key}">
        <div class="hd"><span class="ic">${icon("agents")}</span><div><h4>${esc(f.title)}</h4><small>Claude Code · ${esc(f.cwd)}</small></div>
        <span class="live ${f.state === "blocked" ? "run" : f.state === "done" ? "idle" : ""}" style="margin-left:auto"></span></div>
        ${f.needs ? `<p class="need">${esc(f.needs)}</p>` : ""}
        <div class="ft"><span class="pill ${f.state === "blocked" ? "peach" : ""}">${STATE[f.state] || f.state}</span><span class="pill">${ago(f.since)}</span><span class="watch">open ${icon("r", 14)}</span></div></a>`).join("")}</div>` : ""}
    ${S.agentsMd ? `<h3>Routines</h3><div class="cards">${Object.entries(ROUTINES).map(([k, [name, desc]]) => {
      const r = S.tasks?.find((t) => t.routine === k);
      const st = !r ? "hasn't run this session" : !r.end ? `running since ${new Date(r.start).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}` : `${r.ok ? "finished" : "failed"} ${ago(Date.parse(r.end))}`;
      return `<div class="ag glass"><div class="hd"><span class="ic">${icon(k === "inbox" ? "inbox" : "target")}</span><div><h4>${name}</h4><small>${desc}</small></div></div>
        <div class="ft"><span class="live ${r ? liveClass(r) : "idle"}"></span><small>${st}</small>${r ? `<a class="watch" href="#/t/${r.id}">open</a>` : ""}
        <button class="btn peach" style="margin-left:auto" data-act="routine" data-k="${k}" ${r && !r.end ? "disabled" : ""}>${icon("play", 14)} Run</button></div></div>`;
    }).join("")}</div>` : ""}
    <h3>Log</h3><div class="list glass">${D.log.map((l) => {
      const [when, who, ...rest] = l.split(" · ");
      return `<div class="row"><span class="who">${esc(who)}</span><span class="txt">${withLinks(rest.join(" · "))}</span><span class="x">${esc(when.slice(5).replace("-", "/"))}</span></div>`;
    }).join("") || '<p class="empty">No runs logged.</p>'}</div>
    <h3>Findings</h3><div class="list glass">${D.findings.map((a) => { const [d, ...t] = a.split(" · "); return `<div class="row"><span class="txt">${esc(t.join(" · "))}</span><span class="x">${esc(d)}</span></div>`; }).join("")}</div>`;
}
// Model and effort pickers follow the chosen agent: only what agents.json lists for it. Effort levels can differ per model.
function runOptions(keepModel, p = "run") {
  const r = S.runners?.find((x) => x.id === $(`#${p}-agent`)?.value) || {}, ms = r.models || [], sel = $(`#${p}-model`);
  if (!keepModel) { sel.hidden = !ms.length; sel.innerHTML = ms.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join(""); }
  const es = ms.find((m) => m.id === sel.value)?.efforts || r.efforts || [], pick = es.includes(r.effort) ? r.effort : es[0];
  const seg = $(`#${p}-effort`);
  seg.hidden = !es.length;
  seg.innerHTML = es.map((e) => `<button type="button" role="radio" aria-checked="${e === pick}" class="${e === pick ? "on" : ""}" data-act="effort" data-v="${esc(e)}">${esc(e)}</button>`).join("");
}
const runChoice = (p = "run") => ({ agent: $(`#${p}-agent`)?.value, model: $(`#${p}-model`)?.hidden ? undefined : $(`#${p}-model`)?.value, effort: $(`#${p}-effort`)?.hidden ? undefined : $(`#${p}-effort .on`)?.dataset.v });
// Agent, model and effort pickers; runOptions(false, p) fills the last two for the chosen agent.
const agentPicker = (p) => `<select class="pick" id="${p}-agent" aria-label="Agent">${(S.runners || []).map((r) => `<option value="${esc(r.id)}" ${r.ready ? "" : "disabled"}>${esc(r.name)}${r.ready ? "" : " (not set up)"}</option>`).join("")}</select>
  <select class="pick" id="${p}-model" aria-label="Model" hidden></select><div class="seg" id="${p}-effort" role="radiogroup" aria-label="Effort" hidden></div>`;
// "Open in…" buttons: the commands agents.json gives the agent; the ones that need a session only when there is one.
const openButtons = (runner, attrs, hasSession) => (runner?.open || []).filter((o) => !o.session || hasSession)
  .map((o) => `<button class="btn glass" data-act="open" data-via="${esc(o.label)}" ${attrs}>${icon("ext", 14)} ${esc(o.label)}</button>`).join("");
const taskMeta = (t) => [runnerName(t.agent), t.model, t.effort].filter(Boolean).join(" · ");
async function runPrompt() {
  const t = $("#run-prompt"), prompt = t.value.trim();
  if (!prompt || t.disabled) return;
  t.disabled = true;
  try { const r = await api("/api/run", { ...runChoice(), prompt }); location.hash = `#/t/${r.id}`; }
  catch (e) { toast(`Not started: ${e.message}`); t.disabled = false; }
}

// ---------------------------------------------------------------- Task
let taskTimer = null, taskLast = "";
async function taskPage(id) {
  clearInterval(taskTimer); taskLast = "";
  main.innerHTML = `<div class="ph" id="task-head"></div><div class="feed list glass" id="feed"><p class="empty">Loading…</p></div>`;
  const paint = async () => {
    if (route().pg !== "t" || route().arg !== id) return clearInterval(taskTimer);
    const t = await api(`/api/task?id=${encodeURIComponent(id)}`).catch(() => null);
    if (!t) { main.innerHTML = `<div class="ph"><h1>Task not found</h1><p>Tasks live in memory and are gone after a restart.</p></div><a class="btn glass" href="#/agents">Back to Agents</a>`; return clearInterval(taskTimer); }
    const signature = t.end + t.events.length;
    if (signature === taskLast) return;
    taskLast = signature;
    $("#task-head").innerHTML = `<h1>${esc(t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : "Task")}</h1><p>${esc(taskMeta(t))} · started ${ago(Date.parse(t.start))}</p>
      <div class="r"><span class="live ${liveClass(t)}"></span><small style="color:var(--muted)">${taskStatus(t)}</small>${t.end ? "" : `<button class="btn glass" data-act="stop" data-id="${esc(t.id)}">Stop</button>`}
        ${openButtons(S.runners?.find((r) => r.id === t.agent), `data-task="${esc(t.id)}"`, !!t.session)}</div>`;
    const feed = $("#feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.innerHTML = t.events.map((e) => `<div class="row ev ${e.t}">
        <span class="who">${esc(e.t === "tool" ? e.name : e.t === "you" ? "task" : e.t === "text" ? runnerName(t.agent) : e.t)}</span>
        <div class="txt">${e.t === "text" || e.t === "you" ? fmt(e.txt) : esc(e.txt)}</div>
        <span class="x">${new Date(e.at).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}</span></div>`).join("");
    if (atEnd) feed.scrollTop = feed.scrollHeight;
    if (t.end) clearInterval(taskTimer);
  };
  await paint();
  taskTimer = setInterval(paint, 2000);
  ambient(art(`task ${id}`));
}

// ---------------------------------------------------------------- Live agent
// Reads the conversation from disk (Claude: the session .jsonl; AGY: SQLite) every 3 s, only while the page is open.
// The message box is drawn once; only the header and feed update, so what you type isn't wiped.
const WHO = { you: "you", result: "result" };
// Minimal Markdown (bold, code, heading) applied AFTER escaping: conversation text never becomes HTML.
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/^#{1,4} (.+)$/gm, "<b>$1</b>");
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
    const status = a.live ? "running" : STATE[a.state] || "idle";
    $("#agent-head").innerHTML = `<h1>${esc(name)}</h1><p>${esc(AGENT_NAME[a.name]?.[0] || a.name)} · ${esc(a.cwd)}${a.pid ? ` · pid ${a.pid}` : ""}${a.seconds ? ` · ${duration(a.seconds)}` : ""}</p>
      <div class="r"><span class="live ${a.live ? "" : a.state === "blocked" ? "run" : "idle"}"></span><small style="color:var(--muted)">${status} · refreshes every 3 s</small>
        ${openButtons(S.runners?.find((r) => r.process === a.name), `data-key="${esc(key)}"`, true)}</div>`;
    $("#agent-needs").innerHTML = a.needs ? `<div class="needs glass"><b>Needs you</b>${fmt(a.needs)}</div>` : "";
    $("#talk-hint").textContent = a.name === "agy" ? "Continues this conversation in AGY (agy -p --conversation)."
      : a.live ? "This session is open in a terminal: the reply comes in a background copy, and the terminal stays intact."
      : "Continues this session in the background (claude --bg --resume).";
    const feed = $("#feed"), atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.innerHTML = a.events.map((e) => `<div class="row ev ${e.t}">
        <span class="who">${esc(WHO[e.t] ?? (e.t === "tool" ? e.name : a.name))}</span>
        <div class="txt">${e.t === "text" || e.t === "you" ? fmt(e.txt) : esc(e.txt)}</div>
        <span class="x">${e.at ? new Date(e.at).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : ""}</span></div>`).join("")
      || `<p class="empty">Nothing to show yet.</p>`;
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
// The picker: every visible image of the board, plus Automatic to hand the card back to the rotation.
let pickKey = "";
const IMG_ACTIONS = {
  "pick-open": async (el) => {
    const s = SG[Number(el.dataset.i)], p = await api("/api/images").catch(() => null);
    if (!s || !p) return;
    pickKey = cardKey(s);
    const cur = D.pinCards?.[pickKey]?.id, imgs = p.images.filter((i) => !p.hidden.includes(i.id));
    $("#picker").innerHTML = `<div class="pk-head"><h3>Image for “${esc(s.title)}”</h3><button type="button" class="btn glass" data-act="pick" data-id="">Automatic</button>
        <button type="button" class="btn glass" data-act="pick-close" aria-label="Close">Close <kbd>Esc</kbd></button></div>
      <div class="pk-grid">${imgs.map((im) => `<button type="button" class="${im.id === cur ? "on" : ""}" data-act="pick" data-id="${im.id}" aria-label="${esc(im.title || "Image")}"><img src="/pin/${im.id}?thumb" loading="lazy" alt=""></button>`).join("")}</div>`;
    $("#picker").showModal();
  },
  "pick-close": () => $("#picker").close(),
  pick: async (el) => {
    try { await api("/api/images/prefs", { cards: { [pickKey]: el.dataset.id || null } }); } catch (e) { return toast(e.message); }
    $("#picker").close(); D = await api("/api"); home(); toast(el.dataset.id ? "Image chosen for this card" : "Back to automatic");
  },
  "img-mode": (el) => savePrefs({ mode: el.dataset.k }),
  "img-source": (el) => { imgSource = el.dataset.k; imagesPage(); },
  "img-hide": async (el) => { const p = await api("/api/images"), id = el.dataset.id; savePrefs({ hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id] }); },
  "img-star": async (el) => { const p = await api("/api/images"), id = el.dataset.id; savePrefs({ starred: p.starred.includes(id) ? p.starred.filter((x) => x !== id) : [...p.starred, id] }); },
};

// ---------------------------------------------------------------- Services
function services() {
  main.innerHTML = `<div class="ph"><h1>Services</h1><p>Your local apps and Pinterest. Listed in <code>services.json</code>.</p></div>
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

// ---------------------------------------------------------------- routes and events
const PAGES = { "": [home, "Home"], notes: [notes, "Notes"], n: [reader, "Note"], w: [wiki, "Note"], review: [review, "Review"], graph: [graph, "Graph"], agents: [agents, "Agents"], services: [services, "Services"], images: [imagesPage, "Images"], s: [service, "Service"], a: [agentPage, "Agent"], t: [taskPage, "Task"] };
function route() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGES[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  graphStop?.(); graphStop = null;
  const { pg, arg } = route();
  $("#crumb").textContent = pg === "a" ? S.background?.find((x) => x.key === arg)?.title || AGENT_NAME[S.agents.find((x) => x.key === arg)?.name]?.[0] || "Agent" : pg === "s" ? S.services.find((s) => s.id === arg)?.name || "Service" : PAGES[pg][1];
  document.body.classList.toggle("app", pg === "s"); // an embedded app takes over the week strip's height
  if (pg !== "s") $("#svcbar").innerHTML = "";
  main.style.animation = "none"; main.offsetHeight; main.style.animation = "";
  topBar();
  PAGES[pg][0](arg);
}

const ACTIONS = {
  ...CAL_ACTIONS, ...IMG_ACTIONS,
  prev: () => move(-1), next: () => move(1), go: (el) => { idx = Number(el.dataset.i); place(); },
  filter: (el) => { filter = el.dataset.k; notes(); },
  show: () => { revealed = true; flashcard(); }, yes: () => answer(true), no: () => answer(false),
  enroll: async (el) => { await api("/api/review", { path: el.dataset.p, remembered: false }); toast("In the cycle: first review tomorrow"); D = await api("/api"); render(); },
  routine: async (el) => {
    try { const r = await api("/api/routine", { name: el.dataset.k, ...runChoice() }); location.hash = `#/t/${r.id}`; } catch (e) { toast(e.message); }
  },
  open: async (el) => {
    try { await api("/api/open", { via: el.dataset.via, key: el.dataset.key, task: el.dataset.task }); toast(`Opening in ${el.dataset.via}`); } catch (e) { toast(e.message); }
  },
  effort: (el) => el.parentElement.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === el); b.setAttribute("aria-checked", b === el); }),
  stop: async (el) => { await api("/api/task/stop", { id: el.dataset.id }).catch(() => {}); toast("Stopping…"); },
  pinsync: async (el) => {
    el.disabled = true; el.textContent = "Syncing…";
    try {
      const p = await api("/api/pinterest/sync", {});
      toast(p.status === "ok" ? `${p.images.length} images in the cache` : p.error || "Sync failed");
    } catch (e) { toast(e.message); }
    [D, S] = await Promise.all([api("/api"), api("/api/system")]); render();
  },
  reload: () => { const f = $("#svcf"); f.src = f.src; },
  capture: () => { $("#capture-day").textContent = D.today; $("#capture").showModal(); $("#capture-text").focus(); },
};
document.addEventListener("click", (e) => {
  if (e.target.closest("a[target]")) return;
  const el = e.target.closest("[data-act]");
  if (el) { e.preventDefault(); ACTIONS[el.dataset.act]?.(el); return; }
  const side = e.target.closest(".card.side");
  if (side) { e.preventDefault(); idx = Number(side.dataset.i); place(); }
});
document.addEventListener("input", (e) => { if (e.target.id === "search") { query = e.target.value; grid(); } });
$("#capture-text").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  const text = e.target.value.trim();
  if (!text) return;
  await api("/api/capture", { text });
  e.target.value = ""; $("#capture").close(); toast("Captured in the daily note");
  D = await api("/api"); if (!route().pg) home(); topBar();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && calDay && !document.querySelector("dialog[open]")) { calDay = ""; calRender(); return; }
  if (e.target.matches("input, textarea, select") || document.querySelector("dialog[open]")) return;
  const { pg } = route();
  if (e.key === "c") { e.preventDefault(); ACTIONS.capture(); }
  if (e.key === "/" && pg === "notes") { e.preventDefault(); $("#search").focus(); }
  if (!pg && e.key === "ArrowLeft") move(-1);
  if (!pg && e.key === "ArrowRight") move(1);
  if (pg === "review" && queue[pos]) {
    if (e.key === " " && !revealed) { e.preventDefault(); ACTIONS.show(); }
    if (revealed && e.key === "1") answer(false);
    if (revealed && e.key === "2") answer(true);
  }
});
// Swipe on the carousel.
let x0 = null;
document.addEventListener("pointerdown", (e) => { x0 = e.target.closest("#car") ? e.clientX : null; });
document.addEventListener("pointerup", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 60) move(e.clientX < x0 ? 1 : -1); x0 = null; });

addEventListener("hashchange", render);
async function vault() { D = await api("/api"); }
async function system() { S = await api("/api/system"); }
// Live: system every 10 s (agents, services), vault when you come back to the tab and every minute.
setInterval(async () => {
  await system(); topBar();
  const { pg } = route();
  if (!pg) tiles(); else if (pg === "agents") agentsBody(); else if (pg === "services") services();
}, 10000);
setInterval(async () => { await vault(); topBar(); if (!route().pg) tiles(); }, 60000);
addEventListener("focus", async () => { await vault(); topBar(); const { pg } = route(); if (!pg) home(); else if (pg === "notes") grid(); });
setInterval(clock, 1000);
clock();
Promise.all([vault(), system()]).then(render);
