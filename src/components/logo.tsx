/**
 * LUMIO brand marks.
 *
 * Rendered from the designer's artwork (regenerate with `npm run icons`):
 * the ink mark on light surfaces and the green mark on dark ones, so the
 * logo stays legible in both themes. The wordmark is live text and follows
 * the theme colours automatically.
 */
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/use-theme';
import { brand, type Theme } from '../theme';

const MARK_INK = require('../assets/logo-ink.png');
const MARK_GREEN = require('../assets/logo-green.png');

/** The LUMIO glyph, auto-coloured for the current theme. */
export function LogoMark({
  size = 28,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const theme = useTheme();
  return (
    <Image
      source={theme.isDark ? MARK_GREEN : MARK_INK}
      accessibilityLabel={brand.name}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}

/** Mark + wordmark, for a hero or header lockup. */
export function LogoLockup({
  markSize = 40,
  textSize,
  style,
}: {
  markSize?: number;
  textSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.lockup, style]}>
      <LogoMark size={markSize} />
      <Text style={[styles.wordmark, { fontSize: textSize ?? markSize * 0.72 }]}>
        {brand.name}
      </Text>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    lockup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    wordmark: {
      marginLeft: theme.spacing(3),
      fontWeight: '800',
      letterSpacing: 2,
      color: theme.colors.textPrimary,
    },
  });
}
