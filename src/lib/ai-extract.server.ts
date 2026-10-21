import { AI_GUARD } from "./ai-guard";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server.ts";

const schema = z.object({
  questions: z.array(z.object({ question: z.string(), options: z.array(z.string()), correct: z.number().nullable() })),
});

const INSTRUCTIONS = `أنت تستخرج أسئلة اختيار من متعدد من نص مأخوذ من ملف PDF عربي قد يكون مشوّهًا.
مشاكل شائعة في النص: الخيارات كلها في سطر واحد، ترتيب الخيارات معكوس (د ج ب أ)، الرمز يأتي بعد نص الخيار بدل قبله، الأقواس معكوسة مثل "أ(" بدل "أ)"، الأرقام مثل ".1" أو "137(" تعني رقم السؤال، عناوين وفواصل مثل "Set-D" أو "=====".
القواعد:
- أعد كل سؤال كاملًا بنصه الأصلي دون رقمه، وخياراته مرتبة حسب رموزها (أ ثم ب ثم ج ثم د) دون الرموز.
- لا تغيّر صياغة السؤال أو الخيارات ولا تخترع خيارات. تجاهل العناوين والأرقام والفواصل.
- correct: رقم الخيار الصحيح (يبدأ من 0) فقط إذا كان الملف يحدده صراحة (سطر "الإجابة"، علامة ✓، مفتاح إجابات)؛ وإلا null. لا تجب من علمك.
- تجاهل سؤالًا مقطوعًا في أول النص أو آخره فقط، وتجاهل الأسئلة التي ليس لها خياران على الأقل.`;

export type ExtractedQuestion = { question: string; options: string[]; correct: number | null };

// Keeps only well-formed questions; the model is never trusted for lengths or indexes.
export function cleanExtracted(qs: ExtractedQuestion[]): ExtractedQuestion[] {
  return qs.flatMap((q) => {
    const question = q.question.replace(/\s+/g, " ").trim().slice(0, 4000);
    const options = q.options.map((o) => o.replace(/\s+/g, " ").trim().slice(0, 1000)).filter(Boolean).slice(0, 6);
    if (!question || options.length < 2) return [];
    const correct = q.correct !== null && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < options.length ? q.correct : null;
    return [{ question, options, correct }];
  });
}

export async function extractWithAI(text: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("خدمة القراءة غير مهيأة");
  const gateway = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: gateway.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: AI_GUARD + INSTRUCTIONS,
    prompt: text,
    output: Output.object({ schema }),
    maxRetries: 1,
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
  });
  try {
    const out = await result.output;
    const runId = gateway.getRunId();
    if (runId) setResponseHeader("X-Lovable-AIG-Run-ID", runId);
    return cleanExtracted(out.questions);
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new Error("تعذّرت قراءة جزء من الملف، حاول مجددًا");
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي");
    if (status === 429) throw new Error("ضغط كبير، حاول بعد قليل");
    console.error("AI question reading failed", { status });
    throw new Error(status === 401 ? "خدمة القراءة تحتاج إلى إعادة الإعداد" : status === 403 ? "خدمة القراءة غير متاحة لهذا الحساب" : "تعذّرت قراءة الملف بالذكاء الاصطناعي");
  }
}
