// Pure helper: is this email the single super admin? Case/whitespace-insensitive.
export function isSuperAdminEmail(email: string | null | undefined, adminEmail: string | null | undefined) {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
