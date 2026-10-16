/**
 * Bottom tab bar and main tab shell (Home, Explore, Profile).
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type MainTab } from './NavigationContext';
import { HomeScreen } from '../screens/HomeScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useTheme } from '../lib/use-theme';
import type { Theme } from '../theme';

const TABS: { key: MainTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '\u{1F3E0}' },
  { key: 'explore', label: 'Explore', icon: '\u{1F9ED}' },
  { key: 'profile', label: 'You', icon: '\u{1F464}' },
];

export function MainTabs({ tab }: { tab: MainTab }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { setTab } = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {tab === 'home' ? <HomeScreen /> : null}
        {tab === 'explore' ? <ExploreScreen /> : null}
        {tab === 'profile' ? <ProfileScreen /> : null}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map(item => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              style={styles.tab}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                {item.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing(2),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    tabIcon: {
      fontSize: 18,
      opacity: 0.55,
    },
    tabIconActive: {
      opacity: 1,
    },
    tabLabel: {
      marginTop: 2,
      fontSize: theme.type.tiny,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    tabLabelActive: {
      color: theme.colors.textPrimary,
    },
  });
}
