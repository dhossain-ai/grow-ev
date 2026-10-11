import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import type { ConnectorStandard, StationEvidence } from '../map/congestion';
import { colors } from '../map/tokens';
import { compatibleObservation } from '../experience/presentation';
import { fetchPrediction, outlookText, parsePrediction, type Prediction } from './prediction';

/** The public RPC verifies latest genuine poll identity; the client additionally matches
 * the oldest compatible observation and the exact reviewed model artifact. */
export function PredictionOutlook({ evidence, standard, now }: { evidence: StationEvidence; standard: ConnectorStandard; now: number }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const id = evidence.station.location_id;
  const observation = compatibleObservation(evidence, standard, now);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => { controller.abort(); if (active) setUnavailable(true); }, 8000);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { active = false; controller.abort(); setPrediction(null); }
    });
    void fetchPrediction(id, standard, controller.signal).then(value => {
      if (active && !controller.signal.aborted) { setPrediction(value); setUnavailable(false); }
    }).catch(() => { if (active) setUnavailable(true); }).finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); subscription.remove(); };
  }, [id, standard, observation.observedAt]);
  useEffect(() => {
    if (!prediction) return;
    const timer = setTimeout(() => setPrediction(null), Math.max(0, Date.parse(prediction.expires_at) - Date.now()));
    return () => clearTimeout(timer);
  }, [prediction]);
  const valid = parsePrediction(prediction, id, standard, now);
  if (unavailable) return <Text style={styles.caption}>AI outlook unavailable</Text>;
  if (!valid || observation.stale || Date.parse(valid.source_observed_at) !== Date.parse(observation.observedAt ?? '')) return null;
  return <View style={styles.box}>
    <Text style={styles.title}>Experimental AI Outlook</Text>
    <Text style={styles.body}>{outlookText(valid.probability_zero_capacity)}</Text>
    <Text style={styles.caption}>Issued {new Date(valid.generated_at).toLocaleTimeString()} · Next observation</Text>
    <Text style={styles.caption}>Source {new Date(valid.source_observed_at).toLocaleTimeString()} · Expires {new Date(valid.expires_at).toLocaleTimeString()}</Text>
    <Text style={styles.caption}>Model {valid.model_version}</Text>
    <Text style={styles.caption}>Experimental outlook for the next check; availability on arrival can differ.</Text>
  </View>;
}
const styles = StyleSheet.create({
  box: { padding: 12, borderRadius: 14, backgroundColor: colors.accentSoft, gap: 4 },
  title: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  caption: { fontSize: 11, lineHeight: 16, color: colors.textMuted },
});
