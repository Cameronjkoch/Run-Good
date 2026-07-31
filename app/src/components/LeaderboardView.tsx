import { cardPretty, type RevealDelta } from '@run-good/engine';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmtLuck } from '../format';
import type { LeaderRow } from '../store';
import { colors } from '../theme';
import { Panel } from './ui';

function describeDelta(d: RevealDelta, name: string): string {
  const cards = d.revealedCards.map(cardPretty).join(' ');
  return `${name} ${fmtLuck(d.delta)} on the ${d.street} (${cards}) — hand #${d.handNo}`;
}

/** Presentational luck leaderboard, shared by single-phone and multi-phone modes. */
export function LeaderboardView({
  rows,
  handCount,
  children,
}: {
  rows: LeaderRow[];
  handCount: number;
  children?: ReactNode;
}) {
  const nameOf = (id: string) => rows.find((r) => r.playerId === id)?.name ?? id;

  let suckout: RevealDelta | undefined;
  let beat: RevealDelta | undefined;
  for (const r of rows) {
    if (r.biggestSuckout && (!suckout || r.biggestSuckout.delta > suckout.delta)) {
      suckout = r.biggestSuckout;
    }
    if (r.worstBeat && (!beat || r.worstBeat.delta < beat.delta)) beat = r.worstBeat;
  }

  return (
    <View>
      <Text style={styles.title}>Luck leaderboard</Text>
      <Text style={styles.subtitle}>
        {handCount} {handCount === 1 ? 'hand' : 'hands'} played
      </Text>

      {handCount === 0 ? (
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
          {rows.map((r, i) => (
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
              <Text style={styles.highlight}>
                💥 Biggest suckout: {describeDelta(suckout, nameOf(suckout.playerId))}
              </Text>
            ) : null}
            {beat ? (
              <Text style={styles.highlight}>
                🥀 Worst beat: {describeDelta(beat, nameOf(beat.playerId))}
              </Text>
            ) : null}
          </Panel>
        </>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
  cell: {
    flex: 1,
    color: colors.muted,
    fontSize: 14,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  total: { fontWeight: '800', fontSize: 15 },
  pos: { color: '#7fd49a' },
  neg: { color: colors.danger },
  highlight: { color: colors.cream, fontSize: 14, lineHeight: 22 },
});
