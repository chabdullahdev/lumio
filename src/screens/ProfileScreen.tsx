/**
 * Profile tab: progress, streak history, settings and account.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  Card,
  ErrorView,
  Field,
  LoadingView,
  MutedText,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '../components/ui';
import { topicEmoji } from '../components/topic-grid';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { UpdateCard } from '../components/update-card';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { ProfileSnapshot } from '../data/types';

export function ProfileScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { api, useSample, liveConfigured, email, signOut, exitSampleMode } = useSession();

  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setNameDraft(data.displayName ?? '');
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const saveName = async () => {
    setSettingSaving(true);
    setSettingsMessage(null);
    try {
      await api.updateSettings({ displayName: nameDraft.trim() || null });
      setSettingsMessage('Saved.');
      await load();
    } catch (saveError) {
      setSettingsMessage(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSettingSaving(false);
    }
  };

  const toggleReminders = async (value: boolean) => {
    if (!profile) {
      return;
    }
    setProfile({ ...profile, remindersEnabled: value });
    try {
      await api.updateSettings({ remindersEnabled: value });
    } catch (saveError) {
      setSettingsMessage(saveError instanceof Error ? saveError.message : String(saveError));
      setProfile({ ...profile, remindersEnabled: !value });
    }
  };

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  const maxActivity = Math.max(1, ...profile.activity.map(day => day.lessons));

  return (
    <Screen scroll>
      <Text style={styles.title}>You</Text>
      <MutedText style={styles.subtitle}>
        {useSample
          ? 'Sample mode — progress is stored on this device.'
          : email ?? 'Signed in'}
      </MutedText>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.streak.current}</Text>
            <Text style={styles.statLabel}>current streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.lessonsCompleted}</Text>
            <Text style={styles.statLabel}>lessons read</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.conceptsCovered}</Text>
            <Text style={styles.statLabel}>concepts covered</Text>
          </View>
        </View>
        <View style={styles.chartWrap}>
          <Text style={styles.chartCaption}>Last 14 days</Text>
          <View style={styles.chart}>
            {profile.activity.map(day => {
              const barStyle = {
                height: day.lessons > 0 ? 8 + (day.lessons / maxActivity) * 26 : 3,
                backgroundColor:
                  day.lessons > 0 ? theme.colors.accent : theme.colors.border,
              };
              return (
                <View
                  key={day.date}
                  accessibilityLabel={`${day.date}: ${day.lessons} lesson${day.lessons === 1 ? '' : 's'}`}
                  style={[styles.chartBar, barStyle]}
                />
              );
            })}
          </View>
        </View>
      </Card>

      <SectionTitle>Your topics</SectionTitle>
      <View style={styles.topicRow}>
        {profile.interests.map(topic => (
          <View key={topic.id} style={styles.topicChip}>
            <Text style={styles.topicEmoji}>{topicEmoji(topic)}</Text>
            <Text style={styles.topicName}>{topic.name}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => navigation.push({ name: 'topics' })}
        hitSlop={8}
        style={styles.editLink}
      >
        <Text style={styles.editLinkText}>Edit topics</Text>
      </Pressable>

      <SectionTitle>Settings</SectionTitle>
      <Card>
        <Field
          label="Display name"
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="How should LUMIO greet you?"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <PrimaryButton
          label="Save name"
          onPress={() => saveName()}
          variant="secondary"
          loading={settingSaving}
        />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Streak reminders</Text>
            <MutedText>
              Encouragement only — LUMIO never uses guilt-driven notifications.
            </MutedText>
          </View>
          <Switch
            value={profile.remindersEnabled}
            onValueChange={value => toggleReminders(value)}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
            thumbColor={theme.colors.surfaceElevated}
          />
        </View>
        {settingsMessage ? <Text style={styles.settingsMessage}>{settingsMessage}</Text> : null}
      </Card>

      <SectionTitle>App updates</SectionTitle>
      <UpdateCard mode="settings" />

      <SectionTitle>Account</SectionTitle>
      <Card>
        <View style={styles.accountRow}>
          <MutedText>Data source</MutedText>
          <Pill
            label={useSample ? 'Sample library' : 'Supabase account'}
            tone={useSample ? 'warning' : 'accent'}
          />
        </View>
        <MutedText style={styles.timezone}>Time zone: {profile.timezone}</MutedText>
        {!useSample ? (
          <PrimaryButton
            label="Sign out"
            onPress={() => signOut()}
            variant="danger"
            style={styles.accountButton}
          />
        ) : liveConfigured ? (
          <PrimaryButton
            label="Exit sample mode"
            onPress={() => exitSampleMode()}
            variant="secondary"
            style={styles.accountButton}
          />
        ) : (
          <MutedText style={styles.timezone}>
            Connect the Supabase backend to create a real account and generate real
            lessons.
          </MutedText>
        )}
      </Card>

      <Text style={styles.footnote}>Less scrolling. More understanding.</Text>
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    title: {
      marginTop: theme.spacing(5),
      fontSize: theme.type.title,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      marginTop: theme.spacing(2),
    },
    statsCard: {
      marginTop: theme.spacing(6),
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    statLabel: {
      marginTop: theme.spacing(1),
      fontSize: theme.type.tiny,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 32,
      backgroundColor: theme.colors.border,
    },
    chartWrap: {
      marginTop: theme.spacing(5),
    },
    chartCaption: {
      fontSize: theme.type.tiny,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing(2),
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 36,
    },
    chartBar: {
      flex: 1,
      marginRight: 4,
      borderRadius: 2,
    },
    topicRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    topicChip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(2),
      marginRight: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    topicEmoji: {
      fontSize: 15,
      marginRight: theme.spacing(2),
    },
    topicName: {
      fontSize: theme.type.small,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    editLink: {
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing(2),
    },
    editLinkText: {
      fontSize: theme.type.small,
      fontWeight: '600',
      color: theme.colors.accent,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
    switchText: {
      flex: 1,
      paddingRight: theme.spacing(4),
    },
    switchLabel: {
      fontSize: theme.type.body,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing(1),
    },
    settingsMessage: {
      marginTop: theme.spacing(3),
      fontSize: theme.type.tiny,
      color: theme.colors.textSecondary,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timezone: {
      marginTop: theme.spacing(3),
    },
    accountButton: {
      marginTop: theme.spacing(4),
    },
    footnote: {
      marginTop: theme.spacing(8),
      fontSize: theme.type.tiny,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  });
}
