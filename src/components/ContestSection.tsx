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
  const [open, setOpen] = useState(false);

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
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className={signedIn ? 'text-zinc-900' : 'bg-white px-3 py-2 text-zinc-900 sm:px-4'} aria-label={c.title}>
      <div className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-900"><Trophy className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{w.nav}</span>
          {phase === 'open' && <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">{d === 0 && h < 6 ? w.lastHours : w.left(d, h)}</span>}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <h2 className="min-w-0 flex-1 truncate font-display text-base font-bold">{c.title}</h2>
          <button type="button" className="btn shrink-0 bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700" aria-expanded={open} onClick={() => setOpen(!open)}>{w.join}</button>
        </div>

        {open && (
          <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
            {c.theme && <p className="text-xs text-zinc-700"><span className="font-semibold">{w.theme}:</span> {c.theme}</p>}
            {c.prize && <p className="text-sm font-semibold">{w.prize}: <span className="text-accent">{c.prize}</span></p>}
            <p className="text-xs text-zinc-700"><span className="font-semibold">{w.dates}:</span> {fmt(c.starts_at)} – {fmt(c.ends_at)}{count > 0 ? ` · ${w.entriesN(count)}` : ''}</p>
            {c.rules && (<><h3 className="text-xs font-semibold">{w.rulesTitle}</h3><p className="whitespace-pre-line text-xs text-zinc-700">{c.rules}</p></>)}
            <h3 className="text-xs font-semibold">{w.how}</h3>
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-zinc-700">
              <li>{w.step1}</li><li>{w.step2}</li><li>{w.step3}</li>
            </ol>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                <h3 className="text-xs font-semibold">{w.forEnter}</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-700">{w.forEnterText}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                <h3 className="text-xs font-semibold">{w.forVote}</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-700">{w.forVoteText}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700" onClick={onJoin}>{signedIn ? w.ctaGo : w.ctaSign}</button>
              <button type="button" className="btn border border-zinc-300 px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>{w.hide}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
