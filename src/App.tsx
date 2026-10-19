import { useEffect } from 'react';
import { AuthProvider, useAuth } from './state/Auth';
import { I18nProvider, useI18n } from './state/I18n';
import { RouterProvider, useRouter } from './state/Router';
import { LegalProvider } from './state/Legal';
import { ToastProvider } from './state/Toast';
import { AuthDialog, Gate, Onboarding, SetupNotice } from './components/AuthScreens';
import { Navbar } from './components/Navbar';
import { Loading } from './components/ui';
import { BattleRoom } from './views/BattleRoom';
import { BattlesView } from './views/BattlesView';
import { CreateView } from './views/CreateView';
import { GroupRoom, GroupsView, JoinGroupView, pendingInvite } from './views/GroupsView';
import { HomeView } from './views/HomeView';
import { LegalView } from './views/LegalView';
import { MediaView } from './views/MediaView';
import { MessagesView } from './views/MessagesView';
import { ProfileView } from './views/ProfileView';
import { SearchView } from './views/SearchView';

function View() {
  const { route } = useRouter();
  switch (route.tab) {
    case 'home': return <HomeView />;
    case 'battles': return route.id ? <BattleRoom key={route.id} id={route.id} /> : <BattlesView />;
    case 'create': return <Gate><CreateView initial={route.id} /></Gate>;
    case 'media': return <MediaView />;
    case 'groups': return route.id ? <GroupRoom key={route.id} id={route.id} /> : <GroupsView />;
    case 'messages': return <Gate><MessagesView otherId={route.id} /></Gate>;
    case 'profile': return <ProfileView id={route.id} />;
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
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <View />
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
      <Shell />
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
