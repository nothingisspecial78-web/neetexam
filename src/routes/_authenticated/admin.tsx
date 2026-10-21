import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  FileText,
  Swords,
  Activity,
  Download,
  Search,
  CheckCircle2,
  Ban,
  Clock,
  Sparkles,
  ArrowRight,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/auth.functions";
import { adminLog, adminOverview, adminSetBan } from "@/lib/admin.functions";
import { toCsv } from "@/lib/admin-stats";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة والمراقبة — مِدْرَاس" },
      { name: "description", content: "لوحة التحكم للمشرف العام." },
      { property: "og:title", content: "لوحة الإدارة والمراقبة — مِدْرَاس" },
      { property: "og:description", content: "لوحة التحكم للمشرف العام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const EVENTS: Record<string, { label: string; color: string; bg: string }> = {
  sign_up: { label: "تسجيل جديد", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/15" },
  sign_in: { label: "دخول", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-500/15" },
  file_upload: { label: "رفع ملف", color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-500/15" },
  questions_published: { label: "نشر أسئلة", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/15" },
  friend_request_sent: { label: "طلب صداقة", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-500/15" },
  friend_request_accepted: { label: "قبول صداقة", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-500/15" },
  match_started: { label: "بدء مباراة", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/15" },
  match_finished: { label: "انتهاء مباراة", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/15" },
  admin_ban: { label: "حظر مشرف", color: "text-red-700 dark:text-red-300", bg: "bg-red-500/15" },
  admin_unban: { label: "رفع حظر", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-500/15" },
  account_deleted: { label: "حذف حساب", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/15" },
};

function AdminPage() {
  const roleFn = useServerFn(getMyRole);
  const role = useQuery({ queryKey: ["my-role"], queryFn: () => roleFn(), staleTime: Infinity });

  if (role.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">جارٍ التحقق من صلاحيات المشرف…</p>
      </div>
    );
  }

  if (role.data?.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center bg-background" dir="rtl">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10 text-red-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="font-display text-4xl font-bold">403</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          ليست لديك صلاحية الوصول إلى لوحة المشرف العام. هذه المنطقة مخصصة لإدارة النظام فقط.
        </p>
        <Button asChild className="rounded-xl mt-2">
          <Link to="/app">العودة لتطبيق الطالب</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Mobile-optimized Header */}
      <header className="bg-hero sticky top-0 z-40 flex items-center justify-between px-3.5 sm:px-6 py-3 text-white shadow-soft">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            to="/app"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95"
            title="الانتقال لتطبيق الطالب"
          >
            <img src="/app-icon.png" alt="مِدْرَاس" className="h-7 w-7 rounded-lg object-cover shadow-xs" />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 truncate">
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight">مِدْرَاس</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] sm:text-xs font-black shadow-xs shrink-0">
              <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              المشرف العام
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-xl bg-white/15 hover:bg-white/25 text-white border-0 gap-1 transition-all active:scale-95"
          >
            <Link to="/app">
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              <span className="hidden sm:inline">تطبيق الطالب</span>
              <span className="sm:hidden">الطالب</span>
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        <Tabs defaultValue="active" dir="rtl" className="w-full">
          {/* Mobile-first 2x2 grid, Desktop 4-col row */}
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1.5 rounded-2xl bg-muted/60 border border-border/60 gap-1.5 shadow-xs">
            <TabsTrigger
              value="active"
              className="h-11 sm:h-10 rounded-xl gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Activity className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="truncate">النشاط المباشر</span>
            </TabsTrigger>
            <TabsTrigger
              value="questions"
              className="h-11 sm:h-10 rounded-xl gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <FileText className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="truncate">الأسئلة والمحتوى</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="h-11 sm:h-10 rounded-xl gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Users className="h-4 w-4 shrink-0 text-purple-500" />
              <span className="truncate">المستخدمون</span>
            </TabsTrigger>
            <TabsTrigger
              value="log"
              className="h-11 sm:h-10 rounded-xl gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Clock className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">سجل العمليات</span>
            </TabsTrigger>
          </TabsList>

          <Overview />
          <TabsContent value="log" className="mt-4 focus-visible:outline-none">
            <LogTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-all ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border/80 bg-card"
      }`}
    >
      <div className="text-xs font-semibold text-muted-foreground truncate">{label}</div>
      <div className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function Bars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="overflow-x-auto pb-1 scrollbar-none rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs">
      <div className="flex h-36 min-w-[320px] items-end gap-1.5 sm:gap-2">
        {data.map((d, i) => {
          const heightPct = Math.max(4, Math.round((d.count / max) * 100));
          const showLabel = data.length <= 14 || i % 2 === 0 || i === data.length - 1;
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end" title={`${d.day}: ${d.count}`}>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-primary-600 to-primary-400 hover:brightness-110 transition-all cursor-pointer"
                style={{ height: `${heightPct}%` }}
              />
              <span className={`text-[10px] text-muted-foreground font-mono transition-opacity ${showLabel ? "opacity-100" : "opacity-0 sm:opacity-100"}`}>
                {d.day.slice(8)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Overview() {
  const fn = useServerFn(adminOverview);
  const banFn = useServerFn(adminSetBan);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn(), refetchInterval: 15_000 });
  const [search, setSearch] = useState("");

  if (q.isPending) {
    return <p className="py-12 text-center text-sm text-muted-foreground animate-pulse">جارٍ تحميل إحصاءات الإدارة…</p>;
  }
  if (q.isError || !q.data) {
    return <p className="py-12 text-center text-sm text-destructive">تعذّر تحميل بيانات لوحة الإدارة.</p>;
  }

  const d = q.data;

  async function toggleBan(id: string, banned: boolean) {
    try {
      await banFn({ data: { userId: id, banned } });
      toast.success(banned ? "تم حظر المستخدم" : "تم رفع الحظر عن المستخدم");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const users = d.users.filter(
    (u) => !search || `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {/* ── Active Tab ── */}
      <TabsContent value="active" className="space-y-5 mt-4 focus-visible:outline-none">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
          <Stat
            label="متصل الآن"
            value={d.onlineNow}
            sub="طلاب نشطون حاليًا"
            highlight={d.onlineNow > 0}
          />
          <Stat label="نشط اليوم" value={d.activity.today} />
          <Stat label="نشط آخر 7 أيام" value={d.activity.week} />
          <Stat label="نشط آخر 30 يومًا" value={d.activity.month} />
        </div>

        <section className="space-y-2.5">
          <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
            المستخدمون النشطون يوميًا (DAU)
          </h3>
          <Bars data={d.dau} />
        </section>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {/* Currently Online Users */}
          <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              المتصلون الآن ({d.onlineNow})
            </h3>
            <div className="divide-y divide-border/60 max-h-56 overflow-y-auto pe-1">
              {d.users
                .filter((u) => u.online)
                .map((u) => (
                  <div key={u.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{u.name || "طالب"}</p>
                      <p className="text-muted-foreground font-mono text-[11px] truncate" dir="ltr">{u.email}</p>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                      نشط
                    </span>
                  </div>
                ))}
              {d.onlineNow === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">لا يوجد مستخدمون متصلون الآن.</p>
              )}
            </div>
          </section>

          {/* Arena Stats */}
          <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-500" />
              مؤشرات ساحة المنافسة
            </h3>
            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="rounded-xl bg-muted/40 p-2.5 sm:p-3 text-center">
                <p className="text-lg sm:text-xl font-bold font-display text-foreground tabular-nums">{d.arena.played}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">مباراة لُعبت</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-2.5 sm:p-3 text-center">
                <p className="text-lg sm:text-xl font-bold font-display text-primary tabular-nums">{d.arena.avgCredits}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">متوسط الرصيد</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-2.5 sm:p-3 text-center">
                <p className="text-lg sm:text-xl font-bold font-display text-destructive tabular-nums">{d.arena.suspicious}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">حالات مشبوهة</p>
              </div>
            </div>
          </section>
        </div>
      </TabsContent>

      {/* ── Questions Tab ── */}
      <TabsContent value="questions" className="space-y-5 mt-4 focus-visible:outline-none">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
          <Stat label="إجمالي الأسئلة" value={d.questions.total} highlight />
          <Stat label="أسئلة منشورة" value={d.questions.active} />
          <Stat label="مسودات قيد المراجعة" value={d.questions.draft} />
          <Stat label="صُحّحت بعد تنبيه الذكاء" value={d.questions.flaggedFixed} />
        </div>

        <section className="space-y-2.5">
          <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
            معدل رفع الأسئلة اليومي
          </h3>
          <Bars data={d.questions.uploadsPerDay} />
        </section>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
            <h3 className="font-bold text-sm mb-3">توزيع الأسئلة حسب الموضوع</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
              {d.questions.byTopic.map(([t, n]) => (
                <div key={t} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                  <span className="font-medium text-foreground truncate max-w-[200px]">{t}</span>
                  <span className="font-bold font-mono text-primary shrink-0">{n}</span>
                </div>
              ))}
              {d.questions.byTopic.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">لا توجد أسئلة مسجلة حاليًا.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
            <h3 className="font-bold text-sm mb-3">أكثر الطلاب رفعًا للأسئلة</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
              {d.questions.topUploaders.map(([t, n]) => (
                <div key={t} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                  <span className="font-medium text-foreground truncate max-w-[200px]">{t}</span>
                  <span className="font-bold font-mono text-primary shrink-0">{n} سؤال</span>
                </div>
              ))}
              {d.questions.topUploaders.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">لا توجد بيانات رفع حاليًا.</p>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Users Tab ── */}
      <TabsContent value="users" className="space-y-4 mt-4 focus-visible:outline-none">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو البريد الإلكتروني…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-11 rounded-xl bg-card text-xs sm:text-sm"
          />
        </div>

        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 text-xs">
              <div className="flex items-start gap-3 min-w-0">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                  {(u.name || "ط").charAt(0)}
                  {u.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500 animate-pulse" />
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-sm text-foreground truncate">{u.name || "طالب"}</span>
                    {u.banned && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 font-bold text-[10px]">
                        محظور
                      </span>
                    )}
                    {!u.confirmed && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px]">
                        بريد غير مؤكد
                      </span>
                    )}
                    {u.online && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">
                        متصل الآن
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px] flex flex-wrap items-center gap-2" dir="ltr">
                    <span className="truncate max-w-[200px] sm:max-w-none">{u.email}</span>
                    <span>·</span>
                    <span className="text-primary font-bold">{u.credits} رصيد</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end sm:self-center shrink-0 pt-1 sm:pt-0">
                <Button
                  size="sm"
                  variant={u.banned ? "outline" : "destructive"}
                  className="rounded-xl text-xs font-semibold h-8 w-full sm:w-auto min-w-[100px]"
                  onClick={() => toggleBan(u.id, !u.banned)}
                >
                  {u.banned ? "إلغاء الحظر" : "حظر المستخدم"}
                </Button>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">لا يوجد مستخدمون يطابقون البحث.</p>
          )}
        </div>
      </TabsContent>
    </>
  );
}

function LogTab() {
  const fn = useServerFn(adminLog);
  const ov = useQuery({ queryKey: ["admin-overview"], enabled: false }) as {
    data?: { users: { id: string; name: string; email: string }[] };
  };
  const [eventType, setEventType] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [live, setLive] = useState(true);

  const filter = {
    eventType: eventType || undefined,
    userId: userId || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
  };

  const q = useQuery({
    queryKey: ["admin-log", filter],
    queryFn: () => fn({ data: filter }),
    refetchInterval: live ? 3000 : false,
  });

  const users = ov.data?.users ?? [];
  const who = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.name || "مستخدم"} (${u.email || ""})` : id?.slice(0, 8) ?? "—";
  };

  const rows = (q.data ?? []).map((r) => ({
    time: new Date(r.created_at).toLocaleString("ar"),
    user: who(r.user_id),
    rawEvent: r.event_type,
    eventMeta: EVENTS[r.event_type] ?? {
      label: r.event_type,
      color: "text-foreground",
      bg: "bg-muted",
    },
    details: r.details,
  }));

  function exportCsv() {
    const blob = new Blob(
      [
        "\ufeff" +
          toCsv(
            rows.map((r) => ({
              time: r.time,
              user: r.user,
              event: r.eventMeta.label,
              details: r.details,
            })),
          ),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `medras-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Mobile-friendly Filter Controls */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-card shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold h-10"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">كل أنواع الأحداث</option>
            {Object.entries(EVENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold h-10"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">جميع المستخدمين</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || "مستخدم"}
              </option>
            ))}
          </select>

          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl text-xs h-10"
            placeholder="من تاريخ"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl text-xs h-10"
            placeholder="إلى تاريخ"
          />
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <Button
            size="sm"
            variant={live ? "default" : "outline"}
            className="flex-1 sm:flex-initial rounded-xl text-xs gap-1.5 h-9"
            onClick={() => setLive(!live)}
          >
            <span className={`h-2 w-2 rounded-full ${live ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
            <span>{live ? "بث مباشر نشط" : "البث متوقف"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-initial rounded-xl text-xs gap-1.5 h-9"
            onClick={exportCsv}
          >
            <Download className="h-3.5 w-3.5" />
            <span>تصدير CSV</span>
          </Button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-3.5 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 ${r.eventMeta.bg} ${r.eventMeta.color}`}
              >
                {r.eventMeta.label}
              </span>
              <span className="font-bold text-foreground text-xs sm:text-sm truncate">{r.user}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-muted-foreground text-[11px]">
              {r.details && (
                <span className="break-all font-mono text-[10px] bg-muted/40 px-2 py-0.5 rounded-md max-w-xs truncate" dir="ltr">
                  {typeof r.details === "object" ? JSON.stringify(r.details) : String(r.details)}
                </span>
              )}
              <span className="shrink-0 text-muted-foreground/80 font-mono text-[10px] sm:text-[11px] self-end sm:self-auto">{r.time}</span>
            </div>
          </div>
        ))}

        {!rows.length && (
          <p className="py-10 text-center text-xs text-muted-foreground">لا توجد عمليات مسجلة في هذا النطاق.</p>
        )}
      </div>
    </div>
  );
}
