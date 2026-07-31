import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { LeaderboardView } from '../components/LeaderboardView';
import { BigButton, ConfirmSheet } from '../components/ui';
import { leaderboardRows, useNight } from '../store';

export function LeaderboardScreen() {
  const roster = useNight((s) => s.roster);
  const aggregates = useNight((s) => s.aggregates);
  const hands = useNight((s) => s.hands);
  const go = useNight((s) => s.go);
  const resetNight = useNight((s) => s.resetNight);
  const [confirmNew, setConfirmNew] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <LeaderboardView rows={leaderboardRows(roster, aggregates)} handCount={hands.length}>
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
      </LeaderboardView>
      <BigButton label="Back to the night" onPress={() => go('hand')} />
      <BigButton label="New night" variant="ghost" onPress={() => setConfirmNew(true)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, maxWidth: 520, width: '100%', alignSelf: 'center', gap: 10 },
});
