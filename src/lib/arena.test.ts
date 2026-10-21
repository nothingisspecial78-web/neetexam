import { describe, expect, it } from "vitest";
import { creditPoints, decideWinner, DURATIONS } from "./arena";

const s = (correct: number, wrong: number, lastAt: string | null = null) => ({ correct, wrong, lastAt });

it("friend challenges allow one minute only", () => {
  expect(DURATIONS).toEqual([60]);
});

describe("decideWinner", () => {
  it("more correct answers wins", () => {
    expect(decideWinner(s(5, 9), s(4, 0))).toBe("a");
  });
  it("tie on correct: fewer wrong wins", () => {
    expect(decideWinner(s(4, 3), s(4, 1))).toBe("b");
  });
  it("then whoever reached the final correct answer first", () => {
    expect(decideWinner(s(4, 1, "2026-01-01T00:00:30Z"), s(4, 1, "2026-01-01T00:00:20Z"))).toBe("b");
  });
  it("otherwise a draw", () => {
    expect(decideWinner(s(3, 1, "2026-01-01T00:00:20Z"), s(3, 1, "2026-01-01T00:00:20Z"))).toBeNull();
    expect(decideWinner(s(0, 0), s(0, 0))).toBeNull();
  });
});

describe("creditPoints", () => {
  it("a shutout moves 50", () => expect(creditPoints(10, 0, 100)).toBe(50));
  it("half margin moves 30", () => expect(creditPoints(10, 5, 100)).toBe(30));
  it("equal correct (won on tie-break) moves 10", () => expect(creditPoints(4, 4, 100)).toBe(10));
  it("loser cannot go below 0", () => {
    expect(creditPoints(10, 0, 7)).toBe(7);
    expect(creditPoints(10, 0, 0)).toBe(0);
  });
});
