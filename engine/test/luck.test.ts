import { describe, expect, it } from 'vitest';
import { mulberry32, parseCards } from '../src/cards';
import type { Card } from '../src/cards';
import { analyzeSession } from '../src/luck';
import type { Session } from '../src/session';

// One fully-scripted hand: Ann's aces beat Ben's kings on Qs Js Ts 4d 4c,
// while Cal folded 4s4h preflop — quad fours, the eventual winner.
function scriptedSession(): Session {
  const hole = (s: string) => parseCards(s) as [Card, Card];
  return {
    createdAt: '2026-07-30T00:00:00.000Z',
    players: [
      { id: 'a', name: 'Ann' },
      { id: 'b', name: 'Ben' },
      { id: 'c', name: 'Cal' },
    ],
    hands: [
      {
        handNo: 1,
        players: [
          { playerId: 'a', hole: hole('As Ah') },
          { playerId: 'b', hole: hole('Ks Kh') },
          { playerId: 'c', hole: hole('4s 4h'), foldedOn: 'preflop' },
        ],
        board: parseCards('Qs Js Ts 4d 4c'),
      },
    ],
  };
}

describe('analyzeSession', () => {
  const { leaderboard, deltas } = analyzeSession(scriptedSession(), mulberry32(7));
  const get = (id: string) => leaderboard.find((p) => p.playerId === id)!;

  it('runout luck sums to zero across the table', () => {
    const total = leaderboard.reduce((s, p) => s + p.runoutLuck, 0);
    expect(Math.abs(total)).toBeLessThan(1e-9);
  });

  it('a player who folded preflop accrues no runout luck', () => {
    expect(get('c').runoutLuck).toBe(0);
    expect(deltas.filter((d) => d.playerId === 'c')).toHaveLength(0);
  });

  it('records reveal deltas for both live players on all three streets', () => {
    expect(deltas).toHaveLength(6);
  });

  it('credits the hand win to the showdown winner', () => {
    expect(get('a').handsWon).toBe(1);
    expect(get('b').handsWon).toBe(0);
  });

  it('detects a folded eventual winner', () => {
    expect(get('c').foldedEventualWinner).toBe(1);
    expect(get('a').foldedEventualWinner).toBe(0);
  });

  it('scores dealt luck by hole-card strength', () => {
    expect(get('a').dealtLuck).toBeGreaterThan(get('b').dealtLuck);
    expect(get('b').dealtLuck).toBeGreaterThan(0);
    expect(get('a').handsDealt).toBe(1);
  });
});
