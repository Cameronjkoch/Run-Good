import type { Card } from '@run-good/engine';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { CardView } from '../components/CardView';
import { BigButton } from '../components/ui';
import { colors } from '../theme';
import { recognizeCards } from './recognize';
import { useScanSettings } from './scanSettings';

/**
 * Point the camera at the cards, tap once, confirm what Claude read.
 * Falls back to the manual picker via onManual (optionally pre-filled).
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Card[] | null>(null);

  const snap = async () => {
    if (!apiKey || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camRef.current?.takePictureAsync({ base64: true, quality: 0.4 });
      if (!photo?.base64) throw new Error('No photo captured');
      const cards = await recognizeCards(photo.base64, count, apiKey);
      if (!cards) {
        setError("Couldn't read the cards — try again closer up with better light, or type them in.");
        return;
      }
      const err = validate?.(cards) ?? null;
      if (err) {
        setError(err);
        return;
      }
      setFound(cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed — try again or type them in.');
    } finally {
      setBusy(false);
    }
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
            <BigButton label="Retake" variant="ghost" onPress={() => setFound(null)} />
            <View style={{ height: 10 }} />
            <BigButton label="Fix by hand" variant="ghost" onPress={() => onManual(found)} />
          </View>
        ) : (
          <>
            <View style={styles.cameraBox}>
              <CameraView ref={camRef} style={styles.camera} facing="back" />
              <View style={styles.guide} pointerEvents="none">
                <Text style={styles.guideText}>
                  {count === 1 ? 'Hold the card in frame' : `Hold all ${count} cards in frame`}
                </Text>
              </View>
            </View>
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={colors.gold} />
                <Text style={styles.note}> Reading cards…</Text>
              </View>
            ) : (
              <BigButton label="📸 Scan" onPress={() => void snap()} />
            )}
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
