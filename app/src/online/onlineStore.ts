import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  analyzeHand,
  mulberry32,
  type Card,
  type HandAnalysis,
  type Street,
} from '@run-good/engine';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { streetForBoard } from '../store';
import { ensureFirebase } from './firebase';

export interface OnlinePlayer {
  id: string;
  name: string;
}

export interface GameDoc {
  code: string;
  createdAt: number;
  players: OnlinePlayer[];
  status: 'lobby' | 'playing';
}

export interface HandDoc {
  handNo: number;
  phase: 'deal' | 'play' | 'recap';
  dealtIn: string[];
  entered: Record<string, boolean>;
  foldedOn: Record<string, Street>;
  board: Card[];
  /** Written at finalize: everyone's hole cards, now public. */
  reveal?: Record<string, Card[]>;
  analysis?: HandAnalysis | null;
  /** Duplicate cards discovered at finalize — hand is voided. */
  conflict?: Card[] | null;
}

export type OnlineStage = 'entry' | 'lobby' | 'hand' | 'leaderboard';

const handDocId = (n: number): string => String(n).padStart(4, '0');

interface OnlineStore {
  stage: OnlineStage;
  gameId?: string;
  myPlayerId?: string;
  myName?: string;
  game?: GameDoc;
  hand?: HandDoc;
  completedHands: HandDoc[];
  myHole?: { handNo: number; cards: [Card, Card] };
  busy: boolean;
  error?: string;

  host: (name: string) => Promise<void>;
  join: (code: string, name: string) => Promise<void>;
  reconnect: () => Promise<void>;
  leave: () => void;
  startNight: () => Promise<void>;
  enterMyCards: (cards: [Card, Card]) => Promise<void>;
  beginPlay: () => Promise<void>;
  fold: (playerId: string) => Promise<void>;
  unfold: (playerId: string) => Promise<void>;
  addBoardCards: (cards: Card[]) => Promise<void>;
  showdown: () => Promise<void>;
  nextHand: () => Promise<void>;
  goStage: (stage: OnlineStage) => void;
  clearError: () => void;
}

let unsubGame: (() => void) | null = null;
let unsubHands: (() => void) | null = null;

const stopListening = () => {
  unsubGame?.();
  unsubHands?.();
  unsubGame = null;
  unsubHands = null;
};

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong — try again.';

export const useOnline = create<OnlineStore>()(
  persist(
    (set, get) => {
      const subscribe = async (gameId: string) => {
        const db = await ensureFirebase();
        stopListening();
        unsubGame = onSnapshot(doc(db, 'games', gameId), (snap) => {
          if (!snap.exists()) return;
          const game = snap.data() as GameDoc;
          set({ game });
          if (get().stage === 'entry') {
            set({ stage: game.status === 'lobby' ? 'lobby' : 'hand' });
          }
        });
        unsubHands = onSnapshot(collection(db, 'games', gameId, 'hands'), (snap) => {
          const all = snap.docs
            .map((d) => d.data() as HandDoc)
            .sort((a, b) => a.handNo - b.handNo);
          const hand = all[all.length - 1];
          set({ hand, completedHands: all.filter((h) => h.phase === 'recap') });
          const s = get();
          if (hand && s.stage === 'lobby') set({ stage: 'hand' });
          // Rejoin mid-hand: recover my own hole cards from my private doc.
          if (
            hand &&
            s.myPlayerId &&
            hand.phase !== 'recap' &&
            hand.entered?.[s.myPlayerId] &&
            s.myHole?.handNo !== hand.handNo
          ) {
            void getDoc(doc(db, 'games', gameId, 'hands', handDocId(hand.handNo), 'holes', s.myPlayerId)).then(
              (h) => {
                const cards = h.data()?.cards as [Card, Card] | undefined;
                if (cards) set({ myHole: { handNo: hand.handNo, cards } });
              },
            );
          }
        });
      };

      const createHand = async (handNo: number) => {
        const s = get();
        if (!s.gameId || !s.game) return;
        const db = await ensureFirebase();
        const href = doc(db, 'games', s.gameId, 'hands', handDocId(handNo));
        const dealtIn = s.game.players.map((p) => p.id);
        await runTransaction(db, async (tx) => {
          const existing = await tx.get(href);
          if (existing.exists()) return;
          tx.set(href, {
            handNo,
            phase: 'deal',
            dealtIn,
            entered: {},
            foldedOn: {},
            board: [],
          } satisfies HandDoc);
        });
      };

      const finalize = async () => {
        const s = get();
        if (!s.gameId || !s.game || !s.hand) return;
        const db = await ensureFirebase();
        const hid = handDocId(s.hand.handNo);
        const holesSnap = await getDocs(collection(db, 'games', s.gameId, 'hands', hid, 'holes'));
        const reveal: Record<string, Card[]> = {};
        holesSnap.forEach((d) => {
          reveal[d.id] = d.data().cards as Card[];
        });
        const players = s.hand.dealtIn
          .filter((pid) => reveal[pid]?.length === 2)
          .map((pid) => ({
            playerId: pid,
            hole: reveal[pid] as [Card, Card],
            ...(s.hand!.foldedOn[pid] ? { foldedOn: s.hand!.foldedOn[pid] } : {}),
          }));
        const allCards = [...s.hand.board, ...players.flatMap((p) => p.hole)];
        const dupes = [...new Set(allCards.filter((c, i) => allCards.indexOf(c) !== i))];
        let analysis: HandAnalysis | null = null;
        if (dupes.length === 0 && players.length > 0) {
          const seed = ((s.game.createdAt % 2147483647) + s.hand.handNo * 7919) >>> 0;
          analysis = analyzeHand(
            { handNo: s.hand.handNo, players, board: s.hand.board.slice() },
            mulberry32(seed),
          );
        }
        const href = doc(db, 'games', s.gameId, 'hands', hid);
        await runTransaction(db, async (tx) => {
          const cur = await tx.get(href);
          if (!cur.exists() || (cur.data() as HandDoc).phase === 'recap') return;
          tx.update(href, {
            phase: 'recap',
            reveal,
            analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
            conflict: dupes.length > 0 ? dupes : null,
          });
        });
      };

      const wrap = async (fn: () => Promise<void>) => {
        set({ busy: true, error: undefined });
        try {
          await fn();
        } catch (e) {
          set({ error: errMsg(e) });
        } finally {
          set({ busy: false });
        }
      };

      return {
        stage: 'entry',
        completedHands: [],
        busy: false,

        host: (name) =>
          wrap(async () => {
            const db = await ensureFirebase();
            const code = String(1000 + Math.floor(Math.random() * 9000));
            const gref = doc(collection(db, 'games'));
            await setDoc(gref, {
              code,
              createdAt: Date.now(),
              players: [{ id: 'p1', name: name.trim() }],
              status: 'lobby',
            } satisfies GameDoc);
            set({ gameId: gref.id, myPlayerId: 'p1', myName: name.trim(), stage: 'lobby' });
            await subscribe(gref.id);
          }),

        join: (code, name) =>
          wrap(async () => {
            const db = await ensureFirebase();
            const snap = await getDocs(
              query(collection(db, 'games'), where('code', '==', code.trim()), limit(10)),
            );
            if (snap.empty) throw new Error('No table found with that code.');
            const newest = snap.docs.sort(
              (a, b) => (b.data() as GameDoc).createdAt - (a.data() as GameDoc).createdAt,
            )[0];
            const gref = newest.ref;
            let myPlayerId = '';
            await runTransaction(db, async (tx) => {
              const g = await tx.get(gref);
              const gd = g.data() as GameDoc;
              const existing = gd.players.find(
                (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
              );
              if (existing) {
                myPlayerId = existing.id; // rejoin the same seat by name
                return;
              }
              if (gd.players.length >= 9) throw new Error('That table is full (9 players max).');
              myPlayerId = `p${gd.players.length + 1}`;
              tx.update(gref, {
                players: [...gd.players, { id: myPlayerId, name: name.trim() }],
              });
            });
            set({ gameId: gref.id, myPlayerId, myName: name.trim(), stage: 'lobby' });
            await subscribe(gref.id);
          }),

        reconnect: () =>
          wrap(async () => {
            const s = get();
            if (!s.gameId) return;
            await subscribe(s.gameId);
          }),

        leave: () => {
          stopListening();
          set({
            stage: 'entry',
            gameId: undefined,
            myPlayerId: undefined,
            game: undefined,
            hand: undefined,
            completedHands: [],
            myHole: undefined,
            error: undefined,
          });
        },

        startNight: () =>
          wrap(async () => {
            const s = get();
            if (!s.gameId) return;
            const db = await ensureFirebase();
            await updateDoc(doc(db, 'games', s.gameId), { status: 'playing' });
            await createHand(1);
            set({ stage: 'hand' });
          }),

        enterMyCards: (cards) =>
          wrap(async () => {
            const s = get();
            if (!s.gameId || !s.hand || !s.myPlayerId || s.hand.phase !== 'deal') return;
            const db = await ensureFirebase();
            const hid = handDocId(s.hand.handNo);
            await setDoc(doc(db, 'games', s.gameId, 'hands', hid, 'holes', s.myPlayerId), {
              cards,
            });
            await updateDoc(
              doc(db, 'games', s.gameId, 'hands', hid),
              `entered.${s.myPlayerId}`,
              true,
            );
            set({ myHole: { handNo: s.hand.handNo, cards } });
          }),

        beginPlay: () =>
          wrap(async () => {
            const s = get();
            if (!s.gameId || !s.hand || s.hand.phase !== 'deal') return;
            const db = await ensureFirebase();
            await updateDoc(doc(db, 'games', s.gameId, 'hands', handDocId(s.hand.handNo)), {
              phase: 'play',
            });
          }),

        fold: (playerId) =>
          wrap(async () => {
            const s = get();
            if (!s.gameId || !s.hand || s.hand.phase !== 'play') return;
            const db = await ensureFirebase();
            const street = streetForBoard(s.hand.board);
            await updateDoc(
              doc(db, 'games', s.gameId, 'hands', handDocId(s.hand.handNo)),
              `foldedOn.${playerId}`,
              street,
            );
            const folded = { ...s.hand.foldedOn, [playerId]: street };
            const live = s.hand.dealtIn.filter((pid) => s.hand!.entered[pid] && !folded[pid]);
            if (live.length <= 1) await finalize();
          }),

        unfold: (playerId) =>
          wrap(async () => {
            const s = get();
            if (!s.gameId || !s.hand || s.hand.phase !== 'play') return;
            const db = await ensureFirebase();
            await updateDoc(
              doc(db, 'games', s.gameId, 'hands', handDocId(s.hand.handNo)),
              `foldedOn.${playerId}`,
              deleteField(),
            );
          }),

        addBoardCards: (cards) =>
          wrap(async () => {
            const s = get();
            if (!s.gameId || !s.hand || s.hand.phase !== 'play') return;
            const expected = s.hand.board.length === 0 ? 3 : s.hand.board.length < 5 ? 1 : 0;
            if (cards.length !== expected) return;
            const db = await ensureFirebase();
            await updateDoc(doc(db, 'games', s.gameId, 'hands', handDocId(s.hand.handNo)), {
              board: [...s.hand.board, ...cards],
            });
          }),

        showdown: () =>
          wrap(async () => {
            const s = get();
            if (!s.hand || s.hand.phase !== 'play' || s.hand.board.length !== 5) return;
            await finalize();
          }),

        nextHand: () =>
          wrap(async () => {
            const s = get();
            if (!s.hand) return;
            await createHand(s.hand.handNo + 1);
            set({ stage: 'hand' });
          }),

        goStage: (stage) => set({ stage }),
        clearError: () => set({ error: undefined }),
      };
    },
    {
      name: 'run-good-online',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ gameId: s.gameId, myPlayerId: s.myPlayerId, myName: s.myName }),
    },
  ),
);
