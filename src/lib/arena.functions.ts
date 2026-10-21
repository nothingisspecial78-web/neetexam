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

// Helper to pick randomly from all users' active questions with no duplicates
async function pickRandomQuestions(supabaseAdmin: any, count = 50): Promise<string[]> {
  // 1. Fetch all active questions with non-null answers from all users
  let { data: questions } = await supabaseAdmin
    .from("questions")
    .select("id, content_hash, question_text, correct_index, options")
    .eq("status", "active")
    .not("correct_index", "is", null);

  if (!questions || questions.length === 0) {
    const all = await supabaseAdmin
      .from("questions")
      .select("id, content_hash, question_text, correct_index, options")
      .not("correct_index", "is", null);
    questions = all.data ?? [];
  }

  // 2. Validate valid options array (at least 2 options) and non-empty question text
  const valid = (questions || []).filter(
    (q: any) =>
      q.correct_index !== null &&
      q.correct_index !== undefined &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      (q.question_text || "").trim().length > 0
  );

  if (valid.length === 0) {
    throw new Error("لا توجد أسئلة صالحة للمبارزة حالياً، يرجى نشر أسئلة أولاً");
  }

  // 3. Deduplicate by content_hash or question_text so each question in the match is unique
  const uniquePoolMap = new Map<string, string>();
  for (const q of valid) {
    const key = (q.content_hash || q.question_text.trim()).toLowerCase();
    if (!uniquePoolMap.has(key)) {
      uniquePoolMap.set(key, q.id);
    }
  }

  const pool = Array.from(uniquePoolMap.values());

  // 4. Thorough Fisher-Yates shuffle across the unique pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = temp;
  }

  // 5. Return exactly count questions (both competitors receive this exact list in this exact order)
  return pool.slice(0, count);
}

// Joins an existing waiting match or creates a new random match with randomized questions from all users
export const findOpponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch user display name
    const { data: pMe } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    const myName = pMe?.display_name ?? "متحدٍ";

    // 2. Check if user already has an active ongoing match that has not ended
    const nowIso = new Date().toISOString();
    const { data: ongoing } = await supabaseAdmin
      .from("matches")
      .select("id, ends_at")
      .or(`player_a.eq.${userId},player_b.eq.${userId}`)
      .eq("status", "active")
      .gt("ends_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ongoing) {
      return { matchId: ongoing.id };
    }

    // Clean up expired waiting matches older than 45 seconds
    await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled" })
      .eq("status", "waiting")
      .lt("created_at", new Date(Date.now() - 45_000).toISOString());

    // Clean up finished/expired active matches
    await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled" })
      .eq("status", "active")
      .lt("ends_at", new Date(Date.now() - 30_000).toISOString());

    // 3. Look for an open waiting match created by another player
    const { data: waiting } = await supabaseAdmin
      .from("matches")
      .select("id, question_ids")
      .eq("kind", "random")
      .eq("status", "waiting")
      .neq("player_a", userId)
      .gt("created_at", new Date(Date.now() - 45_000).toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (waiting) {
      // Opponent found! Pair into this match
      const startsAt = new Date(Date.now() + 3000);
      const endsAt = new Date(Date.now() + 3000 + 60_000);
      await supabaseAdmin
        .from("matches")
        .update({
          player_b: userId,
          b_name: myName,
          status: "active",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        })
        .eq("id", waiting.id);

      return { matchId: waiting.id };
    }

    // 4. Check if current user already has an active waiting match from the last 30 seconds
    const { data: myWaiting } = await supabaseAdmin
      .from("matches")
      .select("id")
      .eq("kind", "random")
      .eq("status", "waiting")
      .eq("player_a", userId)
      .gt("created_at", new Date(Date.now() - 30_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (myWaiting) {
      return { matchId: myWaiting.id };
    }

    // 5. Create new waiting match: select randomly from ALL users' active questions
    const qIds = await pickRandomQuestions(supabaseAdmin, 50);

    // Cancel any previous waiting matches by this user
    await supabaseAdmin
      .from("matches")
      .update({ status: "cancelled" })
      .eq("status", "waiting")
      .eq("player_a", userId);

    const { data: newMatch, error } = await supabaseAdmin
      .from("matches")
      .insert({
        kind: "random",
        status: "waiting",
        player_a: userId,
        a_name: myName,
        duration_s: 60,
        question_ids: qIds,
      })
      .select("id")
      .single();

    if (error || !newMatch) {
      console.error("findOpponent insert error:", error);
      throw new Error("تعذّر بدء البحث عن منافس");
    }

    return { matchId: newMatch.id };
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

    // 2. Fetch questions: randomly sampled from all users' active questions
    const qIds = await pickRandomQuestions(supabaseAdmin, 50);

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
