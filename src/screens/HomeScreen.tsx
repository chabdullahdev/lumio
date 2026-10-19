/**
 * Home: today's recommended lesson, the upcoming queue, and the streak.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyView,
  ErrorView,
  LoadingView,
  MutedText,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '../components/ui';
import { useNavigation } from '../navigation/NavigationContext';
import { LogoMark } from '../components/logo';
import { UpdateCard } from '../components/update-card';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { HomeSnapshot, LessonSummary, ProfileSnapshot, QueueItem } from '../data/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) {
    return 'Good night';
  }
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function streakLabel(streak: HomeSnapshot['streak']): string {
  if (streak.current <= 0) {
    return 'No streak yet';
  }
  return `${streak.current}-day streak \u{1F525}`;
}

export function HomeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { api, useSample } = useSession();

  const [home, setHome] = useState<HomeSnapshot | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (error && !home) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  if (!home || !profile) {
    return (
      <Screen>
        <LoadingView message="Preparing your lessons\u2026" />
      </Screen>
    );
  }

  const firstName = profile.displayName?.trim().split(/\s+/)[0];

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => refresh()}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <LogoMark size={30} style={styles.headerLogo} />
          <View style={styles.headerText}>
            <MutedText>{greeting()}</MutedText>
            <Text style={styles.headerName}>{firstName ?? 'Welcome back'}</Text>
          </View>
        </View>
        <Pill
          label={streakLabel(home.streak)}
          tone={home.streak.current > 0 ? 'accent' : 'neutral'}
        />
      </View>

      <UpdateCard />

      {home.next ? (
        <NextLessonCard
          item={home.next}
          onStart={() => navigation.push({ name: 'lesson', lessonId: home.next!.lesson.id })}
        />
      ) : home.sampleLibraryExhausted ? (
        <Card style={styles.emptyCard}>
          <EmptyView
            title="You finished the sample library"
            message="Every sample lesson is complete. Real lessons come from the generation pipeline — connect the backend and they will arrive in your queue."
            actionLabel="Review your topics"
            onAction={() => navigation.push({ name: 'topics' })}
          />
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <EmptyView
            title="Your next lessons are being prepared"
            message={
              useSample
                ? 'Sample lessons will appear here shortly.'
                : 'LUMIO is generating lessons from your topics. This usually takes a couple of minutes — pull down to check again.'
            }
            actionLabel="Check again"
            onAction={() => refresh()}
          />
        </Card>
      )}

      {home.upcoming.length > 0 ? (
        <>
          <SectionTitle>Upcoming lessons</SectionTitle>
          {home.upcoming.map(item => (
            <UpcomingRow
              key={item.queueId ?? `${item.position}`}
              item={item}
              onPress={() => navigation.push({ name: 'lesson', lessonId: item.lesson.id })}
            />
          ))}
        </>
      ) : null}

      <SectionTitle>Your progress</SectionTitle>
      <Card>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{home.lessonsCompleted}</Text>
            <Text style={styles.statLabel}>lessons read</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{home.streak.longest}</Text>
            <Text style={styles.statLabel}>longest streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.conceptsCovered}</Text>
            <Text style={styles.statLabel}>concepts covered</Text>
          </View>
        </View>
      </Card>

      {useSample ? (
        <View style={styles.sampleNote}>
          <Pill label="Sample library" tone="warning" />
          <MutedText style={styles.sampleNoteText}>
            These lessons are placeholders with real source references, shown while the
            lesson generator is being connected. Progress made here is local to this
            device.
          </MutedText>
        </View>
      ) : null}
    </Screen>
  );
}

function NextLessonCard({
  item,
  onStart,
}: {
  item: QueueItem;
  onStart: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const lesson: LessonSummary = item.lesson;

  return (
    <Card style={styles.hero}>
      <View style={styles.heroMeta}>
        <Pill label={lesson.categoryName ?? 'Lesson'} tone="accent" />
        <MutedText>{lesson.estimatedMinutes} min read</MutedText>
      </View>
      <Text style={styles.heroTitle}>{lesson.title}</Text>
      {lesson.summary ? <Text style={styles.heroSummary}>{lesson.summary}</Text> : null}
      <PrimaryButton
        label="Start lesson"
        onPress={onStart}
        style={styles.heroButton}
      />
      {lesson.isSample ? (
        <Text style={styles.heroSampleLabel}>Sample lesson</Text>
      ) : null}
    </Card>
  );
}

function UpcomingRow({ item, onPress }: { item: QueueItem; onPress: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.upcomingRow, pressed && styles.upcomingRowPressed]}
    >
      <View style={styles.upcomingNumberWrap}>
        <Text style={styles.upcomingNumber}>{item.position}</Text>
      </View>
      <View style={styles.upcomingBody}>
        <Text style={styles.upcomingTitle} numberOfLines={2}>
          {item.lesson.title}
        </Text>
        <MutedText>
          {item.lesson.categoryName ?? 'Lesson'} · {item.lesson.estimatedMinutes} min
        </MutedText>
      </View>
      <Text style={styles.upcomingChevron}>{'\u203A'}</Text>
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing(5),
    },
    headerText: {
      flexShrink: 1,
    },
    headerBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    headerLogo: {
      marginRight: theme.spacing(3),
    },
    headerName: {
      fontSize: theme.type.title,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: theme.spacing(1),
    },
    hero: {
      marginTop: theme.spacing(6),
      padding: theme.spacing(5),
      backgroundColor: theme.colors.surfaceElevated,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(4),
    },
    heroTitle: {
      fontSize: 22,
      lineHeight: 29,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    heroSummary: {
      marginTop: theme.spacing(3),
      fontSize: theme.type.small + 1,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
    heroButton: {
      marginTop: theme.spacing(5),
    },
    heroSampleLabel: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.tiny,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    emptyCard: {
      marginTop: theme.spacing(6),
      paddingVertical: theme.spacing(2),
    },
    upcomingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing(3),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    upcomingRowPressed: {
      opacity: 0.7,
    },
    upcomingNumberWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing(3),
    },
    upcomingNumber: {
      fontSize: theme.type.tiny,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    upcomingBody: {
      flex: 1,
    },
    upcomingTitle: {
      fontSize: theme.type.small + 1,
      fontWeight: '600',
      lineHeight: 21,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    upcomingChevron: {
      fontSize: 24,
      color: theme.colors.textMuted,
      marginLeft: theme.spacing(2),
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
    sampleNote: {
      marginTop: theme.spacing(6),
      alignItems: 'center',
    },
    sampleNoteText: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.tiny,
      lineHeight: 17,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  });
}
