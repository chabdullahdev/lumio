/**
 * LUMIO — AI-powered personalized learning.
 *
 * App shell: providers, session-aware navigation, and the screen routes.
 * Screens live in src/screens, data access in src/data, the small navigation
 * state machine in src/navigation.
 *
 * @format
 */
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider, useNavigation } from './src/navigation/NavigationContext';
import { MainTabs } from './src/navigation/MainTabs';
import { ErrorView, LoadingView, Screen } from './src/components/ui';
import { SessionProvider, useSession } from './src/state/session';
import { UpdatesProvider } from './src/state/updates';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { TakeawaysScreen } from './src/screens/TakeawaysScreen';
import { CompleteScreen } from './src/screens/CompleteScreen';
import { TopicsEditorScreen } from './src/screens/TopicsEditorScreen';

/** Routes available before the user has an account (or while in sample mode). */
function EntryRoutes() {
  const { route } = useNavigation();
  switch (route.name) {
    case 'auth':
      return <AuthScreen mode={route.mode} />;
    case 'onboarding':
      return <OnboardingScreen />;
    case 'welcome':
    default:
      return <WelcomeScreen />;
  }
}

/** Routes available after onboarding is complete. */
function MainRoutes() {
  const { route } = useNavigation();
  switch (route.name) {
    case 'lesson':
      return <LessonScreen lessonId={route.lessonId} />;
    case 'takeaways':
      return <TakeawaysScreen lessonId={route.lessonId} />;
    case 'complete':
      return <CompleteScreen lessonId={route.lessonId} summary={route.summary} />;
    case 'topics':
      return <TopicsEditorScreen />;
    case 'main':
      return <MainTabs tab={route.tab} />;
    default:
      return <MainTabs tab="home" />;
  }
}

function Root() {
  const { status, errorMessage, retry } = useSession();

  if (status === 'loading') {
    return (
      <Screen>
        <LoadingView message="Starting LUMIO\u2026" />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <ErrorView
          message={errorMessage ?? 'The app could not start.'}
          onRetry={retry}
        />
      </Screen>
    );
  }

  if (status === 'signedOut') {
    return (
      <NavigationProvider initial={{ name: 'welcome' }}>
        <EntryRoutes />
      </NavigationProvider>
    );
  }

  if (status === 'needsOnboarding') {
    return (
      <NavigationProvider initial={{ name: 'onboarding' }}>
        <OnboardingScreen />
      </NavigationProvider>
    );
  }

  return (
    <NavigationProvider initial={{ name: 'main', tab: 'home' }}>
      <MainRoutes />
    </NavigationProvider>
  );
}

function App() {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SessionProvider>
        <UpdatesProvider>
          <Root />
        </UpdatesProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

export default App;
