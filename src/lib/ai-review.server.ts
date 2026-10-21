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

const INSTRUCTIONS = `أنت مدقّق أكاديمي موثوق وموسوعي لأسئلة اختيار من متعدد في الأدب العربي وتاريخه وعلومه.
قواعد التدقيق الإلزامية:
1. قاعدة الثقة بإجابة الطالب: إجابة الطالب (marked) تُعتبر صحيحة ومقبولة مالم تكن خطأً علمياً أو تاريخياً قاطعاً لا يحتمل أي وجه من وجوه الصواب. إذا كانت الإجابة المحددة صحيحة أو وجهاً معتبراً في كتب الأدب، اجعل flag = "clean" و ai_index = marked.
2. الكنى والألقاب وتاريخ الأدب: احرص بدقة بالغة على معرفة كنى الشعراء وألقابهم (مثل: جرير = أبو حزرة، الفرزدق = أبو فراس، الأخطل = أبو مالك، المتنبي = أبو الطيب، البحتري = أبو عبادة، أبو تمام = حبيب بن أوس الطائي). لا تخلط إطلاقاً بين كنى وألقاب الشعراء.
3. التمييز الدقيق بين الحالات:
   - إن كان الطالب قد حدد إجابة صحيحة -> flag = "clean" و ai_index = marked.
   - إن كان الطالب لم يحدد إجابة (marked = null) -> flag = "no_answer" وضع في ai_index رقم الخيار الصحيح (يبدأ من 0).
   - فقط وفقط إذا كانت إجابة الطالب خطأً صريحاً قاطعاً 100% لا يقبل الشك -> flag = "wrong_answer" وضع في ai_index رقم الخيار الصحيح واذكر السبب باختصار.
   - إن وُجدت أخطاء إملائية أو لغوية فقط -> flag = "suggestion" مع تزويد التصحيح.
4. لا تخمّن إطلاقاً: إن لم تكن متأكداً يقيناً بنسبة 100% أن إجابة الطالب خطأ، فاعتبر إجابته صحيحة واجعل flag = "clean".
5. topic: اسم الموضوع الأدبي باللغة العربية (مثل: العصر الأموي، العصر العباسي، الشعر الجاهلي، البلاغة، النحو).`;

export async function reviewWithAI(
  questions: { question: string; options: string[]; marked: number | null }[],
  topicHint: string | null,
  subheadings?: string[],
) {
  const { model, gateway } = getAiConfig();
  const payload = questions.map((q, i) => ({ i, ...q }));

  const subheadingsInstruction =
    subheadings && subheadings.length > 0
      ? `\nقاعدة إلزامية لتصنيف الأسئلة (topic): حدد المستخدم العناوين الفرعية التالية: [${subheadings.join("، ")}]. يجب عليك حتماً تصنيف كل سؤال تحت أحد هذه العناوين الفرعية فقط وبنفس صياغتها، باختيار العنوان الأنسب لكل سؤال.`
      : "";

  const result = streamText({
    model,
    system:
      AI_GUARD +
      INSTRUCTIONS +
      (topicHint ? `\nتلميح الموضوع من الطالب: ${topicHint}` : "") +
      subheadingsInstruction,
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
