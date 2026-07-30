import { describe, expect, it } from 'vitest';
import { mulberry32, parseCards } from '../src/cards';
import { equityExact, equityMonteCarlo, equityVsRandom } from '../src/equity';

describe('equityExact', () => {
  it('is decided on the river', () => {
    const eq = equityExact([parseCards('As Ks'), parseCards('Qd Qc')], parseCards('Ac 7h 2d 9s 3c'));
    expect(eq[0]).toBe(1);
    expect(eq[1]).toBe(0);
  });

  it('computes a known turn equity exactly (10 outs of 44)', () => {
    // AhKh (flush + straight draws) vs 2c2d with trips on Qh Jh 7s 2s.
    // Hero wins with 7 non-pairing hearts (7h/2h fill villain up) plus Ts/Tc/Td.
    const eq = equityExact([parseCards('Ah Kh'), parseCards('2c 2d')], parseCards('Qh Jh 7s 2s'));
    expect(eq[0]).toBeCloseTo(10 / 44, 10);
    expect(eq[0] + eq[1]).toBeCloseTo(1, 10);
  });
});

describe('equityMonteCarlo', () => {
  it('AA vs KK preflop is about 81/19', () => {
    const eq = equityMonteCarlo([parseCards('Ah Ad'), parseCards('Ks Kc')], [], 40000, mulberry32(1));
    expect(eq[0]).toBeGreaterThan(0.8);
    expect(eq[0]).toBeLessThan(0.835);
    expect(eq[0] + eq[1]).toBeCloseTo(1, 9);
  });
});

describe('equityVsRandom', () => {
  it('matches known all-in-vs-random values', () => {
    const rng = mulberry32(2);
    const aces = equityVsRandom(parseCards('Ah Ad'), rng);
    expect(aces).toBeGreaterThan(0.83);
    expect(aces).toBeLessThan(0.87);
    const seventwo = equityVsRandom(parseCards('7c 2d'), rng);
    expect(seventwo).toBeGreaterThan(0.32);
    expect(seventwo).toBeLessThan(0.37);
  });

  it('memoizes by canonical hole class', () => {
    const rng = mulberry32(3);
    expect(equityVsRandom(parseCards('As Ks'), rng)).toBe(equityVsRandom(parseCards('Ah Kh'), rng));
  });
});
