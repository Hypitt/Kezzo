import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONTEST, phaseOf, type Contest } from '../lib/contest';
import { useI18n } from '../state/I18n';

/** The running contest, explained for people who want to compete and people who want to vote. Shown on the landing page, Home and Search. */
export function ContestSection({ onJoin, signedIn = false }: { onJoin: () => void; signedIn?: boolean }) {
  const { lang } = useI18n();
  const w = CONTEST[lang];
  const [c, setC] = useState<Contest | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let off = false;
    void (async () => {
      const { data } = await supabase.rpc('contest_current');
      const row = Array.isArray(data) ? (data[0] as Contest | undefined) : undefined;
      if (off || !row || phaseOf(row) === 'ended') return;
      setC(row);
      const { data: rows } = await supabase.rpc('contest_board', { p_contest: row.id });
      if (!off && Array.isArray(rows)) setCount(rows.length);
    })();
    return () => { off = true; };
  }, []);

  if (!c) return null;
  const phase = phaseOf(c);
  const ms = Math.max(0, Date.parse(c.ends_at) - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return (
    <section className={signedIn ? 'text-zinc-900' : 'bg-white px-3 py-2 text-zinc-900 sm:px-4'} aria-label={c.title}>
      <div className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-900"><Trophy className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{w.nav}</span>
          {phase === 'open' && <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">{d === 0 && h < 6 ? w.lastHours : w.left(d, h)}</span>}
          {count > 0 && <span className="text-[11px] text-zinc-600">{w.entriesN(count)}</span>}
        </div>
        <h2 className="mt-1 font-display text-base font-bold">{c.title}</h2>
        {c.theme && <p className="mt-0.5 text-xs text-zinc-700">{c.theme}</p>}
        {c.prize && <p className="mt-0.5 text-sm font-semibold">{w.prize}: <span className="text-accent">{c.prize}</span></p>}

        <h3 className="mt-2 text-xs font-semibold">{w.how}</h3>
        <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-xs text-zinc-700">
          <li>{w.step1}</li><li>{w.step2}</li><li>{w.step3}</li>
        </ol>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <h3 className="text-xs font-semibold">{w.forEnter}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-700">{w.forEnterText}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <h3 className="text-xs font-semibold">{w.forVote}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-700">{w.forVoteText}</p>
          </div>
        </div>

        <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 mt-3 px-3 py-1.5 text-xs" onClick={onJoin}>{signedIn ? w.ctaGo : w.ctaSign}</button>
      </div>
    </section>
  );
}
