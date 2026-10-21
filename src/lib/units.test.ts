import { describe, it, expect } from "vitest";
import { computeUnitStats, completedUnitIds, pickRandomUnit, shuffleOptions } from "./units";

const units = [{ id: "u1", name: "النحو" }, { id: "u2", name: "البلاغة" }];
const qs = [{ id: "a", unit_id: "u1" }, { id: "b", unit_id: "u1" }, { id: "c", unit_id: "u2" }];

describe("units", () => {
  it("unit is completed only when every question was answered once", () => {
    const s = computeUnitStats(units, qs, [{ question_id: "a", is_correct: true, created_at: "1" }, { question_id: "c", is_correct: false, created_at: "1" }]);
    expect(s.find((x) => x.id === "u1")!.status).toBe("progress");
    expect(s.find((x) => x.id === "u2")!.status).toBe("done");
    expect(completedUnitIds(s)).toEqual(["u2"]);
  });
  it("new units are offered nothing in the test page", () => {
    expect(completedUnitIds(computeUnitStats(units, qs, []))).toEqual([]);
  });
  it("random unit picks from the list", () => {
    const s = computeUnitStats(units, qs, []);
    expect(pickRandomUnit(s, () => 0)!.id).toBe("u1");
    expect(pickRandomUnit([], () => 0)).toBeNull();
  });
  it("shuffled options keep the correct answer", () => {
    const q = { id: "q", unit_id: "u1", question_text: "?", options: ["x", "y", "z"], correct_index: 1, topic_area: null };
    const r = shuffleOptions(q, () => 0);
    expect(r.options[r.correct_index]).toBe("y");
  });
  it("best score is the highest single-unit run, multi-unit tests ignored", () => {
    const runs = [
      { unit_ids: ["u1"], total: 4, correct: 2 },
      { unit_ids: ["u1"], total: 4, correct: 3 },
      { unit_ids: ["u1", "u2"], total: 2, correct: 2 },
    ];
    const s = computeUnitStats(units, qs, [], runs);
    expect(s.find((x) => x.id === "u1")!.best).toBe(75);
    expect(s.find((x) => x.id === "u2")!.best).toBeNull();
  });
});
