/**
 * LUMIO design tokens.
 *
 * One place for brand colours, spacing and type so screens stay consistent as
 * the app grows. Light and dark mode share the same layout values; only the
 * colours change.
 */

export const brand = {
  name: 'LUMIO',
  tagline: 'Less scrolling. More understanding.',
  accent: '#54E36E',
  accentText: '#0b2912',
} as const;

export type Theme = {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    accentText: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
  spacing: (multiplier: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number };
  type: {
    display: number;
    title: number;
    heading: number;
    body: number;
    bodyLineHeight: number;
    small: number;
    tiny: number;
  };
};

export function createTheme(isDark: boolean): Theme {
  return {
    isDark,
    colors: {
      background: isDark ? '#0e1116' : '#ffffff',
      surface: isDark ? '#161b22' : '#f5f8f6',
      surfaceElevated: isDark ? '#1d242e' : '#ffffff',
      textPrimary: isDark ? '#f2f4f7' : '#11181c',
      textSecondary: isDark ? '#9aa4b2' : '#5b6470',
      textMuted: isDark ? '#6b7480' : '#8a929c',
      accent: brand.accent,
      accentSoft: isDark ? 'rgba(84, 227, 110, 0.12)' : 'rgba(84, 227, 110, 0.15)',
      accentText: brand.accentText,
      border: isDark ? '#232a33' : '#e2e8e4',
      success: isDark ? brand.accent : '#2f9e44',
      warning: isDark ? '#e3b341' : '#b7791f',
      danger: isDark ? '#f87171' : '#c92a2a',
    },
    spacing: multiplier => multiplier * 4,
    radius: { sm: 8, md: 12, lg: 16, xl: 22 },
    type: {
      display: 32,
      title: 24,
      heading: 18,
      body: 16,
      bodyLineHeight: 25,
      small: 14,
      tiny: 12,
    },
  };
}
