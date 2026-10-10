/**
 * Station detail card shown when a station is tapped on the map.
 * Uses React Native primitives for cross-platform compatibility.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Coordinates } from '../../../../../packages/routing';

import type { MapStation } from './types';
import { formatAge, formatConnector, formatPower, getAvailability, isStale } from './types';
import { availabilityColors, availabilityLabels, colors, radii, spacing } from './tokens';
import type { ConnectorStandard } from './congestion';
import { CongestionDetail } from './CongestionDetail';

interface StationDetailProps {
  station: MapStation;
  onClose: () => void;
  onSelect: (station: MapStation) => void;
  userOrigin?: Coordinates;
  expanded: boolean;
  standard: ConnectorStandard;
  onStandardChange: (value: ConnectorStandard) => void;
  onCase: () => void;
  onToggleExpanded: () => void;
}

export function StationDetail({ station, onClose, onSelect, userOrigin, expanded, onToggleExpanded, standard, onStandardChange, onCase }: StationDetailProps) {
  const [routeFromUser, setRouteFromUser] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const availability = getAvailability(station);
  const stale = isStale(station);
  const occupiedCount = station.charging_evse_count;
  const displayName = station.address && /^[A-Z0-9_-]{12,}$/.test(station.name ?? '') ? station.address : station.name ?? station.address ?? 'Charging Station';
  const connectors = station.connector_types ?? [];

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse station details' : 'Expand station details'} accessibilityState={{ expanded }} onPress={onToggleExpanded} style={styles.handleButton}>
        <View style={styles.handle} /><Text style={styles.handleLabel}>{expanded ? 'Collapse' : 'Details ↑'}</Text>
      </Pressable>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {displayName}
          </Text>
          {station.operator_name ? (
            <Text style={styles.operator} numberOfLines={1}>{station.operator_name}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="Close station details"
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.summary}>{stale ? 'Current availability unverified' : availabilityLabels[availability]} · Site max {formatPower(station.max_power_kw)}</Text>
      {expanded ? <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {userOrigin ? <View style={styles.section}>
          <Pressable accessibilityRole="switch" aria-checked={routeFromUser} accessibilityLabel="Route from my location" accessibilityState={{ checked: routeFromUser }} onPress={() => setRouteFromUser((value) => !value)} style={styles.originButton}>
            <Text style={styles.sectionValue}>{routeFromUser ? '✓ Route from my location' : 'Route from my location'}</Text>
          </Pressable>
          <Text style={styles.muted}>{routeFromUser ? 'Your foreground position is sent only when you explicitly compare road routes.' : 'Routes start at the selected charger.'}</Text>
        </View> : null}
        <CongestionDetail station={station} onSelect={onSelect} userOrigin={routeFromUser ? userOrigin : undefined} standard={standard} onStandardChange={onStandardChange} onCase={onCase} />
        <Pressable accessibilityRole="button" accessibilityLabel="Station information" accessibilityState={{ expanded: showInfo }} onPress={() => setShowInfo((value) => !value)} style={styles.infoButton}>
          <Text style={styles.sectionValue}>{showInfo ? 'Hide station information −' : 'Station information +'}</Text>
        </Pressable>
        {showInfo ? <View>
        {/* Availability summary */}
        <View style={styles.availabilityRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: availabilityColors[stale ? 'unknown' : availability] },
            ]}
          />
          <Text style={styles.availabilityText}>
            {stale ? 'Last observed status' : `${availabilityLabels[availability]} (observed)`}
          </Text>
          <Text style={styles.availabilityCount}>
            {station.available_evse_count}/{station.total_evse_count} {stale ? 'last observed available' : 'available'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Last observed · all connectors</Text>
        {/* EVSE breakdown */}
        <View style={styles.evseGrid}>
          <EvseRow label="Available" count={station.available_evse_count} color={colors.available} />
          <EvseRow label="In Use" count={occupiedCount} color={colors.warning} />
          <EvseRow label="Unavailable" count={station.unavailable_evse_count} color={colors.unavailable} />
          {station.unknown_evse_count > 0 ? (
            <EvseRow label="Unknown" count={station.unknown_evse_count} color={colors.textMuted} />
          ) : null}
        </View>

        {/* Connectors and power */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Connectors</Text>
          <View style={styles.chipRow}>
            {connectors.length > 0 ? (
              connectors.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{formatConnector(c)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>Not reported</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Max charging power</Text>
          <Text style={styles.sectionValue}>{formatPower(station.max_power_kw)}</Text>
        </View>

        {/* Location */}
        {station.address || station.city ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location</Text>
            <Text style={styles.sectionValue}>
              {[station.address, station.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        {/* Data freshness */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Last observed</Text>
          <View style={styles.freshnessRow}>
            {stale ? <Text style={styles.staleTag}>STALE</Text> : null}
            <Text style={[styles.sectionValue, stale && styles.staleText]}>
              {formatAge(station.last_observed_at)}
            </Text>
          </View>
          {station.last_observed_at ? (
            <Text style={styles.muted}>{new Date(station.last_observed_at).toLocaleString()}</Text>
          ) : null}
        </View>
        </View> : null}
      </ScrollView> : null}
    </View>
  );
}

function EvseRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.evseRow}>
      <View style={[styles.evseIndicator, { backgroundColor: color }]} />
      <Text style={styles.evseLabel}>{label}</Text>
      <Text style={styles.evseCount}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoButton: { minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderColor: colors.overlayBorder, marginTop: 12 },
  handleLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  handleButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { height: 4, width: 44, borderRadius: 4, backgroundColor: colors.textSecondary },
  summary: { color: colors.textSecondary, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
  originButton: { minHeight: 48, padding: 12, backgroundColor: colors.elevated, borderRadius: 10, justifyContent: 'center' },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    flex: 1,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.overlayBorder,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  operator: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 48,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingVertical: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  availabilityText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  availabilityCount: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  evseGrid: {
    backgroundColor: colors.elevated,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  evseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  evseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  evseLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  evseCount: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingVertical: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sectionValue: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.elevated,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  freshnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  staleTag: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  staleText: {
    color: colors.warning,
  },
});
