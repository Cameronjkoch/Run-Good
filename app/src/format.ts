import type { Street } from '@run-good/engine';

export const fmtLuck = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

export const STREET_LABEL: Record<Street, string> = {
  preflop: 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

export const foldLabel = (street: Street): string =>
  street === 'preflop' ? 'folded pre-flop' : `folded on the ${street}`;
