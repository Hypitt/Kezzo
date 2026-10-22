import { useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';
import { useLiveRoom } from '../lib/useLiveRoom';
import { useI18n } from '../state/I18n';
import { LiveControls, MediaTile, RemoteAudio } from './LiveParts';
import { Spinner } from './ui';

interface Props {
  /** "battle:<id>", "group:<id>" or "dm:<idA>:<idB>". The server decides who may join and publish. */
  roomName: string;
  /** Show camera controls and video tiles (false = audio-only room). */
  video: boolean;
  /** Connect right away (used when someone answers a ringing call or starts one). */
  autoJoin?: boolean;
}

/**
 * A simple call: everyone who is publishing gets a tile in a grid. Used for group calls and direct-message calls.
 * (Battles use BattleStage, which puts the competitors in one shared frame.)
 */
export function LiveRoom({ roomName, video, autoJoin = false }: Props) {
  const { t } = useI18n();
  const live = useLiveRoom({ roomName, video, autoPublish: true });
  const joined = useRef(false);
  useEffect(() => {
    if (autoJoin && !joined.current) {
      joined.current = true;
      void live.join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin]);

  if (live.phase !== 'connected') {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-900 p-6 text-center text-white">
        <Radio className="h-6 w-6 text-accent" aria-hidden="true" />
        <p className="max-w-sm text-sm text-zinc-300">{live.reconnecting ? t('reconnecting') : t(video ? 'call_intro_video' : 'call_intro_audio')}</p>
        <button type="button" className="btn btn-accent" onClick={live.join} disabled={live.phase === 'connecting'}>
          {live.phase === 'connecting' && <Spinner />}
          {t(live.error ? 'rejoin' : 'join_call')}
        </button>
        {live.error && <p role="alert" className="max-w-sm text-sm text-red-300">{live.error}</p>}
      </div>
    );
  }

  const local = live.room?.localParticipant;
  const visible = live.participants;
  const remotes = visible.filter((p) => p !== local);
  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${visible.length > 2 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {visible.map((p) => (
          <MediaTile key={p.identity} participant={p} name={p.name || t('guest')} local={p === local} video={video} className="aspect-video" />
        ))}
      </div>
      {remotes.map((p) => <RemoteAudio key={p.identity} p={p} />)}
      <LiveControls live={live} video={video} />
    </div>
  );
}
