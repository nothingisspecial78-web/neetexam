// Prompt students copy into an AI chat to turn any question file into the app's .md format.
export const CONVERT_PROMPT = `Convert the uploaded question bank into standard MCQ Markdown.

TASK
Read the ENTIRE file (all pages, tables, scans; use OCR if needed; batch if long). Find every question and its correct answer. Deliver questions_answers.md as a downloadable file, not a chat preview.

FORMAT (every question, exactly):

### Set-A

1. Question text?

   - A. Option
   - B. Option
   - C. Option
   - D. Option

   **Correct answer: A. Option text**

Rules: ### Set-A/B/C headings; numbered questions restarting at 1 in each set; one option per line; blank line before the answer line; no tables, JSON, HTML, CSV, or outer code block; no bullets for questions.

ANSWERS
- If the file gives the answer (answer key, solution section, bold/tick/underline/highlight on an option, or stated beside the question), use it. Bold counts only when it marks an option, not a heading or decoration.
- If the file does NOT give the answer, automatically search the web and use the verified result as the answer. Do not ask me. Prefer reliable sources (academic, official, authoritative; Arabic-language sources for Arabic literature).
- If a marked answer is wrong, conflicting, or unclear, research it and correct it. If the right answer isn't among the options, replace or add an option.
- Never invent facts, quotes, names, dates or sources. If the web cannot verify it, write "**Correct answer: Unverified**".

NON-MCQ QUESTIONS
If a question is not an MCQ (short answer, fill-in-the-blank, true/false, matching, ordering, or no options), always convert it into a 4-option MCQ automatically: keep the original meaning, include the verified answer as one option, add 3 plausible same-topic distractors, and make exactly one option correct. Never drop a question. If it is too ambiguous to convert, keep it and mark its answer "Unverified".

SETS
Keep the source's sets (renamed Set-A, Set-B...). If none, use sets of 25. Keep original order; no skips, merges, or duplicates (unless the source repeats them).

LANGUAGE
Keep Arabic, Malayalam, and English as in the source. Don't translate. Fix OCR errors only when certain. Preserve names, quotes, titles, dates.

OUTPUT FILE
Only one file: questions_answers.md (all questions). Do not create any verification report or other files.

FINAL CHECK
Converted count = source count; format is consistent; every answer matches its option text; no fabricated answers; no skipped numbers. Don't claim completion unless everything is processed.`;
