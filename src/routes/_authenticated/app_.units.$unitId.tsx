import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Trophy,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Upload,
} from "lucide-react";
import { unitsOptions, shuffle, shuffleOptions, saveAnswer, saveRun } from "@/lib/units";
import { AppHeader } from "@/components/AppHeader";
import { QuizRunner, type QuizAnswer } from "@/components/QuizRunner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app_/units/$unitId")({
  head: () => ({
    meta: [
      { title: "تدريب — مِدْرَاس" },
      { name: "description", content: "تدرّب على أسئلة الوحدة سؤالًا سؤالًا." },
      { property: "og:title", content: "تدريب — مِدْرَاس" },
      { property: "og:description", content: "تدرّب على أسئلة الوحدة سؤالًا سؤالًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(unitsOptions(context.user.id)),
  errorComponent: () => (
    <div className="py-12 text-center" role="alert">
      <p className="text-destructive font-semibold">تعذّر تحميل التدريب، حاول مجددًا.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">الوحدة المطلوبة غير موجودة.</p>
    </div>
  ),
  component: Practice,
});

function Practice() {
  const { user } = Route.useRouteContext();
  const { unitId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(unitsOptions(user.id));
  const unit = data.stats.find((s) => s.id === unitId);

  const make = () =>
    shuffle(data.questions.filter((q) => q.unit_id === unitId)).map((q) => shuffleOptions(q));

  const [run, setRun] = useState(() => ({ key: Date.now(), qs: make() }));
  const [result, setResult] = useState<QuizAnswer[] | null>(null);
  const pending = useRef<Promise<void>[]>([]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard", user.id] });
    return qc.invalidateQueries({ queryKey: ["units", user.id] });
  };

  function onAnswer(a: QuizAnswer) {
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

  async function onDone(all: QuizAnswer[]) {
    setResult(all);
    await Promise.all(pending.current);
    pending.current = [];
    saveRun({
      unit_ids: [unitId],
      total: all.length,
      correct: all.filter((a) => a.correct).length,
      duration_s: Math.round((Date.now() - run.key) / 1000),
      mode: "practice",
    })
      .catch(() => toast.error("تعذّر حفظ النتيجة"))
      .finally(refresh);
  }

  const correctCount = result ? result.filter((a) => a.correct).length : 0;
  const totalCount = result ? result.length : 0;
  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title={unit ? `تدريب: ${unit.name}` : "التدريب"} back />

      <main className="mx-auto max-w-lg px-4 py-6">
        {!run.qs.length ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center space-y-4 animate-scale-in">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h2 className="font-display text-lg font-bold text-foreground">لا توجد أسئلة متاحة في هذه الوحدة بعد</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              يمكنك رفع ملف أسئلة (md) مخصص لهذه الوحدة مباشرة، وسيتم تدقيقها وتصنيفها بالذكاء الاصطناعي وفق عناوينك الفرعية.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                className="gap-2 rounded-xl h-11 w-full sm:w-auto font-semibold shadow-xs"
                onClick={() => navigate({ to: "/app/upload", search: { unitId } as any })}
              >
                <Upload className="h-4 w-4" />
                ارفع ملف md لهذه الوحدة
              </Button>
              <Button
                variant="outline"
                className="rounded-xl h-11 w-full sm:w-auto"
                onClick={() => navigate({ to: "/app/units" })}
              >
                العودة للوحدات
              </Button>
            </div>
          </div>
        ) : result ? (
          /* Result Celebration View */
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-soft space-y-6 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 text-slate-900 shadow-md">
              <Trophy className="h-10 w-10" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs mb-2">
                <Sparkles className="h-3.5 w-3.5 text-accent-500" />
                اكتمل التدريب
              </span>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {score >= 90
                  ? "ممتاز! أداء استثنائي"
                  : score >= 75
                    ? "أحسنت! أداء رائع"
                    : score >= 50
                      ? "محاولة جيدة، واصل التدريب!"
                      : "تحتاج إلى مزيد من التركيز"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{unit?.name}</p>
            </div>

            {/* Score Ring / Metric */}
            <div className="grid grid-cols-3 gap-3 py-2 border-y border-border/60">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-2xl font-bold font-display text-primary">{score}%</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">الدقّة</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <p className="text-2xl font-bold font-display text-emerald-600 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {correctCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">صحيحة</p>
              </div>
              <div className="rounded-xl bg-red-500/10 p-3">
                <p className="text-2xl font-bold font-display text-red-600 flex items-center justify-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {totalCount - correctCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">خاطئة</p>
              </div>
            </div>

            {unit?.best != null && (
              <p className="text-xs text-muted-foreground">
                أفضل نتيجة سابقة لك في هذه الوحدة:{" "}
                <span className="font-bold text-foreground">{unit.best}%</span>
              </p>
            )}

            <div className="grid gap-2.5 pt-2">
              <Button
                size="lg"
                className="w-full h-12 rounded-xl font-bold gap-2"
                onClick={() => {
                  setResult(null);
                  setRun({ key: Date.now(), qs: make() });
                }}
              >
                <RotateCcw className="h-4 w-4" />
                <span>إعادة التدريب بأسئلة عشوائية</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 rounded-xl font-medium"
                onClick={() => navigate({ to: "/app/units" })}
              >
                العودة إلى قائمة الوحدات
              </Button>
            </div>
          </div>
        ) : (
          <QuizRunner
            key={run.key}
            questions={run.qs}
            feedback
            onAnswer={onAnswer}
            onDone={onDone}
          />
        )}
      </main>
    </div>
  );
}
