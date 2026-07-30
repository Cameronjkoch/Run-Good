import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Variant = 'primary' | 'ghost' | 'danger';

export function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'primary' ? styles.btnTextPrimary : styles.btnTextLight,
          variant === 'danger' && styles.btnTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Panel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.panel}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function ConfirmSheet({
  visible,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetText}>{message}</Text>
          <BigButton label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} />
          <View style={{ height: 10 }} />
          <BigButton label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnPrimary: { backgroundColor: colors.gold },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.line },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.danger },
  btnDisabled: { opacity: 0.35 },
  btnPressed: { opacity: 0.75 },
  btnText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  btnTextPrimary: { color: colors.goldInk },
  btnTextLight: { color: colors.cream },
  btnTextDanger: { color: colors.danger },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.feltDark,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetText: { color: colors.cream, fontSize: 17, lineHeight: 24, marginBottom: 18, textAlign: 'center' },
});
