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
import { CardScanner } from '../scan/CardScanner';
import { useScanSettings } from '../scan/scanSettings';
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
          <Text style={styles.note}>Firebase isn't configured yet.</Text>
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

type EntryMode = 'choose' | 'host' | 'join';

function EntryStage() {
  const goHome = useNight((s) => s.go);
  const host = useOnline((s) => s.host);
  const join = useOnline((s) => s.join);
  const busy = useOnline((s) => s.busy);
  const error = useOnline((s) => s.error);
  const clearError = useOnline((s) => s.clearError);
  const savedName = useOnline((s) => s.myName);
  const [mode, setMode] = useState<EntryMode>('choose');
  const [name, setName] = useState(savedName ?? '');
  const [code, setCode] = useState('');

  const nameOk = name.trim().length > 0;

  if (mode === 'choose') {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Run-Good table 🎲</Text>
        <Text style={styles.subtitle}>
          The dealer runs the table from their laptop or a spare device — enters the flop/turn/river
          and marks folds. Each player joins from their own phone and enters their hole cards.
        </Text>

        <BigButton label="🎯 I'm the dealer" onPress={() => setMode('host')} />
        <View style={{ height: 12 }} />
        <BigButton label="🃏 I'm a player" variant="ghost" onPress={() => setMode('join')} />

        <View style={{ height: 18 }} />
        <BigButton label="Back" variant="ghost" onPress={() => goHome('home')} />
      </ScrollView>
    );
  }

  if (mode === 'host') {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Host a table 🎯</Text>
        <Text style={styles.subtitle}>
          You'll run the table but not play. Share the code with the players so they can join from
          their phones.
        </Text>

        <Panel title="Your name (as dealer)">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cameron"
            placeholderTextColor={colors.faint}
            style={styles.input}
            maxLength={14}
          />
        </Panel>

        <View style={{ height: 14 }} />
        <BigButton label="Create a table" onPress={() => void host(name)} disabled={!nameOk || busy} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <Text style={styles.note}>Connecting…</Text> : null}

        <View style={{ height: 18 }} />
        <BigButton
          label="Back"
          variant="ghost"
          onPress={() => {
            clearError();
            setMode('choose');
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Join a table 🃏</Text>
      <Text style={styles.subtitle}>Ask the dealer for the 4-digit code.</Text>

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

      <View style={{ height: 12 }} />

      <Panel title="Table code">
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
        onPress={() => void join(code, name)}
        disabled={!nameOk || code.trim().length !== 4 || busy}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <Text style={styles.note}>Connecting…</Text> : null}

      <View style={{ height: 18 }} />
      <BigButton
        label="Back"
        variant="ghost"
        onPress={() => {
          clearError();
          setMode('choose');
        }}
      />
    </ScrollView>
  );
}

/* ---------------------------------- lobby --------------------------------- */

function LobbyStage() {
  const game = useOnline((s) => s.game);
  const role = useOnline((s) => s.role);
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

  const isHost = role === 'host';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Table lobby</Text>
      <Text style={styles.subtitle}>Tell everyone the code:</Text>
      <Text style={styles.code}>{game.code}</Text>

      <Panel title="Dealer">
        <View style={styles.playerRow}>
          <Text style={styles.playerName}>
            🎯 {game.host.name}
            {isHost ? ' (you)' : ''}
          </Text>
        </View>
      </Panel>

      <View style={{ height: 12 }} />

      <Panel title={`Players (${game.players.length})`}>
        {game.players.length === 0 ? (
          <Text style={styles.note}>Waiting for players to join…</Text>
        ) : (
          game.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Text style={styles.playerName}>
                {p.name}
                {p.id === myPlayerId ? ' (you)' : ''}
              </Text>
            </View>
          ))
        )}
      </Panel>

      <View style={{ height: 18 }} />
      {isHost ? (
        <>
          <BigButton
            label="Everyone's in — start the night 🃏"
            onPress={() => void startNight()}
            disabled={busy || game.players.length < 1}
          />
          {game.players.length < 1 ? (
            <Text style={styles.note}>Waiting for at least one player to join…</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.note}>Waiting for the dealer to start the night…</Text>
      )}
      <View style={{ height: 10 }} />
      <BigButton label="Leave table" variant="ghost" onPress={() => setConfirmLeave(true)} />

      <ConfirmSheet
        visible={confirmLeave}
        message={
          isHost
            ? 'Leave this table? Nobody else can start the night without a dealer.'
            : 'Leave this table?'
        }
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
  const role = useOnline((s) => s.role);
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
  const [holeScan, setHoleScan] = useState(false);
  const [holeInitial, setHoleInitial] = useState<Card[] | undefined>(undefined);
  const [boardPicker, setBoardPicker] = useState(false);
  const [boardScan, setBoardScan] = useState(false);
  const [boardInitial, setBoardInitial] = useState<Card[] | undefined>(undefined);
  const [foldTarget, setFoldTarget] = useState<string | null>(null);
  const [unfoldTarget, setUnfoldTarget] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const canScan = !!useScanSettings((s) => s.apiKey);

  const nameOf = (id: string) => game?.players.find((p) => p.id === id)?.name ?? id;

  if (!game || !hand) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>Connecting to the table…</Text>
      </View>
    );
  }

  const isHost = role === 'host';
  const street = streetForBoard(hand.board);
  const phaseLabel =
    hand.phase === 'deal' ? 'dealing' : hand.phase === 'recap' ? 'recap' : STREET_LABEL[street];
  const dealtPlayers = hand.dealtIn.map((id) => ({ id, name: nameOf(id) }));
  const amDealtIn = !isHost && !!myPlayerId && hand.dealtIn.includes(myPlayerId);
  const allIn = dealtPlayers.length >= 1 && dealtPlayers.every((p) => hand.entered[p.id]);
  const nextStreetLabel =
    hand.board.length === 0 ? 'flop' : hand.board.length === 3 ? 'turn' : 'river';

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => setConfirmLeave(true)} hitSlop={10}>
        <Text style={styles.headerLink}>Leave</Text>
      </Pressable>
      <Text style={styles.headerTitle}>
        #{game.code} · Hand {hand.handNo}{' '}
        <Text style={styles.headerPhase}>· {phaseLabel}</Text>
        {isHost ? <Text style={styles.headerRole}>  · dealer</Text> : null}
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
            <Panel title={`Hand #${hand.handNo} — waiting on each player's cards`}>
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

            {isHost ? (
              <>
                <Text style={styles.note}>
                  You're the dealer — players enter their own cards on their phones.
                </Text>
                {allIn ? (
                  <>
                    <View style={{ height: 10 }} />
                    <BigButton label="Start hand ▶" onPress={() => void beginPlay()} />
                  </>
                ) : null}
              </>
            ) : !amDealtIn ? (
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
                <BigButton
                  label="Re-enter my cards"
                  variant="ghost"
                  onPress={() => setHolePicker(true)}
                />
                <Text style={styles.note}>Waiting for the dealer to start the hand…</Text>
              </>
            ) : canScan ? (
              <>
                <BigButton
                  label="📷 Scan my cards"
                  onPress={() => setHoleScan(true)}
                  disabled={busy}
                />
                <View style={{ height: 10 }} />
                <BigButton
                  label="Type them in"
                  variant="ghost"
                  onPress={() => setHolePicker(true)}
                />
              </>
            ) : (
              <BigButton
                label="Enter my cards 🂠"
                onPress={() => setHolePicker(true)}
                disabled={busy}
              />
            )}
          </>
        ) : null}

        {hand.phase === 'play' ? (
          <>
            {!isHost && myHole?.handNo === hand.handNo ? (
              <Panel title="Your cards">
                <View style={styles.myCards}>
                  <CardView card={myHole.cards[0]} size="md" />
                  <CardView card={myHole.cards[1]} size="md" />
                </View>
              </Panel>
            ) : null}
            {!isHost ? <View style={{ height: 14 }} /> : null}

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
              {isHost ? (
                hand.board.length < 5 ? (
                  canScan ? (
                    <>
                      <BigButton
                        label={`📷 Scan the ${nextStreetLabel}`}
                        onPress={() => setBoardScan(true)}
                      />
                      <View style={{ height: 10 }} />
                      <BigButton
                        label="Type it in"
                        variant="ghost"
                        onPress={() => setBoardPicker(true)}
                      />
                    </>
                  ) : (
                    <BigButton
                      label={`Enter the ${nextStreetLabel}`}
                      onPress={() => setBoardPicker(true)}
                    />
                  )
                ) : (
                  <BigButton
                    label="Showdown 🏁"
                    onPress={() => void showdown()}
                    disabled={busy}
                  />
                )
              ) : (
                <Text style={styles.note}>
                  {hand.board.length < 5
                    ? `Waiting for the dealer to enter the ${nextStreetLabel}…`
                    : 'Waiting for the dealer to run showdown…'}
                </Text>
              )}
            </Panel>
            <View style={{ height: 14 }} />

            <Panel title="Players">
              {dealtPlayers
                .filter((p) => hand.entered[p.id])
                .map((p) => {
                  const foldedStreet = hand.foldedOn[p.id];
                  return (
                    <View key={p.id} style={styles.playerRow}>
                      <Text
                        style={[styles.playerName, { flex: 1 }, foldedStreet && styles.dim]}
                        numberOfLines={1}
                      >
                        {p.name}
                        {p.id === myPlayerId ? ' (you)' : ''}
                      </Text>
                      <Text
                        style={[
                          styles.playerStatus,
                          foldedStreet ? styles.dim : styles.statusIn,
                          { marginRight: isHost ? 10 : 0 },
                        ]}
                      >
                        {foldedStreet ? foldLabel(foldedStreet) : 'in the hand'}
                      </Text>
                      {isHost ? (
                        <Pressable
                          onPress={() =>
                            foldedStreet ? setUnfoldTarget(p.id) : setFoldTarget(p.id)
                          }
                          style={[
                            styles.foldBtn,
                            foldedStreet ? styles.unfoldBtn : styles.foldBtnActive,
                          ]}
                        >
                          <Text
                            style={
                              foldedStreet ? styles.unfoldBtnText : styles.foldBtnText
                            }
                          >
                            {foldedStreet ? 'Un-fold' : 'Fold'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
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
              {isHost ? (
                <BigButton label="Deal the next hand ▶" onPress={() => void nextHand()} />
              ) : (
                <Text style={styles.note}>Waiting for the dealer to move on…</Text>
              )}
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
              {isHost ? (
                <BigButton label="Deal the next hand ▶" onPress={() => void nextHand()} />
              ) : (
                <Text style={styles.note}>Waiting for the dealer to deal the next hand…</Text>
              )}
              <View style={{ height: 10 }} />
              <BigButton
                label="Leaderboard"
                variant="ghost"
                onPress={() => goStage('leaderboard')}
              />
            </RecapView>
          ) : (
            <Text style={styles.note}>Finishing the hand…</Text>
          )
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {holePicker && !isHost && myPlayerId ? (
        <CardPicker
          title="Your hole cards"
          subtitle="Only your phone sees these until the hand ends"
          count={2}
          blocked={new Set(hand.board)}
          initial={holeInitial}
          onDone={(cards) => {
            void enterMyCards([cards[0], cards[1]]);
            setHolePicker(false);
            setHoleInitial(undefined);
          }}
          onCancel={() => {
            setHolePicker(false);
            setHoleInitial(undefined);
          }}
        />
      ) : null}

      {holeScan && !isHost && myPlayerId ? (
        <CardScanner
          title="Scan your hole cards"
          count={2}
          validate={(cards) =>
            cards.some((c) => hand.board.includes(c))
              ? 'That card is on the board — retake or fix by hand.'
              : null
          }
          onDone={(cards) => {
            void enterMyCards([cards[0], cards[1]]);
            setHoleScan(false);
          }}
          onCancel={() => setHoleScan(false)}
          onManual={(initial) => {
            setHoleScan(false);
            setHoleInitial(initial);
            setHolePicker(true);
          }}
        />
      ) : null}

      {boardPicker && isHost ? (
        <CardPicker
          title={`Enter the ${nextStreetLabel}`}
          subtitle={hand.board.length === 0 ? 'All three flop cards' : 'One card'}
          count={hand.board.length === 0 ? 3 : 1}
          blocked={new Set(hand.board)}
          initial={boardInitial}
          onDone={(cards) => {
            void addBoardCards(cards);
            setBoardPicker(false);
            setBoardInitial(undefined);
          }}
          onCancel={() => {
            setBoardPicker(false);
            setBoardInitial(undefined);
          }}
        />
      ) : null}

      {boardScan && isHost ? (
        <CardScanner
          title={`Scan the ${nextStreetLabel}`}
          count={hand.board.length === 0 ? 3 : 1}
          validate={(cards) =>
            cards.some((c) => hand.board.includes(c))
              ? 'That card is already on the board — retake or fix by hand.'
              : null
          }
          onDone={(cards) => {
            void addBoardCards(cards);
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
        message={
          isHost
            ? 'Leave this table? Nobody else can drive the hand without a dealer.'
            : 'Leave this table? You can rejoin with the code and your name.'
        }
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
      <LeaderboardView rows={rows} handCount={completedHands.filter((h) => h.analysis).length}>
        <View style={{ height: 24 }} />
        <BigButton label="Back to the table" onPress={() => goStage('hand')} />
      </LeaderboardView>
    </ScrollView>
  );
}

/* --------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  scroll: { padding: 20, paddingTop: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: colors.cream, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 18, lineHeight: 20 },
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
  headerRole: { color: colors.faint, fontWeight: '600' },
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
  foldBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 74,
    alignItems: 'center',
  },
  foldBtnActive: { borderColor: colors.danger, backgroundColor: 'rgba(220, 92, 92, 0.12)' },
  foldBtnText: { color: colors.danger, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  unfoldBtn: { borderColor: colors.line, backgroundColor: 'transparent' },
  unfoldBtnText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
