import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  BookOpen,
  Swords,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QuizRunner, type QuizAnswer } from "@/components/QuizRunner";
import { shuffle, shuffleOptions, saveAnswer, type PracticeQ } from "@/lib/units";
import { Button } from "@/components/ui/button";

interface MistakesBankProps {
  userId: string;
}

export function MistakesBank({ userId }: MistakesBankProps) {
  const qc = useQueryClient();
  const [practicing, setPracticing] = useState(false);
  const [practiceKey, setPracticeKey] = useState(Date.now());
  const [quizResults, setQuizResults] = useState<QuizAnswer[] | null>(null);
  const pending = useRef<Promise<void>[]>([]);

  // 1. Fetch answers to discover active mistakes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mistakes-bank", userId],
    queryFn: async () => {
      // Get all answers ordered newest first
      const { data: answers, error: ansErr } = await supabase
        .from("answers")
        .select("question_id, is_correct, created_at, mode")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (ansErr) throw ansErr;

      // Identify question IDs whose latest answer was incorrect
      const latestMap = new Map<string, { is_correct: boolean; mode: string }>();
      for (const a of answers ?? []) {
        if (!latestMap.has(a.question_id)) {
          latestMap.set(a.question_id, { is_correct: a.is_correct, mode: a.mode });
        }
      }

      const activeMistakeIds = Array.from(latestMap.entries())
        .filter(([_, v]) => !v.is_correct)
        .map(([qid]) => qid);

      if (!activeMistakeIds.length) {
        return { questions: [] as PracticeQ[], modes: new Map<string, string>() };
      }

      // Fetch the actual questions
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, unit_id, question_text, options, correct_index, topic_area, explanation")
        .in("id", activeMistakeIds);

      if (qErr) throw qErr;

      const questions: PracticeQ[] = (qs ?? [])
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

      const modesMap = new Map<string, string>();
      for (const [qid, v] of latestMap.entries()) {
        modesMap.set(qid, v.mode);
      }

      return { questions, modes: modesMap };
    },
  });

  const questions = data?.questions ?? [];
  const modes = data?.modes ?? new Map<string, string>();

  function handleStartPractice() {
    if (!questions.length) return;
    setQuizResults(null);
    setPracticeKey(Date.now());
    setPracticing(true);
  }

  function handleAnswer(a: QuizAnswer) {
    pending.current.push(
      saveAnswer({
        question_id: a.q.id,
        chosen_index: a.chosen,
        is_correct: a.correct,
        time_ms: a.ms,
        mode: "practice",
      }).catch(() => {
        toast.error("تعذّر حفظ الإجابة");
      }),
    );
  }

  async function handleDone(all: QuizAnswer[]) {
    setQuizResults(all);
    await Promise.all(pending.current);
    pending.current = [];
    void refetch();
    void qc.invalidateQueries({ queryKey: ["units", userId] });
    void qc.invalidateQueries({ queryKey: ["dashboard", userId] });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <p className="text-xs text-muted-foreground">جارٍ تجميع بنك الأخطاء من الساحة والوحدات…</p>
      </div>
    );
  }

  // Active training runner
  if (practicing) {
    if (quizResults) {
      const fixedCount = quizResults.filter((r) => r.correct).length;
      const total = quizResults.length;
      return (
        <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-card space-y-6 animate-scale-in">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-md">
            <Trophy className="h-10 w-10" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              اكتملت جولة تصحيح الأخطاء
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {fixedCount === total
                ? "ممتاز! تم تصحيح جميع الأخطاء بنجاح 🎉"
                : `تم تصحيح ${fixedCount} من أصل ${total} سؤالاً`}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              الأسئلة التي أجبت عليها بشكل صحيح تم إزالتها من بنك الأخطاء تلقائيًا.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/60">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-2xl font-bold font-display text-emerald-600 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-5 w-5" />
                {fixedCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">تم تصحيحها</p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <p className="text-2xl font-bold font-display text-red-600 flex items-center justify-center gap-1">
                <XCircle className="h-5 w-5" />
                {total - fixedCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">بحاجة لإعادة التدريب</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Button
              className="w-full sm:w-auto h-11 rounded-xl font-semibold gap-2"
              onClick={() => {
                setQuizResults(null);
                setPracticing(false);
              }}
            >
              العودة إلى بنك الأخطاء
            </Button>
            {total - fixedCount > 0 && (
              <Button
                variant="outline"
                className="w-full sm:w-auto h-11 rounded-xl font-semibold gap-2"
                onClick={handleStartPractice}
              >
                <RotateCcw className="h-4 w-4" />
                تكرار الأسئلة المتبقية
              </Button>
            )}
          </div>
        </div>
      );
    }

    const shuffledQuestions = shuffle(questions).map((q) => shuffleOptions(q));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-card p-3 rounded-2xl border">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold">جولة تدريب بنك الأخطاء</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => setPracticing(false)}
          >
            إنهاء الجولة
          </Button>
        </div>

        <QuizRunner
          key={practiceKey}
          questions={shuffledQuestions}
          feedback={true}
          onAnswer={handleAnswer}
          onDone={handleDone}
        />
      </div>
    );
  }

  // Empty state: No mistakes
  if (!questions.length) {
    return (
      <div className="animate-scale-in flex flex-col items-center rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 p-8 text-center shadow-card">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="font-display text-lg font-bold text-foreground">
          بنك الأخطاء فارغ — أحسنت! 🎉
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
          لا توجد أسئلة أخطأت بها دون تصحيح، سواء من منافسات الساحة أو من تدريبات الوحدات.
        </p>
      </div>
    );
  }

  // Active mistakes list
  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold">بنك الأسئلة الخاطئة</h2>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  {questions.length} سؤال
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                تم جمع هذه الأسئلة من أخطائك في منافسات الساحة وتدريب الوحدات، لتتدرّب عليها بشكل متكرر حتى تتقنها تمامًا.
              </p>
            </div>
          </div>
          <Button
            id="start-mistakes-practice-btn"
            className="h-11 rounded-xl px-5 font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm shrink-0"
            onClick={handleStartPractice}
          >
            <Play className="h-4 w-4 fill-current" />
            تدرّب على الأخطاء ({questions.length})
          </Button>
        </div>
      </div>

      {/* List of questions */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-muted-foreground">
          قائمة الأسئلة التي تحتاج للمراجعة ({questions.length}):
        </p>
        {questions.map((q, idx) => {
          const originMode = modes.get(q.id);
          return (
            <div
              key={q.id}
              className="rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-amber-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      #{idx + 1}
                    </span>
                    {originMode === "arena" ? (
                      <span className="flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                        <Swords className="h-3 w-3" />
                        من الساحة (منافسة)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        <BookOpen className="h-3 w-3" />
                        من الوحدات الدراسية
                      </span>
                    )}
                    {q.topic_area && (
                      <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Layers className="h-3 w-3" />
                        {q.topic_area}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {q.question_text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
