/**
 * Explore tab: the user's topics and everything currently in their queue.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  ErrorView,
  LoadingView,
  MutedText,
  Pill,
  Screen,
  SectionTitle,
} from '../components/ui';
import { topicEmoji } from '../components/topic-grid';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { HomeSnapshot, ProfileSnapshot } from '../data/types';

export function ExploreScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { api } = useSession();

  const [home, setHome] = useState<HomeSnapshot | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [homeData, profileData] = await Promise.all([api.getHome(), api.getProfile()]);
      setHome(homeData);
      setProfile(profileData);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  if (!home || !profile) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  const allItems = [...(home.next ? [home.next] : []), ...home.upcoming];

  return (
    <Screen scroll>
      <Text style={styles.title}>Explore</Text>
      <MutedText style={styles.subtitle}>
        Everything LUMIO has prepared for you, and the subjects shaping it.
      </MutedText>

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
        <Text style={styles.editLinkText}>Adjust your topics</Text>
      </Pressable>

      <SectionTitle>In your queue</SectionTitle>
      {allItems.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Nothing prepared right now</Text>
          <MutedText style={styles.emptyText}>
            LUMIO keeps up to three lessons ready. New ones appear here as they are
            generated for your topics.
          </MutedText>
        </Card>
      ) : (
        allItems.map(item => (
          <Pressable
            key={item.queueId ?? String(item.position)}
            onPress={() => navigation.push({ name: 'lesson', lessonId: item.lesson.id })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.queueRow, pressed && styles.queueRowPressed]}
          >
            <View style={styles.queueBody}>
              <Text style={styles.queueTitle}>{item.lesson.title}</Text>
              <MutedText>
                {item.lesson.categoryName ?? 'Lesson'} · {item.lesson.estimatedMinutes} min
              </MutedText>
            </View>
            {item.status === 'active' ? <Pill label="Reading" tone="accent" /> : null}
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </Pressable>
        ))
      )}

      <SectionTitle>Reading history</SectionTitle>
      <Card>
        <Text style={styles.historyLine}>
          {profile.lessonsCompleted === 0
            ? 'No lessons completed yet. Your first one is waiting on the home screen.'
            : `${profile.lessonsCompleted} lesson${profile.lessonsCompleted === 1 ? '' : 's'} completed · ${profile.conceptsCovered} concepts covered`}
        </Text>
        {profile.streak.lastCompletedOn ? (
          <MutedText style={styles.historyMeta}>
            Last completed {profile.streak.lastCompletedOn}
          </MutedText>
        ) : null}
      </Card>
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
    queueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing(4),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    queueRowPressed: {
      opacity: 0.7,
    },
    queueBody: {
      flex: 1,
      paddingRight: theme.spacing(3),
    },
    queueTitle: {
      fontSize: theme.type.body,
      fontWeight: '600',
      lineHeight: 22,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing(1),
    },
    chevron: {
      fontSize: 24,
      color: theme.colors.textMuted,
    },
    emptyTitle: {
      fontSize: theme.type.body,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    emptyText: {
      marginTop: theme.spacing(2),
    },
    historyLine: {
      fontSize: theme.type.body,
      lineHeight: 24,
      color: theme.colors.textPrimary,
    },
    historyMeta: {
      marginTop: theme.spacing(2),
    },
  });
}
