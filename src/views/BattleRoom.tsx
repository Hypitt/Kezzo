import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Coins, Crown, Flame, Sparkles, UserMinus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { BATTLE_SELECT, normalizeBattle } from '../lib/data';
import { explain } from '../lib/errors';
import type { AiVerdict, Battle } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ChatPanel } from '../components/ChatPanel';
import { LiveRoom } from '../components/LiveRoom';
import { ReportButton } from '../components/ReportButton';
import { Avatar, Empty, Loading, Spinner } from '../components/ui';

export function BattleRoom({ id }: { id: string }) {
  const { user, ensureAuth, refreshWallet } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [missing, setMissing] = useState(false);
  const [verdicts, setVerdicts] = useState<AiVerdict[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<number>(0);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('battles').select(BATTLE_SELECT).eq('id', id).maybeSingle();
    if (error || !data) return setMissing(true);
    setBattle(normalizeBattle(data));
  }, [id]);

  // Many votes can arrive at once, so coalesce realtime refreshes.
  const reloadSoon = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(reload, 250);
  }, [reload]);

  useEffect(() => {
    setBattle(null);
    setMissing(false);
    reload();
    supabase.from('ai_verdicts').select('*').eq('battle_id', id).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setVerdicts((data ?? []) as AiVerdict[]));
    const channel = supabase
      .channel(`battle:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `id=eq.${id}` }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_contenders', filter: `battle_id=eq.${id}` }, reloadSoon)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_verdicts', filter: `battle_id=eq.${id}` }, (payload) =>
        setVerdicts((v) => [payload.new as AiVerdict, ...v.filter((x) => x.id !== (payload.new as AiVerdict).id)]),
      )
      .subscribe();
    return () => {
      window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [id, reload, reloadSoon]);

  const rpc = async (name: string, args: Record<string, unknown>, okKey?: Key): Promise<boolean> => {
    if (!ensureAuth()) return false;
    setBusy(name);
    const { error } = await supabase.rpc(name, args);
    setBusy(null);
    if (error) {
      toast(explain(error, t), 'error');
      return false;
    }
    if (okKey) toast(t(okKey));
    await Promise.all([reload(), refreshWallet()]);
    return true;
  };

  const kick = async (userId: string) => {
    if (!window.confirm(t('confirm_kick'))) return;
    setBusy('kick');
    try {
      await api('livekit-kick', { battleId: id, userId });
      await reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const recap = async () => {
    setBusy('recap');
    try {
      const v = await api<AiVerdict>('ai-judge', { battleId: id, language: lang });
      setVerdicts((list) => [v, ...list.filter((x) => x.id !== v.id)]);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (missing) return <Empty text={t('battle_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('battles')}>{t('back')}</button></Empty>;
  if (!battle) return <Loading />;

  const me = battle.contenders.find((c) => c.user_id === user?.id);
  const isHost = battle.host_id === user?.id;
  const total = battle.contenders.reduce((s, c) => s + c.score, 0);
  const full = battle.contenders.length >= battle.max_contenders;
  const ended = battle.status === 'ended';
  const live = battle.status === 'live';
  const winner = battle.contenders.find((c) => c.user_id === battle.winner_id);
  const categoryLabel = battle.category === 'custom' && battle.custom_theme ? battle.custom_theme : t(`cat_${battle.category}` as Key);

  return (
    <div className="space-y-5">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('battles')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('back')}
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium">{categoryLabel}</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${live ? 'text-accent' : 'text-zinc-500'}`}>
            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
            {t(`status_${battle.status}` as Key)}
          </span>
          <span className="text-zinc-500">{t('round_of', { n: battle.current_round, total: battle.total_rounds })}</span>
          <span className="inline-flex items-center gap-1 text-zinc-500"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{t('prize_pool', { n: battle.prize_pool })}</span>
          {battle.entry_fee > 0 && <span className="text-zinc-500">{t('entry_fee_n', { n: battle.entry_fee })}</span>}
        </div>
        <h1 className="text-2xl font-bold">{battle.title}</h1>
        {battle.topic && <p className="text-sm text-zinc-600">{battle.topic}</p>}
        <p className="text-xs text-zinc-500">{t('hosted_by')} <button type="button" className="underline" onClick={() => go('profile', battle.host.id)}>{battle.host.display_name}</button></p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {ended ? (
            <div className="card text-center">
              <Crown className="mx-auto h-7 w-7 text-amber-500" aria-hidden="true" />
              <h2 className="mt-2 text-lg font-semibold">{winner ? t('winner_is', { name: winner.profile.display_name }) : t('no_winner')}</h2>
              <p className="mt-1 text-sm text-zinc-500">{t('battle_over')}</p>
            </div>
          ) : (
            <LiveRoom key={battle.id} roomName={`battle:${battle.id}`} video={battle.mode === 'video'} />
          )}

          <section className="card space-y-3" aria-label={t('contenders')}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t('contenders')} ({battle.contenders.length}/{battle.max_contenders})</h2>
              {!ended && user && !me && !full && (
                <button type="button" className="btn btn-accent btn-sm" disabled={busy === 'join_battle'} onClick={() => rpc('join_battle', { p_battle: id }, 'joined_toast')}>
                  {busy === 'join_battle' && <Spinner />}
                  {battle.entry_fee > 0 ? t('join_stage_fee', { n: battle.entry_fee }) : t('join_stage')}
                </button>
              )}
              {!ended && me && !isHost && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => rpc('leave_battle', { p_battle: id })}>{t('leave_stage')}</button>
              )}
            </div>
            <ul className="space-y-3">
              {battle.contenders.map((c) => {
                const pct = total > 0 ? Math.round((c.score / total) * 100) : 0;
                const isLeader = total > 0 && c.score === Math.max(...battle.contenders.map((x) => x.score));
                return (
                  <li key={c.user_id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => go('profile', c.user_id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <Avatar p={c.profile} size={36} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                            {c.profile.display_name}
                            {c.user_id === battle.host_id && <span className="rounded bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600">{t('host')}</span>}
                            {isLeader && !ended && <Flame className="h-3.5 w-3.5 text-accent" aria-label={t('leading')} />}
                          </span>
                          <span className="block text-xs text-zinc-500">@{c.profile.handle}</span>
                        </span>
                      </button>
                      <span className="text-right text-sm tabular-nums"><strong>{c.score}</strong> <span className="text-xs text-zinc-500">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={c.profile.display_name}>
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {live && user && c.user_id !== user.id && (
                        <>
                          {[1, 5, 10].map((n) => (
                            <button key={n} type="button" className={`btn btn-sm ${n === 1 ? 'btn-ghost' : 'btn-primary'}`} disabled={busy === 'cast_vote'} onClick={() => rpc('cast_vote', { p_battle: id, p_contender: c.user_id, p_amount: n })}>
                              {n === 1 ? t('vote') : t('super_vote', { n })} · {n}
                            </button>
                          ))}
                        </>
                      )}
                      {isHost && !ended && c.user_id !== battle.host_id && (
                        <button type="button" className="btn btn-danger btn-sm ml-auto" disabled={busy === 'kick'} onClick={() => kick(c.user_id)}>
                          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('remove')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {live && !user && <p className="text-xs text-zinc-500">{t('sign_in_to_vote')}</p>}
            {live && <p className="text-xs text-zinc-500">{t('vote_rules')}</p>}
          </section>

          {isHost && !ended && (
            <section className="card space-y-3" aria-label={t('host_controls')}>
              <h2 className="font-semibold">{t('host_controls')}</h2>
              <div className="flex flex-wrap gap-2">
                {battle.status === 'open' && (
                  <button type="button" className="btn btn-accent" disabled={battle.contenders.length < 2 || busy === 'start_battle'} onClick={() => rpc('start_battle', { p_battle: id }, 'started_toast')}>
                    {t('start_battle')}
                  </button>
                )}
                {live && battle.current_round < battle.total_rounds && (
                  <button type="button" className="btn btn-ghost" onClick={() => rpc('next_round', { p_battle: id })}>{t('next_round')}</button>
                )}
                {live && (
                  <>
                    <button type="button" className="btn btn-ghost" disabled={busy === 'recap'} onClick={recap}>
                      {busy === 'recap' ? <Spinner /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                      {t('ai_recap')}
                    </button>
                    <button type="button" className="btn btn-primary" disabled={busy === 'end_battle'} onClick={() => window.confirm(t('confirm_end')) && rpc('end_battle', { p_battle: id }, 'ended_toast')}>
                      {t('end_battle')}
                    </button>
                  </>
                )}
              </div>
              {battle.status === 'open' && battle.contenders.length < 2 && <p className="text-xs text-zinc-500">{t('need_two')}</p>}
              <p className="text-xs text-zinc-500">{t('payout_rules')}</p>
            </section>
          )}

          {verdicts.length > 0 && (
            <section className="card space-y-3" aria-label={t('ai_recap')}>
              <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />{t('ai_recap')}</h2>
              {verdicts.slice(0, 3).map((v) => (
                <div key={v.id} className="space-y-1 border-t border-zinc-100 pt-3 first:border-0 first:pt-0">
                  <p className="text-sm">{v.verdict}</p>
                  {v.highlights.length > 0 && <ul className="list-disc pl-5 text-sm text-zinc-600">{v.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
                </div>
              ))}
              <p className="text-xs text-zinc-500">{t('ai_recap_note')}</p>
            </section>
          )}

          <div className="flex justify-end"><ReportButton targetType="battle" targetId={battle.id} /></div>
        </div>

        <ChatPanel roomType="battle" roomId={battle.id} canWrite={!ended} />
      </div>
    </div>
  );
}
