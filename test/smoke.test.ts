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
const ENV = { ...process.env, VAULT_DIR: VAULT, VAULT_LANG: "en", PORT: String(PORT), ART_DIR: `${ROOT}/no-art`, FAKE_KEY: "test-key" };
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
    { id: "sleeper", name: "Sleeper", run: ["sleep", "30"] },
    { id: "opener", name: "Opener", run: ["true", "{session}"], open: { Log: ["sh", "-c", "echo {session} > opened.txt"] } },
    { id: "missing", name: "Missing", run: ["definitely-not-installed-overlook"] },
    { id: "fake-openai", name: "Fake OpenAI", api: "openai", url: `${FAKE}/v1`, model: "fake", key: "FAKE_KEY" },
    { id: "fake-claude", name: "Fake Claude", api: "anthropic", url: FAKE, model: "claude-opus-5-5", key: "FAKE_KEY" },
  ]));
  fake = Bun.serve({ hostname: "127.0.0.1", port: 4798, fetch: fakeProvider });
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

test("system and pinterest work with nothing configured", async () => {
  const s = await (await fetch(`${BASE}/api/system`)).json();
  expect(s.services).toEqual([]);
  expect(Array.isArray(s.agents)).toBe(true);
  expect((await (await fetch(`${BASE}/api/pinterest`)).json()).status).toBe("no-config");
});

test("pages and assets are served and the frontend parses", async () => {
  for (const p of ["/", "/app.js", "/app.css", "/grafite/", "/grafite/app.js", "/grafite/app.css", "/grafite/tokens.css"])
    expect([p, (await fetch(BASE + p)).status]).toEqual([p, 200]);
  const js = new Bun.Transpiler({ loader: "js" });
  for (const f of ["app.js", "grafite/app.js"]) js.transformSync(readFileSync(`${ROOT}/${f}`, "utf8"));
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
    const first = !body.messages.some((m: any) => m.role === "tool");
    const call = (id: string, name: string, args: unknown) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
    return Response.json({ choices: [{ message: first
      ? { role: "assistant", content: null, tool_calls: [call("a", "write_note", { path: "1 Inbox/From openai.md", content: "# From openai\n" }), call("b", "write_note", { path: "../escape.md", content: "x" })] }
      : { role: "assistant", content: "done" } }] });
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

test("agents.json drives the runner list", async () => {
  const s = await (await fetch(`${BASE}/api/system`)).json();
  const ready = Object.fromEntries(s.runners.map((r: any) => [r.id, r.ready]));
  expect(ready).toEqual({ echo: true, bare: true, sleeper: true, opener: true, missing: false, "fake-openai": true, "fake-claude": true });
  const claude = s.runners.find((r: any) => r.id === "fake-claude");
  expect([claude.models, claude.effort]).toEqual([["claude-opus-5-5"], "high"]);
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
