import { describe, it, expect } from "vitest";
import {
  buildDashboard,
  defaultFilters,
  studyStreak,
  rangeStart,
  competitionStats,
  creditDelta,
  type DashboardData,
  type DMatch,
} from "./dashboard";
const now = new Date("2026-10-21T12:00:00Z");
const base: DashboardData = {
  questions: [
    {
      id: "q",
      unit_id: "u",
      owner_id: "me",
      content_hash: "hash",
      topic_area: "بلاغة",
      created_at: "2026-10-01",
      status: "active",
    },
  ],
  units: [{ id: "u", name: "بلاغة", topic_area: "بلاغة", owner_id: "me" }],
  answers: [],
  runs: [],
  matches: [],
  credits: [],
  arena: null,
  friends: [],
};
const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    question_id: "q",
    is_correct: i < 8,
    time_ms: 2000,
    mode: "practice",
    created_at: "2026-10-21T01:00:00Z",
  }));
describe("dashboard rules", () => {
  it("requires 20 answers for weakest-topic recommendation", () => {
    expect(
      buildDashboard({ ...base, answers: rows(19) }, "me", defaultFilters, now).recommendations,
    ).toHaveLength(0);
    expect(
      buildDashboard({ ...base, answers: rows(20) }, "me", defaultFilters, now).recommendations[0]
        ?.text,
    ).toContain("40٪");
  });
  it("last 7 days begins at midnight six days earlier", () => {
    expect(rangeStart("7", now)).toBe(Date.parse("2026-10-15T00:00:00Z"));
  });
  it("last 30 days begins at midnight 29 days earlier", () => {
    expect(rangeStart("30", now)).toBe(Date.parse("2026-09-22T00:00:00Z"));
  });
  it("counts consecutive study days once each, allowing yesterday", () => {
    expect(studyStreak(["2026-10-20", "2026-10-20", "2026-10-19"], now)).toBe(2);
    expect(studyStreak(["2026-10-19"], now)).toBe(0);
  });
  it("filters mode and unit", () => {
    expect(
      buildDashboard({ ...base, answers: rows(20) }, "me", { ...defaultFilters, mode: "test" }, now)
        .accuracy,
    ).toBeNull();
    expect(
      buildDashboard(
        { ...base, answers: rows(20) },
        "me",
        { ...defaultFilters, unit: "other" },
        now,
      ).answers,
    ).toHaveLength(0);
  });
  it("calculates seconds and mistakes", () => {
    const d = buildDashboard({ ...base, answers: rows(20) }, "me", defaultFilters, now);
    expect(d.seconds).toBe(2);
    expect(d.mistakes[0]?.count).toBe(12);
    expect(d.completed).toBe(1);
  });
  it("inactivity reminder starts at 3 days", () => {
    expect(
      buildDashboard(
        {
          ...base,
          answers: [
            {
              question_id: "q",
              is_correct: true,
              time_ms: 2000,
              mode: "practice",
              created_at: "2026-10-18T12:00:00Z",
            },
          ],
        },
        "me",
        defaultFilters,
        now,
      ).recommendations[0]?.text,
    ).toContain("3");
  });
  it("competition score is one minute only and credit transfer is signed", () => {
    const m: DMatch = {
      id: "m",
      player_a: "me",
      a_name: null,
      b_name: null,
      a_correct: 4,
      b_correct: 3,
      a_wrong: 1,
      b_wrong: 0,
      winner_id: "me",
      points: 10,
      duration_s: 60,
      created_at: "2026-10-21",
    };
    expect(creditDelta(m, "me")).toBe(10);
    expect(creditDelta(m, "other")).toBe(-10);
    expect(creditDelta({ ...m, winner_id: null }, "me")).toBe(0);
    expect(
      competitionStats(
        [
          m,
          { ...m, winner_id: null },
          { ...m, winner_id: "other", duration_s: 120, a_correct: 50 },
        ],
        "me",
      ),
    ).toEqual({ wins: 1, draws: 1, losses: 1, winRate: 33, best: 4 });
  });
});
