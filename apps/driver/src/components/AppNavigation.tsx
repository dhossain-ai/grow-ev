import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../features/map/tokens';
export function AppNavigation() {
  const network = usePathname() === '/network';
  const { width } = useWindowDimensions();
  return <View style={styles.bar}>
    <Link href="/" accessibilityLabel="Grow EV charging assistant" style={styles.brand}>grow<Text style={styles.brandEv}> ev</Text></Link>
    {width >= 768 ? <Text style={styles.tagline}>{network ? 'Network Intelligence' : 'A better place to charge.'}</Text> : null}
    <Link href={network ? '/' : '/network'} style={styles.link}>{network ? 'Back to charging' : width >= 768 ? 'Network Intelligence ↗' : 'Network ↗'}</Link>
  </View>;
}
const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, paddingHorizontal: 24, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.overlayBorder },
  brand: { minHeight: 48, paddingVertical: 8, color: colors.textPrimary, fontWeight: '700', fontSize: 24, letterSpacing: -1 },
  brandEv: { fontWeight: '400' },
  tagline: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  link: { marginLeft: 'auto', color: colors.textSecondary, paddingVertical: 16, paddingHorizontal: 8, fontSize: 13, minHeight: 48 },
});
