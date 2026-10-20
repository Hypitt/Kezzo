import { Suspense, lazy, useEffect, type ComponentType } from 'react';
import { AuthProvider, useAuth } from './state/Auth';
import { I18nProvider, useI18n } from './state/I18n';
import { RouterProvider, useRouter } from './state/Router';
import { LegalProvider } from './state/Legal';
import { NotificationsProvider } from './state/Notifications';
import { ToastProvider } from './state/Toast';
import { AuthDialog, Gate, Onboarding, SetupNotice } from './components/AuthScreens';
import { Navbar } from './components/Navbar';
import { Loading } from './components/ui';
import { pendingInvite } from './lib/invite';
import { startMonitoring, trackPage } from './lib/analytics';

// Every page is its own downloadable chunk, so the first screen only loads the code it needs.
const page = <P extends object>(load: () => Promise<{ default: ComponentType<P> }>) => lazy(load);
const BattleRoom = page(() => import('./views/BattleRoom').then((m) => ({ default: m.BattleRoom })));
const BattlesView = page(() => import('./views/BattlesView').then((m) => ({ default: m.BattlesView })));
const CreateView = page(() => import('./views/CreateView').then((m) => ({ default: m.CreateView })));
const GroupRoom = page(() => import('./views/GroupsView').then((m) => ({ default: m.GroupRoom })));
const GroupsView = page(() => import('./views/GroupsView').then((m) => ({ default: m.GroupsView })));
const JoinGroupView = page(() => import('./views/GroupsView').then((m) => ({ default: m.JoinGroupView })));
const LiveView = page(() => import('./views/LiveView').then((m) => ({ default: m.LiveView })));
const LiveStreamRoom = page(() => import('./views/LiveView').then((m) => ({ default: m.LiveStreamRoom })));
const HomeView = page(() => import('./views/HomeView').then((m) => ({ default: m.HomeView })));
const LegalView = page(() => import('./views/LegalView').then((m) => ({ default: m.LegalView })));
const MediaView = page(() => import('./views/MediaView').then((m) => ({ default: m.MediaView })));
const MessagesView = page(() => import('./views/MessagesView').then((m) => ({ default: m.MessagesView })));
const ProfileView = page(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })));
const AdminView = page(() => import('./views/AdminView').then((m) => ({ default: m.AdminView })));
const SearchView = page(() => import('./views/SearchView').then((m) => ({ default: m.SearchView })));

function View() {
  const { route } = useRouter();
  switch (route.tab) {
    case 'home': return <HomeView />;
    case 'battles': return route.id ? <BattleRoom key={route.id} id={route.id} /> : <BattlesView />;
    case 'live': return route.id ? <LiveStreamRoom key={route.id} id={route.id} /> : <LiveView />;
    case 'create': return <Gate><CreateView initial={route.id} /></Gate>;
    case 'media': return <MediaView />;
    case 'groups': return route.id ? <GroupRoom key={route.id} id={route.id} /> : <GroupsView />;
    case 'messages': return <Gate><MessagesView otherId={route.id} /></Gate>;
    case 'profile': return <ProfileView id={route.id} />;
    case 'admin': return <AdminView />;
    case 'legal': return <LegalView id={route.id} />;
    case 'join': return <JoinGroupView code={route.id} />;
    case 'search':
    default: return <SearchView />;
  }
}

function Shell() {
  const { user, profile, loading, configured } = useAuth();
  const { lang, setLang } = useI18n();
  const { go, route } = useRouter();

  // Adopt the saved language of the signed-in profile once it loads.
  useEffect(() => {
    if (profile && profile.language !== lang) setLang(profile.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Anonymous usage statistics: one page view per screen, load time and errors (nothing is sent with Do Not Track).
  useEffect(() => {
    startMonitoring();
  }, []);
  useEffect(() => {
    trackPage(window.location.hash);
  }, [route.tab, route.id]);

  // Finish joining a group if an invite link was opened before signing in.
  useEffect(() => {
    if (!profile) return;
    const code = pendingInvite();
    if (code) go('join', code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Signed-out users or an unknown route land on Search & Feeds; Home stays reachable from the navbar.
  useEffect(() => {
    if (!window.location.hash) go('search');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!configured) return <SetupNotice />;
  if (loading) return <Loading />;
  // The Terms and Privacy pages stay reachable while a new person is still choosing their profile.
  if (user && !profile && route.tab !== 'legal') return <Onboarding />;

  return (
    <div className="flex min-h-screen flex-col pb-16 lg:pb-0">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<Loading />}>
          <View />
        </Suspense>
      </main>
      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        <button type="button" className="underline" onClick={() => go('legal', 'terms')}>{lang === 'fr' ? 'Conditions' : 'Terms'}</button>
        {' · '}
        <button type="button" className="underline" onClick={() => go('legal', 'privacy')}>{lang === 'fr' ? 'Confidentialité' : 'Privacy'}</button>
      </footer>
      <AuthDialog />
    </div>
  );
}

function Providers() {
  const { go } = useRouter();
  return (
    <AuthProvider onSignedIn={() => go('search')}>
      <NotificationsProvider>
        <Shell />
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <RouterProvider>
          <LegalProvider>
            <Providers />
          </LegalProvider>
        </RouterProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
