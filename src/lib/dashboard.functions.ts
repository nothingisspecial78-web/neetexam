import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardData } from "./dashboard";
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [summary, friends] = await Promise.all([
      context.supabase.rpc("dashboard_data"),
      context.supabase.rpc("related_profiles"),
    ]);
    if (summary.error || friends.error) throw new Error("تعذّر تحميل الإحصاءات");
    return {
      ...(summary.data as unknown as Omit<DashboardData, "friends">),
      friends: friends.data ?? [],
    };
  });
