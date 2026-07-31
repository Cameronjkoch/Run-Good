import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  analyzeHand,
  mulberry32,
  type Card,
  type HandAnalysis,
  type HandRecord,
  type Street,
} from '@run-good/engine';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { emptyAgg, mergeAnalysis, type Aggregate } from './aggregate';

export type Screen = 'home' | 'setup' | 'hand' | 'leaderboard' | 'online';
export type HandPhase = 'deal' | 'play' | 'recap';

export type { Aggregate } from './aggregate';

export interface RosterPlayer {
  id: string;
  name: string;
}

export interface CurrentHand {
  handNo: number;
  satOut: string[];
  holes: Record<string, [Card, Card]>;
  foldedOn: Partial<Record<string, Street>>;
  board: Card[];
  phase: HandPhase;
  analysis?: HandAnalysis;
}

export const streetForBoard = (board: readonly Card[]): Street =>
  board.length >= 5 ? 'river' : board.length === 4 ? 'turn' : board.length === 3 ? 'flop' : 'preflop';

/** Cards that are already committed this hand (all holes except `excludePlayerId`'s, plus the board). */
export function usedCards(cur: CurrentHand | undefined, excludePlayerId?: string): Set<Card> {
  const used = new Set<Card>();
  if (!cur) return used;
  for (const [pid, hole] of Object.entries(cur.holes)) {
    if (pid === excludePlayerId) continue;
    used.add(hole[0]);
    used.add(hole[1]);
  }
  for (const c of cur.board) used.add(c);
  return used;
}

export interface LeaderRow extends Aggregate {
  playerId: string;
  name: string;
  totalLuck: number;
}

export const leaderboardRows = (
  roster: RosterPlayer[],
  aggregates: Record<string, Aggregate>,
): LeaderRow[] =>
  roster
    .map((r) => {
      const a = aggregates[r.id] ?? emptyAgg();
      return { playerId: r.id, name: r.name, ...a, totalLuck: a.dealtLuck + a.runoutLuck };
    })
    .sort((x, y) => y.totalLuck - x.totalLuck);

interface NightStore {
  screen: Screen;
  seed: number;
  roster: RosterPlayer[];
  hands: HandRecord[];
  aggregates: Record<string, Aggregate>;
  current?: CurrentHand;

  go: (screen: Screen) => void;
  newNight: (names: string[]) => void;
  resetNight: () => void;
  startHand: () => void;
  toggleSitOut: (playerId: string) => void;
  setHole: (playerId: string, hole: [Card, Card]) => void;
  beginPlay: () => void;
  fold: (playerId: string) => void;
  unfold: (playerId: string) => void;
  addBoardCards: (cards: Card[]) => void;
  showdown: () => void;
  misdeal: () => void;
  nextHand: () => void;
}

export const useNight = create<NightStore>()(
  persist(
    (set, get) => {
      const dealtRoster = () => {
        const s = get();
        const cur = s.current;
        if (!cur) return [];
        return s.roster.filter((r) => !cur.satOut.includes(r.id) && cur.holes[r.id]);
      };

      const finishHand = () => {
        const s = get();
        const cur = s.current;
        if (!cur) return;
        const rec: HandRecord = {
          handNo: cur.handNo,
          players: dealtRoster().map((r) => ({
            playerId: r.id,
            hole: cur.holes[r.id],
            ...(cur.foldedOn[r.id] ? { foldedOn: cur.foldedOn[r.id] } : {}),
          })),
          board: cur.board.slice(),
        };
        const analysis = analyzeHand(rec, mulberry32((s.seed + cur.handNo * 7919) >>> 0));
        const aggregates = mergeAnalysis(s.aggregates, analysis, rec.players.map((p) => p.playerId));

        set({
          hands: [...s.hands, rec],
          aggregates,
          current: { ...cur, phase: 'recap', analysis },
        });
      };

      return {
        screen: 'home',
        seed: 1,
        roster: [],
        hands: [],
        aggregates: {},
        current: undefined,

        go: (screen) => set({ screen }),

        newNight: (names) => {
          set({
            roster: names.map((name, i) => ({ id: `p${i + 1}`, name: name.trim() })),
            seed: Date.now() >>> 0,
            hands: [],
            aggregates: {},
            current: undefined,
            screen: 'hand',
          });
          get().startHand();
        },

        resetNight: () =>
          set({ roster: [], hands: [], aggregates: {}, current: undefined, screen: 'home' }),

        startHand: () => {
          const s = get();
          set({
            current: {
              handNo: s.hands.length + 1,
              satOut: s.current?.satOut ?? [],
              holes: {},
              foldedOn: {},
              board: [],
              phase: 'deal',
            },
            screen: 'hand',
          });
        },

        toggleSitOut: (playerId) => {
          const cur = get().current;
          if (!cur || cur.phase !== 'deal') return;
          const satOut = cur.satOut.includes(playerId)
            ? cur.satOut.filter((id) => id !== playerId)
            : [...cur.satOut, playerId];
          const holes = { ...cur.holes };
          delete holes[playerId];
          set({ current: { ...cur, satOut, holes } });
        },

        setHole: (playerId, hole) => {
          const cur = get().current;
          if (!cur || cur.phase !== 'deal') return;
          set({ current: { ...cur, holes: { ...cur.holes, [playerId]: hole } } });
        },

        beginPlay: () => {
          const cur = get().current;
          if (!cur || cur.phase !== 'deal') return;
          set({ current: { ...cur, phase: 'play' } });
        },

        fold: (playerId) => {
          const s = get();
          const cur = s.current;
          if (!cur || cur.phase !== 'play' || cur.foldedOn[playerId]) return;
          const foldedOn = { ...cur.foldedOn, [playerId]: streetForBoard(cur.board) };
          set({ current: { ...cur, foldedOn } });
          const live = s.roster.filter(
            (r) => !cur.satOut.includes(r.id) && cur.holes[r.id] && !foldedOn[r.id],
          );
          if (live.length <= 1) finishHand();
        },

        unfold: (playerId) => {
          const cur = get().current;
          if (!cur || cur.phase !== 'play') return;
          const foldedOn = { ...cur.foldedOn };
          delete foldedOn[playerId];
          set({ current: { ...cur, foldedOn } });
        },

        addBoardCards: (cards) => {
          const cur = get().current;
          if (!cur || cur.phase !== 'play') return;
          const expected = cur.board.length === 0 ? 3 : cur.board.length < 5 ? 1 : 0;
          if (cards.length !== expected) return;
          set({ current: { ...cur, board: [...cur.board, ...cards] } });
        },

        showdown: () => {
          const cur = get().current;
          if (!cur || cur.phase !== 'play' || cur.board.length !== 5) return;
          finishHand();
        },

        misdeal: () => get().startHand(),

        nextHand: () => get().startHand(),
      };
    },
    {
      name: 'run-good-night',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
