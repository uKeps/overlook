// Pinterest (read-only, only the account that authorized): images from one board for the Home carousel.
// Secrets and tokens live in .env (outside git). Nothing here is logged; the frontend never talks to Pinterest.
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

const DIR = import.meta.dir;
const ENV = `${DIR}/.env`;
const CACHE = `${DIR}/cache/pinterest`;
const INDEX = `${CACHE}/index.json`;
const API = "https://api.pinterest.com/v5";
const SIX_HOURS = 6 * 3600_000;

type Pin = { id: string; link: string; title: string; color: string };
type State = { status: "ok" | "no-config" | "disconnected" | "error"; error: string; last: string; syncing: boolean; images: Pin[] };

let redirect = "";
let state: State = { status: "no-config", error: "", last: "", syncing: false, images: [] };
let paused = false; // configuration error (403): no automatic retries, only from the button
let lastLog = "";
const pending = new Set<string>(); // OAuth "state" values in flight

const logOnce = (msg: string) => { if (msg !== lastLog) { console.error(`pinterest: ${msg}`); lastLog = msg; } };

function readEnv(): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(ENV, "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch { return {}; }
}
function saveEnv(values: Record<string, string>) {
  const lines = existsSync(ENV) ? readFileSync(ENV, "utf8").split("\n") : [];
  for (const [k, v] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  }
  writeFileSync(ENV, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
}
const credentials = () => { const e = readEnv(); return e.PINTEREST_CLIENT_ID && e.PINTEREST_CLIENT_SECRET ? e : null; };
const basic = (e: Record<string, string>) => "Basic " + Buffer.from(`${e.PINTEREST_CLIENT_ID}:${e.PINTEREST_CLIENT_SECRET}`).toString("base64");

async function requestToken(body: Record<string, string>) {
  const e = credentials()!;
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST", headers: { Authorization: basic(e), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`token refused (${r.status} ${j.code ?? ""})`.trim());
  saveEnv({
    PINTEREST_ACCESS_TOKEN: j.access_token,
    PINTEREST_EXPIRES_AT: String(Date.now() + (j.expires_in ?? 2592000) * 1000),
    ...(j.refresh_token ? { PINTEREST_REFRESH_TOKEN: j.refresh_token } : {}),
  });
}

// A valid token, refreshed when less than a day is left. No working refresh: "disconnected" (reconnect).
async function token() {
  const e = readEnv();
  if (!e.PINTEREST_ACCESS_TOKEN) throw Object.assign(new Error("no token: connect Pinterest"), { disconnected: true });
  // A test token pasted by hand (from the app page) has no expiry: valid until Pinterest answers 401.
  if (!e.PINTEREST_EXPIRES_AT || Number(e.PINTEREST_EXPIRES_AT) - Date.now() > 86400_000) return e.PINTEREST_ACCESS_TOKEN;
  if (!e.PINTEREST_REFRESH_TOKEN) throw Object.assign(new Error("token expired and no refresh token: reconnect"), { disconnected: true });
  try { await requestToken({ grant_type: "refresh_token", refresh_token: e.PINTEREST_REFRESH_TOKEN }); }
  catch { throw Object.assign(new Error("refresh refused: reconnect Pinterest"), { disconnected: true }); }
  return readEnv().PINTEREST_ACCESS_TOKEN;
}

async function get(path: string): Promise<any> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  const j: any = await r.json().catch(() => ({}));
  if (r.status === 401 && j.code === 3)
    throw Object.assign(new Error("Pinterest Trial access pending (code 3): use \"user/board\" in pinterest.json to read the public board instead"), { config: true });
  if (r.status === 401) throw Object.assign(new Error("invalid token: reconnect Pinterest"), { disconnected: true });
  if (r.status === 403 && /PINNER_DATA_ACCESS_DENIED/.test(JSON.stringify(j)))
    throw Object.assign(new Error("PINNER_DATA_ACCESS_DENIED: the app only reads boards of the account that authorized it"), { config: true });
  if (!r.ok) throw new Error(`Pinterest answered ${r.status} ${j.message ?? ""}`.trim());
  return j;
}
async function all(path: string) {
  const items: any[] = [];
  let bookmark = "";
  do {
    const j = await get(`${path}${path.includes("?") ? "&" : "?"}page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ""}`);
    items.push(...(j.items ?? []));
    bookmark = j.bookmark ?? "";
  } while (bookmark && items.length < 2000);
  return items;
}

// Drops small images (<720x600), GIFs and narrow vertical phone screenshots (ratio < 0.72) that look stretched on the cards.
const goodImage = (w: number, h: number, url: string) => w >= 720 && h >= 600 && w / h >= 0.72 && !/\.gif($|\?)/i.test(url);

// Public board (https://pinterest.com/<user>/<board>/): reads the pins from the SSR payload (__PWS_INITIAL_PROPS__), no OAuth or Trial needed.
// ponytail: 3 parallel reads (the SSR samples ~25 pins per request) merged by hash; the official API pages through everything.
async function publicPins(board: string): Promise<{ id: string; url: string; link: string; title: string; color: string }[]> {
  const clean = board.replace(/^https?:\/\/[^/]+\//, "").replace(/\/?(\.rss)?$/, "");
  const map = new Map<string, { id: string; url: string; link: string; title: string; color: string }>();
  const htmls = await Promise.all([0, 1, 2].map(async () => {
    const r = await fetch(`https://br.pinterest.com/${clean}/`);
    if (!r.ok) throw Object.assign(new Error(`Board "${clean}" answered ${r.status} (check that it is public)`), { config: true });
    return r.text();
  }));
  for (const html of htmls) {
    const m = html.match(/<script[^>]*id="__PWS_INITIAL_PROPS__"[^>]*>([\s\S]*?)<\/script>/);
    const pins = m ? (JSON.parse(m[1])?.initialReduxState?.pins ?? {}) : {};
    for (const [pid, p] of Object.entries<any>(pins)) {
      const orig = p?.images?.orig ?? p?.images?.["736x"] ?? {};
      const url: string = orig.url ?? "";
      const hash = url.match(/\/([0-9a-f]{16,64})\.\w+$/)?.[1];
      if (!url || !hash || !goodImage(Number(orig.width) || 0, Number(orig.height) || 0, url)) continue;
      const title = String(p.title || p.grid_title || p.description || p.auto_alt_text || "").trim().slice(0, 140);
      map.set(hash, { id: hash, url, link: `https://www.pinterest.com/pin/${pid}/`, title, color: p.dominant_color ?? "" });
    }
  }
  return [...map.values()];
}

export async function sync(manual = false) {
  if (state.syncing || (paused && !manual)) return state;
  const cfg = (() => { try { return JSON.parse(readFileSync(`${DIR}/pinterest.json`, "utf8")); } catch { return {}; } })();
  const isPublic = typeof cfg.board === "string" && cfg.board.includes("/");
  if (!isPublic && !credentials() && !readEnv().PINTEREST_ACCESS_TOKEN) { state.status = "no-config"; return state; }
  state.syncing = true;
  try {
    mkdirSync(CACHE, { recursive: true });
    const pins: Pin[] = [];
    if (isPublic) {
      for (const p of await publicPins(cfg.board)) {
        const file = `${CACHE}/${p.id}.jpg`;
        if (!existsSync(file)) {
          const r = await fetch(p.url);
          if (!r.ok) continue;
          await Bun.write(file, r);
          Bun.spawnSync(["magick", `${file}[0]`, "-resize", "1800x1800>", "-quality", "82", file]);
        }
        pins.push({ id: p.id, link: p.link, title: p.title, color: p.color });
      }
    } else {
      const target = String(cfg.board ?? "").toLowerCase();
      const board = (await all("/boards")).find((b) => b.id === cfg.board || b.name?.toLowerCase() === target || b.name?.toLowerCase().replace(/\s+/g, "-") === target);
      if (!board) throw new Error(`board "${cfg.board}" not found in your account (pinterest.json)`);
      for (const p of await all(`/boards/${board.id}/pins`)) {
        const imgs = Object.values(p.media?.images ?? {}) as { url: string; width: number; height: number }[];
        const largest = imgs.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
        if (!largest?.url || !/^\d+$/.test(p.id) || !goodImage(largest.width ?? 0, largest.height ?? 0, largest.url)) continue;
        const file = `${CACHE}/${p.id}.jpg`;
        if (!existsSync(file)) {
          const r = await fetch(largest.url);
          if (!r.ok) continue;
          await Bun.write(file, r);
          Bun.spawnSync(["magick", `${file}[0]`, "-resize", "1800x1800>", "-quality", "82", file]); // without ImageMagick, the original stays
        }
        pins.push({ id: p.id, link: `https://www.pinterest.com/pin/${p.id}/`, title: String(p.title || p.alt_text || p.description || "").slice(0, 140), color: p.dominant_color ?? "" });
      }
    }
    const kept = new Set(pins.flatMap((p) => [`${p.id}.jpg`, `${p.id}-amb.jpg`, `${p.id}-thumb.jpg`]));
    for (const f of readdirSync(CACHE)) if (f.endsWith(".jpg") && !kept.has(f)) unlinkSync(`${CACHE}/${f}`); // left the board, leaves the cache
    state = { status: "ok", error: "", last: new Date().toISOString(), syncing: false, images: pins };
    writeFileSync(INDEX, JSON.stringify({ last: state.last, pins }, null, 1));
    paused = false; lastLog = "";
  } catch (e: any) {
    state.syncing = false;
    state.error = e.message;
    state.status = e.disconnected ? "disconnected" : "error";
    if (e.config) paused = true;
    logOnce(e.message);
  }
  return state;
}

export function startPinterest(callbackUrl: string) {
  redirect = callbackUrl;
  try { const i = JSON.parse(readFileSync(INDEX, "utf8")); state.images = i.pins ?? []; state.last = i.last ?? ""; } catch {}
  state.status = readEnv().PINTEREST_ACCESS_TOKEN ? "ok" : !credentials() ? "no-config" : "disconnected";
  sync();
  setInterval(() => sync(), SIX_HOURS);
}

// What the user picked in the Images page, kept in pinterest.json next to the board: hidden images never show;
// "fixed" uses only the starred ones, in their order, instead of a daily rotation.
type Prefs = { board: string; mode: "random" | "fixed"; hidden: string[]; starred: string[] };
const CONFIG = `${DIR}/pinterest.json`;
const readConfig = (): Record<string, any> => { try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; } };
const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i) => typeof i === "string" && /^[0-9a-f]+$/.test(i)) : []);
function prefs(): Prefs {
  const c = readConfig();
  return { board: String(c.board ?? ""), mode: c.mode === "fixed" ? "fixed" : "random", hidden: ids(c.hidden), starred: ids(c.starred) };
}
export function setPrefs(b: any) {
  const c = readConfig(), next: Record<string, unknown> = {};
  if (b.mode !== undefined) { if (b.mode !== "random" && b.mode !== "fixed") return "mode must be random or fixed"; next.mode = b.mode; }
  for (const k of ["hidden", "starred"]) if (b[k] !== undefined) {
    if (!Array.isArray(b[k]) || b[k].length > 5000 || ids(b[k]).length !== b[k].length) return `${k} must be a list of image ids`;
    next[k] = [...new Set(b[k] as string[])];
  }
  if (b.board !== undefined) {
    const board = String(b.board).trim().replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    if (board && !/^[\w%. -]{1,100}(\/[\w%. -]{1,100})?$/.test(board)) return "board must be user/board (public) or a board name";
    next.board = board;
  }
  writeFileSync(CONFIG, JSON.stringify({ ...c, ...next }, null, 1));
  if (next.board !== undefined && next.board !== c.board) { paused = false; sync(true); } // a new board: fetch it now
  return pinterestState();
}
// The images the cards use, in order.
export function shownPins() {
  const p = prefs(), visible = state.images.filter((i) => !p.hidden.includes(i.id));
  const starred = p.mode === "fixed" ? p.starred.map((id) => visible.find((i) => i.id === id)).filter((i): i is Pin => !!i) : [];
  return { mode: starred.length ? "fixed" : "random", pins: starred.length ? starred : visible };
}

export const pinterestState = () => ({ ...state, ...prefs(), total: state.images.length, redirect });

// The cached image, or a smaller copy made on first request: "amb" (blurred, for the ambient background) or "thumb" (for the grid).
export async function pinFile(id: string, variant: "" | "amb" | "thumb" = "") {
  if (!/^[0-9a-f]+$/.test(id)) return null;
  const orig = `${CACHE}/${id}.jpg`;
  if (!(await Bun.file(orig).exists())) return null;
  if (!variant) return Bun.file(orig);
  const out = `${CACHE}/${id}-${variant}.jpg`;
  if (!(await Bun.file(out).exists())) {
    const args = variant === "amb" ? ["-resize", "160x160>", "-blur", "0x5", "-modulate", "50,135"] : ["-resize", "480x480>"];
    Bun.spawnSync(["magick", `${orig}[0]`, ...args, "-quality", "78", out]);
    if (!(await Bun.file(out).exists())) return Bun.file(orig);
  }
  return Bun.file(out);
}

// OAuth: /auth/pinterest sends you to Pinterest; the callback checks the "state" and trades the code for tokens.
export function authorizeUrl() {
  const e = credentials();
  if (!e) return null;
  const st = randomBytes(16).toString("hex");
  pending.add(st);
  setTimeout(() => pending.delete(st), 600_000);
  return `https://www.pinterest.com/oauth/?${new URLSearchParams({ client_id: e.PINTEREST_CLIENT_ID, redirect_uri: redirect, response_type: "code", scope: "boards:read,pins:read", state: st })}`;
}
export async function authorizeCallback(url: URL) {
  const st = url.searchParams.get("state") ?? "", code = url.searchParams.get("code") ?? "";
  if (!pending.delete(st) || !code) return "Invalid or expired authorization. Go back to Overlook and try again.";
  try {
    await requestToken({ grant_type: "authorization_code", code, redirect_uri: redirect, continuous_refresh: "true" });
  } catch (e: any) { logOnce(e.message); return `Pinterest refused: ${e.message}`; }
  paused = false;
  await sync(true);
  return "";
}
