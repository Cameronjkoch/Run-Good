import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Camera-scan settings. The Anthropic API key is entered in the app and stored
 * only on this device (AsyncStorage) — it is never committed to the repo or
 * synced anywhere.
 */
interface ScanSettings {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
}

export const useScanSettings = create<ScanSettings>()(
  persist(
    (set) => ({
      apiKey: null,
      setApiKey: (apiKey) => set({ apiKey: apiKey?.trim() ? apiKey.trim() : null }),
    }),
    {
      name: 'run-good-scan',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
