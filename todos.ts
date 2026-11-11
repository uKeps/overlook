// To-dos: one Markdown file at the vault root (Tasks.md; Tarefas.md in a Portuguese vault), in the Obsidian Tasks
// plugin's format, so Obsidian shows and edits them and agents can read and write them:
//   - [ ] Pagar o servidor ⏫ 🔁 every month ⏰ 09:00 📅 2026-11-15 🆔 k3x9qa
//       a note: the lines indented under a task
//   - [x] Pagar o servidor 🔁 every month 📅 2026-10-15 ✅ 2026-10-15 🆔 p0w2zd
// Every other line of the file is left as it is. ⏰ (a time) is Overlook's own: the Tasks plugin shows it as text.
// Dates are YYYY-MM-DD strings in the server's local time; `today` comes in, so these functions are pure and testable.

export type Todo = { id: string; text: string; done: boolean; due: string; time: string; repeat: string; prio: boolean; doneOn: string; note: string };
export type Parsed = { text: string; due: string; time: string; repeat: string; prio: boolean };

// ---------------------------------------------------------------- dates
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
// Same day of the month (or `dom`), clamped to the month's last day: Jan 31 + 1 month = Feb 28.
function addMonths(s: string, n: number, dom?: number) {
  const d = day(s), want = dom ?? d.getUTCDate();
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(want, last))));
}
const dow = (s: string) => day(s).getUTCDay();
// The next date on one of these weekdays: from `s` itself (strict = after it).
function nextWeekday(s: string, days: number[], strict = false) {
  for (let i = strict ? 1 : 0; i < 8; i++) { const d = addDays(s, i); if (days.includes(dow(d))) return d; }
  return addDays(s, 7);
}

// ---------------------------------------------------------------- recurrence
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// One step of a rule from `d`. Rules are the Tasks plugin's words: every day | every weekday | every 2 weeks |
// every week on Monday, Thursday | every month | every month on the 15th | every year. An unknown rule steps a day,
// so the task at least comes back tomorrow (and keeps its rule text for Obsidian).
function step(rule: string, d: string): string {
  const r = rule.toLowerCase().trim();
  if (r === "every weekday") return nextWeekday(d, [1, 2, 3, 4, 5], true);
  const on = r.match(/^every (?:(\d+) )?weeks? on ([a-z, ]+)$/);
  if (on) {
    const days = on[2].split(/[ ,]+/).map((w) => WEEKDAY_EN.findIndex((x) => x.toLowerCase() === w)).filter((i) => i >= 0);
    if (days.length) { const n = Number(on[1] || 1), next = nextWeekday(d, days, true); return n > 1 && dow(next) <= dow(d) ? addDays(next, 7 * (n - 1)) : next; }
  }
  const dom = r.match(/^every (?:(\d+) )?months? on the (\d{1,2})(?:st|nd|rd|th)?$/);
  if (dom) return addMonths(d, Number(dom[1] || 1), Number(dom[2]));
  const m = r.match(/^every (?:(\d+) )?(day|week|month|year)s?$/);
  if (m) {
    const n = Number(m[1] || 1);
    return m[2] === "day" ? addDays(d, n) : m[2] === "week" ? addDays(d, 7 * n) : m[2] === "month" ? addMonths(d, n) : addMonths(d, 12 * n);
  }
  return addDays(d, 1);
}
// The next due date after today, however late the last one was done (a daily task missed for a week comes back
// tomorrow, not seven times).
export function nextDue(rule: string, due: string, today: string) {
  let d = due || today;
  for (let i = 0; i < 4000 && d <= today; i++) d = step(rule, d);
  return d;
}
// The first date of a rule that starts now: today when today fits it.
function firstDue(rule: string, today: string) {
  const r = rule.toLowerCase();
  if (r === "every weekday") return nextWeekday(today, [1, 2, 3, 4, 5]);
  const on = r.match(/ on ([a-z, ]+)$/);
  if (on && !/the \d/.test(on[1])) { const days = on[1].split(/[ ,]+/).map((w) => WEEKDAY_EN.findIndex((x) => x.toLowerCase() === w)).filter((i) => i >= 0); if (days.length) return nextWeekday(today, days); }
  const dom = r.match(/on the (\d{1,2})/);
  if (dom) { const n = Number(dom[1]), here = addMonths(today, 0, n); return here >= today ? here : addMonths(today, 1, n); }
  return today;
}

// ---------------------------------------------------------------- typing a task: "revisar PR amanhã 9h toda segunda !"
// Portuguese and English, accents optional. What it understands comes out of the text; the rest is the task.
const WD = "(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
const wdIndex = (w: string) => {
  const f = w.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const pt = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"].indexOf(f);
  return pt >= 0 ? pt : WEEKDAY_EN.findIndex((x) => x.toLowerCase() === f);
};
const UNIT: Record<string, string> = { dia: "day", dias: "day", day: "day", days: "day", semana: "week", semanas: "week", week: "week", weeks: "week", mes: "month", "mês": "month", meses: "month", month: "month", months: "month" };
const unit = (u: string) => UNIT[u.toLowerCase()] ?? "day";

export function parseTask(input: string, today: string): Parsed {
  let s = ` ${input.replace(/\s+/g, " ").trim()} `;
  let due = "", time = "", repeat = "", prio = false;
  // Each rule takes its match out of the text (word-bounded: \b doesn't know accents, so spaces bound them).
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (!m) return false;
    fn(m);
    s = s.slice(0, m.index!) + " " + s.slice(m.index! + m[0].length);
    return true;
  };
  const W = (p: string) => new RegExp(`(?<=\\s)${p}(?=[\\s,.;!?]|$)`, "iu");
  // repetition
  take(W("(?:a cada|every) (\\d+) (dias?|semanas?|m[eê]s(?:es)?|days?|weeks?|months?)"), (m) => { repeat = `every ${m[1]} ${unit(m[2])}s`; });
  repeat || take(W("todo dia (\\d{1,2})"), (m) => { repeat = `every month on the ${Number(m[1])}`; });
  repeat || take(W("(?:todo dia [úu]til|todos os dias [úu]teis|(?:nos |em )?dias [úu]teis|every weekday|weekdays)"), () => { repeat = "every weekday"; });
  repeat || take(W("(?:todos os dias|todo dia|diariamente|every day|daily)"), () => { repeat = "every day"; });
  repeat || take(W(`(?:toda|todas as|todo|every) ${WD}s?(?:-feiras?)?`), (m) => { repeat = `every week on ${WEEKDAY_EN[wdIndex(m[1])]}`; });
  repeat || take(W("(?:toda semana|todas as semanas|semanalmente|every week|weekly)"), () => { repeat = "every week"; });
  repeat || take(W("(?:todo m[êe]s|todos os meses|mensalmente|every month|monthly)"), () => { repeat = "every month"; });
  repeat || take(W("(?:todo ano|todos os anos|anualmente|every year|yearly)"), () => { repeat = "every year"; });
  // date
  take(W("depois de amanh[ãa]"), () => { due = addDays(today, 2); })
    || take(W("(?:amanh[ãa]|tomorrow)"), () => { due = addDays(today, 1); })
    || take(W("(?:hoje|today|tonight)"), () => { due = today; })
    || take(W("(?:ontem|yesterday)"), () => { due = addDays(today, -1); }) // something already late
    || take(W("(?:(?:na )?semana que vem|(?:na )?pr[óo]xima semana|next week)"), () => { due = nextWeekday(today, [1], true); })
    || take(W("(?:(?:no )?m[êe]s que vem|(?:no )?pr[óo]ximo m[êe]s|next month)"), () => { due = addMonths(today, 1); })
    || take(W("(?:em|in|daqui a) (\\d{1,3}) (dias?|days?|semanas?|weeks?)"), (m) => { due = addDays(today, Number(m[1]) * (unit(m[2]) === "week" ? 7 : 1)); })
    || take(W("(\\d{4})-(\\d{2})-(\\d{2})"), (m) => { due = `${m[1]}-${m[2]}-${m[3]}`; })
    || take(W("(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?"), (m) => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
      const d = iso(new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]))));
      due = !m[3] && d < today ? iso(new Date(Date.UTC(y + 1, Number(m[2]) - 1, Number(m[1])))) : d; // a past dd/mm is next year's
    })
    || take(W("(?:dia|on the) (\\d{1,2})(?:st|nd|rd|th)?"), (m) => { const n = Number(m[1]), here = addMonths(today, 0, n); due = here >= today ? here : addMonths(today, 1, n); })
    || take(W(`(?:(n[ao]|nest[ae]|essa|esta|on|this|pr[óo]xim[ao]|next) )?${WD}(?:-feira)?`), (m) => {
      due = nextWeekday(today, [wdIndex(m[2])], /^(pr|next)/i.test(m[1] ?? ""));
    });
  // time
  const hm = (h: number, mi = 0) => { if (h < 24 && mi < 60) time = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`; };
  take(W("(?:[àa]s |at )?(\\d{1,2}):(\\d{2})"), (m) => hm(Number(m[1]), Number(m[2])))
    || take(W("(?:[àa]s )?(\\d{1,2})h(\\d{2})?"), (m) => hm(Number(m[1]), Number(m[2] || 0)))
    || take(W("(?:at )?(\\d{1,2})(?::(\\d{2}))? ?(am|pm)"), (m) => hm((Number(m[1]) % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0), Number(m[2] || 0)))
    || take(W("(?:[àa]s|at) (\\d{1,2})"), (m) => hm(Number(m[1])));
  // importance: a lone "!" (or "!!")
  take(/(?<=\s)!{1,3}(?=\s|$)/u, () => { prio = true; });
  let text = s.replace(/\s+/g, " ").trim().replace(/\s+(?:at|on|in|no|na|em|para|pra|até|ate|às|as)$/i, "").trim();
  if (!text) text = input.trim();
  if (repeat && !due) due = firstDue(repeat, today);
  if (time && !due) due = today;
  return { text, due, time, repeat, prio };
}

// ---------------------------------------------------------------- the file
const FIELDS = ["📅", "⏳", "🛫", "✅", "🆔", "⏫", "🔺", "🔼", "🔽", "🔁", "⏰", "➕", "❌"];
const STOPS = `(?=\\s*(?:${FIELDS.join("|")})|\\s*$)`;
const TASK = /^- \[([ xX])\] (.*)$/;
const field = (rest: string, e: string, v = "(\\d{4}-\\d{2}-\\d{2})") => rest.match(new RegExp(`${e}\\s*${v}`, "u"))?.[1] ?? "";
// A user's own line without 🆔: its id comes from its text, steady until the line changes; editing it writes the id in.
const lineId = (l: string) => `h${Bun.hash(l).toString(36).slice(0, 8)}`;

function readLine(l: string, note: string): Todo | null {
  const m = l.match(TASK);
  if (!m) return null;
  const rest = m[2];
  const repeat = rest.match(new RegExp(`🔁\\s*(.+?)${STOPS}`, "u"))?.[1].trim() ?? "";
  const text = rest.replace(new RegExp(`🔁\\s*.+?${STOPS}`, "u"), "")
    .replace(new RegExp(`(?:📅|⏳|🛫|✅|➕|❌)\\s*\\d{4}-\\d{2}-\\d{2}|⏰\\s*\\d{2}:\\d{2}|🆔\\s*[\\w-]+|⏫|🔺|🔼|🔽`, "gu"), "").replace(/\s+/g, " ").trim();
  return {
    id: field(rest, "🆔", "([\\w-]+)") || lineId(l), text, done: m[1] !== " ",
    due: field(rest, "📅") || field(rest, "⏳"), time: field(rest, "⏰", "(\\d{2}:\\d{2})"), repeat,
    prio: /⏫|🔺/u.test(rest), doneOn: field(rest, "✅"), note,
  };
}
export const formatLine = (t: Todo) => `- [${t.done ? "x" : " "}] ${t.text}${t.prio ? " ⏫" : ""}${t.repeat ? ` 🔁 ${t.repeat}` : ""}${t.time ? ` ⏰ ${t.time}` : ""}${t.due ? ` 📅 ${t.due}` : ""}${t.doneOn ? ` ✅ ${t.doneOn}` : ""} 🆔 ${t.id}`;
const noteLines = (note: string) => (note.trim() ? note.trim().split("\n").map((l) => `    ${l.trimEnd()}`) : []);

// The file as lines, with where each task (and the note lines under it) sits.
function scan(txt: string) {
  const lines = txt.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const at: { todo: Todo; start: number; end: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!TASK.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && /^(\s{2,}|\t)\S/.test(lines[j])) j++;
    const note = lines.slice(i + 1, j).map((l) => l.replace(/^(\s{4}|\t|\s{2})/, "")).join("\n");
    at.push({ todo: readLine(lines[i], note)!, start: i, end: j });
    i = j - 1;
  }
  return { lines, at };
}
export const parseFile = (txt: string) => scan(txt).at.map((x) => x.todo);

const HEAD = ["# Tasks", "", "Overlook's to-do list, in the Obsidian Tasks format: `- [ ] what 🔁 every day 📅 2026-11-12`. Overlook reads and writes this file; edit it here too.", ""];
export const newId = () => Math.random().toString(36).slice(2, 8);
// What a task may hold: one line of text without the field markers, real dates and times, a rule in plain words.
export function clean(p: Partial<Todo>): Partial<Todo> | string {
  const o: Partial<Todo> = {};
  if (p.text !== undefined) {
    const t = String(p.text).replace(new RegExp(FIELDS.join("|"), "gu"), "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 300) return "text must be 1 to 300 characters";
    o.text = t;
  }
  if (p.due !== undefined) { if (p.due && (!/^\d{4}-\d{2}-\d{2}$/.test(p.due) || isNaN(Date.parse(p.due)))) return "due must be YYYY-MM-DD"; o.due = p.due || ""; }
  if (p.time !== undefined) { if (p.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) return "time must be HH:MM"; o.time = p.time || ""; }
  if (p.repeat !== undefined) { if (p.repeat && !/^every [a-z0-9 ,]{1,50}$/i.test(p.repeat)) return "repeat must read like 'every week'"; o.repeat = p.repeat || ""; }
  if (p.note !== undefined) { if (String(p.note).length > 2000) return "note is too long"; o.note = String(p.note); }
  if (p.prio !== undefined) o.prio = !!p.prio;
  if (p.done !== undefined) o.done = !!p.done;
  return o;
}

// One write at a time: two quick clicks must not read the same file and lose each other's change.
let queue: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => { const r = queue.then(fn, fn); queue = r.catch(() => {}); return r; };

export async function readTodos(path: string): Promise<Todo[]> {
  const f = Bun.file(path);
  return (await f.exists()) ? parseFile(await f.text()) : [];
}
async function load(path: string) { const f = Bun.file(path); return scan((await f.exists()) ? await f.text() : HEAD.join("\n")); }
const save = (path: string, lines: string[]) => Bun.write(path, lines.join("\n") + "\n");

export const addTodo = (path: string, text: string, today: string) => locked(async () => {
  const p = parseTask(text, today), c = clean({ text: p.text });
  if (typeof c === "string") return c;
  const { lines } = await load(path);
  const t: Todo = { id: newId(), text: c.text!, done: false, due: p.due, time: p.time, repeat: p.repeat, prio: p.prio, doneOn: "", note: "" };
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length && !TASK.test(lines[lines.length - 1]) && !/^\s/.test(lines[lines.length - 1])) lines.push(""); // a blank line after text
  lines.push(formatLine(t));
  await save(path, lines);
  return t;
});

// Edit, complete or reopen a task. Completing a repeating one keeps it (same id) at its next date and leaves a done
// copy behind, as the Tasks plugin does.
export const editTodo = (path: string, id: string, patch: Partial<Todo>, today: string) => locked(async () => {
  const c = clean(patch);
  if (typeof c === "string") return c;
  const { lines, at } = await load(path);
  const hit = at.find((x) => x.todo.id === id);
  if (!hit) return "that task is gone (changed in Obsidian?): reload";
  const t: Todo = { ...hit.todo, ...c };
  if (c.done === false && hit.todo.done) t.repeat = ""; // a reopened copy of a repeating task is a one-off: the series lives on in its open line
  const out: string[] = [];
  if (c.done === true && !hit.todo.done && t.repeat) {
    out.push(formatLine({ ...t, done: false, due: nextDue(t.repeat, hit.todo.due, today) }), ...noteLines(t.note));
    out.push(formatLine({ ...t, id: newId(), done: true, doneOn: today }));
  } else {
    t.doneOn = t.done ? hit.todo.doneOn || today : "";
    out.push(formatLine(t), ...noteLines(t.note));
  }
  lines.splice(hit.start, hit.end - hit.start, ...out);
  await save(path, lines);
  return t;
});

export const deleteTodo = (path: string, id: string) => locked(async () => {
  const { lines, at } = await load(path);
  const hit = at.find((x) => x.todo.id === id);
  if (!hit) return false;
  lines.splice(hit.start, hit.end - hit.start);
  await save(path, lines);
  return true;
});
