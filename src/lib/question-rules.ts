import { z } from "zod";

export const draftInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileType: z.enum(["txt", "md", "pdf"]),
  topicHint: z.string().trim().max(200).nullable(),
  unitId: z.string().uuid().nullable().optional(),
  subheadings: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  questions: z.array(z.object({
    question: z.string().trim().min(1).max(4000),
    options: z.array(z.string().trim().min(1).max(1000)).min(2).max(6),
    correct: z.number().int().min(0).nullable(),
  }).refine((q) => q.correct === null || q.correct < q.options.length, "Invalid answer")).min(1).max(2000),
});

export const reviewInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(20),
  topicHint: z.string().trim().max(200).nullable(),
  subheadings: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
});

export function isReady(q: { correct_index: number | null; options: unknown; ai_flag: string | null }) {
  return q.correct_index !== null && Number.isInteger(q.correct_index) && q.correct_index >= 0
    && Array.isArray(q.options) && q.correct_index < q.options.length
    && (q.ai_flag === "clean" || q.ai_flag === "suggestion");
}

export function suggestedAnswer(q: { options: unknown; ai_suggestion: unknown }) {
  const suggestion = q.ai_suggestion;
  if (!suggestion || typeof suggestion !== "object" || !("ai_index" in suggestion)) return null;
  const i = suggestion.ai_index;
  return typeof i === "number" && Number.isInteger(i) && i >= 0 && Array.isArray(q.options) && i < q.options.length ? i : null;
}

// Validate the complete response before any draft is updated.
export function orderedReviewItems<T extends { i: number }>(items: T[], count: number): T[] {
  if (items.length !== count || new Set(items.map((item) => item.i)).size !== count
    || items.some((item) => !Number.isInteger(item.i) || item.i < 0 || item.i >= count)) {
    throw new Error("تعذّر تدقيق بعض الأسئلة، حاول مجددًا");
  }
  return [...items].sort((a, b) => a.i - b.i);
}