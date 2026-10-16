/**
 * Lesson reader.
 *
 * Renders the ordered content blocks with comfortable reading typography and
 * tracks reading progress by the furthest block the user has scrolled past,
 * saved (throttled) through the data API. Opening the lesson marks it active
 * in the queue; completing it happens on the takeaways screen.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorView, LoadingView, Pill, ProgressBar } from '../components/ui';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { LessonBlock, LessonContent } from '../data/types';

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { api } = useSession();

  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [furthestBlock, setFurthestBlock] = useState(0);

  const offsetsRef = useRef<number[]>([]);
  const furthestRef = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [content] = await Promise.all([
        api.getLesson(lessonId),
        api.markOpened(lessonId).catch(openError => {
          // Opening must never block reading; progress saves will retry later.
          console.warn('Could not record lesson opened:', openError);
        }),
      ]);
      setLesson(content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [api, lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const scheduleSave = useCallback(
    (blockIndex: number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        api.saveProgress(lessonId, blockIndex).catch(saveError => {
          console.warn('Could not save reading progress:', saveError);
        });
      }, 1200);
    },
    [api, lessonId],
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!lesson) {
      return;
    }
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const cutoff = contentOffset.y + layoutMeasurement.height * 0.8;
    let index = 0;
    for (let i = 0; i < offsetsRef.current.length; i++) {
      const offset = offsetsRef.current[i];
      if (typeof offset === 'number' && offset <= cutoff) {
        index = i;
      }
    }
    if (index > furthestRef.current) {
      furthestRef.current = index;
      setFurthestBlock(index);
      scheduleSave(index);
    }
  };

  if (error) {
    return (
      <ScreenlessTopBar title="Lesson" onBack={() => navigation.pop()}>
        <ErrorView message={error} onRetry={() => load()} />
      </ScreenlessTopBar>
    );
  }

  if (!lesson) {
    return (
      <ScreenlessTopBar title="Lesson" onBack={() => navigation.pop()}>
        <LoadingView message="Opening lesson\u2026" />
      </ScreenlessTopBar>
    );
  }

  const totalBlocks = lesson.blocks.length;
  const ratio = totalBlocks > 0 ? (furthestBlock + 1) / totalBlocks : 0;
  const minutesLeft = Math.max(1, Math.round(lesson.estimatedMinutes * (1 - ratio)));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.pop()}
          accessibilityRole="button"
          style={styles.backButton}
          hitSlop={8}
        >
          <Text style={styles.backLabel}>{'\u2039'} Back</Text>
        </Pressable>
        <Text style={styles.topBarMeta}>{minutesLeft} min left</Text>
      </View>
      <View style={styles.progressWrap}>
        <ProgressBar ratio={ratio} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={48}
      >
        <View style={styles.titleBlock}>
          {lesson.categoryName ? (
            <Pill label={lesson.categoryName} tone="accent" />
          ) : null}
          <Text style={styles.title}>{lesson.title}</Text>
          {lesson.isSample ? (
            <Text style={styles.sampleLabel}>Sample lesson</Text>
          ) : null}
        </View>

        {lesson.blocks.map((block, index) => (
          <View
            key={index}
            onLayout={event => {
              offsetsRef.current[index] = event.nativeEvent.layout.y;
            }}
          >
            <Block block={block} />
          </View>
        ))}

        <View style={styles.endSpacer} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => navigation.push({ name: 'takeaways', lessonId })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.finishButton, pressed && styles.finishPressed]}
        >
          <Text style={styles.finishLabel}>I{'\u2019'}ve finished — review takeaways</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Minimal chrome for loading/error states that still need a way back. */
function ScreenlessTopBar({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.backButton} hitSlop={8}>
          <Text style={styles.backLabel}>{'\u2039'} Back</Text>
        </Pressable>
        <Text style={styles.topBarMeta}>{title}</Text>
      </View>
      <View style={styles.flexContent}>{children}</View>
    </SafeAreaView>
  );
}

function Block({ block }: { block: LessonBlock }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (block.type === 'heading') {
    return <Text style={styles.heading}>{block.text}</Text>;
  }
  if (block.type === 'quote') {
    return (
      <View style={styles.quoteWrap}>
        <View style={styles.quoteBar} />
        <View style={styles.quoteBody}>
          <Text style={styles.quoteText}>{block.text}</Text>
          {block.attribution ? (
            <Text style={styles.quoteAttribution}>— {block.attribution}</Text>
          ) : null}
        </View>
      </View>
    );
  }
  return <Text style={styles.paragraph}>{block.text}</Text>;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flexContent: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing(5),
      paddingVertical: theme.spacing(2),
    },
    backButton: {
      paddingVertical: theme.spacing(2),
      paddingRight: theme.spacing(3),
    },
    backLabel: {
      fontSize: theme.type.body,
      fontWeight: '600',
      color: theme.colors.accent,
    },
    topBarMeta: {
      fontSize: theme.type.tiny,
      color: theme.colors.textSecondary,
    },
    progressWrap: {
      paddingHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(2),
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing(5),
      paddingBottom: theme.spacing(8),
    },
    titleBlock: {
      paddingTop: theme.spacing(4),
      paddingBottom: theme.spacing(4),
    },
    title: {
      marginTop: theme.spacing(3),
      fontSize: 27,
      lineHeight: 34,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    sampleLabel: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.tiny,
      color: theme.colors.textMuted,
    },
    heading: {
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(3),
      fontSize: 20,
      lineHeight: 27,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    paragraph: {
      marginBottom: theme.spacing(4),
      fontSize: 17,
      lineHeight: 28,
      color: theme.colors.textPrimary,
    },
    quoteWrap: {
      flexDirection: 'row',
      marginBottom: theme.spacing(4),
    },
    quoteBar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.accent,
      marginRight: theme.spacing(4),
    },
    quoteBody: {
      flex: 1,
    },
    quoteText: {
      fontSize: 17,
      lineHeight: 27,
      fontStyle: 'italic',
      color: theme.colors.textPrimary,
    },
    quoteAttribution: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.tiny,
      color: theme.colors.textSecondary,
    },
    endSpacer: {
      height: theme.spacing(6),
    },
    bottomBar: {
      paddingHorizontal: theme.spacing(5),
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(4),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    finishButton: {
      minHeight: 52,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing(5),
    },
    finishPressed: {
      opacity: 0.85,
    },
    finishLabel: {
      fontSize: theme.type.body,
      fontWeight: '700',
      color: theme.colors.accentText,
    },
  });
}
