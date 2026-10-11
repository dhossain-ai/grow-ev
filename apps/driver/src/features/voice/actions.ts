import type { Coordinates } from '../../../../../packages/routing';
import type { ConnectorStandard } from '../map/congestion';
import { formatConnector } from '../map/types';
import type { VoiceCommand } from './commands';
import type { VoiceActionResult } from './states';

/** A transcription is successful only after the requested search/action completes. */
export async function executeVoiceCommand(command: VoiceCommand, signal: AbortSignal, actions: {
  standard: ConnectorStandard;
  locate: () => Promise<Coordinates | null>;
  selectConnector: (standard: ConnectorStandard) => void;
  search: (options: { connector: ConnectorStandard; origin?: Coordinates; minPowerKw?: number; signal: AbortSignal }) => Promise<boolean>;
  alternatives: () => Promise<boolean>;
}): Promise<VoiceActionResult> {
  const canceled = () => ({ ok: false, message: 'Voice search canceled.' });
  if (signal.aborted) return canceled();
  if (command.kind === 'alternative') {
    const ok = await actions.alternatives();
    return signal.aborted ? canceled() : { ok, message: ok ? 'Showing compatible alternatives' : 'No fresh compatible alternative. Choose a station or search manually.' };
  }
  let origin: Coordinates | undefined;
  if (command.kind === 'nearby' || (command.kind === 'connector' && command.nearMe)) {
    const fix = await actions.locate();
    if (signal.aborted) return canceled();
    if (!fix) return { ok: false, message: 'Location unavailable. Allow foreground location access or search the map manually.' };
    origin = fix;
  }
  const connector = command.kind === 'connector' ? command.standard : actions.standard;
  actions.selectConnector(connector);
  const ok = await actions.search({ connector, origin, minPowerKw: command.kind === 'fast' ? 50 : undefined, signal });
  if (signal.aborted) return canceled();
  return { ok, message: ok ? `Showing ${formatConnector(connector)} charging options` : 'Charging search did not find a compatible result. Search manually or try another area.' };
}
