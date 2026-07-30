import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BigButton } from '../components/ui';
import { useNight } from '../store';
import { colors } from '../theme';

const MAX_PLAYERS = 9;

export function SetupScreen() {
  const go = useNight((s) => s.go);
  const newNight = useNight((s) => s.newNight);
  const [names, setNames] = useState<string[]>(['', '', '', '']);

  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0);
  const unique = new Set(clean.map((n) => n.toLowerCase())).size === clean.length;
  const ready = clean.length >= 2 && unique;

  const setName = (i: number, v: string) =>
    setNames(names.map((n, j) => (j === i ? v : n)));

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Who's playing?</Text>
      <Text style={styles.subtitle}>2–9 players. You can sit people out hand by hand later.</Text>

      {names.map((n, i) => (
        <View key={i} style={styles.row}>
          <TextInput
            value={n}
            onChangeText={(v) => setName(i, v)}
            placeholder={`Player ${i + 1}`}
            placeholderTextColor={colors.faint}
            style={styles.input}
            maxLength={14}
          />
          {names.length > 2 ? (
            <Pressable style={styles.remove} onPress={() => setNames(names.filter((_, j) => j !== i))}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {names.length < MAX_PLAYERS ? (
        <Pressable style={styles.add} onPress={() => setNames([...names, ''])}>
          <Text style={styles.addText}>+ Add player</Text>
        </Pressable>
      ) : null}

      {!unique && clean.length >= 2 ? (
        <Text style={styles.warn}>Two players have the same name — make them unique.</Text>
      ) : null}

      <View style={{ height: 20 }} />
      <BigButton label="Shuffle up and deal 🃏" onPress={() => newNight(clean)} disabled={!ready} />
      <View style={{ height: 10 }} />
      <BigButton label="Back" variant="ghost" onPress={() => go('home')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: colors.cream, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontSize: 17,
  },
  remove: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  removeText: { color: colors.muted, fontSize: 16 },
  add: { paddingVertical: 12, alignItems: 'center' },
  addText: { color: colors.gold, fontSize: 16, fontWeight: '700' },
  warn: { color: colors.danger, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
