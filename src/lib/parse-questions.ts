// Turns raw text into multiple-choice questions. Pure code, runs in browser and tests.

export type ParsedQuestion = { question: string; options: string[]; correct: number | null };

const LABELS: Record<string, number> = {
  "أ": 0, "ا": 0, "a": 0, "1": 0, "١": 0,
  "ب": 1, "b": 1, "2": 1, "٢": 1,
  "ج": 2, "c": 2, "3": 2, "٣": 2,
  "د": 3, "d": 3, "4": 3, "٤": 3,
  "هـ": 4, "ه": 4, "e": 4, "5": 4, "٥": 4,
  "و": 5, "f": 5, "6": 5, "٦": 5,
};
export const labelToIndex = (l: string) => LABELS[l.trim().toLowerCase()] ?? null;
export const ARABIC_LABELS = ["أ", "ب", "ج", "د", "هـ", "و"];

const MARK = /[✓✔☑★⭐✅]/g;
// "1." "١-" "س1:" "Q1." -> question number (needs . - : ـ or a ")" when not inside options)
const Q_NUM = /^(?:س|Q)?\s*[0-9٠-٩]+\s*[.\-:ـ]\s*(.+)$/i;
const Q_NUM_PAREN = /^[0-9٠-٩]+\s*\)\s*(.+)$/;
// "أ)" "ب." "A)" "c -" "1)"
const OPT = /^\(?\s*(هـ|[أابجدهوA-Fa-f]|[1-6١-٦])\s*[).\-]\s*(.+)$/;
const ANS = /^(?:الإجابة|الاجابة|الجواب|الإجابة الصحيحة|الاجابة الصحيحة|correct answer|the answer|answer|ans|correct)\s*(?:الصحيحة)?\s*[:：\-=]\s*\(?\s*(هـ|[^\s)\].]+)/i;

const stripBold = (s: string) => s.replace(/\*\*|__/g, "").trim();

export function parseQuestions(text: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  let cur: ParsedQuestion | null = null;
  const push = () => {
    if (cur && cur.options.length >= 2 && cur.question) {
      if (cur.correct !== null && cur.correct >= cur.options.length) cur.correct = null;
      out.push(cur);
    }
    cur = null;
  };

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    let line = raw.trim().replace(/^#+\s*/, "").replace(/^[-*+]\s+(?=\S)/, "").trim();
    if (!line) continue;
    const bold = /\*\*.+\*\*|__.+__/.test(line);
    const marked = MARK.test(line);
    MARK.lastIndex = 0;
    line = stripBold(line.replace(MARK, "")).trim();
    if (!line) continue;

    const ans = line.match(ANS);
    if (ans && cur) {
      const idx = labelToIndex(ans[1]!);
      if (idx !== null) (cur as ParsedQuestion).correct = idx;
      continue;
    }

    const c = cur as ParsedQuestion | null;
    const opt = line.match(OPT);
    const numericOpt = opt && /^[1-6١-٦]$/.test(opt[1]!);
    // An option only if we are inside a question; numeric labels only with ")".
    if (c && opt && (!numericOpt || /^\(?\s*[1-6١-٦]\s*\)/.test(line))) {
      const expected = c.options.length;
      if (labelToIndex(opt[1]!) === expected || expected === 0) {
        c.options.push(opt[2]!.trim());
        if (bold || marked) c.correct = expected;
        continue;
      }
    }

    const q = line.match(Q_NUM) ?? (!c || c.options.length > 0 ? line.match(Q_NUM_PAREN) : null);
    if (q) { push(); cur = { question: q[1]!.trim(), options: [], correct: null }; continue; }

    if (c && c.options.length === 0) { c.question += " " + line; continue; }
    // Un-numbered question: a line ending in ? after a finished question
    if (/[?؟]$/.test(line) && (!c || c.options.length >= 2)) { push(); cur = { question: line, options: [], correct: null }; }
  }
  push();
  return dedupe(out);
}

export const normalizeForHash = (q: { question: string; options: string[] }) =>
  [q.question, ...q.options].map((s) => s.replace(/\s+/g, " ").trim()).join("|");

function dedupe(qs: ParsedQuestion[]) {
  const seen = new Set<string>();
  return qs.filter((q) => { const k = normalizeForHash(q); if (seen.has(k)) return false; seen.add(k); return true; });
}
