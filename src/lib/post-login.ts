import { getMyRole, logSignIn } from "./auth.functions";

// After sign-in: log in the background, route admin to /admin, others to /app.
export async function destinationAfterLogin(): Promise<"/admin" | "/app"> {
  void logSignIn().catch(() => {});
  const { role } = await getMyRole();
  return role === "admin" ? "/admin" : "/app";
}
