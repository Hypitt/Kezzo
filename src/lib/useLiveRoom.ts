import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { DisconnectReason, Participant, Room } from 'livekit-client';
import { api } from './api';
import type { Key } from './i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';

export type Phase = 'idle' | 'connecting' | 'connected';

export interface DeviceList {
  mics: MediaDeviceInfo[];
  cams: MediaDeviceInfo[];
  activeMic?: string;
  activeCam?: string;
}

export interface LiveRoomApi {
  room: Room | null;
  phase: Phase;
  error: string | null;
  canPublish: boolean;
  /** False when the host muted this person (their microphone permission was removed). */
  micAllowed: boolean;
  camAllowed: boolean;
  mic: boolean;
  cam: boolean;
  reconnecting: boolean;
  audioBlocked: boolean;
  devices: DeviceList;
  join: () => Promise<void>;
  leave: () => void;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  startAudio: () => Promise<void>;
  pickDevice: (kind: 'audioinput' | 'videoinput', id: string) => Promise<void>;
  participants: Participant[];
}

const SOURCE = { camera: 1, microphone: 2 } as const;

/** Whether the server lets this participant publish the given kind of track. */
export function sourceAllowed(p: Participant | undefined, source: keyof typeof SOURCE): boolean {
  const perm = p?.permissions;
  if (!perm || !perm.canPublish) return false;
  const list = ((perm as unknown as { canPublishSources?: number[] }).canPublishSources ?? []) as number[];
  return list.length === 0 || list.includes(SOURCE[source]);
}

function mediaErrorKey(err: unknown): Key {
  const e = err as { name?: string; message?: string };
  const name = e?.name ?? '';
  if (/NotAllowed|Security|PermissionDenied/i.test(name) || /permission|denied/i.test(e?.message ?? '')) return 'media_denied';
  if (/NotFound|DevicesNotFound/i.test(name)) return 'media_unsupported';
  if (/NotReadable|TrackStart/i.test(name)) return 'media_in_use';
  return 'media_error';
}

/**
 * Everything needed to run a LiveKit room reliably in the browser: connect, publish, mute, switch devices,
 * recover from network drops and from browsers that block sound until the person taps.
 * Camera and microphone are only requested after a click, and every track is stopped on leave.
 */
export function useLiveRoom({ roomName, video, autoPublish }: { roomName: string; video: boolean; autoPublish: boolean }): LiveRoomApi {
  const { t } = useI18n();
  const { ensureAuth } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const leftByUser = useRef(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [devices, setDevices] = useState<DeviceList>({ mics: [], cams: [] });
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const refreshDevices = useCallback(async () => {
    try {
      const { Room: LkRoom } = await import('livekit-client'); // loaded on demand: the video library is large
      const [mics, cams] = await Promise.all([LkRoom.getLocalDevices('audioinput', false), video ? LkRoom.getLocalDevices('videoinput', false) : Promise.resolve([])]);
      const room = roomRef.current;
      setDevices({
        mics: mics.filter((d) => d.deviceId),
        cams: cams.filter((d) => d.deviceId),
        activeMic: room?.getActiveDevice('audioinput'),
        activeCam: room?.getActiveDevice('videoinput'),
      });
    } catch {
      /* device lists are a nice extra; ignore failures */
    }
  }, [video]);

  const leave = useCallback(() => {
    leftByUser.current = true;
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect(true); // also stops the camera and microphone
    setPhase('idle');
    setReconnecting(false);
    setAudioBlocked(false);
    bump();
  }, []);

  // Leave when the room changes or the page section goes away (turns the camera light off).
  useEffect(() => () => leave(), [roomName, leave]);

  const publish = useCallback(
    async (kind: 'mic' | 'cam', on: boolean): Promise<void> => {
      const room = roomRef.current;
      if (!room) return;
      if (on && (!window.isSecureContext || !navigator.mediaDevices)) {
        setError(t('media_insecure'));
        return;
      }
      try {
        if (kind === 'mic') await room.localParticipant.setMicrophoneEnabled(on);
        else {
          try {
            await room.localParticipant.setCameraEnabled(on);
          } catch (err) {
            // Some cameras refuse HD; retry with a smaller picture before giving up.
            if (on && (err as { name?: string }).name === 'OverconstrainedError') {
              const { VideoPresets } = await import('livekit-client');
              await room.localParticipant.setCameraEnabled(true, { resolution: VideoPresets.h360.resolution });
            } else throw err;
          }
        }
        setError(null);
        refreshDevices();
      } catch (err) {
        setError(t(mediaErrorKey(err)));
      }
      bump();
    },
    [refreshDevices, t],
  );

  const join = useCallback(async () => {
    if (!ensureAuth() || roomRef.current) return;
    leftByUser.current = false;
    setPhase('connecting');
    setError(null);
    try {
      const { token, url, canPublish: allowed } = await api<{ token: string; url: string; canPublish: boolean }>('livekit-token', { room: roomName });
      const { Room: LkRoom, RoomEvent, VideoPresets, DisconnectReason: Reason } = await import('livekit-client');
      const room = new LkRoom({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        videoCaptureDefaults: { resolution: VideoPresets.h720.resolution, facingMode: 'user' },
        publishDefaults: { simulcast: true },
      });
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
        .on(RoomEvent.ParticipantPermissionsChanged, (_previous: unknown, who: Participant) => {
          // The host can let a guest on stage (or take them off) while the room is running.
          if (who === room.localParticipant) setCanPublish(Boolean(who.permissions?.canPublish));
          bump();
        })
        .on(RoomEvent.Reconnecting, () => setReconnecting(true))
        .on(RoomEvent.Reconnected, () => setReconnecting(false))
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
        .on(RoomEvent.MediaDevicesError, (e: Error) => setError(t(mediaErrorKey(e))))
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          if (roomRef.current === room) roomRef.current = null;
          setPhase('idle');
          setReconnecting(false);
          if (leftByUser.current) return;
          if (reason === Reason.PARTICIPANT_REMOVED) setError(t('removed_from_room'));
          else if (reason === Reason.DUPLICATE_IDENTITY) setError(t('duplicate_session'));
          else setError(t('conn_lost'));
        });
      await room.connect(url, token, { autoSubscribe: true });
      if (leftByUser.current) {
        room.disconnect(true);
        return;
      }
      roomRef.current = room;
      await room.startAudio().catch(() => undefined);
      setAudioBlocked(!room.canPlaybackAudio);
      setCanPublish(allowed);
      setPhase('connected');
      await refreshDevices();
      if (allowed && autoPublish) {
        if (sourceAllowed(room.localParticipant, 'microphone')) await publish('mic', true);
        if (video && sourceAllowed(room.localParticipant, 'camera')) await publish('cam', true);
      }
    } catch (err) {
      setPhase('idle');
      const message = (err as Error).message || '';
      setError(/not configured/i.test(message) ? t('live_not_configured') : message || t('error_generic'));
    }
  }, [ensureAuth, roomName, t, refreshDevices, autoPublish, video, publish]);

  const room = roomRef.current;
  const local = room?.localParticipant;
  const micAllowed = canPublish && sourceAllowed(local, 'microphone');
  const camAllowed = canPublish && sourceAllowed(local, 'camera');

  // If the host takes the microphone permission away, make sure our side lets go of the device too.
  useEffect(() => {
    if (room && canPublish && !micAllowed && local?.isMicrophoneEnabled) void room.localParticipant.setMicrophoneEnabled(false);
  }, [room, canPublish, micAllowed, local?.isMicrophoneEnabled]);

  const pickDevice = useCallback(
    async (kind: 'audioinput' | 'videoinput', id: string) => {
      try {
        await roomRef.current?.switchActiveDevice(kind, id);
        await refreshDevices();
      } catch (err) {
        setError(t(mediaErrorKey(err)));
      }
    },
    [refreshDevices, t],
  );

  return {
    room,
    phase,
    error,
    canPublish,
    micAllowed,
    camAllowed,
    mic: Boolean(local?.isMicrophoneEnabled),
    cam: Boolean(local?.isCameraEnabled),
    reconnecting,
    audioBlocked,
    devices,
    join,
    leave,
    toggleMic: () => publish('mic', !local?.isMicrophoneEnabled),
    toggleCam: () => publish('cam', !local?.isCameraEnabled),
    startAudio: async () => {
      await roomRef.current?.startAudio().catch(() => undefined);
      setAudioBlocked(!(roomRef.current?.canPlaybackAudio ?? true));
    },
    pickDevice,
    participants: room ? [room.localParticipant, ...Array.from(room.remoteParticipants.values())] : [],
  };
}
