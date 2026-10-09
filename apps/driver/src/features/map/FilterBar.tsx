/**
 * Simple connector/power filter bar for the map.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StationFilters } from './types';
import { colors, radii, spacing } from './tokens';

interface FilterBarProps {
  filters: StationFilters;
  onFiltersChange: (filters: StationFilters) => void;
}

/** Common connector standards in the Lithuanian network. */
const CONNECTOR_OPTIONS = [
  { value: 'IEC_62196_T2', label: 'Type 2' },
  { value: 'IEC_62196_T2_COMBO', label: 'CCS2' },
  { value: 'CHADEMO', label: 'CHAdeMO' },
] as const;

/** Power threshold options in kW. */
const POWER_OPTIONS = [
  { value: 0, label: 'All' },
  { value: 22, label: '22+ kW' },
  { value: 50, label: '50+ kW' },
  { value: 150, label: '150+ kW' },
] as const;

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const activeConnectors = filters.connectorStandards ?? [];
  const activePower = filters.minPowerKw ?? 0;

  const toggleConnector = (standard: string) => {
    const current = new Set(activeConnectors);
    if (current.has(standard)) {
      current.delete(standard);
    } else {
      current.add(standard);
    }
    onFiltersChange({
      ...filters,
      connectorStandards: current.size > 0 ? [...current] : undefined,
    });
  };

  const setPower = (kw: number) => {
    onFiltersChange({
      ...filters,
      minPowerKw: kw > 0 ? kw : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {CONNECTOR_OPTIONS.map((opt) => {
          const active = activeConnectors.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggleConnector(opt.value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter ${opt.label}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.separator} />
        {POWER_OPTIONS.map((opt) => {
          const active = activePower === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setPower(opt.value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter ${opt.label}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.accentForeground,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
