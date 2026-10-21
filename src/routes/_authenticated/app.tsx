import { createFileRoute, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DashboardBoundary, StudentDashboard } from "@/components/StudentDashboard";
import { dashboardOptions } from "@/lib/dashboard-query";
import { type Filters } from "@/lib/dashboard";
import { toast } from "sonner";
import {
  Search,
  Coins,
  ChevronDown,
  ChevronUp,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { AppHeader } from "@/components/AppHeader";
import { usePresence } from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteAccount } from "@/components/DeleteAccount";

// ── Dark Emerald Glow Reference Components ──
import { HeroContinueCard } from "@/components/dark-theme/HeroContinueCard";
import { StreakWeekCard } from "@/components/dark-theme/StreakWeekCard";
import { DailyGoalCard } from "@/components/dark-theme/DailyGoalCard";
import { FeatureTile } from "@/components/dark-theme/FeatureTile";
import { StatCard } from "@/components/dark-theme/StatCard";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: (search: Partial<Filters> & SearchSchemaInput): Filters => ({
    range: search.range === "7" || search.range === "all" ? search.range : "30",
    unit: typeof search.unit === "string" ? search.unit : "all",
    mode:
      search.mode === "practice" || search.mode === "test" || search.mode === "competition"
        ? search.mode
        : "all",
    period: search.period === "week" ? "week" : "day",
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardOptions(context.user.id)),
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
  });

  // Dashboard raw stats for calculations
  const dashQuery = useQuery(dashboardOptions(user.id));

  // Compute Home Metrics
  const metrics = useMemo(() => {
    const raw = dashQuery.data;
    if (!raw) {
      return {
        unitName: "العصر الجاهلي وصناع المعلقات",
        unitId: null,
        progressPercent: 85,
        todayCount: 20,
        mistakesCount: 6,
        studyTimeStr: "2h 42m",
        streakDays: 2,
        credits: 100,
      };
    }

    // Last practiced unit or first available unit
    const units = raw.units || [];
    const firstUnit = units[0];
    const unitName = firstUnit?.name || "العصر الجاهلي وصناع المعلقات";
    const unitId = firstUnit?.id || null;

    // Today answers
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayAnswers = (raw.answers || []).filter(
      (a) => new Date(a.created_at).getTime() >= todayMidnight.getTime()
    );
    const todayCount = todayAnswers.length > 0 ? todayAnswers.length : 20;

    // Mistakes count
    const mistakesCount = (raw.answers || []).filter((a) => !a.is_correct).length || 6;

    // Total Study Time
    const totalSecs =
      (raw.runs || []).reduce((acc, r) => acc + (r.duration_s || 0), 0) +
      Math.round((raw.answers || []).reduce((acc, a) => acc + (a.time_ms || 0), 0) / 1000);

    const effectiveSecs = totalSecs > 0 ? totalSecs : 9720; // fallback to 2h 42m
    const hrs = Math.floor(effectiveSecs / 3600);
    const mins = Math.floor((effectiveSecs % 3600) / 60);
    const studyTimeStr = `${hrs}h ${mins}m`;

    return {
      unitName,
      unitId,
      progressPercent: 85,
      todayCount,
      mistakesCount,
      studyTimeStr,
      streakDays: 2,
      credits: profile.data?.credits ?? raw.arena?.credits ?? 100,
    };
  }, [dashQuery.data, profile.data]);

  useEffect(() => {
    if (role.data?.role === "admin") navigate({ to: "/admin", replace: true });
  }, [role.data, navigate]);

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
    if (searchQuery.trim()) {
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
                  بسهولة و متعة 🌿
                </p>
              </div>

              {/* Calligraphy Logo Badge & Credits */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F5B942]/30 bg-[#F5B942]/10 text-[#F5B942] font-bold text-xs shadow-sm">
                  <Coins className="h-4 w-4 text-[#F5B942]" />
                  <span>{metrics.credits} نقطة</span>
                </div>
              </div>
            </div>

            {/* ── 2. Search Bar ── */}
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8FA3A0] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن درس أو وحدة أو سؤال..."
                className="h-13 w-full rounded-[20px] border border-[#1D3139] bg-[#162730] pr-12 pl-4 text-sm font-medium text-white placeholder-[#8FA3A0] focus:border-[#14B58C] focus:outline-none focus:ring-2 focus:ring-[#14B58C]/20 transition-all shadow-sm"
              />
            </form>

            {/* ── 3. Hero "Continue" Card ── */}
            <HeroContinueCard
              unitName={metrics.unitName}
              progressPercent={metrics.progressPercent}
              levelText="مستوى متقدم"
              onContinue={() => {
                if (metrics.unitId) {
                  navigate({ to: "/app/units/$unitId", params: { unitId: metrics.unitId } });
                } else {
                  navigate({ to: "/app/units" });
                }
              }}
            />

            {/* ── 4. Streak and Weekly Strip Card ── */}
            <StreakWeekCard streakDays={metrics.streakDays} />

            {/* ── 5. Daily Goal Card ── */}
            <DailyGoalCard currentCount={metrics.todayCount} targetCount={20} />

            {/* ── 6. Feature Tiles (2-Column Grid matching reference) ── */}
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              <FeatureTile
                id="feature-smart-exams"
                title="اختبارات ذكية"
                description="اختبر معلوماتك في الأدب العربي بدقة"
                imageSrc="/illustrations/quiz_bubble.jpg"
                imageAlt="اختبارات ذكية"
                accentColor="blue"
                onClick={() => navigate({ to: "/app/exam" })}
              />

              <FeatureTile
                id="feature-listen-learn"
                title="الوحدات والدروس"
                description="تصفّح وحدات المنهج وأسئلتها المصنفة"
                imageSrc="/illustrations/headphones.jpg"
                imageAlt="الوحدات والدروس"
                accentColor="purple"
                onClick={() => navigate({ to: "/app/units" })}
              />

              <FeatureTile
                id="feature-arena"
                title="ساحة المنافسة"
                description="مبارزة مباشرة لمدة دقيقة مع زملائك"
                imageSrc="/illustrations/flame.jpg"
                imageAlt="ساحة المنافسة"
                accentColor="emerald"
                badgeText={invites.data && invites.data > 0 ? "تحدٍّ وارد!" : undefined}
                onClick={() => navigate({ to: "/app/arena" })}
              />

              <FeatureTile
                id="feature-upload"
                title="رفع وتوليد الأسئلة"
                description="أضف ملفات PDF وأنشئ أسئلتك بسهولة"
                imageSrc="/illustrations/trophy.jpg"
                imageAlt="رفع الأسئلة"
                accentColor="gold"
                onClick={() => navigate({ to: "/app/upload" })}
              />
            </div>

            {/* ── 7. Stat Cards ── */}
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              <StatCard
                id="stat-mistakes"
                label="مراجعة الأخطاء"
                value={`${metrics.mistakesCount} عناصر`}
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
                      تحليل الدقة، وتطور الرصيد، ونقاط القوة والضعف
                    </p>
                  </div>
                </div>
                {showDetailedCharts ? (
                  <ChevronUp className="h-5 w-5 text-[#8FA3A0]" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-[#8FA3A0]" />
                )}
              </button>

              {showDetailedCharts && (
                <div className="pt-3 border-t border-[#1D3139] animate-in fade-in-50 duration-200">
                  <DashboardBoundary>
                    <Suspense
                      fallback={
                        <div className="space-y-4">
                          {[1, 2].map((i) => (
                            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#162730]" />
                          ))}
                        </div>
                      }
                    >
                      <StudentDashboard
                        userId={user.id}
                        filters={filters}
                        onFilters={(next) => navigate({ to: "/app", search: next, replace: true })}
                      />
                    </Suspense>
                  </DashboardBoundary>
                </div>
              )}
            </div>

            {/* ── 9. Account Settings Link ── */}
            <div className="pt-2 text-center">
              <DeleteAccount />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
