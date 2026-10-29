import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { api } from './api';
import type { Lang } from './types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';

export interface Cue { s: number; e: number; t: string }

export const SPEECH_LANG: Record<Lang, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', hi: 'hi-IN' };
export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const cache = new Map<string, { cues: Cue[]; translated: boolean }>();

export interface Captions {
  cues: Cue[] | null;      // null: this post has no speech text
  translated: boolean;     // the cues are in the viewer's language
}

/** The speech text of a free video or audio post, in the viewer's language when it can be translated. */
export function useCaptions(postId: string, enabled: boolean, version = 0): Captions {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [state, setState] = useState<Captions>({ cues: null, translated: false });

  useEffect(() => {
    if (!enabled || !user || !postId) return;
    const key = `${postId}|${lang}|${version}`;
    const hit = cache.get(key);
    if (hit) { setState(hit); return; }
    let off = false;
    void (async () => {
      const { data } = await supabase.from('post_transcripts').select('lang,segments').eq('post_id', postId).maybeSingle();
      if (off || !data) return;
      const segs = (data.segments as Cue[]) ?? [];
      if (!segs.length) return;
      let result: Captions = { cues: segs, translated: data.lang === lang };
      if (data.lang !== lang) {
        try {
          const r = await api<{ segments: Cue[] }>('translate', { action: 'segments', postId, target: lang });
          result = { cues: r.segments, translated: true };
        } catch { /* keep the original-language subtitles */ }
      }
      cache.set(key, result);
      if (!off) setState(result);
    })();
    return () => { off = true; };
  }, [postId, enabled, user, lang, version]);

  return state;
}

export function cueAt(cues: Cue[] | null, time: number): string {
  if (!cues) return '';
  for (const c of cues) if (time >= c.s - 0.1 && time <= c.e + 0.2) return c.t;
  return '';
}

export function speak(text: string, lang: Lang): void {
  if (!canSpeak() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_LANG[lang];
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
