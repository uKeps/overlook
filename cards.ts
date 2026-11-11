// Review cards (Review.md, Revisão.md in a Portuguese vault): one line per thing you asked or learned, back in
// 1, 2, 4… days until you know it, then it leaves the file. An agent (or you, in Obsidian) writes `- question :: answer`;
// Overlook adds the schedule in a comment the reading view hides. Every other line of the file stays.
import { addDays } from "./todos";

export type Card = { id: string; q: string; a: string; next: string; interval: number; added: string };
const LINE = /^- (.+?) :: (.*?)\s*(?:<!--\s*next (\d{4}-\d{2}-\d{2}), every (\d+) d, added (\d{4}-\d{2}-\d{2})\s*-->)?\s*$/;
export const RETIRE = 60; // remembered with an interval past this many days: you know it, the card goes
export const cardId = (q: string) => `c${Bun.hash(q.trim().toLowerCase()).toString(36).slice(0, 8)}`;

function readLine(l: string): Card | null {
  const m = l.match(LINE);
  // a line written by hand has no schedule yet: it is due now
  return m && { id: cardId(m[1]), q: m[1].trim(), a: m[2].trim(), next: m[3] ?? "", interval: Number(m[4]) || 0, added: m[5] ?? "" };
}
export const formatLine = (c: Card) => `- ${c.q} :: ${c.a}${c.next ? ` <!-- next ${c.next}, every ${c.interval} d, added ${c.added || c.next} -->` : ""}`;
export const parseFile = (txt: string) => txt.replace(/\r\n/g, "\n").split("\n").map(readLine).filter((c): c is Card => !!c);

// One line each, without the separators the line format uses.
const flat = (s: unknown) => String(s ?? "").replace(/<!--|-->/g, "").replace(/\s*::\s*/g, ": ").replace(/\s+/g, " ").trim();

const HEAD = ["# Review", "", "What you asked and learned, back in 1, 2, 4… days until you know it (then it leaves this file). One line each: `- question :: answer [[note]]`. Overlook reads and writes this file; edit it here too.", ""];
let queue: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => { const r = queue.then(fn, fn); queue = r.catch(() => {}); return r; };
async function load(path: string) { const f = Bun.file(path); return ((await f.exists()) ? await f.text() : HEAD.join("\n")).replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n"); }
const save = (path: string, lines: string[]) => Bun.write(path, lines.join("\n").replace(/\n+$/, "") + "\n"); // no blank tail once the last card goes
const find = (lines: string[], id: string) => lines.findIndex((l) => readLine(l)?.id === id);

export async function readCards(path: string): Promise<Card[]> {
  const f = Bun.file(path);
  return (await f.exists()) ? parseFile(await f.text()) : [];
}

// Asking the same question again replaces its answer and keeps its schedule.
export const addCard = (path: string, q: unknown, a: unknown, today: string) => locked(async () => {
  const c: Card = { id: "", q: flat(q), a: flat(a), next: addDays(today, 1), interval: 1, added: today };
  if (!c.q || c.q.length > 300) return "question must be 1 to 300 characters";
  if (c.a.length > 600) return "answer must be at most 600 characters";
  c.id = cardId(c.q);
  const lines = await load(path), i = find(lines, c.id);
  if (i >= 0) { const old = readLine(lines[i])!; Object.assign(c, { next: old.next || c.next, interval: old.interval || 1, added: old.added || today, a: c.a || old.a }); lines[i] = formatLine(c); }
  else { if (lines.at(-1)?.trim() && !readLine(lines.at(-1)!)) lines.push(""); lines.push(formatLine(c)); } // a blank line after text
  await save(path, lines);
  return c;
});

// Remembered doubles the interval (past RETIRE days the card leaves the file); forgot brings it back tomorrow.
export const answerCard = (path: string, id: string, remembered: boolean, today: string) => locked(async () => {
  const lines = await load(path), i = find(lines, id);
  if (i < 0) return "that card is gone (changed in Obsidian?): reload";
  const c = readLine(lines[i])!;
  c.interval = remembered ? Math.max(1, c.interval * 2) : 1;
  if (remembered && c.interval > RETIRE) { lines.splice(i, 1); await save(path, lines); return { ...c, next: "", retired: true }; }
  c.next = addDays(today, c.interval); c.added ||= today;
  lines[i] = formatLine(c);
  await save(path, lines);
  return c;
});

export const removeCard = (path: string, id: string) => locked(async () => {
  const lines = await load(path), i = find(lines, id);
  if (i < 0) return false;
  lines.splice(i, 1);
  await save(path, lines);
  return true;
});
