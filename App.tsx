/**
 * My App — built with Ship Studio.
 *
 * @format
 */

import React, { useState } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const ACCENT = '#54E36E';

function App() {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <HomeScreen />
    </SafeAreaProvider>
  );
}

function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const [taps, setTaps] = useState(0);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <View style={[styles.badge, isDark && styles.badgeDark]}>
          <Text style={styles.badgeEmoji}>🚀</Text>
        </View>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Your app starts here
        </Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Edit App.tsx and this screen updates live. Ask your agent to build
          whatever you can imagine.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setTaps(t => t + 1)}
        >
          <Text style={styles.buttonText}>
            {taps === 0 ? 'Tap me' : `Tapped ${taps} times`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0e1116',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(84, 227, 110, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  badgeDark: {
    backgroundColor: 'rgba(84, 227, 110, 0.12)',
  },
  badgeEmoji: {
    fontSize: 34,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#11181c',
    textAlign: 'center',
  },
  titleDark: {
    color: '#f2f4f7',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5b6470',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitleDark: {
    color: '#9aa4b2',
  },
  button: {
    marginTop: 32,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b2912',
  },
});

export default App;
