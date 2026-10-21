import { createOpenAI } from "@ai-sdk/openai";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server.ts";

export function getAiConfig() {
  const apiKey =
    process.env["OPENROUTER_API_KEY"] ||
    process.env["AI_API_KEY"] ||
    process.env["LOVABLE_API_KEY"];

  if (!apiKey) {
    throw new Error("خدمة الذكاء الاصطناعي غير مهيأة — يرجى ضبط مفتاح API في الإعدادات");
  }

  const isOpenRouter =
    apiKey.startsWith("sk-or-") ||
    Boolean(process.env["OPENROUTER_API_KEY"]) ||
    !process.env["LOVABLE_API_KEY"];

  const baseURL = isOpenRouter
    ? (process.env["OPENROUTER_BASE_URL"] || "https://openrouter.ai/api/v1")
    : "https://ai.gateway.lovable.dev/v1";

  const modelName =
    process.env["AI_MODEL"] ||
    (isOpenRouter ? "deepseek/deepseek-chat" : "openai/gpt-6-astra");

  const gateway = createLovableAiGatewayRunIdFetch();

  const provider = createOpenAI({
    baseURL,
    apiKey,
    headers: isOpenRouter
      ? {
          "HTTP-Referer": "https://neetexam.app",
          "X-Title": "NeetExam Arabic Platform",
        }
      : {
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
    fetch: gateway.fetch,
  });

  return {
    provider,
    model: provider(modelName),
    gateway,
  };
}
