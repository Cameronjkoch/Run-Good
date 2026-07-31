import { StyleSheet, Text, View } from 'react-native';
import { BigButton } from '../components/ui';
import { useNight } from '../store';
import { colors } from '../theme';

export function HomeScreen() {
  const go = useNight((s) => s.go);

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.logo}>🃏</Text>
        <Text style={styles.title}>RUN-GOOD</Text>
        <Text style={styles.tagline}>who ran hottest tonight?</Text>
      </View>

      <View style={styles.actions}>
        <BigButton label="Start a table 🎲" onPress={() => go('online')} />
        <View style={{ height: 12 }} />
        <BigButton label="Camera scan settings 📷" variant="ghost" onPress={() => go('scan-setup')} />
      </View>
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
});
