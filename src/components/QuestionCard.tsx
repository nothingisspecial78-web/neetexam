import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Clock,
  Sparkles,
  Pencil,
  Trash2,
  CheckCircle2,
  Bot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { ARABIC_LABELS } from "@/lib/parse-questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { suggestedAnswer } from "@/lib/question-rules";
import { questionHash } from "@/lib/question-hash";
export { isReady } from "@/lib/question-rules";

export type QRow = Tables<"questions"> & {
  uploads?: { file_name: string; created_at: string } | null;
};
type Suggestion = {
  fixed_question: string | null;
  fixed_options: string[] | null;
  reason: string | null;
  ai_index: number | null;
};

const DEFAULT_FLAG_META = {
  label: "قيد التدقيق",
  icon: Clock,
  color: "text-muted-foreground",
  bg: "bg-muted border-border",
};

export const FLAG_META: Record<
  string,
  { label: string; icon: typeof Check; color: string; bg: string }
> = {
  clean: {
    label: "سليم",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
  suggestion: {
    label: "اقتراح لغوي",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  wrong_answer: {
    label: "إجابة خاطئة",
    icon: X,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
  },
  no_answer: {
    label: "بلا إجابة",
    icon: HelpCircle,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  pending: DEFAULT_FLAG_META,
};

export const L = (i: number | null | undefined) =>
  i == null ? "؟" : ARABIC_LABELS[i] ?? String(i + 1);

export function QuestionCard({
  q,
  onChange,
  onDelete,
}: {
  q: QRow;
  onChange: (q: QRow) => void;
  onDelete?: () => void;
}) {
  const s = (q.ai_suggestion ?? {}) as Suggestion;
  const opts = q.options as string[];
  const [mode, setMode] = useState<"view" | "choose" | "edit">("view");
  const [text, setText] = useState(q.question_text);
  const [optText, setOptText] = useState(opts.join("\n"));
  const [saving, setSaving] = useState(false);
  const aiIndex = suggestedAnswer(q);

  async function save(patch: TablesUpdate<"questions">) {
    if (saving) return;
    setSaving(true);
    try {
      if (patch.question_text !== undefined || patch.options !== undefined) {
        patch.explanation = null;
        patch.content_hash = await questionHash({
          question: patch.question_text ?? q.question_text,
          options: (patch.options ?? opts) as string[],
        });
      }
      if (patch.correct_index !== undefined) patch.explanation = null;
      const { data, error } = await supabase
        .from("questions")
        .update(patch)
        .eq("id", q.id)
        .select("*")
        .single();
      if (error) throw error;
      onChange({ ...q, ...data });
      setMode("view");
    } catch {
      toast.error("تعذّر حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  }

  const flag = q.ai_flag ?? "pending";
  const flagMeta = FLAG_META[flag] ?? DEFAULT_FLAG_META;
  const FlagIcon = flagMeta.icon;

  return (
    <fieldset
      disabled={saving}
      className={`rounded-2xl border bg-card p-5 shadow-xs transition-all ${
        flag === "wrong_answer"
          ? "border-red-500/30 bg-red-50/20 dark:bg-red-950/10"
          : flag === "suggestion"
            ? "border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10"
            : "border-border/80"
      }`}
    >
      {/* Top Meta: Source file & Status Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${flagMeta.bg} ${flagMeta.color}`}
          >
            <FlagIcon className="h-3 w-3" />
            <span>{flagMeta.label}</span>
          </span>

          {q.status === "active" ? (
            <span className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold">
              منشور في الوحدات
            </span>
          ) : (
            <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
              مسودة
            </span>
          )}
        </div>

        {q.uploads && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" dir="ltr">
            {q.uploads.file_name}
          </span>
        )}
      </div>

      {/* Question Text */}
      <h3 className="font-reading text-base sm:text-lg font-medium leading-[1.8] text-foreground">
        <bdi dir="auto" className="qtext">
          {q.question_text}
        </bdi>
      </h3>

      {/* Options List */}
      <ol className="mt-3 space-y-1.5">
        {opts.map((o, i) => {
          const isCorrect = i === q.correct_index;
          return (
            <li
              key={i}
              className={`flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm leading-relaxed ${
                isCorrect
                  ? "bg-primary/10 border border-primary/30 text-primary font-bold shadow-2xs"
                  : "bg-muted/30 text-muted-foreground"
              }`}
            >
              <span className="font-mono text-xs font-bold shrink-0 mt-0.5">({L(i)})</span>
              <span className="flex-1">
                <bdi dir="auto">{o}</bdi>
              </span>
              {isCorrect && q.answer_source === "ai" && (
                <span
                  title="أجاب عنها الذكاء الاصطناعي"
                  className="flex items-center gap-1 text-[11px] font-medium text-primary px-1.5 py-0.5 rounded-md bg-primary/15"
                >
                  <Bot className="h-3 w-3" />
                  ذكاء
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mode: Choose Correct Answer */}
      {mode === "choose" && (
        <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border space-y-2">
          <p className="text-xs font-semibold text-foreground">اختر الإجابة الصحيحة لهذا السؤال:</p>
          <div className="flex flex-wrap gap-2">
            {opts.map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant={i === q.correct_index ? "default" : "outline"}
                className="font-bold text-xs"
                onClick={() =>
                  save({ correct_index: i, answer_source: "user", ai_flag: "clean" })
                }
              >
                ({L(i)}) خيار {i + 1}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Mode: Edit Text */}
      {mode === "edit" && (
        <div className="mt-4 space-y-3 p-3 rounded-xl bg-muted/40 border border-border">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">نص السؤال:</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="bg-card text-sm"
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              الخيارات (خيار في كل سطر):
            </label>
            <Textarea
              rows={4}
              value={optText}
              onChange={(e) => setOptText(e.target.value)}
              className="bg-card text-sm"
              placeholder="خيار في كل سطر"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const o = optText
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean);
                if (!text.trim() || o.length < 2 || o.length > 6) {
                  return void toast.error("اكتب نص السؤال مع خيارين إلى 6 خيارات");
                }
                const correct =
                  q.correct_index != null && q.correct_index < o.length ? q.correct_index : null;
                save({
                  question_text: text.trim(),
                  options: o,
                  correct_index: correct,
                  ai_flag:
                    correct === null
                      ? "no_answer"
                      : q.ai_flag === "suggestion"
                        ? "clean"
                        : q.ai_flag,
                  ...(correct === null ? { status: "draft" } : {}),
                });
              }}
            >
              حفظ التعديلات
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* AI Suggestions / Flags Box */}
      {mode === "view" && flag === "wrong_answer" && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-2.5">
          <div className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
            <span className="font-bold">تنبيه الذكاء الاصطناعي: </span>
            يرى أن الإجابة الصحيحة هي <strong>({L(s.ai_index)})</strong> وليست{" "}
            <span className="line-through">({L(q.correct_index)})</span>.
            {s.reason && <p className="mt-1 text-[11px] opacity-90">{s.reason}</p>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {aiIndex !== null && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-8"
                onClick={() =>
                  save({ correct_index: aiIndex, answer_source: "ai", ai_flag: "clean" })
                }
              >
                غيّر إلى ({L(aiIndex)})
              </Button>
            )}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5"
              onClick={() => save({ ai_flag: "clean" })}
            >
              <Check className="h-3.5 w-3.5" />
              إجابتي صحيحة ({L(q.correct_index)})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8"
              onClick={() => setMode("choose")}
            >
              اختر غيرها
            </Button>
          </div>
        </div>
      )}

      {mode === "view" && flag === "suggestion" && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold">اقتراح تحسين الصياغة والإملاء:</p>
            {s.fixed_question && <p className="font-reading text-sm">«{s.fixed_question}»</p>}
            {s.fixed_options && (
              <p className="text-[11px] opacity-80">{s.fixed_options.join(" · ")}</p>
            )}
            {s.reason && <p className="text-[11px] opacity-90">{s.reason}</p>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {(s.fixed_question || s.fixed_options) && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8"
                onClick={() =>
                  save({
                    question_text: s.fixed_question ?? q.question_text,
                    options: s.fixed_options ?? opts,
                    ai_flag: "clean",
                  })
                }
              >
                اقبل التصحيح
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setMode("edit")}
            >
              عدّل يدويًا
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8"
              onClick={() => save({ ai_flag: "clean" })}
            >
              تجاهل
            </Button>
          </div>
        </div>
      )}

      {mode === "view" && (flag === "no_answer" || flag === "pending") && (
        <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-2.5">
          <p className="text-xs text-blue-900 dark:text-blue-200">
            {flag === "pending"
              ? "لم يُدقّق هذا السؤال بعد."
              : "لا توجد إجابة محددة لهذا السؤال في الملف المرفوع."}
          </p>
          <div className="flex flex-wrap gap-2">
            {aiIndex !== null && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 gap-1.5"
                onClick={() =>
                  save({ correct_index: aiIndex, answer_source: "ai", ai_flag: "clean" })
                }
              >
                <Bot className="h-3.5 w-3.5" />
                دع الذكاء الاصطناعي يجيب ({L(aiIndex)})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setMode("choose")}
            >
              اختر بنفسي
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Actions Row */}
      {mode === "view" && (
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setMode("edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
              تعديل
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setMode("choose")}
            >
              تغيير الإجابة
            </Button>
          </div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}
