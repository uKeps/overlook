// The browser card: one headless Chromium-family browser (Brave, Chromium or Chrome from the PATH; BROWSER_BIN picks
// another) driven over the DevTools protocol, no dependency. Each card is one of its tabs: its screen is streamed to the
// card as JPEG frames (Page.startScreencast, only when something changes), the card's mouse and keys go back as input
// events, and agents wired to the card drive the same tab (overlook browser ...). Its own profile, so logins made in the
// card stay, apart from the user's own browser. Tabs nobody watches close after 10 min; the browser, once it has none.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const ROOT = import.meta.dir, PROFILE = `${ROOT}/cache/browser-profile`, SHOTS = `${ROOT}/cache/shots`, IDLE = 10 * 60_000;
type Sub = (m: string | Uint8Array) => void;
type Tab = {
  id: string; target: string; ws: WebSocket; seq: number; calls: Map<number, (r: any) => void>; subs: Set<Sub>;
  url: string; title: string; icon: string; back: boolean; fwd: boolean; loading: boolean;
  w: number; h: number; z: number; mobile: boolean; used: number; ready: Promise<void>;
};
let proc: ReturnType<typeof Bun.spawn> | null = null, base: Promise<string> | null = null, lastTab = Date.now();
const tabs = new Map<string, Tab>(), opening = new Map<string, Promise<Tab>>();

const browserBin = () => process.env.BROWSER_BIN || ["brave", "brave-browser", "chromium", "google-chrome-stable", "google-chrome"].map((b) => Bun.which(b)).find(Boolean) || "";
// Only pages a card may load: the web, and about:blank. Anything else (file:, chrome:, javascript:) is refused.
export const safeUrl = (u: unknown) => { const s = String(u ?? "").trim(); return /^(https?:\/\/|about:blank$)/i.test(s) ? s.slice(0, 2000) : ""; };

// The browser, started on first use; it writes the port it chose into its profile (DevToolsActivePort).
function devtools(): Promise<string> {
  base ??= (async () => {
    const bin = browserBin();
    if (!bin) throw new Error("no Chromium-family browser on the PATH (brave, chromium, google-chrome): set BROWSER_BIN");
    mkdirSync(PROFILE, { recursive: true });
    rmSync(`${PROFILE}/DevToolsActivePort`, { force: true });
    proc = Bun.spawn([bin, "--headless=new", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1", `--user-data-dir=${PROFILE}`,
      "--no-first-run", "--no-default-browser-check", "--mute-audio", "--disable-features=Translate,MediaRouter", "about:blank"], { stdout: "ignore", stderr: "ignore" });
    proc.exited.then(() => { proc = null; base = null; for (const t of tabs.values()) drop(t); });
    for (let i = 0; i < 100; i++) {
      if (existsSync(`${PROFILE}/DevToolsActivePort`)) {
        const port = readFileSync(`${PROFILE}/DevToolsActivePort`, "utf8").split("\n")[0].trim();
        if (/^\d+$/.test(port)) return `http://127.0.0.1:${port}`;
      }
      await Bun.sleep(100);
    }
    proc.kill();
    throw new Error(`${bin} didn't start its DevTools endpoint`);
  })().catch((e) => { base = null; throw e; });
  return base;
}

function call(t: Tab, method: string, params: object = {}): Promise<any> {
  const id = ++t.seq;
  return new Promise((res) => {
    t.calls.set(id, res);
    try { t.ws.send(JSON.stringify({ id, method, params })); } catch { t.calls.delete(id); res({ error: { message: "the tab is gone" } }); }
    setTimeout(() => { if (t.calls.delete(id)) res({ error: { message: `${method} timed out` } }); }, 15_000);
  });
}
const send = (t: Tab, m: string | Uint8Array) => { for (const s of t.subs) s(m); };
// The page's address, title, icon and whether back/forward can go anywhere (the card greys out its buttons).
async function meta(t: Tab) {
  const h = (await call(t, "Page.getNavigationHistory")).result;
  if (h?.entries) { t.back = h.entries.slice(0, h.currentIndex).some((e: any) => e.url !== "about:blank"); t.fwd = h.currentIndex < h.entries.length - 1; }
  send(t, JSON.stringify({ t: "nav", url: t.url, title: t.title, icon: t.icon, back: t.back, fwd: t.fwd }));
}
// The page's own icon (its <link rel=icon>, else /favicon.ico); the card shows it as an <img>, so http(s) only.
const ICON = `(() => { const l = [...document.querySelectorAll("link[rel~=icon]")].pop(); return l ? l.href : /^https?:/.test(location.href) ? location.origin + "/favicon.ico" : ""; })()`;
function drop(t: Tab) {
  tabs.delete(t.id);
  try { t.ws.close(); } catch {}
  for (const r of t.calls.values()) r({ error: { message: "the tab closed" } });
  send(t, JSON.stringify({ t: "gone" }));
}

// The title and icon, read again on every navigation (a page back from the back/forward cache fires no load event).
const look = (t: Tab) => call(t, "Runtime.evaluate", { expression: `[document.title, ${ICON}]`, returnByValue: true }).then((r) => {
  const [title, icon] = r.result?.result?.value ?? [];
  t.title = String(title ?? ""); t.icon = /^https?:\/\//.test(String(icon)) ? String(icon).slice(0, 2000) : ""; meta(t);
});

// The card's tab (opened at `url` the first time).
export function tabFor(id: string, url = "about:blank"): Promise<Tab> {
  const have = tabs.get(id);
  if (have) return have.ready.then(() => have);
  if (opening.has(id)) return opening.get(id)!;
  const p = (async () => {
    const b = await devtools();
    const info = await (await fetch(`${b}/json/new?${encodeURIComponent(safeUrl(url) || "about:blank")}`, { method: "PUT" })).json() as any;
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    const t: Tab = { id, target: info.id, ws, seq: 0, calls: new Map(), subs: new Set(), url: info.url, title: "", icon: "", back: false, fwd: false, loading: false, w: 900, h: 600, z: 1, mobile: false, used: Date.now(), ready: Promise.resolve() };
    t.ready = new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error("couldn't reach the tab")); });
    ws.onclose = () => { if (tabs.get(id) === t) drop(t); };
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.id) { t.calls.get(m.id)?.(m); t.calls.delete(m.id); return; }
      if (m.method === "Page.screencastFrame") {
        call(t, "Page.screencastFrameAck", { sessionId: m.params.sessionId });
        send(t, Buffer.from(m.params.data, "base64"));
      } else if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) { t.url = m.params.frame.url; look(t); }
      else if (m.method === "Page.navigatedWithinDocument") { t.url = m.params.url; look(t); }
      else if (m.method === "Page.loadEventFired" || m.method === "Page.domContentEventFired") look(t);
      else if ((m.method === "Page.frameStartedLoading" || m.method === "Page.frameStoppedLoading") && m.params.frameId === t.target) {
        t.loading = m.method === "Page.frameStartedLoading";
        send(t, JSON.stringify({ t: "load", on: t.loading }));
      }
    };
    await t.ready;
    tabs.set(id, t);
    await call(t, "Page.enable");
    await size(t, t.w, t.h);
    return t;
  })().finally(() => opening.delete(id));
  opening.set(id, p);
  return p;
}

// w × h in the page's CSS pixels; z is the card's page zoom (the page renders at z device pixels per CSS pixel, so frames
// stay the card's size); mobile lays the page out as a phone would (viewport meta, no scrollbars), touch stays off.
async function size(t: Tab, w: number, h: number, z = t.z, mobile = t.mobile) {
  t.z = Math.max(0.25, Math.min(3, z)); t.mobile = mobile;
  t.w = Math.max(200, Math.min(4000, Math.round(w))); t.h = Math.max(150, Math.min(3000, Math.round(h)));
  await call(t, "Emulation.setDeviceMetricsOverride", { width: t.w, height: t.h, deviceScaleFactor: t.z, mobile: t.mobile });
  if (t.subs.size) await cast(t);
}
// Frames at the card's size; a fresh one right away (the screencast only sends when the page changes).
async function cast(t: Tab) {
  await call(t, "Page.stopScreencast");
  await call(t, "Page.startScreencast", { format: "jpeg", quality: 72, maxWidth: Math.round(t.w * t.z), maxHeight: Math.round(t.h * t.z), everyNthFrame: 1 });
  const r = await call(t, "Page.captureScreenshot", { format: "jpeg", quality: 72 });
  if (r.result?.data) send(t, Buffer.from(r.result.data, "base64"));
}

// A card's socket: frames and the page's address to it, its input to the tab. Returns how to detach.
export async function attach(id: string, url: string, sub: Sub) {
  const t = await tabFor(id, url);
  t.subs.add(sub); t.used = Date.now();
  meta(t);
  if (t.loading) sub(JSON.stringify({ t: "load", on: true }));
  await cast(t);
  return () => { t.subs.delete(sub); t.used = Date.now(); if (!t.subs.size) call(t, "Page.stopScreencast"); };
}

const VK: Record<string, number> = { Enter: 13, Backspace: 8, Tab: 9, Escape: 27, " ": 32, PageUp: 33, PageDown: 34, End: 35, Home: 36,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46 };
const MOUSE = new Set(["mousePressed", "mouseReleased", "mouseMoved"]), BTN = new Set(["left", "middle", "right", "none"]);
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
// Input from the card (one JSON message each); unknown kinds are ignored.
export async function input(id: string, raw: string) {
  const t = tabs.get(id) ?? await opening.get(id)?.catch(() => null); // input sent while the tab was still opening waits for it
  if (!t) return;
  let m: any;
  try { m = JSON.parse(raw); } catch { return; }
  t.used = Date.now();
  const mods = num(m.m) & 15;
  if (m.t === "mouse" && MOUSE.has(m.e)) {
    await call(t, "Input.dispatchMouseEvent", { type: m.e, x: num(m.x), y: num(m.y), button: BTN.has(m.b) ? m.b : "none", buttons: num(m.bs), clickCount: Math.min(3, num(m.n)), modifiers: mods });
  } else if (m.t === "wheel") {
    await call(t, "Input.dispatchMouseEvent", { type: "mouseWheel", x: num(m.x), y: num(m.y), deltaX: num(m.dx), deltaY: num(m.dy), modifiers: mods });
  } else if (m.t === "key" && typeof m.key === "string" && m.key.length <= 32) await key(t, m.key, String(m.code ?? "").slice(0, 32), m.e === "up", mods);
  else if (m.t === "text" && typeof m.text === "string") await call(t, "Input.insertText", { text: m.text.slice(0, 20_000) });
  else if (m.t === "size") await size(t, num(m.w, 900), num(m.h, 600), num(m.z, 1), m.mobile === true);
  else if (m.t === "go" && safeUrl(m.url)) await call(t, "Page.navigate", { url: safeUrl(m.url) });
  else if (m.t === "reload") await call(t, "Page.reload");
  else if (m.t === "back" || m.t === "fwd") {
    const h = (await call(t, "Page.getNavigationHistory")).result, e = h?.entries?.[h.currentIndex + (m.t === "back" ? -1 : 1)];
    if (e) await call(t, "Page.navigateToHistoryEntry", { entryId: e.id });
  }
}
// A key as the page would get it: printable ones (without Ctrl/Alt/Meta) type their character; the rest are raw keys.
async function key(t: Tab, k: string, code: string, up: boolean, mods: number) {
  const printable = k.length === 1 && !(mods & 7), vk = VK[k] ?? (k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
  const base = { key: k, code, modifiers: mods, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  if (up) return call(t, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
  return call(t, "Input.dispatchKeyEvent", printable || k === "Enter" ? { type: "keyDown", text: k === "Enter" ? "\r" : k, ...base } : { type: "rawKeyDown", ...base });
}

// What agents do with a card's tab (overlook browser ...). Each returns text for the agent, or throws with why not.
const evaluate = async (t: Tab, expression: string) => {
  const r = await call(t, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.error || r.result?.exceptionDetails) throw new Error(r.error?.message || r.result.exceptionDetails.exception?.description || "the page threw");
  return r.result?.result?.value;
};
const settle = () => Bun.sleep(600); // a navigation or a click usually shows within this; agents can read again
export async function agentDo(id: string, url: string, cmd: string, arg: string): Promise<string> {
  const t = await tabFor(id, url);
  t.used = Date.now();
  if (cmd === "open") {
    const u = safeUrl(/^[\w.-]+\.[a-z]{2,}(\/|$)|^localhost(:|\/|$)/i.test(arg) ? `${arg.startsWith("localhost") ? "http" : "https"}://${arg}` : arg);
    if (!u) throw new Error("open takes an http(s) address");
    await call(t, "Page.navigate", { url: u });
    await settle();
    return `opened ${t.url}`;
  }
  if (cmd === "read") {
    const text = String(await evaluate(t, "document.body ? document.body.innerText : ''") ?? "");
    return `${t.title || "(no title)"} — ${t.url}\n\n${text.slice(0, 20_000)}${text.length > 20_000 ? "\n[cut at 20000 characters]" : ""}`;
  }
  if (cmd === "shot") {
    mkdirSync(SHOTS, { recursive: true });
    const r = await call(t, "Page.captureScreenshot", { format: "png" });
    if (!r.result?.data) throw new Error("no screenshot");
    const f = `${SHOTS}/${id}-${Date.now()}.png`;
    await Bun.write(f, Buffer.from(r.result.data, "base64"));
    return f;
  }
  if (cmd === "click") {
    // "x,y" in the page, a CSS selector, or text=… (the first link, button or label showing that text)
    let at = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(arg)?.slice(1).map(Number);
    if (!at) {
      const q = JSON.stringify(arg.startsWith("text=") ? arg.slice(5).trim().toLowerCase() : arg), byText = arg.startsWith("text=");
      at = await evaluate(t, `(() => { const q = ${q};
        const el = ${byText} ? [...document.querySelectorAll("a,button,[role=button],input[type=submit],input[type=button],summary,label,[onclick]")].find((e) => (e.innerText || e.value || "").trim().toLowerCase().includes(q)) : document.querySelector(q);
        if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; })()`);
      if (!at) throw new Error(`nothing matches ${arg}`);
    }
    for (const type of ["mousePressed", "mouseReleased"]) await call(t, "Input.dispatchMouseEvent", { type, x: at[0], y: at[1], button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    await settle();
    return `clicked at ${at[0]},${at[1]} — now ${t.url}`;
  }
  if (cmd === "type") { await call(t, "Input.insertText", { text: arg }); return "typed"; }
  if (cmd === "key") {
    if (!(arg in VK) && arg.length !== 1) throw new Error(`key takes one of ${Object.keys(VK).join(", ")} or a single character`);
    await key(t, arg, "", false, 0); await key(t, arg, "", true, 0); await settle();
    return `pressed ${arg}`;
  }
  throw new Error("commands: open <url> | read | shot | click <x,y | css | text=…> | type <text> | key <Enter|Tab|…>");
}
export const tabInfo = (id: string) => { const t = tabs.get(id); return t ? { url: t.url, title: t.title } : null; };

// Idle tabs close, and the browser once it has none.
setInterval(() => {
  const now = Date.now();
  for (const t of tabs.values()) if (!t.subs.size && now - t.used > IDLE) {
    fetch(`${t.ws.url.replace(/^ws(s?):\/\/([^/]+).*$/, "http$1://$2")}/json/close/${t.target}`).catch(() => {});
    drop(t);
  }
  if (tabs.size) lastTab = now;
  else if (proc && now - lastTab > IDLE) { proc.kill(); proc = null; base = null; }
}, 60_000).unref?.();
