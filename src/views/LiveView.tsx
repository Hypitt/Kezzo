import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Mic, Radio, UserMinus, Users, Video, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { PUBLIC_PROFILE } from '../lib/data';
import { explain } from '../lib/errors';
import { useLiveRoom } from '../lib/useLiveRoom';
import type { LiveGuest, LiveStream, PublicProfile } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ChatPanel } from '../components/ChatPanel';
import { LiveControls, MediaTile, RemoteAudio } from '../components/LiveParts';
import { Avatar, Chip, Empty, Loading, PageHeader, Spinner } from '../components/ui';

const asProfile = (v: unknown): PublicProfile => (Array.isArray(v) ? v[0] : v) as PublicProfile;
const STREAM_SELECT = `id,host_id,title,kind,mode,max_guests,status,created_at,host:profiles!host_id(${PUBLIC_PROFILE})`;
const normalize = (row: unknown): LiveStream => {
  const r = row as Record<string, unknown>;
  return { ...(r as unknown as LiveStream), host: asProfile(r.host) };
};

/** Streams older than this are treated as abandoned (the host closed the tab without pressing End). */
const STALE_HOURS = 12;

// ---------------------------------------------------------------------------------------------- list + Go Live

export function LiveView() {
  const { t } = useI18n();
  const { go } = useRouter();
  const { ensureAuth } = useAuth();
  const { toast } = useToast();
  const [streams, setStreams] = useState<LiveStream[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'solo' | 'group'>('solo');
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [guests, setGuests] = useState(4);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString();
    const { data } = await supabase.from('live_streams').select(STREAM_SELECT).eq('status', 'live').gt('created_at', since).order('created_at', { ascending: false }).limit(24);
    setStreams((data ?? []).map(normalize));
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel('live-list').on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => load()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth() || !title.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('start_live', { p_title: title.trim(), p_kind: kind, p_mode: mode, p_max_guests: guests });
    setBusy(false);
    if (error) return toast(explain(error, t), 'error');
    go('live', data as string);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t('nav_live')}
        sub={t('live_sub')}
        action={!creating && <button type="button" className="btn btn-accent" onClick={() => (ensureAuth() ? setCreating(true) : undefined)}><Radio className="h-4 w-4" aria-hidden="true" />{t('go_live')}</button>}
      />

      {creating && (
        <form className="card space-y-4" onSubmit={start}>
          <div>
            <label className="label" htmlFor="live-title">{t('live_title_label')}</label>
            <input id="live-title" className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder={t('live_title_ph')} required />
          </div>
          <div>
            <span className="label">{t('live_kind_label')}</span>
            <div className="flex flex-wrap gap-2">
              <Chip active={kind === 'solo'} onClick={() => setKind('solo')}>{t('live_kind_solo')}</Chip>
              <Chip active={kind === 'group'} onClick={() => setKind('group')}>{t('live_kind_group')}</Chip>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">{t(kind === 'solo' ? 'live_kind_solo_hint' : 'live_kind_group_hint')}</p>
          </div>
          <div>
            <span className="label">{t('live_mode_label')}</span>
            <div className="flex flex-wrap gap-2">
              <Chip active={mode === 'video'} onClick={() => setMode('video')}>{t('mode_video')}</Chip>
              <Chip active={mode === 'audio'} onClick={() => setMode('audio')}>{t('mode_audio')}</Chip>
            </div>
          </div>
          {kind === 'group' && (
            <div>
              <label className="label" htmlFor="live-guests">{t('live_max_guests')}</label>
              <select id="live-guests" className="input w-auto" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn btn-accent" disabled={busy || !title.trim()}>{busy ? <Spinner /> : <Radio className="h-4 w-4" aria-hidden="true" />}{t('live_start')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>{t('cancel')}</button>
          </div>
        </form>
      )}

      <section aria-label={t('live_now')}>
        <h2 className="mb-3 text-lg font-semibold">{t('live_now')}</h2>
        {streams === null ? (
          <Loading />
        ) : streams.length === 0 ? (
          <Empty text={t('live_none')} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {streams.map((s) => (
              <li key={s.id}>
                <button type="button" className="card flex w-full items-center gap-3 text-left transition hover:border-zinc-400" onClick={() => go('live', s.id)}>
                  <span className="rounded-full border-2 border-accent p-0.5"><Avatar p={s.host} size={44} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.title}</span>
                    <span className="block truncate text-xs text-zinc-500">{s.host.display_name}</span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />{t('status_live')}</span>
                      <span className="inline-flex items-center gap-1">{s.mode === 'video' ? <Video className="h-3 w-3" aria-hidden="true" /> : <Mic className="h-3 w-3" aria-hidden="true" />}{t(s.mode === 'video' ? 'mode_video' : 'mode_audio')}</span>
                      {s.kind === 'group' && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />{t('live_kind_group')}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- one stream

export function LiveStreamRoom({ id }: { id: string }) {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [missing, setMissing] = useState(false);
  const [guests, setGuests] = useState<LiveGuest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [s, g] = await Promise.all([
      supabase.from('live_streams').select(STREAM_SELECT).eq('id', id).maybeSingle(),
      supabase.from('live_guests').select(`user_id,status,profile:profiles!user_id(${PUBLIC_PROFILE})`).eq('stream_id', id).order('created_at'),
    ]);
    if (s.error || !s.data) return setMissing(true);
    setStream(normalize(s.data));
    setGuests(((g.data ?? []) as unknown as Array<{ user_id: string; status: 'requested' | 'approved'; profile: unknown }>).map((r) => ({ ...r, profile: asProfile(r.profile) })).filter((r) => r.profile));
  }, [id]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`live:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams', filter: `id=eq.${id}` }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_guests', filter: `stream_id=eq.${id}` }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, reload]);

  const isHost = stream?.host_id === user?.id;
  const mine = guests.find((g) => g.user_id === user?.id);
  const approved = useMemo(() => guests.filter((g) => g.status === 'approved'), [guests]);
  const requests = useMemo(() => guests.filter((g) => g.status === 'requested'), [guests]);
  const onStage = Boolean(isHost || mine?.status === 'approved');
  const ended = stream?.status === 'ended';
  const video = stream?.mode === 'video';
  const live = useLiveRoom({ roomName: `live:${id}`, video: Boolean(video), autoPublish: onStage });

  // When the stream ends, everyone leaves the room.
  useEffect(() => {
    if (ended) live.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const run = async (name: string, fn: () => Promise<{ error: { message: string } | null } | void>, ok?: string) => {
    if (!ensureAuth()) return;
    setBusy(name);
    try {
      const res = await fn();
      if (res && res.error) throw res.error;
      if (ok) toast(ok);
      await reload();
    } catch (err) {
      toast(explain(err as { message: string }, t), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (missing) return <Empty text={t('live_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('live')}>{t('back')}</button></Empty>;
  if (!stream) return <Loading />;

  const approve = (uid: string) => run(`ok:${uid}`, async () => {
    const res = await supabase.rpc('respond_live_guest', { p_stream: id, p_user: uid, p_approve: true });
    if (res.error) return res;
    await api('livekit-live', { streamId: id, action: 'grant', userId: uid }).catch(() => undefined);
  });
  const decline = (uid: string) => run(`no:${uid}`, async () => {
    const res = await supabase.rpc('respond_live_guest', { p_stream: id, p_user: uid, p_approve: false });
    if (res.error) return res;
    await api('livekit-live', { streamId: id, action: 'revoke', userId: uid }).catch(() => undefined);
  });
  const endStream = () => {
    if (!window.confirm(t('live_end_confirm'))) return;
    run('end', async () => {
      const res = await supabase.rpc('end_live', { p_stream: id });
      if (res.error) return res;
      await api('livekit-live', { streamId: id, action: 'close' }).catch(() => undefined);
    }, t('live_ended_toast'));
  };

  const full = approved.length >= stream.max_guests;
  const people: Array<{ id: string; profile: PublicProfile; host: boolean }> = [
    { id: stream.host_id, profile: stream.host, host: true },
    ...approved.map((g) => ({ id: g.user_id, profile: g.profile, host: false })),
  ];
  const byId = new Map(live.participants.map((p) => [p.identity, p]));
  const remotes = live.participants.filter((p) => p !== live.room?.localParticipant);
  const gridClass = people.length === 1 ? 'grid-cols-1' : people.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="space-y-5">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('live')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}
      </button>

      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 font-medium ${ended ? 'text-zinc-500' : 'text-accent'}`}>
            {!ended && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
            {t(ended ? 'status_ended' : 'status_live')}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium">{t(stream.kind === 'solo' ? 'live_kind_solo' : 'live_kind_group')}</span>
        </div>
        <h1 className="text-2xl font-bold">{stream.title}</h1>
        <p className="text-xs text-zinc-500">{t('hosted_by')} <button type="button" className="underline" onClick={() => go('profile', stream.host_id)}>{stream.host.display_name}</button></p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {ended ? (
            <div className="card text-center text-sm text-zinc-600">{t('live_ended')}</div>
          ) : live.phase !== 'connected' ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-900 p-6 text-center text-white">
              <Radio className="h-7 w-7 text-accent" aria-hidden="true" />
              <p className="max-w-sm text-sm text-zinc-300">{t(onStage ? (video ? 'stage_intro_perform_video' : 'stage_intro_perform_audio') : (video ? 'room_intro_video' : 'room_intro_audio'))}</p>
              <button type="button" className="btn btn-accent" onClick={live.join} disabled={live.phase === 'connecting'}>
                {live.phase === 'connecting' && <Spinner />}
                {t(live.error ? 'rejoin' : isHost ? 'live_open_stage' : 'enter_room')}
              </button>
              {live.error && <p role="alert" className="max-w-sm text-sm text-red-300">{live.error}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`grid aspect-[4/5] w-full gap-1.5 overflow-hidden rounded-2xl bg-black p-1.5 sm:aspect-video ${gridClass}`}>
                {people.map((p) => (
                  <MediaTile
                    key={p.id}
                    participant={byId.get(p.id)}
                    name={p.profile.display_name}
                    sub={`@${p.profile.handle}`}
                    local={p.id === user?.id}
                    video={Boolean(video)}
                    className={people.length === 3 && p.host ? 'col-span-2' : ''}
                    marker={p.host ? <span className="rounded bg-white px-1 text-[10px] font-bold text-zinc-900">{t('host').toUpperCase()}</span> : undefined}
                  />
                ))}
              </div>
              {remotes.map((p) => <RemoteAudio key={p.identity} p={p} />)}
              <LiveControls live={live} video={Boolean(video)} />
            </div>
          )}

          {!ended && !isHost && stream.kind === 'group' && (
            <div className="card flex flex-wrap items-center gap-3">
              {!user ? (
                <p className="text-sm text-zinc-500">{t('live_sign_in')}</p>
              ) : mine?.status === 'approved' ? (
                <>
                  <p className="mr-auto text-sm">{t('live_on_stage')}</p>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === 'leave'} onClick={() => run('leave', async () => { const r = await supabase.rpc('leave_live_stage', { p_stream: id }); if (!r.error) { live.leave(); } return r; })}>{t('live_leave_stage')}</button>
                </>
              ) : mine ? (
                <>
                  <p className="mr-auto text-sm text-zinc-600">{t('live_requested')}</p>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === 'leave'} onClick={() => run('leave', async () => supabase.rpc('leave_live_stage', { p_stream: id }))}>{t('live_cancel_request')}</button>
                </>
              ) : (
                <>
                  <p className="mr-auto text-sm text-zinc-600">{full ? t('live_stage_full') : t('live_request_hint')}</p>
                  <button type="button" className="btn btn-accent btn-sm" disabled={full || busy === 'ask'} onClick={() => run('ask', async () => supabase.rpc('request_live_join', { p_stream: id }))}>
                    {busy === 'ask' && <Spinner />}{t('live_request')}
                  </button>
                </>
              )}
            </div>
          )}

          {isHost && !ended && (
            <section className="card space-y-4" aria-label={t('host_controls')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{t('host_controls')}</h2>
                <button type="button" className="btn btn-primary" disabled={busy === 'end'} onClick={endStream}>{busy === 'end' && <Spinner />}{t('live_end')}</button>
              </div>
              {stream.kind === 'group' && (
                <>
                  <p className="text-xs text-zinc-500">{t('live_spots', { n: approved.length, max: stream.max_guests })}</p>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">{t('live_requests')}</h3>
                    {requests.length === 0 && <p className="text-sm text-zinc-500">{t('live_no_requests')}</p>}
                    {requests.map((g) => (
                      <div key={g.user_id} className="flex items-center gap-2">
                        <Avatar p={g.profile} size={28} />
                        <span className="mr-auto truncate text-sm">{g.profile.display_name}</span>
                        <button type="button" className="btn btn-accent btn-sm" disabled={full || busy === `ok:${g.user_id}`} onClick={() => approve(g.user_id)} aria-label={`${t('live_approve')} ${g.profile.display_name}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />{t('live_approve')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy === `no:${g.user_id}`} onClick={() => decline(g.user_id)} aria-label={`${t('live_decline')} ${g.profile.display_name}`}><X className="h-3.5 w-3.5" aria-hidden="true" />{t('live_decline')}</button>
                      </div>
                    ))}
                  </div>
                  {approved.length > 0 && (
                    <div className="space-y-2 border-t border-zinc-100 pt-3">
                      <h3 className="text-sm font-semibold">{t('live_on_stage_list')}</h3>
                      {approved.map((g) => (
                        <div key={g.user_id} className="flex items-center gap-2">
                          <Avatar p={g.profile} size={28} />
                          <span className="mr-auto truncate text-sm">{g.profile.display_name}</span>
                          <button type="button" className="btn btn-danger btn-sm" disabled={busy === `no:${g.user_id}`} onClick={() => decline(g.user_id)}><UserMinus className="h-3.5 w-3.5" aria-hidden="true" />{t('live_remove')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
        <ChatPanel roomType="live" roomId={stream.id} canWrite={!ended} />
      </div>
    </div>
  );
}
