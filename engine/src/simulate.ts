import { cardPretty, fullDeck, mulberry32, shuffle, type Card, type Rng } from './cards';
import { equityExact, equityVsRandom } from './equity';
import { analyzeSession, type RevealDelta } from './luck';
import type { HandPlayer, HandRecord, Session, Street } from './session';

/**
 * Simulated poker night: deals real hands to simple equity-driven players and runs
 * the luck accounting end-to-end. Usage:
 *
 *   npm run sim -- --players 6 --hands 100 --seed 42
 */

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace', 'Heidi', 'Ivan'];

function argNum(flag: string, dflt: number): number {
  const i = process.argv.indexOf(flag);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : dflt;
}

function decideFolds(players: HandPlayer[], board: Card[], street: Street, rng: Rng): void {
  const act = players.filter((p) => !p.foldedOn);
  if (act.length < 2) return;
  const eqs =
    street === 'preflop'
      ? act.map((p) => equityVsRandom(p.hole, rng))
      : equityExact(act.map((p) => p.hole), board);
  const foldProb = (eq: number): number => {
    if (street === 'preflop') {
      if (eq < 0.4) return 0.85;
      if (eq < 0.46) return 0.55;
      if (eq < 0.5) return 0.25;
      return 0.05;
    }
    const fair = 1 / act.length;
    if (eq < fair * 0.5) return 0.75;
    if (eq < fair * 0.8) return 0.4;
    return 0.05;
  };
  const folding: number[] = [];
  act.forEach((_, i) => {
    if (rng() < foldProb(eqs[i])) folding.push(i);
  });
  // Someone always wins the pot: if everyone tried to fold, the best hand stays.
  if (folding.length === act.length) {
    let best = 0;
    act.forEach((_, i) => {
      if (eqs[i] > eqs[best]) best = i;
    });
    folding.splice(folding.indexOf(best), 1);
  }
  for (const i of folding) act[i].foldedOn = street;
}

function playHand(handNo: number, playerIds: string[], rng: Rng): HandRecord {
  const deck = shuffle(fullDeck(), rng);
  const players: HandPlayer[] = playerIds.map((id, i) => ({
    playerId: id,
    hole: [deck[2 * i], deck[2 * i + 1]] as [Card, Card],
  }));
  const fullBoard = deck.slice(2 * playerIds.length, 2 * playerIds.length + 5);
  const live = () => players.filter((p) => !p.foldedOn).length;

  decideFolds(players, [], 'preflop', rng);
  let revealed = 0;
  if (live() >= 2) {
    revealed = 3;
    decideFolds(players, fullBoard.slice(0, 3), 'flop', rng);
  }
  if (revealed === 3 && live() >= 2) {
    revealed = 4;
    decideFolds(players, fullBoard.slice(0, 4), 'turn', rng);
  }
  if (revealed === 4 && live() >= 2) {
    revealed = 5; // river is always shown down in v1 — no post-river folds
  }
  return { handNo, players, board: fullBoard.slice(0, revealed) };
}

const fmt = (n: number): string => (n >= 0 ? '+' : '') + n.toFixed(2);

function describeDelta(d: RevealDelta, names: Map<string, string>): string {
  const cards = d.revealedCards.map(cardPretty).join(' ');
  return `hand #${d.handNo} — ${names.get(d.playerId)} ${fmt(d.delta)} equity on the ${d.street} (${cards})`;
}

function main(): void {
  const nPlayers = Math.min(Math.max(argNum('--players', 6), 2), NAMES.length);
  const nHands = argNum('--hands', 100);
  const seed = argNum('--seed', 42);
  const rng = mulberry32(seed);

  const session: Session = {
    createdAt: new Date().toISOString(),
    players: NAMES.slice(0, nPlayers).map((name, i) => ({ id: `p${i + 1}`, name })),
    hands: [],
  };
  const ids = session.players.map((p) => p.id);
  for (let h = 1; h <= nHands; h++) session.hands.push(playHand(h, ids, rng));

  const { leaderboard, deltas } = analyzeSession(session, rng);
  const names = new Map(session.players.map((p) => [p.id, p.name]));

  console.log(`\nRUN-GOOD — simulated night: ${nPlayers} players, ${nHands} hands (seed ${seed})\n`);
  console.log('LUCK LEADERBOARD');
  console.log('  #  Player    Dealt    Runout   Total    Won  Folded-winner');
  leaderboard.forEach((p, i) => {
    const tag = i === 0 ? '  🔥' : i === leaderboard.length - 1 ? '  🧊' : '';
    console.log(
      `  ${String(i + 1).padEnd(2)} ${p.name.padEnd(9)} ${fmt(p.dealtLuck).padEnd(8)} ${fmt(p.runoutLuck).padEnd(8)} ${fmt(p.totalLuck).padEnd(8)} ${String(p.handsWon).padEnd(4)} ${p.foldedEventualWinner}${tag}`,
    );
  });

  if (deltas.length > 0) {
    const suckout = deltas.reduce((a, b) => (b.delta > a.delta ? b : a));
    const beat = deltas.reduce((a, b) => (b.delta < a.delta ? b : a));
    console.log(`\nBiggest suckout: ${describeDelta(suckout, names)}`);
    console.log(`Worst beat:      ${describeDelta(beat, names)}`);
  }

  const runoutSum = leaderboard.reduce((s, p) => s + p.runoutLuck, 0);
  console.log(`\nSanity: table runout luck sums to ${runoutSum.toExponential(2)} (should be ~0)`);
}

main();
