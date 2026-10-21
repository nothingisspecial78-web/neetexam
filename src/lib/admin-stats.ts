// Browser-safe admin counting rules (tested in admin-stats.test.ts).
export const ONLINE_WINDOW_MS = 2 * 60_000;
const DAY = 864e5;

type Ev = { user_id: string | null; at: string };

/** Distinct users active today (last 24h), last 7 days and last 30 days. */
export function activeCounts(events: Ev[], now: number) {
  const within = (ms: number) => new Set(events.filter((e) => e.user_id && now - Date.parse(e.at) < ms).map((e) => e.user_id)).size;
  return { today: within(DAY), week: within(7 * DAY), month: within(30 * DAY) };
}

/** Per-day counts for the last `days` days (UTC dates, oldest first). distinct=true counts unique users. */
export function dailyCounts(events: Ev[], days: number, now: number, distinct: boolean) {
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * DAY).toISOString().slice(0, 10);
    const hits = events.filter((e) => e.at.slice(0, 10) === day);
    out.push({ day, count: distinct ? new Set(hits.map((e) => e.user_id)).size : hits.length });
  }
  return out;
}

/** CSV export of log rows; quotes every cell. */
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => `"${String(typeof v === "object" && v ? JSON.stringify(v) : (v ?? "")).replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
