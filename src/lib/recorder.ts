/**
 * Battle recording and highlight clips, done entirely in the host's browser.
 *
 * Why not record on the server? LiveKit's server-side recording (Egress) needs a separate storage account and
 * paid minutes. Recording in the host's own browser costs nothing, never touches what viewers receive and only
 * runs when the host switches it on. To stay light it records at 960 px wide, 20 frames a second, about 2.5 Mbps,
 * and writes the file to the browser's IndexedDB in 5-second pieces, so a long battle never fills memory and a
 * browser crash or reload still leaves a playable file.
 */

export interface RecordingInfo {
  key: string;
  battleId: string;
  part: number;
  title: string;
  mime: string;
  video: boolean;
  /** Wall-clock start (ms since 1970); lets highlight suggestions line votes up with the video. */
  startedAt: number;
  durationMs: number;
  size: number;
  finished: boolean;
}

// ------------------------------------------------------------------------------------------------ storage

const DB_NAME = 'kezzo-recordings';
let dbPromise: Promise<IDBDatabase> | null = null;
const memory = new Map<string, Blob[]>(); // fallback when IndexedDB is unavailable (some private windows)
const memoryMeta = new Map<string, RecordingInfo>();

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('no indexeddb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('meta', { keyPath: 'key' }).createIndex('battle', 'battleId');
        db.createObjectStore('chunks', { autoIncrement: true }).createIndex('key', 'key');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putMeta(info: RecordingInfo): Promise<void> {
  memoryMeta.set(info.key, info);
  try {
    const db = await openDb();
    await wrap(db.transaction('meta', 'readwrite').objectStore('meta').put(info));
  } catch { /* the in-memory copy still works for this session */ }
}

async function putChunk(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await wrap(db.transaction('chunks', 'readwrite').objectStore('chunks').add({ key, blob }));
  } catch {
    const list = memory.get(key) ?? [];
    list.push(blob);
    memory.set(key, list);
  }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
/** Calls back whenever a recording starts, grows, finishes or is deleted. Returns the unsubscribe function. */
export function onRecordingsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function listRecordings(battleId: string): Promise<RecordingInfo[]> {
  const found = new Map<string, RecordingInfo>();
  try {
    const db = await openDb();
    const rows = await wrap(db.transaction('meta', 'readonly').objectStore('meta').index('battle').getAll(battleId));
    (rows as RecordingInfo[]).forEach((r) => found.set(r.key, r));
  } catch { /* fall back to memory */ }
  memoryMeta.forEach((r) => r.battleId === battleId && !found.has(r.key) && found.set(r.key, r));
  return [...found.values()].sort((a, b) => a.part - b.part);
}

export async function recordingBlob(info: RecordingInfo): Promise<Blob | null> {
  const parts: Blob[] = [];
  try {
    const db = await openDb();
    const rows = await wrap(db.transaction('chunks', 'readonly').objectStore('chunks').index('key').getAll(info.key));
    (rows as Array<{ blob: Blob }>).forEach((r) => parts.push(r.blob));
  } catch { /* memory below */ }
  (memory.get(info.key) ?? []).forEach((b) => parts.push(b));
  return parts.length ? new Blob(parts, { type: info.mime.split(';')[0] }) : null;
}

export async function deleteRecording(info: RecordingInfo): Promise<void> {
  memory.delete(info.key);
  memoryMeta.delete(info.key);
  try {
    const db = await openDb();
    const tx = db.transaction(['meta', 'chunks'], 'readwrite');
    tx.objectStore('meta').delete(info.key);
    const index = tx.objectStore('chunks').index('key');
    const cursor = index.openKeyCursor(IDBKeyRange.only(info.key));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { tx.objectStore('chunks').delete(c.primaryKey); c.continue(); }
    };
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch { /* nothing else to clean */ }
  emit();
}

export function fileExtension(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

// ------------------------------------------------------------------------------------------------ helpers

/** A timer that keeps ticking even when the tab is in the background (browsers slow down normal timers there). */
function ticker(fn: () => void, ms: number): () => void {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = fn;
    return () => { worker.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }
}

function pickMime(video: boolean): string {
  const options = video
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && Boolean(pickMime(true) || pickMime(false));
}

const FPS = 20;
const WIDTH = 960;
const VIDEO_BPS = 2_500_000;
const AUDIO_BPS = 128_000;
const CHUNK_MS = 5000;

// ------------------------------------------------------------------------------------------------ recorder

export interface RecorderOptions {
  battleId: string;
  title: string;
  /** The element that holds all the tiles. Every `[data-rec-name]` tile inside it is drawn into the recording. */
  container: HTMLElement;
  video: boolean;
  /** Current microphone tracks of everyone in the room (including the host's own). */
  audioTracks: () => MediaStreamTrack[];
}

/** The recorder that is running right now (there is at most one). */
let current: BattleRecorder | null = null;
export const activeRecorder = (): BattleRecorder | null => current;

export class BattleRecorder {
  private opts: RecorderOptions;
  private rec: MediaRecorder | null = null;
  private stops: Array<() => void> = [];
  private writes: Promise<void> = Promise.resolve();
  private info: RecordingInfo | null = null;
  private audio: AudioContext | null = null;
  private stopping: Promise<RecordingInfo | null> | null = null;
  private cancelled = false;
  startedAt = 0;

  get battleId(): string {
    return this.opts.battleId;
  }

  constructor(opts: RecorderOptions) {
    this.opts = opts;
  }

  elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  async start(): Promise<void> {
    if (current) throw new Error('already recording');
    const { battleId, title, container, video } = this.opts;
    const mime = pickMime(video);
    if (!mime || typeof MediaRecorder === 'undefined') throw new Error('unsupported');

    const existing = await listRecordings(battleId);
    const part = existing.reduce((n, r) => Math.max(n, r.part), 0) + 1;
    if (this.cancelled) return; // stopped before it even began (the page changed)

    const tracks: MediaStreamTrack[] = [];
    let canvas: HTMLCanvasElement | null = null;
    if (video) {
      const box = container.getBoundingClientRect();
      const ratio = box.width > 0 ? box.height / box.width : 9 / 16;
      canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = Math.max(360, Math.min(1200, Math.round((WIDTH * ratio) / 2) * 2));
      tracks.push(...canvas.captureStream(FPS).getVideoTracks());
    }

    // Everyone's voice mixed into one track.
    const ac = new AudioContext();
    this.audio = ac;
    const dest = ac.createMediaStreamDestination();
    const sources = new Map<string, MediaStreamAudioSourceNode>();
    const syncAudio = () => {
      const live = this.opts.audioTracks().filter((t) => t.readyState === 'live');
      const ids = new Set(live.map((t) => t.id));
      live.forEach((t) => {
        if (sources.has(t.id)) return;
        const node = ac.createMediaStreamSource(new MediaStream([t]));
        node.connect(dest);
        sources.set(t.id, node);
      });
      sources.forEach((node, id) => {
        if (ids.has(id)) return;
        node.disconnect();
        sources.delete(id);
      });
    };
    syncAudio();
    tracks.push(...dest.stream.getAudioTracks());

    this.info = { key: `${battleId}#${part}`, battleId, part, title, mime, video, startedAt: Date.now(), durationMs: 0, size: 0, finished: false };
    this.startedAt = this.info.startedAt;
    await putMeta(this.info);
    if (this.cancelled) {
      ac.close().catch(() => undefined);
      await deleteRecording(this.info);
      return;
    }

    const rec = new MediaRecorder(new MediaStream(tracks), {
      mimeType: mime,
      audioBitsPerSecond: AUDIO_BPS,
      ...(video ? { videoBitsPerSecond: VIDEO_BPS } : {}),
    });
    this.rec = rec;
    rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size || !this.info) return;
      const blob = e.data;
      this.writes = this.writes.then(async () => {
        if (!this.info) return;
        await putChunk(this.info.key, blob);
        this.info = { ...this.info, size: this.info.size + blob.size, durationMs: this.elapsedMs() };
        await putMeta(this.info);
        emit();
      });
    };

    if (canvas) this.stops.push(ticker(() => this.draw(canvas as HTMLCanvasElement), Math.round(1000 / FPS)));
    this.stops.push(ticker(syncAudio, 1500));
    rec.start(CHUNK_MS);
    current = this;
    emit();
  }

  private draw(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    const box = this.opts.container.getBoundingClientRect();
    if (!ctx || box.width < 2) return;
    const kx = canvas.width / box.width;
    const ky = canvas.height / box.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.opts.container.querySelectorAll<HTMLElement>('[data-rec-name]').forEach((tile) => {
      const r = tile.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const x = (r.left - box.left) * kx;
      const y = (r.top - box.top) * ky;
      const w = r.width * kx;
      const h = r.height * ky;
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x, y, w, h);
      const v = tile.querySelector('video');
      if (v && v.readyState >= 2 && v.videoWidth > 0 && v.getBoundingClientRect().width > 1) {
        const scale = Math.max(w / v.videoWidth, h / v.videoHeight);
        const sw = w / scale;
        const sh = h / scale;
        ctx.save();
        if (v.classList.contains('-scale-x-100')) {
          ctx.translate(x + w, y);
          ctx.scale(-1, 1);
          ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
        } else {
          ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, x, y, w, h);
        }
        ctx.restore();
      }
      const name = tile.dataset.recName ?? '';
      if (name) {
        ctx.font = `600 ${Math.round(canvas.width / 60)}px sans-serif`;
        const pad = 6;
        const tw = Math.min(ctx.measureText(name).width + pad * 2, w - 8);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x + 6, y + h - 28, tw, 22);
        ctx.fillStyle = '#fff';
        ctx.fillText(name, x + 6 + pad, y + h - 12, tw - pad * 2);
      }
    });
  }

  /** Stops recording and finishes the file. Safe to call more than once. */
  stop(): Promise<RecordingInfo | null> {
    if (this.stopping) return this.stopping;
    this.cancelled = true;
    this.stopping = (async () => {
      const rec = this.rec;
      this.stops.forEach((s) => s());
      this.stops = [];
      if (rec && rec.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          try { rec.stop(); } catch { resolve(); }
        });
      }
      rec?.stream.getTracks().forEach((t) => t.stop());
      await this.writes;
      this.audio?.close().catch(() => undefined);
      if (current === this) current = null;
      if (this.info) {
        this.info = { ...this.info, durationMs: this.elapsedMs(), finished: true };
        await putMeta(this.info);
      }
      emit();
      return this.info;
    })();
    return this.stopping;
  }
}

// ------------------------------------------------------------------------------------------------ highlights

export const HIGHLIGHT_SECONDS = 90;

/** MediaRecorder files have no length header, so the browser reports "infinite". Asking it to jump far ahead fixes that. */
async function makeSeekable(v: HTMLVideoElement): Promise<void> {
  if (Number.isFinite(v.duration)) return;
  await new Promise<void>((resolve) => {
    const done = () => { v.removeEventListener('timeupdate', done); resolve(); };
    v.addEventListener('timeupdate', done);
    v.currentTime = 1e101;
    window.setTimeout(done, 4000);
  });
  v.currentTime = 0;
}

/** Loads a video and returns it ready for seeking, plus its real length in seconds. */
export async function openForClip(source: Blob): Promise<{ url: string; seconds: number }> {
  const url = URL.createObjectURL(source);
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.src = url;
  await new Promise<void>((resolve, reject) => {
    v.onloadedmetadata = () => resolve();
    v.onerror = () => reject(new Error('unreadable'));
  });
  await makeSeekable(v);
  const seconds = v.duration;
  v.removeAttribute('src');
  if (!Number.isFinite(seconds)) { URL.revokeObjectURL(url); throw new Error('unknown duration'); }
  return { url, seconds };
}

export function clipSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && typeof AudioContext !== 'undefined';
}

/**
 * Cuts `lengthSec` seconds starting at `startSec` into a new video file. The browser plays that stretch at normal
 * speed while re-recording it, so a 90-second clip takes about 90 seconds. No upload and no extra library needed.
 */
export async function makeClip(
  source: Blob,
  startSec: number,
  lengthSec: number,
  onProgress: (fraction: number) => void,
  cancel: { cancelled: boolean },
): Promise<Blob> {
  const url = URL.createObjectURL(source);
  const v = document.createElement('video');
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  const ac = new AudioContext();
  let stopTick: (() => void) | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error('unreadable'));
    });
    await makeSeekable(v);
    await ac.resume();

    // Sound goes to the recorder only, so nothing plays out loud while the clip is made.
    const dest = ac.createMediaStreamDestination();
    ac.createMediaElementSource(v).connect(dest);

    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round((v.videoWidth * scale) / 2) * 2);
    canvas.height = Math.max(2, Math.round((v.videoHeight * scale) / 2) * 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');

    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      v.currentTime = startSec;
    });

    const mime = pickMime(true);
    const rec = new MediaRecorder(new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]), {
      mimeType: mime, videoBitsPerSecond: 3_000_000, audioBitsPerSecond: AUDIO_BPS,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const finished = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });

    const end = startSec + lengthSec;
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      v.pause();
      if (rec.state !== 'inactive') rec.stop();
    };
    stopTick = ticker(() => {
      if (stopped) return;
      if (cancel.cancelled || v.currentTime >= end - 0.05 || v.ended) return stop();
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(1, Math.max(0, (v.currentTime - startSec) / lengthSec)));
    }, 33);

    rec.start(1000);
    await v.play();
    window.setTimeout(stop, (lengthSec + 15) * 1000); // never hang
    await finished;
    if (cancel.cancelled) throw new Error('cancelled');
    onProgress(1);
    return new Blob(chunks, { type: mime.split(';')[0] });
  } finally {
    stopTick?.();
    v.pause();
    v.removeAttribute('src');
    ac.close().catch(() => undefined);
    URL.revokeObjectURL(url);
  }
}

/**
 * Picks the most eventful 90 seconds. `events` are moments (seconds from the start of the video) with a weight:
 * coin votes, judge scores and chat messages. Returns where the clip should start.
 */
export function suggestStart(events: Array<{ t: number; w: number }>, totalSec: number, windowSec = HIGHLIGHT_SECONDS): number {
  const latest = Math.max(0, totalSec - windowSec);
  const inside = events.filter((e) => e.t >= 0 && e.t <= totalSec).sort((a, b) => a.t - b.t);
  if (!inside.length) return 0;
  let best = 0;
  let bestStart = inside[0].t;
  let sum = 0;
  let lo = 0;
  for (let hi = 0; hi < inside.length; hi++) {
    sum += inside[hi].w;
    while (inside[hi].t - inside[lo].t > windowSec) sum -= inside[lo++].w;
    if (sum > best) { best = sum; bestStart = inside[lo].t; }
  }
  return Math.min(latest, Math.max(0, bestStart - 5)); // start a few seconds early for context
}
