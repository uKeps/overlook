// Agents Overlook can put to work on the vault. CLI agents (claude, agy, codex...) are spawned in the vault folder;
// API agents (Anthropic, or any OpenAI-compatible endpoint) work through four tools jailed to the vault's notes.
// Tasks persist to cache/tasks.json (last 50 tasks). On startup, unfinished tasks are marked ended.
import { safeUrl, tabInfo, agentDo } from "./browser";
import { resolve, dirname, relative, isAbsolute, sep, join, basename } from "node:path";
import { realpathSync, existsSync, statSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { readFileSync as readProc } from "node:fs";
import xtermHeadless from "@xterm/headless";
import xtermSerialize from "@xterm/addon-serialize";
const { Terminal: Headless } = xtermHeadless;
const { SerializeAddon } = xtermSerialize;

// models/efforts list what the task form offers (first model, and `effort` or the first effort, are the defaults).
// A model is an id or { id, label, efforts } when it has a display name or its own effort levels;
// a CLI agent receives the choice through {model} and {effort} in `run`, and {session} gets a fresh UUID per task.
// open: "Open in…" commands for a session, with {session}, {cwd}, and {terminal} (the user's terminal) as the first token.
// tui: the interactive command a canvas pane runs for a new session ({prompt}/{session} drop with their flag when empty).
// With {session} in it, the pane picks the id and later resumes it through the "{terminal}" opener.
export type Agent = {
  id: string; name: string; process?: string; run?: string[]; api?: "anthropic" | "openai"; url?: string; key?: string;
  model?: string; models?: (string | Model)[]; effort?: string; efforts?: string[]; open?: Record<string, string[]>; tui?: string[];
  canvas?: string[]; // extra args for a TUI on the canvas, {canvas} = how to reach the cards wired to it (CANVAS_HINT), {canvas-settings} = the hook that hands it wired notes
};
type Model = { id: string; label?: string; efforts?: string[] };
export type QuotaInfo = { exhausted: boolean; resetsIn?: string; message: string };
type Task = { id: string; agent: string; model: string; effort: string; session?: string; cwd: string; role?: string; prompt: string; routine?: string; start: string; end?: string; ok?: boolean; events: Event[]; stop?: () => void; quota?: QuotaInfo };

// Without agents.json: the CLIs Overlook always knew about. A CLI shows up as runnable only when it is on the PATH.
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const DEFAULTS: Agent[] = [
  { id: "claude", name: "Claude Code", process: "claude", efforts: EFFORTS, effort: "high",
    models: [{ id: "opus", label: "Opus" }, { id: "sonnet", label: "Sonnet" }, { id: "haiku", label: "Haiku" }],
    run: ["claude", "-p", "{prompt}", "--session-id", "{session}", "--model", "{model}", "--effort", "{effort}", "--permission-mode", "acceptEdits"],
    open: { Terminal: ["{terminal}", "claude", "--resume", "{session}"] }, tui: ["claude", "--model", "{model}", "--effort", "{effort}", "--session-id", "{session}", "{prompt}"],
    canvas: ["--append-system-prompt", "{canvas}", "--settings", "{canvas-settings}"] },
  { id: "agy", name: "Antigravity", process: "agy", efforts: EFFORTS, effort: "high",
    run: ["agy", "-p", "{prompt}", "--effort", "{effort}", "--mode", "accept-edits", "--output-format", "stream-json", "--print-timeout", "10m"],
    open: { Terminal: ["{terminal}", "agy", "--conversation", "{session}"], "Antigravity app": ["antigravity", "{cwd}"] }, tui: ["agy", "--log-file", "{log}", "-i", "{prompt}"] },
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
// The agent a request gets when it names none: the first one in agents.json that can run here.
export const defaultAgent = (dir: string) => { const r = loadAgents(dir).filter((a) => a.run || a.api); return (r.find(ready) ?? r[0])?.id ?? ""; };

const tasks = new Map<string, Task>();
// Keeps the last 50: the oldest *finished* ones go first; a running task (a routine, a long job) is never dropped.
function evict() {
  for (const [id, t] of tasks) { if (tasks.size <= 50) break; if (t.end) tasks.delete(id); }
}
const now = () => new Date().toISOString();
const clip = (s: string, n = 600) => (s.length > n ? s.slice(0, n) + "…" : s);
const MESSAGE = 20_000; // a whole message reads in full; the cap only guards against a runaway one
const log = (task: Task, e: Omit<Event, "at">) => { task.events.push({ ...e, at: now() }); if (task.events.length > 300) task.events.shift(); };

let tasksDir = import.meta.dir;
const tasksFile = (dir: string) => `${dir}/cache/tasks.json`;

export function saveTasks(dir: string = tasksDir) {
  tasksDir = dir;
  const file = tasksFile(dir);
  try {
    mkdirSync(dirname(file), { recursive: true });
    evict();
    const list = [...tasks.values()].map(({ stop, ...t }) => t);
    writeFileSync(file, JSON.stringify(list, null, 1));
  } catch {}
}

export function loadTasks(dir: string = tasksDir): Task[] {
  tasksDir = dir;
  const file = tasksFile(dir);
  try {
    if (!existsSync(file)) return [];
    const list = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(list)) return [];
    tasks.clear();
    let changed = false;
    const nowIso = now();
    for (const t of list.slice(-50)) {
      if (t && typeof t === "object" && t.id) {
        if (!t.end) {
          t.end = nowIso;
          t.ok = false;
          changed = true;
        }
        delete t.stop;
        if (!Array.isArray(t.events)) t.events = [];
        tasks.set(t.id, t as Task);
      }
    }
    if (changed) saveTasks(dir);
    return [...tasks.values()];
  } catch {
    return [];
  }
}
export const taskList = () => [...tasks.values()].reverse().map(({ events, stop, ...t }) => ({ ...t, prompt: clip(t.prompt, 160) }));
export const getTask = (id: string) => { const t = tasks.get(id); if (!t) return null; const { stop, ...rest } = t; return rest; };
export const stopTask = (id: string) => { const t = tasks.get(id); if (!t?.stop || t.end) return false; t.stop(); return true; };
export function deleteTask(id: string, dir: string = tasksDir): boolean {
  const t = tasks.get(id);
  if (!t) return false;
  if (!t.end) stopTask(id);
  const deleted = tasks.delete(id);
  if (deleted) saveTasks(dir);
  return deleted;
}
export const routineRunning = (name: string) => [...tasks.values()].some((t) => t.routine === name && !t.end);

export type RunOpts = { model?: string; effort?: string; routine?: string; cwd?: string; session?: string; role?: string };
const SESSION_ID = /^[0-9a-f][0-9a-f-]{7,63}$/i; // never a leading "-": it lands in argv
// Text that lands in argv as a value or positional (prompts) must not start with "-", or the CLI reads it as a flag.
export const notFlag = (s: string) => (s.startsWith("-") ? ` ${s}` : s);
const SYS_DIRS = ["/etc", "/proc", "/sys", "/boot", "/dev", "/root", "/usr", "/bin", "/sbin", "/lib", "/lib64", "/var"];
const shortDir = (p: string) => { const h = homedir(); return p === h ? "~" : p.startsWith(h + sep) ? "~/" + p.slice(h.length + 1) : p; };
export function validCwd(root: string, raw?: string) {
  if (!raw?.trim()) return root;
  const abs = resolve(root, raw.trim().replace(/^~(?=$|\/)/, homedir()));
  try {
    if (!existsSync(abs) || !statSync(abs).isDirectory()) return null;
    const real = realpathSync(abs), rRoot = realpathSync(root), rHome = realpathSync(homedir());
    if (real === rRoot || real.startsWith(rRoot + sep) || real === rHome || real.startsWith(rHome + sep)) return abs;
    if (SYS_DIRS.some((s) => real === s || real.startsWith(s + sep))) return null;
    return abs;
  } catch { return null; }
}
export function listDirs(root: string, raw?: string, hidden = false) {
  const h = homedir();
  const dir = raw?.trim() ? validCwd(root, raw) : (validCwd(root, `${h}/dev`) ?? root);
  if (!dir) return null;
  let dirs: { name: string; path: string; short: string; git: boolean }[] = [];
  try {
    dirs = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (hidden || !d.name.startsWith(".")) && !SYS_DIRS.includes(join(dir, d.name)))
      .map((d) => {
        const p = join(dir, d.name);
        return { name: d.name, path: p, short: shortDir(p), git: existsSync(join(p, ".git")) };
      })
      .sort((a, b) => Number(b.git) - Number(a.git) || a.name.localeCompare(b.name))
      .slice(0, 250);
  } catch {}
  // One level further down, so a filter finds ~/dev/planeit from ~ without stepping in first.
  const deep: { name: string; path: string; short: string }[] = [];
  for (const d of dirs) {
    if (d.name === "node_modules") continue;
    try {
      for (const e of readdirSync(d.path, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
        const p = join(d.path, e.name);
        deep.push({ name: e.name, path: p, short: shortDir(p) });
      }
    } catch {}
    if (deep.length > 3000) break; // ponytail: one level only, capped; a real index if deeper search is wanted
  }
  const par = dirname(dir), parent = par !== dir && validCwd(root, par) ? par : null;
  const roots = [
    ["Vault", root], ["~", h], ["~/dev", `${h}/dev`], ["~/Documents", `${h}/Documents`],
    ["~/Downloads", `${h}/Downloads`], ["~/Desktop", `${h}/Desktop`],
    ["/mnt", "/mnt"], [`/run/media/${userInfo().username}`, `/run/media/${userInfo().username}`], ["/", "/"],
  ].filter(([, p]) => validCwd(root, p)).map(([label, p]) => ({ label, path: p, short: shortDir(p) }));
  return { path: dir, short: shortDir(dir), parent, roots, dirs, deep };
}
// The agent and the model/effort it will run with, or why it can't run.
function resolveRun(root: string, dir: string, agentId: string, opts: RunOpts) {
  const a = loadAgents(dir).find((x) => x.id === agentId);
  if (!a) return "unknown agent";
  if (!ready(a)) return a.run ? `${a.run[0]} is not on the PATH` : `${a.name} needs ${a.api === "openai" && !models(a).length ? "a model in agents.json" : `${a.key ?? "a key"} set in .env`}`;
  // Only values the agent lists: they end up as CLI arguments.
  const ms = models(a), m = opts.model ? ms.find((x) => x.id === opts.model) : ms[0];
  if (opts.model && !m) return `${a.name} has no model "${opts.model}"`;
  const es = m?.efforts ?? efforts(a);
  if (opts.effort && !es.includes(opts.effort)) return `${a.name} has no effort "${opts.effort}"${m ? ` for ${m.label}` : ""}`;
  const cwd = validCwd(root, opts.cwd);
  if (!cwd) return `invalid cwd: ${opts.cwd}`;
  if (opts.session && !SESSION_ID.test(opts.session)) return "invalid session";
  const role = opts.role?.trim().slice(0, 2000) || undefined;
  return { a, model: m?.id ?? "", effort: opts.effort || (es.includes(defaultEffort(a)) ? defaultEffort(a) : es[0] ?? ""), cwd, role };
}

const QUOTA_RE = /RESOURCE_EXHAUSTED|\b429\b|Individual quota reached|[Rr]esets in|usage limit reached|insufficient_quota|rate_limit_exceeded|rate_limit_error|quota exceeded/i;
function checkQuota(task: Task, textOrErr: unknown) {
  if (!textOrErr) return;
  let text = typeof textOrErr === "string" ? textOrErr : String((textOrErr as any)?.message ?? textOrErr);
  const status = (textOrErr as any)?.status;
  if (status === 429 && !text.includes("429")) text = `429 ${text}`;
  if (!QUOTA_RE.test(text)) return;
  let resetsIn: string | undefined;
  const mReset = text.match(/[Rr]esets (?:in|at)\s+((?:[0-9]+\s*(?:hours?|minutes?|seconds?|[dhms])\b(?:\s+and\s+|\s*,?\s*)?)+|(?=[0-9]*[dhms])[0-9dhms]+)/i);
  if (mReset) {
    resetsIn = mReset[1].trim();
  } else {
    const mIso = text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/);
    if (mIso) resetsIn = mIso[0];
  }
  if (!resetsIn && (textOrErr as any)?.headers) {
    const h = (textOrErr as any).headers;
    const rAt = typeof h.get === "function" ? (h.get("anthropic-ratelimit-unified-resets-at") || h.get("retry-after")) : (h["anthropic-ratelimit-unified-resets-at"] || h["retry-after"]);
    if (rAt) resetsIn = /^\d+$/.test(rAt) ? `${rAt}s` : rAt;
  }
  task.quota = {
    exhausted: true,
    resetsIn: resetsIn ?? task.quota?.resetsIn,
    message: clip(text.trim(), 300),
  };
  task.ok = false;
}

function execTask(a: Agent, task: Task, prompt: string, resumed: boolean, dir: string = tasksDir) {
  log(task, { t: "you", txt: prompt });
  task.end = undefined; task.ok = undefined; task.stop = undefined; task.quota = undefined; // a follow-up starts clean
  const ctrl = new AbortController();
  const timer = setTimeout(() => { log(task, { t: "error", txt: "timed out after 30 min" }); task.stop?.(); }, TIMEOUT);
  const work = a.run ? cli(a, task.cwd, task, prompt, resumed, ctrl) : a.api === "anthropic" ? anthropic(a, task.cwd, task, prompt, ctrl.signal) : openai(a, task.cwd, task, prompt, ctrl.signal);
  task.stop ??= () => ctrl.abort();
  work.then((ok) => (task.ok = task.quota ? false : ok), (e) => {
    task.ok = false;
    const txt = ctrl.signal.aborted ? "stopped" : String(e?.message ?? e);
    checkQuota(task, e);
    log(task, { t: "error", txt });
  })
    .finally(() => { task.end = now(); clearTimeout(timer); saveTasks(dir); });
}

export function runTask(root: string, dir: string, agentId: string, prompt: string, opts: RunOpts = {}) {
  const r = resolveRun(root, dir, agentId, opts);
  if (typeof r === "string") return r;
  const { a, model, effort, cwd, role } = r;
  const session = opts.session || (a.run?.some((x) => x.includes("{session}")) ? crypto.randomUUID() : undefined);
  const task: Task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), agent: a.id, model, effort, session, cwd, role, prompt, routine: opts.routine, start: now(), events: [] };
  tasks.set(task.id, task);
  evict();
  saveTasks(dir);
  execTask(a, task, prompt, !!opts.session, dir);
  return task;
}

export function continueTask(root: string, dir: string, id: string, prompt: string) {
  const task = tasks.get(id);
  if (!task) return "task not found";
  if (!task.end) return "task is still running";
  if (sessionBusy(task.session)) return "this session is open in a terminal pane";
  const r = resolveRun(root, dir, task.agent, { model: task.model || undefined, effort: task.effort || undefined, cwd: task.cwd });
  if (typeof r === "string") return r;
  saveTasks(dir);
  execTask(r.a, task, prompt, !!task.session, dir);
  return task;
}

export function retryTask(root: string, dir: string, id: string, opts: { model?: string; effort?: string } = {}) {
  const task = tasks.get(id);
  if (!task) return "task not found";
  if (!task.end) return "task is still running";
  if (sessionBusy(task.session)) return "this session is open in a terminal pane";
  const a = loadAgents(dir).find((x) => x.id === task.agent);
  const targetModel = opts.model || task.model || undefined;
  let targetEffort = opts.effort;
  if (!targetEffort && a) {
    const ms = models(a);
    const m = targetModel ? ms.find((x) => x.id === targetModel) : ms[0];
    const es = m?.efforts ?? efforts(a);
    if (task.effort && es.includes(task.effort)) targetEffort = task.effort;
  }
  return runTask(root, dir, task.agent, task.prompt, {
    model: targetModel,
    effort: targetEffort,
    cwd: task.cwd,
    session: task.session,
    role: task.role,
  });
}

// ---------------------------------------------------------------- CLI agents
// Quota is read from errors and stderr only: an agent's own output mentioning "429" or "resets in" is not a quota hit.
function onCliLine(task: Task, l: string) {
  if (l.startsWith("{")) {
    try {
      const j = JSON.parse(l);
      if (typeof j?.event === "string") {
        if (j.event === "init" && typeof j.conversation_id === "string") task.session = j.conversation_id;
        else if (j.event === "step_update" && j.step_update) {
          const s = j.step_update;
          if (s.step_type === "tool" && s.state === "ACTIVE") {
            const name = String(s.tool_name || s.tool_info?.name || "tool");
            const p = s.tool_info?.parameters ?? {};
            const det = p.path ?? p.file_path ?? p.CommandLine ?? p.command ?? p.query ?? p.pattern ?? p.url ?? (Object.keys(p).length ? JSON.stringify(p) : "");
            log(task, { t: "tool", name, txt: clip(String(det), 300) });
          } else if (s.step_type === "tool" && s.state === "DONE" && s.tool_info?.output != null && String(s.tool_info.output).trim()) {
            log(task, { t: "result", txt: clip(String(s.tool_info.output).trim(), 400) });
          } else if (s.step_type === "agent_response" && typeof s.text_delta === "string" && s.text_delta) {
            const last = task.events.at(-1);
            if (last?.t === "text") last.txt = clip(last.txt + s.text_delta, MESSAGE);
            else log(task, { t: "text", txt: clip(s.text_delta, MESSAGE) });
          }
        } else if (j.event === "error" && j.error) {
          const msg = String(j.error?.message ?? j.error);
          checkQuota(task, msg);
          log(task, { t: "error", txt: clip(msg, 400) });
        }
        return;
      } else if (j?.error) {
        const msg = String(j.error?.message ?? (typeof j.error === "string" ? j.error : JSON.stringify(j.error)));
        checkQuota(task, msg);
        log(task, { t: "error", txt: clip(msg, 400) });
        return;
      }
    } catch {}
  }
  log(task, { t: "text", txt: clip(l, MESSAGE) });
}

async function cli(a: Agent, cwd: string, task: Task, prompt: string, resumed: boolean, ctrl: AbortController) {
  const first = task.events.length; // this run's events start here (a follow-up keeps the earlier turns)
  const [cmd, ...rest] = a.run!;
  const fullPrompt = task.role && !resumed ? `[Role: ${task.role}]\n\n${prompt}` : prompt;
  // An empty {model}/{effort} drops the token and the flag before it, so the CLI falls back to its own default.
  const args: string[] = [];
  for (const x of rest) {
    if (resumed && x === "--session-id") { args.push("--resume"); continue; }
    // Function replacers: a prompt with "$&" or "$$" is text, not a replacement pattern.
    const v = x.replaceAll("{prompt}", () => notFlag(fullPrompt)).replaceAll("{model}", () => task.model).replaceAll("{effort}", () => task.effort).replaceAll("{session}", () => task.session ?? "").replaceAll("{cwd}", () => cwd);
    if (/\{(model|effort)\}/.test(x) && !(x.includes("{model}") ? task.model : task.effort)) { if (args.at(-1)?.startsWith("-")) args.pop(); continue; }
    if (x.includes("{session}") && !task.session) { if (args.at(-1)?.startsWith("-")) args.pop(); continue; }
    args.push(v);
  }
  if (resumed && task.session && (a.process === "agy" || cmd === "agy") && !args.includes("--conversation")) args.push("--conversation", task.session);
  // Its own process group, so Stop (and the timeout) also ends what the agent started (a tool's shell, an MCP server),
  // which would otherwise keep the pipes open and the task running forever.
  const p = Bun.spawn([bin(cmd)!, ...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: true });
  task.stop = () => { ctrl.abort(); try { process.kill(-p.pid, "SIGTERM"); } catch { p.kill(); } };
  await Promise.all([
    lines(p.stdout, (l) => onCliLine(task, l)),
    lines(p.stderr, (l) => { checkQuota(task, l); log(task, { t: task.quota ? "error" : "result", txt: clip(l, 400) }); }),
  ]);
  const code = await p.exited;
  if (ctrl.signal.aborted) throw new Error("stopped");
  // claude -p prints a quota hit on stdout and exits 1: plain output counts only when the run failed.
  if (code !== 0 && !task.quota) for (const e of task.events.slice(Math.max(first, task.events.length - 5))) if (e.t === "text") checkQuota(task, e.txt);
  return code === 0 && !task.quota;
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
  const r = resolveRun(root, dir, String(e.agent), { model: e.model || undefined, effort: e.effort || undefined });
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

// ---------------------------------------------------------------- Open in… & Terminal Launcher
export type TerminalInfo = { id: string; name: string; path: string; isDefault?: boolean };
export type ShellInfo = { id: string; name: string; path: string; isDefault?: boolean };

// Detect supported terminal emulators in heuristic order (Ghostty, Kitty, etc.)
export function detectTerminals(): TerminalInfo[] {
  const candidates = [
    { id: "ghostty", name: "Ghostty" },
    { id: "kitty", name: "Kitty" },
    { id: "alacritty", name: "Alacritty" },
    { id: "wezterm", name: "WezTerm" },
    { id: "foot", name: "Foot" },
    { id: "gnome-terminal", name: "GNOME Terminal" },
    { id: "konsole", name: "Konsole" },
    { id: "xfce4-terminal", name: "XFCE Terminal" },
    { id: "xterm", name: "XTerm" },
    { id: "xdg-terminal-exec", name: "System Default (xdg-terminal-exec)" },
  ];
  const list: TerminalInfo[] = [];
  for (const c of candidates) {
    const p = bin(c.id);
    if (p) list.push({ id: c.id, name: c.name, path: p });
  }
  return list;
}

// Detect installed shells (/etc/shells and common PATH binaries)
export function detectShells(): ShellInfo[] {
  const common = [
    { id: "bash", name: "Bash" },
    { id: "zsh", name: "Zsh" },
    { id: "fish", name: "Fish" },
    { id: "pwsh", name: "PowerShell (pwsh)" },
    { id: "powershell", name: "PowerShell" },
    { id: "sh", name: "POSIX Shell (sh)" },
  ];
  const found = new Map<string, ShellInfo>();
  try {
    const lines = readFileSync("/etc/shells", "utf8").split("\n");
    for (const l of lines) {
      const s = l.trim();
      if (!s || s.startsWith("#")) continue;
      const bName = s.split("/").pop() || "";
      if (["git-shell", "rbash", "systemd-home-fallback-shell", "nologin", "false", "sync"].includes(bName)) continue;
      const match = common.find((c) => c.id === bName);
      if (existsSync(s)) {
        found.set(bName, { id: bName, name: match?.name || bName, path: s });
      }
    }
  } catch {}
  for (const c of common) {
    if (!found.has(c.id)) {
      const p = bin(c.id);
      if (p) found.set(c.id, { id: c.id, name: c.name, path: p });
    }
  }
  const priority = ["bash", "zsh", "fish", "pwsh", "powershell", "sh"];
  return [...found.values()].sort((a, b) => {
    const ia = priority.indexOf(a.id), ib = priority.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function buildTerminalArgs(termId: string, cwd: string, cmdArgs: string[] = []): string[] {
  switch (termId) {
    case "ghostty":
      return ["ghostty", `--working-directory=${cwd}`, ...(cmdArgs.length ? ["-e", ...cmdArgs] : [])];
    case "kitty":
      return ["kitty", `--directory=${cwd}`, ...cmdArgs];
    case "xdg-terminal-exec":
      return ["xdg-terminal-exec", `--dir=${cwd}`, ...(cmdArgs.length ? ["--", ...cmdArgs] : [])];
    case "alacritty":
      return ["alacritty", "--working-directory", cwd, ...(cmdArgs.length ? ["-e", ...cmdArgs] : [])];
    case "wezterm":
      return ["wezterm", "start", "--cwd", cwd, ...(cmdArgs.length ? ["--", ...cmdArgs] : [])];
    case "foot":
      return ["foot", "-D", cwd, ...cmdArgs];
    case "gnome-terminal":
      return ["gnome-terminal", `--working-directory=${cwd}`, ...(cmdArgs.length ? ["--", ...cmdArgs] : [])];
    case "konsole":
      return ["konsole", "--workdir", cwd, ...(cmdArgs.length ? ["-e", ...cmdArgs] : [])];
    default:
      return [bin(termId) ?? termId, ...(cmdArgs.length ? ["-e", ...cmdArgs] : [])];
  }
}

export function spawnTerminal(termId?: string, shellId?: string, targetCwd?: string): { ok: boolean; terminal: string; shell?: string; cwd: string; fallback?: boolean } | string {
  if (shellId && !bin(shellId)) {
    return `shell "${shellId}" is not installed`;
  }

  const terms = detectTerminals();
  if (!terms.length) return "no terminal emulator found: install ghostty, kitty or xdg-terminal-exec";

  let cwd = targetCwd ? targetCwd.replace(/^~/, homedir()) : import.meta.dir;
  try {
    cwd = resolve(cwd);
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) cwd = import.meta.dir;
  } catch {
    cwd = import.meta.dir;
  }

  let chosenTerm = termId ? terms.find((t) => t.id === termId) : null;
  if (!chosenTerm) {
    if (termId && !bin(termId)) return `terminal "${termId}" is not installed`;
    const envPref = process.env.DEFAULT_TERMINAL;
    chosenTerm = terms.find((t) => t.id === envPref) || terms.find((t) => t.id === "ghostty") || terms[0];
  }

  let shellCmd = shellId ? (bin(shellId) ?? shellId) : null;

  const cmdArgs = shellCmd ? [shellCmd] : [];
  try {
    const args = buildTerminalArgs(chosenTerm.id, cwd, cmdArgs);
    Bun.spawn(args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
    return { ok: true, terminal: chosenTerm.id, shell: shellId, cwd, fallback: false };
  } catch (err: any) {
    // Attempt fallback (e.g. ghostty fails -> fallback to kitty)
    const fallbackId = process.env.TERMINAL_FALLBACK || (chosenTerm.id === "ghostty" ? "kitty" : "ghostty");
    const fallbackTerm = terms.find((t) => t.id === fallbackId && t.id !== chosenTerm!.id);
    if (fallbackTerm) {
      try {
        const fbArgs = buildTerminalArgs(fallbackTerm.id, cwd, cmdArgs);
        Bun.spawn(fbArgs, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
        return { ok: true, terminal: fallbackTerm.id, shell: shellId, cwd, fallback: true };
      } catch (fbErr: any) {
        return `failed to launch ${chosenTerm.id} and fallback ${fallbackTerm.id}: ${fbErr.message}`;
      }
    }
    return `failed to launch ${chosenTerm.id}: ${err.message}`;
  }
}

// ---------------------------------------------------------------- Embedded terminals: real PTYs (Bun.Terminal)
// Each canvas terminal pane is a real pseudo-terminal, so shells, vim and agent TUIs (claude, agy) run as in Ghostty.
// A PTY outlives its WebSocket (page reload, pane re-render) and redraws its screen on reconnect (replayOf).
type Pty = {
  id: string; title: string; cwd: string; session: string; proc: Bun.Subprocess; tail: string; subs: Set<(d: string) => void>; ends: Set<() => void>; code?: number;
  token: string; screen?: InstanceType<typeof Headless>; ser?: InstanceType<typeof SerializeAddon>; size: string; resizing?: Timer;
  typed?: number; // when the user last typed into it (wired context isn't typed in over a half-written prompt)
};
const ptys = new Map<string, Pty>();
const TAIL = 512_000;
// A headless copy of each terminal (xterm.js, the engine the pane renders with), so another agent can read what a
// pane shows: TUIs redraw in place, so the raw output stream says little.
export const GHOSTTY_TERM = ["/usr/share/terminfo/x/xterm-ghostty", `${homedir()}/.terminfo/x/xterm-ghostty`].some(existsSync) ? "xterm-ghostty" : "xterm-256color";
// (ghostty-web's WASM core was dropped: it corrupted rows on a column resize of a colourful screen, then faulted and
// could loop forever, freezing the server. xterm.js reflows correctly and has no shared heap to poison.)
const mirrorOf = (cols: number, rows: number) => {
  const screen = new Headless({ cols, rows, scrollback: 1000, allowProposedApi: true }), ser = new SerializeAddon();
  screen.loadAddon(ser);
  return { screen, ser };
};
// The replay stays under the socket's 2 MiB backpressure limit even when every character is 3 UTF-8 bytes (TUI borders).
const REPLAY = 400_000;
// What a reconnecting pane gets: the mirror's screen and scrollback, redrawn. Not the raw tail: a TUI draws its frame
// once and then rewrites only the cells that change, so once the first frames are trimmed off the tail, replaying it
// brings back the changing numbers without the frame around them. The raw tail only when there is no mirror.
// done() runs once the mirror has parsed everything written before this call; later output is the caller's.
export function replayOf(t: Pty, done: (s: string) => void) {
  const raw = () => (t.tail.length > REPLAY ? "\x1b[0m" + t.tail.slice(-REPLAY) : t.tail);
  const { screen, ser } = t;
  if (!screen || !ser) return done(raw());
  screen.write("", () => {
    try {
      for (const scrollback of [1000, 100, 0]) {
        const s = ser.serialize({ scrollback });
        if (s.length <= REPLAY || !scrollback) return done(s);
      }
    } catch { done(raw()); }
  });
}

// A known shell (by id or path) or the user's default; a cwd that exists, or the fallback.
export function shellPath(shell?: string) {
  const shells = detectShells(), def = process.env.DEFAULT_SHELL || (process.env.SHELL ? basename(process.env.SHELL) : "bash");
  const s = shells.find((x) => x.id === shell || x.path === shell) ?? shells.find((x) => x.id === def) ?? shells[0];
  return s?.path ?? "/bin/sh";
}
export const dirOr = (cwd: string | undefined, fallback: string) => validCwd(fallback, cwd) ?? fallback;
// An agent session's TUI: its "{terminal}" opener without the terminal (claude --resume <id>).
export function agentArgv(a: Agent, session: string): string[] | string {
  const cmd = Object.values(a.open ?? {}).find((c) => c[0] === "{terminal}" && c.some((x) => x.includes("{session}")));
  return cmd ? withBin(a, cmd.slice(1).map((x) => x.replaceAll("{session}", session))) : `${a.name} cannot resume a session in a terminal`;
}
// A new TUI: `tui` (or the bare CLI) with the first prompt and the session id the pane picked.
export function tuiArgv(a: Agent, session: string, prompt: string, model = "", effort = ""): string[] | string {
  const log = session && tuiLogs(a) ? agentLog(session) : "";
  if (log) mkdirSync(dirname(log), { recursive: true });
  const args: string[] = [], vals: Record<string, string> = { prompt: notFlag(prompt), session, model, effort, log };
  for (const x of a.tui ?? [a.run?.[0] ?? ""]) {
    const used = [...x.matchAll(/\{(prompt|session|model|effort|log)\}/g)].map((m) => m[1]);
    if (used.some((k) => !vals[k])) { if (args.at(-1)?.startsWith("-")) args.pop(); continue; }
    const v = x.replace(/\{(prompt|session|model|effort|log)\}/g, (_, k) => vals[k]);
    args.push(v);
  }
  return withBin(a, args);
}
const withBin = (a: Agent, [head, ...rest]: string[]) => { const b = head && bin(head); return b ? [b, ...rest] : `${a.name} has no interactive command`; };
export const tuiOk = (a: Agent) => !!a.run && (!!a.tui || Object.values(a.open ?? {}).some((c) => c[0] === "{terminal}"));
export const tuiResumes = (a: Agent) => !!a.tui?.some((x) => x.includes("{session}"));
// A CLI that can't take a session id up front (agy) logs to {log}, a file named after the pane's id; the conversation
// it created is read back from there. ponytail: agy's log line; another CLI's needs its own pattern.
export const tuiLogs = (a: Agent) => !!a.tui?.some((x) => x.includes("{log}"));
export const agentLog = (sid: string) => `${import.meta.dir}/cache/agent-logs/${sid}.log`;
export const loggedConversation = (sid: string) => {
  try { return [...readFileSync(agentLog(sid), "utf8").matchAll(/Created conversation ([0-9a-f-]{36})/g)].at(-1)?.[1] ?? ""; } catch { return ""; }
};
// Claude Code writes a session's transcript once it has a turn: a pane opened and closed before the first message has
// nothing to resume, so it starts again with the same id. ponytail: claude's layout; other agents with {session} resume blindly.
export const sessionStarted = (sid: string) => { try { return [...new Bun.Glob(`*/${sid}.jsonl`).scanSync(`${homedir()}/.claude/projects`)].length > 0; } catch { return false; } };

export function openPty(id: string, argv: string[], cwd: string, cols: number, rows: number, title: string, session = "", env: Record<string, string> = {}): Pty {
  const old = ptys.get(id);
  if (old && old.code === undefined) return old;
  old?.screen?.dispose();
  const dec = new TextDecoder();
  const t = { id, title, cwd, session, tail: "", subs: new Set(), ends: new Set(), token: crypto.randomUUID(), ...mirrorOf(cols, rows), size: `${cols}x${rows}` } as unknown as Pty;
  const emit = (s: string) => {
    t.tail += s;
    // ponytail: every chunk is parsed twice (pane + mirror); fine for agent TUIs, build it lazily if a flood ever shows up.
    try { t.screen?.write(s); } catch {} // the mirror is best effort: the panes already have the output
    // Trimmed in batches (not a 512KB copy per chunk), at a line start, with attributes reset for the replay.
    // ponytail: a line start can still sit inside a TUI's escape sequence (one garbled cell at worst).
    if (t.tail.length > 2 * TAIL) { const cut = t.tail.indexOf("\n", t.tail.length - TAIL); t.tail = "\x1b[0m" + t.tail.slice(cut < 0 ? -TAIL : cut + 1); }
    for (const f of t.subs) f(s);
  };
  t.proc = Bun.spawn(argv, {
    // Without Claude Code's own markers: Overlook started from inside a claude session would make the TUI a "child" (no transcript).
    // OVERLOOK_PANE/OVERLOOK_TOKEN: who this pane is, for the `overlook` command (bin/overlook) its agent can run.
    // The pane runs Ghostty's own terminal core, so it says so (TERM=xterm-ghostty when that terminfo is installed):
    // shell configs that check for Ghostty (a fastfetch greeting, keys) behave as in the real one.
    cwd, env: { ...process.env, TERM: GHOSTTY_TERM, ...(GHOSTTY_TERM === "xterm-ghostty" ? { TERM_PROGRAM: "ghostty" } : {}), COLORTERM: "truecolor", CLAUDECODE: undefined, CLAUDE_CODE_CHILD_SESSION: undefined, CLAUDE_CODE_ENTRYPOINT: undefined,
      // Overlook started from a Ghostty window would hand that window's identity to every pane.
      GHOSTTY_SURFACE_ID: undefined, GHOSTTY_SHELL_FEATURES: undefined, GHOSTTY_RESOURCES_DIR: undefined, GHOSTTY_BIN_DIR: undefined, TERM_PROGRAM_VERSION: undefined,
      OVERLOOK_PANE: id, OVERLOOK_TOKEN: t.token, ...env },
    terminal: { cols, rows, data: (_, d) => emit(dec.decode(d, { stream: true })) },
  });
  t.proc.exited.then((code) => {
    t.code = code;
    emit(`\r\n\x1b[2m[process exited with code ${code}]\x1b[0m\r\n`);
    for (const end of t.ends) end(); // the panes' sockets close, so they offer to start it again
    if (!t.subs.size && ptys.get(id) === t) { ptys.delete(id); t.screen?.dispose(); t.screen = undefined; } // nobody watching: reopening the pane respawns it anyway
  });
  ptys.set(id, t);
  return t;
}
export const getPty = (id: string) => ptys.get(id);
// One process per agent session: two drivers (a headless follow-up, a TUI pane, an external terminal) fork its transcript.
export const sessionBusy = (s?: string) => !!s && ([...tasks.values()].some((t) => !t.end && t.session === s) || [...ptys.values()].some((p) => p.code === undefined && p.session === s));
export function closePty(id: string) {
  const t = ptys.get(id);
  if (!t) return false;
  // Interactive shells ignore SIGTERM: closing the PTY sends SIGHUP like closing a terminal window; KILL if that is ignored too.
  try { t.proc.terminal?.close(); t.proc.kill("SIGHUP"); } catch {}
  clearTimeout(t.resizing); t.screen?.dispose(); t.screen = undefined;
  setTimeout(() => { if (t.code === undefined) try { t.proc.kill(9); } catch {} }, 3000);
  return ptys.delete(id);
}
export const listPtys = () => [...ptys.values()].map((t) => ({ id: t.id, title: t.title, cwd: t.cwd, running: t.code === undefined }));
// A drag resizes the pane every frame, and each resize is a SIGWINCH (the shell redraws its prompt): only the last size
// in 80 ms is applied, and only if it changed.
export function resizePty(t: Pty, cols: number, rows: number) {
  clearTimeout(t.resizing);
  t.resizing = setTimeout(() => {
    if (t.code !== undefined || t.size === `${cols}x${rows}`) return;
    t.size = `${cols}x${rows}`;
    t.proc.terminal?.resize(cols, rows);
    try { t.screen?.resize(cols, rows); } catch {}
  }, 80);
}
// Is the pane's shell at its prompt (nothing running in the foreground)? The terminal's foreground process group
// (/proc stat field 8) is then the shell's own. Linux only; elsewhere it says no.
function atPrompt(t: Pty) {
  try { return Number(readProc(`/proc/${t.proc.pid}/stat`, "utf8").split(") ")[1].split(" ")[5]) === t.proc.pid; } catch { return false; }
}

// What a pane shows: its screen plus recent scrollback, as plain text (wide characters' spacer cells skipped).
export function screenText(t: Pty, max = 60) {
  const b = t.screen?.buffer.active;
  const text = !b ? t.tail.replace(/\x1b\[[0-?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b./g, "").replace(/\r/g, "")
    : Array.from({ length: Math.min(b.length, max + (t.screen?.rows ?? 0)) }, (_, i) => b.getLine(b.length - Math.min(b.length, max + (t.screen?.rows ?? 0)) + i)?.translateToString(true) ?? "").join("\n");
  return text.replace(/\n{3,}/g, "\n\n").trim().split("\n").slice(-max).join("\n");
}

// ---------------------------------------------------------------- Agent hand-off between wired terminals
// A wire between two terminal cards on the canvas lets the programs in them talk, both ways: `overlook send <card> "…"`
// types a message into the other pane (bracketed paste + Enter: it lands as a prompt), `overlook read <card>` shows its
// screen. The canvas sends its wires; a caller proves which pane it is with the token in its environment.
export const CANVAS_HINT = "You run in a terminal card on the Overlook canvas. Cards the user wired to yours can be reached with the `overlook` command: `overlook peers` lists them, `overlook send <card> \"message\"` types the message into that card as a prompt (to delegate, ask or hand off work), `overlook read <card>` shows what its screen shows. Messages from them reach you as prompts that start with [Message from …]. Keep them short and only when it helps the user's task. When the user asks you to orchestrate (split work across agents), `overlook spawn <agent> [--cwd dir] \"task\"` opens a new agent card wired to yours with a self-contained task (`overlook spawn` alone lists the agents; `shell` opens a plain terminal you can drive with send/read); it reports back to you by message when done, so wait for that instead of reading its screen. `overlook note \"text\"` puts a note card next to yours for the user. Whatever the user wires to your card (notes, terminals) is context for your work: it reaches you as a message starting with [Overlook: …], and `overlook context` prints it again. `overlook write <note> \"text\"` replaces a wired note's text (`--append` adds to it): use it to keep a shared plan, progress or decisions there. The user can sketch on the canvas: `overlook sketch` prints what's drawn (texts, shapes, arrows); `overlook draw` takes a Mermaid diagram (args or stdin) and draws it beside your card, when a picture explains better than text. `overlook browser open <url>` opens a browser card the user also sees (then read, shot, click, type, key), to check a web page or app.";
// claude also gets the wired notes through hooks: all of them when a conversation starts, resumes, is cleared or compacted
// (its context lost them), then only new or changed ones with each prompt (nothing when none changed).
const hook = (command: string) => [{ hooks: [{ type: "command", command, timeout: 5 }] }];
export const CANVAS_SETTINGS = JSON.stringify({ hooks: { SessionStart: hook("overlook context --all"), UserPromptSubmit: hook("overlook context --new") } });
// Each open canvas (a browser: the desktop, the phone) sends its own wires, again every 30 s; what's allowed is the union
// of the canvases heard from in the last 90 s, so two of them don't overwrite each other and a closed one fades out.
type Ctx = { key: string; name: string; text?: string; path?: string; term?: string; browser?: string; url?: string };
const canvases = new Map<string, { wires: Set<string>; names: Map<string, string>; ctx: Map<string, Ctx[]>; sketch: string; at: number }>(), sent = new Map<string, number[]>();
export const handoffs: { from: string; to: string; at: number }[] = [];
const pair = (a: string, b: string) => [a, b].sort().join("|");
const live = () => [...canvases.values()].filter((c) => Date.now() - c.at < 90_000);
export function setWires(client: unknown, list: unknown, titles: unknown, ctx?: unknown, sketch?: unknown) {
  if (typeof client !== "string" || !/^[\w-]{1,64}$/.test(client)) return false;
  const c = { wires: new Set<string>(), names: new Map<string, string>(), ctx: new Map<string, Ctx[]>(), sketch: typeof sketch === "string" ? sketch.slice(0, 8000) : "", at: Date.now() };
  if (ctx && typeof ctx === "object") for (const [id, items] of Object.entries(ctx)) if (Array.isArray(items))
    c.ctx.set(id, items.filter((i) => typeof i?.key === "string").slice(0, 8).map((i) => ({ key: i.key.slice(0, 120), name: String(i.name ?? "").slice(0, 80),
      ...(typeof i.term === "string" ? { term: i.term } : typeof i.browser === "string" ? { browser: i.browser.slice(0, 80), url: safeUrl(i.url) }
        : typeof i.path === "string" ? { path: i.path } : { text: String(i.text ?? "").slice(0, 8000) }) })));
  if (Array.isArray(list)) for (const w of list) if (Array.isArray(w) && typeof w[0] === "string" && typeof w[1] === "string") c.wires.add(pair(w[0], w[1]));
  if (titles && typeof titles === "object") for (const [k, v] of Object.entries(titles)) if (typeof v === "string") c.names.set(k, v.slice(0, 80));
  canvases.set(client, c);
  return true;
}
const nameOf = (t: Pty) => live().map((c) => c.names.get(t.id)).find(Boolean) || t.title;
const callerOf = (from: unknown, token: unknown) => { const t = typeof from === "string" ? ptys.get(from) : undefined; return t && typeof token === "string" && token === t.token ? t : null; };
const peersOf = (me: Pty) => { const ws = live(); return [...ptys.values()].filter((p) => p !== me && ws.some((c) => c.wires.has(pair(me.id, p.id)))); };
// A card by id, or by a part of its name that only one wired card has (a message must not land on a guess).
function findPeer(me: Pty, to: string): Pty | string {
  if (!to.trim()) return "say which card (overlook peers lists them)";
  const ps = peersOf(me), q = to.toLowerCase(), byId = ps.find((p) => p.id === to);
  if (byId) return byId;
  const hits = ps.filter((p) => nameOf(p).toLowerCase().includes(q));
  return hits.length === 1 ? hits[0] : hits.length ? `"${to}" matches ${hits.length} cards (${hits.map((p) => `${p.id} = ${nameOf(p)}`).join(", ")}): use the card id`
    : `no card wired to this one matches "${to}" (overlook peers lists them)`;
}
export function ptyPeers(from: unknown, token: unknown) {
  const me = callerOf(from, token);
  return me ? peersOf(me).map((p) => ({ id: p.id, name: nameOf(p), running: p.code === undefined })) : "unknown pane or token";
}
export function ptyRead(from: unknown, token: unknown, to: unknown, max = 60) {
  const me = callerOf(from, token);
  if (!me) return "unknown pane or token";
  const p = findPeer(me, String(to ?? ""));
  return typeof p === "string" ? p : { id: p.id, name: nameOf(p), text: screenText(p, Math.min(400, Math.max(5, max))) };
}
export function ptySend(from: unknown, token: unknown, to: unknown, text: unknown): true | string {
  const me = callerOf(from, token);
  if (!me) return "unknown pane or token";
  const p = findPeer(me, String(to ?? ""));
  if (typeof p === "string") return p;
  if (p.code !== undefined) return `${nameOf(p)} is not running`;
  // Plain text only: control characters (escape sequences, Ctrl-C, a carriage return that would submit early) are dropped.
  const clean = String(text ?? "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim().slice(0, 8000);
  if (!clean) return "empty message";
  // Two agents could answer each other forever: at most 6 messages a minute from one card to another.
  const k = `${me.id}>${p.id}`, now = Date.now(), recent = (sent.get(k) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 6) return "rate limit: 6 messages a minute to one card; wait or ask the user";
  sent.set(k, [...recent, now]);
  // To an agent, a message says who sent it and how to answer; to a shell at its prompt it is a command line, so it
  // goes alone (a header there would be a failed command in the user's history).
  const msg = atPrompt(p) ? clean : `[Message from "${nameOf(me)}" (card ${me.id}) on the Overlook canvas; reply with: overlook send ${me.id} "..."]\n${clean}`;
  // Bracketed paste keeps a multi-line message one prompt; a program that doesn't ask for it would take each newline as
  // Enter, so it gets the message on one line.
  p.proc.terminal?.write(p.screen?.modes.bracketedPasteMode ? `\x1b[200~${msg}\x1b[201~` : msg.replace(/\n+/g, " "));
  setTimeout(() => { if (p.code === undefined) p.proc.terminal?.write("\r"); }, 150);
  handoffs.push({ from: me.id, to: p.id, at: now });
  if (handoffs.length > 50) handoffs.shift();
  return true;
}
// Whatever the user wires to a pane is context for the agent in it: sticky notes, vault notes, other terminals. It reaches
// any agent right away: the server types it in as a message once the agent is the pane's foreground program and the
// user hasn't typed there for a few seconds (deliverWired, every 4 s). claude also has hooks: `overlook context --all`
// when a conversation starts, resumes, is cleared or compacted, `--new` before each prompt. Each note goes once, and
// again only when it changes (a hash per pane); a terminal goes once per wire (its screen changes all the time:
// `overlook read` shows it again). The wire flows on the canvas when something reaches the agent.
let vaultRoot = () => "";
export const setVaultRoot = (f: () => string) => { vaultRoot = f; };
const seenCtx = new Map<string, Map<string, number | bigint>>();
const itemsOf = (id: string) => { const all = live().flatMap((c) => c.ctx.get(id) ?? []); return all.filter((x, i) => all.findIndex((y) => y.key === x.key) === i); };
// A vault note by its path in the vault: a .md file inside it, nothing else (no ../).
const vaultFile = (path: string) => {
  const root = vaultRoot(), f = resolve(root, path);
  return root && f.startsWith(root + sep) && f.endsWith(".md") && existsSync(f) ? f : "";
};
// The program in the pane's foreground (its terminal's foreground process group), e.g. "claude", or the shell itself.
function fgName(t: Pty) {
  try { const pg = readProc(`/proc/${t.proc.pid}/stat`, "utf8").split(") ")[1].split(" ")[5]; return readProc(`/proc/${pg}/comm`, "utf8").trim(); } catch { return ""; }
}
const agentNames = () => new Set(loadAgents(import.meta.dir).map((a) => a.process).filter(Boolean) as string[]);
// What an item says: a note's text, or for a terminal, who it is, its screen, and how to reach it.
async function itemText(i: Ctx) {
  if (i.browser !== undefined) {
    const now = tabInfo(i.browser), at = now?.url || i.url;
    return `A browser you can drive${at ? ` (now at ${at})` : ""}: overlook browser open <url> | read (the page's text) | shot (a screenshot file to look at) | click <css | text=… | x,y> | type <text> | key <Enter|Tab|…>. The user sees the same page.`;
  }
  if (i.term !== undefined) {
    const p = ptys.get(i.term);
    if (!p) return "";
    const agent = p.code === undefined && agentNames().has(fgName(p));
    return agent ? `An agent (${fgName(p)}) runs there: talk to it with overlook send ${p.id} "...", see its screen with overlook read ${p.id}.`
      : `Its screen now (overlook read ${p.id} shows it again; overlook send ${p.id} "..." types a command into it):\n${screenText(p, 30)}`;
  }
  const f = i.path === undefined ? "" : vaultFile(i.path);
  return (i.path === undefined ? i.text ?? "" : f ? await Bun.file(f).text().catch(() => "") : "").trim().slice(0, 8000);
}
const heading = (i: Ctx) => i.browser !== undefined ? `### Browser "${i.name}" (card ${i.browser})` : i.term !== undefined ? `### Terminal "${i.name}" (card ${i.term})` : i.path ? `### Vault note "${i.name}" (${resolve(vaultRoot(), i.path)})` : `### Note "${i.name}"`;
const stamp = (i: Ctx, text: string) => Bun.hash(i.term !== undefined || i.browser !== undefined ? "wired" : text);
export const contextBlock = (items: { head: string; text: string }[]) => items.map((i) => `${i.head}\n${i.text}`).join("\n\n");
// Gives a pane its wired items: all of them, or (fresh) only those it hasn't seen as they are now; marks them seen.
async function give(id: string, fresh: boolean, only?: Set<string>) {
  const seen = seenCtx.get(id) ?? new Map<string, number | bigint>(), now = Date.now();
  seenCtx.set(id, seen);
  const items = itemsOf(id);
  if (live().length) for (const k of seen.keys()) if (!items.some((i) => i.key === k)) seen.delete(k); // unwired: wiring it again gives it again
  const out: { head: string; text: string; name: string; path?: string }[] = [];
  for (const i of items) {
    if (only && !only.has(i.key)) continue;
    const text = await itemText(i);
    if (!text || (fresh && seen.get(i.key) === stamp(i, text))) continue;
    seen.set(i.key, stamp(i, text));
    handoffs.push({ from: i.key, to: id, at: now });
    out.push({ head: heading(i), text, name: i.name, ...(i.path ? { path: i.path } : {}) });
  }
  handoffs.splice(0, Math.max(0, handoffs.length - 50));
  return out;
}
export async function ptyContext(from: unknown, token: unknown, fresh: boolean) {
  const me = callerOf(from, token);
  return me ? give(me.id, fresh) : "unknown pane or token";
}
// A note being typed changes every keystroke: it goes once it has rested (SETTLE), not half-written.
const changed = new Map<string, { h: number | bigint; at: number }>(), SETTLE = 3000, QUIET = 8000;
let delivering = false;
async function deliverWired() {
  if (delivering) return;
  delivering = true;
  try {
    const now = Date.now(), names = agentNames();
    for (const t of ptys.values()) {
      const items = itemsOf(t.id);
      if (!items.length || t.code !== undefined || now - (t.typed ?? 0) < QUIET || !names.has(fgName(t))) continue;
      const seen = seenCtx.get(t.id), pending = new Set<string>();
      for (const i of items) {
        const text = await itemText(i), h = stamp(i, text), c = changed.get(`${t.id}|${i.key}`);
        if (c?.h !== h) changed.set(`${t.id}|${i.key}`, { h, at: now });
        if (text && seen?.get(i.key) !== h && now - (c?.h === h ? c.at : now) >= SETTLE) pending.add(i.key);
      }
      if (!pending.size) continue;
      const out = await give(t.id, true, pending);
      if (out.length) typeIn(t, `[Overlook: the user wired this to your card on the canvas as context for your work. Read it; reply in one short line at most.]\n${contextBlock(out)}`);
    }
  } finally { delivering = false; }
}
setInterval(() => { deliverWired().catch(() => {}); }, 4000);
// Types a message into a pane as one prompt (bracketed paste when the program asks for it), then Enter.
function typeIn(p: Pty, msg: string) {
  p.proc.terminal?.write(p.screen?.modes.bracketedPasteMode ? `\x1b[200~${msg}\x1b[201~` : msg.replace(/\n+/g, " "));
  setTimeout(() => { if (p.code === undefined) p.proc.terminal?.write("\r"); }, 150);
}
// An agent writes into a note wired to its card: a vault note's file directly, a sticky through the canvas showing it
// (like a spawn). The writer has then seen what it wrote; other agents wired to that note get the new text.
// The canvas's sketch layer, for any canvas agent: what it says (overlook sketch), and Mermaid drawn onto it beside the
// caller's card (overlook draw; the canvas showing that card converts it).
export function ptySketch(from: unknown, token: unknown) {
  if (!callerOf(from, token)) return "unknown pane or token";
  return { text: live().map((c) => c.sketch).filter(Boolean).join("\n\n") };
}
export async function ptyDraw(from: unknown, token: unknown, mermaid: unknown) {
  const me = callerOf(from, token);
  if (!me) return "unknown pane or token";
  const text = String(mermaid ?? "").trim().slice(0, 8000);
  if (!text) return "empty diagram: pass Mermaid, e.g. flowchart LR; A[API] --> B[Queue]";
  const k = `${me.id}>draw`, now = Date.now(), recent = (sent.get(k) ?? []).filter((x) => now - x < 60_000);
  if (recent.length >= 10) return "rate limit: 10 drawings a minute";
  sent.set(k, [...recent, now]);
  const s: Spawn = { id: `d_${now}_${Math.random().toString(36).slice(2, 6)}`, parent: me.id, kind: "draw", text, at: now, done: () => {} };
  spawns.push(s);
  const why = await new Promise<string | null>((res) => { s.done = res; setTimeout(() => res(null), SPAWN_WAIT); });
  if (why === null) return { queued: true };
  return why ? why : { queued: false };
}
// `overlook browser …`: drives the browser card wired to the caller. With none, `open` puts one on the canvas, wired.
export async function ptyBrowser(from: unknown, token: unknown, cmd: unknown, arg: unknown) {
  const me = callerOf(from, token);
  if (!me) return "unknown pane or token";
  const c = String(cmd ?? ""), a = String(arg ?? "").trim().slice(0, 20_000), card = itemsOf(me.id).find((i) => i.browser !== undefined);
  if (!card) {
    if (c !== "open") return "no browser card is wired to this one: `overlook browser open <url>` puts one on the canvas";
    const url = safeUrl(/^[\w.-]+\.[a-z]{2,}(\/|$)|^localhost(:|\/|$)/i.test(a) ? `${a.startsWith("localhost") ? "http" : "https"}://${a}` : a);
    if (!url) return "open takes an http(s) address";
    const now = Date.now(), s: Spawn = { id: `b_${now}_${Math.random().toString(36).slice(2, 6)}`, parent: me.id, kind: "browser", url, at: now, done: () => {} };
    spawns.push(s);
    const why = await new Promise<string | null>((res) => { s.done = res; setTimeout(() => res(null), SPAWN_WAIT); });
    return why === null ? { text: "queued: the browser opens when the Overlook canvas shows this card" } : why ? why : { text: `opened a browser card at ${url}, wired to this card` };
  }
  try { return { text: await agentDo(card.browser!, card.url || "about:blank", c, a) }; }
  catch (e: any) { return String(e?.message || e); }
}
export async function ptyWrite(from: unknown, token: unknown, to: unknown, text: unknown, append: boolean) {
  const me = callerOf(from, token);
  if (!me) return "unknown pane or token";
  const notes = itemsOf(me.id).filter((i) => i.term === undefined && i.browser === undefined), q = String(to ?? "").toLowerCase();
  const hits = notes.filter((i) => i.key === to || i.name.toLowerCase().includes(q) || i.path?.toLowerCase().includes(q));
  if (!q || hits.length !== 1) return hits.length ? `"${to}" matches ${hits.length} notes: ${hits.map((i) => i.name).join(", ")}` : `no note wired to this card matches "${to}" (overlook context lists them)`;
  const n = hits[0], add = String(text ?? "").slice(0, 8000);
  if (!add.trim()) return "empty text";
  const k = `${me.id}>write`, now = Date.now(), recent = (sent.get(k) ?? []).filter((x) => now - x < 60_000);
  if (recent.length >= 20) return "rate limit: 20 writes a minute";
  sent.set(k, [...recent, now]);
  const old = await itemText(n), next = append && old ? `${old}\n${add}` : add;
  if (n.path !== undefined) {
    const f = vaultFile(n.path);
    if (!f) return `${n.path} is not a note in the vault`;
    await Bun.write(f, next.endsWith("\n") ? next : next + "\n");
  } else {
    const s: Spawn = { id: `w_${now}_${Math.random().toString(36).slice(2, 6)}`, parent: me.id, kind: "write", target: n.key, text: next, at: now, done: () => {} };
    spawns.push(s);
    const why = await new Promise<string | null>((res) => { s.done = res; setTimeout(() => res(null), SPAWN_WAIT); });
    if (why === null) return "queued: it's written when the Overlook canvas shows this card";
    if (why) return why;
  }
  (seenCtx.get(me.id) ?? seenCtx.set(me.id, new Map()).get(me.id)!).set(n.key, Bun.hash(next.trim()));
  return { name: n.name };
}
// Spawning (the maestro): an agent in a card opens new cards wired to its own (`overlook spawn` / `overlook note`). The
// cards live in the browser, so a request waits here until the canvas showing the caller takes it (it polls every 2 s),
// adds the card and the wire, and says how it went on its next poll; the caller hears back within MAX_WAIT or is told
// it's queued. An opened agent reports to its maestro by message (push), so the maestro needn't poll its screen.
type Spawn = { id: string; parent: string; kind: "agent" | "shell" | "sticky" | "write" | "draw" | "browser"; url?: string; agent?: string; cwd?: string; prompt?: string; text?: string; target?: string; at: number; taken?: boolean; done: (why: string | null) => void };
const spawns: Spawn[] = [], kids = new Map<string, string>(); // opened card -> the card that opened it
const MAX_KIDS = 6, SPAWN_WAIT = 8000;
const kidsOf = (id: string) => [...kids].filter(([k, p]) => p === id && ptys.get(k)?.code === undefined).length + spawns.filter((s) => s.parent === id && (s.kind === "agent" || s.kind === "shell")).length;
export async function ptySpawn(from: unknown, token: unknown, b: any, agents: string[]): Promise<{ id: string; queued?: boolean } | string> {
  const me = callerOf(from, token);
  if (!me) return "unknown pane or token";
  // ponytail: one level only (kids live in memory, so after a restart an opened card could open more); depth if needed.
  if (kids.has(me.id)) return "a card opened by another card can't open cards: ask the one that opened you";
  const kind = b.note !== undefined ? "sticky" : b.agent === "shell" ? "shell" : "agent";
  const text = String(b.note ?? "").trim().slice(0, 4000), prompt = String(b.prompt ?? "").trim().slice(0, 8000), cwd = String(b.cwd ?? "") || me.cwd;
  if (kind === "sticky" && !text) return "empty note";
  if (kind === "agent" && !agents.includes(b.agent)) return `say which agent: ${[...agents, "shell"].join(", ")}`;
  if (kind !== "sticky") {
    if (!isAbsolute(cwd) || !existsSync(cwd) || !statSync(cwd).isDirectory()) return `not a folder: ${cwd}`;
    if (kidsOf(me.id) >= MAX_KIDS) return `you already have ${MAX_KIDS} cards running; wait for one to finish or ask the user to close one`;
  }
  const k = `${me.id}>spawn`, now = Date.now(), recent = (sent.get(k) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) return "rate limit: 10 new cards a minute";
  sent.set(k, [...recent, now]);
  // The opened agent learns who gave it the task and how to answer, like a message does (see ptySend).
  const task = kind === "agent" && prompt ? `[Task from "${nameOf(me)}" (card ${me.id}) on the Overlook canvas. When you finish, or if you get stuck, report in a few lines with: overlook send ${me.id} "..."]\n${prompt}` : "";
  const s: Spawn = { id: `term_${now}_${Math.random().toString(36).slice(2, 6)}`, parent: me.id, kind, at: now, done: () => {},
    ...(kind === "sticky" ? { text } : { cwd, ...(kind === "agent" ? { agent: b.agent, prompt: task } : {}) }) };
  spawns.push(s);
  const why = await new Promise<string | null>((res) => { s.done = res; setTimeout(() => res(null), SPAWN_WAIT); });
  return why === null ? { id: s.id, queued: true } : why || { id: s.id };
}
// The canvas takes the requests for the cards it shows (panes: its terminal ids) and reports the ones it handled (done).
export function takeSpawns(panes: unknown, done: unknown) {
  if (Array.isArray(done)) for (const d of done) {
    const i = spawns.findIndex((s) => s.taken && s.id === d?.id);
    if (i < 0) continue;
    const [s] = spawns.splice(i, 1), why = typeof d.why === "string" ? d.why.slice(0, 200) : "";
    if (!why && (s.kind === "agent" || s.kind === "shell")) kids.set(s.id, s.parent);
    s.done(why);
  }
  // Nobody showed the caller for 10 min, or a canvas took one and never answered: dropped.
  const now = Date.now();
  for (let i = spawns.length - 1; i >= 0; i--) if (now - spawns[i].at > (spawns[i].taken ? 60_000 : 600_000)) spawns.splice(i, 1)[0].done("the canvas never opened it");
  const have = new Set(Array.isArray(panes) ? panes : []), mine = spawns.filter((s) => !s.taken && have.has(s.parent));
  for (const s of mine) s.taken = true;
  return mine.map(({ done: _, taken: __, at: ___, ...s }) => s);
}
// A TUI on the canvas learns how to reach its wired cards (agents with a `canvas` template, e.g. claude's system prompt).
export const withCanvas = (a: Agent, argv: string[]) => [...argv, ...(a.canvas ?? []).map((x) => x.replaceAll("{canvas}", CANVAS_HINT).replaceAll("{canvas-settings}", CANVAS_SETTINGS))];

export const openers = (a: Agent) => Object.entries(a.open ?? {}).map(([label, cmd]) => ({ label, session: cmd.some((x) => x.includes("{session}")) }));
// Launches detached; the caller has already validated session and cwd.
export function openIn(a: Agent, label: string, cwd: string, session = "") {
  const cmd = a.open?.[label];
  if (!cmd) return `${a.name} has no "${label}"`;
  if (cmd.some((x) => x.includes("{session}")) && !session) return "no session to open";
  if (cmd.some((x) => x.includes("{session}")) && sessionBusy(session)) return "this session is running here (task or terminal pane): stop or close it first";
  const [head, ...rest] = cmd.map((x) => x.replaceAll("{session}", session).replaceAll("{cwd}", cwd));
  let args: string[];
  if (head === "{terminal}") {
    const terms = detectTerminals();
    const envPref = process.env.DEFAULT_TERMINAL;
    const term = terms.find((t) => t.id === envPref) || terms.find((t) => t.id === "ghostty") || terms[0];
    if (!term) return "no terminal found: install ghostty, kitty, xdg-terminal-exec or set DEFAULT_TERMINAL in .env";
    const targetBin = bin(rest[0]) ?? rest[0];
    const targetArgs = [targetBin, ...rest.slice(1)];
    args = buildTerminalArgs(term.id, cwd, targetArgs);
    try {
      Bun.spawn(args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
      return true;
    } catch (err: any) {
      const fallbackId = process.env.TERMINAL_FALLBACK || (term.id === "ghostty" ? "kitty" : "ghostty");
      const fallbackTerm = terms.find((t) => t.id === fallbackId && t.id !== term.id);
      if (fallbackTerm) {
        const fbArgs = buildTerminalArgs(fallbackTerm.id, cwd, targetArgs);
        Bun.spawn(fbArgs, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
        return true;
      }
      return `failed to launch terminal: ${err.message}`;
    }
  } else {
    if (!bin(head)) return `${head} is not installed`;
    args = [bin(head)!, ...rest];
    Bun.spawn(args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
    return true;
  }
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

function system(root: string, role?: string) {
  const f = `${root}/AGENTS.md`;
  const rules = existsSync(f) ? `\n\nThe vault's own instructions (AGENTS.md):\n\n${readFileSync(f, "utf8")}` : "";
  return (role ? `Role: ${role}\n\n` : "") + "You are an agent working inside the user's Obsidian vault through four tools: list_notes, search_notes, read_note and write_note. "
    + "Paths are relative to the vault root, and you can only touch Markdown notes. Read a note before you replace it and keep the vault's "
    + "conventions (folders, frontmatter, links). When you are done, reply with a short summary of what you changed." + rules;
}

// ---------------------------------------------------------------- Anthropic (Claude)
async function anthropic(a: Agent, root: string, task: Task, prompt: string, signal: AbortSignal) {
  // Loaded on first use: the rest of Overlook runs without `bun install`.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env[a.key!], ...(a.url ? { baseURL: a.url } : {}), maxRetries: 0 });
  const model = task.model;
  const fallback = FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema as any, strict: true }));
  const messages: any[] = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await client.beta.messages.create({
      model, max_tokens: 16000, system: system(root, task.role), tools, messages,
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
async function openai(a: Agent, root: string, task: Task, prompt: string, signal: AbortSignal) {
  const tools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.schema } }));
  const messages: any[] = [{ role: "system", content: system(root, task.role) }, { role: "user", content: prompt }];
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
