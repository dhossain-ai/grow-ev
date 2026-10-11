export type VoicePhase = 'idle' | 'requesting_permission' | 'listening' | 'processing' | 'success' | 'unrecognized' | 'permission_denied' | 'error' | 'canceling';
export interface VoiceActionResult { ok: boolean; message: string }
export function microphoneFailure(error: unknown): VoicePhase {
  return error instanceof Error && /permission denied|notallowed|access.*denied/i.test(`${error.name} ${error.message}`) ? 'permission_denied' : 'error';
}
