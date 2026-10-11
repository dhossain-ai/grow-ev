import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, useReducedMotion } from '../../components/CalmUI';
import { colors } from '../map/tokens';
import type { MapStation } from '../map/types';
import { stationTitle } from './presentation';

const categories = [
  'Vehicle blocking charging access',
  'Charger appears occupied but inactive',
  'Charger not working',
  'Incorrect availability',
  'Other issue',
] as const;

/** Local preview only: no reporting endpoint, persistence, or account integration. */
export function ResponsibleCharging({ station }: { station: MapStation }) {
  const [sheet, setSheet] = useState<'report' | 'points' | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const close = () => { setSheet(null); setCategory(null); setDescription(''); setReviewing(false); };
  return <View style={styles.section}>
    <Text style={styles.label}>RESPONSIBLE CHARGING</Text>
    <View style={styles.box}>
      <Text style={styles.heading}>Make room for the next driver</Text>
      <Text style={styles.body}>Move after charging finishes. Keep charging spaces accessible.</Text>
      <Text style={styles.body}>Report equipment problems. When stations are congested, consider compatible alternatives.</Text>
    </View>
    <ActionButton secondary label="Report an issue · Preview only" onPress={() => setSheet('report')} />
    <ActionButton secondary label="Grow Points · Coming soon" onPress={() => setSheet('points')} />
    <Modal visible={sheet !== null} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss information sheet" onPress={close} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{sheet === 'report' ? 'Report an issue' : 'Grow Points'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close information sheet" onPress={close} style={styles.close}><Text style={styles.heading}>×</Text></Pressable></View>
            {sheet === 'report' ? <>
              <Text style={styles.badge}>PREVIEW ONLY</Text>
              <Text style={styles.body}>No reporting service is connected. Nothing is sent or saved.</Text>
              <View style={styles.box}><Text style={styles.heading}>{stationTitle(station)}</Text><Text style={styles.body}>{[station.address, station.city].filter(Boolean).join(', ') || 'Address not reported'}</Text><Text selectable style={styles.caption}>Station reference · {station.location_id}</Text></View>
              {reviewing ? <View style={styles.box}><Text style={styles.heading}>Report preview</Text><Text style={styles.body}>{category}</Text>{description.trim() ? <Text style={styles.body}>{description.trim()}</Text> : null}<Text accessibilityLiveRegion="polite" style={styles.badge}>Preview only · Report not submitted</Text><ActionButton secondary label="Edit preview" onPress={() => setReviewing(false)} /></View> : <>
                <Text style={styles.heading}>What did you notice?</Text>
                {categories.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: category === item }} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.selected]}><Text style={styles.body}>{category === item ? '●' : '○'}  {item}</Text></Pressable>)}
                <Text style={styles.heading}>Optional description</Text>
                <TextInput accessibilityLabel="Optional issue description" placeholder="Add a short description" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline maxLength={240} style={styles.input} />
                <Text style={styles.caption}>{description.length}/240 characters</Text>
                <ActionButton label="Review preview" disabled={category === null} onPress={() => { if (category !== null) setReviewing(true); }} />
              </>}
            </> : <>
              <Text style={styles.badge}>Rewards program · Coming soon</Text>
              <Text style={styles.heading}>Helpful actions deserve recognition</Text>
              <Text style={styles.body}>A future Grow Points program could recognize verified helpful reports and responsible charging, including keeping charging spaces accessible and moving after charging finishes.</Text>
              <Text style={styles.body}>Verification, eligibility and incentives are still being designed. Details will be announced when the program is available.</Text>
            </>}
            <ActionButton secondary label={sheet === 'report' ? 'Close preview' : 'Got it'} onPress={close} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  label: { fontSize: 11, letterSpacing: 1.5, color: colors.textSecondary, marginTop: 4 },
  box: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.overlayBorder, gap: 8 },
  heading: { fontSize: 17, lineHeight: 23, color: colors.textPrimary, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, lineHeight: 30, color: colors.textPrimary, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  badge: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.accentInk },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(23,34,27,0.35)' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.overlayBorder, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  option: { minHeight: 48, justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.overlayBorder },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.accentInk },
  input: { minHeight: 84, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.overlayBorder, color: colors.textPrimary, fontSize: 14, textAlignVertical: 'top' },
});
