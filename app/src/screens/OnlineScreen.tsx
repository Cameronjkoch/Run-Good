import type { Card } from '@run-good/engine';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { mergeAnalysis, type Aggregate } from '../aggregate';
import { CardPicker } from '../components/CardPicker';
import { CardSlot, CardView } from '../components/CardView';
import { LeaderboardView } from '../components/LeaderboardView';
import { RecapView } from '../components/RecapView';
import { BigButton, ConfirmSheet, Panel } from '../components/ui';
import { foldLabel, STREET_LABEL } from '../format';
import { isFirebaseConfigured } from '../online/firebase';
import { useOnline } from '../online/onlineStore';
import { leaderboardRows, streetForBoard, useNight, type LeaderRow } from '../store';
import { colors } from '../theme';

export function OnlineScreen() {
  const stage = useOnline((s) => s.stage);
  const gameId = useOnline((s) => s.gameId);
  const reconnect = useOnline((s) => s.reconnect);
  const goHome = useNight((s) => s.go);

  useEffect(() => {
    if (gameId) void reconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isFirebaseConfigured()) {
    return (
      <View style={styles.center}>
        <Panel title="Multi-phone mode">
          <Text style={styles.note}>
            Not wired up yet — the Firebase config hasn't been added. Single-phone mode still works
            from the home screen.
          </Text>
        </Panel>
        <View style={{ height: 16 }} />
        <BigButton label="Back" variant="ghost" onPress={() => goHome('home')} />
      </View>
    );
  }

  if (stage === 'entry') return <EntryStage />;
  if (stage === 'lobby') return <LobbyStage />;
  if (stage === 'leaderboard') return <LeaderboardStage />;
  return <HandStage />;
}

/* ---------------------------------- entry --------------------------------- */

function EntryStage() {
  const goHome = useNight((s) => s.go);
  const host = useOnline((s) => s.host);
  const join = useOnline((s) => s.join);
  const busy = useOnline((s) => s.busy);
  const error = useOnline((s) => s.error);
  const savedName = useOnline((s) => s.myName);
  const [name, setName] = useState(savedName ?? '');
  const [code, setCode] = useState('');

  const nameOk = name.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Multi-phone table 📡</Text>
      <Text style={styles.subtitle}>
        Everyone runs Run-Good on their own phone. One person hosts, the rest join with the code.
      </Text>

      <Panel title="Your name">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.faint}
          style={styles.input}
          maxLength={14}
        />
      </Panel>

      <View style={{ height: 14 }} />
      <BigButton label="Host a new table" onPress={() => void host(name)} disabled={!nameOk || busy} />

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Panel title="Join with a code">
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="4-digit code"
          placeholderTextColor={colors.faint}
          style={styles.input}
          keyboardType="number-pad"
          maxLength={4}
        />
      </Panel>
      <View style={{ height: 14 }} />
      <BigButton
        label="Join table"
        variant="ghost"
        onPress={() => void join(code, name)}
        disabled={!nameOk || code.trim().length !== 4 || busy}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <Text style={styles.note}>Connecting…</Text> : null}

      <View style={{ height: 18 }} />
      <BigButton label="Back" variant="ghost" onPress={() => goHome('home')} />
    </ScrollView>
  );
}

/* ---------------------------------- lobby --------------------------------- */

function LobbyStage() {
  const game = useOnline((s) => s.game);
  const myPlayerId = useOnline((s) => s.myPlayerId);
  const startNight = useOnline((s) => s.startNight);
  const busy = useOnline((s) => s.busy);
  const leave = useOnline((s) => s.leave);
  const goHome = useNight((s) => s.go);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!game) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>Connecting to the table…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Table lobby</Text>
      <Text style={styles.subtitle}>Tell everyone the code:</Text>
      <Text style={styles.code}>{game.code}</Text>

      <Panel title={`Players (${game.players.length})`}>
        {game.players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <Text style={styles.playerName}>
              {p.name}
              {p.id === myPlayerId ? ' (you)' : ''}
            </Text>
          </View>
        ))}
      </Panel>

      <View style={{ height: 18 }} />
      <BigButton
        label="Everyone's in — start the night 🃏"
        onPress={() => void startNight()}
        disabled={busy || game.players.length < 2}
      />
      {game.players.length < 2 ? (
        <Text style={styles.note}>Waiting for at least one more player…</Text>
      ) : null}
      <View style={{ height: 10 }} />
      <BigButton label="Leave table" variant="ghost" onPress={() => setConfirmLeave(true)} />

      <ConfirmSheet
        visible={confirmLeave}
        message="Leave this table?"
        confirmLabel="Leave"
        danger
        onConfirm={() => {
          setConfirmLeave(false);
          leave();
          goHome('home');
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </ScrollView>
  );
}

/* ---------------------------------- hand ---------------------------------- */

function HandStage() {
  const game = useOnline((s) => s.game);
  const hand = useOnline((s) => s.hand);
  const myPlayerId = useOnline((s) => s.myPlayerId);
  const myHole = useOnline((s) => s.myHole);
  const enterMyCards = useOnline((s) => s.enterMyCards);
  const beginPlay = useOnline((s) => s.beginPlay);
  const fold = useOnline((s) => s.fold);
  const unfold = useOnline((s) => s.unfold);
  const addBoardCards = useOnline((s) => s.addBoardCards);
  const showdown = useOnline((s) => s.showdown);
  const nextHand = useOnline((s) => s.nextHand);
  const goStage = useOnline((s) => s.goStage);
  const leave = useOnline((s) => s.leave);
  const busy = useOnline((s) => s.busy);
  const error = useOnline((s) => s.error);
  const goHome = useNight((s) => s.go);

  const [holePicker, setHolePicker] = useState(false);
  const [boardPicker, setBoardPicker] = useState(false);
  const [foldTarget, setFoldTarget] = useState<string | null>(null);
  const [unfoldTarget, setUnfoldTarget] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const nameOf = (id: string) => game?.players.find((p) => p.id === id)?.name ?? id;

  if (!game || !hand) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>Connecting to the table…</Text>
      </View>
    );
  }

  const street = streetForBoard(hand.board);
  const phaseLabel =
    hand.phase === 'deal' ? 'dealing' : hand.phase === 'recap' ? 'recap' : STREET_LABEL[street];
  const dealtPlayers = hand.dealtIn.map((id) => ({ id, name: nameOf(id) }));
  const amDealtIn = !!myPlayerId && hand.dealtIn.includes(myPlayerId);
  const myCardsIn = !!myPlayerId && !!hand.entered[myPlayerId];
  const allIn = dealtPlayers.length >= 2 && dealtPlayers.every((p) => hand.entered[p.id]);
  const nextStreetLabel =
    hand.board.length === 0 ? 'flop' : hand.board.length === 3 ? 'turn' : 'river';

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => setConfirmLeave(true)} hitSlop={10}>
        <Text style={styles.headerLink}>Leave</Text>
      </Pressable>
      <Text style={styles.headerTitle}>
        #{game.code} · Hand {hand.handNo} <Text style={styles.headerPhase}>· {phaseLabel}</Text>
      </Text>
      <Pressable onPress={() => goStage('leaderboard')} hitSlop={10}>
        <Text style={styles.headerLink}>Board</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        {hand.phase === 'deal' ? (
          <>
            <Panel title={`Hand #${hand.handNo} — everyone enters their own cards`}>
              {dealtPlayers.map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  <Text style={styles.playerName}>
                    {p.name}
                    {p.id === myPlayerId ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.playerStatus, hand.entered[p.id] && styles.statusIn]}>
                    {hand.entered[p.id] ? '✓ cards in' : 'waiting…'}
                  </Text>
                </View>
              ))}
            </Panel>
            <View style={{ height: 16 }} />
            {!amDealtIn ? (
              <Text style={styles.note}>You joined mid-hand — you're in from the next deal.</Text>
            ) : myHole?.handNo === hand.handNo ? (
              <>
                <Panel title="Your cards (only you can see this)">
                  <View style={styles.myCards}>
                    <CardView card={myHole.cards[0]} size="lg" />
                    <CardView card={myHole.cards[1]} size="lg" />
                  </View>
                </Panel>
                <View style={{ height: 10 }} />
                <BigButton label="Re-enter my cards" variant="ghost" onPress={() => setHolePicker(true)} />
              </>
            ) : (
              <BigButton label="Enter my cards 🂠" onPress={() => setHolePicker(true)} disabled={busy} />
            )}
            <View style={{ height: 10 }} />
            {allIn ? <BigButton label="Start hand ▶" onPress={() => void beginPlay()} /> : null}
          </>
        ) : null}

        {hand.phase === 'play' ? (
          <>
            {myHole?.handNo === hand.handNo ? (
              <Panel title="Your cards">
                <View style={styles.myCards}>
                  <CardView card={myHole.cards[0]} size="md" />
                  <CardView card={myHole.cards[1]} size="md" />
                </View>
              </Panel>
            ) : null}
            <View style={{ height: 14 }} />
            <Panel title={`Board — ${STREET_LABEL[street]}`}>
              <View style={styles.boardRow}>
                {hand.board.map((c) => (
                  <CardView key={c} card={c} size="md" />
                ))}
                {Array.from({ length: 5 - hand.board.length }, (_, i) => (
                  <CardSlot key={`b${i}`} size="md" />
                ))}
              </View>
              <View style={{ height: 12 }} />
              {hand.board.length < 5 ? (
                <BigButton label={`Enter the ${nextStreetLabel}`} onPress={() => setBoardPicker(true)} />
              ) : (
                <BigButton label="Showdown 🏁" onPress={() => void showdown()} disabled={busy} />
              )}
            </Panel>
            <View style={{ height: 14 }} />
            <Panel title="Players — tap when someone folds">
              {dealtPlayers
                .filter((p) => hand.entered[p.id])
                .map((p) => {
                  const foldedStreet = hand.foldedOn[p.id];
                  return (
                    <Pressable
                      key={p.id}
                      style={styles.playerRow}
                      onPress={() => (foldedStreet ? setUnfoldTarget(p.id) : setFoldTarget(p.id))}
                    >
                      <Text style={[styles.playerName, foldedStreet && styles.dim]}>
                        {p.name}
                        {p.id === myPlayerId ? ' (you)' : ''}
                      </Text>
                      <Text style={[styles.playerStatus, foldedStreet ? styles.dim : styles.statusIn]}>
                        {foldedStreet ? foldLabel(foldedStreet) : 'in the hand'}
                      </Text>
                    </Pressable>
                  );
                })}
            </Panel>
          </>
        ) : null}

        {hand.phase === 'recap' ? (
          hand.conflict && hand.conflict.length > 0 ? (
            <>
              <Panel title="Hand voided">
                <Text style={styles.error}>
                  The same card was entered twice — this hand isn't counted. Deal the next one and
                  double-check entries.
                </Text>
              </Panel>
              <View style={{ height: 16 }} />
              <BigButton label="Deal the next hand ▶" onPress={() => void nextHand()} />
            </>
          ) : hand.analysis ? (
            <RecapView
              analysis={hand.analysis}
              players={hand.dealtIn
                .filter((pid) => hand.reveal?.[pid]?.length === 2)
                .map((pid) => ({
                  playerId: pid,
                  hole: hand.reveal![pid] as [Card, Card],
                  foldedOn: hand.foldedOn[pid],
                }))}
              board={hand.board}
              nameOf={nameOf}
            >
              <View style={{ height: 20 }} />
              <BigButton label="Deal the next hand ▶" onPress={() => void nextHand()} />
              <View style={{ height: 10 }} />
              <BigButton label="Leaderboard" variant="ghost" onPress={() => goStage('leaderboard')} />
            </RecapView>
          ) : (
            <Text style={styles.note}>Finishing the hand…</Text>
          )
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {holePicker && myPlayerId ? (
        <CardPicker
          title="Your hole cards"
          subtitle="Only your phone sees these until the hand ends"
          count={2}
          blocked={new Set(hand.board)}
          onDone={(cards) => {
            void enterMyCards([cards[0], cards[1]]);
            setHolePicker(false);
          }}
          onCancel={() => setHolePicker(false)}
        />
      ) : null}

      {boardPicker ? (
        <CardPicker
          title={`Enter the ${nextStreetLabel}`}
          subtitle={hand.board.length === 0 ? 'All three flop cards' : 'One card'}
          count={hand.board.length === 0 ? 3 : 1}
          blocked={new Set([...hand.board, ...(myHole?.handNo === hand.handNo ? myHole.cards : [])])}
          onDone={(cards) => {
            void addBoardCards(cards);
            setBoardPicker(false);
          }}
          onCancel={() => setBoardPicker(false)}
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
          if (foldTarget) void fold(foldTarget);
          setFoldTarget(null);
        }}
        onCancel={() => setFoldTarget(null)}
      />
      <ConfirmSheet
        visible={!!unfoldTarget}
        message={`Un-fold ${unfoldTarget ? nameOf(unfoldTarget) : ''}? (Fat-finger fix.)`}
        confirmLabel="Un-fold"
        onConfirm={() => {
          if (unfoldTarget) void unfold(unfoldTarget);
          setUnfoldTarget(null);
        }}
        onCancel={() => setUnfoldTarget(null)}
      />
      <ConfirmSheet
        visible={confirmLeave}
        message="Leave this table? You can rejoin with the code and your name."
        confirmLabel="Leave"
        danger
        onConfirm={() => {
          setConfirmLeave(false);
          leave();
          goHome('home');
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
}

/* ------------------------------- leaderboard ------------------------------ */

function LeaderboardStage() {
  const game = useOnline((s) => s.game);
  const completedHands = useOnline((s) => s.completedHands);
  const goStage = useOnline((s) => s.goStage);

  const rows: LeaderRow[] = useMemo(() => {
    if (!game) return [];
    let aggregates: Record<string, Aggregate> = {};
    for (const h of completedHands) {
      if (h.analysis) {
        aggregates = mergeAnalysis(
          aggregates,
          h.analysis,
          h.dealtIn.filter((pid) => h.reveal?.[pid]?.length === 2),
        );
      }
    }
    return leaderboardRows(game.players, aggregates);
  }, [game, completedHands]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <LeaderboardView
        rows={rows}
        handCount={completedHands.filter((h) => h.analysis).length}
      >
        <View style={{ height: 24 }} />
        <BigButton label="Back to the table" onPress={() => goStage('hand')} />
      </LeaderboardView>
    </ScrollView>
  );
}

/* --------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  scroll: { padding: 20, paddingTop: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: colors.cream, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 18 },
  code: {
    color: colors.gold,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    marginVertical: 18,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontSize: 17,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.faint, fontSize: 13 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: { color: colors.cream, fontSize: 16, fontWeight: '800' },
  headerPhase: { color: colors.gold, fontWeight: '700' },
  headerLink: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  playerName: { color: colors.cream, fontSize: 17, fontWeight: '700' },
  playerStatus: { color: colors.faint, fontSize: 13 },
  statusIn: { color: '#7fd49a', fontWeight: '700' },
  dim: { opacity: 0.45 },
  myCards: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  boardRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  note: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 12 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: 12, fontWeight: '600' },
});
