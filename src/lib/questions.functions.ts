import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { questionHash } from "./question-hash";
import { draftInputSchema, reviewInputSchema, isReady, orderedReviewItems } from "./question-rules";
import { z } from "zod";

// Saves parsed questions as drafts. Duplicates of the student's bank are skipped.
export const saveDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof draftInputSchema>) => draftInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: up, error } = await supabase
      .from("uploads")
      .insert({ user_id: userId, file_name: data.fileName.slice(0, 200), file_type: data.fileType, topic_hint: data.topicHint })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const rows = await Promise.all(
      data.questions.map(async (q) => ({
        owner_id: userId,
        upload_id: up.id,
        question_text: q.question.slice(0, 4000),
        options: q.options.slice(0, 6).map((o) => o.slice(0, 1000)),
        correct_index: q.correct,
        content_hash: await questionHash(q),
      })),
    );
    const { data: inserted, error: e2 } = await supabase
      .from("questions")
      .upsert(rows, { onConflict: "owner_id,content_hash", ignoreDuplicates: true })
      .select("id");
    if (e2) throw new Error(e2.message);
    const count = inserted?.length ?? 0;
    const { error: countError } = await supabase.from("uploads").update({ question_count: count }).eq("id", up.id);
    if (countError) throw new Error(countError.message);
    return { uploadId: up.id, ids: (inserted ?? []).map((r) => r.id), duplicates: rows.length - count };
  });

// AI-reviews up to 20 of the student's draft questions and stores the verdict (never changes the answer).
export const reviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof reviewInputSchema>) => reviewInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: qs, error } = await supabase
      .from("questions")
      .select("id, question_text, options, correct_index")
      .in("id", data.ids).eq("owner_id", context.userId).eq("status", "draft");
    if (error) throw new Error(error.message);
    if (!qs?.length) return { ok: true };

    const { reviewWithAI } = await import("./ai-review.server");
    const items = await reviewWithAI(
      qs.map((q) => ({ question: q.question_text, options: q.options as string[], marked: q.correct_index })),
      data.topicHint,
    );
    const ordered = orderedReviewItems(items, qs.length);
    const updates = await Promise.all(
      qs.map((q, i) => {
        const it = ordered[i];
        const n = (q.options as string[]).length;
        if (!it) throw new Error("تعذّر تدقيق بعض الأسئلة، حاول مجددًا");
        let flag = it.flag;
        const aiIndex = it.ai_index !== null && Number.isInteger(it.ai_index) && it.ai_index >= 0 && it.ai_index < n ? it.ai_index : null;
        if (q.correct_index === null) flag = "no_answer";
        else if (flag === "wrong_answer" && (aiIndex === null || aiIndex === q.correct_index)) flag = "clean";
        const fixedOptions = it.fixed_options && it.fixed_options.length === n ? it.fixed_options : null;
        return supabase
          .from("questions")
          .update({
            ai_flag: flag,
            topic_area: it.topic.slice(0, 80),
            ai_suggestion: { fixed_question: it.fixed_question, fixed_options: fixedOptions, reason: it.reason, ai_index: aiIndex },
          })
          .eq("id", q.id).eq("owner_id", context.userId).eq("status", "draft");
      }),
    );
    const failed = updates.find((u) => u.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { ok: true };
  });

// Reads one chunk of a messy file with AI (only used when the simple reader fails).
export const readQuestionsWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => z.object({ text: z.string().trim().min(1).max(12000) }).parse(d))
  .handler(async ({ data }) => {
    const { extractWithAI } = await import("./ai-extract.server");
    return { questions: await extractWithAI(data.text) };
  });

export const publishQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.from("questions").select("id, options, correct_index, ai_flag").in("id", data.ids).eq("owner_id", userId).eq("status", "draft");
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).filter(isReady).map((q) => q.id);
    if (!ids.length) return { ids: [] as string[] };
    const { data: published, error: updateError } = await supabase.from("questions").update({ status: "active" }).in("id", ids).eq("owner_id", userId).eq("status", "draft").in("ai_flag", ["clean", "suggestion"]).select("id");
    if (updateError) throw new Error(updateError.message);
    return { ids: (published ?? []).map((q) => q.id) };
  });
