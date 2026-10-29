import { api } from './api';
import { supabase } from './supabase';
import type { Cue } from './captions';

const RATE = 16000;
const PIECE_SECONDS = 40;
const MAX_SECONDS = 180;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

export type TranscribeResult = 'ok' | 'no_speech' | 'failed' | 'busy';

/** Cuts the sound of a video or audio file into 16 kHz mono pieces (the way the speech model wants it). */
async function pieces(file: Blob): Promise<Float32Array[]> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    const seconds = Math.min(decoded.duration, MAX_SECONDS);
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * RATE)), RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const data = (await offline.startRendering()).getChannelData(0);
    const size = PIECE_SECONDS * RATE;
    const out: Float32Array[] = [];
    for (let i = 0; i < data.length; i += size) out.push(data.slice(i, i + size));
    return out;
  } finally {
    void ctx.close();
  }
}

function wavBase64(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const loud = (s: Float32Array): boolean => {
  let sum = 0;
  for (let i = 0; i < s.length; i += 8) sum += s[i] * s[i];
  return Math.sqrt(sum / (s.length / 8)) > 0.004;
};

/** Listens to a video or audio file in the browser, turns the speech into timed text, and saves it for the post. Best effort. */
export async function transcribePost(postId: string, file: Blob): Promise<TranscribeResult> {
  if (file.size > MAX_FILE_BYTES) return 'failed';
  try {
    const chunks = await pieces(file);
    const cues: Cue[] = [];
    let lang = '';
    for (let i = 0; i < chunks.length; i++) {
      if (!loud(chunks[i])) continue;
      const r = await api<{ text: string; lang: string; segments: Cue[] }>('translate', { action: 'transcribe', audio: wavBase64(chunks[i]) });
      if (!lang && r.text) lang = r.lang;
      const offset = i * PIECE_SECONDS;
      for (const c of r.segments) cues.push({ s: Math.round((c.s + offset) * 10) / 10, e: Math.round((c.e + offset) * 10) / 10, t: c.t });
    }
    if (!cues.length || cues.map((c) => c.t).join('').length < 3) return 'no_speech';
    const { error } = await supabase.from('post_transcripts').upsert({ post_id: postId, lang: lang || 'en', segments: cues.slice(0, 300) }, { onConflict: 'post_id' });
    return error ? 'failed' : 'ok';
  } catch (err) {
    const status = (err as { status?: number }).status;
    return status === 429 || status === 503 ? 'busy' : 'failed';
  }
}
