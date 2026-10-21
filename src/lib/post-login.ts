import { getMyRole, logSignIn } from "./auth.functions";
import { notifyLiveSync } from "./live-sync";

// After sign-in: log in the background, route admin to /admin, others to /app.
export async function destinationAfterLogin(): Promise<"/admin" | "/app"> {
  void logSignIn()
    .then(() => {
      notifyLiveSync("sign_in");
    })
    .catch(() => {});
  const { role } = await getMyRole();
  return role === "admin" ? "/admin" : "/app";
}
