import { getMyRole, logSignIn } from "./auth.functions";
import { notifyLiveSync } from "./live-sync";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "./admin";

// After sign-in: log in the background, route admin to /admin, others to /app.
export async function destinationAfterLogin(): Promise<"/admin" | "/app"> {
  void logSignIn()
    .then(() => {
      notifyLiveSync("sign_in");
    })
    .catch(() => {});

  try {
    const { role } = await getMyRole();
    if (role === "admin") return "/admin";
  } catch (e) {
    console.warn("getMyRole in destinationAfterLogin non-fatal:", e);
  }

  try {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user?.email;
    const adminEmail = (import.meta as any).env?.VITE_SUPER_ADMIN_EMAIL || "abdullaarimbra1027@gmail.com";
    if (isSuperAdminEmail(email, adminEmail)) {
      return "/admin";
    }
  } catch (e) {
    console.warn("local session check in destinationAfterLogin:", e);
  }

  return "/app";
}
