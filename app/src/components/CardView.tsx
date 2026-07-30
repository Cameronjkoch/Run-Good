import { RANK_CHARS, rankOf, suitOf, SUIT_SYMBOLS, type Card } from '@run-good/engine';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const SIZES = {
  sm: { w: 34, h: 48, rank: 14, suit: 12, radius: 5 },
  md: { w: 46, h: 64, rank: 19, suit: 16, radius: 7 },
  lg: { w: 58, h: 82, rank: 24, suit: 20, radius: 8 },
} as const;

export type CardSize = keyof typeof SIZES;

export const displayRank = (card: Card): string => {
  const r = rankOf(card);
  return r === 8 ? '10' : RANK_CHARS[r];
};

export function CardView({ card, size = 'md' }: { card: Card; size?: CardSize }) {
  const s = SIZES[size];
  const suit = suitOf(card);
  const color = suit === 1 || suit === 2 ? colors.inkRed : colors.inkBlack;
  return (
    <View style={[styles.card, { width: s.w, height: s.h, borderRadius: s.radius }]}>
      <Text style={{ color, fontSize: s.rank, fontWeight: '800', lineHeight: s.rank + 3 }}>
        {displayRank(card)}
      </Text>
      <Text style={{ color, fontSize: s.suit, lineHeight: s.suit + 3 }}>{SUIT_SYMBOLS[suit]}</Text>
    </View>
  );
}

export function CardSlot({ size = 'md' }: { size?: CardSize }) {
  const s = SIZES[size];
  return <View style={[styles.slot, { width: s.w, height: s.h, borderRadius: s.radius }]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardFace,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  slot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
