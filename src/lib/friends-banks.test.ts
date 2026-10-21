import { describe, it, expect } from "vitest";
import { combineBanks, computeUnitStats } from "./units";
import { isOnline } from "./presence";

const me = "me", fr = "fr";
const names = new Map([[fr, "سارة"]]);
const units = [
  { id: "m-nahw", name: "النحو", owner_id: me, topic_area: "النحو" },
  { id: "f-nahw", name: "النحو", owner_id: fr, topic_area: "النحو" },
  { id: "f-bal", name: "البلاغة", owner_id: fr, topic_area: "البلاغة" },
];
const q = (id: string, owner: string, unit: string, hash: string) =>
  ({ id, owner_id: owner, unit_id: unit, content_hash: hash, question_text: id, options: ["a", "b"], correct_index: 0, topic_area: null });

describe("friends' shared banks", () => {
  it("friend questions join my unit of the same topic, one topic per unit", () => {
    const r = combineBanks(me, units, [q("m1", me, "m-nahw", "h1"), q("f1", fr, "f-nahw", "h2"), q("f2", fr, "f-bal", "h3")], names);
    expect(r.units.map((u) => u.id).sort()).toEqual(["f-bal", "m-nahw"]);
    expect(r.questions.filter((x) => x.unit_id === "m-nahw").map((x) => x.id).sort()).toEqual(["f1", "m1"]);
    expect(r.units.find((u) => u.id === "f-bal")!.owner_name).toBe("سارة");
    expect(r.questions.find((x) => x.id === "f1")!.from_name).toBe("سارة");
    expect(r.questions.find((x) => x.id === "m1")!.from_name).toBeNull();
  });
  it("duplicate questions across banks are merged, keeping mine", () => {
    const r = combineBanks(me, units, [q("f1", fr, "f-nahw", "same"), q("m1", me, "m-nahw", "same")], names);
    expect(r.questions.map((x) => x.id)).toEqual(["m1"]);
  });
  it("after removing a friend their questions leave my units", () => {
    // RLS stops returning the ex-friend's units and questions.
    const r = combineBanks(me, units.filter((u) => u.owner_id === me), [q("m1", me, "m-nahw", "h1")], new Map());
    const s = computeUnitStats(r.units, r.questions, []);
    expect(s).toHaveLength(1);
    expect(s[0]!.total).toBe(1);
  });
  it("only friends with mutual sharing allowed join my units", () => {
    // When allowedFriendIds does not contain fr:
    const withoutPerm = combineBanks(
      me,
      units,
      [q("m1", me, "m-nahw", "h1"), q("f1", fr, "f-nahw", "h2")],
      names,
      new Set(), // no mutual permission
    );
    expect(withoutPerm.questions.map((x) => x.id)).toEqual(["m1"]);
    expect(withoutPerm.units.map((u) => u.id)).toEqual(["m-nahw"]);

    // When allowedFriendIds contains fr:
    const withPerm = combineBanks(
      me,
      units,
      [q("m1", me, "m-nahw", "h1"), q("f1", fr, "f-nahw", "h2")],
      names,
      new Set([fr]), // mutual permission active
    );
    expect(withPerm.questions.map((x) => x.id).sort()).toEqual(["f1", "m1"]);
  });
  it("online means seen within 5 minutes", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(isOnline("2026-10-20T11:56:00Z", now)).toBe(true);
    expect(isOnline("2026-10-20T11:54:00Z", now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
  });
});
