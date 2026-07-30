import type { Card, Rng } from './cards';
import { equity, equityVsRandom, winnersAtShowdown } from './equity';
import { evaluate7 } from './evaluator';
import { activeForReveal, type HandRecord, type Session } from './session';

/**
 * Luck accounting.
 *
 * Dealt luck: all-in equity of your hole cards vs one random hand, minus 0.5,
 * summed over every hand you're dealt — did the deck favor you before anyone acted?
 *
 * Runout luck: for each board reveal (flop/turn/river), the change in exact equity
 * it caused, computed over the players who were live for that reveal. Holding the
 * live set fixed across the reveal means fold-induced equity shifts are excluded:
 * those are play, not luck. Equity is conserved, so runout luck zero-sums across
 * the table on every reveal.
 */

export interface RevealDelta {
  handNo: number;
  playerId: string;
  street: 'flop' | 'turn' | 'river';
  revealedCards: Card[];
  delta: number;
}

/** Equity table across one reveal, for the players live at that reveal. */
export interface StreetEquity {
  street: 'flop' | 'turn' | 'river';
  revealedCards: Card[];
  playerIds: string[];
  before: number[];
  after: number[];
}

/** Pure, serializable analysis of a single completed hand. */
export interface HandAnalysis {
  handNo: number;
  dealtLuck: Record<string, number>;
  deltas: RevealDelta[];
  streetEquities: StreetEquity[];
  /** Hand winners — by showdown, or the last player standing. Empty if undecidable. */
  winners: string[];
  showdown: boolean;
  foldedEventualWinners: string[];
}

export interface PlayerLuck {
  playerId: string;
  name: string;
  handsDealt: number;
  handsWon: number;
  dealtLuck: number;
  runoutLuck: number;
  totalLuck: number;
  /** Times a folded hand would have beaten everyone who reached showdown. */
  foldedEventualWinner: number;
  biggestSuckout?: RevealDelta;
  worstBeat?: RevealDelta;
}

export interface SessionAnalysis {
  leaderboard: PlayerLuck[];
  deltas: RevealDelta[];
}

const REVEALS = [
  { street: 'flop', before: 0, after: 3 },
  { street: 'turn', before: 3, after: 4 },
  { street: 'river', before: 4, after: 5 },
] as const;

export function analyzeHand(hand: HandRecord, rng: Rng, mcIters = 20000): HandAnalysis {
  const dealtLuck: Record<string, number> = {};
  for (const hp of hand.players) {
    dealtLuck[hp.playerId] = equityVsRandom(hp.hole, rng) - 0.5;
  }

  const deltas: RevealDelta[] = [];
  const streetEquities: StreetEquity[] = [];
  for (const reveal of REVEALS) {
    if (hand.board.length < reveal.after) break;
    const active = activeForReveal(hand.players, reveal.street);
    if (active.length < 2) break;
    const holes = active.map((p) => p.hole);
    const before = equity(holes, hand.board.slice(0, reveal.before), rng, mcIters);
    const after = equity(holes, hand.board.slice(0, reveal.after), rng, mcIters);
    const revealedCards = hand.board.slice(reveal.before, reveal.after);
    streetEquities.push({
      street: reveal.street,
      revealedCards,
      playerIds: active.map((p) => p.playerId),
      before,
      after,
    });
    active.forEach((p, i) => {
      deltas.push({
        handNo: hand.handNo,
        playerId: p.playerId,
        street: reveal.street,
        revealedCards,
        delta: after[i] - before[i],
      });
    });
  }

  const survivors = hand.players.filter((p) => p.foldedOn === undefined);
  let winners: string[] = [];
  let showdown = false;
  if (survivors.length === 1) {
    winners = [survivors[0].playerId];
  } else if (survivors.length > 1 && hand.board.length === 5) {
    showdown = true;
    winners = winnersAtShowdown(survivors.map((p) => p.hole), hand.board).map(
      (i) => survivors[i].playerId,
    );
  }

  const foldedEventualWinners: string[] = [];
  if (hand.board.length === 5 && survivors.length >= 1) {
    const best = Math.max(...survivors.map((p) => evaluate7([...p.hole, ...hand.board])));
    for (const p of hand.players) {
      if (p.foldedOn !== undefined && evaluate7([...p.hole, ...hand.board]) > best) {
        foldedEventualWinners.push(p.playerId);
      }
    }
  }

  return { handNo: hand.handNo, dealtLuck, deltas, streetEquities, winners, showdown, foldedEventualWinners };
}

export function analyzeSession(session: Session, rng: Rng, mcIters = 20000): SessionAnalysis {
  const byId = new Map<string, PlayerLuck>();
  const ensure = (id: string, name?: string): PlayerLuck => {
    let pl = byId.get(id);
    if (!pl) {
      pl = {
        playerId: id,
        name: name ?? id,
        handsDealt: 0,
        handsWon: 0,
        dealtLuck: 0,
        runoutLuck: 0,
        totalLuck: 0,
        foldedEventualWinner: 0,
      };
      byId.set(id, pl);
    }
    return pl;
  };
  for (const p of session.players) ensure(p.id, p.name);

  const allDeltas: RevealDelta[] = [];
  for (const hand of session.hands) {
    const a = analyzeHand(hand, rng, mcIters);
    for (const hp of hand.players) {
      const pl = ensure(hp.playerId);
      pl.handsDealt++;
      pl.dealtLuck += a.dealtLuck[hp.playerId];
    }
    for (const d of a.deltas) {
      allDeltas.push(d);
      const pl = ensure(d.playerId);
      pl.runoutLuck += d.delta;
      if (d.delta > 0 && (!pl.biggestSuckout || d.delta > pl.biggestSuckout.delta)) pl.biggestSuckout = d;
      if (d.delta < 0 && (!pl.worstBeat || d.delta < pl.worstBeat.delta)) pl.worstBeat = d;
    }
    for (const w of a.winners) ensure(w).handsWon++;
    for (const f of a.foldedEventualWinners) ensure(f).foldedEventualWinner++;
  }

  const leaderboard = [...byId.values()];
  for (const pl of leaderboard) pl.totalLuck = pl.dealtLuck + pl.runoutLuck;
  leaderboard.sort((a, b) => b.totalLuck - a.totalLuck);
  return { leaderboard, deltas: allDeltas };
}
