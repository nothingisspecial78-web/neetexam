import { createFileRoute, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useState } from "react";
import { DashboardBoundary, StudentDashboard } from "@/components/StudentDashboard";
import { dashboardOptions } from "@/lib/dashboard-query";
import { type Filters } from "@/lib/dashboard";
import { toast } from "sonner";
import { Upload, Layers, Swords, Users, BookOpen, ChevronLeft, Coins, Flame, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { AppHeader } from "@/components/AppHeader";
import { usePresence } from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { DeleteAccount } from "@/components/DeleteAccount";
import { Input } from "@/components/ui/input";

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
  errorComponent: () => <p role="alert">تعذّر تحميل لوحة الطالب.</p>,
  notFoundComponent: () => <p>الصفحة غير موجودة.</p>,
  head: () => ({
    meta: [
      { title: "لوحة التقدّم — مِدْرَاس" },
      { name: "description", content: "تابع دقّتك، تقدّمك، أخطاءك ورصيدك في مِدْرَاس." },
      { property: "og:title", content: "لوحة التقدّم — مِدْرَاس" },
      { property: "og:description", content: "تابع دقّتك، تقدّمك، أخطاءك ورصيدك في مِدْرَاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentHome,
});

const navItems = [
  { icon: Upload,  label: "رفع أسئلة",    to: "/app/upload"    as const, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { icon: Layers,  label: "أسئلتي",        to: "/app/questions" as const, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300" },
  { icon: BookOpen,label: "الوحدات",       to: "/app/units"     as const, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300" },
  { icon: Users,   label: "الأصدقاء",      to: "/app/friends"   as const, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300" },
  { icon: Swords,  label: "الساحة",        to: "/app/arena"     as const, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300" },
];

function StudentHome() {
  const { user } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roleFn = useServerFn(getMyRole);
  usePresence();

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
      const read = () =>
        supabase.from("profiles").select("display_name, onboarded").eq("id", user.id).maybeSingle();
      let { data, error } = await read();
      if (error) throw error;
      if (!data) {
        await supabase.rpc("ensure_my_profile");
        ({ data, error } = await read());
        if (error || !data) throw error ?? new Error("no profile");
      }
      return data;
    },
    staleTime: 300_000,
    gcTime: 30 * 60_000,
    placeholderData: (prev) =>
      prev ?? {
        display_name:
          (user.user_metadata as Record<string, string> | undefined)?.["display_name"] ||
          (user.user_metadata as Record<string, string> | undefined)?.["full_name"] ||
          user.email?.split("@")[0] ||
          "طالب",
        onboarded: true,
      },
  });

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

  const p = profile.data;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── App Header ── */}
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-6 md:px-8">
        {profile.isError ? (
          <div className="animate-fade-in rounded-2xl border bg-card p-8 text-center shadow-card">
            <p className="text-muted-foreground">تعذّر تحميل حسابك.</p>
            <Button className="mt-4" onClick={() => profile.refetch()}>
              حاول مجددًا
            </Button>
          </div>
        ) : !p ? (
          /* Loading skeleton */
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !p.onboarded ? (
          /* Onboarding card */
          <div className="animate-scale-in mx-auto max-w-sm rounded-2xl border bg-card p-8 shadow-soft">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <BookOpen className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-2xl font-bold">مرحبًا بك في مِدْرَاس!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ما اسمك الذي سيظهر للآخرين؟
            </p>
            <Input
              id="onboarding-name"
              className="mt-4 h-12 rounded-xl"
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
            {/* ── Greeting section ── */}
            <div className="animate-fade-in-up mb-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">أهلًا بعودتك</p>
                  <h1 className="font-display text-2xl font-bold md:text-3xl">
                    {p.display_name} 👋
                  </h1>
                </div>
                {/* Credit chip placeholder — will show data when dashboard loads */}
                <div className="flex items-center gap-2">
                  <span className="credit-chip">
                    <Coins className="h-3.5 w-3.5" />
                    <span>—</span>
                  </span>
                </div>
              </div>
            </div>

            {/* ── Quick action nav cards ── */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {navItems.map((item, i) => {
                const hasAlert =
                  (item.to === "/app/friends" && !!incoming.data) ||
                  (item.to === "/app/arena" && !!invites.data);
                return (
                  <button
                    key={item.to}
                    id={`nav-${item.label}`}
                    className={`animate-fade-in-up stagger-${i + 1} group relative flex flex-col items-center gap-2.5 rounded-2xl border bg-card px-3 py-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.97] cursor-pointer text-center`}
                    onClick={() => navigate({ to: item.to })}
                  >
                    {hasAlert && (
                      <span className="absolute right-2.5 top-2.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                      </span>
                    )}
                    <span className={`rounded-xl p-2.5 ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold leading-tight">{item.label}</span>
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground ltr:rotate-180 group-hover:text-primary transition-colors" />
                    {item.to === "/app/friends" && !!incoming.data && (
                      <span className="absolute -top-1.5 -left-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-white">
                        {incoming.data}
                      </span>
                    )}
                    {item.to === "/app/arena" && !!invites.data && (
                      <span className="absolute -top-1.5 -left-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-white">
                        تحدٍّ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Dashboard analytics ── */}
            <DashboardBoundary>
              <Suspense
                fallback={
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
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

            <div className="mt-8">
              <DeleteAccount />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
