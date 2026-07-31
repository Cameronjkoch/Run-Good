import type { HandAnalysis, RevealDelta } from '@run-good/engine';

export interface Aggregate {
  handsDealt: number;
  handsWon: number;
  dealtLuck: number;
  runoutLuck: number;
  foldedEventualWinner: number;
  biggestSuckout?: RevealDelta;
  worstBeat?: RevealDelta;
}

export const emptyAgg = (): Aggregate => ({
  handsDealt: 0,
  handsWon: 0,
  dealtLuck: 0,
  runoutLuck: 0,
  foldedEventualWinner: 0,
});

/** Fold one completed hand's analysis into per-player night aggregates (pure). */
export function mergeAnalysis(
  aggregates: Record<string, Aggregate>,
  analysis: HandAnalysis,
  dealtPlayerIds: string[],
): Record<string, Aggregate> {
  const out = { ...aggregates };
  const bump = (id: string): Aggregate => {
    out[id] = { ...(out[id] ?? emptyAgg()) };
    return out[id];
  };
  for (const pid of dealtPlayerIds) {
    const a = bump(pid);
    a.handsDealt++;
    a.dealtLuck += analysis.dealtLuck[pid] ?? 0;
  }
  for (const d of analysis.deltas) {
    const a = bump(d.playerId);
    a.runoutLuck += d.delta;
    if (d.delta > 0 && (!a.biggestSuckout || d.delta > a.biggestSuckout.delta)) a.biggestSuckout = d;
    if (d.delta < 0 && (!a.worstBeat || d.delta < a.worstBeat.delta)) a.worstBeat = d;
  }
  for (const w of analysis.winners) bump(w).handsWon++;
  for (const f of analysis.foldedEventualWinners) bump(f).foldedEventualWinner++;
  return out;
}
