import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  Layers,
  Play,
  ArrowRight,
  Search,
  Check,
  FolderOpen,
  Wand2,
} from "lucide-react";
import { unitsOptions, shuffle, shuffleOptions, saveAnswer, saveRun, type PracticeQ } from "@/lib/units";
import { categorizeUnitQuestions } from "@/lib/questions.functions";
import { notifyLiveSync } from "@/lib/live-sync";
import { AppHeader } from "@/components/AppHeader";
import { QuizRunner, type QuizAnswer } from "@/components/QuizRunner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ARABIC_LABELS } from "@/lib/parse-questions";

export const Route = createFileRoute("/_authenticated/app_/units/$unitId")({
  head: () => ({
    meta: [
      { title: "تفاصيل الوحدة والأقسام — مِدْرَاس" },
      { name: "description", content: "تصفّح العناوين الفرعية وأسئلة الوحدة وتدرّب عليها." },
      { property: "og:title", content: "تفاصيل الوحدة والأقسام — مِدْرَاس" },
      { property: "og:description", content: "تصفّح العناوين الفرعية وأسئلة الوحدة وتدرّب عليها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(unitsOptions(context.user.id)),
  errorComponent: () => (
    <div className="py-12 text-center" role="alert">
      <p className="text-destructive font-semibold">تعذّر تحميل بيانات الوحدة، حاول مجددًا.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">الوحدة المطلوبة غير موجودة.</p>
    </div>
  ),
  component: UnitDetailPage,
});

function UnitDetailPage() {
  const { user } = Route.useRouteContext();
  const { unitId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const catFn = useServerFn(categorizeUnitQuestions);

  const { data } = useSuspenseQuery(unitsOptions(user.id));
  const unit = data.stats.find((s) => s.id === unitId);

  // All questions specifically belonging to this unit
  const unitQuestions = useMemo(
    () => data.questions.filter((q) => q.unit_id === unitId),
    [data.questions, unitId],
  );

  // Group questions by subheading (topic_area)
  const sections = useMemo(() => {
    const map = new Map<string, PracticeQ[]>();
    for (const q of unitQuestions) {
      const heading = q.topic_area?.trim() || "القسم العام";
      const list = map.get(heading) ?? [];
      list.push(q);
      map.set(heading, list);
    }
    return Array.from(map.entries()).map(([heading, questions]) => ({
      heading,
      questions,
      count: questions.length,
    }));
  }, [unitQuestions]);

  // Mode: "overview" (show subheadings & questions), "quiz" (active quiz runner), "result" (celebration score)
  const [mode, setMode] = useState<"overview" | "quiz" | "result">("overview");
  const [activeQuizTitle, setActiveQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<PracticeQ[]>([]);
  const [quizKey, setQuizKey] = useState(Date.now());
  const [result, setResult] = useState<QuizAnswer[] | null>(null);

  // Expanded subheadings (set of headings that are open)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Open the first section by default if exists
    return new Set(sections.length > 0 ? [sections[0]!.heading] : []);
  });

  // Search filter inside unit
  const [search, setSearch] = useState("");

  // AI Categorization Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [subheadingsInput, setSubheadingsInput] = useState("");
  const [isCategorizing, setIsCategorizing] = useState(false);

  const pending = useRef<Promise<void>[]>([]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard", user.id] });
    return qc.invalidateQueries({ queryKey: ["units", user.id] });
  };

  // Toggle expanding/collapsing a subheading
  function toggleSection(heading: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });
  }

  // Start quiz on the whole unit
  function startFullUnitQuiz() {
    if (!unitQuestions.length) return;
    const qs = shuffle(unitQuestions).map((q) => shuffleOptions(q));
    setActiveQuizTitle(`تدريب كامل الوحدة: ${unit?.name || ""}`);
    setQuizQuestions(qs);
    setQuizKey(Date.now());
    setResult(null);
    setMode("quiz");
  }

  // Start quiz on a specific subheading
  function startSubheadingQuiz(heading: string, qs: PracticeQ[]) {
    if (!qs.length) return;
    const shuffled = shuffle(qs).map((q) => shuffleOptions(q));
    setActiveQuizTitle(`تدريب: ${heading}`);
    setQuizQuestions(shuffled);
    setQuizKey(Date.now());
    setResult(null);
    setMode("quiz");
  }

  // Start quiz on a single question
  function startSingleQuestionQuiz(q: PracticeQ) {
    setActiveQuizTitle("تدريب سؤال محدد");
    setQuizQuestions([shuffleOptions(q)]);
    setQuizKey(Date.now());
    setResult(null);
    setMode("quiz");
  }

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
      duration_s: Math.round((Date.now() - quizKey) / 1000),
      mode: "practice",
    })
      .catch(() => toast.error("تعذّر حفظ النتيجة"))
      .finally(refresh);
    setMode("result");
  }

  // Handle AI Categorization submit
  async function handleAiCategorization() {
    const list = subheadingsInput
      .split(/[,،\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!list.length) {
      toast.error("يرجى كتابة عنوان فرعي واحد على الأقل");
      return;
    }

    setIsCategorizing(true);
    try {
      const res = await catFn({
        data: {
          unitId,
          subheadings: list,
        },
      });
      toast.success(`تم تصنيف وترتيب ${res.updated} سؤالاً بالذكاء الاصطناعي بنجاح! 🎉`);
      notifyLiveSync("questions_changed");
      await refresh();
      setAiModalOpen(false);
      setSubheadingsInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تصنيف الأسئلة، حاول مجددًا");
    } finally {
      setIsCategorizing(false);
    }
  }

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.trim().toLowerCase();
    return sections
      .map((s) => {
        const matchesHeading = s.heading.toLowerCase().includes(q);
        const matchedQuestions = s.questions.filter((item) =>
          item.question_text.toLowerCase().includes(q) ||
          item.options.some((opt) => opt.toLowerCase().includes(q)),
        );
        if (matchesHeading) return s;
        if (matchedQuestions.length > 0) return { ...s, questions: matchedQuestions, count: matchedQuestions.length };
        return null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [sections, search]);

  const correctCount = result ? result.filter((a) => a.correct).length : 0;
  const totalCount = result ? result.length : 0;
  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader
        title={mode === "quiz" ? activeQuizTitle : unit ? `وحدة: ${unit.name}` : "الوحدة"}
        back={mode === "overview"}
      />

      <main className="mx-auto max-w-3xl px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        {/* ── Mode 1: Active Quiz Runner ── */}
        {mode === "quiz" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-card p-3 rounded-2xl border border-border/80 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                <span className="font-bold text-sm text-foreground truncate">{activeQuizTitle}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5 h-8 font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => setMode("overview")}
              >
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                <span>العودة للأقسام</span>
              </Button>
            </div>

            <QuizRunner
              key={quizKey}
              questions={quizQuestions}
              feedback
              onAnswer={onAnswer}
              onDone={onDone}
            />
          </div>
        )}

        {/* ── Mode 2: Quiz Result Celebration ── */}
        {mode === "result" && result && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-soft space-y-6 animate-in zoom-in-95 duration-200 max-w-lg mx-auto">
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
              <p className="mt-1 text-xs text-muted-foreground">{activeQuizTitle}</p>
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

            <div className="grid gap-2.5 pt-2">
              <Button
                size="lg"
                className="w-full h-12 rounded-xl font-bold gap-2 shadow-xs"
                onClick={() => {
                  setResult(null);
                  setQuizKey(Date.now());
                  setQuizQuestions(shuffle(quizQuestions).map((q) => shuffleOptions(q)));
                  setMode("quiz");
                }}
              >
                <RotateCcw className="h-4 w-4" />
                <span>إعادة التدريب</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 rounded-xl font-medium"
                onClick={() => {
                  setResult(null);
                  setMode("overview");
                }}
              >
                العودة إلى الأقسام والعناوين الفرعية
              </Button>
            </div>
          </div>
        )}

        {/* ── Mode 3: Unit Overview & Subheadings Hub ── */}
        {mode === "overview" && (
          <>
            {/* Unit Info & Action Card */}
            <section className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
                      {unit?.name || "الوحدة"}
                    </h1>
                    {unit?.status && (
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                        {unit.status === "done" ? "مكتملة" : unit.status === "progress" ? "قيد التقدّم" : "جديدة"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    تتضمن {unitQuestions.length} سؤالاً موزعة تحت {sections.length} عناوين فرعية
                    {unit?.best != null ? ` · أفضل نتيجة ${unit.best}%` : ""}
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={!unitQuestions.length}
                    className="h-10 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-xs"
                    onClick={startFullUnitQuiz}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>بدء تدريب الوحدة كاملة</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-10 px-3.5 rounded-xl text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => navigate({ to: "/app/upload", search: { unitId } as any })}
                  >
                    <Upload className="h-4 w-4" />
                    <span>رفع أسئلة للوحدة</span>
                  </Button>
                </div>
              </div>

              {/* Secondary Tools: AI Reorganize */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  تصنيف ذكي بالذكاء الاصطناعي
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-primary font-semibold hover:bg-primary/10 gap-1 rounded-lg"
                  onClick={() => setAiModalOpen(true)}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>تنظيم أو تعديل العناوين بالذكاء الاصطناعي</span>
                </Button>
              </div>
            </section>

            {/* Empty State if Unit Has No Questions */}
            {!unitQuestions.length ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-card p-8 sm:p-12 text-center space-y-4 animate-scale-in">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                  لا توجد أسئلة مرفوعة في هذه الوحدة بعد
                </h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  ارفع ملف أسئلة (md) مخصص لهذه الوحدة مع تحديد العناوين الفرعية التي تريدها، وسيقوم الذكاء الاصطناعي بتصنيف وترتيب كل سؤال تحت عنوانه الأنسب تلقائيًا.
                </p>
                <div className="pt-2">
                  <Button
                    size="lg"
                    className="gap-2 rounded-xl h-11 px-6 font-bold shadow-xs"
                    onClick={() => navigate({ to: "/app/upload", search: { unitId } as any })}
                  >
                    <Upload className="h-4 w-4" />
                    <span>ارفع ملف أسئلة md لهذه الوحدة</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Subheadings and Questions Sections List */
              <div className="space-y-4">
                {/* Search Bar & Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      الأقسام والعناوين الفرعية ({sections.length})
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      اضغط على أي عنوان فرعي لاستعراض أسئلته أو التدرب عليه منفردًا.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="ابحث في الأقسام والأسئلة…"
                      className="h-9 text-xs ps-8 rounded-xl"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Subheadings Accordion List */}
                <div className="space-y-3">
                  {filteredSections.map((sec) => {
                    const isExpanded = expandedSections.has(sec.heading);
                    return (
                      <div
                        key={sec.heading}
                        className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all hover:border-primary/40"
                      >
                        {/* Subheading Header Row */}
                        <div
                          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer select-none bg-card hover:bg-muted/30 transition-colors gap-3"
                          onClick={() => toggleSection(sec.heading)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <FolderOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display text-sm sm:text-base font-bold text-foreground truncate">
                                {sec.heading}
                              </h3>
                              <p className="text-[11px] text-muted-foreground font-medium">
                                {sec.count} سؤال مصنفة تحت هذا العنوان
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-xl gap-1.5 shadow-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                startSubheadingQuiz(sec.heading, sec.questions);
                              }}
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span className="hidden sm:inline">تدريب هذا القسم</span>
                              <span className="sm:hidden">تدريب</span>
                            </Button>

                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              title={isExpanded ? "طي الأسئلة" : "عرض الأسئلة"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Questions List Inside This Subheading */}
                        {isExpanded && (
                          <div className="border-t border-border/60 p-3 sm:p-4 bg-muted/10 space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1">
                              <span>قائمة الأسئلة ({sec.questions.length})</span>
                              <span>مصنفة بالذكاء الاصطناعي</span>
                            </div>

                            <div className="space-y-2.5">
                              {sec.questions.map((q, qIdx) => (
                                <div
                                  key={q.id}
                                  className="rounded-xl border border-border/70 bg-card p-3.5 space-y-3 shadow-xs hover:border-border transition-all"
                                >
                                  {/* Question Header & Prompt */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                                        {qIdx + 1}
                                      </span>
                                      <p className="font-bold text-xs sm:text-sm text-foreground leading-relaxed">
                                        {q.question_text}
                                      </p>
                                    </div>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 rounded-lg shrink-0 gap-1"
                                      onClick={() => startSingleQuestionQuiz(q)}
                                    >
                                      <Play className="h-3 w-3 fill-current" />
                                      <span>تدرّب</span>
                                    </Button>
                                  </div>

                                  {/* Question Options */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {q.options.map((opt, optIdx) => {
                                      const isCorrect = optIdx === q.correct_index;
                                      return (
                                        <div
                                          key={optIdx}
                                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                                            isCorrect
                                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-semibold shadow-xs"
                                              : "border-border/60 bg-muted/20 text-muted-foreground"
                                          }`}
                                        >
                                          <span
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                                              isCorrect
                                                ? "bg-emerald-600 text-white"
                                                : "bg-muted text-muted-foreground"
                                            }`}
                                          >
                                            {isCorrect ? (
                                              <Check className="h-3 w-3 stroke-[3]" />
                                            ) : (
                                              ARABIC_LABELS[optIdx] ?? String(optIdx + 1)
                                            )}
                                          </span>
                                          <span className="truncate">{opt}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Explanation (if provided) */}
                                  {q.explanation && (
                                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-2.5 text-[11px] text-primary flex items-start gap-2">
                                      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                                      <p className="leading-relaxed">{q.explanation}</p>
                                    </div>
                                  )}

                                  {/* Shared Indicator (if from friend) */}
                                  {q.from_name && (
                                    <div className="text-[10px] text-primary font-medium">
                                      سؤال مشترك من الصديق: {q.from_name}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!filteredSections.length && (
                    <p className="py-10 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-dashed p-6">
                      لا توجد أقسام أو أسئلة تطابق بحثك.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── AI Subheadings Categorization Modal ── */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>تنظيم وتصنيف الأسئلة بالذكاء الاصطناعي</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              اكتب العناوين الفرعية التي تريد توزيع أسئلة هذه الوحدة ({unitQuestions.length} سؤال) تحتها. سيقوم الذكاء الاصطناعي بقراءة كل سؤال واختيار العنوان الفرعي الأنسب له بدقة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <label htmlFor="ai-subheadings-input" className="font-semibold text-foreground block">
              العناوين الفرعية (مفصولة بفواصل أو أسطر):
            </label>
            <textarea
              id="ai-subheadings-input"
              rows={4}
              placeholder="مثال: المعلقات وأصحابها، العصر الجاهلي، شعر الصعاليك، البلاغة والبيان"
              className="w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
              value={subheadingsInput}
              onChange={(e) => setSubheadingsInput(e.target.value)}
              disabled={isCategorizing}
            />
            <p className="text-[11px] text-muted-foreground">
              نصيحة: يمكنك كتابة أسماء الفصول أو الموضوعات الفرعية التي يتناولها هذا المنهج.
            </p>
          </div>

          <DialogFooter className="flex-row gap-2 justify-end sm:justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs h-9"
              onClick={() => setAiModalOpen(false)}
              disabled={isCategorizing}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs h-9 font-bold gap-1.5 shadow-xs"
              onClick={handleAiCategorization}
              disabled={isCategorizing}
            >
              {isCategorizing ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>جارٍ التصنيف بالذكاء الاصطناعي…</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>بدء التصنيف والترتيب</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
