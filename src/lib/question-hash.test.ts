import { expect, it } from "vitest";
import { questionHash } from "./question-hash";

it("deduplicates the same question regardless of whitespace", async () => {
  expect(await questionHash({ question: "من  الشاعر؟", options: [" عنترة ", "زهير"] })).toBe(await questionHash({ question: "من الشاعر؟", options: ["عنترة", "زهير"] }));
});
it("updates the duplicate key when question content changes", async () => {
  expect(await questionHash({ question: "من الشاعر؟", options: ["عنترة", "زهير"] })).not.toBe(await questionHash({ question: "من الكاتب؟", options: ["عنترة", "زهير"] }));
});