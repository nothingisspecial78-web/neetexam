import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Swords,
  Trophy,
  Clock,
  RotateCcw,
  Check,
  X,
  Coins,
  Shield,
  ArrowRight,
  Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { finishMatch } from "@/lib/arena.functions";
import { Button } from "@/components/ui/button";
import { ARABIC_LABELS } from "@/lib/parse-questions";

type MatchQ = { index: number; question: string; options: string[] };
type Picked = { choice: number; correctIndex: number | null; ok: boolean };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function ArenaMatch({
  id,
  userId,
  offset,
  onExit,
  onPlayAgain,
}: {
  id: string;
  userId: string;
  offset: number;
  onExit: () => void;
  onPlayAgain: () => void;
}) {
  const finishFn = useServerFn(finishMatch);
  const row = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Tables<"matches">;
    },
    refetchInterval: (q) => (q.state.data?.status === "finished" ? false : 1000),
  });

  const [now, setNow] = useState(Date.now() + offset);
  const [q, setQ] = useState<MatchQ | null>(null);
  const [outOfQuestions, setOut] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [mine, setMine] = useState<{ correct: number; wrong: number } | null>(null);
  const sending = useRef(false);
  const finishing = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 200);
    return () => clearInterval(t);
  }, [offset]);

  const m = row.data;
  const isA = m?.player_a === userId;
  const startsAt = m?.starts_at ? new Date(m.starts_at).getTime() : 0;
  const endsAt = m?.ends_at ? new Date(m.ends_at).getTime() : 0;
  const phase = !m
    ? "loading"
    : m.status === "finished"
      ? "result"
      : m.status !== "active"
        ? "gone"
        : now < startsAt
          ? "countdown"
          : now < endsAt
            ? "play"
            : "finishing";

  useEffect(() => {
    if (m && !mine) {
      setMine(isA ? { correct: m.a_correct, wrong: m.a_wrong } : { correct: m.b_correct, wrong: m.b_wrong });
    }
  }, [m, mine, isA]);

  // First (or resumed) question once the countdown ends
  useEffect(() => {
    if (phase !== "play" || q || outOfQuestions || picked) return;
    supabase.rpc("match_question", { _id: id }).then(({ data, error }) => {
      if (error) return void toast.error(error.message);
      if (data) setQ(data as unknown as MatchQ);
      else setOut(true);
    });
  }, [phase, q, outOfQuestions, picked, id]);

  // Settle when time is up
  useEffect(() => {
    if (phase !== "finishing" || finishing.current) return;
    finishing.current = true;
    const tryFinish = async () => {
      try {
        const r = await finishFn({ data: { id } });
        if (r.done) return void row.refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر إنهاء المباراة");
      }
      setTimeout(tryFinish, 1500);
    };
    setTimeout(tryFinish, Math.max(0, endsAt + 2600 - now));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(choice: number) {
    if (!q || picked || sending.current || phase !== "play") return;
    sending.current = true;
    const { data, error } = await supabase.rpc("answer_match", {
      _id: id,
      _index: q.index,
      _choice: choice,
    });
    sending.current = false;
    if (error) {
      toast.error(error.message);
      setQ(null); // reload the current question
      return;
    }
    const r = data as unknown as { correct: boolean; correct_index: number | null; next: MatchQ | null };
    setPicked({ choice, correctIndex: r.correct_index, ok: r.correct });
    setMine((s) => s && (r.correct ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }));
    setTimeout(
      () => {
        setPicked(null);
        if (r.next) setQ(r.next);
        else {
          setQ(null);
          setOut(true);
        }
      },
      r.correct ? 300 : 1000,
    );
  }

  if (!m) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">جارٍ تحميل بيانات المبارزة…</p>
      </div>
    );
  }

  const meName = (isA ? m.a_name : m.b_name) ?? "أنت";
  const opName = (isA ? m.b_name : m.a_name) ?? "الخصم";
  const op = isA
    ? { correct: m.b_correct, wrong: m.b_wrong }
    : { correct: m.a_correct, wrong: m.a_wrong };
  const me = mine ?? { correct: 0, wrong: 0 };

  /* Result Phase */
  if (phase === "result") {
    const draw = !m.winner_id;
    const won = m.winner_id === userId;
    const finalMe = isA ? m.a_correct : m.b_correct;

    return (
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-soft space-y-6 animate-in zoom-in-95 duration-200">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl shadow-md ${
            draw
              ? "bg-muted text-muted-foreground"
              : won
                ? "bg-gradient-to-br from-accent-400 to-accent-600 text-slate-900 shadow-accent-500/20"
                : "bg-red-500/10 text-red-600"
          }`}
        >
          {draw ? <Shield className="h-10 w-10" /> : won ? <Trophy className="h-10 w-10" /> : <Swords className="h-10 w-10" />}
        </div>

        <div>
          <h2 className="font-display text-3xl font-bold text-foreground">
            {draw ? "تعادل!" : won ? "مبروك، انتصار ساحق! 🏆" : "هاردلك، محاولة جيدة!"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {draw
              ? "أداء متكافئ جدًا بين الطرفين"
              : won
                ? "أحسنت! أثبتت جدارتك وسرعتك في الإجابة"
                : "تدرّب أكثر وكرر المحاولة لتحسين سرعتك"}
          </p>
        </div>

        {/* Head-to-Head Scoreboard */}
        <div className="grid grid-cols-2 gap-3 p-2 rounded-2xl bg-muted/40 border border-border/60">
          <div className="rounded-xl bg-card p-4 shadow-2xs">
            <p className="text-xs font-semibold text-primary truncate">{meName} (أنت)</p>
            <p className="text-3xl font-display font-bold text-foreground mt-1">{finalMe}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">نقاط</p>
          </div>
          <div className="rounded-xl bg-card p-4 shadow-2xs">
            <p className="text-xs font-semibold text-muted-foreground truncate">{opName}</p>
            <p className="text-3xl font-display font-bold text-muted-foreground mt-1">{op.correct}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">نقاط</p>
          </div>
        </div>

        {/* Credit Settlement Badge */}
        <div
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-lg font-bold shadow-xs ${
            draw
              ? "bg-muted text-muted-foreground"
              : won
                ? "bg-accent-400/20 text-accent-700 dark:text-accent-300 border border-accent-400/30"
                : "bg-red-500/15 text-red-600 border border-red-500/30"
          }`}
          dir="ltr"
        >
          <Coins className="h-5 w-5 text-accent-500" />
          <span>{draw ? "±0" : won ? `+${m.points}` : `-${m.points}`}</span>
          <span className="text-sm font-normal">رصيد</span>
        </div>

        {/* Actions */}
        <div className="grid gap-2.5 pt-2">
          <Button size="lg" className="w-full h-12 rounded-xl font-bold gap-2" onClick={onPlayAgain}>
            <RotateCcw className="h-4 w-4" />
            <span>العب مجددًا مع خصم آخر</span>
          </Button>
          <Button variant="outline" size="lg" className="w-full h-12 rounded-xl" onClick={onExit}>
            الرجوع إلى بهو الساحة
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "gone") {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-8 text-center space-y-4">
        <p className="font-semibold text-foreground">انتهت المبارزة أو تم إلغاؤها.</p>
        <Button onClick={onExit}>الرجوع للساحة</Button>
      </div>
    );
  }

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <div className="space-y-5">
      {/* ── Match HUD ── */}
      <div className="rounded-2xl border border-primary/30 bg-hero p-4 text-white shadow-soft">
        <div className="grid grid-cols-3 items-center text-center">
          {/* Player (You) */}
          <div className="text-start pe-2">
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-bold mb-1">
              أنت
            </span>
            <p className="text-2xl font-display font-black text-accent-400">{me.correct}</p>
          </div>

          {/* Central Timer */}
          <div className="flex flex-col items-center">
            <div
              dir="ltr"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-base font-black shadow-xs ${
                left <= 10
                  ? "bg-red-500 text-white animate-pulse"
                  : left <= 20
                    ? "bg-amber-500 text-slate-900"
                    : "bg-white/20 text-white"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{fmt(left)}</span>
            </div>
            <span className="text-[10px] text-white/70 mt-1">الوقت المتبقي</span>
          </div>

          {/* Opponent */}
          <div className="text-end ps-2">
            <p className="truncate text-xs text-white/80 font-medium mb-1">{opName}</p>
            <p className="text-2xl font-display font-black text-white/90">{op.correct}</p>
          </div>
        </div>

        {/* Timer progress meter */}
        <div className="mt-3 w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              left <= 10 ? "bg-red-400" : left <= 20 ? "bg-amber-400" : "bg-emerald-300"
            }`}
            style={{ width: `${Math.min(100, (left / 60) * 100)}%` }}
          />
        </div>
      </div>

      {/* ── Sub-Phases ── */}
      {phase === "countdown" ? (
        <div className="rounded-3xl border border-border/80 bg-card p-12 text-center shadow-soft space-y-4 animate-in zoom-in-90 duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Swords className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">استعد للمبارزة مع {opName}!</p>
          <div className="py-4">
            <span className="font-display text-8xl font-black text-primary animate-ping inline-block">
              {Math.ceil((startsAt - now) / 1000) > 3
                ? "3"
                : Math.max(1, Math.ceil((startsAt - now) / 1000))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">نفس الأسئلة بنفس الترتيب لمدة 60 ثانية.</p>
        </div>
      ) : phase === "finishing" ? (
        <div className="rounded-3xl border border-border/80 bg-card p-12 text-center shadow-soft space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <h3 className="font-display text-xl font-bold text-foreground">انتهى الوقت!</h3>
          <p className="text-xs text-muted-foreground">جارٍ تسوية النتيجة وتوزيع الرصيد عبر الخادم…</p>
        </div>
      ) : outOfQuestions ? (
        <div className="rounded-3xl border border-border/80 bg-card p-10 text-center shadow-soft space-y-3">
          <Check className="mx-auto h-10 w-10 text-primary" />
          <h3 className="font-display text-lg font-bold text-foreground">أجبت عن جميع الأسئلة المتوفرة!</h3>
          <p className="text-xs text-muted-foreground">انتظر انتهاء وقت المباراة لمعرفة الفائز.</p>
        </div>
      ) : !q ? (
        <div className="rounded-3xl border border-border/80 bg-card p-10 text-center shadow-soft">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        /* Live Question in Match */
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
            <span className="text-xs font-bold text-primary mb-2 inline-block">
              السؤال #{q.index + 1}
            </span>
            <h2 className="font-reading text-lg sm:text-xl font-semibold leading-[1.8] text-foreground">
              <bdi dir="auto">{q.question}</bdi>
            </h2>
          </div>

          <div className="grid gap-2.5">
            {q.options.map((o, i) => {
              const letter = ARABIC_LABELS[i] ?? String(i + 1);
              let cardStyle =
                "border border-border/80 bg-card hover:border-primary/50 hover:bg-primary-50/20 active:scale-[0.99]";
              let badgeStyle = "bg-muted text-muted-foreground";

              if (picked) {
                if (i === picked.correctIndex) {
                  cardStyle = "border-2 border-emerald-500 bg-emerald-500/15 font-bold shadow-xs";
                  badgeStyle = "bg-emerald-600 text-white font-bold";
                } else if (i === picked.choice) {
                  cardStyle = "border-2 border-red-500 bg-red-500/15 font-bold shadow-xs";
                  badgeStyle = "bg-red-600 text-white font-bold";
                } else {
                  cardStyle = "opacity-40 border-border/40";
                }
              }

              return (
                <button
                  key={i}
                  disabled={picked !== null}
                  onClick={() => choose(i)}
                  className={`flex items-center gap-3.5 rounded-2xl p-4 text-start transition-all cursor-pointer ${cardStyle}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm transition-all ${badgeStyle}`}
                  >
                    {picked && i === picked.correctIndex ? (
                      <Check className="h-5 w-5" />
                    ) : picked && i === picked.choice ? (
                      <X className="h-5 w-5" />
                    ) : (
                      letter
                    )}
                  </span>
                  <span className="flex-1 text-sm sm:text-base leading-relaxed text-foreground">
                    <bdi dir="auto">{o}</bdi>
                  </span>
                </button>
              );
            })}
          </div>

          {picked && !picked.ok && (
            <p className="text-center font-bold text-red-600 text-xs sm:text-sm animate-bounce">
              إجابة خاطئة! الإجابة الصحيحة محددة بالأخضر
            </p>
          )}
        </div>
      )}
    </div>
  );
}
