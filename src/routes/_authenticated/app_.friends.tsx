import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  X,
  Ban,
  Search,
  Swords,
  UserPlus,
  Users,
  Sparkles,
  BookOpen,
  Share2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { challengeFriend } from "@/lib/arena.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isOnline } from "@/lib/presence";

type Card = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  question_count: number;
  last_seen_at?: string | null;
};

const friendsOptions = (userId: string) =>
  queryOptions({
    queryKey: ["friends", userId],
    queryFn: async () => {
      const [me, fs, ps] = await Promise.all([
        supabase.from("profiles").select("friend_code").eq("id", userId).single(),
        supabase.from("friendships").select("id, requester_id, addressee_id, status"),
        supabase.rpc("related_profiles"),
      ]);
      const err = me.error ?? fs.error ?? ps.error;
      if (err) throw err;
      const cards = new Map((ps.data ?? []).map((p) => [p.id, p as Card]));
      const rows = (fs.data ?? []).map((f) => {
        const other = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return { ...f, other, card: cards.get(other), incoming: f.addressee_id === userId };
      });
      return { code: me.data?.friend_code ?? null, rows };
    },
  });

export const Route = createFileRoute("/_authenticated/app_/friends")({
  head: () => ({
    meta: [
      { title: "الأصدقاء — مِدْرَاس" },
      { name: "description", content: "ابحث عن زملائك وتشاركوا بنوك الأسئلة." },
      { property: "og:title", content: "الأصدقاء — مِدْرَاس" },
      { property: "og:description", content: "ابحث عن زملائك وتشاركوا بنوك الأسئلة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(friendsOptions(context.user.id)),
  component: Friends,
});

function Person({ card, online }: { card?: Card | undefined; online?: boolean | undefined }) {
  const name = card?.display_name ?? "طالب مِدْرَاس";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 border-2 border-border/60">
          {card?.avatar_url && <AvatarImage src={card.avatar_url} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        {online !== undefined && (
          <span
            className={`absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
              online ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" : "bg-muted-foreground/30"
            }`}
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground text-sm sm:text-base">{name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <BookOpen className="h-3 w-3" />
            {card?.question_count ?? 0} سؤال
          </span>
          {online !== undefined && (
            <>
              <span>·</span>
              <span className={online ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                {online ? "متصل الآن" : "غير متصل"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Friends() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const challengeFn = useServerFn(challengeFriend);
  const { data } = useSuspenseQuery(friendsOptions(user.id));
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Card[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["friends", user.id] });
    qc.invalidateQueries({ queryKey: ["units", user.id] });
    qc.invalidateQueries({ queryKey: ["incoming", user.id] });
    qc.invalidateQueries({ queryKey: ["incoming-badge", user.id] });
  };

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return void toast.error("اكتب حرفين على الأقل للبحث");
    setSearching(true);
    const { data: r, error } = await supabase.rpc("search_students", { _q: q.trim() });
    setSearching(false);
    if (error) return void toast.error("تعذّر البحث عن الطلاب");
    setResults(r ?? []);
  }

  async function challenge(id: string) {
    try {
      await challengeFn({ data: { friendId: id, duration: 60 } });
      toast.success("أُرسل التحدي! جارٍ نقلك إلى الساحة… ⚔️");
      navigate({ to: "/app/arena" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إرسال التحدي");
    }
  }

  async function add(id: string) {
    const { error } = await supabase.from("friendships").insert({ addressee_id: id });
    if (error) return void toast.error(error.code === "23505" ? "الطلب موجود مسبقًا" : "تعذّر الإرسال");
    toast.success("أُرسل طلب الصداقة بنجاح");
    refresh();
  }

  async function setStatus(id: string, status: "accepted" | "blocked") {
    const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
    if (error) return void toast.error("تعذّر الحفظ");
    toast.success(status === "accepted" ? "أصبحتما صديقين! دُمجت بنوك الأسئلة تلقائيًا" : "تم حظر المستخدم");
    refresh();
  }

  async function remove(id: string, msg: string) {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) return void toast.error("تعذّر الحذف");
    toast.success(msg);
    refresh();
  }

  const copyCode = () => {
    if (!data.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    toast.success("نُسخ رمز الصداقة الخاص بك");
    setTimeout(() => setCopied(false), 2000);
  };

  const incoming = data.rows.filter((r) => r.status === "pending" && r.incoming);
  const sent = data.rows.filter((r) => r.status === "pending" && !r.incoming);
  const friends = data.rows.filter((r) => r.status === "accepted");
  const blocked = data.rows.filter((r) => r.status === "blocked");
  const relation = (id: string) => data.rows.find((r) => r.other === id);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title="الأصدقاء وبنوك الأسئلة" back />

      <main className="mx-auto grid max-w-xl gap-5 px-4 py-6">
        {/* Friend Code Share Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary-50/40 to-background p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white">
                  <Share2 className="h-4 w-4" />
                </span>
                <h2 className="font-display text-base font-bold text-foreground">
                  رمز الصداقة الخاص بك
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                شاركه مع زملائك لدمج بنوك الأسئلة المنشورة والتنافس المباشر.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-xs rounded-xl border border-border p-1.5 self-start sm:self-center shadow-xs">
              <span dir="ltr" className="font-mono text-sm font-bold tracking-wider px-3 text-primary">
                {data.code ?? "—"}
              </span>
              <Button
                size="sm"
                variant={copied ? "default" : "secondary"}
                className="gap-1.5 h-8 text-xs font-semibold"
                onClick={copyCode}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "تم النسخ" : "نسخ"}
              </Button>
            </div>
          </div>
        </section>

        {/* Search & Add Students Card */}
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            البحث عن زملاء دراسة
          </h2>
          <form onSubmit={search} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو البريد أو رمز الصديق…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="ps-9 h-11 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={searching}
              className="h-11 px-5 rounded-xl gap-2 font-semibold"
            >
              <Search className="h-4 w-4" />
              <span>بحث</span>
            </Button>
          </form>

          {results !== null && (
            <div className="pt-2 divide-y divide-border/60">
              {results.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  لم يتم العثور على طلاب بهذا الاسم أو الرمز.
                </p>
              ) : (
                results.map((p) => {
                  const r = relation(p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <Person card={p} />
                      <div>
                        {!r ? (
                          <Button
                            size="sm"
                            className="rounded-xl gap-1.5 font-semibold"
                            onClick={() => add(p.id)}
                          >
                            <UserPlus className="h-4 w-4" />
                            إضافة
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                            {r.status === "accepted"
                              ? "صديق ✓"
                              : r.status === "blocked"
                                ? "محظور"
                                : r.incoming
                                  ? "طلب وارد"
                                  : "أُرسل الطلب"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* Tabs: Friends / Requests / Sent */}
        <section>
          <Tabs defaultValue={incoming.length ? "requests" : "friends"} dir="rtl">
            <TabsList className="grid w-full grid-cols-3 h-12 p-1 rounded-xl bg-muted/60 border border-border/60">
              <TabsTrigger value="friends" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                الأصدقاء
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-bold">
                  {friends.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="requests" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm relative">
                <Clock className="h-4 w-4" />
                الطلبات
                {incoming.length > 0 && (
                  <span className="rounded-full bg-accent-500 text-slate-900 px-2 py-0.5 text-xs font-black animate-pulse">
                    {incoming.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="rounded-lg gap-1.5 font-semibold text-xs sm:text-sm">
                المُرسلة
                <span className="text-xs text-muted-foreground">({sent.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* Friends Tab */}
            <TabsContent value="friends" className="mt-4 space-y-3">
              {friends.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Users className="h-7 w-7" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-bold text-foreground">
                    لا يوجد أصدقاء مضافون بعد
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    أضف زملاءك باستخدام الرمز أو الاسم أعلاه. بمجرد قبول الطلب ستندمج بنوك أسئلتكما لتتدرّبا معًا!
                  </p>
                </div>
              ) : (
                friends.map((r) => {
                  const online = isOnline(r.card?.last_seen_at);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <Person card={r.card} online={online} />
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          disabled={!online}
                          onClick={() => challenge(r.other)}
                          className={`rounded-xl gap-1.5 font-semibold shadow-xs ${
                            online
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "opacity-50"
                          }`}
                        >
                          <Swords className="h-4 w-4" />
                          <span>تحدٍّ</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(r.id, "تمت إزالة الصديق وفصل بنوك الأسئلة")}
                          className="rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          إزالة
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* Incoming Requests Tab */}
            <TabsContent value="requests" className="mt-4 space-y-3">
              {incoming.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">لا توجد طلبات صداقة واردة حاليًا.</p>
                </div>
              ) : (
                incoming.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 shadow-xs"
                  >
                    <Person card={r.card} />
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        onClick={() => setStatus(r.id, "accepted")}
                        className="rounded-xl gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="h-4 w-4" />
                        قبول
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove(r.id, "تم رفض الطلب")}
                        className="rounded-xl gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                        رفض
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(r.id, "blocked")}
                        className="rounded-xl text-destructive hover:bg-destructive/10"
                        title="حظر المستخدم"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {blocked.length > 0 && (
                <div className="pt-4 border-t border-border/60">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">قائمة المحظورين</h3>
                  <div className="space-y-2">
                    {blocked.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-3 text-xs"
                      >
                        <Person card={r.card} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(r.id, "أُلغي الحظر")}
                          className="h-7 text-xs text-primary"
                        >
                          إلغاء الحظر
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Sent Requests Tab */}
            <TabsContent value="sent" className="mt-4 space-y-3">
              {sent.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">لا توجد طلبات صداقة قيد الانتظار.</p>
                </div>
              ) : (
                sent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
                  >
                    <Person card={r.card} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(r.id, "أُلغي طلب الصداقة")}
                      className="rounded-xl text-xs text-muted-foreground hover:text-destructive"
                    >
                      إلغاء الطلب
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}
