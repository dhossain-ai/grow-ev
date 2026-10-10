import { isRoutingBatchRequest, type RouteOutcome, type RoutingProvider, type RoutingFailure } from '../../../packages/routing/index.ts';
import { RoutingError, unavailable } from './tomtom.ts';

/** Budget is deliberately global per isolate: no trusted-client IP assumptions. */
export function createRoutingHandler(provider: RoutingProvider, now: () => number = Date.now) {
  let windowStart = now();
  let calls = 0;
  let active = 0;
  let providerBackoffUntil = 0;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  const fail = (error: RoutingError) => json({ error: error.failure }, error.status);
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: { code: 'INVALID_INPUT', message: 'Use POST', retryable: false } }, 405);
    let body: unknown;
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    let bodyTimedOut = false;
    try {
      // Stream with a byte ceiling; Content-Length alone is not trusted.
      const reader = request.body?.getReader();
      if (!reader) throw new Error('Missing body');
      bodyTimer = setTimeout(() => { bodyTimedOut = true; void reader.cancel(); }, 2000);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); throw new Error('Body too large'); }
        chunks.push(value);
      }
      if (bodyTimedOut) throw new Error('Body read deadline exceeded');
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return json({ error: { code: 'INVALID_INPUT', message: 'Expected JSON body of at most 2048 bytes', retryable: false } }, 400); }
    finally { clearTimeout(bodyTimer); }
    if (!isRoutingBatchRequest(body)) return json({ error: { code: 'INVALID_INPUT',
      message: 'Provide valid origin and 1–3 unique destinations within 15 km', retryable: false } }, 400);
    if (now() - windowStart >= 60000) { windowStart = now(); calls = 0; }
    if (active >= 2 || calls + body.destinations.length > 30 || now() < providerBackoffUntil) {
      const response = fail(new RoutingError({ code: 'RATE_LIMITED', message: 'Routing request budget reached; retry later', retryable: true }, 429));
      response.headers.set('Retry-After', '60');
      return response;
    }
    calls += body.destinations.length;
    active++;
    try {
      const results: RouteOutcome[] = await Promise.all(body.destinations.map(async (destination) => {
        try { return { route: await provider.calculate({ origin: body.origin, destination }) }; }
        catch (error) {
          const failure = error instanceof RoutingError ? error.failure : unavailable().failure;
          if (failure.code === 'EXTERNAL_RATE_LIMITED') providerBackoffUntil = now() + 60000;
          return { error: failure };
        }
      }));
      // Preserve partial success and positional destination association.
      if (results.every((r) => 'error' in r)) {
        const first = results[0] as { error: RoutingFailure };
        const status = first.error.code === 'EXTERNAL_RATE_LIMITED' ? 429 :
          first.error.code === 'ROUTING_TIMEOUT' ? 504 : first.error.code === 'ROUTING_NOT_CONFIGURED' ? 503 : 502;
        const response = json({ results, error: first.error }, status);
        if (status === 429) response.headers.set('Retry-After', '60');
        return response;
      }
      return json({ results });
    } finally { active--; }
  };
}
