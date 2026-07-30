import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BigButton, ConfirmSheet } from '../components/ui';
import { useNight } from '../store';
import { colors } from '../theme';

export function HomeScreen() {
  const roster = useNight((s) => s.roster);
  const hands = useNight((s) => s.hands);
  const current = useNight((s) => s.current);
  const go = useNight((s) => s.go);
  const resetNight = useNight((s) => s.resetNight);
  const [confirmNew, setConfirmNew] = useState(false);

  const hasNight = roster.length > 0;
  const resumeLabel =
    current && current.phase !== 'recap' ? `Resume hand #${current.handNo}` : 'Deal the next hand';

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.logo}>🃏</Text>
        <Text style={styles.title}>RUN-GOOD</Text>
        <Text style={styles.tagline}>who ran hottest tonight?</Text>
      </View>

      <View style={styles.actions}>
        {hasNight ? (
          <>
            <Text style={styles.nightNote}>
              Night in progress — {roster.length} players, {hands.length}{' '}
              {hands.length === 1 ? 'hand' : 'hands'} played
            </Text>
            <BigButton label={resumeLabel} onPress={() => go('hand')} />
            <View style={{ height: 12 }} />
            <BigButton label="Leaderboard" variant="ghost" onPress={() => go('leaderboard')} />
            <View style={{ height: 12 }} />
            <BigButton label="New night" variant="ghost" onPress={() => setConfirmNew(true)} />
          </>
        ) : (
          <BigButton label="Start a night" onPress={() => go('setup')} />
        )}
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { color: colors.gold, fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  tagline: { color: colors.muted, fontSize: 15, marginTop: 8, fontStyle: 'italic' },
  actions: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  nightNote: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: 16 },
});
