/**
 * Topic picker grid shared by onboarding and the profile's topic editor.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { Topic } from '../data/types';

const TOPIC_EMOJI: Record<string, string> = {
  science: '\u{1F52C}',
  history: '\u{1F3DB}\u{FE0F}',
  psychology: '\u{1F9E0}',
  islam: '\u{1F54C}',
  geopolitics: '\u{1F30D}',
  politics: '\u2696\u{FE0F}',
};

export function topicEmoji(topic: Topic): string {
  return (topic.slug && TOPIC_EMOJI[topic.slug]) || '\u{1F4DA}';
}

export function TopicGrid({
  topics,
  selectedIds,
  onToggle,
}: {
  topics: Topic[];
  selectedIds: string[];
  onToggle: (topicId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selected = new Set(selectedIds);

  return (
    <View style={styles.grid}>
      {topics.map(topic => {
        const isSelected = selected.has(topic.id);
        return (
          <Pressable
            key={topic.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onToggle(topic.id)}
            style={({ pressed }) => [
              styles.tile,
              isSelected && styles.tileSelected,
              pressed && styles.tilePressed,
            ]}
          >
            <Text style={styles.tileEmoji}>{topicEmoji(topic)}</Text>
            <Text style={[styles.tileName, isSelected && styles.tileNameSelected]}>
              {topic.name}
            </Text>
            {topic.description ? (
              <Text style={styles.tileDescription} numberOfLines={3}>
                {topic.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    tile: {
      width: '48.5%',
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing(4),
      marginBottom: theme.spacing(3),
      minHeight: 118,
    },
    tileSelected: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
    tilePressed: {
      opacity: 0.85,
    },
    tileEmoji: {
      fontSize: 24,
      marginBottom: theme.spacing(2),
    },
    tileName: {
      fontSize: theme.type.small + 1,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    tileNameSelected: {
      color: theme.colors.textPrimary,
    },
    tileDescription: {
      marginTop: theme.spacing(1),
      fontSize: theme.type.tiny,
      lineHeight: 17,
      color: theme.colors.textSecondary,
    },
  });
}
