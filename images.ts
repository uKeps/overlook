// The images behind the Home cards: the Pinterest board (pinterest.ts) and a folder of the user's own photos.
// What the user picks in the Images page (the folder, hide, star, fixed order, an image per card) is saved in
// pinterest.json, next to the board.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pinImages, pinFile, pinterestState, resync, magick } from "./pinterest";

const DIR = import.meta.dir;
const CONFIG = `${DIR}/pinterest.json`;
const CACHE = `${DIR}/cache/folder`;
const ID = /^[0-9a-z]{1,64}$/;
const PHOTO = /\.(jpe?g|png|webp|avif)$/i;
type Img = { id: string; source: "pinterest" | "folder"; link: string; title: string };
type Prefs = { board: string; folder: string; mode: "random" | "fixed"; hidden: string[]; starred: string[]; cards: Record<string, string> };

const readConfig = (): Record<string, any> => { try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; } };
const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i) => typeof i === "string" && ID.test(i)) : []);
function prefs(): Prefs {
  const c = readConfig();
  const cards = Object.fromEntries(Object.entries(c.cards ?? {}).filter(([, v]) => typeof v === "string" && ID.test(v))) as Record<string, string>;
  return { board: String(c.board ?? ""), folder: String(c.folder ?? ""), mode: c.mode === "fixed" ? "fixed" : "random", hidden: ids(c.hidden), starred: ids(c.starred), cards };
}

// ---------------------------------------------------------------- the user's folder
// ponytail: top level of one folder, listed on every call; recurse or cache the listing if folders get huge.
const expand = (p: string) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
const folderSetting = () => prefs().folder || process.env.ART_DIR || ""; // ART_DIR: the old wallpaper fallback, still honoured
// "u" can't start a Pinterest id (those are hex or digits), so a folder photo is never mistaken for a pin.
const folderId = (path: string) => "u" + createHash("sha1").update(path).digest("hex").slice(0, 15);
function folderImages() {
  const f = folderSetting();
  if (!f) return [];
  const dir = expand(f);
  try {
    return readdirSync(dir).filter((n) => PHOTO.test(n) && !n.startsWith(".")).sort()
      .map((n) => ({ id: folderId(`${dir}/${n}`), source: "folder" as const, link: "", title: n.replace(/\.\w+$/, ""), file: `${dir}/${n}` }));
  } catch { return []; }
}

const allImages = (): Img[] => [
  ...folderImages().map(({ file, ...i }) => i),
  ...pinImages().map((p) => ({ id: p.id, source: "pinterest" as const, link: p.link, title: p.title })),
];

export function setPrefs(b: any) {
  const c = readConfig(), next: Record<string, unknown> = {};
  if (b.mode !== undefined) { if (b.mode !== "random" && b.mode !== "fixed") return "mode must be random or fixed"; next.mode = b.mode; }
  for (const k of ["hidden", "starred"]) if (b[k] !== undefined) {
    if (!Array.isArray(b[k]) || b[k].length > 5000 || ids(b[k]).length !== b[k].length) return `${k} must be a list of image ids`;
    next[k] = [...new Set(b[k] as string[])];
  }
  // cards: { "<card key>": "<image id>" } picks the image of one Home card; null puts the card back on automatic.
  if (b.cards !== undefined) {
    if (typeof b.cards !== "object" || b.cards === null || Array.isArray(b.cards)) return "cards must map a card to an image id";
    const cards = { ...prefs().cards };
    for (const [k, v] of Object.entries(b.cards)) {
      if (!k || k.length > 300) return "card key too long";
      if (v === null) delete cards[k];
      else if (typeof v === "string" && ID.test(v)) { delete cards[k]; cards[k] = v; }
      else return "cards must map a card to an image id";
    }
    next.cards = Object.fromEntries(Object.entries(cards).slice(-200)); // the most recent 200 choices
  }
  if (b.board !== undefined) {
    const board = String(b.board).trim().replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    if (board && !/^[\w%. -]{1,100}(\/[\w%. -]{1,100})?$/.test(board)) return "board must be user/board (public) or a board name";
    next.board = board;
  }
  if (b.folder !== undefined) {
    const folder = String(b.folder).trim();
    if (folder) {
      const abs = expand(folder);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return `no folder at ${folder}`;
    }
    next.folder = folder;
  }
  writeFileSync(CONFIG, JSON.stringify({ ...c, ...next }, null, 1));
  if (next.board !== undefined && next.board !== c.board) resync(); // a new board: fetch it now
  return imagesState();
}

// The images the cards use, in order, and the ones the user gave to specific cards.
export function shownImages() {
  const p = prefs(), all = allImages(), visible = all.filter((i) => !p.hidden.includes(i.id));
  const starred = p.mode === "fixed" ? p.starred.map((id) => visible.find((i) => i.id === id)).filter((i): i is Img => !!i) : [];
  const cards = Object.fromEntries(Object.entries(p.cards).flatMap(([k, id]) => { const i = all.find((x) => x.id === id); return i ? [[k, i]] : []; }));
  return { mode: starred.length ? "fixed" : "random", pins: starred.length ? starred : visible, cards };
}

export function imagesState() {
  const pin = pinterestState(), folder = folderSetting();
  return {
    ...prefs(), folder, folderOk: !folder || existsSync(expand(folder)), images: allImages(),
    pinterest: { board: pin.board, status: pin.status, error: pin.error, syncing: pin.syncing, last: pin.last, total: pin.total },
  };
}

// A folder photo at a size for its use: "" (1800 px, for the card), "thumb" (480 px, for grids), "amb" (tiny and
// blurred, for the background). Made once with ImageMagick, redone when the photo changes; without it, the original.
export async function imageFile(id: string, variant: "" | "amb" | "thumb" = "") {
  if (!ID.test(id)) return null;
  if (!id.startsWith("u")) return pinFile(id, variant);
  const src = folderImages().find((i) => i.id === id)?.file;
  if (!src) return null;
  const out = `${CACHE}/${id}-${variant || "full"}.jpg`;
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs) {
    mkdirSync(CACHE, { recursive: true });
    const args = variant === "amb" ? ["-resize", "160x160>", "-blur", "0x5", "-modulate", "50,135"] : ["-resize", variant ? "480x480>" : "1800x1800>"];
    if (!magick([`${src}[0]`, "-auto-orient", ...args, "-quality", "80", out])) return Bun.file(src);
  }
  return Bun.file(out);
}
