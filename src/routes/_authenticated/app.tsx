import { createFileRoute, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DashboardBoundary, StudentDashboard } from "@/components/StudentDashboard";
import { dashboardOptions } from "@/lib/dashboard-query";
import { type Filters, studyStreak } from "@/lib/dashboard";
import { unitsOptions } from "@/lib/units";
import { myQuestionsOptions } from "@/lib/my-questions";
import { toast } from "sonner";
import {
  Search,
  Coins,
  ChevronDown,
  ChevronUp,
  BarChart3,
  BookOpen,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { AppHeader } from "@/components/AppHeader";
import { usePresence } from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Dark Emerald Glow Reference Components ──
import { HeroContinueCard } from "@/components/dark-theme/HeroContinueCard";
import { StreakWeekCard } from "@/components/dark-theme/StreakWeekCard";
import { DailyGoalCard } from "@/components/dark-theme/DailyGoalCard";
import { FeatureTile } from "@/components/dark-theme/FeatureTile";
import { StatCard } from "@/components/dark-theme/StatCard";

export const Route = createFileRoute("/_authenticated/app")({
  ssr: false,
  validateSearch: (search: Partial<Filters> & SearchSchemaInput): Filters => ({
    range: search.range === "7" || search.range === "all" ? search.range : "30",
    unit: typeof search.unit === "string" ? search.unit : "all",
    mode:
      search.mode === "practice" || search.mode === "test" || search.mode === "competition"
        ? search.mode
        : "all",
    period: search.period === "week" ? "week" : "day",
  }),
  loader: ({ context }) => {
    const query = dashboardOptions(context.user.id);
    const cached = context.queryClient.getQueryData(query.queryKey);
    if (cached) return cached;
    return context.queryClient.ensureQueryData(query);
  },
  errorComponent: () => <p role="alert" className="text-center py-12 text-destructive">تعذّر تحميل لوحة الطالب.</p>,
  notFoundComponent: () => <p className="text-center py-12 text-muted-foreground">الصفحة غير موجودة.</p>,
  head: () => ({
    meta: [
      { title: "تعلّم العربية بسهولة ومتعة — مِدْرَاس" },
      { name: "description", content: "تابع تقدّمك وتدرّب على أسئلة الأدب العربي ونافس زملاءك." },
      { property: "og:title", content: "تعلّم العربية بسهولة ومتعة — مِدْرَاس" },
      { property: "og:description", content: "تابع تقدّمك وتدرّب على أسئلة الأدب العربي ونافس زملاءك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentHome,
});

function StudentHome() {
  const { user } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roleFn = useServerFn(getMyRole);
  usePresence();

  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailedCharts, setShowDetailedCharts] = useState(false);

  // Incoming Friend Requests Badge
  const incoming = useQuery({
    queryKey: ["incoming", user.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", user.id)
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  // Arena Invites Badge
  const invites = useQuery({
    queryKey: ["arena-invites", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, created_at")
        .eq("player_b", user.id)
        .eq("kind", "challenge")
        .eq("status", "invited");
      if (!data) return 0;
      const active = data.filter((m) => {
        const age = Date.now() - new Date(m.created_at).getTime();
        return age <= 65_000 && age >= -15_000;
      });
      return active.length;
    },
    refetchInterval: 10_000,
  });

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => roleFn(), staleTime: Infinity });
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, onboarded, credits")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (prev) => prev,
  });

  // Raw dashboard activity stats
  const dashQuery = useQuery(dashboardOptions(user.id));

  // Units stats with real progress & accuracy
  const unitsQuery = useQuery(unitsOptions(user.id));

  // Questions query to see drafts
  const myQuestionsQuery = useQuery(myQuestionsOptions(user.id));

  // Compute live connected metrics from database
  const metrics = useMemo(() => {
    const rawDash = dashQuery.data;
    const unitsList = unitsQuery.data?.stats ?? [];
    const questionsList = myQuestionsQuery.data ?? [];

    // 1. Choose Unit to continue:
    // Prefer unit with status === "progress", then "new", then first unit
    const inProgressUnit = unitsList.find((u) => u.status === "progress");
    const activeUnit = inProgressUnit || unitsList.find((u) => u.status === "new") || unitsList[0];

    const hasUnits = !!activeUnit;
    const unitName = activeUnit?.name || "ابدأ بإنشاء أو رفع وحدتك الأولى";
    const unitId = activeUnit?.id || null;
    const progressPercent = activeUnit ? activeUnit.progress : 0;
    const levelText = !activeUnit
      ? "بداية الرحلة"
      : progressPercent < 35
      ? "مستوى مبتدئ"
      : progressPercent < 75
      ? "مستوى متوسط"
      : "مستوى متقدم";

    // 2. Real All Dates for Streak & Calendar
    const now = new Date();
    const allDates = [
      ...(rawDash?.answers || []).map((a) => a.created_at),
      ...(rawDash?.matches || []).map((m) => m.created_at),
    ];
    const streakDays = studyStreak(allDates, now);

    // 3. 7 Days Week Strip (RTL: Saturday -> Friday)
    const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
    const daysSinceSaturday = (dayOfWeek + 1) % 7;
    const arabicLabels = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
    const activeDateStrings = new Set(allDates.map((d) => d.slice(0, 10)));
    const todayIso = now.toISOString().slice(0, 10);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - daysSinceSaturday + i);
      const dateIso = d.toISOString().slice(0, 10);
      const isToday = dateIso === todayIso;
      const completed = activeDateStrings.has(dateIso);
      return {
        dayNum: d.getDate(),
        label: arabicLabels[i] || "س",
        completed,
        isToday,
      };
    });

    // 4. Today answers count for Daily Goal
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayCount = (rawDash?.answers || []).filter(
      (a) => new Date(a.created_at).getTime() >= todayMidnight.getTime()
    ).length;

    // 5. Mistakes count (unique questions answered incorrectly)
    const mistakesCount = (rawDash?.answers || []).filter((a) => !a.is_correct).length;

    // 6. Total Study Time
    const totalSecs =
      (rawDash?.runs || []).reduce((acc, r) => acc + (r.duration_s || 0), 0) +
      Math.round((rawDash?.answers || []).reduce((acc, a) => acc + (a.time_ms || 0), 0) / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const studyTimeStr = totalSecs > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : "0m";

    // 7. Ready Drafts
    const readyDrafts = questionsList.filter((q) => q.status === "draft");

    // 8. Arena Wins
    const arenaWins = (rawDash?.matches || []).filter((m) => m.winner_id === user.id).length;

    return {
      hasUnits,
      unitName,
      unitId,
      progressPercent,
      levelText,
      streakDays,
      weekDays,
      todayCount,
      mistakesCount,
      studyTimeStr,
      readyDraftsCount: readyDrafts.length,
      arenaWins,
      totalUnits: unitsList.length,
      totalTests: rawDash?.runs?.length || 0,
      credits: profile.data?.credits ?? rawDash?.arena?.credits ?? 100,
    };
  }, [dashQuery.data, unitsQuery.data, myQuestionsQuery.data, profile.data, user.id]);

  // Live search filtering for units
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim() || !unitsQuery.data?.stats) return [];
    const query = searchQuery.trim().toLowerCase();
    return unitsQuery.data.stats.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        (u.owner_name && u.owner_name.toLowerCase().includes(query))
    );
  }, [searchQuery, unitsQuery.data?.stats]);

  const [name, setName] = useState("");
  useEffect(() => {
    if (profile.data?.display_name) setName(profile.data.display_name);
  }, [profile.data?.display_name]);

  async function start() {
    if (!name.trim()) return void toast.error("اكتب اسمك");
    qc.setQueryData(["profile", user.id], { display_name: name.trim(), onboarded: true });
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), onboarded: true })
      .eq("id", user.id);
    if (error) {
      toast.error("تعذّر الحفظ");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filteredUnits.length === 1 && filteredUnits[0]) {
      navigate({ to: "/app/units/$unitId", params: { unitId: filteredUnits[0].id } });
      setSearchQuery("");
    } else {
      navigate({ to: "/app/units" });
    }
  }

  const p = profile.data;

  return (
    <div className="min-h-screen bg-[#0A1418] text-foreground pb-24" dir="rtl">
      {/* ── App Header ── */}
      <AppHeader />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-6">
        {profile.isError ? (
          <div className="animate-fade-in rounded-3xl border border-[#1D3139] bg-[#111E24] p-8 text-center shadow-card">
            <p className="text-[#8FA3A0]">تعذّر تحميل حسابك.</p>
            <Button className="mt-4" onClick={() => profile.refetch()}>
              حاول مجددًا
            </Button>
          </div>
        ) : !p ? (
          /* Loading skeleton */
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-[#111E24] border border-[#1D3139]" />
            ))}
          </div>
        ) : !p.onboarded ? (
          /* Onboarding card */
          <div className="animate-scale-in mx-auto max-w-sm rounded-3xl border border-[#1D3139] bg-[#111E24] p-8 shadow-soft">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14B58C]/15 text-[#2DD4A8]">
              <BookOpen className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">مرحبًا بك في مِدْرَاس!</h2>
            <p className="mt-2 text-sm text-[#8FA3A0]">ما اسمك الذي سيظهر للآخرين؟</p>
            <Input
              id="onboarding-name"
              className="mt-4 h-12 rounded-xl bg-[#162730] border-[#1D3139]"
              placeholder="اسمك الكامل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
            />
            <Button className="mt-4 h-12 w-full rounded-xl text-base font-semibold" size="lg" onClick={start}>
              ابدأ التعلّم
            </Button>
          </div>
        ) : (
          <>
            {/* ── 1. Page Header: Greeting + Bold Title + Subtitle + Logo ── */}
            <div className="flex items-start justify-between gap-4 pt-1">
              <div className="space-y-1 text-start">
                <span className="text-xs sm:text-sm font-semibold text-[#8FA3A0] flex items-center gap-1.5">
                  <span>مرحباً بك! 👋</span>
                  <span className="text-white font-bold">{p.display_name}</span>
                </span>
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  تعلم العربية
                </h1>
                <p className="text-sm sm:text-base font-bold text-[#2DD4A8]">
                  بسهولة و متعة 🍃
                </p>
              </div>

              {/* Calligraphy Logo Badge & Credits */}
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/app/arena" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F5B942]/30 bg-[#F5B942]/10 text-[#F5B942] font-bold text-xs shadow-sm hover:border-[#F5B942]/60 hover:bg-[#F5B942]/15 transition-all cursor-pointer"
                >
                  <Coins className="h-4 w-4 text-[#F5B942]" />
                  <span>{metrics.credits} نقطة</span>
                </button>
              </div>
            </div>

            {/* ── 2. Search Bar with Live Filter ── */}
            <div className="relative w-full">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8FA3A0] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن درس أو وحدة دراسية..."
                  className="h-13 w-full rounded-[20px] border border-[#1D3139] bg-[#162730] pr-12 pl-10 text-sm font-medium text-white placeholder-[#8FA3A0] focus:border-[#14B58C] focus:outline-none focus:ring-2 focus:ring-[#14B58C]/20 transition-all shadow-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8FA3A0] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>

              {/* Live search results overlay */}
              {searchQuery.trim().length > 0 && (
                <div className="absolute top-full mt-2 w-full z-40 rounded-2xl border border-[#1D3139] bg-[#111E24] p-3 shadow-2xl space-y-2 animate-scale-in">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8FA3A0] px-2 py-1">
                    <span>نتائج البحث ({filteredUnits.length})</span>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/app/units" })}
                      className="text-[#2DD4A8] hover:underline"
                    >
                      عرض في الوحدات
                    </button>
                  </div>
                  {filteredUnits.length > 0 ? (
                    filteredUnits.slice(0, 4).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          navigate({ to: "/app/units/$unitId", params: { unitId: u.id } });
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#162730] hover:bg-[#1D3139] transition-colors text-start"
                      >
                        <div>
                          <p className="font-bold text-sm text-white">{u.name}</p>
                          <p className="text-xs text-[#8FA3A0]">{u.total} سؤال · إنجاز {u.progress}%</p>
                        </div>
                        <span className="text-xs font-semibold text-[#2DD4A8]">تدريب ←</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[#8FA3A0] text-center py-3">
                      لا توجد وحدات مطابقة للبحث
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── 3. Hero "Continue" Card (Connected to Real Unit) ── */}
            <HeroContinueCard
              unitName={metrics.unitName}
              progressPercent={metrics.progressPercent}
              levelText={metrics.levelText}
              onContinue={() => {
                if (metrics.unitId) {
                  navigate({ to: "/app/units/$unitId", params: { unitId: metrics.unitId } });
                } else {
                  navigate({ to: "/app/units" });
                }
              }}
            />

            {/* ── 4. Streak and Weekly Strip Card (Connected to Real Activity Dates) ── */}
            <StreakWeekCard
              streakDays={metrics.streakDays}
              days={metrics.weekDays}
            />

            {/* ── 5. Daily Goal Card (Connected to Real Today Answers) ── */}
            <DailyGoalCard
              currentCount={metrics.todayCount}
              targetCount={20}
            />

            {/* ── 6. Feature Tiles (2-Column Grid matching reference) ── */}
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              <FeatureTile
                id="feature-smart-exams"
                title="اختبارات ذكية"
                description={metrics.totalTests > 0 ? `أجريت ${metrics.totalTests} اختباراً · تدريب شامل` : "اختبارات شاملة وتجريبية للمنهج"}
                imageSrc="/illustrations/quiz_bubble.jpg"
                imageAlt="اختبارات ذكية"
                accentColor="blue"
                onClick={() => navigate({ to: "/app/exam" })}
              />

              <FeatureTile
                id="feature-units"
                title="الوحدات والدروس"
                description={metrics.totalUnits > 0 ? `${metrics.totalUnits} وحدات دراسية متاحة للتعلّم` : "استكشف الفصول والموضوعات المصنفة"}
                imageSrc="/illustrations/headphones.jpg"
                imageAlt="الوحدات والدروس"
                accentColor="purple"
                onClick={() => navigate({ to: "/app/units" })}
              />

              <FeatureTile
                id="feature-arena"
                title="ساحة المنافسة"
                description={metrics.arenaWins > 0 ? `${metrics.arenaWins} انتصارات مسجلة · تحدٍّ مباشر` : "مبارزة حية لمدة 60 ثانية مع زملائك"}
                imageSrc="/illustrations/trophy.jpg"
                imageAlt="ساحة المنافسة"
                accentColor="gold"
                badgeText={invites.data && invites.data > 0 ? `${invites.data} تحدٍّ وارد!` : undefined}
                onClick={() => navigate({ to: "/app/arena" })}
              />

              <FeatureTile
                id="feature-upload"
                title="رفع وتوليد الأسئلة"
                description={metrics.readyDraftsCount > 0 ? `${metrics.readyDraftsCount} أسئلة بانتظار النشر` : "أضف ملفات PDF أو نصوص لإنشاء الأسئلة"}
                imageSrc="/illustrations/hero_student.jpg"
                imageAlt="رفع وتوليد الأسئلة"
                accentColor="emerald"
                badgeText={metrics.readyDraftsCount > 0 ? `${metrics.readyDraftsCount} مسودة` : undefined}
                onClick={() => navigate({ to: metrics.readyDraftsCount > 0 ? "/app/units" : "/app/upload" })}
              />
            </div>

            {/* ── 7. Stat Cards (Connected to Real Mistakes & Time) ── */}
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              <StatCard
                id="stat-mistakes"
                label="مراجعة الأخطاء"
                value={`${metrics.mistakesCount} ${metrics.mistakesCount === 1 ? "عنصر" : "عناصر"}`}
                imageSrc="/illustrations/pencil.jpg"
                imageAlt="قلم مراجعة الأخطاء"
                onClick={() => navigate({ to: "/app/units" })}
              />

              <StatCard
                id="stat-time"
                label="إجمالي وقت التعلم"
                value={metrics.studyTimeStr}
                imageSrc="/illustrations/clock.jpg"
                imageAlt="ساعة وقت التعلم"
                onClick={() => setShowDetailedCharts((prev) => !prev)}
              />
            </div>

            {/* ── 8. Collapsible Detailed Analytics & Charts ── */}
            <div className="rounded-[24px] border border-[#1D3139] bg-[#111E24] p-5 shadow-card space-y-4">
              <button
                type="button"
                onClick={() => setShowDetailedCharts((prev) => !prev)}
                className="w-full flex items-center justify-between text-start cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14B58C]/15 text-[#2DD4A8]">
                    <BarChart3 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-white group-hover:text-[#2DD4A8] transition-colors">
                      الرسوم والتقارير البيانية المفصلة
                    </h3>
                    <p className="text-xs text-[#8FA3A0]">
                      تحليل التقدم، والموضوعات الضعيفة، ونشاط الأيام
                    </p>
                  </div>
                </div>

                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1D3139] bg-[#162730] text-[#8FA3A0] group-hover:text-white transition-colors">
                  {showDetailedCharts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {showDetailedCharts && (
                <div className="pt-3 border-t border-[#1D3139] animate-fade-in">
                  <Suspense
                    fallback={
                      <div className="p-8 text-center text-xs text-[#8FA3A0]">
                        جارٍ تحميل الرسوم البيانية...
                      </div>
                    }
                  >
                    <DashboardBoundary>
                      <StudentDashboard
                        userId={user.id}
                        filters={filters}
                        onFilters={(f: Filters) =>
                          navigate({
                            to: "/app",
                            search: { ...filters, ...f },
                          })
                        }
                      />
                    </DashboardBoundary>
                  </Suspense>
                </div>
              )}
            </div>

          </>
        )}
      </main>
    </div>
  );
}
