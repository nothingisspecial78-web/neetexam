import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { creditPoints, decideWinner } from "./arena";

// Settles one of my matches after its time is up. Safe to call more than once (either player may call).
export const finishMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: m, error } = await context.supabase.from("matches").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("مباراة غير موجودة");
    if (m.status !== "active") return { done: m.status === "finished" };
    if (!m.ends_at || !m.player_b || Date.now() < new Date(m.ends_at).getTime() + 2500) return { done: false };

    const side = decideWinner(
      { correct: m.a_correct, wrong: m.a_wrong, lastAt: m.a_last_at },
      { correct: m.b_correct, wrong: m.b_wrong, lastAt: m.b_last_at },
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let winner: string | null = null, points = 0;
    if (side) {
      winner = side === "a" ? m.player_a : m.player_b;
      const loser = side === "a" ? m.player_b : m.player_a;
      const { data: lp } = await supabaseAdmin.from("profiles").select("credits").eq("id", loser).single();
      const [w, l] = side === "a" ? [m.a_correct, m.b_correct] : [m.b_correct, m.a_correct];
      points = creditPoints(w, l, lp?.credits ?? 0);
    }
    const { error: e2 } = await supabaseAdmin.rpc("settle_match", { _id: m.id, _winner: winner as string, _points: points });
    if (e2) { console.error("settle_match failed", e2.message); throw new Error("تعذّر إنهاء المباراة، حاول مجددًا"); }
    return { done: true };
  });
