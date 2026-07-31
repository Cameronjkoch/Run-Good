import {
  CATEGORY_NAMES,
  categoryOf,
  evaluate7,
  type Card,
  type HandAnalysis,
  type Street,
} from '@run-good/engine';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmtLuck, foldLabel } from '../format';
import { colors } from '../theme';
import { CardView } from './CardView';
import { Panel } from './ui';

export interface RecapPlayer {
  playerId: string;
  hole?: [Card, Card];
  foldedOn?: Street;
}

/** Presentational hand recap, shared by single-phone and multi-phone modes. */
export function RecapView({
  analysis,
  players,
  board,
  nameOf,
  children,
}: {
  analysis: HandAnalysis;
  players: RecapPlayer[];
  board: Card[];
  nameOf: (id: string) => string;
  children?: ReactNode;
}) {
  const winnerNames = analysis.winners.map(nameOf).join(' & ');
  const runoutFor = (id: string) =>
    analysis.deltas.filter((d) => d.playerId === id).reduce((s, d) => s + d.delta, 0);

  return (
    <View>
      <View style={styles.winnerBanner}>
        <Text style={styles.winnerText}>
          🏆 {winnerNames || 'Nobody'} win{analysis.winners.length === 1 ? 's' : ''} hand #
          {analysis.handNo}
        </Text>
        {!analysis.showdown ? (
          <Text style={styles.winnerSub}>no showdown — cards stay hidden</Text>
        ) : null}
      </View>

      {analysis.showdown ? (
        <Panel title="Showdown">
          {players.map((p) => {
            if (!p.hole) return null;
            const won = analysis.winners.includes(p.playerId);
            const label = p.foldedOn
              ? foldLabel(p.foldedOn)
              : CATEGORY_NAMES[categoryOf(evaluate7([...p.hole, ...board] as Card[]))];
            return (
              <View key={p.playerId} style={styles.revealRow}>
                <Text style={[styles.playerName, { flex: 1 }, p.foldedOn && styles.dim]}>
                  {won ? '⭐ ' : ''}
                  {nameOf(p.playerId)}
                </Text>
                <View style={styles.revealCards}>
                  <CardView card={p.hole[0]} size="sm" />
                  <CardView card={p.hole[1]} size="sm" />
                </View>
                <Text style={[styles.revealLabel, p.foldedOn && styles.dim]}>{label}</Text>
              </View>
            );
          })}
          <View style={styles.boardRowSmall}>
            {board.map((c) => (
              <CardView key={c} card={c} size="sm" />
            ))}
          </View>
        </Panel>
      ) : null}

      {analysis.foldedEventualWinners.length > 0 ? (
        <>
          <View style={{ height: 14 }} />
          <Panel>
            {analysis.foldedEventualWinners.map((id) => (
              <Text key={id} style={styles.gasp}>
                😱 {nameOf(id)} folded the eventual winner!
              </Text>
            ))}
          </Panel>
        </>
      ) : null}

      <View style={{ height: 14 }} />
      <Panel title="Luck this hand">
        {players.map((p) => {
          const dealt = analysis.dealtLuck[p.playerId] ?? 0;
          const runout = runoutFor(p.playerId);
          const total = dealt + runout;
          return (
            <View key={p.playerId} style={styles.luckRow}>
              <Text style={[styles.playerName, { flex: 1.6 }]}>{nameOf(p.playerId)}</Text>
              <Text style={styles.luckCell}>dealt {fmtLuck(dealt)}</Text>
              <Text style={styles.luckCell}>runout {fmtLuck(runout)}</Text>
              <Text
                style={[styles.luckCell, styles.luckTotal, total >= 0 ? styles.pos : styles.neg]}
              >
                {fmtLuck(total)}
              </Text>
            </View>
          );
        })}
      </Panel>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  winnerBanner: { alignItems: 'center', marginBottom: 16 },
  winnerText: { color: colors.gold, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  winnerSub: { color: colors.muted, fontSize: 13, marginTop: 6 },
  playerName: { color: colors.cream, fontSize: 17, fontWeight: '700' },
  dim: { opacity: 0.45 },
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
  boardRowSmall: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  gasp: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 4,
  },
  luckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 6,
  },
  luckCell: {
    color: colors.muted,
    fontSize: 12.5,
    textAlign: 'right',
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  luckTotal: { fontWeight: '800', fontSize: 14 },
  pos: { color: '#7fd49a' },
  neg: { color: colors.danger },
});
