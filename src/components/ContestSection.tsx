import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONTEST, phaseOf, type Contest, type Entry } from '../lib/contest';
import { useI18n } from '../state/I18n';
import { Thumb } from './ContestThumb';

/** The contest on the public landing page: prize, how it works, a few entries and a sign-up button. */
export function ContestSection({ onJoin }: { onJoin: () => void }) {
  const { lang } = useI18n();
  const w = CONTEST[lang];
  const [c, setC] = useState<Contest | null>(null);
  const [top, setTop] = useState<Entry[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let off = false;
    void (async () => {
      const { data } = await supabase.rpc('contest_current');
      const row = Array.isArray(data) ? (data[0] as Contest | undefined) : undefined;
      if (off || !row || phaseOf(row) === 'ended') return;
      setC(row);
      const { data: rows } = await supabase.rpc('contest_board', { p_contest: row.id });
      if (off || !Array.isArray(rows)) return;
      setCount(rows.length);
      setTop((rows as Entry[]).slice(0, 4));
    })();
    return () => { off = true; };
  }, []);

  if (!c) return null;
  const phase = phaseOf(c);
  const ms = Math.max(0, Date.parse(c.ends_at) - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return (
    <section className="bg-white px-3 py-4 text-zinc-900 sm:px-4" aria-label={c.title}>
      <div className="mx-auto max-w-4xl rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent"><Trophy className="h-4 w-4" aria-hidden="true" />{w.nav}</span>
          {phase === 'open' && <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{d === 0 && h < 6 ? w.lastHours : w.left(d, h)}</span>}
          {count > 0 && <span className="text-xs text-zinc-600">{w.entriesN(count)}</span>}
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{c.title}</h2>
        {c.theme && <p className="mt-1 text-sm text-zinc-700">{c.theme}</p>}
        {c.prize && <p className="mt-2 text-lg font-semibold">{w.prize}: <span className="text-accent">{c.prize}</span></p>}

        <h3 className="mt-4 text-sm font-semibold">{w.how}</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>{w.step1}</li><li>{w.step2}</li><li>{w.step3}</li>
        </ol>

        {top.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {top.map((e) => (
              <li key={e.post_id} className="overflow-hidden rounded-xl border border-orange-200 bg-white">
                <div className="aspect-[4/5] bg-zinc-200"><Thumb kind={e.kind} path={e.media_path} title={e.title} /></div>
                <p className="truncate px-2 pt-1 text-xs font-medium">{e.author_name}</p>
                <p className="flex items-center gap-2 px-2 pb-1.5 text-xs text-zinc-600">
                  <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{e.likes}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" aria-hidden="true" />{e.commenters}</span>
                </p>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn-accent mt-5 px-6 py-3" onClick={onJoin}>{w.signup}</button>
      </div>
    </section>
  );
}
