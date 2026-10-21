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
};

function AdminPage() {
  const roleFn = useServerFn(getMyRole);
  const role = useQuery({ queryKey: ["my-role"], queryFn: () => roleFn(), staleTime: Infinity });

  if (role.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
      {/* Header */}
      <header className="bg-hero sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 text-white shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold">مِدْرَاس</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-400 text-slate-900 text-xs font-black shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              المشرف العام
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="h-8 text-xs font-semibold rounded-lg">
            <Link to="/app">تطبيق الطالب</Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <Tabs defaultValue="active" dir="rtl">
          <TabsList className="mb-4 h-11 p-1 rounded-xl bg-muted/60 border border-border/60">
            <TabsTrigger value="active" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm">
              <Activity className="h-4 w-4" />
              النشاط المباشر
            </TabsTrigger>
            <TabsTrigger value="questions" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              المحتوى والأسئلة
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              المستخدمون
            </TabsTrigger>
            <TabsTrigger value="log" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              سجل العمليات
            </TabsTrigger>
          </TabsList>

          <Overview />
          <TabsContent value="log">
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
      className={`rounded-2xl border p-4 shadow-xs transition-all ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border/80 bg-card"
      }`}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Bars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-36 items-end gap-1.5 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
      {data.map((d) => {
        const heightPct = Math.max(4, Math.round((d.count / max) * 100));
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end" title={`${d.day}: ${d.count}`}>
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-primary-600 to-primary-400 hover:brightness-110 transition-all cursor-pointer"
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[10px] text-muted-foreground font-mono">{d.day.slice(8)}</span>
          </div>
        );
      })}
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
    (u) => !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {/* ── Active Tab ── */}
      <TabsContent value="active" className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        <section className="space-y-3">
          <h3 className="font-display text-lg font-bold text-foreground">
            المستخدمون النشطون يوميًا (DAU)
          </h3>
          <Bars data={d.dau} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Currently Online Users */}
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              المتصلون الآن ({d.onlineNow})
            </h3>
            <div className="divide-y divide-border/60 max-h-56 overflow-y-auto pe-1">
              {d.users
                .filter((u) => u.online)
                .map((u) => (
                  <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">{u.name}</p>
                      <p className="text-muted-foreground font-mono" dir="ltr">{u.email}</p>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
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
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-500" />
              مؤشرات ساحة المنافسة
            </h3>
            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="rounded-xl bg-muted/40 p-3 text-center">
                <p className="text-xl font-bold font-display text-foreground">{d.arena.played}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">مباراة لُعبت</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 text-center">
                <p className="text-xl font-bold font-display text-primary">{d.arena.avgCredits}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">متوسط الرصيد</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 text-center">
                <p className="text-xl font-bold font-display text-destructive">{d.arena.suspicious}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">حالات مشبوهة</p>
              </div>
            </div>
          </section>
        </div>
      </TabsContent>

      {/* ── Questions Tab ── */}
      <TabsContent value="questions" className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="إجمالي الأسئلة" value={d.questions.total} highlight />
          <Stat label="أسئلة منشورة" value={d.questions.active} />
          <Stat label="مسودات قيد المراجعة" value={d.questions.draft} />
          <Stat label="صُحّحت بعد تنبيه الذكاء" value={d.questions.flaggedFixed} />
        </div>

        <section className="space-y-3">
          <h3 className="font-display text-lg font-bold text-foreground">
            معدل رفع الأسئلة اليومي
          </h3>
          <Bars data={d.questions.uploadsPerDay} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <h3 className="font-bold text-sm mb-3">توزيع الأسئلة حسب الموضوع</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
              {d.questions.byTopic.map(([t, n]) => (
                <div key={t} className="flex justify-between items-center text-xs py-1 border-b border-border/40">
                  <span className="font-medium text-foreground">{t}</span>
                  <span className="font-bold font-mono text-primary">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <h3 className="font-bold text-sm mb-3">أكثر الطلاب رفعًا للأسئلة</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
              {d.questions.topUploaders.map(([t, n]) => (
                <div key={t} className="flex justify-between items-center text-xs py-1 border-b border-border/40">
                  <span className="font-medium text-foreground">{t}</span>
                  <span className="font-bold font-mono text-primary">{n} سؤال</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Users Tab ── */}
      <TabsContent value="users" className="space-y-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو البريد الإلكتروني…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-11 rounded-xl bg-card"
          />
        </div>

        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {u.online && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                  <span className="font-bold text-sm text-foreground">{u.name}</span>
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
                </div>
                <div className="text-muted-foreground font-mono flex items-center gap-2" dir="ltr">
                  <span>{u.email}</span>
                  <span>·</span>
                  <span className="text-primary font-bold">{u.credits} credits</span>
                </div>
              </div>

              <div className="self-end sm:self-center">
                <Button
                  size="sm"
                  variant={u.banned ? "outline" : "destructive"}
                  className="rounded-xl text-xs font-semibold h-8"
                  onClick={() => toggleBan(u.id, !u.banned)}
                >
                  {u.banned ? "إلغاء الحظر" : "حظر المستخدم"}
                </Button>
              </div>
            </div>
          ))}
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
    return u ? `${u.name} (${u.email})` : id?.slice(0, 8) ?? "—";
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
      {/* Controls / Filter Bar */}
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-5 p-4 rounded-2xl border border-border/80 bg-card shadow-xs">
        <select
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
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
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">جميع المستخدمين</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl text-xs"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl text-xs"
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={live ? "default" : "outline"}
            className="flex-1 rounded-xl text-xs gap-1.5"
            onClick={() => setLive(!live)}
          >
            <span className={`h-2 w-2 rounded-full ${live ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
            {live ? "بث مباشر" : "متوقف"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs gap-1.5"
            onClick={exportCsv}
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </Button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 text-xs">
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${r.eventMeta.bg} ${r.eventMeta.color}`}
              >
                {r.eventMeta.label}
              </span>
              <span className="font-semibold text-foreground">{r.user}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
              <span className="truncate max-w-xs font-mono" dir="ltr">
                {r.details ? JSON.stringify(r.details) : ""}
              </span>
              <span className="shrink-0">{r.time}</span>
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
