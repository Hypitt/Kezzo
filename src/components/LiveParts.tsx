import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Mic, MicOff, PhoneOff, Settings2, Video, VideoOff, Volume2, WifiOff } from 'lucide-react';
import type { Participant, Track } from 'livekit-client';

import { initials } from '../lib/format';
import type { LiveRoomApi } from '../lib/useLiveRoom';
import { useI18n } from '../state/I18n';

// Plain values of Track.Source, so this file does not pull the whole video library into the page bundle.
const CAMERA = 'camera' as unknown as Track.Source;
const MICROPHONE = 'microphone' as unknown as Track.Source;

/** Plays the sound of one remote person. Rendered once per remote participant, even when they have no tile. */
export function RemoteAudio({ p }: { p: Participant }) {
  const el = useRef<HTMLAudioElement>(null);
  const track = p.getTrackPublication(MICROPHONE)?.track;
  useEffect(() => {
    const node = el.current;
    if (!node || !track) return;
    track.attach(node);
    return () => {
      track.detach(node);
    };
  }, [track]);
  return <audio ref={el} autoPlay />;
}

interface TileProps {
  /** The LiveKit participant, or undefined while that person has not connected yet. */
  participant?: Participant;
  name: string;
  /** Second line, for example @handle. */
  sub?: string;
  local?: boolean;
  video: boolean;
  /** A coloured marker so viewers can tell competitors apart. */
  marker?: ReactNode;
  className?: string;
  /** Extra overlays, for example a points badge. */
  children?: ReactNode;
  mutedByHost?: boolean;
}

/** One video (or audio-only avatar) tile. Never plays sound itself: see RemoteAudio. */
export function MediaTile({ participant, name, sub, local, video, marker, className = '', children, mutedByHost }: TileProps) {
  const { t } = useI18n();
  const videoEl = useRef<HTMLVideoElement>(null);
  const camPub = participant?.getTrackPublication(CAMERA);
  const micPub = participant?.getTrackPublication(MICROPHONE);
  const camTrack = camPub?.track;
  const camVisible = Boolean(camTrack) && !camPub?.isMuted;
  const micOn = Boolean(micPub?.track) && !micPub?.isMuted;

  useEffect(() => {
    const el = videoEl.current;
    if (!el || !camTrack || !camVisible) return;
    camTrack.attach(el);
    return () => {
      camTrack.detach(el);
    };
  }, [camTrack, camVisible]);

  return (
    <div className={`${className.includes('absolute') ? '' : 'relative'} flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-900 ${participant?.isSpeaking ? 'ring-2 ring-accent' : ''} ${className}`}>
      {video && (
        <video
          ref={videoEl}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${camVisible ? '' : 'hidden'} ${local ? '-scale-x-100' : ''}`}
        />
      )}
      {!camVisible && (
        <span className="flex h-14 w-14 max-h-[40%] items-center justify-center rounded-full bg-zinc-700 text-lg font-semibold text-white" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      {!participant && <span className="absolute inset-x-0 top-2 text-center text-[11px] text-zinc-400">{t('waiting_to_connect')}</span>}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[92%] items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs text-white">
        {marker}
        {micOn ? <Mic className="h-3 w-3 shrink-0" aria-label={t('mic_on')} /> : <MicOff className="h-3 w-3 shrink-0" aria-label={mutedByHost ? t('muted_by_host') : t('mic_off')} />}
        <span className="truncate">{name}</span>
        {sub && <span className="hidden truncate text-zinc-300 sm:inline">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

/** Mic / camera / device / leave controls plus the reconnect and "tap for sound" banners. */
export function LiveControls({ live, video, showLeave = true }: { live: LiveRoomApi; video: boolean; showLeave?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { devices } = live;
  return (
    <div className="space-y-2">
      {live.reconnecting && (
        <p role="status" className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4" aria-hidden="true" />{t('reconnecting')}
        </p>
      )}
      {live.audioBlocked && (
        <button type="button" className="btn btn-accent w-full" onClick={live.startAudio}>
          <Volume2 className="h-4 w-4" aria-hidden="true" />{t('tap_for_sound')}
        </button>
      )}
      {!live.canPublish && <p className="text-center text-xs text-zinc-500">{t('watching_only')}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {live.canPublish && (
          <button type="button" className={`btn ${live.mic ? 'btn-primary' : 'btn-ghost'}`} onClick={live.toggleMic} aria-pressed={live.mic} disabled={!live.micAllowed}>
            {live.mic ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
            {!live.micAllowed ? t('muted_by_host') : t(live.mic ? 'mic_on' : 'mic_off')}
          </button>
        )}
        {live.canPublish && video && (
          <button type="button" className={`btn ${live.cam ? 'btn-primary' : 'btn-ghost'}`} onClick={live.toggleCam} aria-pressed={live.cam} disabled={!live.camAllowed}>
            {live.cam ? <Video className="h-4 w-4" aria-hidden="true" /> : <VideoOff className="h-4 w-4" aria-hidden="true" />}
            {t(live.cam ? 'cam_on' : 'cam_off')}
          </button>
        )}
        {live.canPublish && (devices.mics.length > 1 || devices.cams.length > 1) && (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />{t('devices')}
          </button>
        )}
        {showLeave && (
          <button type="button" className="btn btn-danger" onClick={live.leave}>
            <PhoneOff className="h-4 w-4" aria-hidden="true" />{t('leave_room')}
          </button>
        )}
      </div>
      {open && (
        <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-2">
          {devices.mics.length > 1 && (
            <label className="text-xs text-zinc-600">
              {t('microphone')}
              <select className="input mt-1" value={devices.activeMic ?? ''} onChange={(e) => live.pickDevice('audioinput', e.target.value)}>
                {devices.mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t('microphone')} ${i + 1}`}</option>)}
              </select>
            </label>
          )}
          {video && devices.cams.length > 1 && (
            <label className="text-xs text-zinc-600">
              {t('camera')}
              <select className="input mt-1" value={devices.activeCam ?? ''} onChange={(e) => live.pickDevice('videoinput', e.target.value)}>
                {devices.cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t('camera')} ${i + 1}`}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      {live.error && <p role="alert" className="text-center text-sm text-red-600">{live.error}</p>}
    </div>
  );
}
