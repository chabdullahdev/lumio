/**
 * Takeaways and sources, shown when the user finishes reading a lesson.
 *
 * "Finish lesson" is the only completion action: it records completion through
 * the data API (which updates streak/concepts/queue server-side in live mode)
 * and moves to the completion screen.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  ErrorView,
  LoadingView,
  MutedText,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '../components/ui';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { LessonContent, LessonSourceRef } from '../data/types';

const USAGE_LABELS: Record<LessonSourceRef['usage'], string> = {
  direct_quote: 'Direct quote',
  paraphrase: 'Paraphrased from',
  synthesis: 'Synthesised from',
};

export function TakeawaysScreen({ lessonId }: { lessonId: string }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { api } = useSession();

  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLesson(await api.getLesson(lessonId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [api, lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  const finish = async () => {
    if (!lesson) {
      return;
    }
    setFinishing(true);
    setFinishError(null);
    try {
      const summary = await api.completeLesson(lesson.id);
      navigation.replace({ name: 'complete', lessonId: lesson.id, summary });
    } catch (completeError) {
      setFinishError(
        completeError instanceof Error ? completeError.message : String(completeError),
      );
      setFinishing(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  if (!lesson) {
    return (
      <Screen>
        <LoadingView message="Collecting takeaways\u2026" />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      bottom={
        <View>
          {finishError ? <Text style={styles.error}>{finishError}</Text> : null}
          <PrimaryButton
            label="Finish lesson"
            onPress={() => finish()}
            loading={finishing}
          />
        </View>
      }
    >
      <Text style={styles.eyebrow}>Lesson complete when you{'\u2019'}re ready</Text>
      <Text style={styles.title}>{lesson.title}</Text>

      <SectionTitle>Key takeaways</SectionTitle>
      <View>
        {lesson.takeaways.map((takeaway, index) => (
          <View key={index} style={styles.takeawayRow}>
            <View style={styles.takeawayNumber}>
              <Text style={styles.takeawayNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.takeawayText}>{takeaway}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Sources</SectionTitle>
      <MutedText style={styles.sourcesIntro}>
        Every lesson is grounded in the sources below. If a lesson ever seems to drift
        from them, tell us — accuracy comes before everything else.
      </MutedText>
      {lesson.sources.map(source => (
        <SourceRow key={source.id} source={source} />
      ))}

      {lesson.isSample ? (
        <Text style={styles.sampleNote}>
          Sample lesson — replaces real generated lessons until the pipeline is connected.
        </Text>
      ) : null}
    </Screen>
  );
}

function SourceRow({ source }: { source: LessonSourceRef }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const openUrl = () => {
    if (source.url) {
      Linking.openURL(source.url).catch(() => {
        // Ignore: the URL is informational.
      });
    }
  };

  return (
    <Card style={styles.sourceCard}>
      <View style={styles.sourceHeader}>
        <Pill label={USAGE_LABELS[source.usage]} tone="neutral" />
        {source.pageLabel ? <MutedText>{source.pageLabel}</MutedText> : null}
      </View>
      <Text style={styles.sourceTitle}>{source.title}</Text>
      {source.authorLine ? (
        <MutedText style={styles.sourceAuthor}>{source.authorLine}</MutedText>
      ) : null}
      {source.quote ? <Text style={styles.sourceQuote}>{source.quote}</Text> : null}
      <View style={styles.sourceFooter}>
        {source.licenseLabel ? (
          <Text style={styles.sourceLicense}>{source.licenseLabel}</Text>
        ) : null}
        {source.url ? (
          <Pressable onPress={openUrl} hitSlop={8}>
            <Text style={styles.sourceLink}>Open source {'\u2197'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    eyebrow: {
      marginTop: theme.spacing(8),
      fontSize: theme.type.tiny,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.success,
    },
    title: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.title,
      lineHeight: 30,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    takeawayRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing(4),
    },
    takeawayNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing(3),
      marginTop: 2,
    },
    takeawayNumberText: {
      fontSize: theme.type.tiny,
      fontWeight: '800',
      color: theme.colors.success,
    },
    takeawayText: {
      flex: 1,
      fontSize: theme.type.body,
      lineHeight: 24,
      color: theme.colors.textPrimary,
    },
    sourcesIntro: {
      marginBottom: theme.spacing(4),
    },
    sourceCard: {
      marginBottom: theme.spacing(3),
    },
    sourceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(2),
    },
    sourceTitle: {
      fontSize: theme.type.small + 1,
      fontWeight: '700',
      lineHeight: 21,
      color: theme.colors.textPrimary,
    },
    sourceAuthor: {
      marginTop: theme.spacing(1),
      fontSize: theme.type.tiny,
      lineHeight: 17,
    },
    sourceQuote: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.small,
      fontStyle: 'italic',
      color: theme.colors.textPrimary,
    },
    sourceFooter: {
      marginTop: theme.spacing(3),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sourceLicense: {
      fontSize: theme.type.tiny,
      color: theme.colors.textMuted,
      flexShrink: 1,
    },
    sourceLink: {
      fontSize: theme.type.tiny,
      fontWeight: '700',
      color: theme.colors.accent,
    },
    sampleNote: {
      marginTop: theme.spacing(4),
      fontSize: theme.type.tiny,
      lineHeight: 17,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    error: {
      fontSize: theme.type.small,
      lineHeight: 21,
      color: theme.colors.danger,
      marginBottom: theme.spacing(3),
    },
  });
}
