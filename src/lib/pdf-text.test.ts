import { expect, it } from "vitest";
import { normalizePdfText } from "./pdf-text";
import { parseQuestions } from "./parse-questions";
const text = "1. من مؤلف كتاب البخلاء؟\nأ) الجاحظ\nب) المتنبي\nالإجابة: أ";
it("preserves logical Arabic PDF text", () => expect(normalizePdfText(text)).toBe(text));
it("recovers Arabic MCQs exposed in visual order", () => {
  const visual = text.split("\n").map((line) => Array.from(line).reverse().join("")).join("\n");
  expect(parseQuestions(normalizePdfText(visual))).toEqual([{ question: "من مؤلف كتاب البخلاء؟", options: ["الجاحظ", "المتنبي"], correct: 0 }]);
});