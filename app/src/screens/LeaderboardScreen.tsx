import { cardPretty } from '@run-good/engine';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton, ConfirmSheet, Panel } from '../components/ui';
import { fmtLuck } from '../format';
import { leaderboardRows, useNight, type LeaderRow } from '../store';
import { colors } from '../theme';
import type { RevealDelta } from '@run-good/engine';

function describeDelta(d: RevealDelta, name: string): string {
  const cards = d.revealedCards.map(cardPretty).join(' ');
  return `${name} ${fmtLuck(d.delta)} on the ${d.street} (${cards}) — hand #${d.handNo}`;
}

export function LeaderboardScreen() {
  const roster = useNight((s) => s.roster);
  const aggregates = useNight((s) => s.aggregates);
  const hands = useNight((s) => s.hands);
  const go = useNight((s) => s.go);
  const resetNight = useNight((s) => s.resetNight);
  const [confirmNew, setConfirmNew] = useState(false);

  const rows = leaderboardRows(roster, aggregates);
  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? id;

  let suckout: RevealDelta | undefined;
  let beat: RevealDelta | undefined;
  for (const r of rows) {
    if (r.biggestSuckout && (!suckout || r.biggestSuckout.delta > suckout.delta)) suckout = r.biggestSuckout;
    if (r.worstBeat && (!beat || r.worstBeat.delta < beat.delta)) beat = r.worstBeat;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Luck leaderboard</Text>
      <Text style={styles.subtitle}>
        {hands.length} {hands.length === 1 ? 'hand' : 'hands'} played
      </Text>

      {hands.length === 0 ? (
        <Panel>
          <Text style={styles.empty}>No hands recorded yet — deal one and come back.</Text>
        </Panel>
      ) : (
        <Panel>
          <View style={styles.headRow}>
            <Text style={[styles.headCell, { flex: 2.2, textAlign: 'left' }]}>Player</Text>
            <Text style={styles.headCell}>Dealt</Text>
            <Text style={styles.headCell}>Runout</Text>
            <Text style={styles.headCell}>Total</Text>
          </View>
          {rows.map((r: LeaderRow, i: number) => (
            <View key={r.playerId} style={[styles.row, i === 0 && styles.rowFirst]}>
              <View style={{ flex: 2.2 }}>
                <Text style={styles.name}>
                  {i + 1}. {r.name}
                  {i === 0 ? ' 🔥' : i === rows.length - 1 ? ' 🧊' : ''}
                </Text>
                <Text style={styles.nameSub}>
                  won {r.handsWon} · dealt in {r.handsDealt}
                  {r.foldedEventualWinner > 0 ? ` · folded winner ×${r.foldedEventualWinner}` : ''}
                </Text>
              </View>
              <Text style={styles.cell}>{fmtLuck(r.dealtLuck)}</Text>
              <Text style={styles.cell}>{fmtLuck(r.runoutLuck)}</Text>
              <Text style={[styles.cell, styles.total, r.totalLuck >= 0 ? styles.pos : styles.neg]}>
                {fmtLuck(r.totalLuck)}
              </Text>
            </View>
          ))}
        </Panel>
      )}

      {suckout || beat ? (
        <>
          <View style={{ height: 14 }} />
          <Panel title="Night highlights">
            {suckout ? (
              <Text style={styles.highlight}>💥 Biggest suckout: {describeDelta(suckout, nameOf(suckout.playerId))}</Text>
            ) : null}
            {beat ? (
              <Text style={styles.highlight}>🥀 Worst beat: {describeDelta(beat, nameOf(beat.playerId))}</Text>
            ) : null}
          </Panel>
        </>
      ) : null}

      <View style={{ height: 24 }} />
      <BigButton label="Back to the night" onPress={() => go('hand')} />
      <View style={{ height: 10 }} />
      <BigButton label="New night" variant="ghost" onPress={() => setConfirmNew(true)} />

      <ConfirmSheet
        visible={confirmNew}
        message="Start a fresh night? Tonight's hands and leaderboard will be cleared."
        confirmLabel="Clear and start over"
        danger
        onConfirm={() => {
          setConfirmNew(false);
          resetNight();
          go('setup');
        }}
        onCancel={() => setConfirmNew(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: colors.cream, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 18 },
  empty: { color: colors.muted, fontSize: 15, textAlign: 'center', paddingVertical: 10 },
  headRow: { flexDirection: 'row', paddingBottom: 8 },
  headCell: {
    flex: 1,
    color: colors.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowFirst: { borderTopWidth: 0 },
  name: { color: colors.cream, fontSize: 16, fontWeight: '700' },
  nameSub: { color: colors.faint, fontSize: 12, marginTop: 2 },
  cell: { flex: 1, color: colors.muted, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
  total: { fontWeight: '800', fontSize: 15 },
  pos: { color: '#7fd49a' },
  neg: { color: colors.danger },
  highlight: { color: colors.cream, fontSize: 14, lineHeight: 22 },
});
