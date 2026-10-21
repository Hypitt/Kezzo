import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { loadPolls, type PollView } from '../lib/polls';
import { useI18n } from '../state/I18n';
import { PollCard, PollForm } from './PollCard';

/** Audience polls beside a live stream. The host can add one; everyone in the room can vote. Results refresh while the page is open. */
export function LivePolls({ streamId, isHost, ended }: { streamId: string; isHost: boolean; ended: boolean }) {
  const { t } = useI18n();
  const [polls, setPolls] = useState<PollView[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => { loadPolls({ liveId: streamId, limit: 10 }).then(setPolls).catch(() => undefined); }, [streamId]);
  useEffect(() => {
    load();
    if (ended) return;
    const timer = window.setInterval(load, 6000);
    return () => window.clearInterval(timer);
  }, [load, ended]);

  if (polls.length === 0 && (!isHost || ended)) return null;
  return (
    <section className="space-y-3" aria-label={t('poll_live_title')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />{t('poll_live_title')}</h2>
        {isHost && !ended && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding((a) => !a)}>{t(adding ? 'cancel' : 'poll_add_to_live')}</button>}
      </div>
      {adding && <div className="card"><PollForm liveId={streamId} onCreated={() => { setAdding(false); load(); }} /></div>}
      {polls.map((p) => <PollCard key={p.id} poll={p} onChange={load} showShare={false} />)}
    </section>
  );
}
