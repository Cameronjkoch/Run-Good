import type { Card } from './cards';

/**
 * 7-card Texas Hold'em hand evaluator.
 *
 * evaluate7 returns an integer where a higher value is a strictly better hand and
 * equal values are exact ties: category in bits 20+, then up to five 4-bit
 * tiebreaker ranks packed high-to-low from bit 16 down.
 */

export const CATEGORY_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
] as const;

export const categoryOf = (value: number): number => value >>> 20;

/** Top rank of the best straight in a rank bitmask, or -1. The wheel (A-5) reports 3 (the '5'). */
function straightTop(mask: number): number {
  for (let top = 12; top >= 4; top--) {
    const need = 0b11111 << (top - 4);
    if ((mask & need) === need) return top;
  }
  const wheel = (1 << 12) | 0b1111;
  if ((mask & wheel) === wheel) return 3;
  return -1;
}

/** Pack the n highest set ranks of a bitmask into 4-bit slots starting at bit 16. */
function packTopRanks(mask: number, n: number): number {
  let v = 0;
  let shift = 16;
  let count = 0;
  for (let r = 12; r >= 0 && count < n; r--) {
    if (mask & (1 << r)) {
      v |= r << shift;
      shift -= 4;
      count++;
    }
  }
  return v;
}

function kickersExcluding(rankCount: Uint8Array, exclude: readonly number[], n: number): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (rankCount[r] > 0 && !exclude.includes(r)) out.push(r);
  }
  return out;
}

export function evaluate7(cards: readonly Card[]): number {
  const rankCount = new Uint8Array(13);
  const suitCount = new Uint8Array(4);
  for (let i = 0; i < 7; i++) {
    const c = cards[i];
    rankCount[c % 13]++;
    suitCount[(c / 13) | 0]++;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    // With 5+ cards of one suit in 7, quads and full houses are impossible,
    // so the hand is at least a flush and at best a straight flush.
    let mask = 0;
    for (let i = 0; i < 7; i++) {
      const c = cards[i];
      if (((c / 13) | 0) === flushSuit) mask |= 1 << (c % 13);
    }
    const sf = straightTop(mask);
    if (sf >= 0) return (8 << 20) | (sf << 16);
    return (5 << 20) | packTopRanks(mask, 5);
  }

  let mask = 0;
  let quad = -1;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const n = rankCount[r];
    if (n > 0) mask |= 1 << r;
    if (n === 4) quad = r;
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
  }

  if (quad >= 0) {
    const kicker = kickersExcluding(rankCount, [quad], 1)[0];
    return (7 << 20) | (quad << 16) | (kicker << 12);
  }
  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
    const t = trips[0];
    const p = Math.max(pairs.length > 0 ? pairs[0] : -1, trips.length > 1 ? trips[1] : -1);
    return (6 << 20) | (t << 16) | (p << 12);
  }
  const st = straightTop(mask);
  if (st >= 0) return (4 << 20) | (st << 16);
  if (trips.length > 0) {
    const t = trips[0];
    const ks = kickersExcluding(rankCount, [t], 2);
    return (3 << 20) | (t << 16) | (ks[0] << 12) | (ks[1] << 8);
  }
  if (pairs.length >= 2) {
    const hi = pairs[0];
    const lo = pairs[1];
    const k = kickersExcluding(rankCount, [hi, lo], 1)[0];
    return (2 << 20) | (hi << 16) | (lo << 12) | (k << 8);
  }
  if (pairs.length === 1) {
    const p = pairs[0];
    const ks = kickersExcluding(rankCount, [p], 3);
    return (1 << 20) | (p << 16) | (ks[0] << 12) | (ks[1] << 8) | (ks[2] << 4);
  }
  return packTopRanks(mask, 5);
}
