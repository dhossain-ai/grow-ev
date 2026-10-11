import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewProps } from 'react-native';
import { colors, motion, radii } from '../features/map/tokens';
import { CONNECTOR_OPTIONS, type ConnectorStandard } from '../features/map/congestion';
import { ConnectorIcon } from './DriverIcons';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function CardReveal({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) { opacity.setValue(1); return; }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, { toValue: 1, duration: motion.card,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduced]);
  return <Animated.View {...props} style={[style, { opacity }]}>{children}</Animated.View>;
}

export function ActionButton({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, focused && styles.focus,
      { opacity: disabled ? 0.55 : pressed ? 0.75 : 1 }]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export function ConnectorSelector({ value, onChange }: { value: ConnectorStandard; onChange: (value: ConnectorStandard) => void }) {
  const narrow = useWindowDimensions().width < 360;
  return <View style={styles.connectors}>{CONNECTOR_OPTIONS.map((option) =>
    <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`Use ${option.label}`}
      accessibilityState={{ selected: value === option.value }} aria-pressed={value === option.value} onPress={() => onChange(option.value)}
      style={({ pressed }) => [styles.connector, narrow && { flexDirection: 'column', minHeight: 68, gap: 2 }, value === option.value && styles.chosen, pressed && { opacity: 0.7 }]}>
      <ConnectorIcon combo={option.value === 'IEC_62196_T2_COMBO'} />
      <Text style={[styles.connectorText, narrow && { fontSize: 12 }, value === option.value && { color: colors.textPrimary }]}>{option.label}</Text>
    </Pressable>)}</View>;
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.accent, borderRadius: radii.sm, minHeight: 48,
    paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  secondary: { backgroundColor: colors.elevated },
  focus: { borderColor: colors.info },
  buttonText: { color: colors.accentForeground, fontSize: 15, fontWeight: '600' },
  connectors: { flexDirection: 'row', gap: 8 },
  connector: { flex: 1, minHeight: 58, borderRadius: radii.sm, backgroundColor: colors.elevated, flexDirection: 'row', gap: 5,
    borderWidth: 1, borderColor: colors.overlayBorder, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chosen: { backgroundColor: colors.accentSoft, borderColor: colors.accentInk },
  connectorText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
});
