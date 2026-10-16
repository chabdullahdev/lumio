/**
 * Shared UI primitives.
 *
 * Small, theme-aware building blocks used by every screen: containers,
 * buttons, cards, pills, progress bars, loading/error/empty states and inputs.
 * Design rules followed here: one-hand friendly actions (bottom), 44pt touch
 * targets, light and dark mode.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';

export function Screen({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  bottom,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottom?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.textSecondary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.staticContent]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      {body}
      {bottom ? <View style={styles.bottom}>{bottom}</View> : null}
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isInactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      onPress={isInactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        isInactive && styles.buttonDisabled,
        pressed && !isInactive && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.colors.accentText : theme.colors.accent}
        />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.buttonLabelPrimary,
            variant === 'secondary' && styles.buttonLabelSecondary,
            variant === 'ghost' && styles.buttonLabelGhost,
            variant === 'danger' && styles.buttonLabelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'accent' | 'neutral' | 'warning';
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      style={[
        styles.pill,
        tone === 'accent' && styles.pillAccent,
        tone === 'warning' && styles.pillWarning,
      ]}
    >
      <Text
        style={[
          styles.pillLabel,
          tone === 'accent' && styles.pillLabelAccent,
          tone === 'warning' && styles.pillLabelWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ ratio }: { ratio: number }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(clamped * 100)}%` }]} />
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function LoadingView({ message = 'Loading\u2026' }: { message?: string }) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text style={styles.centeredText}>{message}</Text>
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.centeredText}>{message}</Text>
      {onRetry ? (
        <PrimaryButton
          label="Try again"
          onPress={onRetry}
          variant="secondary"
          style={styles.centeredAction}
        />
      ) : null}
    </View>
  );
}

export function EmptyView({
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.centeredText}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          style={styles.centeredAction}
        />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <PrimaryButton
          label={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="ghost"
          style={styles.centeredGhostAction}
        />
      ) : null}
    </View>
  );
}

export function Field({
  label,
  ...inputProps
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
        style={[styles.input, inputProps.style]}
      />
    </View>
  );
}

export function MutedText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function createStyles(theme: Theme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    staticContent: {
      paddingHorizontal: theme.spacing(5),
      paddingBottom: theme.spacing(4),
    },
    scrollContent: {
      paddingHorizontal: theme.spacing(5),
      paddingBottom: theme.spacing(6),
      flexGrow: 1,
    },
    bottom: {
      paddingHorizontal: theme.spacing(5),
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(4),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    button: {
      minHeight: 52,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing(5),
    },
    buttonPrimary: {
      backgroundColor: theme.colors.accent,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    buttonGhost: {
      backgroundColor: 'transparent',
    },
    buttonDanger: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonLabel: {
      fontSize: theme.type.body,
      fontWeight: '700',
    },
    buttonLabelPrimary: {
      color: theme.colors.accentText,
    },
    buttonLabelSecondary: {
      color: theme.colors.accent,
    },
    buttonLabelGhost: {
      color: theme.colors.textSecondary,
    },
    buttonLabelDanger: {
      color: theme.colors.danger,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(4),
    },
    pill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1),
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    pillAccent: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: 'transparent',
    },
    pillWarning: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.warning,
    },
    pillLabel: {
      fontSize: theme.type.tiny,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    pillLabelAccent: {
      color: theme.colors.success,
    },
    pillLabelWarning: {
      color: theme.colors.warning,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: theme.colors.accent,
    },
    sectionTitle: {
      fontSize: theme.type.small,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(3),
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing(10),
      paddingHorizontal: theme.spacing(4),
    },
    centeredText: {
      marginTop: theme.spacing(3),
      fontSize: theme.type.small,
      lineHeight: 21,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
    },
    errorTitle: {
      fontSize: theme.type.heading,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    emptyTitle: {
      fontSize: theme.type.heading,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    centeredAction: {
      marginTop: theme.spacing(5),
      alignSelf: 'stretch',
      maxWidth: 320,
    },
    centeredGhostAction: {
      alignSelf: 'stretch',
      maxWidth: 320,
    },
    field: {
      marginBottom: theme.spacing(4),
    },
    fieldLabel: {
      fontSize: theme.type.small,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing(2),
    },
    input: {
      minHeight: 50,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
    },
    muted: {
      fontSize: theme.type.small,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
  });
}
