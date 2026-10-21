import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PracticeQ = { id: string; unit_id: string | null; question_text: string; options: string[]; correct_index: number; topic_area: string | null; content_hash?: string; explanation?: string | null; from_name?: string | null };
type Answer = { question_id: string; is_correct: boolean; created_at: string };
type Run = { unit_ids: string[]; total: number; correct: number };
export type UnitStat = { id: string; name: string; owner_id?: string; owner_name?: string | null; total: number; answered: number; progress: number; accuracy: number | null; best: number | null; status: "new" | "progress" | "done" };

// Best score of a unit = highest % of a full practice run on that unit (tests may be partial or retries).
export function bestScores(runs: Run[]) {
  const best = new Map<string, number>();
  for (const r of runs) {
    if (r.unit_ids.length !== 1 || !r.total) continue;
    const id = r.unit_ids[0]!;
    const pct = Math.round((r.correct / r.total) * 100);
    if ((best.get(id) ?? -1) < pct) best.set(id, pct);
  }
  return best;
}

// A unit is completed once every question has been answered at least once (any mode).
export function computeUnitStats(units: { id: string; name: string; owner_id?: string; owner_name?: string | null }[], questions: { id: string; unit_id: string | null }[], answers: Answer[], runs: Run[] = []): UnitStat[] {
  const latest = new Map<string, Answer>();
  for (const a of answers) {
    const prev = latest.get(a.question_id);
    if (!prev || prev.created_at < a.created_at) latest.set(a.question_id, a);
  }
  const best = bestScores(runs);
  return units.map((u) => {
    const qs = questions.filter((q) => q.unit_id === u.id);
    const done = qs.map((q) => latest.get(q.id)).filter((a): a is Answer => !!a);
    const total = qs.length;
    const answered = done.length;
    const status: UnitStat["status"] = answered === 0 ? "new" : total > 0 && answered === total ? "done" : "progress";
    return {
      ...u, total, answered,
      progress: total ? Math.round((answered / total) * 100) : 0,
      accuracy: answered ? Math.round((done.filter((a) => a.is_correct).length / answered) * 100) : null,
      best: best.get(u.id) ?? null,
      status,
    };
  }).filter((u) => !u.owner_name || u.total > 0);
}

// Weighted toward low accuracy: weight = 101 - accuracy (unpracticed counts as 0%).
export function pickRandomUnit(stats: UnitStat[], rand = Math.random) {
  if (!stats.length) return null;
  const w = stats.map((s) => 101 - (s.accuracy ?? 0));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < stats.length; i++) { r -= w[i]!; if (r < 0) return stats[i]!; }
  return stats[stats.length - 1];
}

export function shuffle<T>(arr: T[], rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// Shuffle options while tracking the correct answer.
export function shuffleOptions(q: PracticeQ, rand = Math.random): PracticeQ {
  const order = shuffle(q.options.map((_, i) => i), rand);
  return { ...q, options: order.map((i) => q.options[i]!), correct_index: order.indexOf(q.correct_index), id: q.id };
}

export function completedUnitIds(stats: UnitStat[]) {
  return stats.filter((s) => s.status === "done").map((s) => s.id);
}

type RawUnit = { id: string; name: string; owner_id: string; topic_area: string };
type RawQ = PracticeQ & { owner_id: string; content_hash: string };

// Combines own and accepted friends' banks: friend questions join your unit of the same
// topic (or one shared unit per topic), duplicates (same content) keep only one copy, own first.
export function combineBanks(userId: string, units: RawUnit[], questions: RawQ[], names: Map<string, string | null>) {
  const mine = (o: string) => o === userId;
  const target = new Map<string, string>(); // original unit id -> displayed unit id
  const groups = new Map<string, { id: string; owners: Set<string> }>(); // topic -> displayed unit
  const owners = new Map<string, Set<string>>(); // displayed unit id -> contributing owners
  const sorted = [...units].sort((a, b) => Number(!mine(a.owner_id)) - Number(!mine(b.owner_id)) || a.id.localeCompare(b.id));
  for (const u of sorted) {
    const g = groups.get(u.topic_area);
    if (!g || mine(u.owner_id)) {
      const ng = { id: u.id, owners: new Set([u.owner_id]) };
      if (!g) groups.set(u.topic_area, ng);
      owners.set(u.id, ng.owners);
      target.set(u.id, u.id);
    } else {
      target.set(u.id, g.id);
      g.owners.add(u.owner_id);
    }
  }
  const seen = new Set<string>();
  const qs: PracticeQ[] = [];
  for (const q of [...questions].sort((a, b) => Number(!mine(a.owner_id)) - Number(!mine(b.owner_id)))) {
    const unit = q.unit_id ? target.get(q.unit_id) : undefined;
    if (!unit || seen.has(q.content_hash)) continue;
    seen.add(q.content_hash);
    const { owner_id, content_hash: _h, ...rest } = q;
    qs.push({ ...rest, content_hash: _h, unit_id: unit, from_name: mine(owner_id) ? null : names.get(owner_id) ?? "صديق" });
  }
  const shown = sorted.filter((u) => target.get(u.id) === u.id).map((u) => ({
    id: u.id, name: u.name, owner_id: u.owner_id,
    owner_name: mine(u.owner_id) ? null : [...owners.get(u.id)!].map((o) => names.get(o) ?? "صديق").join("، "),
  }));
  return { units: shown, questions: qs };
}

export const unitsOptions = (userId: string) => queryOptions({
  queryKey: ["units", userId],
  queryFn: async () => {
    const [u, q, a, r, p] = await Promise.all([
      // RLS returns own units/questions plus accepted friends' active ones only.
      supabase.from("units").select("id, name, owner_id, topic_area").order("name"),
      supabase.from("questions").select("id, owner_id, content_hash, unit_id, question_text, options, correct_index, topic_area, explanation").eq("status", "active").not("unit_id", "is", null),
      supabase.from("answers").select("question_id, is_correct, created_at").eq("owner_id", userId),
      supabase.from("test_results").select("unit_ids, total, correct").eq("owner_id", userId).eq("mode", "practice"),
      supabase.rpc("related_profiles"),
    ]);
    const err = u.error ?? q.error ?? a.error ?? r.error ?? p.error;
    if (err) throw err;
    const names = new Map((p.data ?? []).map((x) => [x.id, x.display_name] as const));
    const raw = (q.data ?? []).filter((x) => x.correct_index !== null) as RawQ[];
    const combined = combineBanks(userId, u.data ?? [], raw, names);
    const stats = computeUnitStats(combined.units, combined.questions, a.data ?? [], r.data ?? []);
    // Own units first, then friends' shared units.
    stats.sort((x, y) => Number(!!x.owner_name) - Number(!!y.owner_name));
    return { stats, questions: combined.questions };
  },
});

export async function saveAnswer(a: { question_id: string; chosen_index: number | null; is_correct: boolean; time_ms: number; mode: "practice" | "test" }) {
  const { error } = await supabase.from("answers").insert(a);
  if (error) throw error;
}

// Stores a finished practice/test run (feeds best score and the dashboard).
export async function saveRun(r: { unit_ids: string[]; total: number; correct: number; duration_s: number; mode: "practice" | "test" }) {
  const { error } = await supabase.from("test_results").insert(r);
  if (error) throw error;
}
