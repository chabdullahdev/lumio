/**
 * Onboarding: choose the broad subjects LUMIO should prepare lessons for.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorView, LoadingView, MutedText, PrimaryButton, Screen } from '../components/ui';
import { TopicGrid } from '../components/topic-grid';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';
import type { Topic } from '../data/types';

export function OnboardingScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { api, markOnboarded } = useSession();

  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setTopics(null);
    setLoadError(null);
    try {
      setTopics(await api.getTopics());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const minimumTopics = topics && topics.length >= 3 ? 3 : 1;

  const toggle = (topicId: string) => {
    setSelected(current =>
      current.includes(topicId) ? current.filter(id => id !== topicId) : [...current, topicId],
    );
    setSaveError(null);
  };

  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.completeOnboarding(selected);
      markOnboarded();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <Screen>
        <ErrorView message={loadError} onRetry={() => load()} />
      </Screen>
    );
  }

  if (!topics) {
    return (
      <Screen>
        <LoadingView message="Loading topics\u2026" />
      </Screen>
    );
  }

  if (topics.length === 0) {
    return (
      <Screen>
        <ErrorView
          message="No approved topics are available yet. The knowledge library needs to be seeded before onboarding can continue."
          onRetry={() => load()}
        />
      </Screen>
    );
  }

  const enough = selected.length >= minimumTopics;

  return (
    <Screen
      scroll
      bottom={
        <View>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <PrimaryButton
            label={enough ? 'Start learning' : `Choose at least ${minimumTopics}`}
            onPress={() => submit()}
            disabled={!enough}
            loading={saving}
          />
        </View>
      }
    >
      <Text style={styles.title}>What do you want to learn about?</Text>
      <MutedText style={styles.subtitle}>
        Pick at least {minimumTopics} subjects. LUMIO prepares your lessons from these
        and adjusts as you read — you can change them any time.
      </MutedText>

      <TopicGrid
        topics={topics}
        selectedIds={selected}
        onToggle={toggle}
      />

      <Text style={styles.counter}>
        {selected.length === 0
          ? 'Nothing selected yet'
          : `${selected.length} selected`}
      </Text>
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    title: {
      fontSize: theme.type.title,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginTop: theme.spacing(8),
    },
    subtitle: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(6),
    },
    counter: {
      marginTop: theme.spacing(3),
      fontSize: theme.type.tiny,
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
