import { Radio, VolumeX } from 'lucide-react';
import { useLiveRoom } from '../../lib/useLiveRoom';
import { COMPETITOR_COLORS } from '../../lib/battle';
import type { Battle, Standing } from '../../lib/types';
import { useI18n } from '../../state/I18n';
import { LiveControls, MediaTile, RemoteAudio } from '../LiveParts';
import { Spinner } from '../ui';
import { RoundTimer } from './RoundTimer';

interface Props {
  battle: Battle;
  userId: string | null;
  standings: Map<string, Standing>;
  offsetMs: number;
}

/** Tile arrangement for 1 to 5 competitors inside one frame. */
function layout(n: number): { grid: string; tile: (i: number) => string } {
  switch (n) {
    case 1: return { grid: 'grid-cols-1 grid-rows-1', tile: () => '' };
    case 2: return { grid: 'grid-cols-2 grid-rows-1', tile: () => '' };
    case 3: return { grid: 'grid-cols-2 grid-rows-2', tile: (i) => (i === 2 ? 'col-span-2' : '') };
    case 4: return { grid: 'grid-cols-2 grid-rows-2', tile: () => '' };
    default: return { grid: 'grid-cols-6 grid-rows-2', tile: (i) => (i < 3 ? 'col-span-2' : 'col-span-3') };
  }
}

/**
 * All competitors in one shared frame. The layout adapts to how many people are on stage (1 to 5).
 * Each tile has the competitor's number, colour, name and live score, so votes are never ambiguous.
 */
export function BattleStage({ battle, userId, standings, offsetMs }: Props) {
  const { t } = useI18n();
  const video = battle.mode === 'video';
  const isHost = battle.host_id === userId;
  const isContender = battle.contenders.some((c) => c.user_id === userId);
  const live = useLiveRoom({ roomName: `battle:${battle.id}`, video, autoPublish: isHost || isContender });

  if (live.phase !== 'connected') {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-900 p-6 text-center text-white">
        <Radio className="h-7 w-7 text-accent" aria-hidden="true" />
        <p className="max-w-sm text-sm text-zinc-300">{t(isContender || isHost ? (video ? 'stage_intro_perform_video' : 'stage_intro_perform_audio') : (video ? 'room_intro_video' : 'room_intro_audio'))}</p>
        <button type="button" className="btn btn-accent" onClick={live.join} disabled={live.phase === 'connecting'}>
          {live.phase === 'connecting' && <Spinner />}
          {t(live.error ? 'rejoin' : 'enter_room')}
        </button>
        {live.error && <p role="alert" className="max-w-sm text-sm text-red-300">{live.error}</p>}
      </div>
    );
  }

  // Joined the stage while already watching? The old connection has no permission to send; reconnect once.
  const needsRejoin = (isHost || isContender) && !live.canPublish;
  const rejoin = async () => {
    live.leave();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    await live.join();
  };
  const byId = new Map(live.participants.map((p) => [p.identity, p]));
  const stage = battle.contenders.slice(0, 5);
  const arrangement = layout(stage.length);
  const hostParticipant = byId.get(battle.host_id);
  const remotes = live.participants.filter((p) => p !== live.room?.localParticipant);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black p-1.5 sm:aspect-video">
        {stage.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">{t('stage_empty')}</div>
        ) : (
          <div className={`grid h-full w-full gap-1.5 ${arrangement.grid}`}>
            {stage.map((c, i) => {
              const color = COMPETITOR_COLORS[i];
              const s = standings.get(c.user_id);
              return (
                <MediaTile
                  key={c.user_id}
                  participant={byId.get(c.user_id)}
                  name={c.profile.display_name}
                  sub={`@${c.profile.handle}`}
                  local={c.user_id === userId}
                  video={video}
                  mutedByHost={c.muted}
                  className={arrangement.tile(i)}
                  marker={<span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${color.bg}`}>{i + 1}</span>}
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${color.bg}`} aria-hidden="true" />
                  <span className="absolute right-1.5 top-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">
                    {c.muted && <VolumeX className="h-3 w-3 text-red-300" aria-label={t('muted_by_host')} />}
                    {s ? `${Math.round(s.final_pct)}%` : '0%'}
                  </span>
                </MediaTile>
              );
            })}
          </div>
        )}
        {!battle.host_competes && (
          <MediaTile
            participant={hostParticipant}
            name={battle.host.display_name}
            local={isHost}
            video={video}
            className="absolute bottom-3 right-3 z-10 aspect-video w-1/4 min-w-24 border border-white/30 shadow-lg"
            marker={<span className="rounded bg-white px-1 text-[10px] font-bold text-zinc-900">{t('host').toUpperCase()}</span>}
          />
        )}
        {battle.timer_ends_at && (
          <div className="absolute left-3 top-3 z-10"><RoundTimer endsAt={battle.timer_ends_at} offsetMs={offsetMs} big /></div>
        )}
      </div>
      {remotes.map((p) => <RemoteAudio key={p.identity} p={p} />)}
      {needsRejoin && (
        <button type="button" className="btn btn-accent w-full" onClick={rejoin}>{t('rejoin_to_perform')}</button>
      )}
      <LiveControls live={live} video={video} />
    </div>
  );
}
