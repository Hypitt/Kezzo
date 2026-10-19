import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const TABS = ['home', 'battles', 'live', 'search', 'create', 'media', 'groups', 'messages', 'profile'] as const;
export type Tab = (typeof TABS)[number] | 'legal' | 'join';
export interface Route { tab: Tab; id?: string }

interface RouterValue { route: Route; go: (tab: Tab, id?: string) => void }
const RouterContext = createContext<RouterValue | null>(null);

/** Hash routes: #/search, #/battles/<id>, #/live/<id>, #/profile/<userId>, #/messages/<userId>, #/groups/<id>, #/join/<inviteCode>, #/legal/privacy */
function parse(): Route {
  const [tab, id] = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (tab === 'legal' || tab === 'join' || (TABS as readonly string[]).includes(tab)) return { tab: tab as Tab, id };
  return { tab: 'search' }; // default landing page: Search & Feeds
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((tab: Tab, id?: string) => {
    window.location.hash = id ? `/${tab}/${id}` : `/${tab}`;
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ route, go }), [route, go]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}
