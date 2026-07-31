import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BigButton, Panel } from '../components/ui';
import { useScanSettings } from '../scan/scanSettings';
import { useNight } from '../store';
import { colors } from '../theme';

export function ScanSetupScreen() {
  const go = useNight((s) => s.go);
  const apiKey = useScanSettings((s) => s.apiKey);
  const setApiKey = useScanSettings((s) => s.setApiKey);
  const [draft, setDraft] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Camera scanning 📷</Text>
      <Text style={styles.subtitle}>
        Scanning reads your cards with the Claude API. It needs an Anthropic API key — get one at
        console.anthropic.com (API keys). Each scan costs a fraction of a cent.
      </Text>

      <Panel title={apiKey ? 'API key — set ✓' : 'API key'}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={apiKey ? 'Paste a new key to replace it' : 'sk-ant-…'}
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.note}>
          Stored only on this phone. Never leaves the device except to call the Claude API.
        </Text>
      </Panel>

      <View style={{ height: 14 }} />
      <BigButton
        label="Save key"
        onPress={() => {
          setApiKey(draft);
          setDraft('');
        }}
        disabled={draft.trim().length < 10}
      />
      {apiKey ? (
        <>
          <View style={{ height: 10 }} />
          <BigButton label="Remove key" variant="danger" onPress={() => setApiKey(null)} />
        </>
      ) : null}
      <View style={{ height: 10 }} />
      <BigButton label="Back" variant="ghost" onPress={() => go('home')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: colors.cream, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 18, lineHeight: 20 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontSize: 15,
  },
  note: { color: colors.faint, fontSize: 12, marginTop: 8 },
});
