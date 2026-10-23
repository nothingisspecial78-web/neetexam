import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSuperAdminEmail } from "./admin";
import { activeCounts, dailyCounts, ONLINE_WINDOW_MS } from "./admin-stats";

// Every admin call: verify the caller is the super admin (server-side), else 403.
async function adminClient(context: { supabase: any; claims: unknown; userId?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const claims = context.claims as { email?: string; sub?: string } | undefined;
  let email = claims?.email;
  let userId = context.userId ?? claims?.sub;
  let confirmed = true;

  if (userId) {
    try {
      const { data: uData } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (uData?.user) {
        email = uData.user.email ?? email;
        confirmed = !!uData.user.email_confirmed_at;
      }
    } catch (e) {
      console.warn("getUserById in adminClient non-fatal:", e);
    }
  }

  if (!email || !userId) {
    try {
      const { data } = await context.supabase.auth.getUser();
      email = data?.user?.email ?? email;
      userId = data?.user?.id ?? userId;
      confirmed = !!data?.user?.email_confirmed_at;
    } catch (e) {
      console.warn("getUser in adminClient non-fatal:", e);
    }
  }

  const adminEmail = process.env["SUPER_ADMIN_EMAIL"] || "abdullaarimbra1027@gmail.com";
  if (!confirmed || !isSuperAdminEmail(email, adminEmail)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { db: supabaseAdmin, adminId: (userId || "admin") as string };
}

type LogFilter = { userId?: string | undefined; eventType?: string | undefined; from?: string | undefined; to?: string | undefined };

export const adminLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: LogFilter) => d)
  .handler(async ({ data, context }) => {
    const { db } = await adminClient(context);
    let q = db.from("activity_log").select("id, user_id, event_type, details, created_at").order("created_at", { ascending: false }).limit(500);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.eventType) q = q.eq("event_type", data.eventType);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await adminClient(context);

    // Prune activity log in background (non-blocking)
    void db.rpc("prune_activity_log").then(() => {}, (e: unknown) => {
      console.warn("prune_activity_log background warning:", e);
    });

    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const [usersRes, profilesRes, qRes, logRes, matchRes] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 1000 }).catch((e) => ({ data: { users: [] }, error: e })),
      db.from("profiles").select("id, display_name, credits, last_seen_at, created_at"),
      db.from("questions").select("owner_id, status, topic_area, ai_flag, ai_suggestion, answer_source, created_at"),
      db.from("activity_log").select("user_id, created_at, event_type").gte("created_at", since30),
      db.from("matches").select("status, points, player_a, player_b, a_correct, b_correct, created_at"),
    ]);
    const profiles = profilesRes.data ?? [];
    const questions = qRes.data ?? [];
    const now = Date.now();
    const authUsers = usersRes.data?.users ?? [];
    const users = profiles.map((p) => {
      const u = authUsers.find((a) => a.id === p.id);
      return {
        id: p.id,
        name: p.display_name,
        email: u?.email ?? "",
        credits: p.credits,
        lastSeen: p.last_seen_at,
        online: !!p.last_seen_at && now - Date.parse(p.last_seen_at) < ONLINE_WINDOW_MS,
        banned: !!u?.banned_until && Date.parse(u.banned_until) > now,
        confirmed: !!u?.email_confirmed_at,
      };
    });
    const activity = activeCounts([...(logRes.data ?? []).map((l) => ({ user_id: l.user_id, at: l.created_at })), ...profiles.filter((p) => p.last_seen_at).map((p) => ({ user_id: p.id, at: p.last_seen_at! }))], now);
    const byTopic: Record<string, number> = {};
    const byOwner: Record<string, number> = {};
    for (const q of questions) {
      if (q.status !== "active") continue;
      byTopic[q.topic_area || "—"] = (byTopic[q.topic_area || "—"] ?? 0) + 1;
      byOwner[q.owner_id] = (byOwner[q.owner_id] ?? 0) + 1;
    }
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id.slice(0, 6);
    const matches = matchRes.data ?? [];
    const finished = matches.filter((m) => m.status === "finished");
    // Suspicious: very high score in a 1-minute match (likely automated tapping).
    const suspicious = finished.filter((m) => Math.max(m.a_correct ?? 0, m.b_correct ?? 0) >= 40).length;
    const credits = profiles.map((p) => p.credits ?? 0);
    return {
      users,
      onlineNow: users.filter((u) => u.online).length,
      activity,
      dau: dailyCounts((logRes.data ?? []).map((l) => ({ user_id: l.user_id, at: l.created_at })), 14, now, true),
      questions: {
        total: questions.length,
        active: questions.filter((q) => q.status === "active").length,
        draft: questions.filter((q) => q.status !== "active").length,
        flaggedFixed: questions.filter((q) => q.ai_suggestion != null && q.ai_flag === "clean" && q.status === "active").length,
        aiAnswered: questions.filter((q) => q.answer_source === "ai").length,
        byTopic: Object.entries(byTopic).sort((a, b) => b[1] - a[1]),
        topUploaders: Object.entries(byOwner).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => [nameOf(id), n] as const),
        uploadsPerDay: dailyCounts((logRes.data ?? []).filter((l) => l.event_type === "file_upload").map((l) => ({ user_id: l.user_id, at: l.created_at })), 14, now, false),
      },
      arena: {
        played: finished.length,
        avgCredits: credits.length ? Math.round(credits.reduce((a, b) => a + b, 0) / credits.length) : 0,
        suspicious,
      },
    };
  });

export const adminSetBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; banned: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { db, adminId } = await adminClient(context);
    if (data.userId === adminId) throw new Error("لا يمكن حظر حساب المشرف");
    const { error } = await db.auth.admin.updateUserById(data.userId, { ban_duration: data.banned ? "876000h" : "none" } as any);
    if (error) throw error;
    await db.from("activity_log").insert({ user_id: adminId, event_type: data.banned ? "admin_ban" : "admin_unban", details: { target: data.userId } });
    return { ok: true };
  });
