import { test, expect } from "bun:test";
import { frame, drawn, vkOf } from "../browser";

test("a browser card gets the next frame only once it drew the last one, and then the newest", () => {
  const got: number[] = [], sub = { out: (m: string | Uint8Array) => got.push((m as Uint8Array)[0]), busy: 0 };
  const t = { subs: new Set([sub]) }, f = (n: number) => frame(t, new Uint8Array([n]));
  f(1); f(2); f(3);
  expect(got).toEqual([1]); // 2 and 3 wait; only the newest is kept
  drawn(sub);
  expect(got).toEqual([1, 3]);
  drawn(sub); f(4);
  expect(got).toEqual([1, 3, 4]);
});

// Key codes come from the physical key: from the character, "." was 46 (Delete) and "(" 40 (ArrowDown).
test("vkOf: punctuation, letters, digits and named keys", () => {
  expect(vkOf(".", "Period")).toBe(190);
  expect(vkOf("(", "Digit9")).toBe(57);
  expect(vkOf("%", "Digit5")).toBe(53);
  expect(vkOf("ç", "Semicolon")).toBe(186);
  expect(vkOf("a", "KeyA")).toBe(65);
  expect(vkOf("7", "Numpad7")).toBe(103);
  expect(vkOf("Enter", "Enter")).toBe(13);
  expect(vkOf("Delete", "Delete")).toBe(46);
  expect(vkOf("F5", "F5")).toBe(116);
});
