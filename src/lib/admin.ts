// Pure helper: is this email a super admin? Case/whitespace-insensitive, supports comma-separated list.
export function isSuperAdminEmail(email: string | null | undefined, adminEmail: string | null | undefined) {
  if (!email || !adminEmail) return false;
  const target = email.trim().toLowerCase();
  const allowed = adminEmail.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(target);
}
