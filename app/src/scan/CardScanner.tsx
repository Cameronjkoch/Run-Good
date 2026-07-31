import type { Card } from '@run-good/engine';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { CardView } from '../components/CardView';
import { BigButton } from '../components/ui';
import { colors } from '../theme';
import { recognizeCards } from './recognize';
import { useScanSettings } from './scanSettings';

const POLL_INTERVAL_MS = 1600;

function cardsKey(cards: Card[]): string {
  return cards.slice().sort().join(',');
}

/**
 * The camera opens already watching — nothing to tap. It quietly checks the
 * frame every ~1.6s, and once two consecutive reads agree on the same cards
 * it surfaces them for a one-tap confirm. Falls back to the manual picker
 * via onManual (optionally pre-filled).
 */
export function CardScanner({
  title,
  count,
  validate,
  onDone,
  onCancel,
  onManual,
}: {
  title: string;
  count: number;
  /** Secret-conflict check; return an error message to block. */
  validate?: (cards: Card[]) => string | null;
  onDone: (cards: Card[]) => void;
  onCancel: () => void;
  /** Open the manual picker instead, optionally pre-filled with a scan result. */
  onManual: (initial?: Card[]) => void;
}) {
  const apiKey = useScanSettings((s) => s.apiKey);
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [watching, setWatching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Card[] | null>(null);

  const inFlight = useRef(false);
  const pendingKey = useRef<string | null>(null);
  const misfires = useRef(0);

  useEffect(() => {
    if (!apiKey || !permission?.granted || !watching) return;
    const timer = setInterval(() => {
      void checkFrame();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, permission?.granted, watching]);

  const checkFrame = async () => {
    if (inFlight.current || !apiKey) return;
    inFlight.current = true;
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.35,
        skipProcessing: true,
      });
      if (!photo?.base64) return;

      const cards = await recognizeCards(photo.base64, count, apiKey);
      misfires.current = 0;
      if (!cards) {
        pendingKey.current = null;
        return;
      }

      const conflict = validate?.(cards) ?? null;
      if (conflict) {
        setError(conflict);
        pendingKey.current = null;
        return;
      }

      const key = cardsKey(cards);
      if (pendingKey.current === key) {
        setWatching(false);
        setFound(cards);
        pendingKey.current = null;
      } else {
        pendingKey.current = key;
      }
      setError(null);
    } catch (e) {
      misfires.current += 1;
      if (misfires.current >= 3) {
        setError(e instanceof Error ? e.message : 'Having trouble reading — try repositioning or type them in.');
      }
    } finally {
      inFlight.current = false;
    }
  };

  const retake = () => {
    setFound(null);
    setError(null);
    pendingKey.current = null;
    misfires.current = 0;
    setWatching(true);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Text style={styles.title}>{title}</Text>

        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.note}>
              Run-Good needs camera access to scan cards. Nothing is stored — each photo is read
              once and discarded.
            </Text>
            <View style={{ height: 14 }} />
            <BigButton label="Allow camera" onPress={() => void requestPermission()} />
          </View>
        ) : found ? (
          <View style={styles.center}>
            <Text style={styles.note}>Is this right?</Text>
            <View style={styles.cards}>
              {found.map((c) => (
                <CardView key={c} card={c} size="lg" />
              ))}
            </View>
            <View style={{ height: 16 }} />
            <BigButton label="Yep — lock them in" onPress={() => onDone(found)} />
            <View style={{ height: 10 }} />
            <BigButton label="Retake" variant="ghost" onPress={retake} />
            <View style={{ height: 10 }} />
            <BigButton label="Fix by hand" variant="ghost" onPress={() => onManual(found)} />
          </View>
        ) : (
          <>
            <View style={styles.cameraBox}>
              <CameraView ref={camRef} style={styles.camera} facing="back" />
              <View style={styles.guide} pointerEvents="none">
                <Text style={styles.guideText}>
                  {count === 1
                    ? 'Hold the card steady — reading automatically'
                    : `Hold all ${count} cards steady — reading automatically`}
                </Text>
              </View>
            </View>
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.note}> Watching…</Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}

        <View style={{ height: 10 }} />
        <BigButton label="Type them in instead" variant="ghost" onPress={() => onManual()} />
        <View style={{ height: 10 }} />
        <BigButton label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.feltDark,
    padding: 22,
    paddingTop: 54,
    justifyContent: 'center',
  },
  title: { color: colors.cream, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  center: { alignItems: 'center' },
  cameraBox: {
    borderRadius: 18,
    overflow: 'hidden',
    aspectRatio: 3 / 4,
    maxHeight: 420,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  camera: { flex: 1 },
  guide: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  guideText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cards: { flexDirection: 'row', gap: 10, marginTop: 14 },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  note: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: 12, fontWeight: '600' },
});
