/**
 * Design tokens for the map and station UI.
 * Based on docs/DESIGN_SYSTEM.md color tokens.
 */

export const colors = {
  // Background
  main: '#101315',
  surface: '#1B2023',
  elevated: '#252C30',

  // Text
  textPrimary: '#F6F8F8',
  textSecondary: '#A6B0B4',
  textMuted: '#738087',

  // Brand
  accent: '#C7F36B',
  accentForeground: '#101315',

  // Status - availability
  available: '#39C891',
  warning: '#F3B34C',
  unavailable: '#EF6C73',
  info: '#68B8EF',
  location: '#2684FF',
  white: '#FFFFFF',
  cluster: '#354248',

  // Map overlay
  overlayBackground: 'rgba(16, 19, 21, 0.92)',
  overlayBorder: 'rgba(255, 255, 255, 0.08)',
} as const;

/** Map marker colors by availability category. */
export const availabilityColors: Record<string, string> = {
  available: colors.available,
  occupied: colors.warning,
  unavailable: colors.unavailable,
  unknown: colors.textMuted,
};

/** Human-readable availability labels. */
export const availabilityLabels: Record<string, string> = {
  available: 'Available',
  occupied: 'In Use',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
};

/** Spacing scale (4-based). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Border radius values. */
export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;
