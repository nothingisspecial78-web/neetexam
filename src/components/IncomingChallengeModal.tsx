import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Swords, Clock, X, Check, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { respondChallenge } from "@/lib/arena.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Web Audio API chime sound - zero external assets needed
function playInviteChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  const router = useRouterState();
  const qc = useQueryClient();
  const respondFn = useServerFn(respondChallenge);
  const [responding, setResponding] = useState(false);
  const playedChimes = useRef(new Set<string>());

  // Query the latest active incoming challenge
  const { data: invite, refetch } = useQuery({
    queryKey: ["incoming-arena-invite", userId],
    queryFn: async (): Promise<InviteData | null> => {
      const since = new Date(Date.now() - 65_000).toISOString();
      const { data, error } = await supabase
        .from("matches")
        .select("id, player_a, a_name, duration_s, created_at")
        .eq("player_b", userId)
        .eq("kind", "challenge")
        .in("status", ["invited", "waiting"])
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data as InviteData | null;
    },
    refetchInterval: 2500, // Poll every 2.5s for rapid challenge detection
  });

  // Realtime subscription for instant notification
  useEffect(() => {
    const channel = supabase
      .channel("arena-invites-" + userId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `player_b=eq.${userId}`,
        },
        () => {
          void refetch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
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
      const remaining = Math.max(0, 60 - Math.floor((Date.now() - createdAt) / 1000));
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
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleDecline(); }}>
      <DialogContent className="max-w-md rounded-3xl border-2 border-amber-500/40 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8" dir="rtl">
        {/* Radiant glowing header badge */}
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/20" />
          <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-2 ring-amber-500/30">
            <Swords className="h-10 w-10 animate-bounce" />
          </span>
        </div>

        <DialogHeader className="space-y-1.5 text-center">
          <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 mx-auto">
            <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>دعوة منافسة مباشرة في الساحة</span>
          </div>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
            {invite.a_name ?? "صديقك"} يتحدّاك الآن!
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            مبارزة مباشرة لمدة دقيقة واحدة — أجب أسرع وأدق لتفوز بالرصيد والمركز!
          </DialogDescription>
        </DialogHeader>

        {/* Timer countdown bar */}
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          <span>تنتهي الدعوة خلال <strong>{timeLeft}</strong> ثانية</span>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            id="accept-challenge-modal-btn"
            disabled={responding}
            className="h-14 w-full rounded-2xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-600/20 transition-transform active:scale-[0.98]"
            onClick={handleAccept}
          >
            <Swords className="h-5 w-5 rtl:rotate-90" />
            <span>{responding ? "جارٍ بدء المنافسة…" : "قبول التحدي ودخول المنافسة"}</span>
          </Button>

          <Button
            id="decline-challenge-modal-btn"
            disabled={responding}
            variant="ghost"
            className="h-11 w-full rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
            onClick={handleDecline}
          >
            <X className="h-3.5 w-3.5" />
            <span>رفض التحدي</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
