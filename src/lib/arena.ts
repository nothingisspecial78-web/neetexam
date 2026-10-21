// Arena rules (pure, tested). The server function uses these to settle a finished match.

export type Side = { correct: number; wrong: number; lastAt: string | null };

// More correct wins; then fewer wrong; then whoever reached their last correct answer first; else draw.
export function decideWinner(a: Side, b: Side): "a" | "b" | null {
  if (a.correct !== b.correct) return a.correct > b.correct ? "a" : "b";
  if (a.wrong !== b.wrong) return a.wrong < b.wrong ? "a" : "b";
  if (a.correct > 0 && a.lastAt && b.lastAt) {
    const ta = new Date(a.lastAt).getTime(), tb = new Date(b.lastAt).getTime();
    if (ta !== tb) return ta < tb ? "a" : "b";
  }
  return null;
}

// points = round(10 + 40 * (W - L) / W), capped so the loser never goes below 0.
export function creditPoints(winnerCorrect: number, loserCorrect: number, loserCredits: number) {
  const margin = winnerCorrect > 0 ? (winnerCorrect - loserCorrect) / winnerCorrect : 0;
  const points = Math.round(10 + 40 * margin);
  return Math.max(0, Math.min(points, Math.max(0, loserCredits)));
}

export const DURATIONS = [60] as const;
