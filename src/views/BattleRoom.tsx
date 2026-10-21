import { ShareButton } from '../components/ShareButton';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Coins, Crown, Flame, Heart, Scale, Sparkles, Timer, UserMinus, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { BATTLE_SELECT, PUBLIC_PROFILE, loadPeople, normalizeBattle, type PersonRow } from '../lib/data';
import { COMPETITOR_COLORS, TIMER_CHOICES, formatClock, useServerOffset } from '../lib/battle';
import { explain } from '../lib/errors';
import { isSafe } from '../lib/moderation';
import type { AiVerdict, Battle, Contender, JudgeScore, PublicProfile, Standing } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ChatPanel } from '../components/ChatPanel';
import { BattleStage } from '../components/battle/BattleStage';
import { RoundTimer } from '../components/battle/RoundTimer';
import { HighlightCard, RecordingPanel } from '../components/battle/BattleExtras';
import { activeRecorder, onRecordingsChanged, recordingSupported } from '../lib/recorder';
import { ReportButton } from '../components/ReportButton';
import { Avatar, Empty, Loading, Spinner } from '../components/ui';

interface Judge { user_id: string; profile: PublicProfile }

const asProfile = (v: unknown): PublicProfile => (Array.isArray(v) ? v[0] : v) as PublicProfile;

export function BattleRoom({ id }: { id: string }) {
  const { user, ensureAuth, refreshWallet } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const offsetMs = useServerOffset();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [missing, setMissing] = useState(false);
  const [verdicts, setVerdicts] = useState<AiVerdict[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [scores, setScores] = useState<JudgeScore[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set()); // "<contenderId>:<round>"
  const [busy, setBusy] = useState<string | null>(null);
  const [wantRecord, setWantRecord] = useState(false);
  const sawLive = useRef(false);
  const timer = useRef<number>(0);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('battles').select(BATTLE_SELECT).eq('id', id).maybeSingle();
    if (error || !data) return setMissing(true);
    setBattle(normalizeBattle(data));
    const [j, st, sc, lk] = await Promise.all([
      supabase.from('battle_judges').select(`user_id,profile:profiles!user_id(${PUBLIC_PROFILE})`).eq('battle_id', id).order('added_at'),
      supabase.rpc('battle_standings', { p_battle: id }),
      supabase.from('judge_scores').select('judge_id,contender_id,round,score,comment,updated_at').eq('battle_id', id).order('updated_at', { ascending: false }).limit(200),
      user ? supabase.from('battle_likes').select('contender_id,round').eq('battle_id', id).eq('voter_id', user.id) : Promise.resolve({ data: [] }),
    ]);
    setJudges(((j.data ?? []) as unknown as Array<{ user_id: string; profile: unknown }>).map((r) => ({ user_id: r.user_id, profile: asProfile(r.profile) })).filter((r) => r.profile));
    setStandings((st.data ?? []) as Standing[]);
    setScores((sc.data ?? []) as JudgeScore[]);
    setLiked(new Set(((lk.data ?? []) as Array<{ contender_id: string; round: number }>).map((r) => `${r.contender_id}:${r.round}`)));
  }, [id, user]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_judges', filter: `battle_id=eq.${id}` }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_scores', filter: `battle_id=eq.${id}` }, reloadSoon)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_verdicts', filter: `battle_id=eq.${id}` }, (payload) =>
        setVerdicts((v) => [payload.new as AiVerdict, ...v.filter((x) => x.id !== (payload.new as AiVerdict).id)]),
      )
      .subscribe();
    return () => {
      window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [id, reload, reloadSoon]);

  const rpc = async (name: string, args: Record<string, unknown>, okMessage?: string): Promise<boolean> => {
    if (!ensureAuth()) return false;
    setBusy(name);
    const { error } = await supabase.rpc(name, args);
    setBusy(null);
    if (error) {
      toast(explain(error, t), 'error');
      return false;
    }
    if (okMessage) toast(okMessage);
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

  const mute = async (userId: string, muted: boolean) => {
    setBusy(`mute:${userId}`);
    try {
      await api('livekit-mute', { battleId: id, userId, muted });
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

  const standingMap = useMemo(() => new Map(standings.map((s) => [s.user_id, s])), [standings]);

  if (missing) return <Empty text={t('battle_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('battles')}>{t('back')}</button></Empty>;
  if (!battle) return <Loading />;

  const me = battle.contenders.find((c) => c.user_id === user?.id);
  const isHost = battle.host_id === user?.id;
  const isJudge = judges.some((j) => j.user_id === user?.id);
  const full = battle.contenders.length >= battle.max_contenders;
  const ended = battle.status === 'ended';
  const live = battle.status === 'live';
  const winner = battle.contenders.find((c) => c.user_id === battle.winner_id);
  const categoryLabel = battle.category === 'custom' && battle.custom_theme ? battle.custom_theme : t(`cat_${battle.category}` as Key);
  const topFinal = Math.max(0, ...standings.map((s) => s.final_pct));
  const hasJudges = judges.length > 0;
  const scoringRound = ended ? battle.total_rounds : battle.current_round;
  if (live) sawLive.current = true;

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
          <span className="inline-flex items-center gap-1 text-zinc-500"><Scale className="h-3.5 w-3.5" aria-hidden="true" />{t('weights_badge', { pub: battle.public_weight, jud: 100 - battle.public_weight })}</span>
          {!battle.host_competes && <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">{t('host_only_badge')}</span>}
          <RoundTimer endsAt={live ? battle.timer_ends_at : null} offsetMs={offsetMs} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{battle.title}</h1>
          <ShareButton type="battle" id={battle.id} title={battle.title} />
        </div>
        {battle.topic && <p className="text-sm text-zinc-600">{battle.topic}</p>}
        <p className="text-xs text-zinc-500">{t('hosted_by')} <button type="button" className="underline" onClick={() => go('profile', battle.host.id)}>{battle.host.display_name}</button></p>
      </header>

      {isHost && !ended && <HostBar battle={battle} busy={busy} rpc={rpc} record={wantRecord} onRecord={setWantRecord} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {ended ? (
            <div className="card text-center">
              <Crown className="mx-auto h-7 w-7 text-amber-500" aria-hidden="true" />
              <h2 className="mt-2 text-lg font-semibold">{winner ? t('winner_is', { name: winner.profile.display_name }) : t('no_winner')}</h2>
              <p className="mt-1 text-sm text-zinc-500">{t('battle_over')}</p>
            </div>
          ) : (
            <BattleStage
              key={battle.id} battle={battle} userId={user?.id ?? null} standings={standingMap} offsetMs={offsetMs}
              record={isHost && wantRecord}
              onRecordError={() => { setWantRecord(false); toast(t('rec_failed'), 'error'); }}
            />
          )}

          <section className="card space-y-3" aria-label={t('contenders')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{t('contenders')} ({battle.contenders.length}/{battle.max_contenders})</h2>
              {!ended && user && !me && !full && !isJudge && !(isHost && !battle.host_competes) && (
                <button type="button" className="btn btn-accent btn-sm" disabled={busy === 'join_battle'} onClick={() => rpc('join_battle', { p_battle: id }, t('joined_toast'))}>
                  {busy === 'join_battle' && <Spinner />}
                  {battle.entry_fee > 0 ? t('join_stage_fee', { n: battle.entry_fee }) : t('join_stage')}
                </button>
              )}
              {!ended && me && !isHost && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => rpc('leave_battle', { p_battle: id })}>{t('leave_stage')}</button>
              )}
            </div>
            {battle.contenders.length === 0 && <p className="text-sm text-zinc-500">{t('stage_empty')}</p>}
            <ul className="space-y-4">
              {battle.contenders.map((c, i) => (
                <CompetitorCard
                  key={c.user_id}
                  c={c}
                  index={i}
                  battle={battle}
                  standing={standingMap.get(c.user_id)}
                  leader={!ended && topFinal > 0 && (standingMap.get(c.user_id)?.final_pct ?? 0) === topFinal}
                  hasJudges={hasJudges}
                  viewerIsHost={isHost}
                  canVote={!ended && Boolean(user) && c.user_id !== user?.id && !isJudge}
                  votesOpen={live}
                  alreadyLiked={liked.has(`${c.user_id}:${battle.current_round}`)}
                  busy={busy}
                  onLike={() => rpc('like_contender', { p_battle: id, p_contender: c.user_id }, t('liked_toast', { name: c.profile.display_name }))}
                  onVote={(n) => rpc('cast_vote', { p_battle: id, p_contender: c.user_id, p_amount: n }, t('voted_toast', { n, name: c.profile.display_name }))}
                  onMute={(muted) => mute(c.user_id, muted)}
                  onKick={() => kick(c.user_id)}
                  onProfile={() => go('profile', c.user_id)}
                />
              ))}
            </ul>
            {!ended && !user && <p className="text-xs text-zinc-500">{t('sign_in_to_vote')}</p>}
            {live && isJudge && <p className="text-xs text-zinc-500">{t('judge_no_public_vote')}</p>}
            {live && <p className="text-xs text-zinc-500">{t('vote_rules')}</p>}
          </section>

          <JudgesSection
            battle={battle}
            judges={judges}
            scores={scores}
            isHost={isHost}
            isJudge={isJudge}
            round={scoringRound}
            busy={busy}
            rpc={rpc}
            userId={user?.id ?? null}
          />

          {isHost && !ended && (
            <HostControls battle={battle} busy={busy} rpc={rpc} onRecap={recap} offsetMs={offsetMs} hasJudges={hasJudges} />
          )}

          {ended && <HighlightCard battle={battle} canRemove={isHost} onRemoved={reload} />}
          {ended && isHost && <RecordingPanel battle={battle} autoDownload={sawLive.current && wantRecord} onChanged={reload} />}

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

interface CardProps {
  c: Contender;
  index: number;
  battle: Battle;
  standing?: Standing;
  leader: boolean;
  hasJudges: boolean;
  viewerIsHost: boolean;
  canVote: boolean;
  votesOpen: boolean;
  alreadyLiked: boolean;
  busy: string | null;
  onLike: () => void;
  onVote: (coins: 2 | 5) => void;
  onMute: (muted: boolean) => void;
  onKick: () => void;
  onProfile: () => void;
}

/** One competitor: number + colour, live scores, and the buttons that vote for exactly this person. */
function CompetitorCard({ c, index, battle, standing, leader, hasJudges, viewerIsHost, canVote, votesOpen, alreadyLiked, busy, onLike, onVote, onMute, onKick, onProfile }: CardProps) {
  const { t } = useI18n();
  const color = COMPETITOR_COLORS[index % COMPETITOR_COLORS.length];
  const ended = battle.status === 'ended';
  const final = standing?.final_pct ?? 0;
  const name = c.profile.display_name;
  const voting = busy === 'cast_vote' || busy === 'like_contender';
  return (
    <li className={`space-y-2.5 rounded-xl border p-3 ${color.border} ${color.soft}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${color.bg}`} aria-label={t('competitor_n', { n: index + 1 })}>{index + 1}</span>
        <button type="button" onClick={onProfile} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <Avatar p={c.profile} size={36} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {name}
              {c.user_id === battle.host_id && <span className="rounded bg-white/80 px-1.5 text-[11px] font-medium text-zinc-600">{t('host')}</span>}
              {leader && <Flame className="h-3.5 w-3.5 text-accent" aria-label={t('leading')} />}
              {c.muted && <VolumeX className="h-3.5 w-3.5 text-red-500" aria-label={t('muted_by_host')} />}
            </span>
            <span className="block text-xs text-zinc-500">@{c.profile.handle}</span>
          </span>
        </button>
        <span className="text-right">
          <span className={`block text-xl font-bold tabular-nums ${color.text}`}>{Math.round(final)}%</span>
          <span className="block text-[11px] text-zinc-500">{t('final_score')}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={Math.round(final)} aria-valuemin={0} aria-valuemax={100} aria-label={t('final_score_of', { name })}>
        <div className={`h-full rounded-full transition-all ${color.bg}`} style={{ width: `${final}%` }} />
      </div>
      <p className="text-xs text-zinc-600">
        {t('public_line', { pts: standing?.public_points ?? c.score, pct: Math.round(standing?.public_pct ?? 0) })}
        {hasJudges && ` · ${t('judges_line', { avg: (standing?.judge_avg ?? 0).toFixed(1), pct: Math.round(standing?.judge_pct ?? 0) })}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canVote && (
          <>
            <button type="button" className="btn btn-ghost btn-sm bg-white" disabled={!votesOpen || alreadyLiked || voting} onClick={onLike} aria-label={t('like_aria', { name })}>
              <Heart className={`h-3.5 w-3.5 ${alreadyLiked ? 'fill-red-500 text-red-500' : ''}`} aria-hidden="true" />
              {alreadyLiked ? t('liked') : t('like_free')}
            </button>
            <button type="button" className={`btn btn-sm text-white ${color.bg}`} disabled={!votesOpen || voting} onClick={() => onVote(2)} aria-label={t('vote_aria', { n: 2, name })}>
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />{t('vote_coins', { n: 2 })}
            </button>
            <button type="button" className={`btn btn-sm text-white ${color.bg}`} disabled={!votesOpen || voting} onClick={() => onVote(5)} aria-label={t('vote_aria', { n: 5, name })}>
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />{t('vote_coins', { n: 5 })}
            </button>
            {!votesOpen && <span className="text-xs text-zinc-500">{t('vote_after_start')}</span>}
          </>
        )}
        {viewerIsHost && !ended && c.user_id !== battle.host_id && (
          <span className="ml-auto flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm bg-white" disabled={busy === `mute:${c.user_id}`} onClick={() => onMute(!c.muted)}>
                  {c.muted ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
                  {c.muted ? t('unmute') : t('mute')}
                </button>
                <button type="button" className="btn btn-danger btn-sm" disabled={busy === 'kick'} onClick={onKick}>
                  <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />{t('remove')}
                </button>
          </span>
        )}
      </div>
    </li>
  );
}

interface JudgesProps {
  battle: Battle;
  judges: Judge[];
  scores: JudgeScore[];
  isHost: boolean;
  isJudge: boolean;
  round: number;
  busy: string | null;
  rpc: (name: string, args: Record<string, unknown>, ok?: string) => Promise<boolean>;
  userId: string | null;
}

/** Judges list (host adds up to 3), the scoring form for judges, and everyone's view of the scores and comments. */
function JudgesSection({ battle, judges, scores, isHost, isJudge, round, busy, rpc, userId }: JudgesProps) {
  const { t } = useI18n();
  const ended = battle.status === 'ended';
  const live = battle.status === 'live';
  const nameOf = (uid: string) => battle.contenders.find((c) => c.user_id === uid)?.profile.display_name ?? '…';
  const judgeName = (uid: string) => judges.find((j) => j.user_id === uid)?.profile.display_name ?? '…';
  const roundScores = scores.filter((s) => s.round === round);

  if (!isHost && judges.length === 0) return null;
  return (
    <section className="card space-y-4" aria-label={t('judges')}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('judges')} ({judges.length}/3)</h2>
        <span className="text-xs text-zinc-500">{t('weights_badge', { pub: battle.public_weight, jud: 100 - battle.public_weight })}</span>
      </div>

      {judges.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {judges.map((j) => (
            <li key={j.user_id} className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 text-sm">
              <Avatar p={j.profile} size={24} />{j.profile.display_name}
              {isHost && !ended && (
                <button type="button" className="ml-1 text-zinc-500 hover:text-red-600" aria-label={t('remove_judge_aria', { name: j.profile.display_name })} onClick={() => rpc('remove_judge', { p_battle: battle.id, p_user: j.user_id })}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isHost && !ended && judges.length < 3 && <AddJudge battle={battle} judges={judges} rpc={rpc} busy={busy} />}
      {isHost && judges.length === 0 && <p className="text-xs text-zinc-500">{t('judges_hint')}</p>}

      {isJudge && live && userId && <JudgeForm battle={battle} mine={scores.filter((s) => s.judge_id === userId && s.round === round)} rpc={rpc} busy={busy} />}

      {roundScores.length > 0 && (
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          <h3 className="text-sm font-semibold">{t('judges_scores_round', { n: round })}</h3>
          <ul className="space-y-2">
            {roundScores.map((s) => (
              <li key={`${s.judge_id}-${s.contender_id}`} className="text-sm">
                <span className="font-medium">{judgeName(s.judge_id)}</span> → <span className="font-medium">{nameOf(s.contender_id)}</span>
                : <strong className="tabular-nums">{s.score}/10</strong>
                {s.comment && <span className="block text-zinc-600">“{s.comment}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AddJudge({ battle, judges, rpc, busy }: { battle: Battle; judges: Judge[]; rpc: JudgesProps['rpc']; busy: string | null }) {
  const { t } = useI18n();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PersonRow[]>([]);
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    const h = window.setTimeout(() => {
      loadPeople(q, 0, 8).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(h);
  }, [term]);
  const blockedIds = new Set([battle.host_id, ...battle.contenders.map((c) => c.user_id), ...judges.map((j) => j.user_id)]);
  const options = results.filter((p) => !blockedIds.has(p.id));
  return (
    <div className="space-y-2">
      <label className="label" htmlFor="judge-search">{t('add_judge')}</label>
      <input id="judge-search" className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('search_people_placeholder')} autoComplete="off" />
      {options.length > 0 && (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {options.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <Avatar p={p} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm">{p.display_name} <span className="text-xs text-zinc-500">@{p.handle}</span></span>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy === 'add_judge'} onClick={async () => { if (await rpc('add_judge', { p_battle: battle.id, p_user: p.id }, t('judge_added', { name: p.display_name }))) setTerm(''); }}>
                {t('add')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What a judge sees: a 0 to 10 score and a comment for each competitor in the current round. */
function JudgeForm({ battle, mine, rpc, busy }: { battle: Battle; mine: JudgeScore[]; rpc: JudgesProps['rpc']; busy: string | null }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, { score: number; comment: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Start from what the judge already saved this round; switch when the round changes.
  useEffect(() => {
    const next: Record<string, { score: number; comment: string }> = {};
    for (const s of mine) next[s.contender_id] = { score: s.score, comment: s.comment };
    setDraft((d) => ({ ...next, ...Object.fromEntries(Object.entries(d).filter(([k]) => !(k in next))) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.current_round, mine.length]);

  const save = async (contenderId: string) => {
    const d = draft[contenderId] ?? { score: 5, comment: '' };
    if (!isSafe(d.comment)) return toast(t('blocked_content'), 'error');
    setSaving(contenderId);
    await rpc('judge_score', { p_battle: battle.id, p_contender: contenderId, p_score: d.score, p_comment: d.comment }, t('score_saved'));
    setSaving(null);
  };

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-3">
      <h3 className="text-sm font-semibold">{t('your_scores', { n: battle.current_round })}</h3>
      {battle.contenders.map((c, i) => {
        const color = COMPETITOR_COLORS[i % COMPETITOR_COLORS.length];
        const d = draft[c.user_id] ?? { score: 5, comment: '' };
        const saved = mine.find((s) => s.contender_id === c.user_id);
        return (
          <div key={c.user_id} className={`space-y-2 rounded-xl border p-3 ${color.border} ${color.soft}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${color.bg}`}>{i + 1}</span>
              {c.profile.display_name}
              <span className="ml-auto text-lg tabular-nums">{d.score}<span className="text-xs text-zinc-500">/10</span></span>
            </div>
            <input
              type="range" min={0} max={10} step={1} value={d.score} className="w-full"
              aria-label={t('score_for', { name: c.profile.display_name })}
              onChange={(e) => setDraft((all) => ({ ...all, [c.user_id]: { ...d, score: Number(e.target.value) } }))}
            />
            <input
              className="input bg-white" maxLength={280} value={d.comment} placeholder={t('judge_comment_placeholder')}
              aria-label={t('judge_comment_for', { name: c.profile.display_name })}
              onChange={(e) => setDraft((all) => ({ ...all, [c.user_id]: { ...d, comment: e.target.value } }))}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={saving === c.user_id || busy === 'judge_score'} onClick={() => save(c.user_id)}>
              {saving === c.user_id && <Spinner />}{saved ? t('update_score') : t('save_score')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface HostProps {
  battle: Battle;
  busy: string | null;
  rpc: (name: string, args: Record<string, unknown>, ok?: string) => Promise<boolean>;
  onRecap: () => void;
  offsetMs: number;
  hasJudges: boolean;
}

function HostControls({ battle, busy, rpc, onRecap, hasJudges }: HostProps) {
  const { t } = useI18n();
  const live = battle.status === 'live';
  const [weight, setWeight] = useState(battle.public_weight);
  const [seconds, setSeconds] = useState<number>(battle.round_seconds || 60);
  useEffect(() => setWeight(battle.public_weight), [battle.public_weight]);

  return (
    <section className="card space-y-4" aria-label={t('host_controls')}>
      <h2 className="font-semibold">{t('host_controls')}</h2>
      {live && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" disabled={busy === 'recap'} onClick={onRecap}>
            {busy === 'recap' ? <Spinner /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {t('ai_recap')}
          </button>
        </div>
      )}

      {battle.status === 'open' && (
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          <label className="label" htmlFor="hw-weight">{t('voting_weights')}</label>
          <input id="hw-weight" type="range" min={0} max={100} step={5} value={weight} className="w-full" onChange={(e) => setWeight(Number(e.target.value))} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{t('weights_badge', { pub: weight, jud: 100 - weight })}</span>
            <span className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeight(100)}>{t('public_only')}</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={weight === battle.public_weight || busy === 'set_battle_weight'} onClick={() => rpc('set_battle_weight', { p_battle: battle.id, p_public: weight }, t('weights_saved'))}>{t('save')}</button>
            </span>
          </div>
          {weight < 100 && !hasJudges && <p className="text-xs text-amber-700">{t('weights_need_judges')}</p>}
        </div>
      )}

      {live && (
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          <span className="label flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" aria-hidden="true" />{t('competition_timer')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} aria-label={t('competition_timer')}>
              {TIMER_CHOICES.map((s) => <option key={s} value={s}>{formatClock(s)}</option>)}
            </select>
            <button type="button" className="btn btn-accent btn-sm" disabled={busy === 'set_battle_timer'} onClick={() => rpc('set_battle_timer', { p_battle: battle.id, p_seconds: seconds })}>{t('timer_start')}</button>
            {battle.timer_ends_at && <button type="button" className="btn btn-ghost btn-sm" onClick={() => rpc('set_battle_timer', { p_battle: battle.id, p_seconds: 0 })}>{t('timer_stop')}</button>}
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">{t('payout_rules')}</p>
    </section>
  );
}

/** Always-visible host actions at the top of the room: start, next round, end and pay out, or cancel. */
function HostBar({ battle, busy, rpc, record, onRecord }: { battle: Battle; busy: string | null; rpc: HostProps['rpc']; record: boolean; onRecord: (on: boolean) => void }) {
  const { t } = useI18n();
  const canRecord = recordingSupported();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const refresh = () => setRunning(activeRecorder()?.battleId === battle.id);
    refresh();
    const off = onRecordingsChanged(refresh);
    const id = window.setInterval(() => setElapsed(activeRecorder()?.battleId === battle.id ? activeRecorder()!.elapsedMs() : 0), 1000);
    return () => { off(); window.clearInterval(id); };
  }, [battle.id]);
  const open = battle.status === 'open';
  const live = battle.status === 'live';
  const end = () => {
    if (!window.confirm(t(open ? 'confirm_cancel' : 'confirm_end'))) return;
    rpc('end_battle', { p_battle: battle.id }, t(open ? 'cancelled_toast' : 'ended_toast'));
  };
  return (
    <section className="card flex flex-wrap items-center gap-2 border-zinc-900" aria-label={t('host_controls')}>
      <span className="mr-auto text-sm font-semibold">{t('host_controls')}</span>
      {open && (
        <button type="button" className="btn btn-accent" disabled={battle.contenders.length < 2 || busy === 'start_battle'} onClick={() => rpc('start_battle', { p_battle: battle.id }, t('started_toast'))}>
          {busy === 'start_battle' && <Spinner />}{t('start_battle')}
        </button>
      )}
      {live && battle.current_round < battle.total_rounds && (
        <button type="button" className="btn btn-ghost" disabled={busy === 'next_round'} onClick={() => rpc('next_round', { p_battle: battle.id })}>{t('next_round')}</button>
      )}
      <button type="button" className="btn btn-primary" disabled={busy === 'end_battle'} onClick={end}>
        {busy === 'end_battle' && <Spinner />}{t(open ? 'cancel_battle' : 'end_battle')}
      </button>
      {open && battle.contenders.length < 2 && <p className="basis-full text-xs text-zinc-500">{t('need_two')}</p>}
      <div className="basis-full space-y-1 border-t border-zinc-100 pt-3">
        {canRecord ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={record} onChange={(e) => onRecord(e.target.checked)} />
              {t('rec_opt_in')}
              {record && running && <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />{t('rec_recording', { time: formatClock(elapsed / 1000) })}</span>}
            </label>
            <p className="text-xs text-zinc-500">{t(record && !live ? 'rec_waiting' : 'rec_note')}</p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">{t('rec_unsupported')}</p>
        )}
      </div>
    </section>
  );
}
