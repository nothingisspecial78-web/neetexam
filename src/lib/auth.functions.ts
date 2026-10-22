import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSuperAdminEmail } from "./admin";

// Returns only the role, never the admin email itself.
export const getMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) {
      try {
        const { data } = await context.supabase.auth.getUser();
        email = data?.user?.email;
      } catch (e) {
        console.warn("getUser in getMyRole non-fatal:", e);
      }
    }
    const role = isSuperAdminEmail(email, process.env['SUPER_ADMIN_EMAIL']) ? "admin" : "student";
    return { role } as const;
  });

// Records a sign-in in the activity log (server-only table).
export const logSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_log").insert({ user_id: context.userId, event_type: "sign_in" });
    await supabaseAdmin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", context.userId);
    return { ok: true };
  });

// Delete my account: wipe own data (RLS-scoped function), then remove the login itself.
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("delete_my_data");
    if (error) console.warn("delete_my_data warning:", error);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").delete().eq("id", context.userId);
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (delErr) throw delErr;
    return { ok: true };
  });
