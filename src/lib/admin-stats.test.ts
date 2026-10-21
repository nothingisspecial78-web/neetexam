import { describe, expect, it } from "vitest";
import { activeCounts, dailyCounts, toCsv } from "./admin-stats";

const now = Date.parse("2026-10-21T12:00:00Z");
const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600e3).toISOString();

describe("admin stats", () => {
  it("counts distinct active users per window", () => {
    const ev = [
      { user_id: "a", at: h(1) }, { user_id: "a", at: h(2) },
      { user_id: "b", at: h(48) }, { user_id: "c", at: h(24 * 20) },
    ];
    expect(activeCounts(ev, now)).toEqual({ today: 1, week: 2, month: 3 });
  });
  it("daily active users counts each user once per day", () => {
    const ev = [{ user_id: "a", at: h(1) }, { user_id: "a", at: h(2) }, { user_id: "b", at: h(3) }];
    const d = dailyCounts(ev, 3, now, true);
    expect(d).toHaveLength(3);
    expect(d[2]).toEqual({ day: "2026-10-21", count: 2 });
  });
  it("csv escapes quotes", () => {
    expect(toCsv([{ a: 'x"y' }])).toBe('a\n"x""y"');
  });
});
