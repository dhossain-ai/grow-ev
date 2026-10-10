import type { ConnectorStandard } from '../map/congestion';
import type { StationFilters } from '../map/types';

export type VoiceCommand =
  | { kind: 'connector'; standard: ConnectorStandard }
  | { kind: 'fast' }
  | { kind: 'alternative' }
  | { kind: 'nearby' };

export const COMMAND_HELP = 'Try “Find CCS2 chargers”, “Find Type 2 chargers”, “Find a fast charger”, “Find another available charger” or “Show charging stations near me”.';

/** Full utterance grammar. Negation, conflicting connectors and extra instructions fail closed. */
export function parseCommand(transcript: string): VoiceCommand | null {
  const text = transcript.toLowerCase().replace(/[.,!?-]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^please /, '').replace(/ please$/, '');
  if (/^(?:find|show)(?: me)?(?: a| some)? (?:ccs ?2|ccs two) (?:chargers?|charging stations?)$/.test(text)) return { kind: 'connector', standard: 'IEC_62196_T2_COMBO' };
  if (/^(?:find|show)(?: me)?(?: a| some)? type (?:2|two) (?:chargers?|charging stations?)$/.test(text)) return { kind: 'connector', standard: 'IEC_62196_T2' };
  if (/^find(?: me)?(?: a)? fast chargers?$/.test(text)) return { kind: 'fast' };
  if (/^find(?: me)? another available chargers?$/.test(text)) return { kind: 'alternative' };
  if (/^show(?: me)? charging stations near me$/.test(text)) return { kind: 'nearby' };
  return null;
}

export function commandFilters(command: VoiceCommand, current: StationFilters, standard: ConnectorStandard): StationFilters {
  if (command.kind === 'connector') return { connectorStandards: [command.standard] };
  if (command.kind === 'fast') return { connectorStandards: [standard], minPowerKw: 50 };
  return current;
}
