/** Experimental CatBoost output; display policy thresholds are not calibrated categories. */
export interface Prediction {
  prediction_id: string; location_id: string; connector_standard: string; source_poll_id: string;
  source_observed_at: string; generated_at: string; horizon: 'next_observation';
  probability_zero_capacity: number; model_version: 'availability_v1'; model_sha256: string;
  experimental: true; expires_at: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash = /^[0-9a-f]{64}$/;
// Genuine committed availability_v1 CatBoost artifact; promotion requires contract review.
export const MODEL_SHA256 = 'c14082644ae49b617501dd052bdf36ad35092506f21bb13bbaac7a4d430e7e42';
const instant = (value: unknown): number => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
export function parsePrediction(value: unknown, locationId: string, standard: string, now = Date.now()): Prediction | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (p.location_id !== locationId || p.connector_standard !== standard || !uuid.test(locationId) ||
      !['IEC_62196_T2_COMBO','IEC_62196_T2','CHADEMO'].includes(standard) ||
      typeof p.source_poll_id !== 'string' || !uuid.test(p.source_poll_id) ||
      typeof p.prediction_id !== 'string' || !hash.test(p.prediction_id) ||
      p.model_sha256 !== MODEL_SHA256 ||
      p.model_version !== 'availability_v1' || p.horizon !== 'next_observation' || p.experimental !== true ||
      typeof p.probability_zero_capacity !== 'number' || !Number.isFinite(p.probability_zero_capacity) ||
      p.probability_zero_capacity < 0 || p.probability_zero_capacity > 1) return null;
  const observed = instant(p.source_observed_at), generated = instant(p.generated_at), expires = instant(p.expires_at);
  if (![now,observed,generated,expires].every(Number.isFinite) || observed > generated || generated > now ||
      expires <= now || expires <= generated || expires - observed > 3600000) return null;
  return p as unknown as Prediction;
}
export function outlookText(probability: number): string {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('Invalid risk');
  return probability >= 0.65 ? 'Higher model risk of no compatible EVSE being available at the next observation.' :
    probability <= 0.35 ? 'Lower model risk of no compatible EVSE being available at the next observation.' :
    'Uncertain model outlook for compatible availability at the next observation.';
}
export async function fetchPrediction(locationId: string, standard: string, signal?: AbortSignal): Promise<Prediction | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('AI outlook unavailable');
  const response = await fetch(`${url}/rest/v1/rpc/get_charging_prediction`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_location_id: locationId, target_connector_standard: standard }), signal,
  });
  if (!response.ok) throw new Error('AI outlook unavailable');
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length > 1) throw new Error('Invalid AI outlook response');
  return data.length === 1 ? parsePrediction(data[0], locationId, standard) : null;
}
