/**
 * In-app update card.
 *
 * `banner` (Home): appears only when there is something to do.
 * `settings` (Profile): always shows the installed version and a manual check.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Card, MutedText, Pill, PrimaryButton } from './ui';
import { useTheme } from '../lib/use-theme';
import { formatBytes } from '../lib/updates';
import { useUpdates } from '../state/updates';
import type { Theme } from '../theme';

const ACTIONABLE = new Set(['available', 'downloading', 'installing', 'permission', 'error']);

export function UpdateCard({
  mode = 'banner',
  style,
}: {
  mode?: 'banner' | 'settings';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { phase, latest, currentVersionName, progress, error, check, install, openSettings } =
    useUpdates();

  if (phase === 'unsupported') {
    return null;
  }
  if (mode === 'banner' && !ACTIONABLE.has(phase)) {
    return null;
  }

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <Card style={[mode === 'banner' ? styles.banner : null, style]}>
      <View style={styles.topRow}>
        <Pill
          label={phase === 'up-to-date' ? 'Up to date' : 'App update'}
          tone={phase === 'up-to-date' ? 'accent' : 'warning'}
        />
        <MutedText>{currentVersionName ? `v${currentVersionName}` : ' '}</MutedText>
      </View>

      {phase === 'idle' || phase === 'checking' ? (
        <MutedText style={styles.body}>
          {phase === 'checking'
            ? 'Checking the release channel…'
            : 'LUMIO checks for updates automatically when it starts.'}
        </MutedText>
      ) : null}

      {phase === 'up-to-date' ? (
        <MutedText style={styles.body}>You are running the latest version of LUMIO.</MutedText>
      ) : null}

      {latest && ACTIONABLE.has(phase) ? (
        <>
          <Text style={styles.title}>LUMIO {latest.versionName} is available</Text>
          {phase === 'downloading' ? (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${percent}%` as `${number}%` }]}
                />
              </View>
              <MutedText style={styles.body}>Downloading… {percent}%</MutedText>
            </>
          ) : (
            <MutedText style={styles.body}>
              {phase === 'installing'
                ? 'Opening the Android installer…'
                : `${formatBytes(latest.size)} · Android will ask you to confirm the install.`}
            </MutedText>
          )}

          {phase === 'available' ? (
            <PrimaryButton
              label="Download & install"
              onPress={() => install()}
              style={styles.button}
            />
          ) : null}

          {phase === 'permission' ? (
            <>
              <MutedText style={styles.body}>
                Android needs your permission before LUMIO can open the installer.
              </MutedText>
              <PrimaryButton
                label="Open Android settings"
                onPress={() => openSettings()}
                style={styles.button}
              />
            </>
          ) : null}

          {phase === 'error' && error ? (
            <>
              <Text style={styles.error}>{error}</Text>
              <PrimaryButton
                label="Try again"
                onPress={() => install()}
                variant="secondary"
                style={styles.button}
              />
            </>
          ) : null}
        </>
      ) : null}

      {phase === 'error' && !latest ? (
        <>
          <Text style={styles.error}>{error ?? 'The update check failed.'}</Text>
          <PrimaryButton
            label="Check again"
            onPress={() => check({ manual: true })}
            variant="secondary"
            style={styles.button}
          />
        </>
      ) : null}

      {mode === 'settings' && (phase === 'idle' || phase === 'up-to-date' || phase === 'checking') ? (
        <PrimaryButton
          label="Check for updates"
          onPress={() => check({ manual: true })}
          variant="secondary"
          loading={phase === 'checking'}
          style={styles.button}
        />
      ) : null}
    </Card>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      marginTop: theme.spacing(5),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(3),
    },
    title: {
      fontSize: theme.type.body,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    body: {
      marginTop: theme.spacing(2),
    },
    button: {
      marginTop: theme.spacing(4),
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
      marginTop: theme.spacing(3),
    },
    progressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },
    error: {
      marginTop: theme.spacing(3),
      fontSize: theme.type.small,
      lineHeight: 20,
      color: theme.colors.danger,
    },
  });
}
