import { fullDeck, rankOf, suitOf, type Card, type Rng } from './cards';
import { evaluate7 } from './evaluator';

/** Indices of the winning (or tying) players at a 5-card showdown. */
export function winnersAtShowdown(holes: readonly Card[][], board: readonly Card[]): number[] {
  let best = -1;
  let winners: number[] = [];
  for (let i = 0; i < holes.length; i++) {
    const v = evaluate7([holes[i][0], holes[i][1], board[0], board[1], board[2], board[3], board[4]]);
    if (v > best) {
      best = v;
      winners = [i];
    } else if (v === best) {
      winners.push(i);
    }
  }
  return winners;
}

function remainingDeck(holes: readonly Card[][], board: readonly Card[]): Card[] {
  const used = new Set<Card>(board);
  for (const h of holes) {
    used.add(h[0]);
    used.add(h[1]);
  }
  return fullDeck().filter((c) => !used.has(c));
}

/**
 * Exact equity (win + tie share, sums to 1) by enumerating every remaining runout.
 * Supported from the flop on; preflop enumeration is too large — use equityMonteCarlo.
 */
export function equityExact(holes: readonly Card[][], board: readonly Card[]): number[] {
  const n = holes.length;
  const need = 5 - board.length;
  if (need > 2) throw new Error('equityExact supports flop/turn/river boards; use equityMonteCarlo preflop');
  const remaining = remainingDeck(holes, board);
  const eq = new Array<number>(n).fill(0);
  let total = 0;
  const full = [...board, 0, 0].slice(0, 5) as Card[];

  const scoreRunout = () => {
    let best = -1;
    let winners: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = evaluate7([holes[i][0], holes[i][1], full[0], full[1], full[2], full[3], full[4]]);
      if (v > best) {
        best = v;
        winners = [i];
      } else if (v === best) {
        winners.push(i);
      }
    }
    const share = 1 / winners.length;
    for (const w of winners) eq[w] += share;
    total++;
  };

  if (need === 0) {
    scoreRunout();
  } else if (need === 1) {
    for (const c of remaining) {
      full[4] = c;
      scoreRunout();
    }
  } else {
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        full[3] = remaining[i];
        full[4] = remaining[j];
        scoreRunout();
      }
    }
  }
  return eq.map((e) => e / total);
}

/** Monte Carlo equity (win + tie share, sums to 1) for any board size. */
export function equityMonteCarlo(
  holes: readonly Card[][],
  board: readonly Card[],
  iters: number,
  rng: Rng,
): number[] {
  const n = holes.length;
  const need = 5 - board.length;
  const remaining = remainingDeck(holes, board);
  const eq = new Array<number>(n).fill(0);
  const full = [...board, ...new Array<Card>(need).fill(0)] as Card[];

  for (let t = 0; t < iters; t++) {
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rng() * (remaining.length - k));
      const tmp = remaining[k];
      remaining[k] = remaining[j];
      remaining[j] = tmp;
      full[board.length + k] = remaining[k];
    }
    let best = -1;
    let winners: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = evaluate7([holes[i][0], holes[i][1], full[0], full[1], full[2], full[3], full[4]]);
      if (v > best) {
        best = v;
        winners = [i];
      } else if (v === best) {
        winners.push(i);
      }
    }
    const share = 1 / winners.length;
    for (const w of winners) eq[w] += share;
  }
  return eq.map((e) => e / iters);
}

/** Exact from the flop on, Monte Carlo preflop. Single live player is trivially 1. */
export function equity(holes: readonly Card[][], board: readonly Card[], rng: Rng, mcIters = 20000): number[] {
  if (holes.length === 1) return [1];
  return board.length >= 3 ? equityExact(holes, board) : equityMonteCarlo(holes, board, mcIters, rng);
}

// All-in equity vs one random hand, memoized on the 169 canonical hole classes.
const vsRandomCache = new Map<string, number>();

export function equityVsRandom(hole: readonly Card[], rng: Rng, iters = 20000): number {
  const r1 = Math.max(rankOf(hole[0]), rankOf(hole[1]));
  const r2 = Math.min(rankOf(hole[0]), rankOf(hole[1]));
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  const key = `${r1}-${r2}${suited ? 's' : 'o'}`;
  const hit = vsRandomCache.get(key);
  if (hit !== undefined) return hit;

  const canonical: Card[] = suited ? [r1, r2] : [r1, 13 + r2];
  const remaining = fullDeck().filter((c) => c !== canonical[0] && c !== canonical[1]);
  let eq = 0;
  for (let t = 0; t < iters; t++) {
    for (let k = 0; k < 7; k++) {
      const j = k + Math.floor(rng() * (remaining.length - k));
      const tmp = remaining[k];
      remaining[k] = remaining[j];
      remaining[j] = tmp;
    }
    const hero = evaluate7([canonical[0], canonical[1], remaining[2], remaining[3], remaining[4], remaining[5], remaining[6]]);
    const villain = evaluate7([remaining[0], remaining[1], remaining[2], remaining[3], remaining[4], remaining[5], remaining[6]]);
    if (hero > villain) eq += 1;
    else if (hero === villain) eq += 0.5;
  }
  eq /= iters;
  vsRandomCache.set(key, eq);
  return eq;
}
