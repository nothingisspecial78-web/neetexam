import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Swords, Clock, X, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { respondChallenge } from "@/lib/arena.functions";
import { Button } from "@/components/ui/button";

// Web Audio API chime sound - zero external assets needed
function playInviteChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046.5, now + 0.15);
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch {
    // Ignore audio autoplay restrictions if user has not interacted
  }
}

type InviteData = {
  id: string;
  player_a: string;
  a_name: string | null;
  duration_s: number;
  created_at: string;
};

export function IncomingChallengeModal({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const respondFn = useServerFn(respondChallenge);
  const [responding, setResponding] = useState(false);
  const playedChimes = useRef(new Set<string>());

  // Query the latest active incoming challenge
  const { data: invite, refetch } = useQuery({
    queryKey: ["incoming-arena-invite", userId],
    queryFn: async (): Promise<InviteData | null> => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, player_a, a_name, duration_s, created_at, status")
        .eq("player_b", userId)
        .eq("kind", "challenge")
        .eq("status", "invited")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      // Filter out stale invites (> 65 seconds old, allowing +/- 10s clock drift)
      const ageMs = Date.now() - new Date(data.created_at).getTime();
      if (ageMs > 65_000 || ageMs < -15_000) return null;

      return data as InviteData;
    },
    refetchInterval: 1500, // Background poll every 1.5s for instant reaction
  });

  // Realtime subscription via Broadcast and Postgres changes for 0ms notification
  useEffect(() => {
    const channel = supabase
      .channel(`arena-invites-${userId}`)
      .on("broadcast", { event: "challenge_sent" }, () => {
        void refetch();
      })
      .on("broadcast", { event: "challenge_updated" }, () => {
        void refetch();
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `player_b=eq.${userId}`,
        },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  // Play chime when new invite appears
  useEffect(() => {
    if (invite && !playedChimes.current.has(invite.id)) {
      playedChimes.current.add(invite.id);
      playInviteChime();
    }
  }, [invite]);

  // Countdown timer for invite expiration
  const [timeLeft, setTimeLeft] = useState(60);
  useEffect(() => {
    if (!invite) return;
    const createdAt = new Date(invite.created_at).getTime();
    const update = () => {
      const elapsed = Math.floor((Date.now() - createdAt) / 1000);
      const remaining = Math.max(0, 60 - Math.max(0, elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        void refetch();
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [invite, refetch]);

  if (!invite || timeLeft <= 0) return null;

  async function handleAccept() {
    if (!invite || responding) return;
    setResponding(true);
    try {
      await respondFn({ data: { matchId: invite.id, accept: true } });
      toast.success("تم قبول التحدي! جارٍ نقلك إلى الساحة… ⚔️");
      void qc.invalidateQueries({ queryKey: ["arena-current", userId] });
      void qc.invalidateQueries({ queryKey: ["incoming-arena-invite", userId] });
      navigate({ to: "/app/arena" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر قبول التحدي");
      void refetch();
    } finally {
      setResponding(false);
    }
  }

  async function handleDecline() {
    if (!invite || responding) return;
    setResponding(true);
    try {
      await respondFn({ data: { matchId: invite.id, accept: false } });
      toast.info("تم رفض التحدي");
      void qc.invalidateQueries({ queryKey: ["incoming-arena-invite", userId] });
      void qc.invalidateQueries({ queryKey: ["arena-current", userId] });
    } catch {
      // Ignore decline errors
    } finally {
      setResponding(false);
      void refetch();
    }
  }

  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[100] animate-in slide-in-from-top-full duration-300 shadow-2xl"
    >
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-b-2 border-amber-500 text-white px-3 py-2.5 sm:px-6 sm:py-3 transition-all">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Right info section (Challenger info + icon) */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/50">
              <span className="absolute inset-0 animate-ping rounded-2xl bg-amber-500/30" />
              <Swords className="h-6 w-6 relative animate-bounce" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                  <Flame className="h-3 w-3 fill-amber-400 text-amber-400" />
                  دعوة منافسة مباشرة
                </span>
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-black/40 px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3 text-amber-400" />
                  {timeLeft} ثانية
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5 truncate">
                {invite.a_name ?? "صديقك"} يتحدّاك الآن في الساحة!
              </h4>
            </div>
          </div>

          {/* Left action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <Button
              id="accept-challenge-topbar-btn"
              disabled={responding}
              size="sm"
              className="flex-1 sm:flex-initial h-10 px-5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 gap-1.5 transition-transform active:scale-95"
              onClick={handleAccept}
            >
              <Swords className="h-4 w-4" />
              <span>{responding ? "جارٍ البدء…" : "قبول وتحدي"}</span>
            </Button>

            <Button
              id="decline-challenge-topbar-btn"
              disabled={responding}
              size="sm"
              variant="outline"
              className="h-10 px-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 hover:border-rose-500/50 transition-colors"
              onClick={handleDecline}
            >
              <X className="h-4 w-4" />
              <span>رفض</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
