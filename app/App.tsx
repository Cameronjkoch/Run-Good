import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HandScreen } from './src/screens/HandScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { OnlineScreen } from './src/screens/OnlineScreen';
import { ScanSetupScreen } from './src/screens/ScanSetupScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { useNight } from './src/store';
import { colors } from './src/theme';

export default function App() {
  const screen = useNight((s) => s.screen);
  const [hydrated, setHydrated] = useState(useNight.persist.hasHydrated());
  useEffect(() => useNight.persist.onFinishHydration(() => setHydrated(true)), []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        {!hydrated ? null : screen === 'home' ? (
          <HomeScreen />
        ) : screen === 'setup' ? (
          <SetupScreen />
        ) : screen === 'hand' ? (
          <HandScreen />
        ) : screen === 'online' ? (
          <OnlineScreen />
        ) : screen === 'scan-setup' ? (
          <ScanSetupScreen />
        ) : (
          <LeaderboardScreen />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.felt },
});
