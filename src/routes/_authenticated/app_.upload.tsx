import { createFileRoute, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, FileUp, CheckCircle2, AlertTriangle, XCircle, HelpCircle, CloudUpload, BookOpen, Layers } from "lucide-react";
import { CONVERT_PROMPT } from "@/lib/convert-prompt";
import { supabase } from "@/integrations/supabase/client";
import { extractText } from "@/lib/extract-text";
import { parseQuestions, type ParsedQuestion } from "@/lib/parse-questions";
import { chunkText, dedupeQuestions, needsAiReading } from "@/lib/parse-quality";
import { readQuestionsWithAI, reviewQuestions, saveDrafts } from "@/lib/questions.functions";
import { AppHeader } from "@/components/AppHeader";
import { QuestionList } from "@/components/QuestionList";
import type { QRow } from "@/components/QuestionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app_/upload")({
  head: () => ({
    meta: [
      { title: "رفع الأسئلة — مِدْرَاس" },
      { name: "description", content: "ارفع ملف أسئلتك ليُدقَّق بالذكاء الاصطناعي." },
      { property: "og:title", content: "رفع الأسئلة — مِدْرَاس" },
      { property: "og:description", content: "ارفع ملف أسئلتك ليُدقَّق بالذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const BATCH = 20;
const AI_PARALLEL = 3;
const MAX_BYTES = 10 * 1024 * 1024;

// Stepper step config
const STEPS = ["رفع الملف", "استخراج الأسئلة", "المراجعة", "النشر"] as const;

function UploadPage() {
  const { user } = Route.useRouteContext();
  const location = useLocation();
  const searchObj = (location.search ?? {}) as Record<string, unknown>;
  const unitId = typeof searchObj["unitId"] === "string"
    ? (searchObj["unitId"] as string)
    : (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("unitId") || undefined : undefined);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveDrafts);
  const review = useServerFn(reviewQuestions);
  const [hint, setHint] = useState("");
  const [subheadings, setSubheadings] = useState("");
  const [targetUnit, setTargetUnit] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<QRow[] | null>(null);
  const [step, setStep] = useState(0);   // 0=idle, 1=extract, 2=review, 3=done
  const [dragOver, setDragOver] = useState(false);
  const readAI = useServerFn(readQuestionsWithAI);

  useEffect(() => {
    if (!unitId) {
      setTargetUnit(null);
      return;
    }
    supabase
      .from("units")
      .select("id, name")
      .eq("id", unitId)
      .single()
      .then(({ data }) => {
        if (data) setTargetUnit(data);
      });
  }, [unitId]);

  async function readWithAI(text: string): Promise<ParsedQuestion[]> {
    setBusy("الملف غير مرتب، يقرؤه الذكاء الاصطناعي…");
    const chunks = chunkText(text);
    const results: ParsedQuestion[][] = new Array(chunks.length);
    let next = 0, done = 0;
    let failed: unknown = null;
    const worker = async () => {
      while (!failed && next < chunks.length) {
        const i = next++;
        const chunk = chunks[i];
        if (chunk === undefined) return;
        try { results[i] = (await readAI({ data: { text: chunk } })).questions; }
        catch (e) { failed ??= e; return; }
        setProgress(Math.round((++done / chunks.length) * 100));
      }
    };
    await Promise.all(Array.from({ length: Math.min(AI_PARALLEL, chunks.length) }, worker));
    if (failed) throw failed;
    return dedupeQuestions(results.flat());
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(CONVERT_PROMPT); toast.success("تم نسخ الأمر"); }
    catch { toast.error("تعذّر النسخ"); }
  }

  async function onFile(file: File) {
    if (file.size > MAX_BYTES) return void toast.error("الحد الأقصى 10 ميغابايت");
    const fileType = file.name.split(".").pop()?.toLowerCase();
    if (fileType !== "md") return void toast.error("ارفع ملف md فقط — استخدم زر نسخ الأمر لتحويل ملفك");
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const sig = String.fromCharCode(...head.slice(0, 4));
    if (head.includes(0) || sig.startsWith("%PDF") || sig.startsWith("PK") || sig.startsWith("MZ")) {
      return void toast.error("الملف ليس نصًا صالحًا بصيغة md");
    }
    try {
      setStep(1);
      setBusy("قراءة الملف…");
      const text = await extractText(file);
      let qs = parseQuestions(text);
      if (needsAiReading(text, qs)) qs = await readWithAI(text);
      if (qs.length > 2000) throw new Error("الحد الأقصى 2000 سؤال لكل ملف");
      if (!qs.length) { setBusy(null); setStep(0); return void toast.error("لم نجد أسئلة اختيار من متعدد في الملف"); }
      setProgress(0);

      const topicHint = (targetUnit?.name || hint).trim() || null;
      const parsedSubheadings = subheadings
        .split(/[,،\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const { uploadId, ids, duplicates } = await save({
        data: {
          fileName: file.name,
          fileType: fileType ?? "md",
          topicHint,
          unitId: unitId ?? undefined,
          questions: qs,
        },
      });
      toast.success(`وجدنا ${qs.length} سؤالًا${duplicates ? ` — حُذف ${duplicates} مكرر` : ""}`);
      if (!ids.length) { setBusy(null); setStep(0); return; }

      setStep(2);
      setBusy("التدقيق بالذكاء الاصطناعي والتصنيف…");
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
      let done = 0;
      for (const batch of batches) {
        try {
          await review({
            data: {
              ids: batch,
              topicHint,
              subheadings: parsedSubheadings.length ? parsedSubheadings : undefined,
            },
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "تعذّر التدقيق، راجع الأسئلة يدويًا");
          break;
        }
        done++;
        setProgress(Math.round((done / batches.length) * 100));
      }

      const { data, error } = await supabase
        .from("questions")
        .select("*, uploads(file_name, created_at)")
        .eq("upload_id", uploadId)
        .order("created_at");
      if (error) throw error;
      setRows(data ?? []);
      setStep(3);
      void qc.invalidateQueries({ queryKey: ["my-questions", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
      setStep(0);
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title="رفع الأسئلة" back />
      <main className="mx-auto max-w-lg px-4 py-6">

        {/* Stepper */}
        {(busy || rows) && (
          <div className="mb-6 flex items-center gap-1">
            {STEPS.map((label, i) => {
              const active = i === step - 1 || (i === 3 && step === 3);
              const done = i < step - 1 || step === 4;
              return (
                <div key={label} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done ? "bg-primary text-primary-foreground" :
                      active ? "bg-primary/20 text-primary ring-2 ring-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div className={`flex-1 h-0.5 mb-5 transition-colors ${i < step - 1 ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {rows ? (
          /* Review stage — question list */
          <div className="animate-fade-in space-y-4">
            <QuestionList rows={rows} setRows={setRows} />
            <Button
              id="upload-another-btn"
              variant="outline"
              className="h-12 w-full rounded-xl"
              onClick={() => { setRows(null); setStep(0); }}
            >
              رفع ملف آخر
            </Button>
            <Button variant="ghost" className="h-10 w-full rounded-xl" asChild>
              <Link to="/app/questions">عرض كل أسئلتي</Link>
            </Button>
          </div>
        ) : busy ? (
          /* Processing stage */
          <div className="animate-scale-in rounded-2xl border bg-card p-8 text-center shadow-card">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
              <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="font-semibold">{busy}</p>
            {progress > 0 && (
              <div className="mt-4">
                <Progress value={progress} className="h-2 rounded-full" />
                <p className="mt-2 text-xs text-muted-foreground">{progress}٪</p>
              </div>
            )}
          </div>
        ) : (
          /* Upload stage */
          <div className="animate-fade-in space-y-4">
            {/* Convert prompt helper */}
            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">لديك ملف PDF أو Word؟</p>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    انسخ الأمر أدناه وأرسله إلى Claude أو ChatGPT لتحويل ملفك إلى تنسيق md.
                  </p>
                </div>
              </div>
              <Button
                id="copy-prompt-btn"
                variant="outline"
                className="mt-3 h-10 w-full rounded-xl text-sm"
                onClick={copyPrompt}
              >
                <Copy className="h-4 w-4" />
                نسخ أمر التحويل
              </Button>
            </div>

            {/* Target unit indicator if uploading directly into a unit */}
            {unitId && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between shadow-xs animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                      رفع مباشر إلى الوحدة
                    </span>
                    <p className="font-bold text-foreground text-sm">
                      {targetUnit ? targetUnit.name : "جارٍ تحديد الوحدة…"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate({ to: "/app/upload" })}
                >
                  إلغاء التحديد
                </Button>
              </div>
            )}

            {/* Topic hint input */}
            {!unitId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">موضوع الملف (اختياري)</label>
                <Input
                  id="topic-hint-input"
                  placeholder="مثال: الشعر الجاهلي"
                  className="h-12 rounded-xl"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                />
              </div>
            )}

            {/* Subheadings categorization input */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  العناوين الفرعية للتصنيف الذكي (اختياري)
                </label>
                <span className="text-[11px] text-muted-foreground">مفصولة بفواصل</span>
              </div>
              <Input
                id="subheadings-input"
                placeholder="مثال: شعر المعلقات, الصعاليك, النثر الجاهلي, شعراء الغزل"
                className="h-12 rounded-xl"
                value={subheadings}
                onChange={(e) => setSubheadings(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                اكتب العناوين الفرعية التي تريد تصنيف الأسئلة تحتها. سيقوم الذكاء الاصطناعي بتصنيف كل سؤال بدقّة تحت العنوان الأنسب منها داخل هذه الوحدة.
              </p>
            </div>

            {/* Drop zone */}
            <label
              id="upload-dropzone"
              className={`flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-150 ${
                dragOver
                  ? "border-primary bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) onFile(f);
              }}
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                dragOver ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {dragOver ? (
                  <CloudUpload className="h-8 w-8" />
                ) : (
                  <FileUp className="h-8 w-8" />
                )}
              </div>
              <div>
                <p className="font-semibold">
                  {dragOver ? "أفلت الملف هنا" : "اسحب الملف هنا أو اضغط للاختيار"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">ملفات md فقط — حتى 10 ميغابايت</p>
              </div>
              <input
                type="file"
                accept=".md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>

            {/* What happens next */}
            <div className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="mb-3 text-sm font-semibold">ماذا يحدث بعد الرفع؟</p>
              <div className="space-y-2.5">
                {[
                  { icon: CheckCircle2, color: "text-emerald-500", text: "يستخرج النظام الأسئلة تلقائيًا" },
                  { icon: AlertTriangle, color: "text-amber-500", text: "يراجع الذكاء الاصطناعي الأخطاء" },
                  { icon: XCircle, color: "text-red-500", text: "تراجع الإجابات غير المؤكدة وتُصحّحها" },
                  { icon: CheckCircle2, color: "text-blue-500", text: "تنشر الأسئلة وتُضاف إلى وحداتك" },
                ].map(({ icon: Icon, color, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
