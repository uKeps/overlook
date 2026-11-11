// The to-do list's own logic (todos.ts): reading a typed line, the next date of a repeat, and the Tasks.md file, whose
// other lines must survive every write. 2026-11-11 is a Wednesday.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseTask, nextDue, parseFile, formatLine, addTodo, editTodo, deleteTodo } from "../todos";

const T = "2026-11-11";

test("a typed line: dates, times, repeats and importance come out of the text (pt and en)", () => {
  const cases: [string, object][] = [
    ["revisar PR amanhã 9h toda segunda", { text: "revisar PR", due: "2026-11-12", time: "09:00", repeat: "every week on Monday" }],
    ["tomar remédio todo dia 8h", { text: "tomar remédio", due: T, time: "08:00", repeat: "every day" }], // not "the 8th of every month"
    ["pagar o servidor dia 15 todo mês !", { text: "pagar o servidor", due: "2026-11-15", repeat: "every month", prio: true }],
    ["ligar pro fornecedor sexta", { text: "ligar pro fornecedor", due: "2026-11-13", repeat: "" }],
    ["relatório dias úteis", { text: "relatório", due: T, repeat: "every weekday" }],
    ["call mom next friday at 6pm", { text: "call mom", due: "2026-11-13", time: "18:00" }],
    ["a cada 2 dias regar plantas", { text: "regar plantas", due: T, repeat: "every 2 days" }],
    ["01/02 renovar domínio", { text: "renovar domínio", due: "2027-02-01" }], // a past dd/mm is next year's
    ["reunião às 14:30 na quinta-feira", { text: "reunião", due: "2026-11-12", time: "14:30" }],
    ["Responder o Guilherme #vps hoje !!", { text: "Responder o Guilherme #vps", due: T, prio: true }],
    ["comprar pão", { text: "comprar pão", due: "", time: "", repeat: "", prio: false }],
  ];
  for (const [line, want] of cases) expect([line, parseTask(line, T)]).toEqual([line, expect.objectContaining(want)]);
});

test("a repeat's next date is after today, however late it was done", () => {
  expect(nextDue("every day", "2026-11-05", T)).toBe("2026-11-12");
  expect(nextDue("every weekday", "2026-11-13", "2026-11-13")).toBe("2026-11-16"); // Friday -> Monday
  expect(nextDue("every week on Monday", "2026-11-09", T)).toBe("2026-11-16");
  expect(nextDue("every month", "2026-01-31", "2026-01-31")).toBe("2026-02-28"); // clamped to the month
  expect(nextDue("every month on the 15", "2026-11-15", "2026-11-15")).toBe("2026-12-15");
  expect(nextDue("every 2 weeks", T, T)).toBe("2026-11-25");
});

test("Tasks.md: tasks are read and written in the Obsidian Tasks format; every other line stays", async () => {
  const own = "- [ ] Pagar o servidor ⏫ 🔁 every month 📅 2026-11-15 🆔 abc123";
  const file = `${mkdtempSync(`${tmpdir()}/overlook-todos-`)}/Tasks.md`;
  writeFileSync(file, `# Tasks\n\nmy own words\n\n${own}\n    nota um\n- [x] Feito ✅ 2026-11-10\nOther text\n`);
  const [a, b] = parseFile(readFileSync(file, "utf8"));
  expect(a).toMatchObject({ id: "abc123", text: "Pagar o servidor", prio: true, repeat: "every month", due: "2026-11-15", note: "nota um", done: false });
  expect(b).toMatchObject({ text: "Feito", done: true, doneOn: "2026-11-10" });
  expect(b.id).toMatch(/^h/); // a line written by hand gets an id from its text
  expect(formatLine(a)).toBe(own);

  // Completing a repeating task: it moves to its next date (same id) and leaves a done copy.
  await editTodo(file, "abc123", { done: true }, "2026-11-15");
  const txt = readFileSync(file, "utf8");
  expect(txt).toContain("my own words");
  expect(txt).toContain("Other text");
  const after = parseFile(txt);
  expect(after.find((t) => t.id === "abc123")).toMatchObject({ done: false, due: "2026-12-15", note: "nota um" });
  expect(after.find((t) => t.done && t.doneOn === "2026-11-15")).toMatchObject({ text: "Pagar o servidor", repeat: "every month" });

  const added = await addTodo(file, "ligar pro fornecedor amanhã", T);
  expect(added).toMatchObject({ text: "ligar pro fornecedor", due: "2026-11-12" });
  expect(await editTodo(file, (added as any).id, { text: "x 📅 2020-01-01" }, T)).toMatchObject({ text: "x 2020-01-01" }); // no field markers sneak in
  expect(await editTodo(file, (added as any).id, { due: "tomorrow" }, T)).toBe("due must be YYYY-MM-DD");
  expect(await deleteTodo(file, (added as any).id)).toBe(true);
  expect(parseFile(readFileSync(file, "utf8")).some((t) => t.id === (added as any).id)).toBe(false);
});
