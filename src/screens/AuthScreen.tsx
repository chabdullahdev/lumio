/**
 * Sign in / create account screen (email + password).
 *
 * Supabase may be configured with email confirmation; in that case sign-up
 * succeeds without a session and this screen tells the user to confirm their
 * email before signing in.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, MutedText, PrimaryButton, Screen } from '../components/ui';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../state/session';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';

export function AuthScreen({ mode }: { mode: 'signIn' | 'signUp' }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { signIn, signUp, signInWithGoogle } = useSession();
  const [googleBusy, setGoogleBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const isSignUp = mode === 'signUp';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.needsConfirmation) {
        setConfirmationSent(true);
      }
      // On success with a session the session provider takes over; no
      // explicit navigation needed here.
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (!result.ok && !result.cancelled) {
        setError(result.message);
      }
      // On success the session provider takes over, as with email sign-in.
    } finally {
      setGoogleBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <Screen
        scroll
        bottom={
          <View>
            <PrimaryButton
              label="Back to sign in"
              onPress={() => navigation.replace({ name: 'auth', mode: 'signIn' })}
            />
          </View>
        }
      >
        <Text style={styles.title}>Check your inbox</Text>
        <MutedText style={styles.subtitle}>
          We sent a confirmation link to {email.trim()}. Open it, then come back and sign in.
        </MutedText>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      bottom={
        <View>
          <PrimaryButton
            label={isSignUp ? 'Create account' : 'Sign in'}
            onPress={() => submit()}
            loading={busy}
            disabled={!email.trim() || password.length === 0 || googleBusy}
          />
          <View style={styles.googleButton}>
            <PrimaryButton
              label="Continue with Google"
              variant="secondary"
              onPress={() => submitGoogle()}
              loading={googleBusy}
              disabled={busy}
            />
          </View>
        </View>
      }
    >
      <Text style={styles.title}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
      <MutedText style={styles.subtitle}>
        {isSignUp
          ? 'Your lessons, progress and streak are tied to your account.'
          : 'Sign in to continue your streak and lessons.'}
      </MutedText>

      <View style={styles.form}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          textContentType={isSignUp ? 'newPassword' : 'password'}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Pressable
        onPress={() =>
          navigation.replace({ name: 'auth', mode: isSignUp ? 'signIn' : 'signUp' })
        }
        style={styles.switch}
      >
        <Text style={styles.switchText}>
          {isSignUp ? 'I already have an account' : "I don't have an account yet"}
        </Text>
      </Pressable>
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
      marginBottom: theme.spacing(8),
    },
    form: {
      marginTop: theme.spacing(2),
    },
    error: {
      fontSize: theme.type.small,
      lineHeight: 21,
      color: theme.colors.danger,
    },
    googleButton: {
      marginTop: theme.spacing(3),
    },
    switch: {
      marginTop: theme.spacing(6),
      alignSelf: 'center',
      padding: theme.spacing(3),
    },
    switchText: {
      fontSize: theme.type.small,
      fontWeight: '600',
      color: theme.colors.accent,
    },
  });
}
