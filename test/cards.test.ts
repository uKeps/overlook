// Review cards (cards.ts): Review.md holds one `- question :: answer` line per card; Overlook adds the schedule in a
// comment, doubles it on each "remembered" and takes the card out once it passes two months. Every other line stays.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseFile, addCard, answerCard, removeCard, cardId } from "../cards";

const T = "2026-11-11";

test("a card's life: added, asked again, remembered, forgotten, known, removed", async () => {
  const file = `${mkdtempSync(`${tmpdir()}/overlook-cards-`)}/Review.md`;
  writeFileSync(file, "# Review\n\nmy own words\n\n- Written by hand? :: Yes [[HTTP]]\n");
  const [hand] = parseFile(readFileSync(file, "utf8"));
  expect(hand).toMatchObject({ q: "Written by hand?", a: "Yes [[HTTP]]", next: "", interval: 0 }); // no schedule yet: due now

  const c = await addCard(file, "Concorrência x paralelismo?", "Concorrência :: lidar com várias; <!-- paralelismo --> fazer várias ao mesmo tempo.", T);
  expect(c).toMatchObject({ id: cardId("concorrência x paralelismo?"), next: "2026-11-12", interval: 1, added: T });
  expect((c as any).a).toBe("Concorrência: lidar com várias; paralelismo fazer várias ao mesmo tempo."); // no separators sneak in
  expect(await addCard(file, "  ", "x", T)).toBe("question must be 1 to 300 characters");

  // the same question again: a new answer, the same place in the schedule, no second line
  await answerCard(file, (c as any).id, true, "2026-11-12");
  expect(await addCard(file, "Concorrência x paralelismo?", "Better answer.", "2026-11-13")).toMatchObject({ a: "Better answer.", interval: 2, next: "2026-11-14" });
  expect(parseFile(readFileSync(file, "utf8")).length).toBe(2);

  expect(await answerCard(file, (c as any).id, false, "2026-11-14")).toMatchObject({ interval: 1, next: "2026-11-15" });
  for (const i of [2, 4, 8, 16, 32, 64]) expect(await answerCard(file, (c as any).id, true, T)).toMatchObject(i > 60 ? { retired: true } : { interval: i });
  expect(parseFile(readFileSync(file, "utf8")).map((x) => x.q)).toEqual(["Written by hand?"]); // known: it left the file

  expect(await answerCard(file, hand.id, true, T)).toMatchObject({ interval: 1, next: "2026-11-12", added: T });
  expect(readFileSync(file, "utf8")).toContain("- Written by hand? :: Yes [[HTTP]] <!-- next 2026-11-12, every 1 d, added 2026-11-11 -->");
  expect(await removeCard(file, hand.id)).toBe(true);
  expect(await removeCard(file, hand.id)).toBe(false);
  expect(await answerCard(file, hand.id, true, T)).toBe("that card is gone (changed in Obsidian?): reload");
  expect(readFileSync(file, "utf8")).toBe("# Review\n\nmy own words\n");
});

test("a new file starts with a header that says what it is", async () => {
  const file = `${mkdtempSync(`${tmpdir()}/overlook-cards-`)}/Review.md`;
  await addCard(file, "What is REST?", "[[REST]]", T);
  const txt = readFileSync(file, "utf8");
  expect(txt.startsWith("# Review\n\n")).toBe(true);
  expect(parseFile(txt)).toEqual([expect.objectContaining({ q: "What is REST?", a: "[[REST]]", next: "2026-11-12" })]);
});
