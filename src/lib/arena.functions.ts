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

// Challenges a friend to a head-to-head competition match.
export const challengeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { friendId: string; duration?: number }) =>
    z.object({
      friendId: z.string().uuid(),
      duration: z.number().int().min(30).max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch user display names
    const [pA, pB] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name").eq("id", userId).single(),
      supabaseAdmin.from("profiles").select("display_name").eq("id", data.friendId).single(),
    ]);

    if (!pB.data) throw new Error("المستخدم غير موجود");

    // 2. Fetch questions: active first, fallback to all questions
    let { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("status", "active")
      .limit(20);

    if (!questions || questions.length === 0) {
      const all = await supabaseAdmin.from("questions").select("id").limit(20);
      questions = all.data ?? [];
    }

    if (!questions || questions.length === 0) {
      throw new Error("لا توجد أسئلة متاحة للمبارزة حالياً، يرجى نشر أسئلة أولاً");
    }

    // Shuffle questions
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const qIds = shuffled.map((q) => q.id);

    // 3. Cancel any previous pending challenges involving this user
    await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled" })
      .in("status", ["waiting", "invited"])
      .or(`player_a.eq.${userId},player_b.eq.${userId}`);

    // 4. Create new challenge match with status 'invited'
    const duration = data.duration ?? 60;
    const { data: newMatch, error } = await supabaseAdmin
      .from("matches")
      .insert({
        kind: "challenge",
        status: "invited",
        player_a: userId,
        player_b: data.friendId,
        a_name: pA.data?.display_name ?? "متحدٍ",
        b_name: pB.data?.display_name ?? "صديق",
        duration_s: duration,
        question_ids: qIds,
      })
      .select("id")
      .single();

    if (error || !newMatch) {
      console.error("challengeFriend insert error:", error);
      throw new Error("تعذّر إرسال التحدي");
    }

    return { matchId: newMatch.id };
  });

// Accepts or declines an incoming challenge invitation.
export const respondChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; accept: boolean }) =>
    z.object({ matchId: z.string().uuid(), accept: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: m, error } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", data.matchId)
      .maybeSingle();

    if (error || !m) throw new Error("المباراة غير موجودة");

    if (m.player_b !== userId && m.player_a !== userId) {
      throw new Error("غير مصرّح لك بالرد على هذه الدعوة");
    }

    if (data.accept) {
      if (m.player_b !== userId) throw new Error("المرسل لا يمكنه قبول دعوته بنفسه");
      if (m.status !== "invited" && m.status !== "waiting") {
        throw new Error("انتهت صلاحية الدعوة أو تم إلغاؤها");
      }

      const startsAt = new Date(Date.now() + 3000);
      const endsAt = new Date(Date.now() + 3000 + (m.duration_s || 60) * 1000);

      const { error: updErr } = await supabaseAdmin
        .from("matches")
        .update({
          status: "active",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        })
        .eq("id", data.matchId);

      if (updErr) throw new Error("تعذّر بدء المباراة");
      return { matchId: data.matchId, accepted: true };
    } else {
      await supabaseAdmin
        .from("matches")
        .update({ status: "cancelled" })
        .eq("id", data.matchId);
      return { matchId: data.matchId, accepted: false };
    }
  });

// Cancels an outgoing or waiting challenge.
export const cancelChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) =>
    z.object({ matchId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled" })
      .eq("id", data.matchId)
      .or(`player_a.eq.${userId},player_b.eq.${userId}`)
      .in("status", ["waiting", "invited"]);

    if (error) throw new Error("تعذّر إلغاء التحدي");
    return { cancelled: true };
  });
