/**
 * Welcome screen: brand, promise, and the entry points into the app
 * (create account / sign in / sample lessons).
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen } from '../components/ui';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import { brand, type Theme } from '../theme';

const PROMISES: { icon: string; text: string }[] = [
  { icon: '\u23F1\uFE0F', text: '15-minute reading lessons that fit your day' },
  { icon: '\u{1F3AF}', text: 'Three lessons prepared ahead, chosen for your interests' },
  { icon: '\u{1F50D}', text: 'Grounded in real sources you can trace' },
];

export function WelcomeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { liveConfigured, enterSampleMode } = useSession();

  const startSample = async () => {
    await enterSampleMode();
    navigation.push({ name: 'onboarding' });
  };

  return (
    <Screen
      scroll
      bottom={
        <View>
          {liveConfigured ? (
            <PrimaryButton
              label="Create free account"
              onPress={() => navigation.push({ name: 'auth', mode: 'signUp' })}
            />
          ) : (
            <PrimaryButton label="Get started" onPress={() => startSample()} />
          )}
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>{'\u{1F4D6}'}</Text>
        </View>
        <Text style={styles.name}>{brand.name}</Text>
        <Text style={styles.tagline}>{brand.tagline}</Text>

        <View style={styles.promises}>
          {PROMISES.map(item => (
            <View key={item.text} style={styles.promiseRow}>
              <Text style={styles.promiseIcon}>{item.icon}</Text>
              <Text style={styles.promiseText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {liveConfigured ? (
          <>
            <PrimaryButton
              label="I already have an account"
              onPress={() => navigation.push({ name: 'auth', mode: 'signIn' })}
              variant="secondary"
              style={styles.footerButton}
            />
            <PrimaryButton
              label="Explore sample lessons"
              onPress={() => startSample()}
              variant="ghost"
              style={styles.footerButtonSmall}
            />
            <Text style={styles.footnote}>
              Sample lessons are placeholders with real sources, shown while the lesson
              generator is being connected.
            </Text>
          </>
        ) : (
          <Text style={styles.footnote}>
            Preview build: LUMIO is not connected to its backend yet, so it runs on a
            sample library (clearly labelled inside).
          </Text>
        )}
      </View>
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    hero: {
      alignItems: 'center',
      paddingTop: theme.spacing(14),
    },
    badge: {
      width: 76,
      height: 76,
      borderRadius: 22,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing(5),
    },
    badgeEmoji: {
      fontSize: 36,
    },
    name: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: 8,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    tagline: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    promises: {
      alignSelf: 'stretch',
      marginTop: theme.spacing(10),
    },
    promiseRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing(4),
    },
    promiseIcon: {
      fontSize: 20,
      marginRight: theme.spacing(3),
      marginTop: 1,
    },
    promiseText: {
      flex: 1,
      fontSize: theme.type.body,
      lineHeight: 23,
      color: theme.colors.textPrimary,
    },
    footer: {
      flexGrow: 1,
      justifyContent: 'flex-end',
      paddingTop: theme.spacing(10),
    },
    footerButton: {
      marginBottom: theme.spacing(1),
    },
    footerButtonSmall: {
      marginBottom: theme.spacing(1),
    },
    footnote: {
      marginTop: theme.spacing(2),
      fontSize: theme.type.tiny,
      lineHeight: 17,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  });
}
