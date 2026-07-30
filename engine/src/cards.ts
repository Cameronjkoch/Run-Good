/** A card is 0..51: rank = c % 13 (0 = '2' … 12 = 'A'), suit = floor(c / 13) in club/diamond/heart/spade order. */
export type Card = number;

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export const rankOf = (c: Card): number => c % 13;
export const suitOf = (c: Card): number => (c / 13) | 0;

export function parseCard(s: string): Card {
  const rank = RANK_CHARS.indexOf(s[0].toUpperCase());
  const suit = SUIT_CHARS.indexOf(s[1].toLowerCase());
  if (s.length !== 2 || rank < 0 || suit < 0) throw new Error(`Bad card: "${s}"`);
  return suit * 13 + rank;
}

export const parseCards = (s: string): Card[] => s.trim().split(/\s+/).map(parseCard);

export const cardToString = (c: Card): string => RANK_CHARS[rankOf(c)] + SUIT_CHARS[suitOf(c)];
export const cardPretty = (c: Card): string => RANK_CHARS[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];

export function fullDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

/** Deterministic RNG (mulberry32) so simulations and tests are reproducible. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
