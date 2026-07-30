import { describe, expect, it } from 'vitest';
import { parseCards } from '../src/cards';
import { categoryOf, evaluate7 } from '../src/evaluator';

const v = (s: string) => evaluate7(parseCards(s));

describe('evaluate7', () => {
  it('ranks categories in order', () => {
    const sf = v('5h 6h 7h 8h 9h 9c 9d');
    const quads = v('9s 9h 9c 9d Ah 2c 3d');
    const boat = v('9s 9h 9c Ah Ad 2c 3d');
    const flush = v('Ah Kh 9h 7h 3h 2c 4d');
    const straight = v('5h 6c 7d 8s 9h Ac Ad');
    const trips = v('9s 9h 9c Ah Kd 2c 3d');
    const twoPair = v('9s 9h Ah Ad 2c 3d 5s');
    const pair = v('9s 9h Ah Kd Qc 3d 5s');
    const high = v('9s 8h Ah Kd Qc 3d 5s');
    const ordered = [sf, quads, boat, flush, straight, trips, twoPair, pair, high];
    expect(ordered.map(categoryOf)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i - 1]).toBeGreaterThan(ordered[i]);
    }
  });

  it('handles the wheel and ranks it below a 6-high straight', () => {
    const wheel = v('Ah 2c 3d 4s 5h 9c Jd');
    const sixHigh = v('2h 3c 4d 5s 6h 9c Jd');
    expect(categoryOf(wheel)).toBe(4);
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it('uses the best kicker for two pair when three pairs are present', () => {
    const kickerQ = v('Ah Ad Kh Kd Qh Qd 2c');
    const kickerJ = v('Ah Ad Kh Kd Jh 2d 3c');
    expect(categoryOf(kickerQ)).toBe(2);
    expect(kickerQ).toBeGreaterThan(kickerJ);
  });

  it('compares flushes by all five cards', () => {
    expect(v('Ah Kh 9h 7h 3h 2h Qc')).toBeGreaterThan(v('Ah Kh 9h 7h 2h 4c Qc'));
  });

  it('ties when the board plays', () => {
    expect(v('2c 3d Ah Kh Qh Jh Th')).toBe(v('4s 5c Ah Kh Qh Jh Th'));
  });

  it('builds the best full house from two sets of trips', () => {
    const twoTrips = v('Ah Ad Ac Kh Kd Kc 2s');
    const direct = v('Ah Ad Ac Kh Kd 2c 2s');
    expect(categoryOf(twoTrips)).toBe(6);
    expect(twoTrips).toBe(direct);
  });

  it('quads use the best kicker', () => {
    expect(v('Ah Ad Ac As Kh 2c 3d')).toBeGreaterThan(v('Ah Ad Ac As Qh 2c 3d'));
  });
});
