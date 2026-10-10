import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../features/map/tokens';

export function AppNavigation() {
  const path = usePathname();
  return <View style={styles.bar}>
    <Text style={styles.brand}>Grow EV</Text>
    <View style={styles.links}>
      <Link href="/" accessibilityRole="link" style={[styles.link, path === '/' && styles.active]}>Driver</Link>
      <Link href="/network" accessibilityRole="link" style={[styles.link, path === '/network' && styles.active]}>Network</Link>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { backgroundColor: colors.main, paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.overlayBorder },
  brand: { color: colors.textPrimary, fontWeight: '700', fontSize: 20, letterSpacing: -0.5 },
  links: { flexDirection: 'row', gap: spacing.xs },
  link: { color: colors.textSecondary, padding: spacing.md, borderRadius: radii.full, fontSize: 14, fontWeight: '600', minHeight: 44 },
  active: { backgroundColor: colors.elevated, color: colors.accent },
});
