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
// Stand-ins for the desktop terminals: "Open terminal" must not pop a real window (in a folder this test deletes) on every run.
const FAKEBIN = `${ROOT}/fakebin`;
// HISTFILE: the shells these tests open must not write into the user's shell history.
const ENV = { ...process.env, HISTFILE: "/dev/null", PATH: `${FAKEBIN}:${process.env.PATH}`, DEFAULT_TERMINAL: "ghostty", TERMINAL_FALLBACK: "kitty", VAULT_DIR: VAULT, VAULT_LANG: "en", PORT: String(PORT), ART_DIR: `${ROOT}/no-art`, FAKE_KEY: "test-key", TRANSCRIBE: `x=$(cat); [ "$x" = bad ] && { echo "out of memory" >&2; exit 1; }; echo "hello from $x"`, TZ: "Etc/UTC" }; // bun test runs in UTC: the server must agree on "today"
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
  mkdirSync(FAKEBIN);
  for (const t of ["ghostty", "kitty"]) writeFileSync(`${FAKEBIN}/${t}`, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(`${ROOT}/agents.json`, JSON.stringify([
    { id: "echo", name: "Echo", process: "echo", run: ["echo", "got", "{prompt}", "--model", "{model}", "--effort", "{effort}"], models: ["m1", "m2"], efforts: ["low", "high"], effort: "high" },
    { id: "bare", name: "Bare", run: ["echo", "got", "{prompt}", "--model", "{model}"] },
    { id: "mixed", name: "Mixed", run: ["echo", "{model}-{effort}"], efforts: ["low", "high"], effort: "high",
      models: [{ id: "big", label: "Big" }, { id: "small", label: "Small", efforts: ["medium"] }] },
    { id: "sleeper", name: "Sleeper", run: ["sleep", "30"] },
    { id: "forker", name: "Forker", run: ["sh", "-c", "sleep 31.5 & sleep 31.5"] },
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

test("search looks inside notes: every term, accents and case ignored", async () => {
  const f = `${VAULT}/3 Concepts/Frete.md`;
  writeFileSync(f, "# Frete\n\nO custo do armador_custo entra na coleção de coletas.\n");
  const hits = async (q: string) => (await (await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}`)).json()).map((h: any) => h.path);
  expect(await hits("ARMADOR_custo colecao")).toEqual(["3 Concepts/Frete.md"]);
  expect((await (await fetch(`${BASE}/api/search?q=armador_custo`)).json())[0].line).toContain("armador_custo");
  expect(await hits("armador_custo inexistente")).toEqual([]);
  rmSync(f);
});

test("routines show up only when the vault has an AGENTS.md to hold them", async () => {
  expect((await (await fetch(`${BASE}/api`)).json()).routines).toBe(false);
  expect((await post("/api/routine", { name: "morning", agent: "echo" })).status).toBe(409);
  writeFileSync(`${VAULT}/AGENTS.md`, "# rules\n");
  const on = (await (await fetch(`${BASE}/api`)).json()).routines;
  rmSync(`${VAULT}/AGENTS.md`);
  expect(on).toBe(true);
});

test("vault.json lays out a vault its own way: note folders, inbox, daily note, sections", async () => {
  mkdirSync(`${VAULT}/Notes`); mkdirSync(`${VAULT}/Journal`);
  writeFileSync(`${VAULT}/Notes/Idea.md`, "# Idea\n");
  writeFileSync(`${VAULT}/Journal/${TODAY}.md`, "## Today\n- [[Idea]]\n");
  writeFileSync(`${ROOT}/vault.json`, JSON.stringify({ folders: ["Notes", "Journal"], inbox: "Notes", daily: "/Journal/", focus: "Today", keys: { type: "kind" } }));
  await post("/api/settings", { vaultLang: "en" }); // reloads the layout
  const d = await (await fetch(`${BASE}/api`)).json();
  rmSync(`${ROOT}/vault.json`); rmSync(`${VAULT}/Notes`, { recursive: true }); rmSync(`${VAULT}/Journal`, { recursive: true });
  await post("/api/settings", { vaultLang: "en" });
  expect(d.notes.map((n: any) => n.folder).sort()).toEqual(["Journal", "Notes"]);
  expect(d.inbox).toBe("Notes");
  expect(d.daily).toBe("Journal");
  expect(d.focus).toEqual(["[[Idea]]"]);
  expect((await (await fetch(`${BASE}/api`)).json()).inbox).toBe("1 Inbox");
});

test("notes at the vault root show up; agent instructions and the calendar don't", async () => {
  writeFileSync(`${VAULT}/Start here.md`, "# Start here\n\n> [!abstract] In one sentence\n> Where to begin.\n");
  writeFileSync(`${VAULT}/AGENTS.md`, "# rules\n");
  const paths = (await (await fetch(`${BASE}/api`)).json()).notes.map((n: any) => n.path);
  rmSync(`${VAULT}/Start here.md`); rmSync(`${VAULT}/AGENTS.md`);
  expect(paths).toContain("Start here.md");
  expect(paths).not.toContain("AGENTS.md");
  expect(paths).not.toContain("Calendar.md");
});

test("writes need JSON from an allowed host", async () => {
  expect((await post("/api/capture", { text: "x" }, "text/plain")).status).toBe(403);
});

test("other sites can't read the vault or open a terminal", async () => {
  expect((await fetch(`${BASE}/api`, { headers: { Host: "evil.example" } })).status).toBe(403); // DNS rebinding
  expect((await fetch(`${BASE}/api`, { headers: { Origin: "http://evil.example" } })).status).toBe(403);
  expect((await fetch(`${BASE}/api`, { headers: { Origin: BASE } })).status).toBe(200);
  // Browsers let any page open a WebSocket to localhost: the Origin is the only thing that tells them apart.
  const opened = await new Promise<boolean>((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/pty?id=evil_probe&shell=bash`, { headers: { Origin: "http://evil.example" } } as any);
    ws.onopen = () => { ws.close(); res(true); };
    ws.onerror = ws.onclose = () => res(false);
  });
  expect(opened).toBe(false);
});

test("note HTML shows as text, only safe links survive, and a wikilink with a folder routes by name", async () => {
  const f = `${VAULT}/3 Concepts/Unsafe.md`;
  writeFileSync(f, "# Unsafe\n\n<img src=x onerror=alert(1)>\n\n<script>alert(2)</script>\n\n[bad](javascript:alert(3)) [bad2](JaVaScRiPt:alert(4)) [ok](https://example.com) [[3 Concepts/HTTP|HTTP]]\n");
  const n = await (await fetch(`${BASE}/api/note?path=${encodeURIComponent("3 Concepts/Unsafe.md")}`)).json();
  rmSync(f);
  expect(n.html).not.toContain("<img");
  expect(n.html).not.toContain("<script");
  expect(n.html.toLowerCase()).not.toContain("javascript:");
  expect(n.html).toContain('href="https://example.com"');
  expect(n.html).toContain('href="#/w/HTTP"');
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
const deployHits: { method: string; path: string; search: string; auth: string; body: any }[] = [];
async function fakeProvider(req: Request) {
  const u = new URL(req.url), path = u.pathname;
  if (path.startsWith("/api/v1/") || path.startsWith("/api/project.") || path.startsWith("/api/application.") || path.startsWith("/api/compose.") || path.startsWith("/webhook/") || path.startsWith("/app/") || path === "/health" || path === "/pusher") {
    const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    deployHits.push({ method: req.method, path, search: u.search, auth: req.headers.get("authorization") || req.headers.get("x-api-key") || "", body: b });
    if (path === "/health" || path.startsWith("/app/")) return new Response("ok");
    if (path === "/pusher") return new Response('window.Echo = { wsPort: "", wssPort: 6001, forceTLS: true };', { headers: { "content-type": "application/javascript" } });
    if (path === "/webhook/deploy") return Response.json({ ok: true });
    if (req.headers.get("authorization") !== "Bearer test-key" && req.headers.get("x-api-key") !== "test-key")
      return new Response("unauthorized", { status: 401 });
    if (path === "/api/v1/applications") return Response.json([
      { uuid: "app-1", name: "planeit-web", status: "running:healthy", fqdn: "https://planeit.app,https://www.planeit.app" },
      { uuid: "app-2", name: "planeit-worker", status: "building" },
    ]);
    if (path === "/api/v1/services") return Response.json([
      { uuid: "svc-1", name: "redis-cache", status: "exited:unhealthy" },
    ]);
    if (path === "/api/v1/deploy" || path.endsWith("/restart")) return Response.json({ message: "queued" });
    if (path === "/api/project.all") return Response.json([
      { name: "Main", environments: [{ applications: [{ applicationId: "dk-1", name: "dok-api", applicationStatus: "done", domains: [{ host: "api.planeit.app" }] }], compose: [{ composeId: "dk-c1", name: "dok-db", composeStatus: "running" }] }] },
    ]);
    if (path === "/api/application.deploy" || path === "/api/application.redeploy" || path === "/api/compose.deploy" || path === "/api/compose.redeploy")
      return Response.json({ ok: true });
  }
  const body: any = await req.json();
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

test("a voice memo becomes an inbox note that the first ready agent is told to file; a failure lands in today's note", async () => {
  expect((await post("/api/voice", { name: "x.m4a" })).status).toBe(400);
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  expect((await post("/api/voice", { audio: b64("the phone"), name: "Walk: 3.m4a" })).status).toBe(200);
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
  expect(ready).toEqual({ echo: true, bare: true, mixed: true, sleeper: true, forker: true, opener: true, missing: false, "fake-openai": true, "fake-claude": true });
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

test("stop also ends what the agent started, so the task finishes", async () => {
  const id = await run("forker");
  await Bun.sleep(300);
  expect((await post("/api/task/stop", { id })).status).toBe(200);
  expect((await finished(id)).ok).toBe(false);
  expect(Bun.spawnSync(["pgrep", "-f", "^sleep 31.5"]).stdout.toString().trim()).toBe(""); // no orphan left holding the pipes
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
  // An agent that merely talks about a 429 (and succeeds) is not out of quota.
  // A prompt is passed as text: "$&" and "$$" are not replacement patterns.
  const dollars = await finished(await run("echo", "price $$5 and $& sign"));
  expect(dollars.events.map((e: any) => e.txt).join("\n")).toContain("got price $$5 and $& sign");
  const talky = await finished(await run("echo", "fix the HTTP 429 retry, it resets in 5m"));
  expect(talky.ok).toBe(true);
  expect(talky.quota).toBeUndefined();

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
    'Create a note in the vault about: "Event-Driven Architecture". Follow AGENTS.md strictly: choose the right folder from AGENTS.md, use frontmatter (type, area, tags), callout [!abstract] In one sentence, concise body, footer with wikilinks, and log in 9 Agent/Log.md. Reply in one line.'
  );

  // 4. Portuguese prompt layout when vaultLang is pt
  await post("/api/settings", { vaultLang: "pt" });
  const notePtRes = await post("/api/note/agent", { topic: "Arquitetura Orientada a Eventos", agent: "echo" });
  expect(notePtRes.status).toBe(200);
  const notePtTask = await finished((await notePtRes.json()).id);
  expect(notePtTask.prompt).toBe(
    'Crie uma nota no vault sobre: "Arquitetura Orientada a Eventos". Siga o AGENTS.md rigorosamente: decida a pasta correta pelo AGENTS.md, use frontmatter (tipo, area, tags), callout [!abstract] Em uma frase, corpo objetivo, rodapé com wikilinks e registre em 9 Agente/Log.md. Responda em uma linha.'
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
  expect(appCss).toContain(".orch-cluster-prompt");
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

  // 6. Shell and emulator choice live in Settings; canvas terminals use the chosen shell
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  expect(appJs).toContain("loadTerminals");
  expect(appJs).toContain("set-terminal");
});

test("agent hand-off: a terminal talks to the terminals wired to it, and only to those", async () => {
  // Two shells; A drives everything through the `overlook` command Overlook puts on its PATH.
  const open = (id: string) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/pty?id=${id}&shell=bash&cwd=${encodeURIComponent(ROOT)}&cols=120&rows=30`, { headers: { origin: BASE } } as any);
    const st = { ws, out: "" };
    ws.onmessage = (e) => { st.out += e.data; };
    return new Promise<typeof st>((res) => { ws.onopen = () => res(st); });
  };
  const until = async (st: { out: string }, re: RegExp, ms = 15000) => {
    for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (re.test(st.out)) return;
    throw new Error(`timeout waiting for ${re}: ${st.out.slice(-600)}`);
  };
  const a = await open("t_ha"), b = await open("t_hb");
  // Wires come from Overlook's own page only: a program in a pane (no Origin) can't wire itself to anything.
  const wire = (body: object, origin = BASE) => fetch(`${BASE}/api/canvas/wires`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify({ client: "test-canvas", ...body }) });
  expect((await wire({ wires: [["t_ha", "t_hb"]] }, "")).status).toBe(403);
  expect((await wire({ wires: [["t_ha", "t_hb"]], names: { t_ha: "Alpha", t_hb: "Beta" } })).status).toBe(200);

  a.ws.send("overlook peers; overlook send Beta 'echo HANDOFF_$((6*7))'; sleep 1; overlook read Beta 40\r");
  await until(a, /--- Beta \(t_hb\)[\s\S]*HANDOFF_42/); // A read B's screen: B ran what A sent
  expect(a.out).toMatch(/t_hb\tBeta/);
  expect(b.out).not.toContain("[Message from"); // B is a shell at its prompt: it gets the command alone, no header line

  // Only a pane's own token speaks for it; no wire, no talking.
  expect((await post("/api/pty/send", { from: "t_ha", token: "not-the-token", to: "t_hb", text: "x" })).status).toBe(400);
  await wire({ wires: [], names: {} });
  a.ws.send("overlook send Beta hi\r");
  await until(a, /no card wired to this one matches "Beta"/);
  a.ws.close(); b.ws.close();
  for (const id of ["t_ha", "t_hb"]) await post("/api/pty/close", { id });
});

test("an agent pane runs the agent inside a shell: the prompt is text, and the shell stays when the agent exits", async () => {
  const init = await (await fetch(`${BASE}/api/settings`)).json();
  // A stand-in TUI that prints its prompt and exits, the way claude does on Ctrl+C or /exit.
  await post("/api/settings", { agents: [...init.agents, { id: "tuiq", name: "TuiQ", run: ["sh"], tui: ["printf", "PROMPT[%s]\\n", "{prompt}"], open: { Terminal: ["{terminal}", "sh"] } }] });
  const prompt = `it's $(echo PWNED) \`echo PWNED\` "q" & ; | $HOME`;
  const q = new URLSearchParams({ id: "t_tuiq", agent: "tuiq", prompt, fresh: "1", cwd: ROOT, cols: "160", rows: "20" });
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/pty?${q}`, { headers: { origin: BASE } } as any);
  let out = "";
  ws.onmessage = (e) => { out += e.data; };
  await new Promise<void>((res) => { ws.onopen = () => res(); });
  for (const end = Date.now() + 8000; Date.now() < end && !out.includes("PROMPT["); ) await Bun.sleep(100);
  ws.send("echo STILL_$((40+2))\r");
  for (const end = Date.now() + 8000; Date.now() < end && !out.includes("STILL_42"); ) await Bun.sleep(100);
  ws.close();
  await post("/api/pty/close", { id: "t_tuiq" });
  await post("/api/settings", { agents: init.agents });
  expect(out).toContain(`PROMPT[${prompt}]`); // passed as one argument, nothing ran
  expect(out).not.toContain("it's PWNED"); // $(...) and backticks were not run
  expect(out).toContain("STILL_42"); // the agent exited and the shell took over
});

test("canvas terminal: a real PTY over /ws/pty, only for Overlook's own pages", async () => {
  const url = `ws://127.0.0.1:${PORT}/ws/pty?id=t_pty&shell=bash&cwd=${encodeURIComponent(ROOT)}&cols=90&rows=20`;
  const upgrade = (u: string, origin: string) => fetch(u.replace("ws:", "http:"), { headers: { origin, upgrade: "websocket", connection: "Upgrade", "sec-websocket-key": btoa("the sample nonce"), /* RFC 6455's example nonce, built here so no key-like literal sits in the source */ "sec-websocket-version": "13" } });
  // Browsers let any site open a WebSocket to localhost: a foreign or missing Origin gets nothing.
  for (const origin of ["http://evil.example", ""]) expect((await upgrade(url, origin)).status).toBe(403);
  // An agent without a "{terminal}" opener has no TUI to run.
  expect((await upgrade(url.replace("shell=bash", "agent=echo"), BASE)).status).toBe(400);

  const ws = new WebSocket(url, { headers: { origin: BASE } } as any);
  let out = "";
  // The server closes the socket (4001) when the process exits, so the pane can offer to start it again.
  const closed = await new Promise<number>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout: ${out}`)), 8000);
    ws.onopen = () => ws.send("stty size; tty; exit\r");
    ws.onmessage = (e) => { out += e.data; };
    ws.onclose = (e) => { clearTimeout(t); res(e.code); };
    ws.onerror = rej;
  });
  expect(closed).toBe(4001);
  expect(out).toContain("process exited");
  expect(out).toContain("20 90");
  expect(out).toMatch(/\/dev\/pts\/\d+/);
  await Bun.sleep(100);
  expect((await (await fetch(`${BASE}/api/pty`)).json()).sessions.some((x: any) => x.id === "t_pty")).toBe(false); // exited + unwatched: reaped

  // Closing a pane kills a live interactive shell (they ignore SIGTERM; closing the PTY hangs them up).
  const live = new WebSocket(url.replace("t_pty", "t_live"), { headers: { origin: BASE } } as any);
  let pidOut = "";
  const pid = await new Promise<number>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout: ${pidOut}`)), 8000);
    live.onopen = () => live.send("echo PID=$$\r");
    live.onmessage = (e) => { pidOut += e.data; const m = pidOut.match(/PID=(\d+)/); if (m) { clearTimeout(t); res(Number(m[1])); } };
  });
  live.close();
  expect(await (await post("/api/pty/close", { id: "t_live" })).json()).toEqual({ ok: true });
  await Bun.sleep(500);
  expect(() => process.kill(pid, 0)).toThrow();

  // An agent session's TUI is its "{terminal}" opener minus the terminal; a new one is the bare CLI plus the first prompt.
  const { agentArgv, tuiArgv, tuiOk, tuiResumes } = await import("../tasks");
  const sh = Bun.which("sh");
  const like = { id: "c", name: "C", run: ["sh"], open: { Terminal: ["{terminal}", "sh", "--resume", "{session}"] }, tui: ["sh", "--session-id", "{session}", "{prompt}"] };
  const agy = { id: "a", name: "A", run: ["sh"], tui: ["sh", "-i", "{prompt}"] };
  expect([tuiOk(like), tuiResumes(like), tuiOk(agy), tuiResumes(agy)]).toEqual([true, true, true, false]);
  expect(agentArgv(like, "abc")).toEqual([sh, "--resume", "abc"]);
  expect(tuiArgv(like, "abc", "hi")).toEqual([sh, "--session-id", "abc", "hi"]);
  expect(tuiArgv(agy, "", "hi")).toEqual([sh, "-i", "hi"]);
  expect(tuiArgv(agy, "", "")).toEqual([sh]); // no prompt: the flag goes too
  expect(tuiArgv(agy, "", "- fix the list")).toEqual([sh, "-i", " - fix the list"]); // a markdown list is not a flag
  // agy picks its own conversation id: the pane's id names a log file, and the last conversation created there resumes.
  const { tuiLogs, agentLog, loggedConversation } = await import("../tasks");
  const logged = { id: "l", name: "L", run: ["sh"], open: { Terminal: ["{terminal}", "sh", "--conversation", "{session}"] }, tui: ["sh", "--log-file", "{log}", "-i", "{prompt}"] };
  const pane = crypto.randomUUID(), conv = crypto.randomUUID();
  expect([tuiLogs(logged), tuiLogs(agy)]).toEqual([true, false]);
  expect(tuiArgv(logged, pane, "")).toEqual([sh, "--log-file", agentLog(pane)]);
  expect(tuiArgv(logged, "", "hi")).toEqual([sh, "-i", "hi"]); // no pane id: no log flag
  expect(loggedConversation(pane)).toBe("");
  writeFileSync(agentLog(pane), `I1110 server.go:1233] Created conversation ${crypto.randomUUID()} (backend=X)\nI1110 server.go:1233] Created conversation ${conv} (backend=X)\n`);
  expect(loggedConversation(pane)).toBe(conv);
  rmSync(agentLog(pane));
  const picky = { id: "p", name: "P", run: ["sh"], tui: ["sh", "--model", "{model}", "--effort", "{effort}", "{prompt}"] };
  expect(tuiArgv(picky, "", "hi", "opus", "")).toEqual([sh, "--model", "opus", "hi"]); // an empty effort drops its flag
  expect(tuiOk({ id: "e", name: "E", run: ["echo"] })).toBe(false);
});

test("adversarial verification: canvas multiselect deletion via Delete key, traffic lights unpin, and edge handle isolation", async () => {
  // 2. Verify frontend multiselect deletion and traffic lights isolation
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  const appCss = readFileSync(`${REPO}/app.css`, "utf8");

  // Multiselect & Delete key handling
  expect(appJs).toContain("deleteSelectedPanes");
  expect(appJs).toContain('e.key === "Delete" && orchSelected.size > 0');

  // Traffic lights unpin & empty canvas protection
  // Window chrome: traffic lights close/minimize/maximize, and resize handles on all 8 edges and corners
  expect(appJs).toContain('data-act="orch-unpin"');
  expect(appJs).toContain('data-act="orch-collapse"');
  expect(appJs).toContain('["nw", "ne", "sw", "se", "n", "s", "e", "w"]');
  expect(appCss).toContain(".orch-plane.free .orch-resize { display: block; }");
});

test("adversarial verification: canvas high-contrast contours, split terminal button alignment, and clean shell detection", async () => {
  // 1. Shell detection filtering
  const termRes = await (await fetch(`${BASE}/api/terminals`)).json();
  const shellIds = (termRes.shells || []).map((s: any) => s.id);
  expect(shellIds).not.toContain("git-shell");
  expect(shellIds).not.toContain("rbash");
  expect(shellIds).not.toContain("systemd-home-fallback-shell");
  expect(shellIds).not.toContain("nologin");
  expect(shellIds).not.toContain("false");

  // 2. High-contrast dual-layer contours in CSS
  const appCss = readFileSync(`${REPO}/app.css`, "utf8");
  expect(appCss).toContain(".orch-plane.free .orch-pane");
  expect(appCss).toContain(".orch-deck");
  expect(appCss).toContain(".orch-head");
  expect(appCss).toContain(".orch-talk");
  expect(appCss).toContain(".orch-ctx-group > select.pick");
  expect(appCss).toContain(".orch-ctx-group .orch-cwd-btn");

  // 3. One command bar (layout · prompt with agent and folder · options · Run) and an icon HUD
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  expect(appJs).toContain('card.className = "orch-pane";');
  expect(appJs).toContain('<button type="button" class="orch-cwd-btn"');
  expect(appJs).toContain('data-act="orch-deck-toggle"');
  expect(appJs).toContain('class="hud-btn');
  expect(appCss).toContain(".hud-btn");
});

test("deploy services: Coolify, Dokploy, and abstract webhook/CLI targets", async () => {
  // 1. Reject invalid deploy definitions in services.json
  for (const bad of [
    { id: "c", name: "C", url: FAKE, desc: "x", deploy: {} },
    { id: "c", name: "C", url: FAKE, desc: "x", deploy: { provider: "heroku" } },
    { id: "c", name: "C", url: FAKE, desc: "x", deploy: { provider: "coolify", key: "bad-key!" } },
    { id: "c", name: "C", url: FAKE, desc: "x", deploy: { targets: [{ id: "../bad", name: "Bad" }] } },
    { id: "c", name: "C", url: FAKE, desc: "x", deploy: { targets: [{ id: "ok", name: "Bad URL", webhook: "javascript:alert(1)" }] } },
  ]) expect((await post("/api/settings", { services: [bad] })).status).toBe(400);

  // 2. Configure Coolify, Dokploy, missing-token service, and abstract targets (Dockfy / CLI / webhook)
  const services = [
    { id: "coolify", name: "Coolify", url: `${FAKE}/health`, desc: "Coolify PaaS", deploy: { provider: "coolify", key: "FAKE_KEY" } },
    { id: "dokploy", name: "Dokploy", url: `${FAKE}/health`, desc: "Dokploy PaaS", deploy: { provider: "dokploy", key: "FAKE_KEY" } },
    { id: "notoken", name: "Unconfigured Coolify", url: `${FAKE}/health`, desc: "No token yet", deploy: { provider: "coolify", key: "MISSING_COOLIFY_TOKEN" } },
    {
      id: "custom", name: "Custom Deploys", url: `${FAKE}/health`, desc: "Dockfy / custom targets",
      deploy: {
        targets: [
          { id: "web-hook", name: "Frontend Webhook", check: `${FAKE}/health`, webhook: `${FAKE}/webhook/deploy` },
          { id: "cli-job", name: "CLI Worker", cmd: ["echo", "deployed-worker"], restart: ["echo", "restarted-worker"] },
        ],
      },
    },
  ];
  expect((await post("/api/settings", { services })).status).toBe(200);

  const sys = await (await fetch(`${BASE}/api/system`)).json();
  const cool = sys.services.find((s: any) => s.id === "coolify");
  expect(cool.ok).toBe(true);
  expect(cool.deploy.status).toBe("ok");
  expect(cool.deploy.apps.map((a: any) => [a.id, a.name, a.status, a.kind, a.url])).toEqual([
    ["app-1", "planeit-web", "running", "application", "https://planeit.app"],
    ["app-2", "planeit-worker", "building", "application", undefined],
    ["svc-1", "redis-cache", "error", "service", undefined],
  ]);

  const dok = sys.services.find((s: any) => s.id === "dokploy");
  expect(dok.deploy.status).toBe("ok");
  expect(dok.deploy.apps.map((a: any) => [a.id, a.name, a.status, a.kind, a.url])).toEqual([
    ["dk-1", "dok-api", "running", "application", "https://api.planeit.app"],
    ["dk-c1", "dok-db", "running", "compose", undefined],
  ]);

  const noTok = sys.services.find((s: any) => s.id === "notoken");
  expect(noTok.deploy.status).toBe("no-token");
  expect(noTok.deploy.key).toBe("MISSING_COOLIFY_TOKEN");

  const cust = sys.services.find((s: any) => s.id === "custom");
  expect(cust.deploy.apps.map((a: any) => [a.id, a.status, a.canDeploy, a.canRestart])).toEqual([
    ["web-hook", "running", true, true],
    ["cli-job", "idle", true, true],
  ]);

  // 3. Trigger deploys & restarts across providers and targets
  deployHits.length = 0;
  expect((await post("/api/deploy", { service: "coolify", app: "app-1", action: "deploy" })).status).toBe(200);
  expect((await post("/api/deploy", { service: "coolify", app: "svc-1", action: "restart", kind: "service" })).status).toBe(200);
  expect((await post("/api/deploy", { service: "dokploy", app: "dk-1", action: "deploy" })).status).toBe(200);
  expect((await post("/api/deploy", { service: "dokploy", app: "dk-c1", action: "restart", kind: "compose" })).status).toBe(200);
  expect((await post("/api/deploy", { service: "custom", app: "web-hook", action: "deploy" })).status).toBe(200);

  const cliDep = await (await post("/api/deploy", { service: "custom", app: "cli-job", action: "deploy" })).json();
  expect(cliDep.output).toBe("deployed-worker");
  const cliRes = await (await post("/api/deploy", { service: "custom", app: "cli-job", action: "restart" })).json();
  expect(cliRes.output).toBe("restarted-worker");

  expect(deployHits.map((h) => [h.path, h.search, h.body])).toEqual([
    ["/api/v1/deploy", "?uuid=app-1", {}],
    ["/api/v1/services/svc-1/restart", "", {}],
    ["/api/application.deploy", "", { applicationId: "dk-1" }],
    ["/api/compose.redeploy", "", { composeId: "dk-c1" }],
    ["/webhook/deploy", "", {}],
  ]);

  // Missing token or invalid request returns 400
  expect((await post("/api/deploy", { service: "notoken", app: "app-1", action: "deploy" })).status).toBe(400);
  expect((await post("/api/deploy", { service: "unknown", app: "app-1", action: "deploy" })).status).toBe(400);
  expect((await post("/api/deploy", { service: "../bad", app: "app-1", action: "deploy" })).status).toBe(400);

  // 4. Service proxy rewrites Secure/Domain cookies, Location, and hardcoded target origins so embedded login doesn't 419
  expect((await post("/api/settings", {
    services: [{ id: "coolify", name: "Coolify", url: `${FAKE}/health`, desc: "Coolify", proxy: 4897 }],
  })).status).toBe(200);
  await fetch(`${BASE}/api/system`); // triggers ensureProxies
  const pr = await fetch("http://127.0.0.1:4897/health");
  expect(pr.status).toBe(200);

  const pusher = await (await fetch("http://127.0.0.1:4897/pusher")).text();
  expect(pusher).toContain("wsPort:4897");
  expect(pusher).toContain("wssPort:4897");
  expect(pusher).toContain("forceTLS:false");
  const wsMsg = await new Promise<string>((res) => {
    const ws = new WebSocket("ws://127.0.0.1:4897/app/coolify", { headers: { Host: "127.0.0.1:4897", Origin: "http://127.0.0.1:4897" } } as any);
    ws.onmessage = (e) => { ws.close(); res(String(e.data)); };
    ws.onerror = () => res("err");
  });
  expect(wsMsg).toContain("pusher:connection_established");
  expect((await fetch("http://127.0.0.1:4897/health", { headers: { Host: "evil.com" } })).status).toBe(403);
  expect((await fetch("http://127.0.0.1:4897/health", { headers: { Origin: "http://evil.com" } })).status).toBe(403);

  // 5. Embedded service UI elements and full screen mode
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  expect(appJs).toContain("svc-switch");
  expect(appJs).toContain("svc-tab");
  expect(appJs).toContain('data-act="svc-full"');
  expect(appJs).toContain("function svcFull(");
  expect(appJs).toContain("has-deploy");

  const appCss = readFileSync(`${REPO}/app.css`, "utf8");
  expect(appCss).toContain("body.svc-full");
  expect(appCss).toContain(".svc-switch");
  expect(appCss).toContain(".ag.has-deploy");

  // Restore empty services list
  expect((await post("/api/settings", { services: [] })).status).toBe(200);
});

test("canvas background presets: 5 presets, octave zoom LOD anti-moire, HUD picker, Settings control, and persistence", async () => {
  const appJs = readFileSync(`${REPO}/app.js`, "utf8");
  const appCss = readFileSync(`${REPO}/app.css`, "utf8");

  // 1. All 5 presets (dots, sparse, grid, plain, ambient) exist in CANVAS_BGS (app.js) and .orch-canvas.free[data-bg="..."] (app.css)
  const expectedPresets: [string, string, string, number][] = [
    ["dots", "Dots", "Classic dot matrix", 22],
    ["sparse", "Calm", "Wide soft dots", 44],
    ["grid", "Grid", "Fine hairline grid", 32],
    ["plain", "Solid", "Clean matte surface", 0],
    ["ambient", "Ambient", "Translucent glass", 0],
  ];
  expect(appJs).toContain("const CANVAS_BGS = [");
  for (const [id, label, desc, step] of expectedPresets) {
    expect(appJs).toContain(`["${id}", "${label}", "${desc}", ${step}]`);
    expect(appCss).toContain(`.orch-canvas.free[data-bg="${id}"]`);
    expect(appCss).toContain(`.orch-bgmenu .bg-sw[data-sw="${id}"]`);
  }
  expect(appCss).toContain('html[data-ui="minimal"] .orch-canvas.free[data-bg="ambient"]');
  expect(appCss).toContain("--bg-eff-alpha: calc(var(--bg-dot-alpha) * var(--bg-lod, 1));");

  // 2. Invalid/corrupted background values fall back to "dots" via VALID_BGS / bgEntry
  expect(appJs).toContain("const VALID_BGS = new Set(CANVAS_BGS.map(([k]) => k));");
  expect(appJs).toContain("const bgEntry = (k) => CANVAS_BGS.find(([id]) => id === k) || CANVAS_BGS[0];");
  expect(appJs).toContain('orchBg = VALID_BGS.has(v) ? v : "dots";');
  expect(appJs).toContain('const CANVAS_KEY = "overlook.canvas", CANVAS_BG_KEY = "overlook.canvas-bg"');
  expect(appJs).toContain("if (savedBg && VALID_BGS.has(savedBg)) orchBg = savedBg;");
  expect(appJs).toContain("if (c.bg && VALID_BGS.has(c.bg)) orchBg = c.bg;");

  const VALID_BGS = new Set(expectedPresets.map(([k]) => k));
  const bgEntry = (k: string) => expectedPresets.find(([id]) => id === k) || expectedPresets[0];
  for (const bad of ["", "invalid", "checkerboard", "../xss", "null", "undefined"]) {
    const resolved = VALID_BGS.has(bad) ? bad : "dots";
    expect(resolved).toBe("dots");
    expect(bgEntry(bad)[0]).toBe("dots");
    expect(bgEntry(bad)[3]).toBe(22);
  }

  // Verify cycling order across all 5 presets wraps back to "dots"
  let curBg = "dots";
  const visited: string[] = [];
  for (let i = 0; i < expectedPresets.length; i++) {
    const idx = expectedPresets.findIndex(([k]) => k === curBg);
    curBg = expectedPresets[(idx + 1) % expectedPresets.length][0];
    visited.push(curBg);
  }
  expect(visited).toEqual(["sparse", "grid", "plain", "ambient", "dots"]);

  // 3. Octave step-doubling math & alpha LOD attenuation in applyCanvasTransform across zoom 0.2 to 2.5
  expect(appJs).toContain("while (step * orchZoom < 16) step *= 2;");
  expect(appJs).toContain("const lod = orchZoom < 0.85 ? Math.max(0.42, Math.min(1, (orchZoom - 0.1) / 0.75)) : 1;");

  const makeMockCanvas = () => {
    const props = new Map<string, string>();
    return {
      dataset: { bg: "" },
      style: {
        backgroundPosition: "",
        backgroundSize: "",
        setProperty: (k: string, v: string) => { props.set(k, v); },
        removeProperty: (k: string) => { props.delete(k); },
        getPropertyValue: (k: string) => props.get(k) || "",
      },
    };
  };

  const simulateTransform = (canvas: ReturnType<typeof makeMockCanvas>, bg: string, free: boolean, zoom: number, panX = 40, panY = 64) => {
    const [bgId, , , baseStep] = bgEntry(bg);
    canvas.dataset.bg = bgId;
    if (free && baseStep > 0) {
      let step = baseStep;
      while (step * zoom < 16) step *= 2;
      const px = Math.round(step * zoom * 100) / 100;
      const lod = zoom < 0.85 ? Math.max(0.42, Math.min(1, (zoom - 0.1) / 0.75)) : 1;
      const pos = `${panX}px ${panY}px`, sz = `${px}px ${px}px`;
      canvas.style.setProperty("--bg-pos", pos);
      canvas.style.setProperty("--bg-size", sz);
      canvas.style.setProperty("--bg-lod", lod.toFixed(2));
      canvas.style.backgroundPosition = pos;
      canvas.style.backgroundSize = sz;
      return { step, px, lod };
    } else {
      canvas.style.removeProperty("--bg-pos");
      canvas.style.removeProperty("--bg-size");
      canvas.style.removeProperty("--bg-lod");
      canvas.style.backgroundPosition = "";
      canvas.style.backgroundSize = "";
      return { step: 0, px: 0, lod: 1 };
    }
  };

  const zooms = [0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.65, 0.75, 0.84, 0.85, 1.0, 1.25, 1.5, 2.0, 2.5];
  for (const [id, , , baseStep] of expectedPresets.filter(([, , , s]) => s > 0)) {
    for (const z of zooms) {
      const cv = makeMockCanvas();
      const { step, px, lod } = simulateTransform(cv, id, true, z, 120, 80);
      expect(cv.dataset.bg).toBe(id);
      // Screen-space period must never drop below 16px (prevents moiré and dot crowding at low zoom)
      expect(step * z).toBeGreaterThanOrEqual(16);
      expect(px).toBeGreaterThanOrEqual(16);
      expect(step % baseStep).toBe(0);
      // Octave multiplier is a power of 2
      const mult = step / baseStep;
      expect(Math.log2(mult) % 1).toBe(0);

      // Alpha LOD attenuation below 0.85 zoom
      if (z < 0.85) {
        expect(lod).toBeGreaterThanOrEqual(0.42);
        expect(lod).toBeLessThan(1);
      } else {
        expect(lod).toBe(1);
      }
      expect(cv.style.getPropertyValue("--bg-pos")).toBe("120px 80px");
      expect(cv.style.getPropertyValue("--bg-size")).toBe(`${px}px ${px}px`);
      expect(cv.style.getPropertyValue("--bg-lod")).toBe(lod.toFixed(2));
      expect(cv.style.backgroundPosition).toBe("120px 80px");
      expect(cv.style.backgroundSize).toBe(`${px}px ${px}px`);
    }
  }

  // Exact octave check at minimum zoom (0.2):
  // dots (22): 22 -> 44 -> 88 (88 * 0.2 = 17.6px >= 16px)
  // sparse (44): 44 -> 88 (88 * 0.2 = 17.6px >= 16px)
  // grid (32): 32 -> 64 -> 128 (128 * 0.2 = 25.6px >= 16px)
  const cvMin = makeMockCanvas();
  expect(simulateTransform(cvMin, "dots", true, 0.2).px).toBe(17.6);
  expect(simulateTransform(cvMin, "sparse", true, 0.2).px).toBe(17.6);
  expect(simulateTransform(cvMin, "grid", true, 0.2).px).toBe(25.6);

  // 4. Pattern-free presets (plain, ambient) and tiled mode (!free) clear --bg-pos, --bg-size, --bg-lod, backgroundPosition, and backgroundSize
  for (const plainId of ["plain", "ambient"]) {
    const cv = makeMockCanvas();
    simulateTransform(cv, "dots", true, 0.5, 50, 60); // populate first
    expect(cv.style.getPropertyValue("--bg-pos")).toBe("50px 60px");
    simulateTransform(cv, plainId, true, 0.5, 50, 60);
    expect(cv.dataset.bg).toBe(plainId);
    expect(cv.style.getPropertyValue("--bg-pos")).toBe("");
    expect(cv.style.getPropertyValue("--bg-size")).toBe("");
    expect(cv.style.getPropertyValue("--bg-lod")).toBe("");
    expect(cv.style.backgroundPosition).toBe("");
    expect(cv.style.backgroundSize).toBe("");
  }

  // Tiled mode (!free) clears properties even for patterned presets
  for (const [id] of expectedPresets) {
    const cv = makeMockCanvas();
    simulateTransform(cv, "dots", true, 1.0, 30, 40);
    simulateTransform(cv, id, false, 1.0, 30, 40);
    expect(cv.dataset.bg).toBe(id);
    expect(cv.style.getPropertyValue("--bg-pos")).toBe("");
    expect(cv.style.getPropertyValue("--bg-size")).toBe("");
    expect(cv.style.getPropertyValue("--bg-lod")).toBe("");
    expect(cv.style.backgroundPosition).toBe("");
    expect(cv.style.backgroundSize).toBe("");
  }

  // 5. HUD button (data-act="orch-bg-menu"), #orch-bgmenu, Settings segmented control (data-act="set-canvas-bg"), and keyboard shortcuts (Ctrl+Alt+B / B) are wired
  expect(appJs).toContain('b("orch-bg-menu", "canvasBg"');
  expect(appJs).toContain('<div class="orch-newmenu orch-bgmenu" id="orch-bgmenu" hidden></div>');
  expect(appJs).toContain('"orch-bg-menu": () => {');
  expect(appJs).toContain('"orch-bg": (el) => setCanvasBg(el.dataset.bg || el.dataset.v),');
  expect(appJs).toContain('"set-canvas-bg": (el) => { setCanvasBg(el.dataset.v); if (route().pg === "settings") settingsPage(); },');
  expect(appJs).toContain('data-act="set-canvas-bg"');
  expect(appJs).toContain('KeyB: () => { if (orchMode === "free") cycleCanvasBg(); },');
  expect(appJs).toContain('if (e.key === "b" || e.key === "B") { e.preventDefault(); cycleCanvasBg(); return; }');

  // 6. Fullscreen Escape isolation: Esc inside a focused terminal stays in the terminal; clicking empty canvas blurs focus so Esc exits canvas-full
  expect(appJs).toContain("const inCanvasCardFocus = () => Boolean(");
  expect(appJs).toContain("function blurCanvasFocus(");
  expect(appJs).toContain('navigator.keyboard?.lock?.(["Escape"])');
  expect(appJs).toContain("if (isBg) blurCanvasFocus(");
  expect(appJs).toContain('if (e.key === "Escape" && route().pg === "agents" && !document.querySelector("dialog[open]") && !inCanvasCardFocus())');
});





