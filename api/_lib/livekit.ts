import { HttpError } from './server';

/** LiveKit track sources as numbers (camera = 1, microphone = 2). */
const CAMERA = 1;
const MICROPHONE = 2;

export function livekitEnv(): { url: string; key: string; secret: string } {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new HttpError(503, 'LiveKit is not configured on the server');
  }
  return { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET };
}

/** The https address the server SDK talks to (the browser uses the wss address). */
export function livekitHttpUrl(url: string): string {
  return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

export interface Publishing {
  canPublish: boolean;
  /** Empty list = every source is allowed. */
  canPublishSources: number[];
}

/**
 * What a competitor (or the host) may send. Video battles: camera + microphone. Audio battles: microphone only.
 * When the host mutes someone, the microphone permission is taken away on the server, so it cannot be bypassed in the browser.
 */
export function publishing(mode: 'video' | 'audio', muted: boolean): Publishing {
  if (mode === 'audio') return muted ? { canPublish: false, canPublishSources: [] } : { canPublish: true, canPublishSources: [MICROPHONE] };
  return { canPublish: true, canPublishSources: muted ? [CAMERA] : [CAMERA, MICROPHONE] };
}
