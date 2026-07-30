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
    analyzeHandInto(hand, byId, ensure, allDeltas, rng, mcIters);
  }

  const leaderboard = [...byId.values()];
  for (const pl of leaderboard) pl.totalLuck = pl.dealtLuck + pl.runoutLuck;
  leaderboard.sort((a, b) => b.totalLuck - a.totalLuck);
  return { leaderboard, deltas: allDeltas };
}

function analyzeHandInto(
  hand: HandRecord,
  byId: Map<string, PlayerLuck>,
  ensure: (id: string) => PlayerLuck,
  allDeltas: RevealDelta[],
  rng: Rng,
  mcIters: number,
): void {
  for (const hp of hand.players) {
    const pl = ensure(hp.playerId);
    pl.handsDealt++;
    pl.dealtLuck += equityVsRandom(hp.hole, rng) - 0.5;
  }

  for (const reveal of REVEALS) {
    if (hand.board.length < reveal.after) break;
    const active = activeForReveal(hand.players, reveal.street);
    if (active.length < 2) break;
    const holes = active.map((p) => p.hole);
    const before = equity(holes, hand.board.slice(0, reveal.before), rng, mcIters);
    const after = equity(holes, hand.board.slice(0, reveal.after), rng, mcIters);
    active.forEach((p, i) => {
      const delta = after[i] - before[i];
      const rd: RevealDelta = {
        handNo: hand.handNo,
        playerId: p.playerId,
        street: reveal.street,
        revealedCards: hand.board.slice(reveal.before, reveal.after),
        delta,
      };
      allDeltas.push(rd);
      const pl = ensure(p.playerId);
      pl.runoutLuck += delta;
      if (delta > 0 && (!pl.biggestSuckout || delta > pl.biggestSuckout.delta)) pl.biggestSuckout = rd;
      if (delta < 0 && (!pl.worstBeat || delta < pl.worstBeat.delta)) pl.worstBeat = rd;
    });
  }

  const survivors = hand.players.filter((p) => p.foldedOn === undefined);
  if (survivors.length === 1) {
    ensure(survivors[0].playerId).handsWon++;
  } else if (survivors.length > 1 && hand.board.length === 5) {
    for (const i of winnersAtShowdown(survivors.map((p) => p.hole), hand.board)) {
      ensure(survivors[i].playerId).handsWon++;
    }
  }

  if (hand.board.length === 5 && survivors.length >= 1) {
    const bestShowdown = Math.max(...survivors.map((p) => evaluate7([...p.hole, ...hand.board])));
    for (const p of hand.players) {
      if (p.foldedOn !== undefined && evaluate7([...p.hole, ...hand.board]) > bestShowdown) {
        ensure(p.playerId).foldedEventualWinner++;
      }
    }
  }
}
