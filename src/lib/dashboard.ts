import { combineBanks, computeUnitStats } from "./units";
export type Filters = {
  range: "7" | "30" | "all";
  unit: string;
  mode: "all" | "practice" | "test" | "competition";
  period: "day" | "week";
};
export const defaultFilters: Filters = { range: "30", unit: "all", mode: "all", period: "day" };
export type DQuestion = {
  id: string;
  unit_id: string | null;
  owner_id: string;
  content_hash: string;
  topic_area: string | null;
  created_at: string;
  status: string;
};
export type DAnswer = {
  question_id: string;
  is_correct: boolean;
  time_ms: number;
  mode: string;
  created_at: string;
};
export type DRun = {
  id: string;
  unit_ids: string[];
  total: number;
  correct: number;
  duration_s: number;
  created_at: string;
  mode: string;
  reviewable: boolean;
};
export type DMatch = {
  id: string;
  player_a: string;
  a_name: string | null;
  b_name: string | null;
  a_correct: number;
  b_correct: number;
  a_wrong: number;
  b_wrong: number;
  winner_id: string | null;
  points: number;
  duration_s: number;
  created_at: string;
};
export type DashboardData = {
  questions: DQuestion[];
  units: { id: string; name: string; topic_area: string; owner_id: string }[];
  answers: DAnswer[];
  runs: DRun[];
  matches: DMatch[];
  credits: { balance: number; change: number; created_at: string }[];
  arena: { credits: number; rank: number | null } | null;
  friends: { id: string; display_name: string | null }[];
};
const dayMs = 86400000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function rangeStart(range: Filters["range"], now: Date) {
  if (range === "all") return -Infinity;
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - (Number(range) - 1) * dayMs;
}
export function studyStreak(dates: string[], now: Date) {
  const days = new Set(dates.map((d) => d.slice(0, 10)));
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  if (!days.has(dateKey(d))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (days.has(dateKey(d))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}
export function competitionStats(matches: DMatch[], userId: string) {
  const wins = matches.filter((m) => m.winner_id === userId).length;
  const draws = matches.filter((m) => m.winner_id === null).length;
  return {
    wins,
    draws,
    losses: matches.length - wins - draws,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : null,
    best: Math.max(
      0,
      ...matches
        .filter((m) => m.duration_s === 60)
        .map((m) => (m.player_a === userId ? m.a_correct : m.b_correct)),
    ),
  };
}
export const creditDelta = (m: DMatch, userId: string) =>
  m.winner_id === null ? 0 : m.winner_id === userId ? m.points : -m.points;
export function buildDashboard(
  data: DashboardData,
  userId: string,
  filters: Filters,
  now = new Date(),
) {
  const start = rangeStart(filters.range, now);
  const inRange = (date: string) => {
    const t = Date.parse(date);
    return t >= start && t <= now.getTime();
  };
  const names = new Map(data.friends.map((f) => [f.id, f.display_name] as const));
  const combined = combineBanks(
    userId,
    data.units,
    data.questions
      .filter((q) => q.status === "active")
      .map((q) => ({ ...q, question_text: "", options: [], correct_index: 0 })),
    names,
  );
  const stats = computeUnitStats(
    combined.units,
    combined.questions,
    data.answers,
    data.runs.filter((r) => r.mode === "practice"),
  );
  const qMap = new Map(combined.questions.map((q) => [q.id, q]));
  // Keep analytics for removed questions too, but unit-filtered rows require a visible unit.
  const answers = data.answers.filter(
    (a) =>
      inRange(a.created_at) &&
      filters.mode !== "competition" &&
      (filters.mode === "all" || a.mode === filters.mode) &&
      (filters.unit === "all" || qMap.get(a.question_id)?.unit_id === filters.unit),
  );
  const answersByUnit = new Map<string, DAnswer[]>();
  for (const a of answers) {
    const unit = qMap.get(a.question_id)?.unit_id;
    if (unit) {
      const group = answersByUnit.get(unit) ?? [];
      group.push(a);
      answersByUnit.set(unit, group);
    }
  }
  const topics = stats
    .filter((s) => filters.unit === "all" || s.id === filters.unit)
    .map((s) => {
      const rows = answersByUnit.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        count: rows.length,
        accuracy: rows.length
          ? Math.round((rows.filter((a) => a.is_correct).length / rows.length) * 100)
          : null,
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  const mistakesMap = new Map<string, number>();
  for (const a of answers)
    if (!a.is_correct && qMap.has(a.question_id))
      mistakesMap.set(a.question_id, (mistakesMap.get(a.question_id) ?? 0) + 1);
  const mistakes = [...mistakesMap]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
  const buckets = new Map<
    string,
    { date: string; count: number; correct: number; ms: number; timed: number }
  >();
  const bucketKey = (date: string) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    if (filters.period === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return dateKey(d);
  };
  for (const a of answers) {
    const key = bucketKey(a.created_at);
    const b = buckets.get(key) ?? { date: key, count: 0, correct: 0, ms: 0, timed: 0 };
    b.count++;
    if (a.is_correct) b.correct++;
    if (a.time_ms > 0) {
      b.ms += a.time_ms;
      b.timed++;
    }
    buckets.set(key, b);
  }
  // Include quiet days/weeks instead of implying continuous activity.
  const first =
    filters.range === "all"
      ? answers.reduce((t, a) => Math.min(t, Date.parse(a.created_at)), now.getTime())
      : start;
  for (let t = first; t <= now.getTime(); t += dayMs) {
    const k = bucketKey(new Date(t).toISOString());
    if (!buckets.has(k)) buckets.set(k, { date: k, count: 0, correct: 0, ms: 0, timed: 0 });
  }
  const series = [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      date: b.date,
      count: b.count,
      accuracy: b.count ? Math.round((b.correct / b.count) * 100) : null,
      seconds: b.timed ? Math.round(b.ms / b.timed / 100) / 10 : null,
    }));
  const timed = answers.filter((a) => a.time_ms > 0);
  const sorted = [...timed].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const mid = Math.floor(sorted.length / 2);
  const avg = (a: DAnswer[]) =>
    a.length ? a.reduce((s, a) => s + a.time_ms, 0) / a.length / 1000 : null;
  const before = avg(sorted.slice(0, mid)),
    after = avg(sorted.slice(mid));
  const matches =
    filters.mode === "all" || filters.mode === "competition"
      ? data.matches
          .filter((m) => inRange(m.created_at))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];
  const runs = data.runs.filter(
    (r) =>
      inRange(r.created_at) &&
      filters.mode !== "competition" &&
      (filters.mode === "all" || r.mode === filters.mode) &&
      (filters.unit === "all" || r.unit_ids.includes(filters.unit)),
  );
  const allDates = [
    ...data.answers.map((a) => a.created_at),
    ...data.matches.map((m) => m.created_at),
  ];
  const last = allDates.length
    ? allDates.reduce((t, a) => Math.max(t, Date.parse(a)), -Infinity)
    : null;
  const inactiveDays = last === null ? null : Math.floor((now.getTime() - last) / dayMs);
  const recommendations: { text: string; unit?: string | undefined; friends?: boolean }[] = [];
  if (answers.length >= 20 && topics[0])
    recommendations.push({
      text: `أضعف وحداتك: ${topics[0].name} (${topics[0].accuracy}٪).`,
      unit: topics[0].id,
    });
  if (inactiveDays !== null && inactiveDays >= 3)
    recommendations.push({ text: `لم تتدرّب منذ ${inactiveDays} أيام.`, unit: stats[0]?.id });
  const since = last ?? now.getTime() - 7 * dayMs;
  const friendNew = new Map<string, number>();
  for (const q of data.questions)
    if (q.owner_id !== userId && q.status === "active" && Date.parse(q.created_at) > since)
      friendNew.set(q.owner_id, (friendNew.get(q.owner_id) ?? 0) + 1);
  for (const [id, count] of friendNew)
    recommendations.push({
      text: `${count} أسئلة جديدة من ${names.get(id) ?? "صديقك"}.`,
      friends: true,
    });
  const selected = stats.filter((s) => filters.unit === "all" || s.id === filters.unit);
  const creditRows = data.credits.filter((c) => inRange(c.created_at));
  const prior = data.credits.filter((c) => Date.parse(c.created_at) < start).at(-1);
  const credits = prior
    ? [{ ...prior, created_at: new Date(start).toISOString() }, ...creditRows]
    : creditRows;
  const latestCredit = credits.at(-1);
  if (latestCredit) credits.push({ ...latestCredit, created_at: now.toISOString() });
  return {
    stats,
    topics,
    answers,
    mistakes,
    series,
    runs,
    matches,
    competition: competitionStats(matches, userId),
    recommendations,
    uploaded: data.questions.filter((q) => q.owner_id === userId).length,
    completed: selected.filter((s) => s.status === "done").length,
    totalUnits: selected.length,
    accuracy: answers.length
      ? Math.round((answers.filter((a) => a.is_correct).length / answers.length) * 100)
      : null,
    seconds: avg(timed),
    speedTrend: before !== null && after !== null ? after - before : null,
    streak: studyStreak(allDates, now),
    credits,
  };
}
