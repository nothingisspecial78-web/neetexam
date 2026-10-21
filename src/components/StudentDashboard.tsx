import { Component, useRef, useState, type ReactNode } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, LineChart, Line } from "recharts";
import {
  BookOpen,
  CheckCheck,
  Target,
  Coins,
  Flame,
  Trophy,
  Clock,
  RotateCw,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { dashboardOptions } from "@/lib/dashboard-query";
import { buildDashboard, creditDelta, type Filters } from "@/lib/dashboard";
import { supabase } from "@/integrations/supabase/client";
import { saveAnswer, type PracticeQ } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { QuizRunner, type QuizAnswer } from "./QuizRunner";

const chartConfig = {
  accuracy: { label: "الدقّة ٪", color: "var(--chart-1)" },
  count: { label: "الأسئلة", color: "var(--chart-2)" },
  seconds: { label: "ثانية / سؤال", color: "var(--chart-3)" },
  balance: { label: "الرصيد", color: "var(--chart-2)" },
};
const date = (d: string) =>
  new Date(d).toLocaleDateString("ar", { month: "short", day: "numeric" });
const pct = (n: number | null) => (n === null ? "—" : `${n}٪`);
export class DashboardBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div role="alert" className="py-8 text-center">
        <p>تعذّر تحميل الإحصاءات.</p>
        <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
          حاول مجددًا
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
type Review = {
  question_text: string;
  options: string[];
  correct_index: number;
  chosen_index: number | null;
  is_correct: boolean;
};
function Empty() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات لهذه الفترة.</p>
  );
}
function TrendChart({
  data,
  keys,
}: {
  data: Record<string, unknown>[];
  keys: ("accuracy" | "count" | "seconds" | "balance")[];
}) {
  if (!data.length) return <Empty />;
  const creditChart = keys.includes("balance");
  const points = creditChart
    ? data.map((row) => ({ ...row, date: Date.parse(String(row["date"])) }))
    : data;
  const tickDate = (value: string | number) =>
    date(typeof value === "number" ? new Date(value).toISOString() : value);
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto" dir="ltr">
      <LineChart data={points} margin={{ left: 0, right: 10, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          type={creditChart ? "number" : "category"}
          domain={["dataMin", "dataMax"]}
          tickFormatter={tickDate}
          minTickGap={35}
        />
        <YAxis yAxisId="left" width={36} />
        {keys.includes("count") && <YAxis yAxisId="right" orientation="right" width={30} />}
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => tickDate(v)} />} />
        {keys.map((k) => (
          <Line
            key={k}
            name={chartConfig[k].label}
            yAxisId={k === "count" ? "right" : "left"}
            type={creditChart ? "stepAfter" : "monotone"}
            dataKey={k}
            stroke={`var(--color-${k})`}
            strokeWidth={2}
            dot={data.length < 15}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
export function StudentDashboard({
  userId,
  filters,
  onFilters,
}: {
  userId: string;
  filters: Filters;
  onFilters: (f: Filters) => void;
}) {
  const { data } = useSuspenseQuery(dashboardOptions(userId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const d = buildDashboard(data, userId, filters);
  const [practice, setPractice] = useState<PracticeQ[] | null>(null);
  const [practiceDone, setPracticeDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const review = useQuery({
    queryKey: ["test-review", userId, reviewId],
    enabled: reviewId !== null,
    queryFn: async () => {
      if (!reviewId) return [];
      const r = await supabase
        .from("test_results")
        .select("answer_review")
        .eq("owner_id", userId)
        .eq("id", reviewId)
        .single();
      if (r.error) throw r.error;
      return (r.data.answer_review ?? []) as unknown as Review[];
    },
  });
  const missed = useQuery({
    queryKey: ["mistake-preview", userId, d.mistakes.slice(0, 5).map((m) => m.id)],
    enabled: d.mistakes.length > 0,
    queryFn: async () => {
      const r = await supabase
        .from("questions")
        .select("id,question_text")
        .in(
          "id",
          d.mistakes.slice(0, 5).map((m) => m.id),
        );
      if (r.error) throw r.error;
      return r.data;
    },
  });
  async function practise() {
    setBusy(true);
    try {
      const r = await supabase
        .from("questions")
        .select("id,unit_id,question_text,options,correct_index,topic_area,explanation")
        .in(
          "id",
          d.mistakes.slice(0, 50).map((m) => m.id),
        )
        .eq("status", "active")
        .not("correct_index", "is", null);
      if (r.error) throw r.error;
      const qs = (r.data ?? []) as PracticeQ[];
      if (!qs.length) return void toast.error("لا توجد أسئلة متاحة");
      setPracticeDone(false);
      setPractice(qs);
    } catch {
      toast.error("تعذّر فتح التدريب");
    } finally {
      setBusy(false);
    }
  }
  const pendingAnswers = useRef<Promise<void>[]>([]);
  function answer(a: QuizAnswer) {
    pendingAnswers.current.push(
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
  async function practiceFinish() {
    await Promise.all(pendingAnswers.current);
    pendingAnswers.current = [];
    setPracticeDone(true);
    void qc.invalidateQueries({ queryKey: ["dashboard", userId] });
    void qc.invalidateQueries({ queryKey: ["units", userId] });
  }
  const overview = [
    { icon: BookOpen, label: "أسئلتك المرفوعة", value: d.uploaded },
    { icon: CheckCheck, label: "الوحدات المكتملة", value: `${d.completed} / ${d.totalUnits}` },
    { icon: Target, label: "دقّة الإجابات", value: pct(d.accuracy) },
    { icon: Coins, label: "رصيدك", value: data.arena?.credits ?? 0 },
    { icon: Trophy, label: "ترتيب الساحة", value: data.arena?.rank ? `#${data.arena.rank}` : "—" },
    { icon: Flame, label: "أيام متتالية", value: d.streak },
  ];
  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">لوحة التقدّم</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="تحديث الإحصاءات"
          onClick={() => qc.invalidateQueries({ queryKey: ["dashboard", userId] })}
        >
          <RotateCw className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {overview.map((o) => (
          <div key={o.label} className="min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-xs hover:border-primary/40 transition-all">
            <o.icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-bold font-display tabular-nums" dir="ltr">
              {o.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{o.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Select
          value={filters.range}
          onValueChange={(v) => onFilters({ ...filters, range: v as Filters["range"] })}
        >
          <SelectTrigger aria-label="الفترة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يومًا</SelectItem>
            <SelectItem value="all">كل الوقت</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.unit}
          disabled={filters.mode === "competition"}
          onValueChange={(v) => onFilters({ ...filters, unit: v })}
        >
          <SelectTrigger aria-label="الوحدة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الوحدات</SelectItem>
            {d.stats.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.mode}
          onValueChange={(v) =>
            onFilters({
              ...filters,
              mode: v as Filters["mode"],
              unit: v === "competition" ? "all" : filters.unit,
            })
          }
        >
          <SelectTrigger aria-label="نوع النشاط">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنشطة</SelectItem>
            <SelectItem value="practice">التدريب</SelectItem>
            <SelectItem value="test">الاختبار</SelectItem>
            <SelectItem value="competition">المنافسة</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.period}
          onValueChange={(v) => onFilters({ ...filters, period: v as Filters["period"] })}
        >
          <SelectTrigger aria-label="عرض الزمن">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">يومي</SelectItem>
            <SelectItem value="week">أسبوعي</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {d.recommendations.length > 0 && (
        <section className="border-y py-5">
          <h2 className="mb-3 font-display text-xl">خطوتك التالية</h2>
          <div className="grid gap-3">
            {d.recommendations.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">{r.text}</p>
                {r.unit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate({ to: "/app/units/$unitId", params: { unitId: r.unit ?? "" } })
                    }
                  >
                    تدرّب الآن <ArrowLeft className="size-4 ltr:rotate-180" />
                  </Button>
                ) : r.friends ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate({ to: "/app/units" })}
                  >
                    الوحدات المشتركة
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
      {filters.mode !== "competition" && (
        <>
          <div className="grid gap-8 lg:grid-cols-2">
            <section className="min-w-0">
              <h2 className="font-display text-xl">الدقّة حسب الوحدة</h2>
              {d.topics.length ? (
                <>
                  <ChartContainer
                    config={chartConfig}
                    className="mt-4 h-64 w-full aspect-auto"
                    dir="ltr"
                  >
                    <BarChart
                      data={d.topics.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 0, right: 20 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tickFormatter={(v) =>
                          String(v).length > 16 ? String(v).slice(0, 16) + "…" : String(v)
                        }
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        name="الدقّة ٪"
                        dataKey="accuracy"
                        fill="var(--color-accuracy)"
                        radius={4}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ChartContainer>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.topics.slice(0, 3).map((t) => (
                      <Button
                        variant="outline"
                        size="sm"
                        key={t.id}
                        className="max-w-full whitespace-normal text-destructive"
                        onClick={() =>
                          navigate({ to: "/app/units/$unitId", params: { unitId: t.id } })
                        }
                      >
                        {t.name} · {t.accuracy}٪
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <Empty />
              )}
            </section>
            <section className="min-w-0">
              <h2 className="font-display text-xl">التقدّم عبر الوقت</h2>
              <div className="mt-2 flex gap-4 text-xs">
                <span className="text-primary">الدقّة ٪</span>
                <span className="text-gold">عدد الأسئلة</span>
              </div>
              {d.answers.length ? (
                <TrendChart data={d.series} keys={["accuracy", "count"]} />
              ) : (
                <Empty />
              )}
            </section>
          </div>
          <section className="border-y py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl">
                  <Clock className="size-5" />
                  سرعة الإجابة
                </h2>
                <p className="mt-2 text-2xl font-semibold">
                  {d.seconds === null ? "—" : `${d.seconds.toFixed(1)} ث / سؤال`}
                </p>
                {d.speedTrend !== null && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Math.abs(d.speedTrend).toFixed(1)} ث{" "}
                    {d.speedTrend < 0 ? "أسرع" : d.speedTrend > 0 ? "أبطأ" : "دون تغيير"}
                  </p>
                )}
              </div>
            </div>
            {d.answers.length > 0 && <TrendChart data={d.series} keys={["seconds"]} />}
          </section>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl">بنك الأخطاء</h2>
              <Button disabled={!d.mistakes.length || busy} onClick={practise}>
                {busy ? "لحظة…" : "تدرّب عليها"}
              </Button>
            </div>
            {!d.mistakes.length ? (
              <Empty />
            ) : (
              <ol className="mt-4 divide-y">
                {d.mistakes.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-4 py-3">
                    <p className="min-w-0 text-sm leading-7">
                      {missed.data?.find((q) => q.id === m.id)?.question_text ?? "جارٍ التحميل…"}
                    </p>
                    <span className="shrink-0 text-xs text-destructive">{m.count} أخطاء</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <h2 className="font-display text-xl">سجل الاختبارات والتدريب</h2>
            {!d.runs.length ? (
              <Empty />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-3 text-start">التاريخ / الوحدات</th>
                      <th>النتيجة</th>
                      <th>الوقت</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.runs.slice(0, 30).map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="max-w-64 py-4 pe-3">
                          <p>
                            {date(r.created_at)} · {r.mode === "test" ? "اختبار" : "تدريب"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.unit_ids
                              .map((id) => d.stats.find((s) => s.id === id)?.name ?? "وحدة سابقة")
                              .join("، ")}
                          </p>
                        </td>
                        <td className="px-2 text-center tabular-nums">
                          {r.correct}/{r.total}
                        </td>
                        <td className="px-2 text-center">
                          {Math.floor(r.duration_s / 60)}د {r.duration_s % 60}ث
                        </td>
                        <td>
                          {r.reviewable ? (
                            <Button variant="ghost" size="sm" onClick={() => setReviewId(r.id)}>
                              مراجعة
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">ملخّص فقط</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {(filters.mode === "all" || filters.mode === "competition") && (
        <section className="border-t border-border/60 pt-6">
          <h2 className="font-display text-2xl font-bold">أداؤك في الساحة والمبارزات</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ["الفوز", d.competition.wins],
              ["الخسارة", d.competition.losses],
              ["التعادل", d.competition.draws],
              ["نسبة الفوز", pct(d.competition.winRate)],
              ["أفضل دقيقة", d.competition.best],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border/80 bg-card p-4 text-center shadow-xs">
                <p className="text-2xl font-bold font-display text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-6 font-semibold text-foreground">الرصيد عبر الوقت</h3>
          <TrendChart
            data={d.credits.map((c) => ({ date: c.created_at, balance: c.balance }))}
            keys={["balance"]}
          />
          <h3 className="mt-5 font-semibold">آخر المباريات</h3>
          {!d.matches.length ? (
            <Empty />
          ) : (
            <div className="mt-3 divide-y">
              {d.matches.slice(0, 10).map((m) => {
                const isA = m.player_a === userId;
                const delta = creditDelta(m, userId);
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      ضد {(isA ? m.b_name : m.a_name) ?? "طالب"}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {date(m.created_at)}
                      </span>
                    </span>
                    <span>
                      {isA ? m.a_correct : m.b_correct} / {isA ? m.b_correct : m.a_correct}
                    </span>
                    <span className={delta < 0 ? "text-destructive" : "text-primary"} dir="ltr">
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      <Dialog
        open={practice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPractice(null);
            void qc.invalidateQueries({ queryKey: ["dashboard", userId] });
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تدريب الأخطاء</DialogTitle>
          </DialogHeader>
          {practiceDone ? (
            <div className="py-6 text-center">
              <CheckCheck className="mx-auto size-10 text-primary" />
              <p className="mt-3">اكتمل التدريب</p>
              <Button className="mt-4" onClick={() => setPractice(null)}>
                العودة إلى التقدّم
              </Button>
            </div>
          ) : (
            practice && (
              <QuizRunner questions={practice} feedback onAnswer={answer} onDone={practiceFinish} />
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={reviewId !== null}
        onOpenChange={(open) => {
          if (!open) setReviewId(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>مراجعة الإجابات</DialogTitle>
          </DialogHeader>
          {review.isPending ? (
            <p>لحظة…</p>
          ) : review.isError ? (
            <p role="alert">تعذّر تحميل الإجابات.</p>
          ) : (
            <div className="divide-y">
              {review.data?.map((a, i) => (
                <div key={i} className="py-4">
                  <p className="font-semibold">
                    {a.is_correct ? "✓" : "✗"} {a.question_text}
                  </p>
                  <p className="mt-2 text-sm text-primary">الصحيح: {a.options[a.correct_index]}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    إجابتك: {a.chosen_index === null ? "لم تجب" : a.options[a.chosen_index]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
