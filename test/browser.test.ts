import { test, expect } from "bun:test";
import { frame, drawn } from "../browser";

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
