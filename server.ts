// Overlook, a dashboard for an Obsidian vault: reads the Markdown straight from disk on every request. No database, no cache.
// ponytail: scans the whole vault per request; fine up to thousands of notes, cache by mtime if it gets slow.
//   bun server.ts         -> serves http://127.0.0.1:3333
//   bun server.ts map     -> one line per note, so agents can find their way
//   bun server.ts today   -> what the Home shows, as short text for an agent
import { resolve, basename, dirname } from "node:path";
import { readdirSync, readlinkSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { Database } from "bun:sqlite";
import { startPinterest, sync, pinterestState, pinFile, authorizeUrl, authorizeCallback } from "./pinterest";
import { loadAgents, ready, runTask, getTask, stopTask, taskList, routineRunning } from "./tasks";

const ROOT = resolve(process.env.VAULT_DIR || `${homedir()}/dev/obsidian-study-vault`);
const PORT = Number(process.env.PORT) || 3333;
// Machine name on Tailscale, read at startup: survives renaming the machine.
const TAILNET = (() => {
  try { return JSON.parse(Bun.spawnSync(["tailscale", "status", "--json"]).stdout.toString()).Self.DNSName.replace(/\.$/, ""); } catch { return ""; }
})();
// Accepted Host: loopback on the right port or the tailnet name (blocks DNS rebinding without locking out the phone).
const hostOk = (h: string, port: number) =>
  h === `127.0.0.1:${port}` || h === `localhost:${port}` || (!!TAILNET && (h === TAILNET || h.startsWith(`${TAILNET}:`)));
const VAULT = basename(ROOT);
const ART = resolve(process.env.ART_DIR || `${homedir()}/Pictures/Wallpapers`); // card art when there is no Pinterest

// Names the app reads from the vault. The UI is English; the vault follows one of these presets (VAULT_LANG).
const LAYOUTS = {
  en: {
    daily: "2 Daily", focus: "Focus", captured: "Captured", log: "9 Agent/Log.md", findings: "9 Agent/Findings.md",
    keys: { type: "type", review: "review_on", interval: "interval" }, types: {} as Record<string, string>,
    routines: { morning: "Follow the morning routine in the Routines section of AGENTS.md.", inbox: "Follow the inbox routine in the Routines section of AGENTS.md." },
  },
  pt: {
    daily: "2 Diário", focus: "Foco de hoje", captured: "Capturei", log: "9 Agente/Log.md", findings: "9 Agente/Achados.md",
    keys: { type: "tipo", review: "revisar_em", interval: "intervalo" }, types: { projeto: "project", conceito: "concept", diario: "daily" } as Record<string, string>,
    routines: { morning: "Siga a rotina bom-dia da seção Rotinas do AGENTS.md.", inbox: "Siga a rotina inbox da seção Rotinas do AGENTS.md." },
  },
};
const L = LAYOUTS[process.env.VAULT_LANG === "pt" ? "pt" : "en"];
const ROUTINES: Record<string, string> = L.routines;

type Note = {
  path: string; title: string; folder: string; type: string; area: string; tags: string[];
  summary: string; review_on: string; interval: number; mtime: number; links: string[];
};

const today = (days = 0) => new Date(Date.now() + days * 864e5).toLocaleDateString("sv");

function frontmatter(txt: string) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm: Record<string, string> = {};
  for (const l of m?.[1].split("\n") ?? []) {
    const k = l.match(/^(\w+):\s*(.*)$/);
    if (k) fm[k[1]] = k[2].replace(/^["']|["']$/g, "");
  }
  return { fm, body: m ? txt.slice(m[0].length) : txt };
}

// User notes: folders 1-8, minus drawings (7) and templates.
async function notes(): Promise<Note[]> {
  const out: Note[] = [];
  for await (const path of new Bun.Glob("*/*.md").scan(ROOT)) {
    const folder = dirname(path);
    if (!/^[1-8] /.test(folder) || folder.startsWith("7 ") || path.endsWith(".excalidraw.md") || basename(path).startsWith("_")) continue;
    const f = Bun.file(`${ROOT}/${path}`);
    const { fm, body } = frontmatter(await f.text());
    const type = fm[L.keys.type] ?? "";
    out.push({
      path, folder,
      title: body.match(/^# (.+)$/m)?.[1] ?? basename(path, ".md"),
      type: L.types[type] ?? type, area: fm.area ?? "",
      tags: (fm.tags ?? "").replace(/[\[\]]/g, "").split(",").map((t) => t.trim()).filter(Boolean),
      summary: body.match(/> \[!abstract\][^\n]*\n> (.+)/)?.[1] ?? "",
      review_on: fm[L.keys.review] ?? "", interval: Number(fm[L.keys.interval]) || 0,
      mtime: f.lastModified,
      links: [...body.matchAll(/\[\[([^\]|#^]+)/g)].map((x) => x[1].trim().split("/").pop()!),
    });
  }
  return out;
}

// Missing link: a target that exists as .md nowhere in the vault.
async function missing(ns: Note[]) {
  const exists = new Set<string>();
  for await (const p of new Bun.Glob("**/*.md").scan(ROOT)) if (!p.startsWith(".")) exists.add(basename(p, ".md"));
  const n = new Map<string, number>();
  for (const a of ns.flatMap((x) => x.links)) {
    if (!exists.has(a) && !/\.(base|canvas|excalidraw)$/.test(a)) n.set(a, (n.get(a) ?? 0) + 1);
  }
  return [...n].map(([target, n]) => ({ target, n })).sort((a, b) => b.n - a.n);
}

const bullets = async (rel: string) => {
  const f = Bun.file(`${ROOT}/${rel}`);
  return (await f.exists()) ? (await f.text()).split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)) : [];
};

// "## X" section of today's daily note, as bullets.
async function section(name: string) {
  const f = Bun.file(`${ROOT}/${L.daily}/${today()}.md`);
  if (!(await f.exists())) return null;
  const sec = (await f.text()).match(new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"))?.[1] ?? "";
  return sec.split("\n").filter((l) => /^\s*- /.test(l)).map((l) => l.replace(/^\s*- (\[.\] )?/, ""));
}

async function state() {
  const ns = await notes();
  const dailies: string[] = [];
  for await (const p of new Bun.Glob(`${L.daily}/????-??-??.md`).scan(ROOT)) dailies.push(basename(p, ".md"));
  return {
    vault: VAULT, today: today(), daily: L.daily, focus: await section(L.focus), captured: await section(L.captured), dailies,
    notes: ns, missing: (await missing(ns)).slice(0, 10),
    log: (await bullets(L.log)).slice(-30).reverse(),
    findings: await bullets(L.findings),
    art: art().length,
    pins: pinterestState().images,
  };
}

// Spaced review: remembered doubles the interval, forgot resets it to 1.
async function review(path: string, remembered: boolean) {
  const note = (await notes()).find((n) => n.path === path); // known paths only: no ../
  if (!note) return null;
  const interval = remembered ? Math.max(1, note.interval * 2) : 1;
  const review_on = today(interval);
  const f = Bun.file(`${ROOT}/${path}`);
  const txt = (await f.text()).replace(/^---\n([\s\S]*?)\n---/, (_, fm: string) => {
    const set = (s: string, k: string, v: string | number) =>
      new RegExp(`^${k}:`, "m").test(s) ? s.replace(new RegExp(`^${k}:.*$`, "m"), `${k}: ${v}`) : `${s}\n${k}: ${v}`;
    return `---\n${set(set(fm, L.keys.review, review_on), L.keys.interval, interval)}\n---`;
  });
  await Bun.write(f, txt);
  return { review_on, interval };
}

// Note rendered for the reader. Wikilinks become internal routes; embeds become a hint.
async function note(path: string) {
  const ns = await notes();
  const n = ns.find((x) => x.path === path);
  if (!n) return null;
  const { body } = frontmatter(await Bun.file(`${ROOT}/${path}`).text());
  const md = body
    .replace(/^# .+\n/m, "")
    .replace(/!\[\[([^\]]+)\]\]/g, (_, a) => `*Drawing: ${a.replace(/\.excalidraw(\.md)?$/, "")} (open in Obsidian)*`)
    .replace(/\[\[([^\]|#^]+)[^\]|]*(?:\|([^\]]+))?\]\]/g, (_, a, b) => `[${b ?? a}](#/w/${encodeURIComponent(a.trim())})`);
  const name = basename(path, ".md");
  return {
    ...n, html: Bun.markdown.html(md),
    backlinks: ns.filter((x) => x.links.includes(name)).map(({ path, title }) => ({ path, title })),
  };
}

// Captures go under the captured section of today's note: a capture is not a permanent note.
async function capture(text: string) {
  const f = Bun.file(`${ROOT}/${L.daily}/${today()}.md`);
  const template = Bun.file(`${ROOT}/${L.daily}/_Template.md`);
  const ls = ((await f.exists()) ? await f.text() : (await template.exists()) ? await template.text() : `## ${L.captured}\n`).split("\n");
  let i = ls.indexOf(`## ${L.captured}`);
  if (i < 0) { ls.push("", `## ${L.captured}`); i = ls.length - 1; }
  let j = i + 1;
  while (j < ls.length && !ls[j].startsWith("## ")) j++;
  while (j > i + 1 && !ls[j - 1].trim()) j--; // goes after the last item, before the blank line
  ls.splice(j, 0, `- ${text.replace(/\s+/g, " ").trim()}`);
  await Bun.write(f, ls.join("\n"));
}

// 4K wallpapers are heavy in the browser and over Tailscale: serve a 1600px copy, generated once.
// ponytail: generated on first request, blocking the server ~0.3 s per image; pre-generate if it bothers.
const CACHE = `${homedir()}/.cache/hq-arte`;
// "amb" is the ambient background: tiny, already blurred and darkened, so the CSS needs no filter (it cost ~10 fps).
async function thumbnail(name: string, amb: boolean) {
  const out = `${CACHE}/${name.replace(/\.\w+$/, "")}${amb ? "-amb" : ""}.jpg`;
  if (!(await Bun.file(out).exists())) {
    mkdirSync(CACHE, { recursive: true });
    const args = amb ? ["-resize", "160x160>", "-blur", "0x5", "-modulate", "50,135"] : ["-resize", "1600x1600>"];
    if (Bun.spawnSync(["magick", `${ART}/${name}`, ...args, "-quality", "78", out]).exitCode !== 0) return Bun.file(`${ART}/${name}`);
  }
  return Bun.file(out);
}

function art() {
  try { return readdirSync(ART).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort(); } catch { return []; }
}

// Live agents: processes named in agents.json (claude/agy/codex/gemini by default), with the folder they run in.
// "key" identifies the conversation (c:<session> for Claude, g:<conversation> for AGY): the agent page outlives the process.
const CLAUDE = Bun.which("claude") ?? `${homedir()}/.local/bin/claude`, AGY = Bun.which("agy") ?? `${homedir()}/.local/bin/agy`;
const AGY_BASE = `${homedir()}/.gemini/antigravity-cli`;
const readJson = (f: string) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } };
function agents() {
  const out = Bun.spawnSync(["ps", "-eo", "pid=,etimes=,comm="]).stdout.toString();
  const agyConversations = readJson(`${AGY_BASE}/cache/last_conversations.json`) ?? {};
  const names = new Set(loadAgents(import.meta.dir).map((a) => a.process).filter(Boolean));
  return out.trim().split("\n").map((l) => l.trim().split(/\s+/)).filter(([, , c]) => names.has(c)).map(([pid, et, comm]) => {
    let cwd = ""; try { cwd = readlinkSync(`/proc/${pid}/cwd`); } catch {}
    const sid = comm === "claude" ? readJson(`${homedir()}/.claude/sessions/${pid}.json`)?.sessionId : comm === "agy" ? agyConversations[cwd] : null;
    return { pid: Number(pid), name: comm, seconds: Number(et), cwd: cwd.replace(homedir(), "~"), key: sid ? `${comm === "agy" ? "g" : "c"}:${sid}` : "" };
  }).filter((a) => a.name !== "claude" || a.key); // claude without a session is a passing CLI call (e.g. the `claude agents` Overlook itself runs)
}

// Claude sessions, including background ones with no process (`claude agents --json`). 15 s cache: the CLI costs ~0.5 s.
let sessionsCache = { t: 0, list: [] as any[] };
async function claudeSessions() {
  if (Date.now() - sessionsCache.t < 15000) return sessionsCache.list;
  try {
    const p = Bun.spawn([CLAUDE, "agents", "--json", "--all"], { stdout: "pipe", stderr: "ignore" });
    sessionsCache = { t: Date.now(), list: JSON.parse(await new Response(p.stdout).text()) };
  } catch { sessionsCache.t = Date.now(); }
  return sessionsCache.list;
}
async function background() {
  return (await claudeSessions()).filter((x) => x.kind === "background" && !x.pid).sort((a, b) => b.startedAt - a.startedAt).slice(0, 8)
    .map((x) => ({ key: `c:${x.sessionId}`, title: x.name ?? x.id, state: x.state ?? "", cwd: String(x.cwd ?? "").replace(homedir(), "~"), since: x.startedAt,
      needs: x.state === "blocked" ? readJson(`${homedir()}/.claude/jobs/${x.id}/state.json`)?.needs ?? "" : "" }));
}

type Service = { id: string; name: string; url: string; desc: string; icon?: string; dock?: boolean; width?: number; max?: number; proxy?: number; tailnet?: number; internal?: string };
// services.json is personal (not in git); without it the list is empty.
const serviceList = (): Promise<Service[]> => Bun.file(`${import.meta.dir}/services.json`).json().catch(() => []);

// What an agent is doing, read from its conversation on disk. Read-only.
type Event = { t: "you" | "text" | "tool" | "result"; txt: string; name?: string; at?: string };
const clip = (s: string, n = 600) => (s.length > n ? s.slice(0, n) + "…" : s);
const ID = /^[0-9a-f-]{8,64}$/; // session/conversation ids become file paths: hex and dash only, no ../

async function claudeConversation(sessionId: string): Promise<Event[]> {
  let file = "";
  for await (const p of new Bun.Glob(`*/${sessionId}.jsonl`).scan(`${homedir()}/.claude/projects`)) { file = `${homedir()}/.claude/projects/${p}`; break; }
  if (!file) return [];
  const f = Bun.file(file);
  // ponytail: reads only the last 1 MB of the conversation; enough for recent events.
  const txt = await f.slice(Math.max(0, f.size - 1_000_000)).text();
  const ev: Event[] = [];
  for (const l of txt.split("\n").slice(1)) {
    let d: any; try { d = JSON.parse(l); } catch { continue; }
    if (d.isMeta || !d.message || (d.type !== "user" && d.type !== "assistant")) continue; // internal copies (api-request-blob etc.) stay out
    const at = d.timestamp, c = d.message.content;
    const items = typeof c === "string" ? [{ type: "text", text: c }] : Array.isArray(c) ? c : [];
    for (const x of items) {
      if (x.type === "text" && x.text?.trim() && !x.text.startsWith("<")) ev.push({ t: d.type === "user" ? "you" : "text", txt: clip(x.text.trim(), 1500), at });
      else if (x.type === "tool_use") {
        const i = x.input ?? {};
        ev.push({ t: "tool", name: x.name, txt: clip(String(i.description ?? i.command ?? i.file_path ?? i.pattern ?? i.url ?? i.prompt ?? JSON.stringify(i)), 300), at });
      } else if (x.type === "tool_result") {
        const r = Array.isArray(x.content) ? x.content.map((y: any) => y.text ?? "").join(" ") : String(x.content ?? "");
        if (r.trim()) ev.push({ t: "result", txt: clip(r.trim(), 400), at });
      }
    }
  }
  return ev.slice(-80);
}

// AGY stores steps as protobuf with no public schema: pull the readable runs out of each step.
// ponytail: text heuristic; if AGY's format changes, this shows less, it doesn't break.
async function agyConversation(id: string): Promise<Event[]> {
  const file = `${AGY_BASE}/conversations/${id}.db`;
  if (!id || !(await Bun.file(file).exists())) return [];
  const db = new Database(file, { readonly: true });
  try {
    const rows = db.query("select step_type, step_payload from steps order by idx desc limit 120").all() as { step_type: number; step_payload: Uint8Array }[];
    const ev: Event[] = [];
    for (const r of rows.reverse()) {
      const parts = new TextDecoder().decode(r.step_payload ?? new Uint8Array()).match(/[\p{L}\p{N}\p{P}\p{Zs}\n`$/~<>=+|*-]{12,}/gu) ?? [];
      const sentences = parts.map((p) => p.replace(/^[^\p{L}`*\/(\[]+/u, "").replace(/["Z\s]+$/, "").trim())
        .filter((p) => p.split(" ").length > 3 && !/"\w+":/.test(p)); // drop the tool-call JSON
      if (r.step_type === 14 && sentences.length) ev.push({ t: "you", txt: clip(sentences[sentences.length - 1]) });
      else if (r.step_type === 132) {
        const j = parts.find((p) => p.includes("{"));
        let det = ""; try { const o = JSON.parse(j!.slice(j!.indexOf("{"), j!.lastIndexOf("}") + 1)); det = o.toolSummary ?? o.CommandLine ?? o.Path ?? ""; } catch {}
        const name = new TextDecoder().decode(r.step_payload).match(/call_\d+[^a-z_]*([a-z_]{3,})/)?.[1] ?? "tool";
        ev.push({ t: "tool", name, txt: clip(String(det || j || "").replace(homedir(), "~"), 300) });
      } else if (r.step_type === 15 && sentences.length) ev.push({ t: "text", txt: clip(sentences[sentences.length - 1], 1500) });
    }
    return ev.slice(-80);
  } finally { db.close(); }
}

async function agent(key: string) {
  const kind = key.slice(0, 2), id = key.slice(2);
  if ((kind !== "c:" && kind !== "g:") || !ID.test(id)) return null;
  const live = agents().find((a) => a.key === key);
  if (kind === "g:") {
    const events = await agyConversation(id);
    if (!events.length && !live) return null;
    const folder = Object.entries(readJson(`${AGY_BASE}/cache/last_conversations.json`) ?? {}).find(([, v]) => v === id)?.[0] ?? "";
    return { name: "agy", key, live: !!live, pid: live?.pid, seconds: live?.seconds, cwd: live?.cwd ?? folder.replace(homedir(), "~"), events };
  }
  let events = await claudeConversation(id);
  const s = (await claudeSessions()).find((x) => x.sessionId === id);
  // A background session keeps state and timeline in ~/.claude/jobs/<short id>; used when the conversation is already gone.
  const job = readJson(`${homedir()}/.claude/jobs/${id.slice(0, 8)}/state.json`);
  if (!events.length) {
    const tl = await Bun.file(`${homedir()}/.claude/jobs/${id.slice(0, 8)}/timeline.jsonl`).text().catch(() => "");
    events = tl.split("\n").flatMap((l) => { try { const d = JSON.parse(l); return [{ t: "text" as const, txt: clip(d.text || `${d.state}: ${d.detail}`, 1500), at: d.at }]; } catch { return []; } }).slice(-80);
  }
  if (!events.length && !live && !s) return null;
  return { name: "claude", key, live: !!live, pid: live?.pid, seconds: live?.seconds, cwd: live?.cwd ?? String(s?.cwd ?? "").replace(homedir(), "~"),
    title: s?.name, state: s?.state, needs: job?.needs ?? "", events };
}

// Talk to an agent. Claude: `claude --bg --resume` continues the session in the background; if it is open in a
// terminal, it makes a copy (the terminal stays intact) and returns its id. AGY: `agy -p --conversation`.
async function talk(key: string, text: string) {
  const a = await agent(key);
  if (!a) return null;
  const cwd = a.cwd.replace(/^~/, homedir()) || homedir();
  if (a.name === "agy") {
    Bun.spawn([AGY, "-p", text, "--conversation", key.slice(2), "--mode", "auto", "--print-timeout", "10m"], { cwd, stdout: "ignore", stderr: "ignore" });
    return { key };
  }
  const p = Bun.spawn([CLAUDE, "--bg", "--resume", key.slice(2), text], { cwd, stdout: "pipe", stderr: "pipe" });
  const output = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  await p.exited;
  sessionsCache.t = 0;
  const short = output.match(/\b[0-9a-f]{8}\b/)?.[0];
  const copy = short ? (await claudeSessions()).find((x) => x.id === short || String(x.sessionId).startsWith(short)) : null;
  return { key: copy ? `c:${copy.sessionId}` : key, output: clip(output.trim(), 300) };
}

async function services() {
  const list = await serviceList();
  return Promise.all(list.map(async (s) => {
    if (s.internal === "pinterest") { const p = pinterestState(); return { ...s, ok: p.status === "ok", ms: 0, pinterest: p }; } // not localhost: status comes from the sync
    const t = performance.now();
    try {
      const r = await fetch(s.url, { signal: AbortSignal.timeout(1500) });
      return { ...s, ok: r.ok, ms: Math.round(performance.now() - t) };
    } catch { return { ...s, ok: false, ms: 0 }; }
  }));
}

// Agents you can put to work from the Agents page, from agents.json (or the built-in CLIs).
const runners = () => loadAgents(import.meta.dir).filter((a) => a.run || a.api)
  .map((a) => ({ id: a.id, name: a.name, kind: a.run ? "cli" : a.api, ready: ready(a) }));
const started = (t: ReturnType<typeof runTask>) => (typeof t === "string" ? new Response(t, { status: 400 }) : json({ id: t.id }));

const cmd = process.argv[2];
if (cmd === "map") {
  for (const n of (await notes()).sort((a, b) => a.path.localeCompare(b.path)))
    console.log(`${n.path} · ${n.type || "-"} · ${n.summary || "(no summary)"}`);
  process.exit(0);
}
if (cmd === "agy") { // bun server.ts agy <folder>: what AGY did in the last conversation in that folder
  for (const e of await agyConversation(readJson(`${AGY_BASE}/cache/last_conversations.json`)?.[resolve(process.argv[3] ?? ROOT)] ?? "")) console.log(`${e.t.padEnd(10)} ${e.name ?? ""} ${e.txt.replace(/\n/g, " ").slice(0, 160)}`);
  process.exit(0);
}
if (cmd === "today") {
  const e = await state();
  const list = (t: string, xs: string[]) => console.log(`${t}:\n${xs.map((x) => `  ${x}`).join("\n") || "  (none)"}`);
  console.log(`today: ${e.today} · daily note: ${e.focus ? "exists" : "missing"}`);
  list("focus", e.focus ?? []);
  list("captured", e.captured ?? []);
  list("review", e.notes.filter((n) => n.review_on && n.review_on <= e.today).map((n) => `${n.review_on} ${n.path}`));
  list("inbox", e.notes.filter((n) => n.folder.startsWith("1 ")).map((n) => n.path));
  list("gaps", e.missing.map((v) => `${v.n}× ${v.target}`));
  list("projects", e.notes.filter((n) => n.type === "project").map((n) => `${n.path} · ${n.summary}`));
  list("log", e.log.slice(0, 5));
  process.exit(0);
}

const json = (x: unknown) => (x ? Response.json(x) : new Response("not found", { status: 404 }));
const STATIC = new Set(["/app.js", "/app.css"]);
const GRAFITE = new Set(["/grafite/app.js", "/grafite/app.css", "/grafite/tokens.css"]);
const PORT_V2 = PORT + 2;
// Minimal OAuth landing page (escaped text: the message may come from Pinterest).
const page = (t: string, msg: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>
<body style="background:#121212;color:#EAE8E3;font:15px/1.6 system-ui;display:grid;place-items:center;min-height:90vh;margin:0;padding:24px">
<main style="max-width:520px"><h1 style="font-weight:400">${t}</h1><p style="color:#A3A19C">${msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p><p><a style="color:#F2B48C" href="/#/services">Back to Services →</a></p></main>`, { headers: { "content-type": "text/html; charset=utf-8" } });

startPinterest(`${TAILNET ? `https://${TAILNET}` : `http://127.0.0.1:${PORT}`}/auth/pinterest/callback`); // Tailscale HTTPS redirect

async function handle(req: Request, port: number) {
  const url = new URL(req.url);
  const p = url.pathname;
  if (req.method === "POST") {
    // Against other sites posting to localhost: JSON forces a preflight (no CORS here) and Host blocks DNS rebinding.
    if (req.headers.get("content-type") !== "application/json" || !hostOk(req.headers.get("host") ?? "", port))
      return new Response("forbidden", { status: 403 });
    const b = await req.json();
    if (p === "/api/review") return json(typeof b.path === "string" && (await review(b.path, !!b.remembered)));
    if (p === "/api/capture" && typeof b.text === "string" && b.text.trim()) { await capture(b.text.slice(0, 2000)); return json({ ok: true }); }
    if (p === "/api/talk") return typeof b.key === "string" && typeof b.text === "string" && b.text.trim() ? json(await talk(b.key, b.text.trim().slice(0, 4000))) : new Response("missing text", { status: 400 });
    if (p === "/api/pinterest/sync") return json(await sync(true));
    if (p === "/api/run") return typeof b.agent === "string" && typeof b.prompt === "string" && b.prompt.trim() ? started(runTask(ROOT, import.meta.dir, b.agent, b.prompt.trim().slice(0, 8000))) : new Response("missing prompt", { status: 400 });
    if (p === "/api/routine") return !ROUTINES[b.name] || routineRunning(b.name) ? new Response("already running or unknown", { status: 409 }) : started(runTask(ROOT, import.meta.dir, String(b.agent), ROUTINES[b.name], b.name));
    if (p === "/api/task/stop") return json(stopTask(String(b.id)) && { ok: true });
    return new Response("404", { status: 404 });
  }
  if (p === "/api") return json(await state());
  if (p === "/api/pinterest") return json(pinterestState());
  if (p === "/api/note") return json(await note(url.searchParams.get("path") ?? ""));
  if (p === "/api/agent") return json(await agent(url.searchParams.get("key") ?? ""));
  if (p === "/api/task") return json(getTask(url.searchParams.get("id") ?? ""));
  if (p === "/api/system") return json({ agents: agents(), background: await background(), services: await services(), runners: runners(), tasks: taskList(), agentsMd: existsSync(`${ROOT}/AGENTS.md`) });
  if (p.startsWith("/art/")) {
    const a = art(), i = Number(p.slice(5));
    return Number.isInteger(i) && a.length
      ? new Response(await thumbnail(a[i % a.length], url.searchParams.has("amb")), { headers: { "cache-control": "max-age=86400" } })
      : new Response("404", { status: 404 });
  }
  if (STATIC.has(p)) return new Response(Bun.file(`${import.meta.dir}${p}`));
  if (p === "/grafite") return Response.redirect("/grafite/", 301);
  if (p === "/grafite/") return new Response(Bun.file(`${import.meta.dir}/grafite/index.html`));
  if (GRAFITE.has(p)) return new Response(Bun.file(`${import.meta.dir}${p}`));
  if (p.startsWith("/v2")) return Response.redirect("/", 302);
  if (p.startsWith("/pin/")) { const f = await pinFile(p.slice(5), url.searchParams.has("amb")); return f ? new Response(f, { headers: { "cache-control": "max-age=86400" } }) : new Response("404", { status: 404 }); }
  if (p === "/auth/pinterest") { const u = authorizeUrl(); return u ? Response.redirect(u, 302) : page("Not configured", "Set PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET in Overlook's .env and restart the server."); }
  if (p === "/auth/pinterest/callback") { const error = await authorizeCallback(url); return page(error ? "Not connected" : "Pinterest connected", error || `${pinterestState().total} images in the cache.`); }
  if (p === "/") return new Response(Bun.file(`${import.meta.dir}/index.html`));
  return new Response("404", { status: 404 });
}

Bun.serve({ hostname: "127.0.0.1", port: PORT, fetch: (req) => handle(req, PORT) });
Bun.serve({ hostname: "127.0.0.1", port: PORT_V2, fetch: (req) => handle(req, PORT_V2) });
console.log(`Overlook on http://127.0.0.1:${PORT} · v2 on http://127.0.0.1:${PORT_V2}`);

// A service that forbids iframes (X-Frame-Options DENY) gets a proxy that only allows Overlook as the frame.
// The embedded app keeps calling its API on the target directly, so the target must allow 127.0.0.1:<proxy> in its CORS.
for (const s of await serviceList()) {
  if (!s.proxy) continue;
  const target = new URL(s.url);
  Bun.serve({
    hostname: "127.0.0.1", port: s.proxy,
    async fetch(req) {
      const host = req.headers.get("host") ?? "";
      if (!hostOk(host, s.proxy!)) return new Response("forbidden", { status: 403 });
      const u = new URL(req.url);
      const h = new Headers(req.headers);
      h.delete("host");
      const r = await fetch(target.origin + u.pathname + u.search, {
        method: req.method, headers: h, redirect: "manual",
        body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      });
      const rh = new Headers(r.headers);
      rh.delete("x-frame-options"); rh.delete("content-encoding"); rh.delete("content-length"); // fetch already decompressed
      const csp = rh.get("content-security-policy");
      if (csp) rh.set("content-security-policy", csp.replace("frame-ancestors 'none'", `frame-ancestors http://127.0.0.1:${PORT} http://localhost:${PORT} http://127.0.0.1:${PORT_V2} http://localhost:${PORT_V2}${TAILNET ? ` https://${TAILNET}` : ""}`));
      return new Response(r.body, { status: r.status, headers: rh });
    },
  });
  console.log(`${s.name} proxy on http://127.0.0.1:${s.proxy}`);
}
