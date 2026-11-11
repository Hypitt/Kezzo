import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WIN, type WinnerRow } from '../lib/contestHub';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Avatar } from './ui';

/** The winners of contests that just ended, shown before everything else. Hidden when there are none. */
export function WinnersStrip({ max = 3 }: { max?: number }) {
  const { lang } = useI18n();
  const { go } = useRouter();
  const x = WIN[lang];
  const [rows, setRows] = useState<WinnerRow[]>([]);

  useEffect(() => {
    let off = false;
    void supabase.rpc('contest_winners').then(({ data }) => { if (!off && Array.isArray(data)) setRows(data as WinnerRow[]); });
    return () => { off = true; };
  }, []);

  const groups = new Map<string, WinnerRow[]>();
  for (const r of rows) groups.set(r.contest_id, [...(groups.get(r.contest_id) ?? []), r]);
  const list = [...groups.values()].slice(0, max);
  if (list.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={x.recent}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900"><Trophy className="h-4 w-4 text-accent" aria-hidden="true" />{x.recent}</h2>
      {list.map((g) => (
        <button key={g[0].contest_id} type="button" onClick={() => go('contest', g[0].contest_id)}
          className="block w-full rounded-2xl border-2 border-zinc-900 bg-white p-3 text-left text-zinc-900">
          <p className="truncate font-display text-sm font-bold">{g[0].contest_title}</p>
          <ol className="mt-2 space-y-1.5">
            {g.map((w) => (
              <li key={w.post_id} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 text-xs font-semibold text-zinc-600">{x.place(w.place)}</span>
                <Avatar p={{ display_name: w.author_name, avatar_url: w.author_avatar }} size={24} />
                <span className="min-w-0 flex-1 truncate">{w.author_name}</span>
                {w.prize && <span className="shrink-0 truncate text-xs font-semibold text-accent">{w.prize}</span>}
              </li>
            ))}
          </ol>
        </button>
      ))}
    </section>
  );
}
