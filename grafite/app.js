// Overlook, "Grafite" look. Same data, routes and shortcuts as Overlook at /; a different visual layer, with Pinterest in the carousel.
const $ = (s, el = document) => el.querySelector(s);
const main = $("#main");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const LOCALE = "en-US";
const rel = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const addDays = (d, n) => new Date(new Date(d + "T12:00").getTime() + n * 864e5).toLocaleDateString("sv");
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

let D = null; // vault
let S = { agents: [], services: [], runners: [], tasks: [], background: [] }; // system
let PIN = { status: "no-config", images: [] }; // Pinterest (local cache)

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
const obs = (p) => `obsidian://open?vault=${encodeURIComponent(D.vault)}&file=${encodeURIComponent(p.replace(/\.md$/, ""))}`;
const noteHref = (p) => `#/n/${encodeURIComponent(p)}`;
const unlink = (s) => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
const withLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<a href="#/w/${encodeURIComponent(a)}">${b || a}</a>`);
const emLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<em>${b || a}</em>`); // main phrase in italics
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
const heading = (t, sub = "", extra = "") => `<div class="ph"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}${extra}</div>`;
const empty = (t) => `<p class="empty">${t}</p>`;

function needsYou() { return (D.focus?.length || 0) + due().length + inbox().length + (D.captured?.length || 0); }

// ---------------------------------------------------------------- top bar: text navigation
function screens() {
  return [["", "Home"], ["notes", "Notes"], ["review", "Review"], ["graph", "Graph"], ["agents", "Agents"], ["services", "Services"],
    ...S.services.filter((s) => s.dock).map((s) => [`s/${s.id}`, s.name])];
}
function topBar() {
  if (!D) return;
  const { pg, arg } = route();
  const current = pg === "s" ? `s/${arg}` : pg === "n" || pg === "w" ? "notes" : pg === "a" || pg === "t" ? "agents" : pg;
  $("#nav").innerHTML = screens().map(([id, name]) => `<a href="#/${id}" class="${current === id ? "on" : ""}" ${current === id ? 'aria-current="page"' : ""}>${esc(name)}</a>`).join("");
}
function clock() { $("#time").textContent = new Date().toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }); }

// ---------------------------------------------------------------- Home: focus carousel
function suggestions() {
  const s = [];
  const ln = (txt) => txt.match(/\[\[([^\]|]+)/)?.[1];
  for (const f of D.focus || []) { const a = ln(f); s.push({ cat: "today's focus", source: "from the daily note", phrase: emLinks(f), plain: unlink(f), href: a ? `#/w/${encodeURIComponent(a)}` : obs(dailyPath()), action: "Open note" }); }
  for (const n of due()) s.push({ cat: "review", source: n.review_on === D.today ? "due today" : `overdue by ${daysBetween(n.review_on, D.today)} d`, phrase: `Review <em>${esc(n.title)}</em>`, plain: `Review ${n.title}`, href: "#/review", action: "Review" });
  for (const c of D.captured || []) s.push({ cat: "captured today", source: "from the daily note", phrase: `<em>${esc(unlink(c))}</em>`, plain: unlink(c), href: obs(dailyPath()), action: "Open in Obsidian" });
  for (const n of inbox()) s.push({ cat: "inbox", source: `arrived ${ago(n.mtime)}`, phrase: `Process <em>${esc(n.title)}</em>`, plain: `Process ${n.title}`, href: noteHref(n.path), action: "Open note" });
  for (const v of D.missing.slice(0, 3)) s.push({ cat: "gap", source: `linked ${v.n}×`, phrase: `Write <em>${esc(v.target)}</em>`, plain: `Write ${v.target}`, href: `#/w/${encodeURIComponent(v.target)}`, action: "See who links it" });
  for (const n of D.notes.filter((n) => n.type === "project")) s.push({ cat: "project", source: n.area || "project", phrase: `<em>${esc(n.title)}</em>`, plain: n.title, href: noteHref(n.path), action: "Open note" });
  const outside = D.notes.filter((n) => n.type === "concept" && !n.review_on).sort((a, b) => a.mtime - b.mtime).slice(0, 2);
  for (const n of outside) s.push({ cat: "rediscover", source: "out of the cycle", phrase: `Reread <em>${esc(n.title)}</em>`, plain: `Reread ${n.title}`, href: noteHref(n.path), action: "Open note" });
  return s.length ? s : [{ cat: "all caught up", source: "", phrase: "Nothing needs attention <em>right now</em>", plain: "Nothing pending", href: "#/notes", action: "See notes" }];
}
// Slide image: deterministic rotation by date; each slide gets a different image (while there are images).
function image(i) {
  const im = PIN.images || [];
  return im.length ? im[(hash(D.today) + i) % im.length] : null;
}

let idx = 0, SG = [];
function home() {
  SG = suggestions();
  idx = Math.min(idx, SG.length - 1);
  main.innerHTML = `<section class="car" id="car" aria-roledescription="carousel" aria-label="Today's focus"></section>
    <div class="dashes" id="dashes"></div>
    <section class="panel" id="panel"></section>`;
  slides(); panel();
}
function slides() {
  const n = SG.length, s = SG[idx], img = image(idx);
  const peek = (d, cls) => {
    if (n < 2) return "<div></div>";
    const j = (idx + d + n) % n, im = image(j);
    return `<div class="slide peek ${cls}" data-act="go" data-i="${j}" aria-hidden="true">${im ? `<img src="/pin/${im.id}" alt="">` : ""}<div class="veil"></div>
      <div class="content"><span></span><h2>${SG[j].phrase}</h2></div></div>`;
  };
  $("#car").innerHTML = peek(-1, "prev") + `<article class="slide" aria-live="polite">
      ${img ? `<img src="/pin/${img.id}" alt="${esc(img.title || "Image from the Pinterest board")}"><div class="veil"></div>` : ""}
      <div class="content">
        <div class="head"><span>${esc(s.cat)} · ${idx + 1} of ${n}${s.source ? ` · ${esc(s.source)}` : ""}</span>
          ${img ? `<a class="source" href="${esc(img.link)}" target="_blank" rel="noopener">image · pinterest ↗</a>` : ""}</div>
        <div><h2>${s.phrase}</h2>
          <div class="actions"><a class="btn pri" href="${esc(s.href)}">${esc(s.action)}</a>
            ${n > 1 ? `<button class="arrow" data-act="prev" aria-label="Previous focus (← key)">←</button><button class="arrow" data-act="next" aria-label="Next focus (→ key)">→</button>
            <span class="next-up">Next: ${esc(SG[(idx + 1) % n].plain)}</span>` : ""}</div></div>
      </div></article>` + peek(1, "next");
  $("#dashes").innerHTML = n > 1 ? SG.map((_, i) => `<button class="${i === idx ? "on" : ""}" data-act="go" data-i="${i}" aria-label="Focus ${i + 1} of ${n}"></button>`).join("") : "";
}
const move = (d) => { idx = (idx + d + SG.length) % SG.length; slides(); };
function panel() {
  const el = $("#panel");
  if (!el) return;
  const today = new Date(D.today + "T12:00");
  const rev = {};
  for (const n of D.notes) if (n.review_on) { const k = n.review_on < D.today ? D.today : n.review_on; rev[k] = (rev[k] || 0) + 1; }
  const week = [...Array(6)].map((_, i) => {
    const d = addDays(D.today, i + 1), dt = new Date(d + "T12:00");
    return `<a href="#/review" title="${rev[d] || 0} review(s)"><span>${dt.toLocaleDateString(LOCALE, { weekday: "narrow" }).toUpperCase()}</span><b>${dt.getDate()}</b></a>`;
  }).join("");
  const n = needsYou(), on = S.services.filter((s) => s.ok).length;
  const next = D.notes.filter((x) => x.review_on > D.today).sort((a, b) => a.review_on.localeCompare(b.review_on))[0];
  el.innerHTML = `<div>
      <div class="date"><span class="n">${today.getDate()}</span><span class="wk">${today.toLocaleDateString(LOCALE, { weekday: "long" })}<br>${today.toLocaleDateString(LOCALE, { month: "long" })}</span></div>
      <nav class="week" aria-label="Next days">${week}</nav></div>
    <div>
      <div class="pair"><a href="#/review">Needs you <b class="hot">${n}</b></a><a href="#/agents">Agents running <b>${S.agents.length}</b></a></div>
      <div class="trio">
        <a href="#/services"><span>Services</span><b>${on}/${S.services.length}</b><small>${esc(S.services.filter((s) => !s.ok).map((s) => s.name).join(", ") || (S.services.length ? "all up" : "none configured"))}</small></a>
        <a href="#/review"><span>Review</span><b>${due().length}</b><small>${next ? `next ${rel.format(daysBetween(D.today, next.review_on), "day")}` : "none in the cycle"}</small></a>
        <a href="#/notes"><span>Vault</span><b>${D.notes.length}</b><small>${D.missing.length} ${D.missing.length === 1 ? "gap" : "gaps"}</small></a>
      </div></div>`;
}

// ---------------------------------------------------------------- Notes
let filter = "", query = "";
function notes() {
  const count = {};
  for (const n of D.notes) count[n.folder] = (count[n.folder] || 0) + 1;
  main.innerHTML = `<div class="col">${heading("Notes", `${D.notes.length} notes in the vault`,
      `<div class="r"><input class="search" id="search" placeholder="Search title or summary  /" value="${esc(query)}" autocomplete="off" aria-label="Search notes (shortcut /)"></div>`)}
    <div class="tabs" role="tablist">${[["", "All", D.notes.length], ...Object.keys(count).sort().map((k) => [k, folderLabel(k), count[k]])]
      .map(([k, v, c]) => `<button class="tab ${filter === k ? "on" : ""}" role="tab" aria-selected="${filter === k}" data-act="filter" data-k="${esc(k)}">${esc(v)}<small>${c}</small></button>`).join("")}</div>
    <div class="rows" id="note-grid"></div></div>`;
  grid();
}
const noteRow = (n) => `<a class="row" href="${noteHref(n.path)}">
    <span class="t"><b>${esc(n.title)}</b><span>${esc(n.type === "daily" ? "Daily note" : plain(n.summary) || "No one-line summary")}</span></span>
    ${n.type ? `<span class="tag">${esc(n.type)}</span>` : ""}<span class="x">${ago(n.mtime)}</span></a>`;
function grid() {
  const q = fold(query);
  const weight = (n) => (!q ? 0 : fold(n.title).startsWith(q) ? 0 : fold(n.title).includes(q) ? 1 : 2);
  const ns = D.notes.filter((n) => (!filter || n.folder === filter) && (!q || fold(n.title + " " + n.summary + " " + n.tags.join(" ")).includes(q)))
    .sort((a, b) => weight(a) - weight(b) || b.mtime - a.mtime);
  $("#note-grid").innerHTML = ns.map(noteRow).join("") || empty(`Nothing matches "${esc(query)}".`);
}

// ---------------------------------------------------------------- Reader
async function reader(path) {
  const n = await api(`/api/note?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!n) { main.innerHTML = empty("Note not found."); return; }
  const cycle = n.review_on ? `In the cycle: review ${n.review_on <= D.today ? "today" : rel.format(daysBetween(D.today, n.review_on), "day")}, interval ${n.interval} d` : "";
  main.innerHTML = `<article class="reader">${heading(esc(n.title))}
      <div class="meta">${[n.type, n.area, ...n.tags].filter(Boolean).map(esc).join("<span>·</span>")}</div>
      <div class="prose" id="prose">${n.html}</div>
      <div class="reader-acts"><a class="btn pri" href="${obs(n.path)}">Open in Obsidian ↗</a>
        ${cycle ? `<span class="empty">${cycle}</span>` : `<button class="btn" data-act="enroll" data-p="${esc(n.path)}">Add to the cycle</button>`}</div>
      <p class="label">Linked from</p><div class="rows">${n.backlinks.map((b) => `<a class="row" href="${noteHref(b.path)}"><span class="t"><b>${esc(b.title)}</b></span></a>`).join("") || empty("Nothing links here yet.")}</div>
      <p class="label">Links to</p><div class="rows">${[...new Set(n.links)].map((l) => `<a class="row" href="#/w/${encodeURIComponent(l)}"><span class="t"><b style="${resolveNote(l) ? "" : "color:var(--muted)"}">${esc(l)}</b></span>${resolveNote(l) ? "" : '<span class="tag">gap</span>'}</a>`).join("") || empty("No links.")}</div>
    </article>`;
  // Obsidian callout: a blockquote starting with [!type] Title.
  document.querySelectorAll("#prose blockquote").forEach((b) => {
    const p = b.querySelector("p");
    const m = p?.innerHTML.match(/^\[!(\w+)\]\s*([^\n<]*)(?:<br\s*\/?>|\n)?/);
    if (!m) return;
    p.innerHTML = `<span class="ct">${m[2] || m[1]}</span>` + p.innerHTML.slice(m[0].length);
  });
  scrollTo({ top: 0 });
}
function wiki(name) {
  const n = resolveNote(name);
  if (n) return location.replace(noteHref(n.path));
  const who = D.notes.filter((x) => x.links.includes(name));
  main.innerHTML = `<div class="col">${heading(esc(name), "Gap: doesn't exist yet. A missing link is an honest backlog, not an error.")}
    <p class="label">Linked from</p><div class="rows">${who.map(noteRow).join("") || empty("Nobody.")}</div>
    <p class="empty">To write it: ask your agent "write the note ${esc(name)}" or create it in Obsidian. Don't click the missing link just to create an empty file.</p></div>`;
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
    main.innerHTML = `<div class="col">${heading(done ? `${done} reviewed. Done.` : "Nothing due today", "Remembered doubles the interval; forgot resets it to 1 day.")}
      <p class="label">Coming up</p><div class="rows">${next.slice(0, 8).map((x) => `<a class="row" href="${noteHref(x.path)}"><span class="t"><b>${esc(x.title)}</b></span><span class="x mono">${x.review_on} · ${x.interval} d</span></a>`).join("") || empty("No notes in the cycle yet.")}</div>
      <p class="label">Add to the cycle</p><div class="rows">${outside.map((x) => `<div class="row"><a class="t" href="${noteHref(x.path)}"><b>${esc(x.title)}</b><span>${esc(plain(x.summary))}</span></a>
        <button class="btn sm" data-act="enroll" data-p="${esc(x.path)}">Add</button></div>`).join("") || empty("All of them already are.")}</div></div>`;
    return;
  }
  main.innerHTML = `<section class="flash">
      <span class="n">${pos + 1} of ${queue.length} · ${esc(n.folder)}</span>
      <h1>${esc(n.title)}</h1>
      ${revealed ? `<p class="ans">${esc(plain(n.summary) || "No one-line summary. Open the note.")}</p>
        <div class="acts"><button class="btn" data-act="no">Forgot <kbd>1</kbd></button><button class="btn pri" data-act="yes">Remembered <kbd>2</kbd></button><a class="btn" href="${noteHref(n.path)}">Read the note</a></div>`
      : `<div class="acts"><button class="btn pri" data-act="show">Show answer <kbd>space</kbd></button></div>`}
    </section>`;
}
async function answer(remembered) {
  const n = queue[pos];
  const r = await api("/api/review", { path: n.path, remembered });
  toast(`${n.title}: back in ${r.interval} d`);
  pos++; revealed = false; done++;
  D = await api("/api"); topBar(); flashcard();
}

// ---------------------------------------------------------------- Graph
const PALETTE = ["#b39a86", "#8a9fae", "#a294b3", "#8fa898", "#b0a57f", "#ad8a86"]; // desaturated: ring and legend only
const areaColor = (a) => PALETTE[hash(a) % PALETTE.length];
let graphStop = null, graphFilter = "";
function graph() {
  main.innerHTML = `${heading("Graph", "Click opens the note. Drag to move, the mouse wheel zooms.")}
    <section class="graph"><canvas id="cv" aria-label="Graph of links between notes"></canvas><div class="legend" id="leg"></div></section>`;
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const tok = getComputedStyle(document.documentElement);
  const C = { muted: tok.getPropertyValue("--muted").trim(), text: tok.getPropertyValue("--text").trim(), line: tok.getPropertyValue("--line").trim(), strong: tok.getPropertyValue("--label").trim() };
  const areas = [...new Set(D.notes.map((n) => n.area).filter(Boolean))].sort();
  const nodes = D.notes.filter((n) => n.type !== "daily").map((n) => ({ id: nameOf(n.path), t: n.title, p: n.path, area: n.area }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const v of D.missing) if (!byId.has(v.target)) { const g = { id: v.target, t: v.target, ghost: true }; nodes.push(g); byId.set(v.target, g); }
  const edges = [];
  for (const n of D.notes) for (const l of new Set(n.links)) { const a = byId.get(nameOf(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  let W, H;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 3 + Math.sqrt(deg.get(n) || 0) * 2; });
  let hover = null, drag = null, pan = null, heat = 1;
  const view = { k: 1, x: 0, y: 0, manual: false }; // screen = world * k + (x, y)
  // Frames the graph while it settles; stops once you zoom or drag the background.
  const frame = () => {
    if (view.manual || !nodes.length) return;
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    view.k = Math.min(1.5, (W - 160) / (x1 - x0 || 1), (H - 140) / (y1 - y0 || 1));
    view.x = W / 2 - ((x0 + x1) / 2) * view.k; view.y = H / 2 - ((y0 + y1) / 2) * view.k;
  };
  const world = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]; };
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
  const visible = (n) => !graphFilter || n.area === graphFilter;
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    const near = hover ? new Set(edges.filter(([a, b]) => a === hover || b === hover).flat()) : null;
    ctx.lineWidth = 1 / view.k;
    for (const [a, b] of edges) {
      if (!visible(a) && !visible(b)) continue;
      ctx.strokeStyle = near && (a === hover || b === hover) ? C.strong : C.line;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.font = `400 ${12 / view.k}px Geist, sans-serif`;
    for (const n of nodes) {
      const focus = n === hover || near?.has(n);
      ctx.globalAlpha = !visible(n) ? 0.15 : near && !focus ? 0.35 : 1;
      ctx.fillStyle = focus ? C.text : C.muted;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      if (n.area) { ctx.strokeStyle = areaColor(n.area); ctx.lineWidth = 1.5 / view.k; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5 / view.k, 0, 7); ctx.stroke(); ctx.lineWidth = 1 / view.k; }
      if (focus || (view.k > 1.6 && visible(n))) { // labels only on hover or when zoomed in: no more overlap
        ctx.fillStyle = n === hover ? C.text : C.muted;
        ctx.fillText(n.ghost ? `${n.t} (gap)` : n.t, n.x + n.r + 6 / view.k, n.y + 4 / view.k);
      }
    }
    ctx.globalAlpha = 1;
  }
  let alive = true, idle = false;
  // Stops once it settles: only animates again on interaction (saves CPU while the tab sits idle).
  const loop = () => { if (!alive) return; step(); frame(); draw(); if (heat > 0.06 || drag) requestAnimationFrame(loop); else idle = true; };
  const wake = () => { if (idle && alive) { idle = false; requestAnimationFrame(loop); } };
  loop();
  graphStop = () => { alive = false; };
  const find = (e) => { const [x, y] = world(e); return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 5 / view.k); };
  let moved = false;
  cv.onpointermove = (e) => {
    if (drag) { [drag.x, drag.y] = world(e); moved = true; heat = Math.max(heat, 0.3); wake(); }
    else if (pan) { view.x = pan.vx + e.clientX - pan.x; view.y = pan.vy + e.clientY - pan.y; moved = view.manual = true; draw(); }
    else { const h = find(e); if (h !== hover) { hover = h; draw(); } cv.style.cursor = hover ? "pointer" : "grab"; }
  };
  cv.onpointerdown = (e) => { drag = find(e); moved = false; if (!drag) pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; };
  cv.onpointerup = () => { if (drag && !moved) location.hash = drag.ghost ? `#/w/${encodeURIComponent(drag.id)}` : noteHref(drag.p); drag = null; pan = null; };
  cv.onwheel = (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(4, Math.max(0.4, view.k * Math.exp(-e.deltaY * 0.0015)));
    view.x = mx - (mx - view.x) * (k / view.k); view.y = my - (my - view.y) * (k / view.k); view.k = k; view.manual = true;
    draw();
  };
  const legend = () => {
    $("#leg").innerHTML = `<button class="${graphFilter ? "" : "on"}" data-act="graph-filter" data-k="">All</button>` +
      areas.map((k) => `<button class="${graphFilter === k ? "on" : ""}" data-act="graph-filter" data-k="${esc(k)}"><i style="border-color:${areaColor(k)}"></i>${esc(k)}</button>`).join("");
  };
  ACTIONS["graph-filter"] = (el) => { graphFilter = el.dataset.k; legend(); draw(); };
  legend();
}

// ---------------------------------------------------------------- Agents
const ROUTINES = {
  morning: ["Morning", "Builds today's focus in the daily note: reviews, inbox, gaps."],
  inbox: ["Inbox", "Processes the inbox folder: each item becomes a proper note or stays, with the reason."],
};
const AGENT_NAME = { claude: "Claude Code", agy: "Antigravity", codex: "Codex", gemini: "Gemini" };
const STATE = { blocked: "waiting for you", working: "working", running: "working", done: "finished", idle: "idle" };
const runnerName = (id) => S.runners?.find((r) => r.id === id)?.name || id;
const taskStatus = (t) => (!t.end ? "running" : t.ok ? "finished" : "failed");
const dotClass = (t) => (!t.end ? "run" : t.ok ? "" : "off");
// The task form is drawn once; the 10 s refresh redraws only #agents-body, so what you type survives.
function agents() {
  const ready = (S.runners || []).filter((r) => r.ready);
  main.innerHTML = `<div class="col">${heading("Agents", "Put any agent from agents.json to work on the vault, or watch the ones already running.")}
    <p class="label">Put an agent to work</p>
    <form class="talk" id="run"><select id="run-agent" aria-label="Agent">${(S.runners || []).map((r) => `<option value="${esc(r.id)}" ${r.ready ? "" : "disabled"}>${esc(r.name)}${r.ready ? "" : " (not set up)"}</option>`).join("")}</select>
      <textarea id="run-prompt" rows="2" placeholder="What should it do in the vault? Enter runs, Shift+Enter adds a line" aria-label="Task for the agent"></textarea>
      <button class="btn pri" type="submit" ${ready.length ? "" : "disabled"}>Run</button>
      <small>${ready.length ? "CLI agents run in the vault folder; API agents can only list, search, read and write notes." : "No agent is set up yet: see README › Agents."}</small></form>
    <div id="agents-body"></div></div>`;
  $("#run").onsubmit = (e) => { e.preventDefault(); runPrompt(); };
  $("#run-prompt").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runPrompt(); } };
  agentsBody();
}
function agentsBody() {
  const el = $("#agents-body");
  if (!el) return;
  el.innerHTML = `${S.tasks?.length ? `<p class="label">Tasks</p><div class="rows">${S.tasks.map((t) => `<a class="row" href="#/t/${t.id}"><span class="dot ${dotClass(t)}"></span>
        <span class="t"><b>${esc(t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : t.prompt)}</b><span>${esc(runnerName(t.agent))} · ${taskStatus(t)}</span></span><span class="x">${ago(Date.parse(t.start))}</span></a>`).join("")}</div>` : ""}
    <p class="label">Running now</p><div class="rows">${S.agents.map((a) => `<a class="row" href="#/a/${a.key}"><span class="dot"></span>
        <span class="t"><b>${AGENT_NAME[a.name] || a.name}</b><span class="mono">${esc(a.cwd)}</span></span>
        <span class="x mono">pid ${a.pid}</span><span class="x">${duration(a.seconds)}</span><span class="link">Watch live →</span></a>`).join("") || empty("No agents running.")}</div>
    ${S.background?.length ? `<p class="label">In the background</p><div class="rows">${S.background.map((f) => `<a class="row" href="#/a/${f.key}">
        <span class="dot ${f.state === "blocked" ? "run" : f.state === "done" ? "idle" : ""}"></span>
        <span class="t"><b>${esc(f.title)}</b><span>${esc(f.needs || f.cwd)}</span></span>
        <span class="x" style="${f.state === "blocked" ? "color:var(--accent)" : ""}">${STATE[f.state] || f.state}</span><span class="x">${ago(f.since)}</span></a>`).join("")}</div>` : ""}
    ${S.agentsMd ? `<p class="label">Routines</p><div class="rows">${Object.entries(ROUTINES).map(([k, [name, desc]]) => {
      const r = S.tasks?.find((t) => t.routine === k);
      const st = !r ? "hasn't run this session" : `${taskStatus(r)} ${ago(Date.parse(r.end || r.start))}`;
      return `<div class="row"><span class="dot ${r ? dotClass(r) : "idle"}"></span>
        <span class="t"><b>${name}</b><span>${desc}</span></span><span class="x">${st}</span>${r ? `<a class="link" href="#/t/${r.id}">Open</a>` : ""}
        <button class="btn" data-act="routine" data-k="${k}" ${r && !r.end ? "disabled" : ""}>Run</button></div>`;
    }).join("")}</div>` : ""}
    <p class="label">Log</p><div class="rows">${D.log.map((l) => {
      const [when, who, ...rest] = l.split(" · ");
      return `<div class="row"><span class="x mono">${esc(when.slice(5).replace("-", "/"))}</span><span class="who">${esc(who)}</span><span class="msg">${withLinks(rest.join(" · "))}</span></div>`;
    }).join("") || empty("No runs logged.")}</div>
    <p class="label">Findings</p><div class="rows">${D.findings.map((a) => { const [d, ...t] = a.split(" · "); return `<div class="row"><span class="x mono">${esc(d)}</span><span class="msg">${esc(t.join(" · "))}</span></div>`; }).join("")}</div>`;
}
async function runPrompt() {
  const t = $("#run-prompt"), prompt = t.value.trim();
  if (!prompt || t.disabled) return;
  t.disabled = true;
  try { const r = await api("/api/run", { agent: $("#run-agent").value, prompt }); location.hash = `#/t/${r.id}`; }
  catch (e) { toast(`Not started: ${e.message}`); t.disabled = false; }
}

// ---------------------------------------------------------------- Task
let taskTimer = null, taskLast = "";
async function taskPage(id) {
  clearInterval(taskTimer); taskLast = "";
  main.innerHTML = `<div class="col"><div id="task-head"></div><div class="rows feed" id="feed"><p class="empty">Loading…</p></div></div>`;
  const paint = async () => {
    if (route().pg !== "t" || route().arg !== id) return clearInterval(taskTimer);
    const t = await api(`/api/task?id=${encodeURIComponent(id)}`).catch(() => null);
    if (!t) { main.innerHTML = `<div class="col">${heading("Task not found", "Tasks live in memory and are gone after a restart.")}<a class="btn" href="#/agents">Back to Agents</a></div>`; return clearInterval(taskTimer); }
    const signature = t.end + t.events.length;
    if (signature === taskLast) return;
    taskLast = signature;
    $("#task-head").innerHTML = heading(esc(t.routine ? `${ROUTINES[t.routine]?.[0] || t.routine} routine` : "Task"),
      `${esc(runnerName(t.agent))} · started ${ago(Date.parse(t.start))} · ${taskStatus(t)}`,
      t.end ? "" : `<div class="r"><button class="btn" data-act="stop" data-id="${esc(t.id)}">Stop</button></div>`);
    const atEnd = innerHeight + scrollY >= document.body.scrollHeight - 160;
    $("#feed").innerHTML = t.events.map((e) => `<div class="row ev ${e.t}">
        <span class="x mono">${new Date(e.at).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}</span>
        <span class="who">${esc(e.t === "tool" ? e.name : e.t === "you" ? "task" : e.t === "text" ? runnerName(t.agent) : e.t)}</span>
        <span class="msg">${e.t === "text" || e.t === "you" ? fmt(e.txt) : esc(e.txt)}</span></div>`).join("");
    if (atEnd) scrollTo({ top: document.body.scrollHeight });
    if (t.end) clearInterval(taskTimer);
  };
  await paint();
  taskTimer = setInterval(paint, 2000);
}

// ---------------------------------------------------------------- Live agent
// Reads the conversation from disk (Claude: the session .jsonl; AGY: SQLite) every 3 s, only while the page is open.
// The message box is drawn once; only the header and feed update, so what you type isn't wiped.
const WHO = { you: "you", result: "result" };
// Minimal Markdown (bold, code, heading) applied AFTER escaping: conversation text never becomes HTML.
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/^#{1,4} (.+)$/gm, "<b>$1</b>");
let agTimer = null, agLast = "";
async function agentPage(key) {
  clearInterval(agTimer); agLast = "";
  main.innerHTML = `<div class="col"><div id="agent-head"></div><div id="agent-needs"></div><div class="rows feed" id="feed"><p class="empty">Reading the conversation…</p></div>
    <form class="talk" id="talk"><textarea id="msg" rows="2" placeholder="Send a message. Enter sends, Shift+Enter adds a line" aria-label="Message to the agent"></textarea>
      <button class="btn pri" type="submit">Send</button><small id="talk-hint"></small></form></div>`;
  const paint = async () => {
    if (route().pg !== "a" || route().arg !== key) return clearInterval(agTimer);
    const a = await api(`/api/agent?key=${encodeURIComponent(key)}`).catch(() => null);
    if (!a) { main.innerHTML = `<div class="col">${heading("Conversation not found")}<a class="btn" href="#/agents">Back to Agents</a></div>`; return clearInterval(agTimer); }
    const signature = a.live + a.state + a.events.length + (a.events.at(-1)?.txt || "");
    if (signature === agLast) return;
    agLast = signature;
    const status = a.live ? "running" : STATE[a.state] || "idle";
    $("#agent-head").innerHTML = heading(esc(a.title || AGENT_NAME[a.name] || a.name),
      `${esc(AGENT_NAME[a.name] || a.name)} · <span class="mono">${esc(a.cwd)}</span>${a.pid ? ` · pid ${a.pid}` : ""}${a.seconds ? ` · ${duration(a.seconds)}` : ""} · ${status}`);
    $("#agent-needs").innerHTML = a.needs ? `<div class="needs"><p class="label" style="margin:0 0 6px">Needs you</p><p>${fmt(a.needs)}</p></div>` : "";
    $("#talk-hint").textContent = a.name === "agy" ? "Continues this conversation in AGY (agy -p --conversation)."
      : a.live ? "Session open in a terminal: the reply comes in a background copy, and the terminal stays intact."
      : "Continues this session in the background (claude --bg --resume).";
    const atEnd = innerHeight + scrollY >= document.body.scrollHeight - 160;
    $("#feed").innerHTML = a.events.map((e) => `<div class="row ev ${e.t}">
        <span class="x mono">${e.at ? new Date(e.at).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : ""}</span>
        <span class="who">${esc(WHO[e.t] ?? (e.t === "tool" ? e.name : a.name))}</span>
        <span class="msg">${e.t === "text" || e.t === "you" ? fmt(e.txt) : esc(e.txt)}</span></div>`).join("") || empty("Nothing to show yet.");
    if (atEnd) scrollTo({ top: document.body.scrollHeight });
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
}

// ---------------------------------------------------------------- Services
const PIN_STATUS = { ok: "synced", "no-config": "not configured (README › Pinterest)", disconnected: "reconnect Pinterest", error: "error" };
function pinterestRow(s) {
  const p = s.pinterest || PIN;
  const hint = p.status === "disconnected" ? `<a class="link" href="/auth/pinterest">Reconnect Pinterest</a>`
    : p.status === "no-config" ? `<a class="link" href="/auth/pinterest">Connect</a>` : "";
  return `<div class="row"><span class="dot ${p.status === "ok" ? "" : p.status === "error" ? "off" : "idle"}"></span>
    <span class="t"><b>${esc(s.name)}</b><span>${esc(p.status === "error" ? p.error : p.status === "ok" ? s.desc : PIN_STATUS[p.status])}</span></span>
    <span class="x mono">${p.total ?? 0} images${p.last ? ` · ${new Date(p.last).toLocaleString(LOCALE, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
    ${hint}<button class="btn" data-act="pinsync" ${p.syncing || p.status === "no-config" ? "disabled" : ""}>${p.syncing ? "Syncing…" : "Sync now"}</button></div>`;
}
function services() {
  main.innerHTML = `<div class="col">${heading("Services", "Your local apps and Pinterest. Listed in services.json.")}
    <div class="rows">${S.services.map((s) => s.internal === "pinterest" ? pinterestRow(s) : `<div class="row"><span class="dot ${s.ok ? "" : "off"}"></span>
        <span class="t"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></span>
        <span class="x mono">${esc(new URL(remote && address(s) ? address(s) : s.url).host)} · ${s.ok ? `${s.ms} ms` : "down"}</span>
        ${s.ok && address(s) ? `<a class="btn" href="#/s/${esc(s.id)}">View here</a>` : ""}
        <a class="link" href="${esc(remote ? address(s) || "#/services" : s.url)}" target="_blank" rel="noopener">Open ↗</a></div>`).join("") || empty("No services yet. Copy services.example.json to services.json.")}</div></div>`;
}

// ---------------------------------------------------------------- Embedded service
function service(id) {
  const s = S.services.find((x) => x.id === id);
  if (!s || s.internal) { main.innerHTML = empty("Service not found in services.json."); return; }
  const src = address(s), tab = remote ? src : s.url;
  $("#svcbar").innerHTML = `<span class="dot ${s.ok ? "" : "off"}"></span><span class="mono">${esc(new URL(remote && src ? src : s.url).host)}${s.ok ? ` · ${s.ms} ms` : " · down"}</span>
    <button class="link" data-act="reload">Reload</button><a class="link" href="${esc(tab)}" target="_blank" rel="noopener">Open ↗</a>`;
  main.innerHTML = `<div class="frame" style="${s.max ? `max-width:${s.max}px;margin:0 auto` : ""}">
      ${!src ? empty(`${esc(s.name)} isn't published on Tailscale ("tailnet" field in services.json).`)
        : s.ok ? `<iframe id="svcf" src="${esc(src)}" title="${esc(s.name)}"></iframe>` : empty(`${esc(s.name)} is down.`)}</div>`;
}

// ---------------------------------------------------------------- routes and events
const PAGES = { "": home, notes, n: reader, w: wiki, review, graph, agents, services, s: service, a: agentPage, t: taskPage };
function route() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGES[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  graphStop?.(); graphStop = null;
  const { pg, arg } = route();
  document.body.classList.toggle("app", pg === "s");
  if (pg !== "s") $("#svcbar").innerHTML = "";
  main.style.animation = "none"; main.offsetHeight; main.style.animation = "";
  topBar();
  PAGES[pg](arg);
}

const ACTIONS = {
  next: () => move(1), prev: () => move(-1), go: (el) => { idx = Number(el.dataset.i); slides(); },
  filter: (el) => { filter = el.dataset.k; notes(); },
  show: () => { revealed = true; flashcard(); }, yes: () => answer(true), no: () => answer(false),
  enroll: async (el) => { await api("/api/review", { path: el.dataset.p, remembered: false }); toast("In the cycle: first review tomorrow"); D = await api("/api"); render(); },
  routine: async (el) => {
    try { const r = await api("/api/routine", { name: el.dataset.k, agent: $("#run-agent")?.value }); location.hash = `#/t/${r.id}`; } catch (e) { toast(e.message); }
  },
  stop: async (el) => { await api("/api/task/stop", { id: el.dataset.id }).catch(() => {}); toast("Stopping…"); },
  pinsync: async (el) => {
    el.disabled = true; el.textContent = "Syncing…";
    PIN = await api("/api/pinterest/sync", {}).catch(() => PIN);
    toast(PIN.status === "ok" ? `${PIN.images.length} images in the cache` : PIN.error || PIN_STATUS[PIN.status]);
    S = await api("/api/system"); services();
  },
  reload: () => { const f = $("#svcf"); f.src = f.src; },
  capture: () => { $("#capture-day").textContent = D.today; $("#capture").showModal(); $("#capture-text").focus(); },
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (el) { e.preventDefault(); ACTIONS[el.dataset.act]?.(el); }
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
  if (e.target.matches("input, textarea, select") || document.querySelector("dialog[open]") || e.ctrlKey || e.metaKey || e.altKey) return;
  const { pg } = route();
  const cardOpen = pg === "review" && queue[pos];
  if (e.key === "c") { e.preventDefault(); ACTIONS.capture(); return; }
  if (e.key === "/" && pg === "notes") { e.preventDefault(); $("#search").focus(); return; }
  if (!pg && e.key === "ArrowRight") return move(1);
  if (!pg && e.key === "ArrowLeft") return move(-1);
  if (cardOpen) {
    if (e.key === " " && !revealed) { e.preventDefault(); return ACTIONS.show(); }
    if (revealed && e.key === "1") return answer(false);
    if (revealed && e.key === "2") return answer(true);
  }
  const t = screens()[Number(e.key) - 1]; // 1–9 jumps between screens
  if (/^[1-9]$/.test(e.key) && t) location.hash = `#/${t[0]}`;
});

addEventListener("hashchange", render);
async function vault() { D = await api("/api"); }
async function system() { S = await api("/api/system"); }
async function pinterest() { PIN = await api("/api/pinterest").catch(() => PIN); }
// System every 10 s (agents, services), vault when you come back to the tab and every minute.
setInterval(async () => {
  await system(); topBar();
  const { pg } = route();
  if (!pg) panel(); else if (pg === "agents") agentsBody(); else if (pg === "services") services();
}, 10000);
setInterval(async () => { await Promise.all([vault(), pinterest()]); topBar(); if (!route().pg) panel(); }, 60000);
addEventListener("focus", async () => { await vault(); topBar(); const { pg } = route(); if (!pg) { SG = suggestions(); idx = Math.min(idx, SG.length - 1); slides(); panel(); } else if (pg === "notes") grid(); });
setInterval(clock, 1000);
clock();
Promise.all([vault(), system(), pinterest()]).then(render);
