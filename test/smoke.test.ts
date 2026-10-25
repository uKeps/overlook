// Boots the server the way a fresh clone does (tracked files only, no .env, no personal config) against the
// example vault, then walks every endpoint and page the UI relies on. Writes land in a temp copy.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";

const REPO = `${import.meta.dir}/..`;
const ROOT = mkdtempSync(`${tmpdir()}/overlook-`);
const VAULT = `${ROOT}/example-vault`;
const PORT = 4799;
const BASE = `http://127.0.0.1:${PORT}`;
const ENV = { ...process.env, VAULT_DIR: VAULT, VAULT_LANG: "en", PORT: String(PORT), ART_DIR: `${ROOT}/no-art` };
const TODAY = new Date().toLocaleDateString("sv");
let server: ReturnType<typeof Bun.spawn>;

const post = (path: string, body: unknown, type = "application/json") =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": type }, body: JSON.stringify(body) });

beforeAll(async () => {
  const files = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: REPO }).stdout.toString().split("\0").filter(Boolean);
  for (const f of files) { mkdirSync(dirname(`${ROOT}/${f}`), { recursive: true }); copyFileSync(`${REPO}/${f}`, `${ROOT}/${f}`); }
  server = Bun.spawn(["bun", "server.ts"], { cwd: ROOT, env: ENV, stdout: "ignore", stderr: "inherit" });
  for (let i = 0; i < 100; i++) { try { await fetch(BASE); return; } catch { await Bun.sleep(100); } }
  throw new Error("server did not start");
});
afterAll(() => { server?.kill(); rmSync(ROOT, { recursive: true, force: true }); });

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
