import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { loadPolls, type PollView } from '../lib/polls';
import type { EventRow } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { EventCard } from '../components/EventCard';
import { PollCard } from '../components/PollCard';
import { Empty, Loading, PageHeader } from '../components/ui';

const EVENT_SELECT = `id,host_id,title,description,starts_at,ends_at,location,link,cover_path,created_at,host:profiles!host_id(${PUBLIC_PROFILE})`;

async function loadEvents(ids?: string[]): Promise<EventRow[]> {
  let q = supabase.from('events').select(EVENT_SELECT).order('starts_at', { ascending: true }).limit(40);
  q = ids ? q.in('id', ids) : q.gte('starts_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Array<Omit<EventRow, 'host'> & { host: EventRow['host'] | EventRow['host'][] }>).map((r) => ({ ...r, host: Array.isArray(r.host) ? r.host[0] : r.host })) as EventRow[];
  if (rows.length) {
    const { data: stats } = await supabase.rpc('event_stats', { p_ids: rows.map((r) => r.id) });
    const map = new Map(((stats ?? []) as { event_id: string; going: number; me: boolean }[]).map((s) => [s.event_id, s]));
    rows.forEach((r) => { const s = map.get(r.id); r.going = s?.going ?? 0; r.me = s?.me ?? false; });
  }
  return rows;
}

/** Events to promote and polls to vote on. A shared link (#/community/<id>) shows that event or poll first. */
export function CommunityView({ focus }: { focus?: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { go } = useRouter();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [polls, setPolls] = useState<PollView[] | null>(null);
  const [pinned, setPinned] = useState<{ events: EventRow[]; polls: PollView[] }>({ events: [], polls: [] });

  const load = useCallback(() => {
    loadEvents().then(setEvents).catch(() => setEvents([]));
    loadPolls({ standalone: true, limit: 20 }).then(setPolls).catch(() => setPolls([]));
    if (focus) {
      Promise.all([loadEvents([focus]).catch(() => []), loadPolls({ ids: [focus] }).catch(() => [])]).then(([e, p]) => setPinned({ events: e, polls: p }));
    }
  }, [focus]);
  useEffect(load, [load]);

  const pinnedIds = new Set([...pinned.events.map((e) => e.id), ...pinned.polls.map((p) => p.id)]);
  const shownEvents = [...pinned.events, ...(events ?? []).filter((e) => !pinnedIds.has(e.id))];
  const shownPolls = [...pinned.polls, ...(polls ?? []).filter((p) => !pinnedIds.has(p.id))];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t('nav_community')} sub={t('community_sub')} />
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('events_title')}</h2>
          {user && <button type="button" className="btn btn-primary btn-sm" onClick={() => go('create', 'event')}>{t('event_create')}</button>}
        </div>
        {events === null ? <Loading /> : shownEvents.length === 0 ? <Empty text={t('events_empty')} /> : (
          <div className="grid gap-4 sm:grid-cols-2">{shownEvents.map((e) => <EventCard key={e.id} event={e} onChange={load} />)}</div>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('polls_title')}</h2>
          {user && <button type="button" className="btn btn-primary btn-sm" onClick={() => go('create', 'poll')}>{t('poll_create')}</button>}
        </div>
        {polls === null ? <Loading /> : shownPolls.length === 0 ? <Empty text={t('polls_empty')} /> : (
          <div className="grid gap-4 sm:grid-cols-2">{shownPolls.map((p) => <PollCard key={p.id} poll={p} onChange={load} />)}</div>
        )}
      </section>
    </div>
  );
}
