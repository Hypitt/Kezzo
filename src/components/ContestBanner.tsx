import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONTEST, phaseOf, type Contest } from '../lib/contest';
import { useI18n } from '../state/I18n';

/** A one-line invitation to the running contest. Shown only while a contest is open or about to start. */
export function ContestBanner({ onOpen, dark = false }: { onOpen: () => void; dark?: boolean }) {
  const { lang } = useI18n();
  const w = CONTEST[lang];
  const [c, setC] = useState<Contest | null>(null);

  useEffect(() => {
    let off = false;
    void (async () => {
      const { data } = await supabase.rpc('contest_current');
      const row = Array.isArray(data) ? (data[0] as Contest | undefined) : undefined;
      if (!off && row && phaseOf(row) !== 'ended') setC(row);
    })();
    return () => { off = true; };
  }, []);

  if (!c) return null;
  return (
    <button type="button" onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${dark ? 'border-white/20 bg-white/10 text-white' : 'border-orange-200 bg-orange-50 text-zinc-900 hover:bg-orange-100'}`}>
      <Trophy className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      <span className="min-w-0 flex-1">{w.banner(c.prize)}</span>
      <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{w.join}</span>
    </button>
  );
}
