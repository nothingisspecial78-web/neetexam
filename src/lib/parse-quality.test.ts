import { describe, expect, it } from "vitest";
import { parseQuestions } from "./parse-questions";
import { chunkText, dedupeQuestions, needsAiReading } from "./parse-quality";

describe("needsAiReading", () => {
  it("keeps the simple reader for a neat file", () => {
    const t = "1. من شاعر المعلقة؟\nأ) عنترة\nب) امرؤ القيس\nج) زهير\nد) لبيد\n2. من مؤلف البخلاء؟\nأ) الجاحظ\nب) المتنبي";
    expect(needsAiReading(t, parseQuestions(t))).toBe(false);
  });
  it("uses AI when options are glued together on one line", () => {
    const t = "1. وكان حسان بن ثابت شاعر\nأ) كلاهما غير صحيح\nب) كعب بن زهير ج- حسان بن ثابت د- زهير بن أبي سلمى";
    expect(needsAiReading(t, parseQuestions(t))).toBe(true);
  });
  it("uses AI when nothing was read but the text has option labels", () => {
    const t = "137( كاتب مصري د( يوسف إدريس ج( خليل مطران ب( يحي زيدون أ( يحي حقي";
    expect(needsAiReading(t, [])).toBe(true);
  });
  it("does not use AI for text without questions", () => {
    expect(needsAiReading("نص عادي بلا أسئلة", [])).toBe(false);
  });
});

describe("chunkText", () => {
  it("keeps short text in one chunk", () => {
    expect(chunkText("سطر\nسطر")).toEqual(["سطر\nسطر"]);
  });
  it("splits long text with overlap so no line is lost", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `سؤال رقم ${i} ؟`);
    const chunks = chunkText(lines.join("\n"), 300, 60);
    expect(chunks.length).toBeGreaterThan(3);
    for (const l of lines) expect(chunks.some((c) => c.includes(l))).toBe(true);
    expect(chunks.every((c) => c.length <= 300 + 60)).toBe(true);
  });
});

it("dedupeQuestions drops the copy read twice from the overlap", () => {
  const q = { question: "س؟", options: ["أ", "ب"], correct: null };
  expect(dedupeQuestions([q, { ...q }, { ...q, question: "ص؟" }])).toHaveLength(2);
});
