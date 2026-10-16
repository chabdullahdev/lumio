/**
 * Home screen — LUMIO's foundation status.
 *
 * During Phase 1 this screen shows whether the app is correctly wired up
 * (environment configuration, Supabase connection) so setup problems are
 * visible immediately in the preview. It will be replaced by the real home
 * experience (today's lesson recommendation) in a later phase.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { configProblems, isSupabaseConfigured, supabaseConfig } from '../lib/env';
import { brand, createTheme, type Theme } from '../theme';

function supabaseStatusValue(): string {
  if (!isSupabaseConfigured || !supabaseConfig) {
    return 'Not configured';
  }
  try {
    return new URL(supabaseConfig.url).host;
  } catch {
    return 'Configured';
  }
}

export function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const theme = useMemo(() => createTheme(isDark), [isDark]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>📖</Text>
        </View>
        <Text style={styles.title}>{brand.name}</Text>
        <Text style={styles.subtitle}>{brand.tagline}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Project foundation</Text>
            <Text style={[styles.value, styles.valueSuccess]}>In place</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Supabase connection</Text>
            <Text
              style={[
                styles.value,
                isSupabaseConfigured ? styles.valueSuccess : styles.valueWarning,
              ]}
            >
              {supabaseStatusValue()}
            </Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.label}>Reading lessons</Text>
            <Text style={[styles.value, styles.valueMuted]}>Next phase</Text>
          </View>
        </View>

        {!isSupabaseConfigured && configProblems.length > 0 ? (
          <View style={styles.problems}>
            {configProblems.map(problem => (
              <Text key={problem} style={styles.problem}>
                • {problem}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>Phase 1 · Foundation</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    badge: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.isDark ? 'rgba(84, 227, 110, 0.12)' : 'rgba(84, 227, 110, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    badgeEmoji: {
      fontSize: 34,
    },
    title: {
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: 6,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginTop: 32,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomColor: theme.colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    label: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    value: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 12,
      flexShrink: 1,
      textAlign: 'right',
    },
    valueSuccess: {
      color: theme.colors.success,
    },
    valueWarning: {
      color: theme.colors.warning,
    },
    valueMuted: {
      color: theme.colors.textSecondary,
    },
    problems: {
      alignSelf: 'stretch',
      marginTop: 16,
    },
    problem: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.warning,
      marginBottom: 6,
    },
    footer: {
      marginTop: 28,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
  });
}
