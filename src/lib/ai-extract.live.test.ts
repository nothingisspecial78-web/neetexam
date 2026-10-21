import { expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
import { extractWithAI } from "./ai-extract.server";

// Real messy text taken from an uploaded PDF (options on one line, reversed order, mirrored brackets).
const MESSY = `137( كاتب وروائي مصري يعتبره النقاد رائد فن القصة القصيرة
د( يوسف إدريس   ج( خليل مطران   ب( يحي زيدون   أ( يحي حقي
138(كاتب قصصي مسرحي اشتهر ب"أمير القصة"
د( يحي حقي   ج( يوسف إدريس   ب( يوسف إسلام   أ( يوسف صديقي
139( من شعراء البلاط
د( طرفة ابن العبد   ج( امرؤ القيس   ب( بشر ابن حازم   أ( الأخطل`;

it.skipIf(process.env["RUN_LIVE_AI_TEST"] !== "1")("reads messy Arabic PDF text into ordered questions", async () => {
  const qs = await extractWithAI(MESSY);
  expect(qs).toHaveLength(3);
  expect(qs[0]!.options).toHaveLength(4);
  expect(qs[0]!.options[0]).toContain("يحي حقي");
  expect(qs[0]!.options[3]).toContain("يوسف إدريس");
  expect(qs[2]!.options[0]).toContain("الأخطل");
  expect(qs.every((q) => q.correct === null)).toBe(true);
}, 180000);
