// Agents Overlook can put to work on the vault. CLI agents (claude, agy, codex...) are spawned in the vault folder;
// API agents (Anthropic, or any OpenAI-compatible endpoint) work through four tools jailed to the vault's notes.
// Tasks live in memory. ponytail: lost on restart; persist them if the history starts to matter.
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { realpathSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

// models/efforts list what the task form offers (first model, and `effort` or the first effort, are the defaults).
// A model is an id or { id, label, efforts } when it has a display name or its own effort levels;
// a CLI agent receives the choice through {model} and {effort} in `run`, and {session} gets a fresh UUID per task.
// open: "Open in…" commands for a session, with {session}, {cwd}, and {terminal} (the user's terminal) as the first token.
export type Agent = {
  id: string; name: string; process?: string; run?: string[]; api?: "anthropic" | "openai"; url?: string; key?: string;
  model?: string; models?: (string | Model)[]; effort?: string; efforts?: string[]; open?: Record<string, string[]>;
};
type Model = { id: string; label?: string; efforts?: string[] };
type Event = { t: "you" | "text" | "tool" | "result" | "error"; txt: string; name?: string; at: string };
type Task = { id: string; agent: string; model: string; effort: string; session?: string; prompt: string; routine?: string; start: string; end?: string; ok?: boolean; events: Event[]; stop?: () => void };

// Without agents.json: the CLIs Overlook always knew about. A CLI shows up as runnable only when it is on the PATH.
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const DEFAULTS: Agent[] = [
  { id: "claude", name: "Claude Code", process: "claude", efforts: EFFORTS, effort: "high",
    models: [{ id: "opus", label: "Opus" }, { id: "sonnet", label: "Sonnet" }, { id: "haiku", label: "Haiku" }],
    run: ["claude", "-p", "{prompt}", "--session-id", "{session}", "--model", "{model}", "--effort", "{effort}", "--permission-mode", "acceptEdits"],
    open: { Terminal: ["{terminal}", "claude", "--resume", "{session}"] } },
  { id: "agy", name: "Antigravity", process: "agy", efforts: EFFORTS, effort: "high",
    run: ["agy", "-p", "{prompt}", "--effort", "{effort}", "--mode", "auto", "--print-timeout", "10m"],
    open: { Terminal: ["{terminal}", "agy", "--conversation", "{session}"], "Antigravity app": ["antigravity", "{cwd}"] } },
  { id: "codex", name: "Codex", process: "codex", run: ["codex", "exec", "{prompt}"] },
  { id: "gemini", name: "Gemini", process: "gemini", run: ["gemini", "-p", "{prompt}"] },
];
const MAX_TURNS = 40;
const TIMEOUT = 30 * 60_000;
const ANTHROPIC_MODELS: Model[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" }, { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }, { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
];
// Models that take the server-side refusal fallback ("default" picks the substitute by refusal category).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

// agents.json is personal (not in git) and read on every call, so edits apply without a restart.
export function loadAgents(dir: string): Agent[] {
  try { return JSON.parse(readFileSync(`${dir}/agents.json`, "utf8")); } catch { return DEFAULTS; }
}
// A service manager's PATH often lacks ~/.local/bin, where most agent CLIs install themselves.
const bin = (cmd: string) => Bun.which(cmd) ?? [`${homedir()}/.local/bin/${cmd}`].find(existsSync) ?? null;
const keyOk = (a: Agent) => !a.key || !!process.env[a.key];
export const efforts = (a: Agent) => a.efforts ?? (a.api === "anthropic" ? EFFORTS : []);
export const models = (a: Agent) => (a.models ?? (a.model ? [a.model] : a.api === "anthropic" ? ANTHROPIC_MODELS : []))
  .map((m) => (typeof m === "string" ? { id: m, label: m, efforts: efforts(a) } : { id: m.id, label: m.label ?? m.id, efforts: m.efforts ?? efforts(a) }));
export const defaultEffort = (a: Agent) => a.effort ?? (a.api === "anthropic" ? "high" : efforts(a)[0] ?? "");
export const ready = (a: Agent) => (a.run ? !!bin(a.run[0]) : a.api === "anthropic" ? !!a.key && keyOk(a) : a.api === "openai" ? models(a).length > 0 && keyOk(a) : false);

const tasks = new Map<string, Task>();
const now = () => new Date().toISOString();
const clip = (s: string, n = 600) => (s.length > n ? s.slice(0, n) + "…" : s);
const MESSAGE = 20_000; // a whole message reads in full; the cap only guards against a runaway one
const log = (task: Task, e: Omit<Event, "at">) => { task.events.push({ ...e, at: now() }); if (task.events.length > 300) task.events.shift(); };

export const taskList = () => [...tasks.values()].reverse().map(({ events, stop, ...t }) => ({ ...t, prompt: clip(t.prompt, 160) }));
export const getTask = (id: string) => { const t = tasks.get(id); if (!t) return null; const { stop, ...rest } = t; return rest; };
export const stopTask = (id: string) => { const t = tasks.get(id); if (!t?.stop || t.end) return false; t.stop(); return true; };
export const routineRunning = (name: string) => [...tasks.values()].some((t) => t.routine === name && !t.end);

type RunOpts = { model?: string; effort?: string; routine?: string };
// The agent and the model/effort it will run with, or why it can't run.
function resolveRun(dir: string, agentId: string, opts: RunOpts) {
  const a = loadAgents(dir).find((x) => x.id === agentId);
  if (!a) return "unknown agent";
  if (!ready(a)) return a.run ? `${a.run[0]} is not on the PATH` : `${a.name} needs ${a.api === "openai" && !models(a).length ? "a model in agents.json" : `${a.key ?? "a key"} set in .env`}`;
  // Only values the agent lists: they end up as CLI arguments.
  const ms = models(a), m = opts.model ? ms.find((x) => x.id === opts.model) : ms[0];
  if (opts.model && !m) return `${a.name} has no model "${opts.model}"`;
  const es = m?.efforts ?? efforts(a);
  if (opts.effort && !es.includes(opts.effort)) return `${a.name} has no effort "${opts.effort}"${m ? ` for ${m.label}` : ""}`;
  return { a, model: m?.id ?? "", effort: opts.effort || (es.includes(defaultEffort(a)) ? defaultEffort(a) : es[0] ?? "") };
}

export function runTask(root: string, dir: string, agentId: string, prompt: string, opts: RunOpts = {}) {
  const r = resolveRun(dir, agentId, opts);
  if (typeof r === "string") return r;
  const { a, model, effort } = r;
  const session = a.run?.some((x) => x.includes("{session}")) ? crypto.randomUUID() : undefined;
  const task: Task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), agent: a.id, model, effort, session, prompt, routine: opts.routine, start: now(), events: [] };
  tasks.set(task.id, task);
  if (tasks.size > 50) tasks.delete(tasks.keys().next().value!);
  log(task, { t: "you", txt: prompt });
  const ctrl = new AbortController();
  const timer = setTimeout(() => { log(task, { t: "error", txt: "timed out after 30 min" }); task.stop?.(); }, TIMEOUT);
  const work = a.run ? cli(a, root, task, ctrl) : a.api === "anthropic" ? anthropic(a, root, task, ctrl.signal) : openai(a, root, task, ctrl.signal);
  task.stop ??= () => ctrl.abort();
  work.then((ok) => (task.ok = ok), (e) => { task.ok = false; log(task, { t: "error", txt: ctrl.signal.aborted ? "stopped" : String(e?.message ?? e) }); })
    .finally(() => { task.end = now(); clearTimeout(timer); });
  return task;
}

// ---------------------------------------------------------------- CLI agents
async function cli(a: Agent, root: string, task: Task, ctrl: AbortController) {
  const [cmd, ...rest] = a.run!;
  // An empty {model}/{effort} drops the token and the flag before it, so the CLI falls back to its own default.
  const args: string[] = [];
  for (const x of rest) {
    const v = x.replaceAll("{prompt}", task.prompt).replaceAll("{model}", task.model).replaceAll("{effort}", task.effort).replaceAll("{session}", task.session ?? "");
    if (/\{(model|effort)\}/.test(x) && !(x.includes("{model}") ? task.model : task.effort)) { if (args.at(-1)?.startsWith("-")) args.pop(); continue; }
    args.push(v);
  }
  const p = Bun.spawn([bin(cmd)!, ...args], { cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  task.stop = () => { ctrl.abort(); p.kill(); };
  await Promise.all([
    lines(p.stdout, (l) => log(task, { t: "text", txt: clip(l, MESSAGE) })),
    lines(p.stderr, (l) => log(task, { t: "result", txt: clip(l, 400) })),
  ]);
  const code = await p.exited;
  if (ctrl.signal.aborted) throw new Error("stopped");
  return code === 0;
}
// ---------------------------------------------------------------- Scheduled tasks
// schedule.json is personal (not in git): agent tasks that run at a local date and time, once or on repeat.
// A run missed while Overlook was down happens once at startup, then the next one is set in the future.
type Repeat = "once" | "daily" | "weekdays" | "weekly";
type Scheduled = { id: string; at: string; repeat: Repeat; agent: string; model?: string; effort?: string; prompt: string; last?: string; error?: string };
const REPEATS = new Set(["once", "daily", "weekdays", "weekly"]);
const scheduleFile = (dir: string) => `${dir}/schedule.json`;
export const loadSchedule = (dir: string): Scheduled[] => { try { return JSON.parse(readFileSync(scheduleFile(dir), "utf8")); } catch { return []; } };
const saveSchedule = (dir: string, xs: Scheduled[]) => writeFileSync(scheduleFile(dir), JSON.stringify(xs, null, 1)); // sync: the next read must see it
const local = (d: Date) => `${d.toLocaleDateString("sv")}T${d.toTimeString().slice(0, 5)}`;
function nextRun(at: string, repeat: Repeat, now: number) {
  const d = new Date(at);
  do {
    d.setDate(d.getDate() + (repeat === "weekly" ? 7 : 1));
    while (repeat === "weekdays" && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() + 1);
  } while (d.getTime() <= now);
  return local(d);
}
export function addScheduled(root: string, dir: string, e: Partial<Scheduled>) {
  if (typeof e.at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.at) || isNaN(Date.parse(e.at))) return "at must be YYYY-MM-DDTHH:MM";
  if (!REPEATS.has(String(e.repeat))) return "repeat must be once, daily, weekdays or weekly";
  const prompt = String(e.prompt ?? "").trim().slice(0, 8000);
  if (!prompt) return "missing prompt";
  const r = resolveRun(dir, String(e.agent), { model: e.model || undefined, effort: e.effort || undefined });
  if (typeof r === "string") return r;
  const entry: Scheduled = { id: crypto.randomUUID().slice(0, 8), at: e.at, repeat: e.repeat as Repeat, agent: r.a.id, model: r.model, effort: r.effort, prompt };
  saveSchedule(dir, [...loadSchedule(dir), entry]);
  tick(root, dir); // already due: runs now
  return entry;
}
export function removeScheduled(dir: string, id: string) {
  const xs = loadSchedule(dir), left = xs.filter((x) => x.id !== id);
  if (left.length === xs.length) return false;
  saveSchedule(dir, left);
  return true;
}
function tick(root: string, dir: string) {
  const now = Date.now(), xs = loadSchedule(dir);
  let changed = false;
  for (const e of xs) {
    if (new Date(e.at).getTime() > now || (e.repeat === "once" && e.error)) continue; // a one-off that failed waits to be deleted
    const r = runTask(root, dir, e.agent, e.prompt, { model: e.model || undefined, effort: e.effort || undefined });
    const error = typeof r === "string" ? r : undefined;
    Object.assign(e, { last: new Date(now).toISOString(), error, at: e.repeat !== "once" ? nextRun(e.at, e.repeat, now) : error ? e.at : "" });
    changed = true;
  }
  if (changed) saveSchedule(dir, xs.filter((e) => e.at));
}
export function startScheduler(root: string, dir: string) {
  tick(root, dir);
  setInterval(() => tick(root, dir), 30_000);
}

// ---------------------------------------------------------------- Open in…
const terminal = () => { const x = bin("xdg-terminal-exec"); return x ? [x] : process.env.TERMINAL ? [process.env.TERMINAL, "-e"] : null; };
export const openers = (a: Agent) => Object.entries(a.open ?? {}).map(([label, cmd]) => ({ label, session: cmd.some((x) => x.includes("{session}")) }));
// Launches detached; the caller has already validated session and cwd.
export function openIn(a: Agent, label: string, cwd: string, session = "") {
  const cmd = a.open?.[label];
  if (!cmd) return `${a.name} has no "${label}"`;
  if (cmd.some((x) => x.includes("{session}")) && !session) return "no session to open";
  const [head, ...rest] = cmd.map((x) => x.replaceAll("{session}", session).replaceAll("{cwd}", cwd));
  let args: string[];
  if (head === "{terminal}") {
    const t = terminal();
    if (!t) return "no terminal found: install xdg-terminal-exec or set TERMINAL in .env";
    // The terminal may open in its own default folder, and a resumed session belongs to its project folder.
    args = [...t, "sh", "-c", 'cd "$0" && exec "$@"', cwd, bin(rest[0]) ?? rest[0], ...rest.slice(1)];
  } else {
    if (!bin(head)) return `${head} is not installed`;
    args = [bin(head)!, ...rest];
  }
  Bun.spawn(args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
  return true;
}

async function lines(stream: ReadableStream<Uint8Array>, on: (l: string) => void) {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of stream) {
    buf += dec.decode(chunk, { stream: true });
    const ls = buf.split("\n");
    buf = ls.pop()!;
    for (const l of ls) if (l.trim()) on(l);
  }
  if (buf.trim()) on(buf);
}

// ---------------------------------------------------------------- vault tools for API agents
const TOOLS = [
  { name: "list_notes", description: "List every Markdown note in the vault, one path per line, relative to the vault root.",
    schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "search_notes", description: "Case-insensitive text search across all notes. Returns up to 50 matching lines as path:line: text.",
    schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { name: "read_note", description: 'Read one note. path is relative to the vault root, e.g. "3 Concepts/HTTP.md".',
    schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } },
  { name: "write_note", description: "Create a note or replace it with the full new content. Only .md files inside the vault. Read a note before replacing it.",
    schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } },
];

// A path the agent sends must land inside the vault, on a Markdown file, outside hidden folders (.obsidian, .git),
// and must not leave through a symlink.
function jail(root: string, p: unknown) {
  const real = realpathSync(root);
  const abs = resolve(real, String(p ?? ""));
  const rel = relative(real, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.split(sep).some((s) => s.startsWith(".")) || !rel.endsWith(".md"))
    throw new Error(`not a note inside the vault: ${p}`);
  let d = abs;
  while (!existsSync(d)) d = dirname(d);
  const r = realpathSync(d);
  if (r !== real && !r.startsWith(real + sep)) throw new Error(`not a note inside the vault: ${p}`);
  return abs;
}
async function allNotes(root: string) {
  const out: string[] = [];
  for await (const p of new Bun.Glob("**/*.md").scan(root)) if (!p.split("/").some((s) => s.startsWith("."))) out.push(p);
  return out.sort().slice(0, 2000);
}
async function useTool(root: string, name: string, input: any): Promise<string> {
  if (name === "list_notes") return (await allNotes(root)).join("\n") || "(no notes)";
  if (name === "search_notes") {
    const q = String(input?.query ?? "").toLowerCase();
    if (!q) throw new Error("empty query");
    const hits: string[] = [];
    for (const p of await allNotes(root)) {
      (await Bun.file(`${root}/${p}`).text()).split("\n").forEach((l, i) => { if (hits.length < 50 && l.toLowerCase().includes(q)) hits.push(`${p}:${i + 1}: ${clip(l.trim(), 200)}`); });
      if (hits.length >= 50) break;
    }
    return hits.join("\n") || "(no matches)";
  }
  if (name === "read_note") {
    const f = Bun.file(jail(root, input?.path));
    if (!(await f.exists())) throw new Error(`no such note: ${input?.path}`);
    return await f.text();
  }
  if (name === "write_note") {
    const abs = jail(root, input?.path), content = String(input?.content ?? "");
    if (content.length > 1_000_000) throw new Error("note too large");
    mkdirSync(dirname(abs), { recursive: true });
    await Bun.write(abs, content);
    return `wrote ${input.path} (${content.length} chars)`;
  }
  throw new Error(`unknown tool: ${name}`);
}
async function tool(root: string, task: Task, name: string, input: any) {
  log(task, { t: "tool", name, txt: clip(String(input?.path ?? input?.query ?? ""), 300) });
  try {
    const out = await useTool(root, name, input);
    log(task, { t: "result", txt: clip(out, 400) });
    return { out, error: false };
  } catch (e: any) {
    log(task, { t: "error", txt: e.message });
    return { out: `Error: ${e.message}`, error: true };
  }
}

function system(root: string) {
  const f = `${root}/AGENTS.md`;
  const rules = existsSync(f) ? `\n\nThe vault's own instructions (AGENTS.md):\n\n${readFileSync(f, "utf8")}` : "";
  return "You are an agent working inside the user's Obsidian vault through four tools: list_notes, search_notes, read_note and write_note. "
    + "Paths are relative to the vault root, and you can only touch Markdown notes. Read a note before you replace it and keep the vault's "
    + "conventions (folders, frontmatter, links). When you are done, reply with a short summary of what you changed." + rules;
}

// ---------------------------------------------------------------- Anthropic (Claude)
async function anthropic(a: Agent, root: string, task: Task, signal: AbortSignal) {
  // Loaded on first use: the rest of Overlook runs without `bun install`.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env[a.key!], ...(a.url ? { baseURL: a.url } : {}) });
  const model = task.model;
  const fallback = FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema as any, strict: true }));
  const messages: any[] = [{ role: "user", content: task.prompt }];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await client.beta.messages.create({
      model, max_tokens: 16000, system: system(root), tools, messages,
      thinking: { type: "adaptive" }, output_config: { effort: task.effort as any }, cache_control: { type: "ephemeral" }, ...fallback,
    }, { signal });
    messages.push({ role: "assistant", content: r.content }); // whole content, thinking blocks included
    for (const b of r.content) if (b.type === "text" && b.text.trim()) log(task, { t: "text", txt: clip(b.text.trim(), MESSAGE) });
    if (r.stop_reason === "refusal") { log(task, { t: "error", txt: `declined${r.stop_details?.category ? ` (${r.stop_details.category})` : ""}` }); return false; }
    if (r.stop_reason === "pause_turn") continue;
    const uses = r.content.filter((b) => b.type === "tool_use") as { id: string; name: string; input: unknown }[];
    if (r.stop_reason !== "tool_use" || !uses.length) {
      if (r.stop_reason !== "end_turn") log(task, { t: "error", txt: `stopped: ${r.stop_reason}` });
      return r.stop_reason === "end_turn";
    }
    const results = [];
    for (const u of uses) {
      const { out, error } = await tool(root, task, u.name, u.input);
      results.push({ type: "tool_result" as const, tool_use_id: u.id, content: out, ...(error ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results }); // every result in one message
  }
  log(task, { t: "error", txt: `gave up after ${MAX_TURNS} turns` });
  return false;
}

// ---------------------------------------------------------------- OpenAI-compatible (OpenAI, OpenRouter, Groq, Ollama...)
async function openai(a: Agent, root: string, task: Task, signal: AbortSignal) {
  const tools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.schema } }));
  const messages: any[] = [{ role: "system", content: system(root) }, { role: "user", content: task.prompt }];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await fetch(`${(a.url || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal,
      headers: { "content-type": "application/json", ...(a.key ? { authorization: `Bearer ${process.env[a.key]}` } : {}) },
      body: JSON.stringify({ model: task.model, messages, tools, ...(task.effort ? { reasoning_effort: task.effort } : {}) }),
    });
    if (!r.ok) throw new Error(`${a.name} answered ${r.status}: ${clip(await r.text(), 300)}`);
    const m = (await r.json() as any).choices?.[0]?.message;
    if (!m) throw new Error(`${a.name} sent no message`);
    messages.push(m);
    if (m.content?.trim()) log(task, { t: "text", txt: clip(m.content.trim(), MESSAGE) });
    if (!m.tool_calls?.length) return true;
    for (const c of m.tool_calls) {
      let input: unknown = null;
      try { input = JSON.parse(c.function?.arguments || "{}"); } catch {}
      const { out } = input ? await tool(root, task, c.function.name, input) : { out: "Error: arguments are not valid JSON" };
      messages.push({ role: "tool", tool_call_id: c.id, content: out });
    }
  }
  log(task, { t: "error", txt: `gave up after ${MAX_TURNS} turns` });
  return false;
}
