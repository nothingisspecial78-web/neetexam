import { normalizeForHash } from "./parse-questions";

export async function questionHash(q: { question: string; options: string[] }) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeForHash(q)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}