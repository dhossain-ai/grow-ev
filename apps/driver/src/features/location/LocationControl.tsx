import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../map/tokens';

export function LocationControl({ busy, error, onPress }: { busy: boolean; error: string | null; onPress: () => void }) {
  return <View style={styles.container}>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Locate me" disabled={busy}
      onPress={onPress} style={styles.button}>
      <Text style={styles.icon}>{busy ? '…' : '⊙'}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { alignItems: 'flex-end', gap: 8 },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.overlayBorder, borderRadius: 16 },
  icon: { fontSize: 32, color: colors.info, lineHeight: 36 },
  error: { maxWidth: 280, padding: 12, borderRadius: 12, backgroundColor: colors.surface, color: colors.textPrimary, fontSize: 13 },
});
