/**
 * Status overlay for loading, error, and stale-data states on the map.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from './tokens';

interface MapStatusProps {
  loading: boolean;
  error: string | null;
  stationCount: number;
  lastFetched: string | null;
  onRetry: () => void;
}

export function MapStatus({ loading, error, stationCount, onRetry }: MapStatusProps) {
  if (error) {
    return (
      <View style={[styles.banner, styles.errorBanner]}>
        <Text style={styles.bannerText}>
          Failed to load stations
        </Text>
        <Pressable
          onPress={onRetry}
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel="Retry loading stations"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && stationCount === 0) {
    return (
      <View style={[styles.banner, styles.loadingBanner]}>
        <Text style={styles.bannerText}>Loading charging stations…</Text>
      </View>
    );
  }

  if (stationCount === 0 && !loading) {
    return (
      <View style={[styles.banner, styles.emptyBanner]}>
        <Text style={styles.bannerText}>No stations in this area</Text>
      </View>
    );
  }

  // Show a subtle loading indicator when refreshing with existing data
  if (loading) {
    return (
      <View style={styles.loadingDot}>
        <View style={styles.dot} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 108, 115, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 108, 115, 0.3)',
  },
  loadingBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bannerText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: colors.elevated,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingDot: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
    width: 8,
    height: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
});
