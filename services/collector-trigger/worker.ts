const REPO = 'dhossain-ai/grow-ev';
const WORKFLOW = 'collect-chargers.yml';
const API = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}`;
interface Storage { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }
interface State { storage: Storage }
interface Namespace { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
export interface Env { GITHUB_TOKEN: string; STATUS_TOKEN: string; ENABLED: string; GITHUB_REF: string; COORDINATOR: Namespace }
interface Run { id: number; display_title: string; status: string; conclusion: string | null; created_at: string; updated_at: string; head_branch: string }
interface Receipt { slot: number; dispatch_id: string; outcome: string; checked_at: string; http_status?: number }
const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function runs(env: Env, request: typeof fetch = fetch): Promise<Run[]> {
  const response = await request(`${API}/runs?per_page=100&branch=${encodeURIComponent(env.GITHUB_REF)}`, {
    headers: headers(env), signal: AbortSignal.timeout(15_000), redirect: 'follow' });
  if (!response.ok) {
    const reqId = response.headers.get('x-github-request-id') || 'none';
    throw new Error(`GitHub run inspection failed: HTTP ${response.status} (${response.statusText || 'error'}) [request-id: ${reqId}]`);
  }
  const data = await response.json() as { workflow_runs?: Run[] };
  if (!Array.isArray(data.workflow_runs) || data.workflow_runs.some(r => !Number.isSafeInteger(r.id) || typeof r.display_title !== 'string' || typeof r.status !== 'string' || !Number.isFinite(Date.parse(r.updated_at)))) throw new Error('Invalid GitHub run response schema');
  return data.workflow_runs;
}
function headers(env: Env): Record<string, string> {
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error('GitHub secret missing');
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'grow-ev-collector-trigger' };
}
export function health(items: Run[], now: number): Record<string, unknown> {
  // Only the permanent job checks the committed snapshot and receipt before success.
  const successful = items.filter(r => r.display_title?.startsWith('Permanent collection / ') && r.conclusion === 'success')
    .sort((a,b) => Date.parse(b.updated_at)-Date.parse(a.updated_at))[0];
  const age = successful ? (now-Date.parse(successful.updated_at))/1000 : null;
  return { last_successful_run: successful?.id ?? null, age_seconds: age,
    latest_run_failed: items.filter(r=>r.display_title?.startsWith('Permanent collection / ')).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]?.conclusion === 'failure',
    missed_successful_poll: age === null || !Number.isFinite(age) || age < 0 || age > 75*60,
    evidence: 'GitHub permanent job success with committed-history receipt; not direct database inspection' };
}
export async function dispatch(env: Env, dispatchId: string, request: typeof fetch = fetch): Promise<number> {
  const response = await request(`${API}/dispatches`, { method: 'POST', headers: { ...headers(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: env.GITHUB_REF, inputs: { mode: 'permanent', dispatch_id: dispatchId } }),
    signal: AbortSignal.timeout(15_000), redirect: 'follow' });
  return response.status;
}
export class CollectorCoordinator {
  private pending: Promise<unknown> = Promise.resolve();
  private state: State;
  private env: Env;
  constructor(state: State, env: Env) { this.state = state; this.env = env; }
  fetch(request: Request): Promise<Response> {
    // Serialize checks, durable reservation and dispatch within this single named object.
    const result = this.pending.then(() => this.handle(request));
    this.pending = result.catch(() => undefined);
    return result;
  }
  private async handle(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === '/health') {
      try {
        const items = await runs(this.env);
        return json({ enabled: this.env.ENABLED === 'approved', last_attempt: await this.state.storage.get('attempt'), last_inspection_error: await this.state.storage.get('last_inspection_error'), ...health(items, Date.now()) });
      } catch (err: any) {
        return json({ status: 'unavailable', reason: 'GitHub inspection failed', error: err.message, last_attempt: await this.state.storage.get('attempt'), last_inspection_error: await this.state.storage.get('last_inspection_error') }, 503);
      }
    }
    if (this.env.ENABLED !== 'approved') return json({ status: 'disabled' });
    const body = await request.json() as { scheduledTime: number };
    const slot = Math.floor(body.scheduledTime / (30*60*1000));
    if (!Number.isSafeInteger(slot) || Math.abs(Date.now()-body.scheduledTime) > 10*60*1000) return json({ status: 'invalid_or_delayed_slot' }, 400);
    const previous = await this.state.storage.get<Receipt>('attempt');
    if (previous && previous.slot >= slot) return json({ status: 'already_attempted', dispatch_id: previous.dispatch_id });
    let items: Run[];
    try { items = await runs(this.env); }
    catch (err: any) {
      await this.state.storage.put('last_inspection_error', { time: new Date().toISOString(), message: err.message });
      return json({ status: 'inspection_failed_no_dispatch', error: err.message }, 503);
    }
    if (items.some(r => r.status !== 'completed')) return json({ status: 'collector_active_no_dispatch', ...health(items, Date.now()) });
    const receipt: Receipt = { slot, dispatch_id: `cf-${slot}`, outcome: 'uncertain', checked_at: new Date().toISOString() };
    // Reservation survives network ambiguity/restarts. Never retry a POST in the same slot.
    await this.state.storage.put('attempt', receipt);
    try {
      const status = await dispatch(this.env, receipt.dispatch_id);
      receipt.http_status = status;
      receipt.outcome = status === 204 ? 'accepted' : 'rejected';
    } catch { receipt.outcome = 'uncertain'; }
    await this.state.storage.put('attempt', receipt);
    console.log(JSON.stringify({ ...receipt, ...health(items, Date.now()) }));
    return json(receipt, receipt.outcome === 'accepted' ? 202 : 503);
  }
}
export default {
  async scheduled(event: { scheduledTime: number }, env: Env): Promise<void> {
    const response = await env.COORDINATOR.get(env.COORDINATOR.idFromName('collector')).fetch(new Request('https://internal/dispatch', {
      method: 'POST', body: JSON.stringify({ scheduledTime: event.scheduledTime }) }));
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Collector dispatch failed (HTTP ${response.status}): ${errText}`);
      throw new Error(`Collector dispatch failed: HTTP ${response.status}`);
    }
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/health') return json({ error: 'not_found' }, 404);
    const expected = env.STATUS_TOKEN?.trim();
    if (!expected || request.headers.get('Authorization') !== `Bearer ${expected}`) return json({ error: 'unauthorized' }, 401);
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    return env.COORDINATOR.get(env.COORDINATOR.idFromName('collector')).fetch(new Request('https://internal/health'));
  },
};
