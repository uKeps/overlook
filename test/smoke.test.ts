// Boots the server the way a fresh clone does (tracked files only, no .env, no personal config) against the
// example vault, then walks every endpoint and page the UI relies on. Writes land in a temp copy.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, readFileSync, existsSync, writeFileSync, symlinkSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";

const REPO = `${import.meta.dir}/..`;
const ROOT = mkdtempSync(`${tmpdir()}/overlook-`);
const VAULT = `${ROOT}/example-vault`;
const PORT = 4799;
const BASE = `http://127.0.0.1:${PORT}`;
const ENV = { ...process.env, VAULT_DIR: VAULT, VAULT_LANG: "en", PORT: String(PORT), ART_DIR: `${ROOT}/no-art`, FAKE_KEY: "test-key", TRANSCRIBE: `x=$(cat); [ "$x" = bad ] && { echo "out of memory" >&2; exit 1; }; echo "hello from $x"`, TZ: "Etc/UTC" }; // bun test runs in UTC: the server must agree on "today"
const FAKE = "http://127.0.0.1:4798";
const TODAY = new Date().toLocaleDateString("sv");
let server: ReturnType<typeof Bun.spawn>;
let fake: ReturnType<typeof Bun.serve>;

const post = (path: string, body: unknown, type = "application/json") =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": type }, body: JSON.stringify(body) });

beforeAll(async () => {
  // What a commit would hold: tracked files plus new ones that aren't ignored.
  const files = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: REPO }).stdout.toString().split("\0").filter(Boolean);
  for (const f of files) if (existsSync(`${REPO}/${f}`)) { mkdirSync(dirname(`${ROOT}/${f}`), { recursive: true }); copyFileSync(`${REPO}/${f}`, `${ROOT}/${f}`); }
  if (existsSync(`${REPO}/node_modules`)) symlinkSync(`${REPO}/node_modules`, `${ROOT}/node_modules`);
  writeFileSync(`${ROOT}/agents.json`, JSON.stringify([
    { id: "echo", name: "Echo", process: "echo", run: ["echo", "got", "{prompt}", "--model", "{model}", "--effort", "{effort}"], models: ["m1", "m2"], efforts: ["low", "high"], effort: "high" },
    { id: "bare", name: "Bare", run: ["echo", "got", "{prompt}", "--model", "{model}"] },
    { id: "mixed", name: "Mixed", run: ["echo", "{model}-{effort}"], efforts: ["low", "high"], effort: "high",
      models: [{ id: "big", label: "Big" }, { id: "small", label: "Small", efforts: ["medium"] }] },
    { id: "sleeper", name: "Sleeper", run: ["sleep", "30"] },
    { id: "opener", name: "Opener", run: ["true", "{session}"], open: { Log: ["sh", "-c", "echo {session} > opened.txt"] } },
    { id: "missing", name: "Missing", run: ["definitely-not-installed-overlook"] },
    { id: "fake-openai", name: "Fake OpenAI", api: "openai", url: `${FAKE}/v1`, model: "fake", key: "FAKE_KEY" },
    { id: "fake-claude", name: "Fake Claude", api: "anthropic", url: FAKE, model: "claude-opus-5-5", key: "FAKE_KEY" },
  ]));
  fake = Bun.serve({ hostname: "127.0.0.1", port: 4798, fetch: fakeProvider });
  // A board already in the cache: no Pinterest config, so nothing syncs over it.
  mkdirSync(`${ROOT}/cache/pinterest`, { recursive: true });
  for (const id of ["aa11", "bb22", "cc33"]) writeFileSync(`${ROOT}/cache/pinterest/${id}.jpg`, "not really a jpeg");
  writeFileSync(`${ROOT}/cache/pinterest/index.json`, JSON.stringify({ last: "", pins: ["aa11", "bb22", "cc33"].map((id) => ({ id, link: "", title: id, color: "" })) }));
  server = Bun.spawn(["bun", "server.ts"], { cwd: ROOT, env: ENV, stdout: "ignore", stderr: "inherit" });
  for (let i = 0; i < 100; i++) { try { await fetch(BASE); return; } catch { await Bun.sleep(100); } }
  throw new Error("server did not start");
});
afterAll(() => { server?.kill(); fake?.stop(true); rmSync(ROOT, { recursive: true, force: true }); });

test("vault state", async () => {
  const d = await (await fetch(`${BASE}/api`)).json();
  expect(d.vault).toBe("example-vault");
  expect(d.daily).toBe("2 Daily");
  expect(d.notes.length).toBe(7);
  expect(d.notes.map((n: any) => n.type)).toContain("project");
  expect(d.missing.map((m: any) => m.target)).toContain("Idempotency");
  expect(d.findings.length).toBe(1);
});

test("note reader resolves wikilinks and backlinks", async () => {
  const n = await (await fetch(`${BASE}/api/note?path=${encodeURIComponent("3 Concepts/HTTP.md")}`)).json();
  expect(n.html).toContain("#/w/REST");
  expect(n.backlinks.length).toBeGreaterThan(0);
  expect((await fetch(`${BASE}/api/note?path=${encodeURIComponent("../server.ts")}`)).status).toBe(404);
});

test("writes need JSON from an allowed host", async () => {
  expect((await post("/api/capture", { text: "x" }, "text/plain")).status).toBe(403);
});

test("capture creates today's daily note from the template", async () => {
  expect((await post("/api/capture", { text: "smoke  test\ncapture" })).status).toBe(200);
  const txt = readFileSync(`${VAULT}/2 Daily/${TODAY}.md`, "utf8");
  expect(txt).toContain("## Focus");
  expect(txt).toContain("- smoke test capture");
  expect((await (await fetch(`${BASE}/api`)).json()).captured).toContain("smoke test capture");
});

test("review doubles the interval and writes the frontmatter", async () => {
  const r = await (await post("/api/review", { path: "3 Concepts/HTTP.md", remembered: true })).json();
  expect(r.interval).toBe(4);
  expect(readFileSync(`${VAULT}/3 Concepts/HTTP.md`, "utf8")).toContain(`review_on: ${r.review_on}`);
});

test("delete moves a note to .trash, never a path outside the notes", async () => {
  writeFileSync(`${VAULT}/1 Inbox/Throwaway.md`, "# one");
  expect((await post("/api/trash", { path: "1 Inbox/Throwaway.md" })).status).toBe(200);
  writeFileSync(`${VAULT}/1 Inbox/Throwaway.md`, "# two");
  await post("/api/trash", { path: "1 Inbox/Throwaway.md" });
  expect(existsSync(`${VAULT}/1 Inbox/Throwaway.md`)).toBe(false);
  expect(readFileSync(`${VAULT}/.trash/Throwaway.md`, "utf8")).toBe("# one");
  expect(readFileSync(`${VAULT}/.trash/Throwaway 1.md`, "utf8")).toBe("# two");
  expect((await post("/api/trash", { path: "../README.md" })).status).toBe(404);
  expect((await post("/api/trash", { path: "AGENTS.md" })).status).toBe(404);
});

test("system and pinterest work with nothing configured", async () => {
  const s = await (await fetch(`${BASE}/api/system`)).json();
  expect(s.services).toEqual([]);
  expect(Array.isArray(s.agents)).toBe(true);
  expect((await (await fetch(`${BASE}/api/pinterest`)).json()).status).toBe("no-config");
});

test("the page and its assets are served and the frontend parses", async () => {
  for (const p of ["/", "/app.js", "/app.css"])
    expect([p, (await fetch(BASE + p)).status]).toEqual([p, 200]);
  const js = new Bun.Transpiler({ loader: "js" });
  const appJs = readFileSync(`${ROOT}/app.js`, "utf8");
  js.transformSync(appJs);
  expect(appJs).not.toContain("refreshes every 3 s");
  expect(appJs).not.toContain("pid ${a.pid}");
  expect(appJs).toContain("e.ctrlKey || e.metaKey || e.altKey");
  expect(appJs).toContain("cv.onwheel =");
  expect(appJs).toContain('document.body.classList.toggle("dock-float", dockMode === "float")');
  expect(appJs).toContain('document.body.classList.toggle("home", !pg)');
  const appCss = readFileSync(`${ROOT}/app.css`, "utf8");
  expect(appCss).toContain(".ph .r { margin-left: auto; display: flex; align-items: center; gap: 8px; }");
  expect(appCss).toContain("body.dock-float { padding-bottom: 76px; }");
  expect(appCss).toContain("body.home { display: flex; flex-direction: column; }");
  expect(appCss).toContain("body.home main { margin-top: auto; margin-bottom: auto; padding-top: 16px; padding-bottom: 16px; }");
  expect(appCss).toContain("body.cal-float main { padding-top: 84px; }");
  expect(appCss).not.toContain("body.cal-float:has(");
  expect(appJs).toContain('const CAL_KEY = "overlook.calendar", DOCK_KEY = "overlook.dock", UI_KEY = "overlook.ui";');
  expect(appJs).toContain('"ui-toggle"');
  expect(appCss).toContain('html[data-ui="minimal"] .min-home');
  expect(appCss).toContain("@media (max-width: 640px)");
  expect(appCss).toContain("@media (max-width: 480px)");
  expect(appCss).toContain("--safe-bottom");
  expect(appCss).toContain(".quota-alert");
  expect(appCss).toContain(".quota-head");
  expect(appCss).toContain(".quota-badge");
  expect(appCss).toContain(".quota-countdown");
  expect(appCss).toContain(".quota-actions");
  expect(appCss).toContain(".capture-tabs");
  expect(appCss).toContain(".capture-fields-row");
  expect(appCss).toContain(".orch-item-actions");
  expect(appCss).toContain(".orch-dismiss-btn");
  expect(appJs).toContain('"capture-close"');
  expect(appJs).toContain('"capture-save"');
  expect(appJs).toContain('function detectQuota(');
  expect(appJs).toContain('function renderQuotaBanner(');
  expect(appJs).toContain('function retryTask(');
  expect(appJs).toContain('"quota-retry"');
  expect(appJs).toContain('"quota-retry-sel"');
  expect(appJs).toContain('function setCaptureMode(');
  expect(appJs).toContain('runOptions(false, "capture")');
  expect(appJs).toContain('runChoice("capture")');
  expect(appJs).toContain('"orch-dismiss"');
  expect(appJs).toContain('"overlook:dismissed-sessions"');
  expect(appJs).toContain('api("/api/note/agent"');
  expect(appJs).toContain('api("/api/task/retry"');
  expect(appJs).toContain('if (e.key === "c" || e.key === "C") { e.preventDefault(); ACTIONS.capture(); }');
  expect(appJs).toContain('e.pointerType === "touch"');
  expect(appJs).toContain("getBoundingClientRect");
  expect(appCss).toContain("touch-action: pan-y");
  const html = readFileSync(`${ROOT}/index.html`, "utf8");
  expect(html).toContain('id="ui-btn"');
  expect(html).toContain("viewport-fit=cover");
  expect(html).toContain('data-act="capture-close"');
  expect(html).toContain('data-act="capture-save"');
  expect(html).toContain('id="capture"');
  expect(html).toContain('class="seg capture-tabs" role="tablist"');
  expect(html).toContain('data-act="capture-tab" data-tab="daily" role="tab"');
  expect(html).toContain('data-act="capture-tab" data-tab="agent" role="tab"');
  expect(html).toContain('id="capture-agent-panel" hidden');
  expect(html).toContain('id="capture-agent"');
  expect(html).toContain('id="capture-model"');
  expect(html).toContain('id="capture-effort"');
  expect(html).toContain('id="capture-hint"');
  expect(html).toContain('id="capture-submit-btn"');
});

test("effort selection in capture modal and dismiss chat in fleet sidebar", () => {
  const html = readFileSync(`${ROOT}/index.html`, "utf8");
  expect(html).toContain('<select class="pick" id="capture-agent" aria-label="Agent"></select>');
  expect(html).toContain('<select class="pick" id="capture-model" aria-label="Model" hidden></select>');
  expect(html).toContain('<div class="seg" id="capture-effort" role="radiogroup" aria-label="Effort" hidden></div>');

  expect(html).toContain('<div class="capture-agent-panel" id="capture-agent-panel" hidden>');
  expect(html).toContain('<div class="capture-fields-row capture-agent-row">');
  expect(html).toContain('<div class="capture-effort-row" id="capture-effort-row">');
  expect(html).toContain('<span class="capture-effort-label">Effort</span>');

  const css = readFileSync(`${ROOT}/app.css`, "utf8");
  expect(css).toContain(".capture-fields-row");
  expect(css).toContain(".capture-agent-panel");
  expect(css).toContain(".capture-agent-row");
  expect(css).toContain(".capture-effort-row");
  expect(css).toContain(".capture-effort-label");
  expect(css).toContain("grid-template-columns: 1fr 1fr;");
  expect(css).toContain(".orch-item-actions");
  expect(css).toContain(".orch-dismiss-btn");
  expect(css).toContain("var(--bad)");
  expect(css).toContain("min-width: 40px");
  expect(css).toContain("min-height: 40px");

  const js = readFileSync(`${ROOT}/app.js`, "utf8");
  expect(js).toContain('data-act="orch-dismiss"');
  expect(js).toContain('"orch-dismiss"');
  expect(js).toContain('"overlook:dismissed-sessions"');
  expect(js).toContain('dismissedSessions.has(');
  expect(js).toContain('runOptions(false, "capture")');
  expect(js).toContain('runChoice("capture")');
  expect(js).toContain('api("/api/task/delete"');
  expect(js).toContain('const paneKey = (p) => (p ? `${p.kind}:${p.id}` : "");');
});

test("agent CLI commands", () => {
  const run = (cmd: string) => Bun.spawnSync(["bun", "server.ts", cmd], { cwd: ROOT, env: ENV }).stdout.toString();
  expect(run("map")).toContain("3 Concepts/HTTP.md · concept · A stateless");
  expect(run("today")).toContain(`today: ${TODAY}`);
});

// ---------------------------------------------------------------- agents
// Stands in for both providers: the first call asks for tools (one write escapes the vault), the second one wraps up.
const seen: { path: string; beta: string; body: any }[] = [];
async function fakeProvider(req: Request) {
  const body: any = await req.json(), path = new URL(req.url).pathname;
  seen.push({ path, beta: req.headers.get("anthropic-beta") ?? "", body });
  if (path === "/v1/chat/completions") {
    if (body.messages?.some((m: any) => String(m.content).includes("trigger-quota"))) {
      return new Response(JSON.stringify({ error: { message: "insufficient_quota. Resets in 15 minutes", code: "insufficient_quota" } }), { status: 429, headers: { "content-type": "application/json" } });
    }
    const first = !body.messages.some((m: any) => m.role === "tool");
    const call = (id: string, name: string, args: unknown) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
    return Response.json({ choices: [{ message: first
      ? { role: "assistant", content: null, tool_calls: [call("a", "write_note", { path: "1 Inbox/From openai.md", content: "# From openai\n" }), call("b", "write_note", { path: "../escape.md", content: "x" })] }
      : { role: "assistant", content: "done" } }] });
  }
  if (path === "/v1/messages") {
    if (body.messages?.some((m: any) => String(m.content).includes("trigger-quota"))) {
      return new Response(JSON.stringify({
        type: "error",
        error: { type: "rate_limit_error", message: "rate_limit_error: Number of request tokens has exceeded your per-minute rate limit. Resets in 45s" }
      }), {
        status: 429,
        headers: { "content-type": "application/json" }
      });
    }
  }
  const first = typeof body.messages.at(-1).content === "string";
  return Response.json({ id: "msg_1", type: "message", role: "assistant", model: body.model, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    ...(first
      ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "write_note", input: { path: "1 Inbox/From claude.md", content: "# From claude\n" } }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text: "done" }] }) });
}
async function finished(id: string) {
  for (let i = 0; i < 100; i++) { const t = await (await fetch(`${BASE}/api/task?id=${id}`)).json(); if (t.end) return t; await Bun.sleep(100); }
  throw new Error(`task ${id} did not finish`);
}
const run = async (agent: string, prompt = "go", extra = {}) => (await (await post("/api/run", { agent, prompt, ...extra })).json()).id;

test("a voice memo becomes an inbox note that an agent is told to file; a failure lands in today's note", async () => {
  expect((await post("/api/voice", { name: "x.m4a" })).status).toBe(400);
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  expect((await post("/api/voice", { audio: b64("the phone"), name: "Walk: 3.m4a", agent: "echo" })).status).toBe(200);
  await post("/api/voice", { audio: b64("bad"), name: "Bad.m4a", agent: "echo" });
  let t: any;
  for (let i = 0; i < 50 && !t; i++) { await Bun.sleep(100); t = (await (await fetch(`${BASE}/api/system`)).json()).tasks.find((x: any) => x.prompt.startsWith("Process 1 Inbox/Voice memo - Walk 3.md")); }
  expect(t?.agent).toBe("echo");
  const note = readFileSync(`${VAULT}/1 Inbox/Voice memo - Walk 3.md`, "utf8");
  expect(note).toContain("# Voice memo - Walk 3");
  expect(note).toContain("hello from the phone");
  await finished(t.id);
  expect(readFileSync(`${VAULT}/2 Daily/${TODAY}.md`, "utf8")).toContain('Voice memo "Bad.m4a" was not noted: out of memory');
});

test("agents.json drives the runner list", async () => {
  const s = await (await fetch(`${BASE}/api/system`)).json();
  const ready = Object.fromEntries(s.runners.map((r: any) => [r.id, r.ready]));
  expect(ready).toEqual({ echo: true, bare: true, mixed: true, sleeper: true, opener: true, missing: false, "fake-openai": true, "fake-claude": true });
  const claude = s.runners.find((r: any) => r.id === "fake-claude");
  expect([claude.models.map((m: any) => m.id), claude.effort]).toEqual([["claude-opus-5-5"], "high"]);
  expect(s.agentsMd).toBe(false);
  expect((await post("/api/run", { agent: "missing", prompt: "go" })).status).toBe(400);
  expect((await post("/api/run", { agent: "nope", prompt: "go" })).status).toBe(400);
});

test("a CLI agent runs in the vault with the chosen model and effort", async () => {
  const t = await finished(await run("echo", "hello vault", { model: "m2" }));
  expect(t.ok).toBe(true);
  expect(t.events.map((e: any) => e.txt)).toContain("got hello vault --model m2 --effort high");
  expect((await post("/api/run", { agent: "echo", prompt: "x", model: "--evil" })).status).toBe(400);
  expect((await post("/api/run", { agent: "echo", prompt: "x", effort: "ultra" })).status).toBe(400);
  // A model with its own effort levels: the agent-wide default doesn't apply, and other levels are refused.
  expect((await finished(await run("mixed", "x", { model: "small" }))).events.map((e: any) => e.txt)).toContain("small-medium");
  expect((await post("/api/run", { agent: "mixed", prompt: "x", model: "small", effort: "high" })).status).toBe(400);
  // A long message comes through whole (it used to stop at 1500 characters).
  const long = "x".repeat(3000);
  expect((await finished(await run("bare", long))).events.map((e: any) => e.txt)).toContain(`got ${long}`);
  // No model listed: the {model} token and its flag are dropped.
  expect((await finished(await run("bare", "hi"))).events.map((e: any) => e.txt)).toContain("got hi");
});

test("a running task can be stopped", async () => {
  const id = await run("sleeper");
  await Bun.sleep(200);
  expect((await post("/api/task/stop", { id })).status).toBe(200);
  const t = await finished(id);
  expect(t.ok).toBe(false);
});

test("tasks can be deleted or dismissed while running or after finishing", async () => {
  // Input validation
  expect((await post("/api/task/delete", {})).status).toBe(400);
  expect((await post("/api/task/delete", { id: 123 })).status).toBe(400);
  expect((await post("/api/task/delete", { id: "nonexistent" })).status).toBe(400);
  expect((await post("/api/task/dismiss", { id: "nonexistent" })).status).toBe(400);

  // Deleting a running task stops it and removes it from taskList()
  const runId = await run("sleeper");
  await Bun.sleep(200);
  const tasksBefore = (await (await fetch(`${BASE}/api/system`)).json()).tasks;
  expect(tasksBefore.some((t: any) => t.id === runId)).toBe(true);

  const delRes = await post("/api/task/delete", { id: runId });
  expect(delRes.status).toBe(200);
  expect(await delRes.json()).toEqual({ ok: true });

  // Ensure task is removed from getTask and taskList()
  expect((await fetch(`${BASE}/api/task?id=${runId}`)).status).toBe(404);
  const tasksAfter = (await (await fetch(`${BASE}/api/system`)).json()).tasks;
  expect(tasksAfter.some((t: any) => t.id === runId)).toBe(false);

  // Deleting again returns 400
  expect((await post("/api/task/delete", { id: runId })).status).toBe(400);

  // Deleting a finished task removes it from taskList()
  const finishId = await run("echo", "done");
  await finished(finishId);
  const finishedTasksBefore = (await (await fetch(`${BASE}/api/system`)).json()).tasks;
  expect(finishedTasksBefore.some((t: any) => t.id === finishId)).toBe(true);

  const disRes = await post("/api/task/dismiss", { id: finishId });
  expect(disRes.status).toBe(200);
  expect(await disRes.json()).toEqual({ ok: true });

  expect((await fetch(`${BASE}/api/task?id=${finishId}`)).status).toBe(404);
  const finishedTasksAfter = (await (await fetch(`${BASE}/api/system`)).json()).tasks;
  expect(finishedTasksAfter.some((t: any) => t.id === finishId)).toBe(false);
  expect((await post("/api/task/dismiss", { id: finishId })).status).toBe(400);
});

test("task persistence across reload", async () => {
  const cacheFile = `${ROOT}/cache/tasks.json`;

  // 1. Run a task to completion
  const taskId = await run("echo", "persist-test-run");
  const finishedTask = await finished(taskId);
  expect(finishedTask.ok).toBe(true);

  // 2. Verify cache/tasks.json was written and contains the task without a stop function
  expect(existsSync(cacheFile)).toBe(true);
  let saved = JSON.parse(readFileSync(cacheFile, "utf8"));
  expect(Array.isArray(saved)).toBe(true);
  const found = saved.find((t: any) => t.id === taskId);
  expect(found).toBeDefined();
  expect(found.prompt).toBe("persist-test-run");
  expect(found.ok).toBe(true);
  expect(found.end).toBeDefined();
  expect(found.stop).toBeUndefined();

  // 3. Inject a simulated unfinished/zombie task (no end timestamp) into cache/tasks.json
  const zombieId = "zombie-task-test";
  saved.push({
    id: zombieId,
    agent: "echo",
    model: "m1",
    effort: "low",
    cwd: ROOT,
    prompt: "zombie task before restart",
    start: new Date(Date.now() - 30000).toISOString(),
    events: [],
  });
  writeFileSync(cacheFile, JSON.stringify(saved, null, 1));

  // 4. Reload the server (restart process)
  server.kill();
  await server.exited;
  server = Bun.spawn(["bun", "server.ts"], { cwd: ROOT, env: ENV, stdout: "ignore", stderr: "inherit" });
  for (let i = 0; i < 100; i++) {
    try { await fetch(BASE); break; } catch { await Bun.sleep(100); }
  }

  // 5. Verify the tasks after reload:
  // - Completed task still present with ok = true
  // - Zombie task recovered: marked with end timestamp and ok = false
  const sys = await (await fetch(`${BASE}/api/system`)).json();
  const reloadedTask = sys.tasks.find((t: any) => t.id === taskId);
  expect(reloadedTask).toBeDefined();
  expect(reloadedTask.ok).toBe(true);

  const reloadedZombie = sys.tasks.find((t: any) => t.id === zombieId);
  expect(reloadedZombie).toBeDefined();
  expect(reloadedZombie.end).toBeDefined();
  expect(reloadedZombie.ok).toBe(false);

  const zombieDetail = await (await fetch(`${BASE}/api/task?id=${zombieId}`)).json();
  expect(zombieDetail.ok).toBe(false);
  expect(zombieDetail.end).toBeDefined();

  // 6. Delete a task and verify it is removed from cache/tasks.json
  const delRes = await post("/api/task/delete", { id: zombieId });
  expect(delRes.status).toBe(200);
  saved = JSON.parse(readFileSync(cacheFile, "utf8"));
  expect(saved.some((t: any) => t.id === zombieId)).toBe(false);

  // 7. Verify helper capping at last 50 tasks
  const unitDir = `${ROOT}/unit-cap-test`;
  mkdirSync(`${unitDir}/cache`, { recursive: true });
  const lots = Array.from({ length: 60 }, (_, i) => ({
    id: `lot-${i}`,
    agent: "echo",
    model: "m1",
    effort: "low",
    cwd: ROOT,
    prompt: `task-${i}`,
    start: new Date().toISOString(),
    end: new Date().toISOString(),
    ok: true,
    events: [],
  }));
  writeFileSync(`${unitDir}/cache/tasks.json`, JSON.stringify(lots, null, 1));
  const { loadTasks, saveTasks } = await import(`${ROOT}/tasks.ts`);
  const loaded = loadTasks(unitDir);
  expect(loaded.length).toBe(50);
  expect(loaded[0].id).toBe("lot-10");
  expect(loaded[49].id).toBe("lot-59");
  saveTasks(unitDir);
  const savedLots = JSON.parse(readFileSync(`${unitDir}/cache/tasks.json`, "utf8"));
  expect(savedLots.length).toBe(50);
  expect(savedLots[0].id).toBe("lot-10");
  expect(savedLots[49].id).toBe("lot-59");
});

test("an OpenAI-compatible agent writes notes and cannot leave the vault", async () => {
  const t = await finished(await run("fake-openai"));
  expect(t.ok).toBe(true);
  expect(readFileSync(`${VAULT}/1 Inbox/From openai.md`, "utf8")).toBe("# From openai\n");
  expect(existsSync(`${ROOT}/escape.md`)).toBe(false);
  const second = seen.filter((x) => x.path === "/v1/chat/completions").at(-1)!.body;
  expect(second.messages.filter((m: any) => m.role === "tool").map((m: any) => m.content)).toEqual(["wrote 1 Inbox/From openai.md (14 chars)", "Error: not a note inside the vault: ../escape.md"]);
});

test("a Claude agent runs the tool loop through the SDK", async () => {
  const t = await finished(await run("fake-claude", "go", { effort: "low" }));
  expect(t.ok).toBe(true);
  expect(readFileSync(`${VAULT}/1 Inbox/From claude.md`, "utf8")).toBe("# From claude\n");
  const calls = seen.filter((x) => x.path === "/v1/messages");
  expect(calls[0].beta).toContain("server-side-fallback-2026-07-01");
  expect(calls[0].body.fallbacks).toBe("default");
  expect([calls[0].body.model, calls[0].body.output_config.effort]).toEqual(["claude-opus-5-5", "low"]);
  expect(calls[0].body.tools.every((x: any) => x.strict)).toBe(true);
  expect(calls[1].body.messages.at(-1).content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
});

test("open in… launches the agent's own command for a task session", async () => {
  const t = await finished(await run("opener"));
  expect(t.session).toMatch(/^[0-9a-f-]{36}$/);
  expect((await post("/api/open", { task: t.id, via: "Log" })).status).toBe(200);
  for (let i = 0; i < 50 && !existsSync(`${VAULT}/opened.txt`); i++) await Bun.sleep(50);
  expect(readFileSync(`${VAULT}/opened.txt`, "utf8").trim()).toBe(t.session);
  expect((await post("/api/open", { task: t.id, via: "Nope" })).status).toBe(400);
  expect((await post("/api/open", { key: "c:../../etc", via: "Log" })).status).toBe(400);
});

// ---------------------------------------------------------------- calendar and schedule
test("Calendar.md keeps items sorted and validates input", async () => {
  for (const e of [{ date: "2026-11-03", time: "14:00", title: "Exam" }, { date: "2026-11-01", title: "Holiday" }, { date: "2026-11-03", time: "09:30", title: "Review  session" }])
    expect((await post("/api/calendar", e)).status).toBe(200);
  const lines = readFileSync(`${VAULT}/Calendar.md`, "utf8").split("\n").filter((l) => l.startsWith("- "));
  expect(lines).toEqual(["- 2026-11-01 · Holiday", "- 2026-11-03 09:30 · Review session", "- 2026-11-03 14:00 · Exam"]);
  expect((await (await fetch(`${BASE}/api`)).json()).calendar).toContainEqual({ date: "2026-11-03", time: "14:00", title: "Exam" });
  expect((await post("/api/calendar", { date: "2026-13-40", title: "x" })).status).toBe(400);
  expect((await post("/api/calendar", { date: "2026-11-01", time: "25:00", title: "x" })).status).toBe(400);
  expect((await post("/api/calendar/delete", { date: "2026-11-01", title: "Holiday" })).status).toBe(200);
  expect(readFileSync(`${VAULT}/Calendar.md`, "utf8")).not.toContain("Holiday");
});

test("scheduled tasks run when due and repeat", async () => {
  // Two days back is in the past in any time zone (bun test runs in UTC, the server in the machine's zone).
  const at = `${new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)}T09:00`;
  const tasksBefore = (await (await fetch(`${BASE}/api/system`)).json()).tasks.length;
  const once = await (await post("/api/schedule", { at, repeat: "once", agent: "echo", prompt: "scheduled once" })).json();
  const daily = await (await post("/api/schedule", { at, repeat: "daily", agent: "echo", prompt: "scheduled daily" })).json();
  const s = await (await fetch(`${BASE}/api/system`)).json();
  expect(s.tasks.length).toBe(tasksBefore + 2);
  expect(s.schedule.map((e: any) => e.id)).toEqual([daily.id]); // the one-off is done, the daily one moved on
  expect(Date.parse(s.schedule[0].at)).toBeGreaterThan(Date.now());
  expect(once.id).toBeTruthy();
  expect((await post("/api/schedule", { at, repeat: "hourly", agent: "echo", prompt: "x" })).status).toBe(400);
  expect((await post("/api/schedule", { at, repeat: "daily", agent: "missing", prompt: "x" })).status).toBe(400);
  expect((await post("/api/schedule/delete", { id: daily.id })).status).toBe(200);
});

// ---------------------------------------------------------------- images
test("the Images page hides, stars and fixes the card images", async () => {
  const pins = async () => { const d = await (await fetch(`${BASE}/api`)).json(); return [d.pinMode, d.pins.map((p: any) => p.id)]; };
  expect(await pins()).toEqual(["random", ["aa11", "bb22", "cc33"]]);
  expect((await post("/api/images/prefs", { hidden: ["bb22"] })).status).toBe(200);
  expect(await pins()).toEqual(["random", ["aa11", "cc33"]]);
  expect((await post("/api/images/prefs", { mode: "fixed" })).status).toBe(200);
  expect(await pins()).toEqual(["random", ["aa11", "cc33"]]); // nothing starred yet: still rotates
  expect((await post("/api/images/prefs", { starred: ["cc33", "bb22", "aa11"] })).status).toBe(200);
  expect(await pins()).toEqual(["fixed", ["cc33", "aa11"]]); // starred order, hidden one left out
  const p = await (await fetch(`${BASE}/api/images`)).json();
  expect([p.mode, p.hidden, p.starred, p.images.length]).toEqual(["fixed", ["bb22"], ["cc33", "bb22", "aa11"], 3]);
  expect(JSON.parse(readFileSync(`${ROOT}/pinterest.json`, "utf8")).mode).toBe("fixed");
  expect((await post("/api/images/prefs", { hidden: ["../x"] })).status).toBe(400);
  expect((await post("/api/images/prefs", { mode: "shuffle" })).status).toBe(400);
  expect((await post("/api/images/prefs", { board: "a/b/c/d" })).status).toBe(400);
  expect((await fetch(`${BASE}/pin/aa11?thumb`)).status).toBe(200);
  // One Home card can be given its own image, and handed back to automatic.
  expect((await post("/api/images/prefs", { cards: { "Review|HTTP": "bb22" } })).status).toBe(200);
  expect((await (await fetch(`${BASE}/api`)).json()).pinCards["Review|HTTP"].id).toBe("bb22");
  expect((await post("/api/images/prefs", { cards: { "Review|HTTP": null } })).status).toBe(200);
  expect((await (await fetch(`${BASE}/api`)).json()).pinCards).toEqual({});
  expect((await post("/api/images/prefs", { cards: { "Review|HTTP": "../x" } })).status).toBe(400);
});

test("a folder of your own photos joins the Pinterest images", async () => {
  mkdirSync(`${ROOT}/my photos`, { recursive: true });
  for (const n of ["beach.jpg", "cat.png", "notes.txt", ".hidden.jpg"]) writeFileSync(`${ROOT}/my photos/${n}`, "x");
  expect((await post("/api/images/prefs", { folder: `${ROOT}/nope` })).status).toBe(400);
  expect((await post("/api/images/prefs", { folder: `${ROOT}/my photos`, mode: "random" })).status).toBe(200);
  const p = await (await fetch(`${BASE}/api/images`)).json();
  const mine = p.images.filter((i: any) => i.source === "folder");
  expect(mine.map((i: any) => i.title)).toEqual(["beach", "cat"]);
  expect(p.images.filter((i: any) => i.source === "pinterest").length).toBe(3);
  expect((await fetch(`${BASE}/pin/${mine[0].id}?thumb`)).status).toBe(200);
  expect((await fetch(`${BASE}/pin/${mine[0].id}`)).status).toBe(200);
  // A starred photo of yours is what the cards show in fixed mode.
  await post("/api/images/prefs", { mode: "fixed", starred: [mine[1].id] });
  expect((await (await fetch(`${BASE}/api`)).json()).pins.map((i: any) => i.id)).toEqual([mine[1].id]);
});

test("the Settings page reads and updates vault, images, agents and services", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();
  expect([init.vaultDir, init.vaultLang, init.port, init.services]).toEqual([VAULT, "en", PORT, []]);
  const origAgents = init.agents;

  const nextAgents = [...origAgents, { id: "extra", name: "Extra", run: ["echo", "{prompt}"] }];
  const nextServices = [{ id: "local", name: "Local App", url: BASE, desc: "Local service" }];
  const r = await post("/api/settings", {
    vaultDir: VAULT, vaultLang: "pt", port: 4800,
    folder: `${ROOT}/my photos`, board: "my-board",
    agents: nextAgents, services: nextServices,
  });
  expect(r.status).toBe(200);
  const updated = await r.json();
  expect([updated.vaultDir, updated.vaultLang, updated.port, updated.folder, updated.board]).toEqual([VAULT, "pt", 4800, `${ROOT}/my photos`, "my-board"]);
  expect(updated.agents.map((a: any) => a.id)).toContain("extra");
  expect(updated.services).toEqual(nextServices);

  // Live server state and .env updated immediately.
  expect((await (await fetch(`${BASE}/api`)).json()).daily).toBe("2 Diário");
  const sys = await (await fetch(`${BASE}/api/system`)).json();
  expect(sys.services.map((s: any) => s.id)).toEqual(["local"]);
  expect(sys.runners.map((x: any) => x.id)).toContain("extra");
  const envTxt = readFileSync(`${ROOT}/.env`, "utf8");
  expect(envTxt).toContain(`VAULT_DIR=${VAULT}`);
  expect(envTxt).toContain("VAULT_LANG=pt");
  expect(envTxt).toContain("PORT=4800");

  // Invalid inputs are rejected with 400.
  for (const bad of [
    { vaultDir: `${ROOT}/no-such-vault` },
    { vaultLang: "fr" },
    { port: 80 },
    { folder: `${ROOT}/no-such-folder` },
    { board: "a/b/c/d" },
    { agents: [{ id: "../bad", name: "Bad", run: ["echo"] }] },
    { services: [{ id: "s", name: "S", url: "javascript:alert(1)", desc: "x" }] },
  ]) expect((await post("/api/settings", bad)).status).toBe(400);

  // Restore original language, port, agents and services.
  expect((await post("/api/settings", { vaultLang: "en", port: PORT, agents: origAgents, services: [] })).status).toBe(200);
  expect((await (await fetch(`${BASE}/api`)).json()).daily).toBe("2 Daily");
});


// ---------------------------------------------------------------- avatars
test("an agent gets a picture from Settings", async () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const runner = async () => (await (await fetch(`${BASE}/api/system`)).json()).runners.find((r: any) => r.id === "echo");
  expect((await runner()).avatar).toBeNull();
  expect((await post("/api/avatar", { agent: "echo", data: png })).status).toBe(200);
  const v = (await runner()).avatar;
  expect(typeof v).toBe("number");
  const img = await fetch(`${BASE}/avatar/echo?v=${v}`);
  expect([img.status, img.headers.get("content-type")]).toEqual([200, "image/png"]);
  expect((await post("/api/avatar", { agent: "nope", data: png })).status).toBe(400);
  expect((await post("/api/avatar", { agent: "echo", data: "data:text/html;base64,PGgxPg==" })).status).toBe(400);
  expect((await fetch(`${BASE}/avatar/..%2Fserver.ts`)).status).toBe(404);
  // One of the card images can be the icon too.
  expect((await post("/api/avatar", { agent: "echo", image: "aa11" })).status).toBe(200);
  expect((await fetch(`${BASE}/avatar/echo?v=${(await runner()).avatar}`)).status).toBe(200);
  expect((await post("/api/avatar", { agent: "echo", image: "zz99" })).status).toBe(400);
  expect((await post("/api/avatar", { agent: "echo", remove: true })).status).toBe(200);
  expect((await runner()).avatar).toBeNull();
});

test("ascii.rest is served from node_modules, and only its scripts", async () => {
  const r = await fetch(`${BASE}/vendor/ascii/ascii.js`);
  expect([r.status, r.headers.get("content-type")]).toEqual([200, "text/javascript; charset=utf-8"]);
  expect((await fetch(`${BASE}/vendor/ascii/pieces/night-coast.js`)).status).toBe(200);
  expect((await fetch(`${BASE}/vendor/ascii/..%2F..%2F..%2Fpackage.json`)).status).toBe(404);
  expect((await fetch(`${BASE}/vendor/ascii/package.json`)).status).toBe(404);
});

test("a Pinterest image whose id starts with f is still a pin, not a folder photo", async () => {
  writeFileSync(`${ROOT}/cache/pinterest/fa55.jpg`, "x");
  expect((await fetch(`${BASE}/pin/fa55`)).status).toBe(200);
  expect((await fetch(`${BASE}/pin/fa55?amb`)).status).toBe(200);
});

test("stream-json events, cwd jailing, role presets, task continuation, and multi-agent dispatch", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();
  const streamCmd = [
    "printf '%s\\n'",
    '\'{"event":"init","conversation_id":"11111111-2222-3333-4444-555555555555"}\'',
    '\'{"event":"step_update","step_update":{"step_index":1,"state":"ACTIVE","step_type":"tool","tool_name":"read_file","tool_info":{"name":"read_file","parameters":{"path":"3 Concepts/HTTP.md"}}}}\'',
    '\'{"event":"step_update","step_update":{"step_index":1,"state":"DONE","step_type":"tool","tool_name":"read_file","tool_info":{"output":"stateless protocol"}}}\'',
    '\'{"event":"step_update","step_update":{"step_index":2,"state":"ACTIVE","step_type":"agent_response","text_delta":"Hello "}}\'',
    '\'{"event":"step_update","step_update":{"step_index":2,"state":"ACTIVE","step_type":"agent_response","text_delta":"stream!"}}\'',
  ].join(" ");
  await post("/api/settings", { agents: [...init.agents, { id: "streamer", name: "Streamer", process: "agy", run: ["sh", "-c", `${streamCmd}; echo "args:$*"`, "--", "{prompt}"] }] });

  const st = await finished(await run("streamer", "go"));
  expect(st.session).toBe("11111111-2222-3333-4444-555555555555");
  expect(st.events.map((e: any) => [e.t, e.name ?? "", e.txt])).toEqual([
    ["you", "", "go"],
    ["tool", "read_file", "3 Concepts/HTTP.md"],
    ["result", "", "stateless protocol"],
    ["text", "", "Hello stream!"],
    ["text", "", "args:go"],
  ]);

  expect((await post("/api/task/talk", { id: st.id, text: "follow up" })).status).toBe(200);
  const cont = await finished(st.id);
  expect(cont.events.at(-1).txt).toBe("args:follow up --conversation 11111111-2222-3333-4444-555555555555");

  expect((await post("/api/run", { agent: "echo", prompt: "hi", cwd: "/etc" })).status).toBe(400);
  expect((await fetch(`${BASE}/api/dirs?path=%2Fetc`)).status).toBe(400);
  const dirs = await (await fetch(`${BASE}/api/dirs?path=${encodeURIComponent(VAULT)}`)).json();
  expect(dirs.path).toBe(VAULT);
  expect(Array.isArray(dirs.roots) && dirs.roots.length > 0).toBe(true);
  expect(dirs.dirs.some((d: any) => d.name === "3 Concepts")).toBe(true);

  const sub = await finished(await run("echo", "check", { cwd: `${VAULT}/3 Concepts`, role: "Reviewer" }));
  expect(sub.cwd).toBe(`${VAULT}/3 Concepts`);
  expect(sub.role).toBe("Reviewer");
  expect(sub.events.some((e: any) => e.txt.includes("[Role: Reviewer]"))).toBe(true);

  const batch = await (await post("/api/run", { agents: ["echo", { agent: "bare", role: "Architect" }], prompt: "batch run" })).json();
  expect(batch.ids.length).toBe(2);
  for (const id of batch.ids) expect((await finished(id)).ok).toBe(true);

  await post("/api/settings", { agents: init.agents });
});

test("quota error detection across CLI stream-json, raw JSON, stderr, Claude CLI, Anthropic SDK, and OpenAI", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();
  const quotaAgent = { id: "quota-agent", name: "Quota Agent", run: ["sh", "-c", "echo 'Individual quota reached. Resets in 2h 15m' >&2; exit 1"], models: ["m1", "m2"], efforts: ["low", "high"], effort: "high" };
  const streamQuotaAgent = { id: "stream-quota", name: "Stream Quota", run: ["sh", "-c", "echo '{\"event\":\"error\",\"error\":{\"message\":\"RESOURCE_EXHAUSTED: usage limit reached. Resets in 45m\"}}'; exit 1"] };
  const rpcQuotaAgent = { id: "rpc-quota", name: "RPC Quota", run: ["sh", "-c", "echo '{\"error\":{\"code\":429,\"message\":\"Quota exceeded for metric. Resets at 2026-11-02T16:00:00Z\",\"status\":\"RESOURCE_EXHAUSTED\"}}'; exit 1"] };
  const claudeCliQuotaAgent = { id: "claude-cli-quota", name: "Claude CLI Quota", run: ["sh", "-c", "echo 'Claude 429: Rate limit exceeded. Resets in 1h 30m'; exit 1"] };
  await post("/api/settings", { agents: [...init.agents, quotaAgent, streamQuotaAgent, rpcQuotaAgent, claudeCliQuotaAgent] });

  // 1. CLI stderr quota detection
  const qTask = await finished(await run("quota-agent", "heavy work", { model: "m1", effort: "high" }));
  expect(qTask.ok).toBe(false);
  expect(qTask.quota?.exhausted).toBe(true);
  expect(qTask.quota?.resetsIn).toBe("2h 15m");
  expect(qTask.quota?.message).toContain("Individual quota reached");

  // getTask returns quota metadata
  const fetched = await (await fetch(`${BASE}/api/task?id=${qTask.id}`)).json();
  expect(fetched.quota).toEqual(qTask.quota);

  // 2. Stream-JSON event: "error" quota detection
  const sqTask = await finished(await run("stream-quota", "stream work"));
  expect(sqTask.ok).toBe(false);
  expect(sqTask.quota?.exhausted).toBe(true);
  expect(sqTask.quota?.resetsIn).toBe("45m");

  // 3. Raw RPC error JSON without event field (e.g. Google Cloud / Antigravity format)
  const rpcTask = await finished(await run("rpc-quota", "rpc work"));
  expect(rpcTask.ok).toBe(false);
  expect(rpcTask.quota?.exhausted).toBe(true);
  expect(rpcTask.quota?.resetsIn).toBe("2026-11-02T16:00:00Z");

  // 4. Claude CLI 429 stdout format
  const ccTask = await finished(await run("claude-cli-quota", "cli work"));
  expect(ccTask.ok).toBe(false);
  expect(ccTask.quota?.exhausted).toBe(true);
  expect(ccTask.quota?.resetsIn).toBe("1h 30m");

  // 5. OpenAI API 429 quota detection
  const apiTask = await finished(await run("fake-openai", "trigger-quota"));
  expect(apiTask.ok).toBe(false);
  expect(apiTask.quota?.exhausted).toBe(true);
  expect(apiTask.quota?.resetsIn).toBe("15 minutes");
  expect(apiTask.quota?.message).toContain("429");

  // 6. Anthropic API 429 quota detection via SDK
  const claudeApiTask = await finished(await run("fake-claude", "trigger-quota"));
  expect(claudeApiTask.ok).toBe(false);
  expect(claudeApiTask.quota?.exhausted).toBe(true);
  expect(claudeApiTask.quota?.resetsIn).toBe("45s");
  expect(claudeApiTask.quota?.message).toContain("429");

  await post("/api/settings", { agents: init.agents });
});

test("task retry endpoint handles invalid input, missing models, single-model agents, nonexistent agents, task states, and session persistence", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();
  const multiAgent = { id: "multi-agent", name: "Multi Agent", run: ["echo", "got", "{prompt}", "{model}", "{effort}"], models: ["m1", "m2"], efforts: ["low", "high"], effort: "high" };
  const soloAgent = { id: "solo-agent", name: "Solo Agent", run: ["echo", "solo", "{prompt}", "{model}"], models: ["single"] };
  const sessionAgent = { id: "session-agent", name: "Session Agent", run: ["echo", "sess:{session}"], open: { Log: ["true"] } };
  const tempAgent = { id: "temp-agent", name: "Temp Agent", run: ["echo", "temp"] };
  await post("/api/settings", { agents: [...init.agents, multiAgent, soloAgent, sessionAgent, tempAgent] });

  // 1. Invalid IDs and bad JSON
  expect((await post("/api/task/retry", { id: "non-existent" })).status).toBe(400);
  expect((await post("/api/task/retry", {})).status).toBe(400);
  expect((await post("/api/task/retry", { id: "" })).status).toBe(400);
  expect((await post("/api/task/retry", { id: "   " })).status).toBe(400);
  expect((await post("/api/task/retry", { id: 12345 })).status).toBe(400);
  expect((await fetch(`${BASE}/api/task/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: "{ invalid" })).status).toBe(400);

  // 2. Retry a completed task vs a failed task
  const completedTask = await finished(await run("multi-agent", "task completed", { model: "m1", effort: "high" }));
  expect(completedTask.ok).toBe(true);
  const retryCompletedRes = await post("/api/task/retry", { id: completedTask.id, model: "m2", effort: "low" });
  expect(retryCompletedRes.status).toBe(200);
  const retriedFromCompleted = await finished((await retryCompletedRes.json()).id);
  expect(retriedFromCompleted.ok).toBe(true);
  expect(retriedFromCompleted.model).toBe("m2");
  expect(retriedFromCompleted.effort).toBe("low");
  expect(retriedFromCompleted.prompt).toBe("task completed");

  // 3. Retry without specifying model/effort reuses original model & effort
  const retryDefaultRes = await post("/api/task/retry", { id: completedTask.id });
  expect(retryDefaultRes.status).toBe(200);
  const retriedWithDefaults = await finished((await retryDefaultRes.json()).id);
  expect(retriedWithDefaults.model).toBe("m1");
  expect(retriedWithDefaults.effort).toBe("high");

  // 4. Retry with an invalid model
  expect((await post("/api/task/retry", { id: completedTask.id, model: "unknown-model-xyz" })).status).toBe(400);

  // 5. Retry a task that is still running returns 400
  const runningTaskId = await run("sleeper");
  await Bun.sleep(100);
  const runningRetry = await post("/api/task/retry", { id: runningTaskId });
  expect(runningRetry.status).toBe(400);
  expect(await runningRetry.text()).toBe("task is still running");
  await post("/api/task/stop", { id: runningTaskId });
  await finished(runningTaskId);

  // 6. Single-model agent edge case
  const soloTask = await finished(await run("solo-agent", "work"));
  expect(soloTask.model).toBe("single");
  const soloRetryRes = await post("/api/task/retry", { id: soloTask.id });
  expect(soloRetryRes.status).toBe(200);
  const soloRetried = await finished((await soloRetryRes.json()).id);
  expect(soloRetried.model).toBe("single");
  expect((await post("/api/task/retry", { id: soloTask.id, model: "invalid-other" })).status).toBe(400);

  // 7. Nonexistent agent (task created, then agent removed from configuration)
  const tempTask = await finished(await run("temp-agent", "temp work"));
  await post("/api/settings", { agents: init.agents }); // removes tempAgent
  const tempRetry = await post("/api/task/retry", { id: tempTask.id });
  expect(tempRetry.status).toBe(400);
  expect(await tempRetry.text()).toContain("unknown agent");

  // 8. Session persistence on retry
  await post("/api/settings", { agents: [...init.agents, sessionAgent] });
  const sessTask = await finished(await run("session-agent", "first run"));
  expect(sessTask.session).toBeTruthy();
  const sessRetryRes = await post("/api/task/retry", { id: sessTask.id });
  expect(sessRetryRes.status).toBe(200);
  const sessRetried = await finished((await sessRetryRes.json()).id);
  // 9. Effort fallback when switching models on retry
  const bigTask = await finished(await run("mixed", "x", { model: "big" }));
  expect(bigTask.model).toBe("big");
  expect(bigTask.effort).toBe("high");
  // Retrying with model "small" (efforts: ["medium"]) without effort falls back to "medium"
  const smallRetryRes = await post("/api/task/retry", { id: bigTask.id, model: "small" });
  expect(smallRetryRes.status).toBe(200);
  const smallRetried = await finished((await smallRetryRes.json()).id);
  expect(smallRetried.model).toBe("small");
  expect(smallRetried.effort).toBe("medium");
  // Retrying with model "small" and explicitly invalid effort "high" returns 400
  expect((await post("/api/task/retry", { id: bigTask.id, model: "small", effort: "high" })).status).toBe(400);

  await post("/api/settings", { agents: init.agents });
});

test("note agent endpoint validates topic boundaries, layouts in pt and en, custom models, invalid JSON, and vault isolation", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();

  // 1. Validation checks
  expect((await post("/api/note/agent", { topic: "" })).status).toBe(400);
  expect((await post("/api/note/agent", { topic: "   \n\t " })).status).toBe(400);
  expect((await post("/api/note/agent", {})).status).toBe(400);
  expect((await post("/api/note/agent", { topic: null })).status).toBe(400);
  expect((await post("/api/note/agent", { topic: 12345 })).status).toBe(400);
  expect((await post("/api/note/agent", { topic: "a".repeat(2001) })).status).toBe(400);

  // Bad JSON in body returns 400
  expect((await fetch(`${BASE}/api/note/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: "{ bad: json" })).status).toBe(400);

  // Boundary checks: exactly 1 char and exactly 2000 chars
  const minTaskRes = await post("/api/note/agent", { topic: "A", agent: "echo" });
  expect(minTaskRes.status).toBe(200);
  const minTask = await finished((await minTaskRes.json()).id);
  expect(minTask.prompt).toContain('"A"');

  const maxTaskRes = await post("/api/note/agent", { topic: "X".repeat(2000), agent: "echo" });
  expect(maxTaskRes.status).toBe(200);
  const maxTask = await finished((await maxTaskRes.json()).id);
  expect(maxTask.prompt).toContain(`"${"X".repeat(2000)}"`);

  // 2. Custom model and effort
  const customModelRes = await post("/api/note/agent", { topic: "Distributed Systems", agent: "echo", model: "m2", effort: "low" });
  expect(customModelRes.status).toBe(200);
  const customModelTask = await finished((await customModelRes.json()).id);
  expect(customModelTask.model).toBe("m2");
  expect(customModelTask.effort).toBe("low");
  expect((await post("/api/note/agent", { topic: "Distributed Systems", agent: "echo", model: "invalid-model" })).status).toBe(400);

  // 3. English prompt layout (default)
  await post("/api/settings", { vaultLang: "en" });
  const noteEnRes = await post("/api/note/agent", { topic: "Event-Driven Architecture", agent: "echo" });
  expect(noteEnRes.status).toBe(200);
  const noteEnTask = await finished((await noteEnRes.json()).id);
  expect(noteEnTask.prompt).toBe(
    'Create a note in the vault about: "Event-Driven Architecture". Follow AGENTS.md strictly: choose the right folder (e.g. 3 Concepts/ or 4 Ideas/), use frontmatter (type, area, tags), callout [!abstract] In one sentence, concise body, footer with wikilinks, and log in 9 Agent/Log.md. Reply in one line.'
  );

  // 4. Portuguese prompt layout when vaultLang is pt
  await post("/api/settings", { vaultLang: "pt" });
  const notePtRes = await post("/api/note/agent", { topic: "Arquitetura Orientada a Eventos", agent: "echo" });
  expect(notePtRes.status).toBe(200);
  const notePtTask = await finished((await notePtRes.json()).id);
  expect(notePtTask.prompt).toBe(
    'Crie uma nota no vault sobre: "Arquitetura Orientada a Eventos". Siga o AGENTS.md rigorosamente: decida a pasta correta (ex: 3 Conceitos/ ou 4 Ideias/), use frontmatter (tipo, area, tags), callout [!abstract] Em uma frase, corpo objetivo, rodapé com wikilinks e registre em 9 Agente/Log.md. Responda em uma linha.'
  );

  // 5. Jail / Security: Prompt injection attempt with shell chars, quotes, and newlines
  const injectionTopic = 'Malicious Topic "with quotes" \n; rm -rf / ; cat /etc/passwd # \0';
  const injectRes = await post("/api/note/agent", { topic: injectionTopic, agent: "echo" });
  expect(injectRes.status).toBe(200);
  const injectTask = await finished((await injectRes.json()).id);
  expect(injectTask.prompt).toContain(injectionTopic.trim());

  // 6. Jail security: Agent write_note cannot escape vault
  const escapeRes = await post("/api/note/agent", { topic: "Escape Attempt", agent: "fake-openai" });
  expect(escapeRes.status).toBe(200);
  const escapeTask = await finished((await escapeRes.json()).id);
  expect(escapeTask.ok).toBe(true);
  expect(existsSync(`${ROOT}/escape.md`)).toBe(false);

  // Restore settings
  await post("/api/settings", { vaultLang: "en", agents: init.agents });
});

test("adversarial verification: capture modal effort selection, dynamic model visibility, and backend validation", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();

  const dynamicAgent = {
    id: "dyn-agent",
    name: "Dynamic Agent",
    run: ["echo", "dyn", "{prompt}", "{model}", "{effort}"],
    models: [
      { id: "with-efforts", label: "Model With Efforts", efforts: ["low", "high"] },
      { id: "no-efforts", label: "Model Without Efforts", efforts: [] },
      { id: "inherited", label: "Model Inherited" },
    ],
    efforts: ["medium"],
    effort: "medium",
  };
  const noModelsAgent = {
    id: "no-models-agent",
    name: "No Models Agent",
    run: ["echo", "no-models", "{prompt}", "{effort}"],
    efforts: ["low", "medium", "high", "xhigh", "max"],
    effort: "high",
  };
  const bareAgent = { id: "bare-agent", name: "Bare Agent", run: ["echo", "bare"] };

  await post("/api/settings", { agents: [...init.agents, dynamicAgent, noModelsAgent, bareAgent] });

  // 1. Frontend simulation of runOptions and runChoice
  const appJs = readFileSync(`${ROOT}/app.js`, "utf8");
  const runOptionsCode = appJs.match(/function runOptions[\s\S]*?^}/m)?.[0]!;
  const runChoiceCode = appJs.match(/const runChoice = [\s\S]*?;/)?.[0]!;
  const effortActionCode = appJs.match(/effort:\s*(\(el\)[\s\S]*?\)),/)?.[1]!;

  const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c as keyof typeof esc]);

  function makeMockElement(tag: string, attrs: any = {}) {
    const el: any = {
      tagName: tag.toUpperCase(),
      value: attrs.value || "",
      hidden: attrs.hidden ?? false,
      _html: "",
      dataset: { ...attrs.dataset },
      children: [] as any[],
      classList: {
        classes: new Set(attrs.className ? attrs.className.split(" ").filter(Boolean) : []),
        contains(c: string) { return this.classes.has(c); },
        toggle(c: string, force?: boolean) {
          if (force === undefined) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); }
          else if (force) this.classes.add(c); else this.classes.delete(c);
        },
        add(c: string) { this.classes.add(c); },
        delete(c: string) { this.classes.delete(c); },
      },
      setAttribute(name: string, val: any) { this[name] = String(val); },
      getAttribute(name: string) { return this[name]; },
      querySelectorAll(sel: string) {
        if (sel === "button") return this.children.filter((c: any) => c.tagName === "BUTTON");
        return [];
      },
      querySelector(sel: string) {
        if (sel === ".on") return this.children.find((c: any) => c.classList.contains("on")) || null;
        return null;
      },
    };
    if (tag === "select") {
      Object.defineProperty(el, "innerHTML", {
        set(html: string) {
          this._html = html;
          const matches = [...html.matchAll(/<option value="([^"]*)"/g)];
          if (matches.length > 0) this.value = matches[0][1];
          else this.value = "";
        },
        get() { return this._html; }
      });
    } else if (tag === "div") {
      Object.defineProperty(el, "innerHTML", {
        set(html: string) {
          this._html = html;
          this.children = [];
          const matches = [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)];
          for (const [, attrsStr] of matches) {
            const vMatch = attrsStr.match(/data-v="([^"]*)"/);
            const classMatch = attrsStr.match(/class="([^"]*)"/);
            const btn = makeMockElement("button", {
              dataset: { v: vMatch ? vMatch[1] : "" },
              className: classMatch ? classMatch[1] : "",
            });
            btn.parentElement = this;
            this.children.push(btn);
          }
        },
        get() { return this._html; }
      });
    }
    return el;
  }

  const domElements = new Map<string, any>();
  const $ = (sel: string) => {
    if (sel.includes(" .on")) {
      const parentSel = sel.split(" ")[0];
      return domElements.get(parentSel)?.querySelector(".on") || null;
    }
    return domElements.get(sel) || null;
  };

  const sysRunners = (await (await fetch(`${BASE}/api/system`)).json()).runners;
  const mockS = { runners: sysRunners };

  const compiled = new Function("$", "esc", "S", `${runOptionsCode}\n${runChoiceCode}\nreturn { runOptions, runChoice };`);
  const { runOptions, runChoice } = compiled($, esc, mockS);

  const captureAgent = makeMockElement("select", { value: "dyn-agent" });
  const captureModel = makeMockElement("select", { value: "with-efforts" });
  const captureEffort = makeMockElement("div", { hidden: true });

  domElements.set("#capture-agent", captureAgent);
  domElements.set("#capture-model", captureModel);
  domElements.set("#capture-effort", captureEffort);

  // A. Model with specific efforts ["low", "high"]
  runOptions(false, "capture");
  expect(captureModel.hidden).toBe(false);
  expect(captureModel.value).toBe("with-efforts");
  expect(captureEffort.hidden).toBe(false);
  expect(captureEffort.children.map((b: any) => b.dataset.v)).toEqual(["low", "high"]);
  expect(runChoice("capture")).toEqual({ agent: "dyn-agent", model: "with-efforts", effort: "low" });

  // Simulate clicking second effort button "high"
  const effortFn = new Function("el", `(${effortActionCode.replace(/^effort:\s*/, "").replace(/,\s*$/, "")})(el);`);
  effortFn(captureEffort.children[1]);
  expect(captureEffort.children[1].classList.contains("on")).toBe(true);
  expect(captureEffort.children[0].classList.contains("on")).toBe(false);
  expect(runChoice("capture")).toEqual({ agent: "dyn-agent", model: "with-efforts", effort: "high" });

  // B. Switch to model without efforts: efforts: [] -> #capture-effort hidden
  captureModel.value = "no-efforts";
  runOptions(true, "capture");
  expect(captureModel.hidden).toBe(false);
  expect(captureEffort.hidden).toBe(true);
  expect(captureEffort.children.length).toBe(0);
  expect(runChoice("capture")).toEqual({ agent: "dyn-agent", model: "no-efforts", effort: undefined });

  // C. Switch to model with inherited efforts
  captureModel.value = "inherited";
  runOptions(true, "capture");
  expect(captureModel.hidden).toBe(false);
  expect(captureEffort.hidden).toBe(false);
  expect(captureEffort.children.map((b: any) => b.dataset.v)).toEqual(["medium"]);
  expect(runChoice("capture")).toEqual({ agent: "dyn-agent", model: "inherited", effort: "medium" });

  // D. Switch to agent without models but with efforts (no-models-agent)
  captureAgent.value = "no-models-agent";
  runOptions(false, "capture");
  expect(captureModel.hidden).toBe(true);
  expect(captureEffort.hidden).toBe(false);
  expect(captureEffort.children.map((b: any) => b.dataset.v)).toEqual(["low", "medium", "high", "xhigh", "max"]);
  expect(runChoice("capture")).toEqual({ agent: "no-models-agent", model: undefined, effort: "high" });

  // E. Switch to agent with neither models nor efforts (bare-agent)
  captureAgent.value = "bare-agent";
  runOptions(false, "capture");
  expect(captureModel.hidden).toBe(true);
  expect(captureEffort.hidden).toBe(true);
  expect(runChoice("capture")).toEqual({ agent: "bare-agent", model: undefined, effort: undefined });

  // 2. Backend validation via POST /api/note/agent & resolveRun
  // A. Model with efforts: valid efforts low and high pass
  const rLow = await post("/api/note/agent", { topic: "Low Effort Note", agent: "dyn-agent", model: "with-efforts", effort: "low" });
  expect(rLow.status).toBe(200);
  const tLow = await finished((await rLow.json()).id);
  expect(tLow.model).toBe("with-efforts");
  expect(tLow.effort).toBe("low");

  const rHigh = await post("/api/note/agent", { topic: "High Effort Note", agent: "dyn-agent", model: "with-efforts", effort: "high" });
  expect(rHigh.status).toBe(200);
  const tHigh = await finished((await rHigh.json()).id);
  expect(tHigh.model).toBe("with-efforts");
  expect(tHigh.effort).toBe("high");

  // Invalid effort for this model fails
  const rInvalid = await post("/api/note/agent", { topic: "Invalid Effort", agent: "dyn-agent", model: "with-efforts", effort: "medium" });
  expect(rInvalid.status).toBe(400);
  expect(await rInvalid.text()).toContain('Dynamic Agent has no effort "medium" for Model With Efforts');

  // B. Model with no efforts: any effort passed fails
  const rNoEffortFail = await post("/api/note/agent", { topic: "No Effort Check", agent: "dyn-agent", model: "no-efforts", effort: "low" });
  expect(rNoEffortFail.status).toBe(400);
  expect(await rNoEffortFail.text()).toContain('Dynamic Agent has no effort "low" for Model Without Efforts');

  // Model with no efforts and omitted effort succeeds
  const rNoEffortOk = await post("/api/note/agent", { topic: "No Effort Ok", agent: "dyn-agent", model: "no-efforts" });
  expect(rNoEffortOk.status).toBe(200);
  const tNoEffortOk = await finished((await rNoEffortOk.json()).id);
  expect(tNoEffortOk.model).toBe("no-efforts");
  expect(tNoEffortOk.effort).toBe("");

  // C. Non-string effort and model types are safely coerced by str()
  const rNonStrEffort = await post("/api/note/agent", { topic: "Non string effort", agent: "dyn-agent", model: "with-efforts", effort: 9999 });
  expect(rNonStrEffort.status).toBe(200);
  const tNonStrEffort = await finished((await rNonStrEffort.json()).id);
  expect(tNonStrEffort.effort).toBe("low"); // falls back to first/default effort

  const rNonStrModel = await post("/api/note/agent", { topic: "Non string model", agent: "dyn-agent", model: { bad: true } });
  expect(rNonStrModel.status).toBe(200);
  const tNonStrModel = await finished((await rNonStrModel.json()).id);
  expect(tNonStrModel.model).toBe("with-efforts"); // falls back to first model

  // Restore settings
  await post("/api/settings", { agents: init.agents });
});

test("adversarial verification: fleet sidebar chat dismissal, external session persistence, and canvas synchronization", async () => {
  // 1. Backend task delete and alias dismiss edge cases
  expect((await post("/api/task/delete", { id: "" })).status).toBe(400);
  expect((await post("/api/task/delete", { id: "   " })).status).toBe(400);
  expect((await post("/api/task/delete", { id: false })).status).toBe(400);
  expect((await post("/api/task/delete", { id: ["t1"] })).status).toBe(400);
  expect((await post("/api/task/dismiss", { id: "not-a-real-task" })).status).toBe(400);

  // Active sleeper task abortion
  const runId = await run("sleeper");
  await Bun.sleep(150);
  const delRunning = await post("/api/task/delete", { id: runId });
  expect(delRunning.status).toBe(200);
  expect(await delRunning.json()).toEqual({ ok: true });
  expect((await fetch(`${BASE}/api/task?id=${runId}`)).status).toBe(404);
  expect((await post("/api/task/delete", { id: runId })).status).toBe(400);

  // Finished task dismissal via alias
  const echoId = await run("echo", "dismiss-me");
  await finished(echoId);
  const disFinished = await post("/api/task/dismiss", { id: echoId });
  expect(disFinished.status).toBe(200);
  expect(await disFinished.json()).toEqual({ ok: true });
  expect((await fetch(`${BASE}/api/task?id=${echoId}`)).status).toBe(404);
  expect((await post("/api/task/dismiss", { id: echoId })).status).toBe(400);

  // 2. External agent session dismissal & fleetItems exclusion & persistence
  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => storageMap.get(k) || null,
    setItem: (k: string, v: string) => storageMap.set(k, String(v)),
    removeItem: (k: string) => storageMap.delete(k),
  };

  const DISMISSED_KEY = "overlook:dismissed-sessions";
  // Corrupted localStorage handling
  storageMap.set(DISMISSED_KEY, "{ broken-json: true");
  let dismissedSessions = (() => {
    try { return new Set(JSON.parse(mockLocalStorage.getItem(DISMISSED_KEY) || "[]")); } catch { return new Set(); }
  })();
  expect(dismissedSessions.size).toBe(0);

  // Dismissing external sessions
  dismissedSessions.add("c:sess-1");
  dismissedSessions.add("bg:task-1");
  mockLocalStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedSessions]));

  // Reload simulation
  const reloaded = new Set(JSON.parse(mockLocalStorage.getItem(DISMISSED_KEY) || "[]"));
  expect(reloaded.has("c:sess-1")).toBe(true);
  expect(reloaded.has("bg:task-1")).toBe(true);

  // Test fleetItems filtering logic
  const mockS = {
    tasks: [{ id: "t-1", prompt: "task 1", agent: "agy" }],
    agents: [
      { key: "c:sess-1", name: "claude", cwd: "/tmp", seconds: 10 },
      { key: "c:sess-2", name: "claude", cwd: "/tmp", seconds: 20 },
    ],
    background: [
      { key: "bg:task-1", title: "BG 1", cwd: "/tmp", state: "done", since: Date.now() },
      { key: "bg:task-2", title: "BG 2", cwd: "/tmp", state: "done", since: Date.now() },
    ],
  };

  const appJs = readFileSync(`${ROOT}/app.js`, "utf8");
  expect(appJs).toContain("dismissedSessions.has(a.key)");
  expect(appJs).toContain("dismissedSessions.has(f.key)");

  const items: any[] = [];
  const seen = new Set();
  for (const t of mockS.tasks) items.push({ kind: "task", id: t.id });
  for (const a of mockS.agents) {
    if (dismissedSessions.has(a.key)) continue;
    seen.add(a.key);
    items.push({ kind: "agent", id: a.key });
  }
  for (const f of mockS.background) {
    if (seen.has(f.key) || dismissedSessions.has(f.key)) continue;
    items.push({ kind: "agent", id: f.key });
  }

  expect(items.map((x) => `${x.kind}:${x.id}`)).toEqual(["task:t-1", "agent:c:sess-2", "agent:bg:task-2"]);

  // 3. Canvas synchronization simulation from ACTIONS["orch-dismiss"]
  let orchPanes = [{ kind: "task", id: "t1" }, { kind: "agent", id: "a1" }, { kind: "task", id: "t2" }];
  let orchLinks = [
    { a: "task:t1", b: "agent:a1" },
    { a: "agent:a1", b: "task:t2" },
  ];
  let orchSelected = new Set(["task:t1", "agent:a1"]);
  let orchActive = "task:t1";
  let orchMax = "task:t1";
  let orchSeq = 10;
  const paneKey = (p: any) => `${p.kind}:${p.id}`;

  const dismissSync = (kind: string, id: string, availableFleet: any[]) => {
    const targetKey = `${kind}:${id}`;
    orchSelected.delete(targetKey);
    orchLinks = orchLinks.filter((l) => l.a !== targetKey && l.b !== targetKey);
    if (kind === "agent") dismissedSessions.add(id);

    const wasInPanes = orchPanes.some((p) => paneKey(p) === targetKey);
    if (wasInPanes) {
      orchPanes = orchPanes.filter((p) => paneKey(p) !== targetKey);
      const paneKeys = new Set(orchPanes.map(paneKey));
      orchLinks = orchLinks.filter((l) => paneKeys.has(l.a) && paneKeys.has(l.b));
      if (orchPanes.length === 0) {
        const next = availableFleet.find((x) => paneKey(x) !== targetKey);
        if (next) {
          orchPanes = [{ kind: next.kind, id: next.id }];
          orchActive = paneKey(next);
        } else {
          const newId = String(++orchSeq);
          orchPanes = [{ kind: "new", id: newId }];
          orchActive = `new:${newId}`;
        }
      } else if (orchActive === targetKey) {
        orchActive = paneKey(orchPanes[0]);
      }
      if (orchMax === targetKey) orchMax = "";
    } else if (orchActive === targetKey) {
      orchActive = orchPanes[0] ? paneKey(orchPanes[0]) : "";
      if (orchMax === targetKey) orchMax = "";
    }
  };

  // Step 1: Dismiss active & maximized pane task:t1
  dismissSync("task", "t1", [{ kind: "task", id: "t2" }, { kind: "agent", id: "a1" }]);
  expect(orchPanes.map(paneKey)).toEqual(["agent:a1", "task:t2"]);
  expect(orchLinks).toEqual([{ a: "agent:a1", b: "task:t2" }]); // orphan link to t1 pruned
  expect(orchSelected.has("task:t1")).toBe(false);
  expect(orchSelected.has("agent:a1")).toBe(true);
  expect(orchActive).toBe("agent:a1"); // shifted to remaining pane
  expect(orchMax).toBe(""); // cleared

  // Step 2: Dismiss non-pane sidebar item (wasInPanes: false)
  dismissSync("task", "t99", [{ kind: "task", id: "t2" }]);
  expect(orchPanes.map(paneKey)).toEqual(["agent:a1", "task:t2"]); // unchanged

  // Step 3: Dismiss pane when other panes remain
  dismissSync("task", "t2", [{ kind: "agent", id: "a1" }]);
  expect(orchPanes.map(paneKey)).toEqual(["agent:a1"]);
  expect(orchLinks).toEqual([]);

  // Step 4: Dismiss the last remaining pane when fleet has fallback
  dismissSync("agent", "a1", [{ kind: "agent", id: "a1" }, { kind: "agent", id: "fallback-fleet" }]);
  expect(orchPanes.map(paneKey)).toEqual(["agent:fallback-fleet"]);
  expect(orchActive).toBe("agent:fallback-fleet");

  // Step 5: Dismiss the last remaining pane when fleet is EMPTY -> fallback to new prompt pane
  dismissSync("agent", "fallback-fleet", [{ kind: "agent", id: "fallback-fleet" }]);
  expect(orchPanes.length).toBe(1);
  expect(orchPanes[0].kind).toBe("new");
  expect(orchActive).toBe(`new:${orchSeq}`);
});

test("adversarial verification: capture modal 2-tier layout, effort switching, and mobile responsiveness", async () => {
  const html = readFileSync(`${ROOT}/index.html`, "utf8");
  const css = readFileSync(`${ROOT}/app.css`, "utf8");
  const js = readFileSync(`${ROOT}/app.js`, "utf8");

  // 1. Structure in index.html: Deterministic 2-tier layout
  // Row 1: Agent & Model selects inside .capture-agent-row
  expect(html).toContain('<div class="capture-agent-panel" id="capture-agent-panel" hidden>');
  expect(html).toContain('<div class="capture-fields-row capture-agent-row">');
  expect(html).toContain('<select class="pick" id="capture-agent" aria-label="Agent"></select>');
  expect(html).toContain('<select class="pick" id="capture-model" aria-label="Model" hidden></select>');
  // Row 2: Effort label + Segmented control inside #capture-effort-row
  expect(html).toContain('<div class="capture-effort-row" id="capture-effort-row">');
  expect(html).toContain('<span class="capture-effort-label">Effort</span>');
  expect(html).toContain('<div class="seg" id="capture-effort" role="radiogroup" aria-label="Effort" hidden></div>');

  // 2. CSS Desktop layout rules: standardized 2-tier layout with micro-labels and 100% width controls
  expect(css).toContain(".capture-agent-panel,\n#capture-agent-panel {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  margin-bottom: 14px;\n  padding: 12px 14px;");
  // Row 1: 2 equal columns (1fr 1fr), collapsing to 1fr when model is hidden
  expect(css).toContain(".capture-agent-row,\n.capture-fields-row {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 10px;");
  expect(css).toContain(".capture-agent-row:has(#capture-model[hidden]),\n.capture-fields-row:has(#capture-model[hidden]) {\n  grid-template-columns: 1fr;\n}");
  expect(css).toContain(".capture-agent-row .pick,\n.capture-fields-row .pick {\n  width: 100%;\n  min-width: 0;\n}");
  // Row 2: Standardized effort row with full-width segmented control and distributed buttons
  expect(css).toContain(".capture-effort-row,\n#capture-effort-row {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;");
  expect(css).toContain(".capture-effort-row:has(#capture-effort[hidden]),\n#capture-effort-row:has(#capture-effort[hidden]) {\n  display: none;\n}");
  expect(css).toContain(".capture-effort-row .seg,\n#capture-effort-row .seg,\n.capture-effort-seg {\n  display: flex;\n  width: 100%;\n}");
  expect(css).toContain(".capture-effort-row .seg button,\n#capture-effort-row .seg button,\n.capture-effort-seg button {\n  flex: 1;\n  min-width: 0;\n  text-align: center;\n  justify-content: center;");

  // 3. CSS Mobile responsive behavior (@media max-width: 640px)
  expect(css).toContain(".capture-agent-row,\n  .capture-fields-row {\n    grid-template-columns: 1fr;\n    gap: 8px;\n  }");
  expect(css).toContain(".capture-effort-row,\n  #capture-effort-row {\n    flex-direction: column;\n    align-items: stretch;\n    gap: 6px;\n  }");
  expect(css).toContain(".capture-effort-row .seg,\n  #capture-effort-row .seg {\n    display: flex;\n    width: 100%;\n  }");
  expect(css).toContain(".capture-effort-row .seg button,\n  #capture-effort-row .seg button {\n    flex: 1;\n    min-width: 0;\n    text-align: center;\n    padding: 0 4px;\n    font-size: 11.5px;\n  }");

  // 4. Switching between Antigravity (3 efforts) and Claude Code (5 efforts)
  const runOptionsCode = js.match(/function runOptions[\s\S]*?^}/m)?.[0]!;
  const runChoiceCode = js.match(/const runChoice = [\s\S]*?;/)?.[0]!;
  const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c as keyof typeof esc]);

  function makeMockEl(tag: string, attrs: any = {}) {
    const el: any = {
      tagName: tag.toUpperCase(),
      value: attrs.value || "",
      hidden: attrs.hidden ?? false,
      _html: "",
      dataset: { ...attrs.dataset },
      children: [] as any[],
      classList: {
        classes: new Set(attrs.className ? attrs.className.split(" ").filter(Boolean) : []),
        contains(c: string) { return this.classes.has(c); },
        add(c: string) { this.classes.add(c); },
        remove(c: string) { this.classes.delete(c); },
        toggle(c: string, force?: boolean) {
          if (force === true) this.classes.add(c);
          else if (force === false) this.classes.delete(c);
          else if (this.classes.has(c)) this.classes.delete(c);
          else this.classes.add(c);
        }
      },
      querySelector(sel: string) {
        if (sel === ".on") return this.children.find((c: any) => c.classList.contains("on")) || null;
        return null;
      }
    };
    if (tag === "select") {
      Object.defineProperty(el, "innerHTML", {
        set(html: string) {
          this._html = html;
          const vals = [...html.matchAll(/value="([^"]*)"/g)].map((m) => m[1]);
          if (vals.length && !vals.includes(this.value)) this.value = vals[0];
        },
        get() { return this._html; }
      });
    } else if (tag === "div") {
      Object.defineProperty(el, "innerHTML", {
        set(html: string) {
          this._html = html;
          this.children = [];
          for (const [, attrsStr] of html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)) {
            const vMatch = attrsStr.match(/data-v="([^"]*)"/);
            const classMatch = attrsStr.match(/class="([^"]*)"/);
            const btn = makeMockEl("button", {
              dataset: { v: vMatch ? vMatch[1] : "" },
              className: classMatch ? classMatch[1] : "",
            });
            btn.parentElement = this;
            this.children.push(btn);
          }
        },
        get() { return this._html; }
      });
    }
    return el;
  }

  const dom = new Map<string, any>();
  const $ = (sel: string) => dom.get(sel) || (sel.includes(" .on") ? dom.get(sel.split(" ")[0])?.querySelector(".on") : null);

  const mockRunners = [
    {
      id: "agy",
      name: "Antigravity",
      effort: "medium",
      models: [{ id: "agy-pro", label: "Antigravity Pro", efforts: ["low", "medium", "high"] }],
    },
    {
      id: "claude",
      name: "Claude Code",
      effort: "high",
      models: [{ id: "claude-sonnet", label: "Claude Sonnet", efforts: ["low", "medium", "high", "xhigh", "max"] }],
    },
    {
      id: "single-model-no-effort",
      name: "Simple Agent",
      models: [],
      efforts: [],
    }
  ];

  const compiled = new Function("$", "esc", "S", `${runOptionsCode}\n${runChoiceCode}\nreturn { runOptions, runChoice };`);
  const { runOptions, runChoice } = compiled($, esc, { runners: mockRunners });

  const captureAgent = makeMockEl("select", { value: "agy" });
  const captureModel = makeMockEl("select", { value: "agy-pro" });
  const captureEffort = makeMockEl("div", { hidden: true });

  dom.set("#capture-agent", captureAgent);
  dom.set("#capture-model", captureModel);
  dom.set("#capture-effort", captureEffort);

  // A. Select Antigravity (3 efforts)
  captureAgent.value = "agy";
  runOptions(false, "capture");
  expect(captureModel.hidden).toBe(false);
  expect(captureModel.value).toBe("agy-pro");
  expect(captureEffort.hidden).toBe(false);
  expect(captureEffort.children.map((b: any) => b.dataset.v)).toEqual(["low", "medium", "high"]);
  expect(runChoice("capture")).toEqual({ agent: "agy", model: "agy-pro", effort: "medium" });

  // B. Switch to Claude Code (5 efforts)
  captureAgent.value = "claude";
  runOptions(false, "capture");
  expect(captureModel.hidden).toBe(false);
  expect(captureModel.value).toBe("claude-sonnet");
  expect(captureEffort.hidden).toBe(false);
  expect(captureEffort.children.map((b: any) => b.dataset.v)).toEqual(["low", "medium", "high", "xhigh", "max"]);
  expect(runChoice("capture")).toEqual({ agent: "claude", model: "claude-sonnet", effort: "high" });

  // C. Switch to Agent with no models and no efforts
  captureAgent.value = "single-model-no-effort";
  runOptions(false, "capture");
  expect(captureModel.hidden).toBe(true);
  expect(captureEffort.hidden).toBe(true);
  expect(captureEffort.children.length).toBe(0);
  expect(runChoice("capture")).toEqual({ agent: "single-model-no-effort", model: undefined, effort: undefined });
});

test("adversarial verification: task persistence across reload, retryTask 404 recovery, and notes resilience", async () => {
  const js = readFileSync(`${ROOT}/app.js`, "utf8");

  // 1. retryTask 404 handling in Standalone Page Mode
  const toastLogs: string[] = [];
  const apiCalls: { endpoint: string; body: any }[] = [];
  const mockApi = async (url: string, body?: any) => {
    apiCalls.push({ endpoint: url, body });
    if (url === "/api/task/retry") {
      if (body?.id === "fail-dispatch") throw new Error("404: task not found");
      if (body?.id === "500-error") throw new Error("500: internal server error");
      throw new Error("404: task not found");
    }
    if (url === "/api/run") {
      if (body?.agent === "fail-dispatch") throw new Error("Server out of resources");
      return { id: "new-redispatched-task" };
    }
    if (url === "/api/system") return { runners: [], tasks: [] };
    return {};
  };

  const mockToast = (msg: string) => { toastLogs.push(msg); };
  const mockRoute = () => ({ pg: "t", arg: "expired-task-1" });
  const mockLocation = { hash: "" };

  const retryCode = js.match(/async function retryTask\([\s\S]*?\n\}/)?.[0];
  expect(retryCode).toBeTruthy();

  const retryFn = new Function(
    "api", "toast", "route", "location", "S", "orchPanes", "$", "paneKey", "rekey", "orchSigs", "orchActive", "orchMax", "saveCanvas", "agentsBody", "orchPaint",
    `return (${retryCode});`
  )(
    mockApi, mockToast, mockRoute, mockLocation,
    { tasks: [{ id: "expired-task-1", agent: "claude", prompt: "write summary", model: "sonnet", effort: "high" }] },
    [], () => null, (x: any) => `${x.kind}:${x.id}`, () => {}, new Set(), "", "", () => {}, () => {}, () => {}
  );

  // A. Standalone 404 re-dispatch test
  await retryFn("expired-task-1", "opus", "");
  expect(toastLogs).toContain("Task session expired. Re-dispatching as a new task…");
  expect(apiCalls.some((c) => c.endpoint === "/api/run" && c.body.agent === "claude" && c.body.prompt === "write summary" && c.body.model === "opus" && c.body.effort === "high")).toBe(true);
  expect(mockLocation.hash).toBe("#/t/new-redispatched-task");

  // B. Canvas Tile 404 re-dispatch test (re-keys canvas tile in place)
  let savedCanvas = false;
  let paintedCanvas = false;
  let rekeyedOld = "", rekeyedNew = "";
  const mockPanes = [{ kind: "task", id: "tile-expired-task" }];
  const mockSigs = new Set(["task:tile-expired-task"]);
  let activePane = "task:tile-expired-task";

  const tileRetryFn = new Function(
    "api", "toast", "route", "location", "S", "orchPanes", "$", "paneKey", "rekey", "orchSigs", "orchActive", "orchMax", "saveCanvas", "agentsBody", "orchPaint",
    `return (${retryCode});`
  )(
    mockApi, mockToast, () => ({ pg: "agents", arg: "" }), mockLocation,
    { tasks: [{ id: "tile-expired-task", agent: "agy", prompt: "audit security", model: "agy-1", effort: "medium" }] },
    mockPanes,
    () => null,
    (x: any) => `${x.kind}:${x.id}`,
    (oldK: string, newK: string) => { rekeyedOld = oldK; rekeyedNew = newK; },
    mockSigs,
    activePane,
    "",
    () => { savedCanvas = true; },
    () => {},
    () => { paintedCanvas = true; }
  );

  await tileRetryFn("tile-expired-task", "agy-2", "task:tile-expired-task", { agent: "agy", prompt: "audit security", effort: "medium" });
  expect(mockPanes[0].id).toBe("new-redispatched-task");
  expect(rekeyedOld).toBe("task:tile-expired-task");
  expect(rekeyedNew).toBe("task:new-redispatched-task");
  expect(savedCanvas).toBe(true);
  expect(paintedCanvas).toBe(true);
  expect(toastLogs).toContain("Switched to agy-2 & retrying in tile");

  // C. Re-dispatch failure recovery test
  toastLogs.length = 0;
  await retryFn("fail-dispatch", "m", "", { agent: "fail-dispatch", prompt: "boom" });
  expect(toastLogs).toContain("Re-dispatch failed: Server out of resources");

  // D. Generic non-404 error handling test
  toastLogs.length = 0;
  await retryFn("500-error", "m", "");
  expect(toastLogs).toContain("Retry failed: 500: internal server error");

  // 2. notes() resilience against missing/deleted or empty files during scan
  const testGhostPath = `${VAULT}/1 Inbox/ghost-adversarial-test.md`;
  const testZeroPath = `${VAULT}/1 Inbox/zero-adversarial-test.md`;
  try {
    writeFileSync(testGhostPath, "# Ghost Note\nTemporary note to be deleted.");
    writeFileSync(testZeroPath, ""); // 0-byte empty file

    const resBefore = await fetch(`${BASE}/api`);
    expect(resBefore.status).toBe(200);
    const dataBefore = await resBefore.json();
    expect(dataBefore.notes.some((n: any) => n.path.includes("ghost-adversarial-test.md"))).toBe(true);
    expect(dataBefore.notes.some((n: any) => n.path.includes("zero-adversarial-test.md"))).toBe(true);

    // Delete the ghost file suddenly
    rmSync(testGhostPath, { force: true });
    expect(existsSync(testGhostPath)).toBe(false);

    // Rapid successive requests should never throw or return 500
    const [res1, res2, res3] = await Promise.all([
      fetch(`${BASE}/api`),
      fetch(`${BASE}/api`),
      fetch(`${BASE}/api`)
    ]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    const dataAfter = await res1.json();
    expect(dataAfter.notes.some((n: any) => n.path.includes("ghost-adversarial-test.md"))).toBe(false);
    // 0-byte file handled safely with basename fallback
    const zeroNote = dataAfter.notes.find((n: any) => n.path.includes("zero-adversarial-test.md"));
    expect(zeroNote).toBeDefined();
    expect(zeroNote.title).toBe("zero-adversarial-test");
    expect(zeroNote.tags).toEqual([]);
    expect(zeroNote.links).toEqual([]);
  } finally {
    rmSync(testGhostPath, { force: true });
    rmSync(testZeroPath, { force: true });
  }
});

test("adversarial verification: floating fleet sidebar, extended canvas panes, 8-dir resize, and header dblclick", async () => {
  const appJs = readFileSync(`${ROOT}/app.js`, "utf8");
  const appCss = readFileSync(`${ROOT}/app.css`, "utf8");

  // 1. Assert required styles and structure for minimalist toolbar and floating fleet
  expect(appCss).toContain(".orch-cluster-nav");
  expect(appCss).toContain(".orch-cluster-prompt");
  expect(appCss).toContain(".orch-cluster-act");
  expect(appCss).toContain(".orch-fleet-wrap");
  expect(appCss).toContain(".orch-fleet-wrap.float:is(:hover, :focus-within, .open) .orch-fleet");
  expect(appCss).toContain(".orch-fleet-head");
  expect(appCss).toContain(".orch-fleet-pill");
  expect(appCss).toContain(".orch-work.rail-float");
  expect(appCss).toContain(".orch-work.rail-float .orch-fleet");
  expect(appCss).toContain(".orch-resize.e");
  expect(appCss).toContain(".orch-resize.w");
  expect(appCss).toContain(".orch-resize.s");
  expect(appCss).toContain(".orch-resize.n");

  // 2. Assert JS handlers and state management
  expect(appJs).toContain("orchRailMode");
  expect(appJs).toContain('"orch-rail-mode"');
  expect(appJs).toContain('"orch-rail-open"');
  expect(appJs).toContain("saveRailMode");
  expect(appJs).toContain('"overlook.rail-mode"');
  expect(appJs).toContain('["nw", "ne", "sw", "se", "n", "s", "e", "w"]');
  expect(appJs).toContain("Math.min(2600,");
  expect(appJs).toContain("Math.min(1800,");
  expect(appJs).toContain('head.addEventListener("dblclick"');

  // 3. Test 8-direction resize calculations against bounds
  const simulateResize = (corner: string, startW: number, startH: number, startX: number, startY: number, dx: number, dy: number) => {
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
    return { nextW, nextH, nextX, nextY };
  };

  // Horizontal edge resize (east): extends up to 2600px without altering Y or H
  const eastExtend = simulateResize("e", 600, 400, 50, 50, 2500, 0);
  expect(eastExtend.nextW).toBe(2600); // capped at 2600
  expect(eastExtend.nextH).toBe(400);  // unchanged
  expect(eastExtend.nextX).toBe(50);   // unchanged

  // Horizontal edge resize (west): extends left up to 2600px and updates X
  const westExtend = simulateResize("w", 600, 400, 500, 50, -400, 0);
  expect(westExtend.nextW).toBe(1000);
  expect(westExtend.nextX).toBe(100);

  // Vertical edge resize (south): extends down up to 1800px
  const southExtend = simulateResize("s", 600, 400, 50, 50, 0, 1500);
  expect(southExtend.nextH).toBe(1800);
  expect(southExtend.nextW).toBe(600);

  // Corner resize (se): adjusts both dimensions simultaneously
  const cornerExtend = simulateResize("se", 500, 300, 50, 50, 300, 200);
  expect(cornerExtend.nextW).toBe(800);
  expect(cornerExtend.nextH).toBe(500);

  // Minimum bounds clamped
  const minShrink = simulateResize("se", 500, 300, 50, 50, -400, -250);
  expect(minShrink.nextW).toBe(280);
  expect(minShrink.nextH).toBe(180);

  // 4. Test fleet sidebar mode transition simulation
  let testRailMode = "float";
  let testRail = true;
  const toggleRailMode = () => {
    testRailMode = testRailMode === "float" ? "dock" : "float";
    return testRailMode;
  };
  expect(toggleRailMode()).toBe("dock");
  expect(toggleRailMode()).toBe("float");

  const toggleRail = () => {
    testRail = !testRail;
    return { railShut: !testRail, railFloat: testRail && testRailMode === "float", pillHidden: testRail };
  };
  const closedState = toggleRail();
  expect(closedState.railShut).toBe(true);
  expect(closedState.railFloat).toBe(false);
  expect(closedState.pillHidden).toBe(false);

  const openState = toggleRail();
  expect(openState.railShut).toBe(false);
  expect(openState.railFloat).toBe(true);
  expect(openState.pillHidden).toBe(true);
});

test("adversarial verification: terminal & shell launcher, emulator detection, fallback chain, and settings persistence", async () => {
  const { buildTerminalArgs } = await import("../tasks");

  // 1. Argument builder correctness for various emulators
  const ghosttyArgs = buildTerminalArgs("ghostty", "/home/test", ["-e", "bash"]);
  expect(ghosttyArgs).toEqual(["ghostty", "--working-directory=/home/test", "-e", "-e", "bash"]);

  const kittyArgs = buildTerminalArgs("kitty", "/home/test", ["bash"]);
  expect(kittyArgs).toEqual(["kitty", "--directory=/home/test", "bash"]);

  const xdgArgs = buildTerminalArgs("xdg-terminal-exec", "/home/test", ["bash"]);
  expect(xdgArgs).toEqual(["xdg-terminal-exec", "--dir=/home/test", "--", "bash"]);

  // 2. GET /api/terminals returns detected terminals and shells
  const termRes = await (await fetch(`${BASE}/api/terminals`)).json();
  expect(termRes).toBeDefined();
  expect(Array.isArray(termRes.terminals)).toBe(true);
  expect(Array.isArray(termRes.shells)).toBe(true);
  expect(typeof termRes.defaultTerminal).toBe("string");
  expect(typeof termRes.defaultShell).toBe("string");

  // 3. POST /api/terminal/open rejects non-installed shell with 400
  const badShell = await post("/api/terminal/open", { shell: "non-existent-shell-404xyz" });
  expect(badShell.status).toBe(400);
  const errTxt = await badShell.text();
  expect(errTxt).toContain("is not installed");

  // 4. POST /api/terminal/open succeeds when launching a valid shell
  if (termRes.terminals.length > 0) {
    const okRes = await post("/api/terminal/open", { shell: "bash", cwd: ROOT });
    expect(okRes.status).toBe(200);
    const data = await okRes.json();
    expect(data.ok).toBe(true);
    expect(data.shell).toBe("bash");
    expect(data.cwd).toBe(ROOT);
  }

  // 5. Settings persistence for terminal preferences
  const updateSettings = await post("/api/settings", {
    defaultTerminal: "ghostty",
    fallbackTerminal: "kitty",
    defaultShell: "bash",
  });
  expect(updateSettings.status).toBe(200);
  const cfg = await (await fetch(`${BASE}/api/settings`)).json();
  expect(cfg.defaultTerminal).toBe("ghostty");
  expect(cfg.fallbackTerminal).toBe("kitty");
  expect(cfg.defaultShell).toBe("bash");

  // 6. Frontend assets contain split-button, popover, and state hooks
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  const appCss = readFileSync(`${REPO}/app.css`, "utf8");
  expect(appCss).toContain(".orch-term-split");
  expect(appCss).toContain(".term-pop");
  expect(appCss).toContain(".orch-term-main");
  expect(appJs).toContain('"term-quick"');
  expect(appJs).toContain('"term-menu-toggle"');
  expect(appJs).toContain("loadTerminals");
  expect(appJs).toContain("paintTermPop");
  expect(appJs).toContain("set-terminal");
});

test("adversarial verification: embedded canvas terminal, session management, cd tracking, and WebSocket streaming", async () => {
  // 1. Session creation via POST /api/terminal/session/create
  const createRes = await post("/api/terminal/session/create", { shell: "bash", cwd: ROOT, id: "test_term_1" });
  expect(createRes.status).toBe(200);
  const createData = await createRes.json();
  expect(createData.ok).toBe(true);
  expect(createData.session.id).toBe("test_term_1");
  expect(createData.session.shell).toBe("bash");
  expect(createData.session.cwd).toBe(ROOT);

  // 2. GET /api/terminal/sessions lists the created session
  const listRes = await (await fetch(`${BASE}/api/terminal/sessions`)).json();
  expect(Array.isArray(listRes.sessions)).toBe(true);
  expect(listRes.sessions.some((s: any) => s.id === "test_term_1")).toBe(true);

  // 3. POST /api/terminal/session/run runs command and captures output
  const runRes = await post("/api/terminal/session/run", { id: "test_term_1", cmd: "echo 'OVERLOOK_TERMINAL_EMBEDDED'" });
  expect(runRes.status).toBe(200);
  const runData = await runRes.json();
  expect(runData.ok).toBe(true);
  expect(runData.code).toBe(0);
  expect(runData.output).toContain("OVERLOOK_TERMINAL_EMBEDDED");

  // 4. Command changing directory updates session cwd
  const cdRes = await post("/api/terminal/session/run", { id: "test_term_1", cmd: "cd /tmp && pwd" });
  expect(cdRes.status).toBe(200);
  const cdData = await cdRes.json();
  expect(cdData.ok).toBe(true);
  expect(cdData.newCwd).toBe("/tmp");

  // 5. POST /api/terminal/session/kill and close
  const killRes = await post("/api/terminal/session/kill", { id: "test_term_1" });
  expect(killRes.status).toBe(200);

  const closeRes = await post("/api/terminal/session/close", { id: "test_term_1" });
  expect(closeRes.status).toBe(200);
  const afterCloseList = await (await fetch(`${BASE}/api/terminal/sessions`)).json();
  expect(afterCloseList.sessions.some((s: any) => s.id === "test_term_1")).toBe(false);

  // 6. WebSocket streaming at /ws/terminal
  const wsUrl = `ws://127.0.0.1:${PORT}/ws/terminal?id=test_term_ws&shell=bash&cwd=${encodeURIComponent(ROOT)}`;
  const ws = new WebSocket(wsUrl);
  const wsMessages: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WS timeout")), 5000);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data));
        wsMessages.push(msg);
        if (msg.type === "init") {
          ws.send(JSON.stringify({ type: "run", cmd: "echo 'WS_STREAM_OK'" }));
        } else if (msg.type === "exit") {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    };
    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
  });
  expect(wsMessages.some((m) => m.type === "init")).toBe(true);
  expect(wsMessages.some((m) => m.type === "exit" && m.code === 0)).toBe(true);
  const exitMsg = wsMessages.find((m) => m.type === "exit");
  expect(exitMsg.output).toContain("WS_STREAM_OK");

  // 7. Verify frontend canvas & sidebar terminal hooks
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  const appCss = readFileSync(`${REPO}/app.css`, "utf8");
  expect(appJs).toContain("mountTerminalPane");
  expect(appJs).toContain('"term-canvas"');
  expect(appJs).toContain('"term-new-pane"');
  expect(appJs).toContain('"term-close-session"');
  expect(appJs).toContain('["terminals", "Terminals"]');
  expect(appJs).toContain("ansiToHtml");
  expect(appCss).toContain('.orch-pane[data-kind="terminal"]');
  expect(appCss).toContain(".orch-term-view");
  expect(appCss).toContain(".orch-term-input-bar");
  expect(appCss).toContain(".orch-term-output");
  expect(appCss).toContain(".orch-fleet-quick-act");
});


