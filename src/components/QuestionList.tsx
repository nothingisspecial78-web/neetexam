import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Bot,
  Send,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FLAG_META, isReady, QuestionCard, type QRow } from "./QuestionCard";
import { suggestedAnswer } from "@/lib/question-rules";
import { publishQuestions, reviewQuestions } from "@/lib/questions.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

const FILTERS = ["all", "clean", "suggestion", "wrong_answer", "no_answer", "pending"] as const;

export function QuestionList({
  rows,
  setRows,
  search,
}: {
  rows: QRow[];
  setRows: (r: QRow[]) => void;
  search?: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const publishFn = useServerFn(publishQuestions);
  const reviewFn = useServerFn(reviewQuestions);
  const qc = useQueryClient();

  const update = (q: QRow) => setRows(rows.map((r) => (r.id === q.id ? q : r)));

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "all" ||
            (filter === "pending" ? r.ai_flag === null : r.ai_flag === filter)) &&
          (!term || r.question_text.includes(term)),
      ),
    [rows, filter, term],
  );

  const count = (f: string) =>
    rows.filter((r) => (f === "pending" ? r.ai_flag === null : r.ai_flag === f)).length;

  const noAnswer = rows.filter((r) => r.ai_flag === "no_answer" && suggestedAnswer(r) !== null);
  const ready = rows.filter((r) => r.status === "draft" && isReady(r));
  const pending = rows.filter((r) => r.status === "draft" && r.ai_flag === null);

  async function retryReview() {
    if (busy || !pending.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < pending.length; i += 20) {
        await reviewFn({
          data: { ids: pending.slice(i, i + 20).map((q) => q.id), topicHint: null },
        });
      }
      toast.success("تم الانتهاء من تدقيق الأسئلة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التدقيق");
    } finally {
      const refreshed = await supabase
        .from("questions")
        .select("*")
        .in(
          "id",
          pending.map((q) => q.id),
        );
      if (refreshed.error) toast.error("تعذّر تحديث الأسئلة");
      else {
        const byId = new Map((refreshed.data ?? []).map((q) => [q.id, q]));
        setRows(rows.map((q) => ({ ...q, ...byId.get(q.id) })));
      }
      void qc.invalidateQueries({ queryKey: ["my-questions"] });
      setBusy(false);
    }
  }

  async function aiAnswerAll() {
    if (busy) return;
    setBusy(true);
    try {
      const results = await Promise.all(
        noAnswer.map(async (r) => {
          const { data, error } = await supabase
            .from("questions")
            .update({
              correct_index: suggestedAnswer(r),
              answer_source: "ai",
              ai_flag: "clean",
            })
            .eq("id", r.id)
            .select("*")
            .single();
          return { data, error };
        }),
      );
      const saved = new Map(results.filter((r) => r.data).map((r) => [r.data?.id, r.data]));
      setRows(rows.map((r) => ({ ...r, ...saved.get(r.id) })));
      if (results.some((x) => x.error)) toast.error("تعذّر حفظ بعض الإجابات");
      else toast.success(`أجاب الذكاء الاصطناعي عن ${noAnswer.length} سؤالًا`);
    } catch {
      toast.error("تعذّر حفظ الإجابات");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (busy || !ready.length) return;
    setBusy(true);
    try {
      const { ids } = await publishFn({ data: { ids: ready.map((r) => r.id) } });
      setRows(rows.map((r) => (ids.includes(r.id) ? { ...r, status: "active" } : r)));
      void qc.invalidateQueries({ queryKey: ["my-questions"] });
      void qc.invalidateQueries({ queryKey: ["units"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`تم نشر ${ids.length} سؤالًا في وحداتك بنجاح! 🎉`);
    } catch {
      toast.error("تعذّر النشر، حاول مجددًا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {/* Search Input */}
      {search && (
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث في نص الأسئلة والخيارات…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="ps-9 h-11 rounded-xl bg-card"
          />
        </div>
      )}

      {/* Filter Chips Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map((f) => {
          const isActive = filter === f;
          const meta = FLAG_META[f];
          const badgeCount = f === "all" ? rows.length : count(f);

          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                isActive
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span>{f === "all" ? "الكل" : meta?.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-white/25 text-white" : "bg-muted text-foreground"
                }`}
              >
                {badgeCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Banner: AI Answer All */}
      {noAnswer.length > 0 && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs leading-relaxed text-blue-950 dark:text-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600 shrink-0" />
            <span>
              يوجد <strong>{noAnswer.length}</strong> سؤالًا بلا إجابة مؤكدة. هل تود أن يجيب عنها
              الذكاء الاصطناعي؟
            </span>
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl self-start sm:self-auto shrink-0 gap-1.5"
            onClick={aiAnswerAll}
          >
            <Sparkles className="h-3.5 w-3.5" />
            أجب عنها كلها تلقائيًا
          </Button>
        </div>
      )}

      {/* Re-review Pending Questions */}
      {pending.length > 0 && (
        <Button
          variant="outline"
          className="w-full rounded-xl gap-2 text-xs font-semibold"
          onClick={retryReview}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>أعد تدقيق {pending.length} سؤالًا معلقًا</span>
        </Button>
      )}

      {/* Sticky Publish Banner */}
      {ready.length > 0 && (
        <div className="sticky top-16 z-30 py-1">
          <Button
            size="lg"
            className="w-full h-12 rounded-2xl font-bold shadow-md bg-gradient-to-l from-primary-700 to-primary-500 text-white gap-2"
            onClick={publish}
          >
            <Send className="h-4 w-4" />
            <span>انشر {ready.length} سؤالًا جاهزًا في الوحدات</span>
          </Button>
        </div>
      )}

      {/* Questions Feed */}
      <div className="space-y-3 pt-1">
        {shown.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            onChange={update}
            onDelete={() => setRows(rows.filter((r) => r.id !== q.id))}
          />
        ))}

        {shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-10 text-center space-y-2">
            <Layers className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-foreground text-sm">لا توجد أسئلة تطابق الفلتر المحدد</p>
            <p className="text-xs text-muted-foreground">جرّب تغيير خيارات البحث أو التصفية أعلاه.</p>
          </div>
        )}
      </div>
    </fieldset>
  );
}
