/**
 * Topic editor: change the subjects LUMIO prepares lessons for.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorView, LoadingView, MutedText, PrimaryButton, Screen } from '../components/ui';
import { TopicGrid } from '../components/topic-grid';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { Topic } from '../data/types';

export function TopicsEditorScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { api, useSample } = useSession();

  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allTopics, profile] = await Promise.all([api.getTopics(), api.getProfile()]);
      setTopics(allTopics);
      setSelected(profile.interests.map(topic => topic.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (topicId: string) => {
    setSelected(current =>
      current.includes(topicId) ? current.filter(id => id !== topicId) : [...current, topicId],
    );
    setSaveError(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateInterests(selected);
      navigation.pop();
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : String(saveFailure));
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  if (!topics) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      bottom={
        <View>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <PrimaryButton
            label="Save topics"
            onPress={() => save()}
            disabled={selected.length === 0}
            loading={saving}
          />
        </View>
      }
    >
      <Text style={styles.title}>Your topics</Text>
      <MutedText style={styles.subtitle}>
        {useSample
          ? 'Sample mode: the sample library has one lesson per topic.'
          : 'New lessons for added topics arrive as the generator prepares them.'}
      </MutedText>
      <TopicGrid topics={topics} selectedIds={selected} onToggle={toggle} />
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    title: {
      marginTop: theme.spacing(8),
      fontSize: theme.type.title,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(6),
    },
    error: {
      fontSize: theme.type.small,
      lineHeight: 21,
      color: theme.colors.danger,
      marginBottom: theme.spacing(3),
    },
  });
}
