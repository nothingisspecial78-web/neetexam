# Stage 2 plan: Upload, extraction, AI review, publish (KISS)

## Flow (one page, `/app/upload`)

```text
Pick file (+ optional topic hint)
  -> text extracted in the browser (instant, no waiting on server)
  -> parser splits into questions  -> "Found 120 questions"
  -> AI reviews in batches of 20, progress bar
  -> review list with filters: all / ✅ / ⚠️ / ❌ / ❓
  -> Publish  -> resolved questions become active
```

## What gets built

1. **Extraction (browser):** txt/md read directly; text-based PDF via a small PDF reader library. Arabic text kept as-is (no normalising of diacritics).
2. **Parser (shared code, tested):** handles
  - `1.` / `١-` question numbers
  - option labels أ ب ج د / A B C D / 1 2 3 4 with `)` `.` `-`
  - answers: `**bold option**`, `الإجابة: ب`, `Answer: B`, ✓ / ★ beside an option
  - drops anything with fewer than 2 options (only MCQ saved)
3. **AI review (server only, Lovable AI):** one call per batch of 20 questions returns, per question: flag (clean / suggestion / wrong_answer / no_answer), suggested text fix + short reason, the AI's answer index, and a topic area (needed for units in Stage 3). The AI never changes anything itself.
4. **Review screen:** one card per flagged question with the buttons from the spec:
  - ❌ Change to ج / Keep mine / Choose another
  - ⚠️ Accept fix / Edit / Ignore
  - ❓ "Let AI answer all N" button + per-question accept; AI answers tagged 🤖
5. **Publish:** resolved questions -> `active`; unresolved ❌/❓ stay drafts.
6. **Duplicates:** content hash; duplicates of your existing questions are skipped automatically and counted ("8 duplicates skipped").
7. **My Questions page (`/app/questions`):** search, edit, delete. Shows file name, date.
8. Home screen "Upload" and "My Questions" tiles become live.

## Data

- Storage bucket `uploads` (private, owner-only) keeps the original file.
- Tables `uploads` and `questions` exactly as in the schema file, owner-only security rules, indexes from the spec.

## Kept out for simplicity (tell me if you need them now)

- **Scanned PDFs (OCR):** shows "This PDF has no text, please upload a text PDF". Can add later by sending pages to the AI.
- **Re-run AI review** on single questions from My Questions — later.
- Max file size 10 MB.

## Test checklist

- Upload a txt, md and pdf with Arabic questions: counts are right, Arabic intact.
- Bold / `الإجابة:` / ✓ answers detected.
- A deliberately wrong answer shows ❌ and cannot publish until you choose.
- ❓ questions get answers only after you press "Let AI answer".

&nbsp;

Uploading files: 

- Uploading files are not be stored in database, but extraction of questions this must be removed.
- And if there are same questions then automatically that duplicate of questions.