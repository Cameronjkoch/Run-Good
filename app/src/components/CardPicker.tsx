import { RANK_CHARS, SUIT_SYMBOLS, type Card } from '@run-good/engine';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { CardSlot, CardView } from './CardView';
import { BigButton } from './ui';

const RANK_ORDER = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]; // A → 2
const rankLabel = (r: number): string => (r === 8 ? '10' : RANK_CHARS[r]);

export function CardPicker({
  title,
  subtitle,
  count,
  blocked,
  validate,
  onDone,
  onCancel,
  initial,
}: {
  title: string;
  subtitle?: string;
  count: number;
  /** Publicly-known in-play cards — greyed out in the picker. */
  blocked: ReadonlySet<Card>;
  /** Secret-conflict check run on confirm; return an error message to block. */
  validate?: (cards: Card[]) => string | null;
  onDone: (cards: Card[]) => void;
  onCancel: () => void;
  /** Pre-filled selection (e.g. from a camera scan being corrected). */
  initial?: Card[];
}) {
  const [selected, setSelected] = useState<Card[]>(initial ?? []);
  const [rank, setRank] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickSuit = (suit: number) => {
    if (rank === null || selected.length >= count) return;
    const card = suit * 13 + rank;
    if (blocked.has(card) || selected.includes(card)) return;
    setSelected([...selected, card]);
    setRank(null);
    setError(null);
  };

  const removeCard = (card: Card) => {
    setSelected(selected.filter((c) => c !== card));
    setError(null);
  };

  const confirm = () => {
    const err = validate?.(selected) ?? null;
    if (err) {
      setError(err);
      return;
    }
    onDone(selected);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.slots}>
            {selected.map((c) => (
              <Pressable key={c} onPress={() => removeCard(c)}>
                <CardView card={c} size="lg" />
              </Pressable>
            ))}
            {Array.from({ length: count - selected.length }, (_, i) => (
              <CardSlot key={`s${i}`} size="lg" />
            ))}
          </View>
          <Text style={styles.hint}>
            {selected.length < count
              ? rank === null
                ? 'Pick a rank…'
                : `Pick a suit for the ${rankLabel(rank)}`
              : 'Tap a card to remove it'}
          </Text>

          <View style={styles.rankGrid}>
            {RANK_ORDER.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setRank(r);
                  setError(null);
                }}
                disabled={selected.length >= count}
                style={[
                  styles.rankTile,
                  rank === r && styles.rankTileActive,
                  selected.length >= count && styles.tileDim,
                ]}
              >
                <Text style={[styles.rankText, rank === r && styles.rankTextActive]}>{rankLabel(r)}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.suitRow}>
            {[3, 2, 1, 0].map((s) => {
              const unavailable =
                rank === null || blocked.has(s * 13 + rank) || selected.includes(s * 13 + rank);
              const red = s === 1 || s === 2;
              return (
                <Pressable
                  key={s}
                  onPress={() => pickSuit(s)}
                  disabled={unavailable}
                  style={[styles.suitTile, unavailable && styles.tileDim]}
                >
                  <Text style={[styles.suitText, { color: red ? '#e8837a' : colors.cream }]}>
                    {SUIT_SYMBOLS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ height: 18 }} />
          <BigButton label="Confirm" onPress={confirm} disabled={selected.length !== count} />
          <View style={{ height: 10 }} />
          <BigButton label="Cancel" variant="ghost" onPress={onCancel} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.feltDark },
  scroll: { padding: 22, paddingTop: 54, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: colors.cream, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6 },
  slots: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 20 },
  hint: { color: colors.faint, fontSize: 13, textAlign: 'center', marginTop: 10 },
  rankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
  },
  rankTile: {
    width: 58,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  rankTileActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  rankText: { color: colors.cream, fontSize: 20, fontWeight: '800' },
  rankTextActive: { color: colors.goldInk },
  tileDim: { opacity: 0.3 },
  suitRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 14 },
  suitTile: {
    width: 68,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  suitText: { fontSize: 30 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: 14, fontWeight: '600' },
});
