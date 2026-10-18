import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Radio, Video, VideoOff } from 'lucide-react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { api } from '../lib/api';
import { initials } from '../lib/format';
import { useI18n } from '../state/I18n';
import { useAuth } from '../state/Auth';
import { Spinner } from './ui';

interface Props {
  /** "battle:<id>", "group:<id>" or "dm:<idA>:<idB>". The server decides who may join and publish. */
  roomName: string;
  /** Show camera controls and video tiles (false = audio-only room). */
  video: boolean;
}

type Phase = 'idle' | 'connecting' | 'connected';

function mediaErrorKey(err: unknown): 'media_denied' | 'media_unsupported' | 'media_error' {
  const e = err as { name?: string; message?: string };
  if (e?.name === 'NotAllowedError' || /permission|denied/i.test(e?.message ?? '')) return 'media_denied';
  if (e?.name === 'NotFoundError' || e?.name === 'NotReadableError') return 'media_unsupported';
  return 'media_error';
}

/**
 * Real-time audio/video with LiveKit. Camera and microphone are only requested when the user
 * turns them on, and every local track is stopped when they leave or navigate away.
 */
export function LiveRoom({ roomName, video }: Props) {
  const { t } = useI18n();
  const { ensureAuth } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [canPublish, setCanPublish] = useState(false);
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const leave = useCallback(() => {
    roomRef.current?.disconnect(); // also stops the camera and microphone tracks
    roomRef.current = null;
    setPhase('idle');
    setMic(false);
    setCam(false);
  }, []);

  // Leave when the room changes or the component unmounts (e.g. switching tabs): turns the camera light off.
  useEffect(() => leave, [roomName, leave]);

  const join = async () => {
    if (!ensureAuth()) return;
    setPhase('connecting');
    setError(null);
    try {
      if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
      const { token, url, canPublish: allowed } = await api<{ token: string; url: string; canPublish: boolean }>('livekit-token', { room: roomName });
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room
        .on(RoomEvent.ParticipantConnected, bump)
        .on(RoomEvent.ParticipantDisconnected, bump)
        .on(RoomEvent.TrackSubscribed, bump)
        .on(RoomEvent.TrackUnsubscribed, bump)
        .on(RoomEvent.TrackMuted, bump)
        .on(RoomEvent.TrackUnmuted, bump)
        .on(RoomEvent.LocalTrackPublished, bump)
        .on(RoomEvent.LocalTrackUnpublished, bump)
        .on(RoomEvent.ActiveSpeakersChanged, bump)
        .on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setPhase('idle');
          setMic(false);
          setCam(false);
        });
      await room.connect(url, token);
      await room.startAudio().catch(() => undefined);
      roomRef.current = room;
      setCanPublish(allowed);
      setPhase('connected');
    } catch (err) {
      setPhase('idle');
      const e = err as Error;
      setError(e.name === 'InsecureContext' ? t('media_insecure') : e.message || t('error_generic'));
    }
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!mic);
      setMic(!mic);
      setError(null);
    } catch (err) {
      setError(t(mediaErrorKey(err)));
    }
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(!cam);
      setCam(!cam);
      setError(null);
    } catch (err) {
      setError(t(mediaErrorKey(err)));
    }
  };

  const room = roomRef.current;
  const participants: Participant[] = room ? [room.localParticipant, ...Array.from(room.remoteParticipants.values())] : [];

  if (phase !== 'connected') {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-900 p-6 text-center text-white">
        <Radio className="h-6 w-6 text-accent" aria-hidden="true" />
        <p className="max-w-sm text-sm text-zinc-300">{t(video ? 'room_intro_video' : 'room_intro_audio')}</p>
        <button type="button" className="btn btn-accent" onClick={join} disabled={phase === 'connecting'}>
          {phase === 'connecting' && <Spinner />}
          {t('enter_room')}
        </button>
        {error && <p role="alert" className="max-w-sm text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${participants.length > 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {participants.map((p) => (
          <Tile key={p.identity} p={p} video={video} local={p === room?.localParticipant} />
        ))}
      </div>
      {!canPublish && <p className="text-center text-xs text-zinc-500">{t('watching_only')}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {canPublish && (
          <button type="button" className={`btn ${mic ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleMic} aria-pressed={mic}>
            {mic ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
            {t(mic ? 'mic_on' : 'mic_off')}
          </button>
        )}
        {canPublish && video && (
          <button type="button" className={`btn ${cam ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleCam} aria-pressed={cam}>
            {cam ? <Video className="h-4 w-4" aria-hidden="true" /> : <VideoOff className="h-4 w-4" aria-hidden="true" />}
            {t(cam ? 'cam_on' : 'cam_off')}
          </button>
        )}
        <button type="button" className="btn btn-danger" onClick={leave}>
          <PhoneOff className="h-4 w-4" aria-hidden="true" />
          {t('leave_room')}
        </button>
      </div>
      {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Tile({ p, video, local }: { p: Participant; video: boolean; local: boolean }) {
  const videoEl = useRef<HTMLVideoElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const camPub = p.getTrackPublication(Track.Source.Camera);
  const micPub = p.getTrackPublication(Track.Source.Microphone);
  const camTrack = camPub?.track;
  const micTrack = micPub?.track;
  const camVisible = Boolean(camTrack) && !camPub?.isMuted;
  const micOn = Boolean(micTrack) && !micPub?.isMuted;

  useEffect(() => {
    const el = videoEl.current;
    if (!el || !camTrack || !camVisible) return;
    camTrack.attach(el);
    return () => {
      camTrack.detach(el);
    };
  }, [camTrack, camVisible]);

  useEffect(() => {
    const el = audioEl.current;
    if (local || !el || !micTrack) return; // never play our own microphone back to us
    micTrack.attach(el);
    return () => {
      micTrack.detach(el);
    };
  }, [micTrack, local]);

  const name = p.name || 'Guest';
  return (
    <div className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-zinc-900 ${p.isSpeaking ? 'ring-2 ring-accent' : ''}`}>
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
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-lg font-semibold text-white" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      {!local && <audio ref={audioEl} autoPlay />}
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
        {micOn ? <Mic className="h-3 w-3" aria-hidden="true" /> : <MicOff className="h-3 w-3" aria-hidden="true" />}
        {name}
      </span>
    </div>
  );
}
