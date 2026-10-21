import { expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
import { reviewWithAI } from "./ai-review.server";

it.skipIf(process.env["RUN_LIVE_AI_TEST"] !== "1")("reviews wrong and absent Arabic answers without applying them", async () => {
  const items = await reviewWithAI([
    { question: "من مؤلف كتاب البخلاء؟", options: ["الجاحظ", "المتنبي", "أبو تمام", "البحتري"], marked: 1 },
    { question: "من صاحب معلقة قفا نبك من ذكرى حبيب ومنزل؟", options: ["زهير بن أبي سلمى", "امرؤ القيس", "عنترة بن شداد", "لبيد بن ربيعة"], marked: null },
  ], null);
  expect(items).toHaveLength(2);
  expect(items.find((i) => i.i === 0)).toMatchObject({ flag: "wrong_answer", ai_index: 0 });
  expect(items.find((i) => i.i === 1)).toMatchObject({ flag: "no_answer", ai_index: 1 });
}, 120000);