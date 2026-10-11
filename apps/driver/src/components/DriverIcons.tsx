import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../features/map/tokens';

export function MicrophoneIcon({ size = 24 }: { size?: number }) {
  return <View accessible={false} style={{ width: size, height: size * 1.25, alignItems: 'center' }}>
    <View style={{ width: size * .36, height: size * .68, borderRadius: size, backgroundColor: colors.textPrimary }} />
    <View style={{ position: 'absolute', top: size * .34, width: size * .74, height: size * .56, borderWidth: 2, borderTopWidth: 0, borderBottomLeftRadius: size, borderBottomRightRadius: size, borderColor: colors.textPrimary }} />
    <View style={{ position: 'absolute', top: size * .88, width: 2, height: size * .28, backgroundColor: colors.textPrimary }} />
  </View>;
}
export function ConnectorIcon({ combo = false }: { combo?: boolean }) {
  return <View accessible={false} style={{ width: 28, alignItems: 'center', gap: 2 }}>
    <View style={styles.socket}>{[0, 1, 2, 3, 4].map((i) => <View key={i} style={styles.hole} />)}</View>
    {combo ? <View style={styles.dc}><View style={styles.hole} /><View style={styles.hole} /></View> : null}
  </View>;
}
export function ChargingPin({ small = false }: { small?: boolean }) {
  return <View accessible={false} style={[styles.pin, small && { width: 30, height: 36 }]}><Text style={[styles.bolt, small && { fontSize: 25 }]}>ϟ</Text></View>;
}
const styles = StyleSheet.create({
  socket: { width: 26, height: 26, borderRadius: 14, borderWidth: 1.6, borderColor: colors.textPrimary, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 2, padding: 3 },
  hole: { width: 5, height: 5, borderWidth: 1.2, borderColor: colors.textPrimary, borderRadius: 5 },
  dc: { flexDirection: 'row', gap: 5, borderWidth: 1.6, borderColor: colors.textPrimary, borderRadius: 6, padding: 3 },
  pin: { width: 38, height: 46, backgroundColor: '#163C26', borderRadius: 24, borderBottomRightRadius: 6, alignItems: 'center', justifyContent: 'center' },
  bolt: { color: colors.accent, fontSize: 34, lineHeight: 40, fontWeight: '800' },
});
