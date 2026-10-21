import { describe, expect, it } from "vitest";
import { parseQuestions } from "./parse-questions";

describe("parseQuestions", () => {
  it("reads an Arabic question with a الإجابة line", () => {
    const r = parseQuestions("1. من شاعر المعلقة؟\nأ) عنترة\nب) امرؤ القيس\nج) زهير\nد) لبيد\nالإجابة: ب");
    expect(r).toHaveLength(1);
    expect(r[0]!.options).toHaveLength(4);
    expect(r[0]!.correct).toBe(1);
  });
  it("detects a bold answer", () => {
    const r = parseQuestions("1. سؤال؟\nأ) خيار\n**ب) الصحيح**\nج) خيار");
    expect(r[0]!.correct).toBe(1);
  });
  it("detects a ✓ mark and English labels with Answer: line", () => {
    expect(parseQuestions("2. Q?\nA) x\nB) y\nC) z ✓")[0]!.correct).toBe(2);
    expect(parseQuestions("2. Q?\nA) x\nB) y\nAnswer: A")[0]!.correct).toBe(0);
  });
  it("leaves the answer empty when none is given", () => {
    expect(parseQuestions("١- سؤال؟\nأ) س\nب) ص")[0]!.correct).toBeNull();
  });
  it("handles numeric option labels", () => {
    const r = parseQuestions("1. سؤال؟\n1) a\n2) b\n3) c\nالإجابة: 3");
    expect(r[0]!.options).toEqual(["a", "b", "c"]);
    expect(r[0]!.correct).toBe(2);
  });
  it("drops non-multiple-choice items", () => {
    expect(parseQuestions("1. سؤال مقالي بلا خيارات؟\n2. آخر؟\nأ) واحد")).toHaveLength(0);
  });
  it("removes duplicates in the same file", () => {
    const q = "1. سؤال؟\nأ) س\nب) ص\n";
    expect(parseQuestions(q + q.replace("1.", "2."))).toHaveLength(1);
  });
  it("reads several questions in a row", () => {
    const t = "1. أ؟\nأ) 1\nب) 2\n2. ب؟\nأ) 3\nب) 4\nالإجابة: أ";
    const r = parseQuestions(t);
    expect(r).toHaveLength(2);
    expect(r[1]!.correct).toBe(0);
  });
  it("reads indented markdown list options with a bold 'Correct answer' line", () => {
    const t = "### Set-A\n\n1.  العرب البائدة هم أولاد\n\n    -   A. القحطانيون\n    -   B. عمرو بن هند\n    -   C. عاد\n    -   D. سام بن نوح\n\n    **Correct answer: D. سام بن نوح**\n";
    const r = parseQuestions(t);
    expect(r).toHaveLength(1);
    expect(r[0]!.options).toEqual(["القحطانيون", "عمرو بن هند", "عاد", "سام بن نوح"]);
    expect(r[0]!.correct).toBe(3);
  });
  it("reads the copy-prompt format across sets, leaving Unverified answers empty", () => {
    const q = (n: number, t: string, ans: string) => `${n}. ${t}?\n\n   - A. a${t}\n   - B. b${t}\n   - C. c${t}\n   - D. d${t}\n\n   **Correct answer: ${ans}**\n\n`;
    const md = "### Set-A\n\n" + q(1, "x", "C. cx") + q(2, "y", "Unverified") + "### Set-B\n\n" + q(1, "z", "A. az");
    expect(parseQuestions(md).map((r) => r.correct)).toEqual([2, null, 0]);
  });
});
