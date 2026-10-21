import { AI_GUARD } from "./ai-guard";
import { streamText } from "ai";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getAiConfig } from "./ai-provider.server";

const INSTRUCTIONS = `أنت معلّم أدب عربي. اشرح بإيجاز (جملتان إلى أربع جمل) بالعربية لماذا الإجابة الصحيحة صحيحة، ثم اذكر باختصار لماذا الخيارات الأخرى غير صحيحة. لا تغيّر الإجابة الصحيحة المعطاة.`;

export async function explainWithAI(q: { question: string; options: string[]; correct: number }) {
  const { model, gateway } = getAiConfig();
  const result = streamText({
    model,
    system: AI_GUARD + INSTRUCTIONS,
    prompt: JSON.stringify({
      question: q.question,
      options: q.options,
      correct_answer: q.options[q.correct],
    }),
    maxRetries: 1,
  });
  try {
    const text = (await result.text).trim();
    const runId = gateway.getRunId();
    if (runId) setResponseHeader("X-Lovable-AIG-Run-ID", runId);
    if (!text) throw new Error("empty");
    return text;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي");
    if (status === 429) throw new Error("ضغط كبير، حاول بعد قليل");
    console.error("Explanation failed", { status });
    throw new Error(status === 403 ? "خدمة الشرح غير متاحة لهذا الحساب" : "تعذّر الشرح الآن");
  }
}
