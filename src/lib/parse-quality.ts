import { normalizeForHash, type ParsedQuestion } from "./parse-questions";

// An Arabic option label such as "أ)" "ب(" "ج-" "د." "هـ –" (brackets may be mirrored in PDFs).
const LABEL = /(?:^|\s)(?:هـ|[أبجد])\s*[()\-–.]/g;
const labels = (s: string) => s.match(LABEL)?.length ?? 0;

// True when the simple reader clearly failed: options glued into the question or into
// other options, or far fewer questions than option labels in the text.
export function needsAiReading(text: string, parsed: ParsedQuestion[]) {
  const total = labels(text);
  if (!parsed.length) return total >= 3;
  const bad = parsed.filter((q) => q.question.length > 500 || labels(q.question) >= 2 || q.options.some((o) => labels(o) >= 1)).length;
  return bad / parsed.length >= 0.2 || total > parsed.length * 8;
}

// Splits text on line breaks into chunks of about `size` chars; each chunk repeats the end
// of the previous one so a question cut at a border is read whole in the next chunk.
export function chunkText(text: string, size = 7000, overlap = 800) {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur.length + line.length + 1 > size && cur.trim()) {
      chunks.push(cur);
      cur = cur.slice(-overlap);
    }
    cur += (cur ? "\n" : "") + line.slice(0, size);
  }
  if (cur.trim() && (!chunks.length || cur.length > overlap)) chunks.push(cur);
  return chunks;
}

export function dedupeQuestions(qs: ParsedQuestion[]) {
  const seen = new Set<string>();
  return qs.filter((q) => { const k = normalizeForHash(q); if (seen.has(k)) return false; seen.add(k); return true; });
}
