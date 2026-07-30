import type { Card } from './cards';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

/** Betting-round order; a reveal (flop/turn/river) happens at the START of its street. */
export const STREET_ORDER: Record<Street, number> = { preflop: 0, flop: 1, turn: 2, river: 3 };

export interface Player {
  id: string;
  name: string;
}

export interface HandPlayer {
  playerId: string;
  hole: [Card, Card];
  /**
   * Street during whose betting this player folded. 'preflop' means they never saw
   * the flop; 'flop' means they saw the flop reveal but not the turn. Undefined
   * means they stayed to the end of the hand.
   */
  foldedOn?: Street;
}

export interface HandRecord {
  handNo: number;
  /** Everyone dealt in, including players who folded. */
  players: HandPlayer[];
  /** Community cards actually revealed: 0 (ended preflop), 3, 4, or 5. */
  board: Card[];
}

export interface Session {
  createdAt: string;
  players: Player[];
  hands: HandRecord[];
}

/** Players who were live for the reveal at the start of `street` (i.e. hadn't folded earlier). */
export function activeForReveal(players: readonly HandPlayer[], street: Street): HandPlayer[] {
  const order = STREET_ORDER[street];
  return players.filter((p) => p.foldedOn === undefined || STREET_ORDER[p.foldedOn] >= order);
}
