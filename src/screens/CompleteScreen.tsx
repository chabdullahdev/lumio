/**
 * Completion screen: confirms the lesson is complete and shows the updated
 * streak, totals and the next prepared lesson.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, MutedText, Pill, PrimaryButton, Screen } from '../components/ui';
import { useNavigation } from '../navigation/NavigationContext';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { CompletionSummary } from '../data/types';

export function CompleteScreen({ summary }: { lessonId: string; summary: CompletionSummary }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();

  const { streak, lessonsCompleted, nextLesson } = summary;
  const streakLine =
    streak.current <= 1
      ? 'Streak started — come back tomorrow to keep it going.'
      : `${streak.current} days in a row. Nicely done.`;

  return (
    <Screen
      scroll
      bottom={
        <PrimaryButton label="Back to home" onPress={() => navigation.toMain('home')} />
      }
    >
      <View style={styles.hero}>
        <View style={styles.checkWrap}>
          <Text style={styles.check}>{'\u2713'}</Text>
        </View>
        <Text style={styles.title}>Lesson complete</Text>
        <MutedText style={styles.streakLine}>{streakLine}</MutedText>
      </View>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak.current}</Text>
            <Text style={styles.statLabel}>current streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak.longest}</Text>
            <Text style={styles.statLabel}>longest streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{lessonsCompleted}</Text>
            <Text style={styles.statLabel}>lessons read</Text>
          </View>
        </View>
      </Card>

      {nextLesson ? (
        <Card style={styles.nextCard}>
          <Pill label="Next up" tone="accent" />
          <Text style={styles.nextTitle}>{nextLesson.title}</Text>
          <MutedText style={styles.nextMeta}>
            {nextLesson.categoryName ?? 'Lesson'} · {nextLesson.estimatedMinutes} min
          </MutedText>
        </Card>
      ) : (
        <Card style={styles.nextCard}>
          <Pill label="Next up" tone="accent" />
          <Text style={styles.nextTitle}>Your next lesson is being prepared</Text>
          <MutedText style={styles.nextMeta}>
            It will appear on your home screen once it is ready.
          </MutedText>
        </Card>
      )}

      <Text style={styles.footnote}>
        LUMIO is designed for a steady pace, not bingeing — one lesson a day is enough.
      </Text>
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    hero: {
      alignItems: 'center',
      paddingTop: theme.spacing(12),
    },
    checkWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      fontSize: 38,
      fontWeight: '800',
      color: theme.colors.accentText,
    },
    title: {
      marginTop: theme.spacing(5),
      fontSize: theme.type.title,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    streakLine: {
      marginTop: theme.spacing(2),
      textAlign: 'center',
    },
    statsCard: {
      marginTop: theme.spacing(8),
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
    nextCard: {
      marginTop: theme.spacing(4),
    },
    nextTitle: {
      marginTop: theme.spacing(3),
      fontSize: theme.type.heading,
      lineHeight: 25,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    nextMeta: {
      marginTop: theme.spacing(2),
    },
    footnote: {
      marginTop: theme.spacing(6),
      fontSize: theme.type.tiny,
      lineHeight: 18,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  });
}
