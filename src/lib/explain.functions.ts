import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Explains an answer. Cached on the question (owner's questions only), so each question is billed once.
export const explainAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { questionId: string }) => z.object({ questionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS limits this to own questions or accepted friends' active questions.
    const { data: q, error } = await supabase.from("questions")
      .select("id, owner_id, question_text, options, correct_index, explanation").eq("id", data.questionId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!q || q.correct_index === null) throw new Error("السؤال غير متاح");
    if (q.explanation) return { text: q.explanation };
    const options = q.options as string[];
    const { explainWithAI } = await import("./explain.server");
    const text = await explainWithAI({
      question: q.question_text, options, correct: q.correct_index
    });
    if (q.owner_id === userId) await supabase.from("questions").update({ explanation: text.slice(0, 2000) }).eq("id", q.id);
    return { text };
  });
