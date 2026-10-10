/**
 * Simple connector/power filter bar for the map.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StationFilters } from './types';
import { colors, radii, spacing } from './tokens';
import { CONNECTOR_OPTIONS } from './congestion';

interface FilterBarProps {
  filters: StationFilters;
  onFiltersChange: (filters: StationFilters) => void;
}

/** Power threshold options in kW. */
const POWER_OPTIONS = [
  { value: 0, label: 'All' },
  { value: 22, label: '22+ kW' },
  { value: 50, label: '50+ kW' },
  { value: 150, label: '150+ kW' },
] as const;

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const [powerOpen, setPowerOpen] = useState(false);
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
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
        <Pressable accessibilityRole="button" accessibilityLabel="Power filters" accessibilityState={{ expanded: powerOpen }} onPress={() => setPowerOpen((value) => !value)} style={styles.chip}>
          <Text style={styles.chipText}>{activePower ? activePower + '+ kW ●' : 'Power ▾'}</Text>
        </Pressable>
      </ScrollView>
      {powerOpen ? <View style={styles.row}>
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
      </View> : null}
      {activeConnectors.length || activePower ? <Pressable accessibilityRole="button" accessibilityLabel="Clear filters" onPress={() => onFiltersChange({})} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={styles.chipText}>{activeConnectors.length + (activePower ? 1 : 0)} active filters · Clear</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.overlayBackground,
    borderRadius: radii.lg,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: colors.elevated,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.accent,
  },
});
