import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap,
  Trophy,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ChevronLeft,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  unitsOptions,
  completedUnitIds,
  shuffle,
  shuffleOptions,
  type PracticeQ,
} from "@/lib/units";
import { AppHeader } from "@/components/AppHeader";
import { QuizRunner, type QuizAnswer } from "@/components/QuizRunner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app_/exam")({
  head: () => ({
    meta: [
      { title: "اختبار الوحدات — مِدْرَاس" },
      { name: "description", content: "اختبر نفسك في الوحدات المكتملة بدون تلميحات." },
      { property: "og:title", content: "اختبار الوحدات — مِدْرَاس" },
      { property: "og:description", content: "اختبر نفسك في الوحدات المكتملة بدون تلميحات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(unitsOptions(context.user.id)),
  errorComponent: () => <p className="py-12 text-center text-destructive font-semibold">تعذّر تحميل الاختبار، حاول مجددًا.</p>,
  notFoundComponent: () => <p className="py-12 text-center text-muted-foreground">الاختبار غير موجود.</p>,
  component: UnitTest,
});

type Run = { qs: PracticeQ[]; start: number; deadline: number | null; key: number };

function UnitTest() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(unitsOptions(user.id));
  const done = data.stats.filter((s) => completedUnitIds(data.stats).includes(s.id));
  const [sel, setSel] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [timer, setTimer] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<{ answers: QuizAnswer[]; secs: number } | null>(null);

  function begin(qs: PracticeQ[]) {
    const now = Date.now();
    setResult(null);
    setRun({ qs, start: now, deadline: timer ? now + qs.length * 60_000 : null, key: now });
  }

  function start() {
    const pool = data.questions.filter((q) => q.unit_id && sel.includes(q.unit_id));
    if (!pool.length) return void toast.error("اختر وحدة مكتملة واحدة على الأقل لبدء الاختبار");
    begin(
      shuffle(pool)
        .slice(0, count)
        .map((q) => shuffleOptions(q)),
    );
  }

  async function finish(answers: QuizAnswer[]) {
    if (!run) return;
    const secs = Math.round((Date.now() - run.start) / 1000);
    // Unanswered questions (e.g. timeout) count as wrong
    const all = run.qs.map(
      (q) => answers.find((a) => a.q.id === q.id) ?? { q, chosen: null, correct: false, ms: 0 },
    );
    setResult({ answers: all, secs });
    setRun(null);
    const { error } = await supabase.rpc("save_test_run", {
      _answers: all.map((a) => ({
        question_id: a.q.id,
        expected_hash: a.q.content_hash ?? null,
        question_text: a.q.question_text,
        expected_correct_text: a.q.options[a.q.correct_index] ?? null,
        chosen_text: a.chosen === null ? null : a.q.options[a.chosen],
        time_ms: a.ms,
      })),
      _duration: secs,
    });
    if (error) toast.error("تعذّر حفظ نتيجة الاختبار");
    qc.invalidateQueries({ queryKey: ["dashboard", user.id] });
    qc.invalidateQueries({ queryKey: ["units", user.id] });
  }

  const unitName = (id: string | null) => data.stats.find((s) => s.id === id)?.name ?? "عام";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title="اختبار الوحدات المكتملة" back />

      <main className="mx-auto max-w-xl px-4 py-6">
        {run ? (
          <QuizRunner
            key={run.key}
            questions={run.qs}
            feedback={false}
            deadline={run.deadline}
            onDone={finish}
          />
        ) : result ? (
          <Result
            result={result}
            unitName={unitName}
            onRetry={() => begin(result.answers.filter((a) => !a.correct).map((a) => a.q))}
            onBack={() => setResult(null)}
          />
        ) : !done.length ? (
          /* Empty State: No completed units */
          <div className="rounded-3xl border border-dashed border-border/80 bg-card p-8 sm:p-10 text-center space-y-4 shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">
              لا توجد وحدات مكتملة بعد
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              يفتح الاختبار التجميعي عندما تكمل الإجابة عن جميع أسئلة وحدة واحدة على الأقل بنسبة 100%.
            </p>
            <Button
              className="rounded-xl font-bold gap-2"
              onClick={() => navigate({ to: "/app/units" })}
            >
              <Layers className="h-4 w-4" />
              <span>اذهب إلى الوحدات وتدرّب الآن</span>
            </Button>
          </div>
        ) : (
          /* Setup Form */
          <div className="space-y-5 animate-in fade-in-50 duration-200">
            {/* Header intro */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-foreground">اختبار بدون تلميحات</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  أجب عن الأسئلة بتسلسل سريع وستظهر نتيجتك التفصيلية ونقاط الضعف عند الانتهاء.
                </p>
              </div>
            </div>

            {/* Units Selection Card */}
            <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-foreground">
                  اختر الوحدات للاختبار ({done.length} مكتملة)
                </h2>
                <button
                  type="button"
                  onClick={() => setSel(sel.length === done.length ? [] : done.map((d) => d.id))}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  {sel.length === done.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </button>
              </div>

              <div className="grid gap-2 max-h-60 overflow-y-auto pe-1">
                {done.map((u) => {
                  const isChecked = sel.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                        isChecked
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/70 hover:border-border"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(c) =>
                          setSel(c ? [...sel, u.id] : sel.filter((x) => x !== u.id))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {u.name}
                        </p>
                        {u.owner_name && (
                          <p className="text-xs text-primary font-medium">من {u.owner_name}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        {u.total} سؤال
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Exam Config Card */}
            <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              <div>
                <h2 className="font-display font-bold text-sm text-foreground mb-2">
                  عدد الأسئلة
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`h-11 rounded-xl text-sm font-bold border transition-all ${
                        count === n
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "border-border/80 bg-muted/40 hover:bg-muted text-foreground"
                      }`}
                    >
                      {n} سؤال
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    تفعيل مؤقّت زمني
                  </span>
                  <p className="text-xs text-muted-foreground">دقيقة واحدة لكل سؤال</p>
                </div>
                <Switch checked={timer} onCheckedChange={setTimer} />
              </div>
            </section>

            {/* Launch Button */}
            <Button
              size="lg"
              className="w-full h-12 text-base font-bold rounded-xl gap-2 shadow-xs"
              onClick={start}
              disabled={sel.length === 0}
            >
              <span>ابدأ الاختبار الآن</span>
              <ChevronLeft className="h-5 w-5 ltr:rotate-180" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function Result({
  result,
  unitName,
  onRetry,
  onBack,
}: {
  result: { answers: QuizAnswer[]; secs: number };
  unitName: (id: string | null) => string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { answers, secs } = result;
  const correct = answers.filter((a) => a.correct).length;
  const wrong = answers.filter((a) => !a.correct);
  const accuracy = Math.round((correct / answers.length) * 100);

  const byUnit = new Map<string, { c: number; t: number }>();
  for (const a of answers) {
    const k = unitName(a.q.unit_id);
    const v = byUnit.get(k) ?? { c: 0, t: 0 };
    byUnit.set(k, { c: v.c + (a.correct ? 1 : 0), t: v.t + 1 });
  }
  const weak = [...byUnit].filter(([, v]) => v.c / v.t < 0.6).map(([k]) => k);

  return (
    <div className="space-y-5 animate-in zoom-in-95 duration-200">
      {/* Score Hero Card */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-soft space-y-5">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 text-slate-900 shadow-md">
          <Trophy className="h-10 w-10" />
        </div>

        <div>
          <h2 className="font-display text-3xl font-bold text-foreground">
            {correct} / {answers.length}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <span>الدقّة: <strong className="text-foreground">{accuracy}%</strong></span>
            <span>·</span>
            <span>الوقت: <strong className="text-foreground">{Math.floor(secs / 60)}د {secs % 60}ث</strong></span>
          </p>
        </div>

        {weak.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-start flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold">مواضيع تحتاج إلى مراجعة إضافية: </span>
              <span>{weak.join("، ")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Question by Question Review */}
      <div className="space-y-3">
        <h3 className="font-display text-base font-bold text-foreground">مراجعة الإجابات</h3>
        <div className="grid gap-2.5">
          {answers.map((a, i) => (
            <div
              key={a.q.id}
              className={`rounded-2xl border p-4 text-sm transition-all ${
                a.correct
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    a.correct ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                  }`}
                >
                  {a.correct ? <Check className="h-3.5 w-3.5" /> : "✕"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground leading-relaxed">
                    {a.q.question_text}
                  </p>
                  {!a.correct && (
                    <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                      <p>
                        الصحيح:{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {a.q.options[a.q.correct_index]}
                        </strong>
                      </p>
                      {a.chosen !== null && (
                        <p>
                          إجابتك:{" "}
                          <span className="text-red-600 line-through">
                            {a.q.options[a.chosen]}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-2.5 pt-2">
        {wrong.length > 0 && (
          <Button
            size="lg"
            className="w-full h-12 rounded-xl font-bold gap-2"
            onClick={onRetry}
          >
            <RotateCcw className="h-4 w-4" />
            <span>إعادة الأسئلة الخاطئة ({wrong.length})</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className="w-full h-12 rounded-xl font-medium"
          onClick={onBack}
        >
          اختبار جديد
        </Button>
      </div>
    </div>
  );
}
