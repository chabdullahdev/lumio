/**
 * LUMIO design tokens.
 *
 * One place for brand colours and light/dark surfaces so screens stay
 * consistent as the app grows. Values here mirror the visual language of the
 * original starter screen (accent #54E36E).
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
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentText: string;
    border: string;
    success: string;
    warning: string;
  };
};

export function createTheme(isDark: boolean): Theme {
  return {
    isDark,
    colors: isDark
      ? {
          background: '#0e1116',
          surface: '#161b22',
          textPrimary: '#f2f4f7',
          textSecondary: '#9aa4b2',
          accent: brand.accent,
          accentText: brand.accentText,
          border: '#232a33',
          success: brand.accent,
          warning: '#e3b341',
        }
      : {
          background: '#ffffff',
          surface: '#f5f8f6',
          textPrimary: '#11181c',
          textSecondary: '#5b6470',
          accent: brand.accent,
          accentText: brand.accentText,
          border: '#e2e8e4',
          success: '#2f9e44',
          warning: '#b7791f',
        },
  };
}
