/**
 * Theme hook: one place to read the current light/dark theme.
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { createTheme, type Theme } from '../theme';

export function useTheme(): Theme {
  const isDark = useColorScheme() === 'dark';
  return useMemo(() => createTheme(isDark), [isDark]);
}
