/**
 * Design tokens for the map and station UI.
 * Based on docs/DESIGN_SYSTEM.md color tokens.
 */

export const colors = {
  // Background
  main: '#F8FAF7',
  surface: '#FFFFFF',
  elevated: '#F0F4EF',

  // Text
  textPrimary: '#17221B',
  textSecondary: '#52615A',
  textMuted: '#607068',

  // Brand
  accent: '#C7F36B',
  accentForeground: '#17211E',
  accentSoft: '#F0F9E4',
  accentInk: '#36512B',
  markerAvailable: '#20B887',
  markerOccupied: '#E8A23E',
  markerUnavailable: '#E76E70',
  locationHalo: 'rgba(50,141,255,0.16)',
  shadow: 'rgba(23,33,30,0.10)',

  // Status - availability
  available: '#13795B',
  warning: '#8B590D',
  unavailable: '#B23D47',
  info: '#246CC0',
  location: '#328DFF',
  white: '#FFFFFF',
  cluster: '#FFFFFF',

  // Map overlay
  overlayBackground: 'rgba(255,255,255,0.96)',
  overlayBorder: '#E5EAE6',
} as const;

/** Map marker colors by availability category. */
export const availabilityColors: Record<string, string> = {
  available: colors.markerAvailable,
  occupied: colors.markerOccupied,
  unavailable: colors.markerUnavailable,
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
  sm: 12,
  md: 18,
  lg: 24,
  full: 9999,
} as const;

export const typography = { display: 30, section: 22, card: 20, body: 15, caption: 12 } as const;
export const motion = { press: 120, selection: 160, card: 220, panel: 280 } as const;
