import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../features/map/tokens';
export function AppNavigation() {
  const network = usePathname() === '/network';
  const { width } = useWindowDimensions();
  return <View style={styles.bar}>
    <Link href="/" accessibilityLabel="Grow EV charging assistant" style={styles.brand}>grow<Text style={styles.brandEv}> ev</Text></Link>
    {width >= 768 && network ? <Text style={styles.tagline}>Network Intelligence</Text> : null}
    {network ? <Link href="/" style={styles.link}>Back to charging</Link> : null}
  </View>;
}
const styles = StyleSheet.create({
  bar: { backgroundColor: colors.main, paddingHorizontal: 20, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, zIndex: 5 },
  brand: { minHeight: 48, paddingVertical: 6, color: colors.textPrimary, fontWeight: '800', fontSize: 32, letterSpacing: -1.7 },
  brandEv: { fontWeight: '400' },
  tagline: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  link: { marginLeft: 'auto', color: colors.textSecondary, paddingVertical: 16, paddingHorizontal: 8, fontSize: 13, minHeight: 48 },
});
