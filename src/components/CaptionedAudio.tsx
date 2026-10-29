import { useEffect, useRef, useState } from 'react';
import { Headphones } from 'lucide-react';
import { canSpeak, cueAt, speak, stopSpeaking, useCaptions } from '../lib/captions';
import { TR } from '../lib/translate';
import { useI18n } from '../state/I18n';

/** An audio player with subtitles and a "Listen" button that reads the translation aloud (when the post has speech text). */
export function CaptionedAudio({ src, postId, version = 0 }: { src: string; postId: string; version?: number }) {
  const { lang } = useI18n();
  const w = TR[lang];
  const el = useRef<HTMLAudioElement>(null);
  const caps = useCaptions(postId, true, version);
  const [cc, setCc] = useState<boolean | null>(null);
  const [dub, setDub] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cue, setCue] = useState('');
  const showCc = cc ?? caps.translated;

  useEffect(() => {
    if (el.current) el.current.muted = dub;
    if (!dub) stopSpeaking();
    return () => stopSpeaking();
  }, [dub]);
  useEffect(() => {
    if (dub && playing && cue) speak(cue, lang);
    if (!playing) stopSpeaking();
  }, [dub, playing, cue, lang]);

  const btn = (on: boolean) => `btn btn-ghost btn-sm ${on ? 'border-zinc-900 text-zinc-900' : ''}`;
  return (
    <div>
      <audio ref={el} src={src} controls preload="none" className="w-full"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => caps.cues && setCue(cueAt(caps.cues, e.currentTarget.currentTime))} />
      {caps.cues && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn(showCc)} aria-pressed={showCc} onClick={() => setCc(!showCc)}>{w.captions}</button>
            {canSpeak() && (
              <button type="button" className={btn(dub)} aria-pressed={dub} onClick={() => setDub(!dub)}>
                <Headphones className="h-3.5 w-3.5" aria-hidden="true" />{dub ? w.stopListen : w.listen}
              </button>
            )}
          </div>
          {showCc && cue && <p className="rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm text-white">{cue}</p>}
        </div>
      )}
    </div>
  );
}
