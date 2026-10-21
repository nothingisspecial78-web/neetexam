import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Check, X, Clock, ArrowLeft, Lightbulb } from "lucide-react";
import { explainAnswer } from "@/lib/explain.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ARABIC_LABELS } from "@/lib/parse-questions";
import type { PracticeQ } from "@/lib/units";

export type QuizAnswer = { q: PracticeQ; chosen: number | null; correct: boolean; ms: number };

export function QuizRunner({
  questions,
  feedback,
  onAnswer,
  onDone,
  deadline,
}: {
  questions: PracticeQ[];
  feedback: boolean;
  onAnswer?: (a: QuizAnswer) => void;
  onDone: (answers: QuizAnswer[]) => void;
  deadline?: number | null;
}) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [now, setNow] = useState(Date.now());
  const started = useRef(Date.now());
  const q = questions[i];
  const finished = useRef(false);
  const explainFn = useServerFn(explainAnswer);
  const [explain, setExplain] = useState<{
    loading: boolean;
    text?: string;
    error?: string;
  } | null>(null);

  async function askExplain() {
    if (!q) return;
    if (q.explanation) return setExplain({ loading: false, text: q.explanation });
    setExplain({ loading: true });
    try {
      const r = await explainFn({ data: { questionId: q.id } });
      q.explanation = r.text;
      setExplain({ loading: false, text: r.text });
    } catch (e) {
      setExplain({ loading: false, error: e instanceof Error ? e.message : "تعذّر الحصول على الشرح الآن" });
    }
  }

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  function complete(all: QuizAnswer[]) {
    if (finished.current) return;
    finished.current = true;
    onDone(all);
  }

  useEffect(() => {
    if (deadline && now >= deadline) complete(answers);
  }, [now, deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  function next(all: QuizAnswer[]) {
    setPicked(null);
    setExplain(null);
    started.current = Date.now();
    if (i + 1 >= questions.length) complete(all);
    else setI(i + 1);
  }

  function choose(idx: number) {
    if (!q || picked !== null || finished.current) return;
    const a = {
      q,
      chosen: idx,
      correct: idx === q.correct_index,
      ms: Date.now() - started.current,
    };
    const all = [...answers, a];
    setAnswers(all);
    onAnswer?.(a);
    if (feedback) setPicked(idx);
    else next(all);
  }

  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  if (!q) return <p className="py-12 text-center text-muted-foreground">لا توجد أسئلة متاحة في هذا الاختبار.</p>;

  return (
    <div className="space-y-6">
      {/* Top Header / Progress Meter */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
              السؤال {i + 1} من {questions.length}
            </span>
            {q.from_name && (
              <span className="hidden sm:inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground font-medium">
                مشارك من {q.from_name}
              </span>
            )}
          </div>

          {left !== null && (
            <div
              dir="ltr"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-sm font-bold shadow-xs ${
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

        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-l from-primary-600 to-primary-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((i + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
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
              onClick={() => choose(idx)}
              disabled={picked !== null}
              className={`flex items-center gap-3.5 rounded-2xl p-4 text-start transition-all cursor-pointer ${cardStyle}`}
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

      {/* Answer Feedback & AI Explanation */}
      {picked !== null && (
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            {picked === q.correct_index ? (
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-4 w-4" />
                </span>
                <span>أحسنت! إجابة صحيحة</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20">
                  <X className="h-4 w-4" />
                </span>
                <span>
                  إجابة خاطئة — الإجابة الصحيحة:{" "}
                  <span className="underline">{q.options[q.correct_index]}</span>
                </span>
              </div>
            )}
          </div>

          {/* AI Explanation Accordion/Box */}
          {!explain ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-semibold rounded-xl border-primary/30 text-primary hover:bg-primary/10"
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

          {/* Next Button */}
          <Button
            size="lg"
            className="w-full h-12 text-base font-bold rounded-xl gap-2 shadow-xs"
            disabled={explain?.loading}
            onClick={() => next(answers)}
          >
            <span>{i + 1 >= questions.length ? "عرض النتيجة" : "السؤال التالي"}</span>
            <ArrowLeft className="h-5 w-5 ltr:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
