import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONTEST, phaseOf, type Contest, type Entry } from '../lib/contest';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';

interface Info { rank: number; score: number; winner: boolean }
let cache: { at: number; map: Map<string, Info> } | null = null;
let pending: Promise<Map<string, Info>> | null = null;

/** The contest entries by post id (shared by every post on screen, refreshed at most once a minute). */
function entries(): Promise<Map<string, Info>> {
  if (cache && Date.now() - cache.at < 60000) return Promise.resolve(cache.map);
  if (pending) return pending;
  pending = (async () => {
    const map = new Map<string, Info>();
    try {
      const { data } = await supabase.rpc('contest_current');
      const c = Array.isArray(data) ? (data[0] as Contest | undefined) : undefined;
      if (c) {
        const { data: rows } = await supabase.rpc('contest_board', { p_contest: c.id });
        const ended = phaseOf(c) === 'ended';
        for (const e of (Array.isArray(rows) ? rows : []) as Entry[]) map.set(e.post_id, { rank: e.rank, score: e.score, winner: ended && e.rank === 1 });
      }
    } catch { /* no badge */ }
    cache = { at: Date.now(), map };
    pending = null;
    return map;
  })();
  return pending;
}

/** Is this post an entry in the running contest? */
export function useContestEntry(postId: string, enabled = true): Info | null {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let off = false;
    void entries().then((m) => { if (!off) setInfo(m.get(postId) ?? null); });
    return () => { off = true; };
  }, [postId, enabled]);
  return info;
}

/** A small trophy label shown on a post that takes part in the contest. */
export function ContestBadge({ info, link = true }: { info: Info; link?: boolean }) {
  const { lang } = useI18n();
  const { go } = useRouter();
  const w = CONTEST[lang];
  const cls = 'inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white';
  const body = (
    <>
      <Trophy className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
      {info.winner ? w.winnerBadge : w.entryBadge} · #{info.rank}
    </>
  );
  return link
    ? <button type="button" className={`${cls} hover:opacity-90`} onClick={() => go('contest')}>{body}</button>
    : <span className={cls}>{body}</span>;
}
