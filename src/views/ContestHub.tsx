import { useCallback, useEffect, useState } from 'react';
import { Check, EyeOff, Heart, Plus, Trophy, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HUB, type ContestRow } from '../lib/contestHub';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Chip, Empty, Loading, PageHeader } from '../components/ui';
import { ContestForm } from '../components/ContestForm';

type Filter = 'all' | 'open' | 'entered' | 'voted' | 'mine' | 'ended';

/** Every contest in one place: browse, see where you took part, start your own. */
export function ContestHub() {
  const { user, openAuth } = useAuth();
  const { lang } = useI18n();
  const { go } = useRouter();
  const h = HUB[lang];
  const [rows, setRows] = useState<ContestRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('contest_list');
    setRows(Array.isArray(data) ? (data as ContestRow[]) : []);
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => window.clearInterval(timer);
  }, [load, user?.id]);

  if (rows === null) return <Loading />;

  const mine = rows.filter((c) => c.owner_id === user?.id && user);
  const shown = rows.filter((c) => {
    if (filter === 'open') return c.phase === 'open';
    if (filter === 'entered') return c.entered;
    if (filter === 'voted') return c.voted;
    if (filter === 'mine') return mine.includes(c);
    if (filter === 'ended') return c.phase === 'ended';
    return true;
  });
  const FILTERS: Array<[Filter, string]> = [['all', h.filterAll], ['open', h.filterOpen], ['entered', h.filterEntered], ['voted', h.filterVoted], ['mine', h.filterMine], ['ended', h.filterEnded]];
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={h.title} sub={h.sub}
        action={<button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" onClick={() => (user ? setCreating(true) : openAuth('signup'))}><Plus className="h-4 w-4" aria-hidden="true" />{user ? h.create : h.signIn}</button>} />

      {creating && <ContestForm onCancel={() => setCreating(false)} onSaved={(id) => { setCreating(false); if (id) go('contest', id); else void load(); }} />}

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label={h.title}>
        {FILTERS.filter(([k]) => user || (k !== 'entered' && k !== 'voted' && k !== 'mine')).map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{label}</Chip>
        ))}
      </div>

      {shown.length === 0 ? <Empty text={rows.length === 0 ? h.none : h.noneFilter} /> : (
        <ul className="space-y-3">
          {shown.map((c) => {
            const ms = Math.max(0, Date.parse(c.ends_at) - Date.now());
            return (
              <li key={c.id}>
                <button type="button" onClick={() => go('contest', c.id)} className="block w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left text-zinc-900 hover:border-zinc-400">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`${pill} ${c.phase === 'open' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                      {c.phase === 'open' ? h.open : c.phase === 'soon' ? h.soon : h.ended}
                    </span>
                    {c.official && <span className={`${pill} bg-zinc-100 text-zinc-700`}><Trophy className="h-3 w-3" aria-hidden="true" />{h.official}</span>}
                    {c.entered && <span className={`${pill} bg-emerald-100 text-emerald-800`}><Check className="h-3 w-3" aria-hidden="true" />{h.entered}</span>}
                    {c.voted && <span className={`${pill} bg-rose-100 text-rose-800`}><Heart className="h-3 w-3" aria-hidden="true" />{h.voted}</span>}
                    {c.owner_id === user?.id && user && <span className={`${pill} bg-zinc-100 text-zinc-700`}>{h.yours}</span>}
                    {c.hidden && <span className={`${pill} bg-red-100 text-red-700`}><EyeOff className="h-3 w-3" aria-hidden="true" />{h.hiddenTag}</span>}
                  </div>
                  <h2 className="mt-2 font-display text-base font-bold">{c.title}</h2>
                  {c.theme && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600">{c.theme}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{h.entries(c.entries)}</span>
                    {c.prize && <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" aria-hidden="true" />{c.prize}</span>}
                    {!c.official && c.owner_name && <span>{h.by} {c.owner_name}</span>}
                    <span>
                      {c.phase === 'open' ? h.left(Math.floor(ms / 86400000), Math.floor((ms % 86400000) / 3600000))
                        : c.phase === 'soon' ? `${h.startsOn} ${fmt(c.starts_at)}` : `${h.endedOn} ${fmt(c.ends_at)}`}
                    </span>
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
