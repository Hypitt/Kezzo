import { groupOf, tabName, TAB_ICON } from '../lib/nav';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';

/** Pages of the same menu group, shown as a row of tabs at the top of the page (Home | Search | Media, Battles | Live | Contest ...). */
export function SectionTabs() {
  const { route, go } = useRouter();
  const { lang, t } = useI18n();
  const group = groupOf(route.tab);
  // Inside a chat, a battle room or a live room the page needs the whole screen.
  const immersive = Boolean(route.id) && ['battles', 'live', 'messages', 'groups'].includes(route.tab);
  if (!group || group.tabs.length < 2 || immersive) return null;
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1" aria-label={group.id}>
      {group.tabs.map((tab) => {
        const Icon = TAB_ICON[tab];
        const active = route.tab === tab;
        return (
          <button key={tab} type="button" onClick={() => go(tab)} aria-current={active ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-white'}`}>
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}{tabName(tab, lang, t)}
          </button>
        );
      })}
    </nav>
  );
}
