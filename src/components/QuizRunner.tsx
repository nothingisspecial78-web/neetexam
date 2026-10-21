import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  Check,
  X,
  Clock,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
} from "lucide-react";
import { explainAnswer } from "@/lib/explain.functions";
import { Button } from "@/components/ui/button";
import { ARABIC_LABELS } from "@/lib/parse-questions";
import type { PracticeQ } from "@/lib/units";

export type QuizAnswer = { q: PracticeQ; chosen: number | null; correct: boolean; ms: number };

export function QuizRunner({
  questions,
  feedback,
  onAnswer,
  onDone,
  deadline,
  autoAdvanceOnCorrect = true,
}: {
  questions: PracticeQ[];
  feedback: boolean;
  onAnswer?: (a: QuizAnswer) => void;
  onDone: (answers: QuizAnswer[]) => void;
  deadline?: number | null;
  autoAdvanceOnCorrect?: boolean;
}) {
  const [i, setI] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<number, QuizAnswer>>({});
  const [now, setNow] = useState(Date.now());
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const started = useRef(Date.now());
  const finished = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = questions[i];
  const currentAnswer = answersMap[i];
  const isAnswered = currentAnswer !== undefined;
  const picked = isAnswered ? currentAnswer.chosen : null;

  const explainFn = useServerFn(explainAnswer);
  const [explain, setExplain] = useState<{
    loading: boolean;
    text?: string;
    error?: string;
  } | null>(null);

  // Clear timer when unmounting or switching questions
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, []);

  async function askExplain() {
    if (!q) return;
    if (q.explanation) return setExplain({ loading: false, text: q.explanation });
    setExplain({ loading: true });
    try {
      const r = await explainFn({ data: { questionId: q.id } });
      q.explanation = r.text;
      setExplain({ loading: false, text: r.text });
    } catch (e) {
      setExplain({
        loading: false,
        error: e instanceof Error ? e.message : "تعذّر الحصول على الشرح الآن",
      });
    }
  }

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  function complete(allAnswers: QuizAnswer[]) {
    if (finished.current) return;
    finished.current = true;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setIsAutoAdvancing(false);
    onDone(allAnswers);
  }

  useEffect(() => {
    if (deadline && now >= deadline) {
      const all = questions.map((_, idx) => answersMap[idx]).filter(Boolean) as QuizAnswer[];
      complete(all);
    }
  }, [now, deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToNext(map = answersMap) {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setIsAutoAdvancing(false);
    setExplain(null);
    started.current = Date.now();

    if (i + 1 >= questions.length) {
      const all = questions.map((_, idx) => map[idx]).filter(Boolean) as QuizAnswer[];
      complete(all);
    } else {
      setI((prev) => prev + 1);
    }
  }

  function goToPrevious() {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setIsAutoAdvancing(false);
    if (i > 0) {
      setExplain(null);
      started.current = Date.now();
      setI((prev) => prev - 1);
    }
  }

  function jumpTo(targetIdx: number) {
    if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === i) return;
    const maxReached = Math.max(i, ...Object.keys(answersMap).map(Number), 0);
    if (targetIdx <= maxReached + 1 || answersMap[targetIdx]) {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
      setIsAutoAdvancing(false);
      setExplain(null);
      started.current = Date.now();
      setI(targetIdx);
    }
  }

  function choose(idx: number) {
    if (!q || isAnswered || finished.current) return;

    const isCorrect = idx === q.correct_index;
    const a: QuizAnswer = {
      q,
      chosen: idx,
      correct: isCorrect,
      ms: Date.now() - started.current,
    };

    const nextMap = { ...answersMap, [i]: a };
    setAnswersMap(nextMap);
    onAnswer?.(a);

    if (!feedback) {
      goToNext(nextMap);
      return;
    }

    // If correct and autoAdvanceOnCorrect is enabled: auto-advance to next question smoothly
    if (isCorrect && autoAdvanceOnCorrect) {
      setIsAutoAdvancing(true);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => {
        setIsAutoAdvancing(false);
        goToNext(nextMap);
      }, 750);
    }
  }

  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  if (!q) {
    return <p className="py-12 text-center text-muted-foreground">لا توجد أسئلة متاحة في هذا الاختبار.</p>;
  }

  const answeredCount = Object.keys(answersMap).length;
  const isLastQuestion = i + 1 >= questions.length;

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Top Header / Navigation & Progress Meter */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs sm:text-sm font-semibold">
          {/* Question count and Back button */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={i === 0}
              onClick={goToPrevious}
              className="h-8 rounded-xl px-2.5 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              title="العودة للسؤال السابق"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
              <span>السابق</span>
            </Button>

            <span className="flex h-8 px-3 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs sm:text-sm">
              السؤال {i + 1} من {questions.length}
            </span>

            {isAnswered && !isLastQuestion && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToNext()}
                className="h-8 rounded-xl px-2.5 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="الانتقال للسؤال التالي"
              >
                <span>التالي</span>
                <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
              </Button>
            )}

            {q.from_name && (
              <span className="hidden sm:inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground font-medium">
                مشارك من {q.from_name}
              </span>
            )}
          </div>

          {left !== null && (
            <div
              dir="ltr"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-sm font-bold shadow-xs ${
                left <= 15
                  ? "bg-red-500/15 text-red-600 animate-pulse"
                  : left <= 30
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-muted text-foreground"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-l from-primary-600 to-primary-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Step Pills (Quick navigator to jump to previous questions) */}
        {questions.length > 1 && questions.length <= 40 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
            {questions.map((_, idx) => {
              const ans = answersMap[idx];
              const isCurrent = idx === i;
              let pillClass = "bg-muted/70 text-muted-foreground border-border/60 hover:bg-muted";

              if (ans) {
                if (ans.correct) {
                  pillClass = isCurrent
                    ? "bg-emerald-600 text-white font-bold ring-2 ring-emerald-500/50"
                    : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
                } else {
                  pillClass = isCurrent
                    ? "bg-red-600 text-white font-bold ring-2 ring-red-500/50"
                    : "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
                }
              } else if (isCurrent) {
                pillClass = "bg-primary text-primary-foreground font-bold ring-2 ring-primary/40";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => jumpTo(idx)}
                  className={`flex h-7 min-w-7 px-1.5 items-center justify-center rounded-lg text-xs font-semibold border transition-all cursor-pointer ${pillClass}`}
                  title={`الانتقال للسؤال ${idx + 1}`}
                >
                  {ans ? (
                    ans.correct ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )
                  ) : (
                    idx + 1
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
        {q.from_name && (
          <span className="sm:hidden mb-3 inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            مشارك من {q.from_name}
          </span>
        )}
        <h2 className="font-reading text-lg sm:text-xl font-medium leading-[1.85] text-foreground">
          <bdi dir="auto" className="qtext">
            {q.question_text}
          </bdi>
        </h2>
      </div>

      {/* MCQ Options List */}
      <div className="grid gap-3">
        {q.options.map((o, idx) => {
          const letter = ARABIC_LABELS[idx] ?? String(idx + 1);
          const isCorrect = idx === q.correct_index;
          const isChosen = idx === picked;

          let cardStyle =
            "border border-border/80 bg-card hover:border-primary/50 hover:bg-primary-50/20 active:scale-[0.99] text-foreground";
          let badgeStyle = "bg-muted text-muted-foreground";

          if (picked !== null) {
            if (isCorrect) {
              cardStyle =
                "border-2 border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-semibold shadow-xs";
              badgeStyle = "bg-emerald-600 text-white font-bold";
            } else if (isChosen) {
              cardStyle =
                "border-2 border-red-500 bg-red-500/10 text-red-950 dark:text-red-100 font-semibold shadow-xs";
              badgeStyle = "bg-red-600 text-white font-bold";
            } else {
              cardStyle = "border border-border/40 bg-card/60 opacity-45";
            }
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => choose(idx)}
              disabled={isAnswered}
              className={`flex items-center gap-3.5 rounded-2xl p-4 text-start transition-all ${
                isAnswered ? "cursor-default" : "cursor-pointer"
              } ${cardStyle}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm transition-all ${badgeStyle}`}
              >
                {picked !== null && isCorrect ? (
                  <Check className="h-5 w-5" />
                ) : picked !== null && isChosen ? (
                  <X className="h-5 w-5" />
                ) : (
                  letter
                )}
              </span>
              <span className="flex-1 text-sm sm:text-base leading-relaxed">
                <bdi dir="auto">{o}</bdi>
              </span>
            </button>
          );
        })}
      </div>

      {/* Answer Feedback & Navigation Bar */}
      {picked !== null && (
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {picked === q.correct_index ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-4 w-4" />
                </span>
                <span>أحسنت! إجابة صحيحة ✨</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20">
                  <X className="h-4 w-4" />
                </span>
                <span>
                  إجابة خاطئة — الإجابة الصحيحة:{" "}
                  <span className="underline font-bold text-foreground">
                    {q.options[q.correct_index]}
                  </span>
                </span>
              </div>
            )}

            {isAutoAdvancing && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                جارٍ الانتقال تلقائياً…
              </span>
            )}
          </div>

          {/* AI Explanation Accordion/Box (Always accessible for review) */}
          {!explain ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-semibold rounded-xl border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
              onClick={askExplain}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-500" />
              <span>اشرح لي الإجابة بالذكاء الاصطناعي 🤖</span>
            </Button>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-primary text-xs">
                <Lightbulb className="h-4 w-4 text-accent-500" />
                <span>شرح السؤال:</span>
              </div>
              {explain.loading ? (
                <p className="text-muted-foreground animate-pulse text-xs">جارٍ توليد الشرح العلمي…</p>
              ) : explain.error ? (
                <p className="text-destructive text-xs">{explain.error}</p>
              ) : (
                <div className="text-xs sm:text-sm font-reading leading-7">{explain.text}</div>
              )}
            </div>
          )}

          {/* Navigation Controls: Previous Question & Next Question */}
          <div className="flex items-center gap-3 pt-1">
            {i > 0 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 px-5 text-sm font-bold rounded-xl gap-2 cursor-pointer border-border/80"
                onClick={goToPrevious}
              >
                <ArrowRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                <span>السؤال السابق</span>
              </Button>
            )}

            <Button
              type="button"
              size="lg"
              className="flex-1 h-12 text-base font-bold rounded-xl gap-2 shadow-xs cursor-pointer"
              disabled={explain?.loading}
              onClick={() => goToNext()}
            >
              <span>{isLastQuestion ? "عرض النتيجة النهائية" : "السؤال التالي"}</span>
              <ArrowLeft className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
