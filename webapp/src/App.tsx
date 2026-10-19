import { useEffect } from 'react';
import { SessionProvider, useSession } from './session';
import { hashFor, useRoute, type Route } from './router';
import { Auth } from './screens/Auth';
import { Complete } from './screens/Complete';
import { Explore } from './screens/Explore';
import { Home } from './screens/Home';
import { Lesson } from './screens/Lesson';
import { Onboarding } from './screens/Onboarding';
import { Profile } from './screens/Profile';
import { Takeaways } from './screens/Takeaways';
import { Topics } from './screens/Topics';
import { Welcome } from './screens/Welcome';
import { ErrorView, Loading, Logo } from './ui';

const SIGNED_OUT_ROUTES = new Set(['welcome', 'auth']);
const FOCUS_ROUTES = new Set(['lesson', 'takeaways', 'complete']);

/** Which page the user may see right now, given who they are. */
export function effectiveRoute(status: string, route: Route): Route {
  if (status === 'signedOut') return SIGNED_OUT_ROUTES.has(route.name) ? route : { name: 'welcome' };
  if (status === 'needsOnboarding') return { name: 'onboarding' };
  if (status === 'ready' && (SIGNED_OUT_ROUTES.has(route.name) || route.name === 'onboarding')) return { name: 'home' };
  return route;
}

function Shell() {
  const { status, errorMessage, retry } = useSession();
  const [route, navigate] = useRoute();
  const shown = effectiveRoute(status, route);

  // Keep the address bar honest when a page is not allowed (for example after sign-out).
  useEffect(() => {
    if (status !== 'loading' && status !== 'error' && hashFor(shown) !== hashFor(route)) navigate(shown, true);
  }, [status, shown, route, navigate]);

  if (status === 'loading') return <Loading message="Loading LUMIO…" />;
  if (status === 'error') {
    return (
      <main className="page narrow">
        <ErrorView message={errorMessage ?? 'Unknown error'} onRetry={retry} />
      </main>
    );
  }

  const go = (next: Route, replace?: boolean) => navigate(next, replace);
  const tabs: { route: Route; label: string; icon: string }[] = [
    { route: { name: 'home' }, label: 'Home', icon: '🏠' },
    { route: { name: 'explore' }, label: 'Explore', icon: '🧭' },
    { route: { name: 'profile' }, label: 'You', icon: '👤' },
  ];
  const showNav = status === 'ready' && !FOCUS_ROUTES.has(shown.name) && shown.name !== 'topics';
  const activeTab = shown.name === 'topics' ? 'explore' : shown.name;

  let page;
  switch (shown.name) {
    case 'welcome': page = <Welcome go={go} />; break;
    case 'auth': page = <Auth mode={shown.mode} go={go} />; break;
    case 'onboarding': page = <Onboarding />; break;
    case 'home': page = <Home go={go} />; break;
    case 'explore': page = <Explore go={go} />; break;
    case 'profile': page = <Profile go={go} />; break;
    case 'topics': page = <Topics go={go} />; break;
    case 'lesson': page = <Lesson key={shown.id} id={shown.id} go={go} />; break;
    case 'takeaways': page = <Takeaways id={shown.id} go={go} />; break;
    case 'complete': page = <Complete id={shown.id} go={go} />; break;
  }

  return (
    <>
      {showNav ? (
        <nav className="nav" aria-label="Main">
          <a className="nav-brand" href="#/home"><Logo size={26} /> <span>LUMIO</span></a>
          <div className="nav-tabs">
            {tabs.map(tab => (
              <a key={tab.label} href={`#/${tab.route.name}`} className={activeTab === tab.route.name ? 'tab on' : 'tab'} aria-current={activeTab === tab.route.name ? 'page' : undefined}>
                <span aria-hidden="true">{tab.icon}</span> {tab.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
      <div className={showNav ? 'with-nav' : ''}>{page}</div>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

