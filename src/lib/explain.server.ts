import { AI_GUARD } from "./ai-guard";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server.ts";

const INSTRUCTIONS = `أنت معلّم أدب عربي. اشرح بإيجاز (جملتان إلى أربع جمل) بالعربية لماذا الإجابة الصحيحة صحيحة، ثم اذكر باختصار لماذا الخيارات الأخرى غير صحيحة. لا تغيّر الإجابة الصحيحة المعطاة.`;

export async function explainWithAI(q: { question: string; options: string[]; correct: number }) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("خدمة الشرح غير مهيأة");
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
    prompt: JSON.stringify({
      question: q.question,
      options: q.options,
      correct_answer: q.options[q.correct],
    }),
    maxRetries: 1,
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
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
