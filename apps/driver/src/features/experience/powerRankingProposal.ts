import type { ConnectorStandard, StationEvidence } from '../map/congestion';
import { compatiblePower } from './presentation';

/** Review-only proposal for candidates with equal verified drive times.
 * Production never calls this; unknown connector power keeps its original position. */
export function proposedPowerTieBreak(rows: readonly StationEvidence[], standard: ConnectorStandard): StationEvidence[] {
  const known = rows.filter(row => compatiblePower(row.station, standard) !== null)
    .sort((a, b) => compatiblePower(b.station, standard)! - compatiblePower(a.station, standard)!);
  let index = 0;
  return rows.map(row => compatiblePower(row.station, standard) === null ? row : known[index++]);
}
