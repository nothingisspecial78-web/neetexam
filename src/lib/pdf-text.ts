import { parseQuestions } from "./parse-questions";

// Some Arabic PDFs expose visual glyph order rather than logical text order.
// Only use the alternate direction when it recovers more actual MCQs.
export function normalizePdfText(text: string) {
  const alternate = text.split("\n").map((line) => /[\u0600-\u06ff]/.test(line) ? Array.from(line).reverse().join("") : line).join("\n");
  return parseQuestions(alternate).length > parseQuestions(text).length ? alternate : text;
}