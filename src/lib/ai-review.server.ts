import { AI_GUARD } from "./ai-guard";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getAiConfig } from "./ai-provider.server";

const schema = z.object({
  items: z.array(
    z.object({
      i: z.number(),
      flag: z.enum(["clean", "suggestion", "wrong_answer", "no_answer"]),
      fixed_question: z.string().nullable(),
      fixed_options: z.array(z.string()).nullable(),
      reason: z.string().nullable(),
      ai_index: z.number().nullable(),
      topic: z.string(),
    }),
  ),
});
export type ReviewItem = z.infer<typeof schema>["items"][number];

const INSTRUCTIONS = `أنت مدقّق لأسئلة اختيار من متعدد في الأدب العربي.
لكل سؤال (i) أعد:
- ai_index: رقم الخيار الصحيح حسب علمك (يبدأ من 0)، أو null إن لم تكن واثقًا. لا تخمّن.
- flag: "no_answer" إن كان marked = null؛ "wrong_answer" إن كان marked لا يساوي ai_index وأنت واثق؛ "suggestion" إن وُجدت أخطاء إملائية أو نحوية أو صرفية أو خيارات مكررة أو نقص علامة الاستفهام؛ وإلا "clean".
- fixed_question و fixed_options: النص المصحَّح فقط عند وجود تصحيح (نفس عدد الخيارات)، وإلا null. لا تغيّر المعنى.
- reason: سبب قصير جدًا بالعربية، أو null.
- topic: مجال موضوعي قصير وعامّ بالعربية (مثل: الشعر الجاهلي، العصر العباسي، البلاغة، النحو، النقد الأدبي) لتجميع الأسئلة في وحدات.`;

export async function reviewWithAI(
  questions: { question: string; options: string[]; marked: number | null }[],
  topicHint: string | null,
) {
  const { model, gateway } = getAiConfig();
  const payload = questions.map((q, i) => ({ i, ...q }));
  const result = streamText({
    model,
    system: AI_GUARD + INSTRUCTIONS + (topicHint ? `\nتلميح الموضوع من الطالب: ${topicHint}` : ""),
    prompt: JSON.stringify(payload),
    output: Output.object({ schema }),
    maxRetries: 1,
  });
  try {
    const items = (await result.output).items;
    const runId = gateway.getRunId();
    if (runId) setResponseHeader("X-Lovable-AIG-Run-ID", runId);
    return items;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new Error("تعذّر قراءة نتيجة التدقيق، راجع الأسئلة يدويًا");
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي");
    if (status === 429) throw new Error("ضغط كبير، حاول بعد قليل");
    console.error("Question review failed", { status });
    throw new Error(status === 401 ? "خدمة التدقيق تحتاج إلى إعادة الإعداد" : status === 403 ? "خدمة التدقيق غير متاحة لهذا الحساب" : "تعذّر التدقيق، راجع الأسئلة يدويًا");
  }
}
