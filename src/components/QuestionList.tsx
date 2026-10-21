import { useEffect, useMemo, useRef, useState } from "react";
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
  ArrowDown,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FLAG_META, isReady, QuestionCard, type QRow } from "./QuestionCard";
import { suggestedAnswer } from "@/lib/question-rules";
import { publishQuestions, reviewQuestions } from "@/lib/questions.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

const FILTERS = ["all", "clean", "suggestion", "wrong_answer", "no_answer", "pending"] as const;
const PAGE_SIZE = 30;

export function QuestionList({
  rows,
  setRows,
  search,
  userId,
}: {
  rows: QRow[];
  setRows: (r: QRow[]) => void;
  search?: boolean;
  userId?: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerTarget = useRef<HTMLDivElement | null>(null);

  const publishFn = useServerFn(publishQuestions);
  const reviewFn = useServerFn(reviewQuestions);
  const qc = useQueryClient();

  const update = (q: QRow) => setRows(rows.map((r) => (r.id === q.id ? q : r)));

  async function handleDeleteQuestion(q: QRow) {
    try {
      const { error } = await supabase.from("questions").delete().eq("id", q.id);
      if (error) throw error;
      setRows(rows.filter((r) => r.id !== q.id));
      toast.success("تم حذف السؤال بنجاح");
      void qc.invalidateQueries({ queryKey: ["my-questions"] });
      void qc.invalidateQueries({ queryKey: ["units"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("تعذّر حذف السؤال");
    }
  }

  async function handleDeleteAllQuestions() {
    setBusy(true);
    try {
      let q = supabase.from("questions").delete();
      if (userId) {
        q = q.eq("owner_id", userId);
      } else if (rows[0]?.owner_id) {
        q = q.eq("owner_id", rows[0].owner_id);
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (u.user?.id) q = q.eq("owner_id", u.user.id);
      }
      const { error } = await q;
      if (error) throw error;
      setRows([]);
      toast.success("تم حذف جميع الأسئلة بنجاح 🗑️");
      void qc.invalidateQueries({ queryKey: ["my-questions"] });
      void qc.invalidateQueries({ queryKey: ["units"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("تعذّر حذف الأسئلة، حاول مجددًا");
    } finally {
      setBusy(false);
      setConfirmDeleteAllOpen(false);
    }
  }

  // Reset visible count on filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, term]);

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

  const displayed = shown.slice(0, visibleCount);
  const hasMore = visibleCount < shown.length;

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, shown.length));
        }
      },
      { rootMargin: "300px" }
    );
    const el = observerTarget.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, shown.length]);

  const count = (f: string) =>
    rows.filter((r) => (f === "pending" ? r.ai_flag === null : r.ai_flag === f)).length;

  const noAnswer = rows.filter((r) => r.ai_flag === "no_answer" && suggestedAnswer(r) !== null);
  const wrongAnswer = rows.filter((r) => r.status === "draft" && r.ai_flag === "wrong_answer" && r.correct_index !== null);
  const ready = rows.filter((r) => r.status === "draft" && isReady(r));
  const pending = rows.filter((r) => r.status === "draft" && r.ai_flag === null);

  async function acceptAllUserAnswers() {
    if (busy || !wrongAnswer.length) return;
    setBusy(true);
    try {
      const ids = wrongAnswer.map((r) => r.id);
      const { error } = await supabase
        .from("questions")
        .update({ ai_flag: "clean" })
        .in("id", ids);
      if (error) throw error;
      setRows(rows.map((r) => (ids.includes(r.id) ? { ...r, ai_flag: "clean" } : r)));
      toast.success(`تم تأكيد صحة إجاباتك لـ ${ids.length} سؤالًا بنجاح! 🎉`);
      void qc.invalidateQueries({ queryKey: ["my-questions"] });
    } catch {
      toast.error("تعذّر حفظ التعديلات");
    } finally {
      setBusy(false);
    }
  }

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

      {/* Banner: Approve All User Answers */}
      {wrongAnswer.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0" />
            <span>
              هناك <strong>{wrongAnswer.length}</strong> سؤالاً اعتبرها التدقيق بحاجة لمراجعة. إذا كانت إجاباتك الأصلية في الملف صحيحة ومؤكدة، يمكنك اعتمادها بنقرة واحدة:
            </span>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl self-start sm:self-auto shrink-0 gap-1.5"
            onClick={acceptAllUserAnswers}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            اعتماد جميع إجاباتي الأصلية ({wrongAnswer.length})
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
            id="publish-ready-btn"
            size="lg"
            className="w-full h-14 rounded-2xl font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-2 transition-transform active:scale-[0.98]"
            onClick={publish}
          >
            <Send className="h-5 w-5 rtl:rotate-180" />
            <span className="text-sm sm:text-base font-bold">انشر {ready.length} سؤالًا جاهزًا في الوحدات</span>
          </Button>
        </div>
      )}

      {/* Questions Feed with 30-item progressive loading */}
      <div className="space-y-3 pt-1">
        {/* Top actions bar: Total count and Delete All button */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between px-1 py-1 text-xs text-muted-foreground">
            <span>إجمالي الأسئلة: <strong className="text-foreground">{rows.length}</strong></span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 gap-1 rounded-lg"
              onClick={() => setConfirmDeleteAllOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>حذف جميع الأسئلة ({rows.length})</span>
            </Button>
          </div>
        )}

        {displayed.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            onChange={update}
            onDelete={() => handleDeleteQuestion(q)}
          />
        ))}

        {hasMore && (
          <div ref={observerTarget} className="py-6 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
              <span>يتم عرض {displayed.length} من أصل {shown.length} سؤالاً (يتم التحميل تلقائيًا مع التمرير)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1.5 h-9"
              onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, shown.length))}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              <span>تحميل المزيد ({shown.length - visibleCount} متبقٍ)</span>
            </Button>
          </div>
        )}

        {shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-10 text-center space-y-2">
            <Layers className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-foreground text-sm">لا توجد أسئلة تطابق الفلتر المحدد</p>
            <p className="text-xs text-muted-foreground">جرّب تغيير خيارات البحث أو التصفية أعلاه.</p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Delete All */}
      <Dialog open={confirmDeleteAllOpen} onOpenChange={setConfirmDeleteAllOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              حذف جميع الأسئلة والمسودات
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            هل أنت متأكد من حذف كافة الأسئلة والمسودات ({rows.length} سؤال)؟ سيتم حذف جميع الأسئلة الخاصة بك بشكل نهائي ولن يمكن استرجاعها.
          </p>
          <DialogFooter className="mt-6 flex flex-row gap-2 justify-end">
            <Button
              variant="outline"
              disabled={busy}
              className="rounded-xl"
              onClick={() => setConfirmDeleteAllOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              className="rounded-xl gap-1.5"
              onClick={handleDeleteAllQuestions}
            >
              <Trash2 className="h-4 w-4" />
              <span>{busy ? "جارٍ الحذف…" : "تأكيد حذف الكل"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}
