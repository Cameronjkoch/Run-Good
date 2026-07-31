import { type Card, type HandRecord } from '@run-good/engine';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CardPicker } from '../components/CardPicker';
import { CardSlot, CardView } from '../components/CardView';
import { RecapView } from '../components/RecapView';
import { BigButton, ConfirmSheet, Panel } from '../components/ui';
import { foldLabel, STREET_LABEL } from '../format';
import { CardScanner } from '../scan/CardScanner';
import { useScanSettings } from '../scan/scanSettings';
import { streetForBoard, usedCards, useNight, type CurrentHand } from '../store';
import { colors } from '../theme';

export function HandScreen() {
  const current = useNight((s) => s.current);
  const startHand = useNight((s) => s.startHand);
  const go = useNight((s) => s.go);

  useEffect(() => {
    if (!current) startHand();
  }, [current, startHand]);
  if (!current) return null;

  const phaseLabel =
    current.phase === 'deal'
      ? 'dealing'
      : current.phase === 'recap'
        ? 'recap'
        : STREET_LABEL[streetForBoard(current.board)];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => go('home')} hitSlop={10}>
          <Text style={styles.headerLink}>Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          Hand #{current.handNo} <Text style={styles.headerPhase}>· {phaseLabel}</Text>
        </Text>
        <Pressable onPress={() => go('leaderboard')} hitSlop={10}>
          <Text style={styles.headerLink}>Board</Text>
        </Pressable>
      </View>

      {current.phase === 'deal' ? <DealPhase current={current} /> : null}
      {current.phase === 'play' ? <PlayPhase current={current} /> : null}
      {current.phase === 'recap' ? <RecapPhase current={current} /> : null}
    </View>
  );
}

/* ---------------------------------- deal ---------------------------------- */

function DealPhase({ current }: { current: CurrentHand }) {
  const roster = useNight((s) => s.roster);
  const setHole = useNight((s) => s.setHole);
  const toggleSitOut = useNight((s) => s.toggleSitOut);
  const beginPlay = useNight((s) => s.beginPlay);

  const [entering, setEntering] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [pickerInitial, setPickerInitial] = useState<Card[] | undefined>(undefined);
  const [passBack, setPassBack] = useState<string | null>(null);
  const [reenter, setReenter] = useState<string | null>(null);
  const canScan = !!useScanSettings((s) => s.apiKey);

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;
  const dealtIn = roster.filter((r) => !current.satOut.includes(r.id));
  const enteredCount = dealtIn.filter((r) => current.holes[r.id]).length;
  const allIn = dealtIn.length >= 2 && dealtIn.every((r) => current.holes[r.id]);

  const othersCards = usedCards(current, entering ?? undefined);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Panel title="Deal — everyone enters their cards">
        {roster.map((r) => {
          const out = current.satOut.includes(r.id);
          const has = !!current.holes[r.id];
          return (
            <View key={r.id} style={styles.playerRow}>
              <Pressable
                style={styles.playerMain}
                disabled={out}
                onPress={() => (has ? setReenter(r.id) : setEntering(r.id))}
              >
                <Text style={[styles.playerName, out && styles.dim]}>{r.name}</Text>
                <Text style={[styles.playerStatus, has && styles.statusIn, out && styles.dim]}>
                  {out ? 'sitting out' : has ? '✓ cards in' : 'tap to enter cards'}
                </Text>
              </Pressable>
              <Pressable style={styles.sitOutBtn} onPress={() => toggleSitOut(r.id)}>
                <Text style={styles.sitOutText}>{out ? 'deal in' : 'sit out'}</Text>
              </Pressable>
            </View>
          );
        })}
      </Panel>

      <Text style={styles.dealNote}>
        {enteredCount}/{dealtIn.length} in — cards stay hidden until the hand ends
      </Text>

      <BigButton label="Start hand ▶" onPress={beginPlay} disabled={!allIn} />

      {/* pass-the-phone interstitial */}
      <Modal visible={!!entering && !pickerOpen && !scanOpen} transparent animationType="fade">
        <View style={styles.overlayCenter}>
          <View style={styles.sheet}>
            <Text style={styles.sheetBig}>📲 Pass the phone to</Text>
            <Text style={styles.sheetName}>{entering ? nameOf(entering) : ''}</Text>
            {canScan ? (
              <>
                <BigButton label="📷 Scan my cards" onPress={() => setScanOpen(true)} />
                <View style={{ height: 10 }} />
                <BigButton label="Type them in" variant="ghost" onPress={() => setPickerOpen(true)} />
              </>
            ) : (
              <BigButton
                label={`I'm ${entering ? nameOf(entering) : ''} — enter my cards`}
                onPress={() => setPickerOpen(true)}
              />
            )}
            <View style={{ height: 10 }} />
            <BigButton label="Cancel" variant="ghost" onPress={() => setEntering(null)} />
          </View>
        </View>
      </Modal>

      {entering && scanOpen ? (
        <CardScanner
          title={`${nameOf(entering)}'s hole cards`}
          count={2}
          validate={(cards) =>
            cards.some((c) => othersCards.has(c))
              ? 'That card is already in play — double-check with the table.'
              : null
          }
          onDone={(cards) => {
            setHole(entering, [cards[0], cards[1]]);
            setScanOpen(false);
            setPassBack(entering);
            setEntering(null);
          }}
          onCancel={() => {
            setScanOpen(false);
            setEntering(null);
          }}
          onManual={(initial) => {
            setScanOpen(false);
            setPickerInitial(initial);
            setPickerOpen(true);
          }}
        />
      ) : null}

      {entering && pickerOpen ? (
        <CardPicker
          title={`${nameOf(entering)}'s hole cards`}
          subtitle="Nobody else can see this screen — enter both cards"
          count={2}
          blocked={new Set(current.board)}
          initial={pickerInitial}
          validate={(cards) =>
            cards.some((c) => othersCards.has(c))
              ? 'That card is already in play — double-check with the table.'
              : null
          }
          onDone={(cards) => {
            setHole(entering, [cards[0], cards[1]]);
            setPickerOpen(false);
            setPickerInitial(undefined);
            setPassBack(entering);
            setEntering(null);
          }}
          onCancel={() => {
            setPickerOpen(false);
            setPickerInitial(undefined);
            setEntering(null);
          }}
        />
      ) : null}

      <Modal visible={!!passBack} transparent animationType="fade">
        <View style={styles.overlayCenter}>
          <View style={styles.sheet}>
            <Text style={styles.sheetBig}>🔒 Locked in and hidden</Text>
            <Text style={styles.sheetSub}>Pass the phone back.</Text>
            <BigButton label="Done" onPress={() => setPassBack(null)} />
          </View>
        </View>
      </Modal>

      <ConfirmSheet
        visible={!!reenter}
        message={`Re-enter ${reenter ? nameOf(reenter) : ''}'s cards? The previous entry is discarded.`}
        confirmLabel="Re-enter"
        onConfirm={() => {
          setEntering(reenter);
          setReenter(null);
        }}
        onCancel={() => setReenter(null)}
      />
    </ScrollView>
  );
}

/* ---------------------------------- play ---------------------------------- */

function PlayPhase({ current }: { current: CurrentHand }) {
  const roster = useNight((s) => s.roster);
  const fold = useNight((s) => s.fold);
  const unfold = useNight((s) => s.unfold);
  const addBoardCards = useNight((s) => s.addBoardCards);
  const showdown = useNight((s) => s.showdown);
  const misdeal = useNight((s) => s.misdeal);

  const [boardPicker, setBoardPicker] = useState(false);
  const [boardScan, setBoardScan] = useState(false);
  const [boardInitial, setBoardInitial] = useState<Card[] | undefined>(undefined);
  const [foldTarget, setFoldTarget] = useState<string | null>(null);
  const [unfoldTarget, setUnfoldTarget] = useState<string | null>(null);
  const [confirmMisdeal, setConfirmMisdeal] = useState(false);
  const canScan = !!useScanSettings((s) => s.apiKey);

  const street = streetForBoard(current.board);
  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;
  const dealtIn = roster.filter((r) => !current.satOut.includes(r.id) && current.holes[r.id]);
  const nextStreetLabel =
    current.board.length === 0 ? 'flop' : current.board.length === 3 ? 'turn' : 'river';
  const holeConflicts = usedCards(current); // board excluded below via blocked

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Panel title={`Board — ${STREET_LABEL[street]}`}>
        <View style={styles.boardRow}>
          {current.board.map((c) => (
            <CardView key={c} card={c} size="md" />
          ))}
          {Array.from({ length: 5 - current.board.length }, (_, i) => (
            <CardSlot key={`b${i}`} size="md" />
          ))}
        </View>
        <View style={{ height: 12 }} />
        {current.board.length < 5 ? (
          <>
            {canScan ? (
              <>
                <BigButton label={`📷 Scan the ${nextStreetLabel}`} onPress={() => setBoardScan(true)} />
                <View style={{ height: 10 }} />
                <BigButton label="Type it in" variant="ghost" onPress={() => setBoardPicker(true)} />
              </>
            ) : (
              <BigButton label={`Enter the ${nextStreetLabel}`} onPress={() => setBoardPicker(true)} />
            )}
          </>
        ) : (
          <BigButton label="Showdown 🏁" onPress={showdown} />
        )}
      </Panel>

      <View style={{ height: 14 }} />
      <Panel title="Players — tap when someone folds">
        {dealtIn.map((r) => {
          const foldedStreet = current.foldedOn[r.id];
          return (
            <Pressable
              key={r.id}
              style={styles.playerRow}
              onPress={() => (foldedStreet ? setUnfoldTarget(r.id) : setFoldTarget(r.id))}
            >
              <Text style={[styles.playerName, foldedStreet && styles.dim]}>{r.name}</Text>
              <Text style={[styles.playerStatus, foldedStreet ? styles.dim : styles.statusIn]}>
                {foldedStreet ? foldLabel(foldedStreet) : 'in the hand'}
              </Text>
            </Pressable>
          );
        })}
      </Panel>

      <View style={{ height: 18 }} />
      <BigButton label="Misdeal — redo this hand" variant="ghost" onPress={() => setConfirmMisdeal(true)} />

      {boardPicker ? (
        <CardPicker
          title={`Enter the ${nextStreetLabel}`}
          subtitle={current.board.length === 0 ? 'All three flop cards' : 'One card'}
          count={current.board.length === 0 ? 3 : 1}
          blocked={new Set(current.board)}
          initial={boardInitial}
          validate={(cards) =>
            cards.some((c) => holeConflicts.has(c) && !current.board.includes(c))
              ? "That card is already in someone's hand — sort it out with the table."
              : null
          }
          onDone={(cards) => {
            addBoardCards(cards);
            setBoardPicker(false);
            setBoardInitial(undefined);
          }}
          onCancel={() => {
            setBoardPicker(false);
            setBoardInitial(undefined);
          }}
        />
      ) : null}

      {boardScan ? (
        <CardScanner
          title={`Scan the ${nextStreetLabel}`}
          count={current.board.length === 0 ? 3 : 1}
          validate={(cards) =>
            cards.some((c) => holeConflicts.has(c))
              ? 'That card is already in play — retake or fix by hand.'
              : null
          }
          onDone={(cards) => {
            addBoardCards(cards);
            setBoardScan(false);
          }}
          onCancel={() => setBoardScan(false)}
          onManual={(initial) => {
            setBoardScan(false);
            setBoardInitial(initial);
            setBoardPicker(true);
          }}
        />
      ) : null}

      <ConfirmSheet
        visible={!!foldTarget}
        message={`${foldTarget ? nameOf(foldTarget) : ''} folds ${
          street === 'preflop' ? 'pre-flop' : `on the ${street}`
        }?`}
        confirmLabel="Fold"
        danger
        onConfirm={() => {
          if (foldTarget) fold(foldTarget);
          setFoldTarget(null);
        }}
        onCancel={() => setFoldTarget(null)}
      />

      <ConfirmSheet
        visible={!!unfoldTarget}
        message={`Un-fold ${unfoldTarget ? nameOf(unfoldTarget) : ''}? (Fat-finger fix — they're back in the hand.)`}
        confirmLabel="Un-fold"
        onConfirm={() => {
          if (unfoldTarget) unfold(unfoldTarget);
          setUnfoldTarget(null);
        }}
        onCancel={() => setUnfoldTarget(null)}
      />

      <ConfirmSheet
        visible={confirmMisdeal}
        message="Scrap this hand and re-deal? Nothing gets recorded."
        confirmLabel="Misdeal"
        danger
        onConfirm={() => {
          setConfirmMisdeal(false);
          misdeal();
        }}
        onCancel={() => setConfirmMisdeal(false)}
      />
    </ScrollView>
  );
}

/* ---------------------------------- recap --------------------------------- */

function RecapPhase({ current }: { current: CurrentHand }) {
  const roster = useNight((s) => s.roster);
  const hands = useNight((s) => s.hands);
  const nextHand = useNight((s) => s.nextHand);
  const go = useNight((s) => s.go);

  const a = current.analysis;
  const rec: HandRecord | undefined = hands[hands.length - 1];
  if (!a || !rec || rec.handNo !== current.handNo) return null;

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <RecapView analysis={a} players={rec.players} board={rec.board} nameOf={nameOf}>
        <View style={{ height: 20 }} />
        <BigButton label="Deal the next hand ▶" onPress={nextHand} />
        <View style={{ height: 10 }} />
        <BigButton
          label="End night — leaderboard"
          variant="ghost"
          onPress={() => go('leaderboard')}
        />
      </RecapView>
    </ScrollView>
  );
}

/* --------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: { color: colors.cream, fontSize: 17, fontWeight: '800' },
  headerPhase: { color: colors.gold, fontWeight: '700' },
  headerLink: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  scroll: { padding: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 10,
  },
  playerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { color: colors.cream, fontSize: 17, fontWeight: '700' },
  playerStatus: { color: colors.faint, fontSize: 13 },
  statusIn: { color: '#7fd49a', fontWeight: '700' },
  dim: { opacity: 0.45 },
  sitOutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sitOutText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  dealNote: { color: colors.faint, fontSize: 13, textAlign: 'center', marginVertical: 14 },

  boardRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  boardRowSmall: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },

  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.feltDark,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetBig: { color: colors.cream, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sheetName: { color: colors.gold, fontSize: 30, fontWeight: '900', textAlign: 'center', marginVertical: 14 },
  sheetSub: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 16 },

  winnerBanner: { alignItems: 'center', marginBottom: 16 },
  winnerText: { color: colors.gold, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  winnerSub: { color: colors.muted, fontSize: 13, marginTop: 6 },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 8,
  },
  revealCards: { flexDirection: 'row', gap: 4 },
  revealLabel: { color: colors.muted, fontSize: 12, width: 92, textAlign: 'right' },
  gasp: { color: colors.cream, fontSize: 15, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },

  luckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 6,
  },
  luckCell: { color: colors.muted, fontSize: 12.5, textAlign: 'right', flex: 1, fontVariant: ['tabular-nums'] },
  luckTotal: { fontWeight: '800', fontSize: 14 },
  pos: { color: '#7fd49a' },
  neg: { color: colors.danger },
});
