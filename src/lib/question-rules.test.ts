import { describe, expect, it } from "vitest";
import { draftInputSchema, isReady, reviewInputSchema, suggestedAnswer, orderedReviewItems } from "./question-rules";

const input = { fileName: "questions.txt", fileType: "txt", topicHint: null, questions: [{ question: "من الشاعر؟", options: ["عنترة", "زهير"], correct: 0 }] };
const q = { options: ["عنترة", "زهير"], correct_index: 0, ai_flag: "clean" };
describe("question rules", () => {
  it("matches reordered AI verdicts to their input question", () => {
    expect(orderedReviewItems([{ i: 1, answer: "b" }, { i: 0, answer: "a" }], 2)).toEqual([{ i: 0, answer: "a" }, { i: 1, answer: "b" }]);
  });
  it("rejects incomplete, duplicate and invalid AI verdicts before saving", () => {
    expect(() => orderedReviewItems([{ i: 0 }], 2)).toThrow();
    expect(() => orderedReviewItems([{ i: 0 }, { i: 0 }], 2)).toThrow();
    expect(() => orderedReviewItems([{ i: 0 }, { i: 2 }], 2)).toThrow();
  });
  it("leaves wrong-answer decisions as drafts", () => expect(isReady({ ...q, ai_flag: "wrong_answer" })).toBe(false));
  it("leaves missing answers as drafts", () => expect(isReady({ ...q, correct_index: null, ai_flag: "no_answer" })).toBe(false));
  it("does not treat unreviewed questions as clean", () => expect(isReady({ ...q, ai_flag: null })).toBe(false));
  it("publishes answered clean questions", () => expect(isReady(q)).toBe(true));
  it("permits answered spelling suggestions", () => expect(isReady({ ...q, ai_flag: "suggestion" })).toBe(true));
  it("rejects out-of-range answers", () => expect(isReady({ ...q, correct_index: 2 })).toBe(false));
  it("requires a valid AI option before consent", () => {
    expect(suggestedAnswer({ ...q, ai_suggestion: { ai_index: 1 } })).toBe(1);
    expect(suggestedAnswer({ ...q, ai_suggestion: { ai_index: 2 } })).toBeNull();
    expect(suggestedAnswer({ ...q, ai_suggestion: { ai_index: 0.5 } })).toBeNull();
  });
  it("accepts at most 2000 questions per upload", () => {
    expect(draftInputSchema.safeParse({ ...input, questions: Array(2000).fill(input.questions[0]) }).success).toBe(true);
    expect(draftInputSchema.safeParse({ ...input, questions: Array(2001).fill(input.questions[0]) }).success).toBe(false);
  });
  it("requires multiple-choice options and a valid marked answer", () => {
    expect(draftInputSchema.safeParse(input).success).toBe(true);
    expect(draftInputSchema.safeParse({ ...input, questions: [{ ...input.questions[0], options: ["واحد"] }] }).success).toBe(false);
    expect(draftInputSchema.safeParse({ ...input, questions: [{ ...input.questions[0], correct: 2 }] }).success).toBe(false);
  });
  it("reviews at most 20 questions at once", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(reviewInputSchema.safeParse({ ids: Array(20).fill(id), topicHint: null }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ids: Array(21).fill(id), topicHint: null }).success).toBe(false);
  });
});