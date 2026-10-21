import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Swords, Trophy, Coins, Radar, Crown, Users, ChevronRight, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { challengeFriend, respondChallenge, cancelChallenge, findOpponent as findOpponentFn } from "@/lib/arena.functions";
import { AppHeader } from "@/components/AppHeader";
import { ArenaMatch } from "@/components/ArenaMatch";
import { Button } from "@/components/ui/button";
import { isOnline } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/app_/arena")({
  head: () => ({
    meta: [
      { title: "ساحة المنافسة — مِدْرَاس" },
      { name: "description", content: "مبارزات مباشرة لمدة دقيقة: أجب أسرع وأدق من خصمك واربح الرصيد." },
      { property: "og:title", content: "ساحة المنافسة — مِدْرَاس" },
      { property: "og:description", content: "مبارزات مباشرة لمدة دقيقة: أجب أسرع وأدق من خصمك واربح الرصيد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Arena,
});

type Match = Omit<Tables<"matches">, "question_ids"> & { total: number };
const WAIT_MS = 30_000;

function Arena() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const challengeFn = useServerFn(challengeFriend);
  const respondFn = useServerFn(respondChallenge);
  const cancelFn = useServerFn(cancelChallenge);
  const findOpponentServer = useServerFn(findOpponentFn);
  const [viewId, setViewId] = useState<string | null>(null);
  const [waitFrom, setWaitFrom] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  const me = useQuery({
    queryKey: ["arena-me", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("arena_me");
      if (error) throw error;
      return data as unknown as { credits: number; rank: number; players: number };
    },
  });

  const cur = useQuery({
    queryKey: ["arena-current", user.id],
    queryFn: async () => {
      const t = Date.now();

      // 1. Always prioritize any ongoing active or finishing match for this user
      const { data: activeMatches } = await supabase
        .from("matches")
        .select("*")
        .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
        .in("status", ["active", "finishing"])
        .gt("ends_at", new Date(Date.now() - 5000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (activeMatches && activeMatches[0]) {
        const act = activeMatches[0];
        const m = { ...act, total: (act.question_ids || []).length };
        return { match: m as Match, offset: 0 };
      }

      // 2. Otherwise query arena_current RPC
      const { data, error } = await supabase.rpc("arena_current");
      if (error) throw error;
      const d = data as unknown as { now: string; match: Match | null };
      let currentMatch = d.match;

      // 3. Fallback: Also check matches table for any pending/invited challenge or fresh waiting match
      if (!currentMatch) {
        const since = new Date(Date.now() - 45_000).toISOString();
        const { data: inv } = await supabase
          .from("matches")
          .select("*")
          .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
          .in("status", ["invited", "waiting"])
          .gt("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inv) {
          const m = { ...inv, total: (inv.question_ids || []).length };
          currentMatch = m as Match;
        }
      }

      return { match: currentMatch, offset: new Date(d.now).getTime() - (t + Date.now()) / 2 };
    },
    refetchInterval: viewId ? false : 1500,
  });

  // Realtime subscription to instantly transition when paired or match changes
  useEffect(() => {
    const channel = supabase
      .channel(`arena-matches-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload: any) => {
          const m = payload.new || payload.old;
          if (m && (m.player_a === user.id || m.player_b === user.id)) {
            void cur.refetch();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const friends = useQuery({
    queryKey: ["arena-friends", user.id],
    queryFn: async () => {
      const [fs, ps] = await Promise.all([
        supabase.from("friendships").select("requester_id, addressee_id").eq("status", "accepted"),
        supabase.rpc("related_profiles"),
      ]);
      if (fs.error ?? ps.error) throw fs.error ?? ps.error;
      const ids = new Set(
        (fs.data ?? []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)),
      );
      return (ps.data ?? []).filter((p) => ids.has(p.id));
    },
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: ["arena-history", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, player_a, a_name, b_name, a_correct, b_correct, winner_id, points, created_at")
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const match = cur.data?.match ?? null;
  const closed = useRef(new Set<string>());

  useEffect(() => {
    if (match?.status === "active" && viewId !== match.id && !closed.current.has(match.id)) {
      setViewId(match.id);
    }
  }, [match, viewId]);

  const waiting = match?.status === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => {
      setNow(Date.now());
      void cur.refetch();
    }, 1500);
    return () => clearInterval(t);
  }, [waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  async function call<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) {
    const { error } = await p;
    if (error) { toast.error(error.message); return false; }
    await cur.refetch();
    return true;
  }

  async function findOpponent() {
    setViewId(null);
    setWaitFrom(Date.now());
    setNow(Date.now());
    try {
      const res = await findOpponentServer();
      if (res?.matchId) {
        await cur.refetch();
        return;
      }
    } catch {
      // Fallback to RPC if server function fails
    }
    await call(supabase.rpc("find_opponent"));
  }

  function exitMatch() {
    if (viewId) closed.current.add(viewId);
    setViewId(null);
    void qc.invalidateQueries({ queryKey: ["dashboard", user.id] });
    void qc.invalidateQueries({ queryKey: ["arena-me", user.id] });
    void qc.invalidateQueries({ queryKey: ["arena-history", user.id] });
    void cur.refetch();
  }

  let body: React.ReactNode;

  if (viewId) {
    body = (
      <ArenaMatch
        id={viewId}
        userId={user.id}
        offset={cur.data?.offset ?? 0}
        onExit={exitMatch}
        onPlayAgain={() => { exitMatch(); void findOpponent(); }}
      />
    );
  } else if (!cur.data || !me.data) {
    body =
      cur.isError || me.isError ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
          <p className="text-muted-foreground">تعذّر فتح الساحة.</p>
          <Button
            className="mt-4 rounded-xl"
            onClick={() => { void cur.refetch(); void me.refetch(); }}
          >
            حاول مجددًا
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      );
  } else if (match?.kind === "challenge" && (match.status === "invited" || match.status === "waiting")) {
    if (match.player_a === user.id) {
      body = (
        <div className="animate-scale-in rounded-3xl border border-amber-500/30 bg-card p-8 text-center shadow-card">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/20" />
            <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-2 ring-amber-500/30">
              <Swords className="h-9 w-9 animate-bounce" />
            </span>
          </div>
          <h3 className="font-display text-2xl font-bold">بانتظار قبول {match.b_name ?? "صديقك"}…</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            أرسلنا إشعار التحدي إلى صديقك لدخول المنافسة المباشرة معاً. تنتهي الدعوة بعد دقيقة.
          </p>
          <Button
            id="arena-cancel-invite-btn"
            variant="ghost"
            className="mt-6 h-11 rounded-xl text-muted-foreground hover:bg-muted"
            onClick={async () => {
              try {
                await cancelFn({ data: { matchId: match.id } });
                void cur.refetch();
              } catch {
                await call(supabase.rpc("cancel_match", { _id: match.id }));
              }
            }}
          >
            إلغاء التحدي
          </Button>
        </div>
      );
    } else {
      body = (
        <div className="animate-scale-in rounded-3xl border-2 border-amber-400 bg-card p-8 text-center shadow-soft dark:border-amber-600">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500">
            <Swords className="h-8 w-8 animate-bounce" />
          </div>
          <p className="font-display text-2xl font-bold">{match.a_name ?? "صديقك"} يتحدّاك في الساحة!</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            مبارزة مباشرة لمدة {match.duration_s / 60} دقيقة — أجب أسرع وأدق لتفوز!
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              id="arena-accept-btn"
              className="h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md"
              onClick={async () => {
                try {
                  await respondFn({ data: { matchId: match.id, accept: true } });
                  void cur.refetch();
                } catch {
                  await call(supabase.rpc("respond_invite", { _id: match.id, _accept: true }));
                }
              }}
            >
              <Swords className="h-4 w-4" />
              قبول التحدي
            </Button>
            <Button
              id="arena-decline-btn"
              variant="outline"
              className="h-12 rounded-xl font-semibold"
              onClick={async () => {
                try {
                  await respondFn({ data: { matchId: match.id, accept: false } });
                  void cur.refetch();
                } catch {
                  await call(supabase.rpc("respond_invite", { _id: match.id, _accept: false }));
                }
              }}
            >
              رفض
            </Button>
          </div>
        </div>
      );
    }
  } else if (match?.status === "waiting") {
    const long = now - waitFrom > WAIT_MS;
    body = (
      <div className="animate-scale-in rounded-2xl border bg-card p-8 text-center shadow-soft">
        {/* Pulsing radar icon */}
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-2 animate-ping rounded-full bg-primary/15 animation-delay-150" />
          <span className="relative flex h-full w-full items-center justify-center rounded-full bg-emerald-100 text-primary dark:bg-emerald-900/30">
            <Radar className="h-9 w-9" />
          </span>
        </div>
        <p className="font-display text-xl font-bold">نبحث عن خصم متصل…</p>
        <p className="mt-1 text-sm text-muted-foreground">انتظر لحظة، نجمع المتنافسين</p>
        {long ? (
          <div className="mt-6 grid gap-2">
            <p className="text-sm text-muted-foreground">لم نجد أحدًا بعد.</p>
            <Button
              className="h-12 rounded-xl"
              onClick={() => { setWaitFrom(Date.now()); setNow(Date.now()); }}
            >
              استمر في الانتظار
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-xl"
              onClick={async () => {
                await call(supabase.rpc("cancel_match", { _id: match.id }));
                navigate({ to: "/app/units" });
              }}
            >
              تدرّب بدلًا من ذلك
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="mt-5 h-10 rounded-xl text-muted-foreground"
            onClick={() => call(supabase.rpc("cancel_match", { _id: match.id }))}
          >
            إلغاء
          </Button>
        )}
      </div>
    );
  } else if (match?.status === "invited" && match.player_a === user.id) {
    body = (
      <div className="animate-scale-in rounded-2xl border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Users className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-semibold">بانتظار قبول {match.b_name ?? "صديقك"}…</p>
        <p className="mt-1 text-sm text-muted-foreground">تنتهي الدعوة بعد دقيقة.</p>
        <Button
          variant="ghost"
          className="mt-5 h-10 rounded-xl text-muted-foreground"
          onClick={() => call(supabase.rpc("cancel_match", { _id: match.id }))}
        >
          إلغاء الدعوة
        </Button>
      </div>
    );
  } else if (match?.status === "invited") {
    body = (
      <div className="animate-scale-in rounded-2xl border-2 border-amber-400 bg-card p-8 text-center shadow-soft dark:border-amber-600">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/30">
          <Swords className="h-8 w-8 text-amber-500" />
        </div>
        <p className="font-display text-2xl font-bold">{match.a_name ?? "صديقك"} يتحدّاك!</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          مبارزة لمدة {match.duration_s / 60} دقيقة — كن جاهزًا
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            id="arena-accept-btn"
            className="h-12 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => call(supabase.rpc("respond_invite", { _id: match.id, _accept: true }))}
          >
            <Zap className="h-4 w-4" />
            جاهز
          </Button>
          <Button
            id="arena-decline-btn"
            variant="outline"
            className="h-12 rounded-xl"
            onClick={() => call(supabase.rpc("respond_invite", { _id: match.id, _accept: false }))}
          >
            رفض
          </Button>
        </div>
      </div>
    );
  } else {
    const online = (friends.data ?? []).filter((f) => isOnline(f.last_seen_at));

    body = (
      <div className="space-y-5 animate-fade-in">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <Coins className="h-5 w-5 text-amber-500" />
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{me.data.credits}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">رصيدك الحالي</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <Trophy className="h-5 w-5 text-amber-500" />
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">#{me.data.rank}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">من {me.data.players} لاعب</p>
          </div>
        </div>

        {/* Main CTA */}
        <Button
          id="arena-find-opponent-btn"
          size="lg"
          className="h-16 w-full rounded-2xl text-lg font-bold shadow-glow transition-all duration-150 active:scale-[0.98]"
          onClick={findOpponent}
        >
          <Swords className="h-6 w-6" />
          ابحث عن خصم عشوائي
        </Button>

        {/* Challenge friends */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">تحدَّ صديقًا متصلًا</h2>
          </div>
          {!online.length ? (
            <p className="text-sm text-muted-foreground">لا أصدقاء متصلون الآن.</p>
          ) : (
            <div className="grid gap-2">
              {online.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"
                >
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(f.display_name ?? "ط").charAt(0)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                  </div>
                  <span className="flex-1 truncate text-sm font-medium">{f.display_name ?? "طالب"}</span>
                  <Button
                    id={`challenge-${f.id}`}
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    onClick={async () => {
                      try {
                        await challengeFn({ data: { friendId: f.id, duration: 60 } });
                        const ch = supabase.channel(`arena-invites-${f.id}`);
                        void ch.send({
                          type: "broadcast",
                          event: "challenge_sent",
                          payload: { challengerId: user.id },
                        });
                        toast.success(`تم إرسال التحدي إلى ${f.display_name ?? "صديقك"}! ⚔️`);
                        void cur.refetch();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذّر إرسال التحدي");
                      }
                    }}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    تحدٍّ
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Match history */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Crown className="h-4 w-4 text-amber-500" />
            آخر المباريات
          </h2>
          {!history.data?.length ? (
            <p className="text-sm text-muted-foreground">لم تلعب بعد. ابدأ مبارزتك الأولى!</p>
          ) : (
            <div className="grid gap-2">
              {history.data.map((h) => {
                const isA = h.player_a === user.id;
                const won = h.winner_id === user.id;
                const draw = !h.winner_id;
                const delta = draw ? 0 : won ? (h.points ?? 0) : -(h.points ?? 0);
                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                      won ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/10" :
                      draw ? "bg-card" :
                      "border-red-100 bg-red-50/50 dark:border-red-800/20 dark:bg-red-900/5"
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      won ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      draw ? "bg-muted text-muted-foreground" :
                      "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    }`}>
                      {won ? "فوز" : draw ? "تعادل" : "خسارة"}
                    </span>
                    <span className="flex-1 truncate">
                      ضد {(isA ? h.b_name : h.a_name) ?? "طالب"}
                    </span>
                    <span dir="ltr" className="text-xs tabular-nums text-muted-foreground">
                      {isA ? h.a_correct : h.b_correct} – {isA ? h.b_correct : h.a_correct}
                    </span>
                    <span
                      dir="ltr"
                      className={`w-14 text-end text-sm font-bold tabular-nums ${
                        draw ? "text-muted-foreground" : won ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {draw ? "±0" : won ? `+${h.points}` : `-${h.points}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader title="ساحة المنافسة" back />
      <main className="mx-auto max-w-md px-4 py-6">{body}</main>
    </div>
  );
}
