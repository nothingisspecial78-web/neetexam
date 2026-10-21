import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { shuffle, shuffleOptions, type PracticeQ } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface AttendedComprehensiveTestProps {
  userId: string;
}

interface TestHistoryItem {
  id: string;
  total: number;
  correct: number;
  duration_s: number;
  created_at: string;
  answer_review: Array<{
    question_id: string;
    question_text: string;
    options: string[];
    chosen_index: number;
    correct_index: number;
    is_correct: boolean;
    explanation?: string | null;
    topic_area?: string | null;
  }> | null;
}

const BANK_SIZE = 25;

export function AttendedComprehensiveTest({ userId }: AttendedComprehensiveTestProps) {
  const qc = useQueryClient();

  // Test state
  const [activeTest, setActiveTest] = useState<PracticeQ[] | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userChoices, setUserChoices] = useState<Array<{ q: PracticeQ; chosen: number; correct: boolean; ms: number }>>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [qStartTime, setQStartTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"test" | "history">("test");

  // 1. Fetch attended questions from units
  const { data: attendedData, isLoading: loadingAttended } = useQuery({
    queryKey: ["attended-questions", userId],
    queryFn: async () => {
      // Find all questions the student has answered in units
      const { data: ans, error: ansErr } = await supabase
        .from("answers")
        .select("question_id")
        .eq("owner_id", userId);

      if (ansErr) throw ansErr;
      const attendedQIds = Array.from(new Set((ans ?? []).map((a) => a.question_id)));

      if (!attendedQIds.length) {
        return [] as PracticeQ[];
      }

      // Fetch the actual questions belonging to the student
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, unit_id, question_text, options, correct_index, topic_area, explanation")
        .in("id", attendedQIds)
        .eq("status", "active")
        .not("unit_id", "is", null);

      if (qErr) throw qErr;

      return (qs ?? [])
        .filter((q) => q.correct_index !== null)
        .map((q) => ({
          id: q.id,
          unit_id: q.unit_id,
          question_text: q.question_text,
          options: q.options as string[],
          correct_index: q.correct_index!,
          topic_area: q.topic_area,
          explanation: q.explanation,
        }));
    },
  });

  // 2. Fetch past comprehensive tests history
  const { data: historyList, refetch: refetchHistory } = useQuery({
    queryKey: ["attended-test-history", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_results")
        .select("id, total, correct, duration_s, created_at, answer_review")
        .eq("owner_id", userId)
        .eq("mode", "comprehensive_25")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as TestHistoryItem[];
    },
  });

  const attendedQuestions = attendedData ?? [];
  const attendedCount = attendedQuestions.length;
  const isEligible = attendedCount >= BANK_SIZE;

  // Start a new 25-question test
  function handleStartTest() {
    if (!isEligible) return;
    const picked = shuffle(attendedQuestions).slice(0, BANK_SIZE).map((q) => shuffleOptions(q));
    setActiveTest(picked);
    setCurrentIdx(0);
    setUserChoices([]);
    setSelectedOption(null);
    setIsCompleted(false);
    const now = Date.now();
    setStartTime(now);
    setQStartTime(now);
  }

  // Answer selection and progression
  function handleSelectOption(optIdx: number) {
    if (selectedOption !== null) return; // already picked for this question
    setSelectedOption(optIdx);
  }

  async function handleNextQuestion() {
    if (selectedOption === null || !activeTest) return;

    const currentQ = activeTest[currentIdx]!;
    const isCorrect = selectedOption === currentQ.correct_index;
    const timeSpentMs = Date.now() - qStartTime;

    const updatedChoices = [
      ...userChoices,
      {
        q: currentQ,
        chosen: selectedOption,
        correct: isCorrect,
        ms: timeSpentMs,
      },
    ];
    setUserChoices(updatedChoices);
    setSelectedOption(null);

    if (currentIdx + 1 < activeTest.length) {
      setCurrentIdx(currentIdx + 1);
      setQStartTime(Date.now());
    } else {
      // Completed the 25 questions!
      await finishTest(updatedChoices);
    }
  }

  async function finishTest(finalChoices: typeof userChoices) {
    setIsCompleted(true);
    setSavingResult(true);
    const durationSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const correctCount = finalChoices.filter((c) => c.correct).length;

    const reviewData = finalChoices.map((c) => ({
      question_id: c.q.id,
      question_text: c.q.question_text,
      options: c.q.options,
      chosen_index: c.chosen,
      correct_index: c.q.correct_index,
      is_correct: c.correct,
      explanation: c.q.explanation,
      topic_area: c.q.topic_area,
    }));

    try {
      const unitIds = Array.from(new Set(finalChoices.map((c) => c.q.unit_id).filter(Boolean))) as string[];
      const { data: testRow, error: testErr } = await supabase
        .from("test_results")
        .insert({
          owner_id: userId,
          unit_ids: unitIds,
          total: BANK_SIZE,
          correct: correctCount,
          duration_s: durationSec,
          mode: "comprehensive_25",
          answer_review: reviewData,
        })
        .select("id")
        .single();

      if (testErr) throw testErr;

      // Save individual answers linked to test_result
      const answerRows = finalChoices.map((c) => ({
        owner_id: userId,
        question_id: c.q.id,
        test_result_id: testRow?.id ?? null,
        chosen_index: c.chosen,
        is_correct: c.correct,
        time_ms: c.ms,
        mode: "test",
      }));
      await supabase.from("answers").insert(answerRows);

      void refetchHistory();
      void qc.invalidateQueries({ queryKey: ["dashboard", userId] });
      void qc.invalidateQueries({ queryKey: ["mistakes-bank", userId] });
      toast.success("تم حفظ نتيجة الاختبار الشامل وسجل الإجابات بنجاح! 🎯");
    } catch {
      toast.error("تعذّر حفظ النتيجة في السجل");
    } finally {
      setSavingResult(false);
    }
  }

  if (loadingAttended) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <p className="text-xs text-muted-foreground">جارٍ فحص أسئلتك التي تم التدرّب عليها في الوحدات…</p>
      </div>
    );
  }

  // Active Test Execution View
  if (activeTest && !isCompleted) {
    const q = activeTest[currentIdx]!;
    const progressPct = Math.round(((currentIdx + 1) / BANK_SIZE) * 100);

    return (
      <div className="space-y-4 animate-fade-in" dir="rtl">
        {/* Top bar with progress and question counter */}
        <div className="rounded-2xl border bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-primary">
              <ClipboardCheck className="h-4 w-4" />
              اختبار المراجعة الشامل (بنك 25 سؤال)
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
              السؤال {currentIdx + 1} من {BANK_SIZE}
            </span>
          </div>
          <Progress value={progressPct} className="h-2 rounded-full" />
        </div>

        {/* Question Card */}
        <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-card space-y-6">
          {q.topic_area && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
              <Layers className="h-3 w-3" />
              {q.topic_area}
            </span>
          )}

          <h3 className="font-display text-lg sm:text-xl font-bold text-foreground leading-relaxed">
            {q.question_text}
          </h3>

          {/* Options */}
          <div className="grid gap-2.5">
            {q.options.map((opt, oIdx) => {
              const isSelected = selectedOption === oIdx;
              return (
                <button
                  key={oIdx}
                  type="button"
                  onClick={() => handleSelectOption(oIdx)}
                  className={`flex items-center gap-3 w-full p-4 rounded-2xl border text-right text-sm transition-all duration-150 ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/40 shadow-xs"
                      : "border-border bg-card/60 hover:bg-muted/60 hover:border-border/80"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + oIdx)}
                  </span>
                  <span className="leading-relaxed flex-1">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Action */}
          <div className="pt-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                if (confirm("هل تريد إنهاء الاختبار الآن؟ لن يتم حفظ هذه المحاولة.")) {
                  setActiveTest(null);
                }
              }}
            >
              إلغاء الاختبار
            </Button>
            <Button
              id="next-question-btn"
              disabled={selectedOption === null}
              className="h-11 rounded-xl px-6 font-semibold gap-2 shadow-xs"
              onClick={handleNextQuestion}
            >
              {currentIdx + 1 === BANK_SIZE ? "إنهاء وحساب النتيجة" : "السؤال التالي"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Test Completed Screen
  if (activeTest && isCompleted) {
    const correctCount = userChoices.filter((c) => c.correct).length;
    const scorePct = Math.round((correctCount / BANK_SIZE) * 100);
    const incorrectList = userChoices.filter((c) => !c.correct);

    return (
      <div className="space-y-6 animate-scale-in" dir="rtl">
        {/* Score Card */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-card space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent-600 text-white shadow-md">
            <Trophy className="h-10 w-10" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              اكتمل اختبار المراجعة الشامل (25 سؤالاً)
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {scorePct >= 90
                ? "ممتاز! استيعاب استثنائي وشامل 🌟"
                : scorePct >= 75
                  ? "أداء ممتاز! مراجعة متقنة ومثمرة 👏"
                  : scorePct >= 50
                    ? "أداء جيد، راجع الأسئلة الخاطئة أدناه 👍"
                    : "تحتاج إلى مزيد من التركيز والمراجعة"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              تم جمع 25 سؤالاً عشوائياً من مختلف وحداتك الدراسية السابقة.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 py-2 border-y border-border/60">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-2xl font-bold font-display text-primary">{scorePct}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">الدرجة</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-2xl font-bold font-display text-emerald-600 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-5 w-5" />
                {correctCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">صحيحة</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <p className="text-2xl font-bold font-display text-red-600 flex items-center justify-center gap-1">
                <XCircle className="h-5 w-5" />
                {BANK_SIZE - correctCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">خاطئة</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Button
              className="w-full sm:w-auto h-11 rounded-xl font-semibold gap-2 shadow-xs"
              onClick={handleStartTest}
            >
              <RotateCcw className="h-4 w-4" />
              إجراء اختبار شامل جديد (25 سؤالاً)
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto h-11 rounded-xl font-semibold"
              onClick={() => setActiveTest(null)}
            >
              العودة للقسم الرئيسي
            </Button>
          </div>
        </div>

        {/* Incorrect Questions Detailed Breakdown */}
        {incorrectList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="font-display text-base font-bold text-foreground">
                الأسئلة الخاطئة وإجاباتها الصحيحة ({incorrectList.length}):
              </h3>
            </div>

            <div className="space-y-3">
              {incorrectList.map((c, idx) => (
                <div key={idx} className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600">
                      خطأ #{idx + 1}
                    </span>
                    {c.q.topic_area && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {c.q.topic_area}
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-sm leading-relaxed text-foreground">
                    {c.q.question_text}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300">
                      <span className="font-bold block mb-1">إجابتك التي اخترتها:</span>
                      {c.q.options[c.chosen] ?? "لم تختر"}
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      <span className="font-bold block mb-1">الإجابة الصحيحة:</span>
                      {c.q.options[c.q.correct_index]}
                    </div>
                  </div>

                  {c.q.explanation && (
                    <div className="p-3 rounded-xl bg-muted/50 border text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground block mb-0.5">الشرح والتوضيح:</span>
                      {c.q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Section View: Ready Card or Not-Eligible banner, plus History tabs
  return (
    <div className="space-y-5" dir="rtl">
      {/* Sub Tabs: Test or History */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("test")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "test"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          الاختبار الشامل (25 سؤال)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <History className="h-4 w-4" />
          سجل الاختبارات السابقة ({historyList?.length ?? 0})
        </button>
      </div>

      {activeTab === "test" && (
        <div className="space-y-4">
          {!isEligible ? (
            /* Progress to unlock */
            <div className="rounded-2xl border border-dashed border-border/80 bg-card p-6 sm:p-8 text-center space-y-4 shadow-card">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ClipboardCheck className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">
                  اختبار المراجعة الشامل (25 سؤالاً)
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  يختار هذا النظام 25 سؤالاً عشوائياً من مختلف وحداتك الدراسية، حصرياً من الأسئلة التي قمت بحلها وتدرّبت عليها سابقاً.
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>الأسئلة المُتدرَّب عليها حتى الآن</span>
                  <span className="text-primary font-bold">{attendedCount} / {BANK_SIZE}</span>
                </div>
                <Progress value={Math.min(100, (attendedCount / BANK_SIZE) * 100)} className="h-2 rounded-full" />
                <p className="text-[11px] text-muted-foreground text-center">
                  تحتاج إلى التدرّب على {BANK_SIZE - attendedCount} أسئلة إضافية في أي وحدة لفتح هذا الاختبار.
                </p>
              </div>
            </div>
          ) : (
            /* Ready to start test */
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <ClipboardCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold">جاهز لاختبار المراجعة الشامل!</h3>
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        متاح
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground max-w-lg">
                      لديك {attendedCount} سؤالاً تم التدرّب عليها في وحداتك المختلفة. سنختار منها بنكاً من 25 سؤالاً عشوائياً لاختبار ثبات معلوماتك.
                    </p>
                  </div>
                </div>

                <Button
                  id="start-comprehensive-25-btn"
                  className="h-12 rounded-xl px-6 font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md shrink-0 transition-transform active:scale-95"
                  onClick={handleStartTest}
                >
                  <Play className="h-4 w-4 fill-current" />
                  بدء اختبار الـ 25 سؤالاً
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {!historyList?.length ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground text-xs shadow-xs">
              لم تجرِ أي اختبار شامل بعد. ابدأ اختبارك الأول ليتم تسجيل نتيجتك وأخطائك هنا.
            </div>
          ) : (
            historyList.map((item) => {
              const scorePct = Math.round((item.correct / item.total) * 100);
              const isExpanded = expandedHistoryId === item.id;
              const formattedDate = new Date(item.created_at).toLocaleDateString("ar-SA", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const wrongs = (item.answer_review ?? []).filter((r) => !r.is_correct);

              return (
                <div key={item.id} className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                          scorePct >= 75
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {scorePct}%
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {item.correct} من أصل {item.total} سؤال صحيح
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{formattedDate}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.duration_s} ثانية
                          </span>
                        </p>
                      </div>
                    </div>

                    {wrongs.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1 rounded-xl"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? (
                          <>
                            إخفاء الأخطاء ({wrongs.length})
                            <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            مراجعة الأخطاء ({wrongs.length})
                            <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Expanded breakdown of mistakes in past test */}
                  {isExpanded && wrongs.length > 0 && (
                    <div className="pt-2 border-t space-y-2.5 animate-fade-in">
                      {wrongs.map((w, wIdx) => (
                        <div key={wIdx} className="rounded-xl bg-muted/40 p-3 text-xs space-y-2">
                          <p className="font-semibold text-foreground">{w.question_text}</p>
                          <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300">
                              <span className="font-bold block">إجابتك:</span>
                              {w.options[w.chosen_index] ?? "لم تختر"}
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              <span className="font-bold block">الصحيحة:</span>
                              {w.options[w.correct_index]}
                            </div>
                          </div>
                          {w.explanation && (
                            <p className="text-muted-foreground text-[10px]">
                              <strong>الشرح:</strong> {w.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
