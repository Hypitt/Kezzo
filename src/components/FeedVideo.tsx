import { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '../state/I18n';
import { R2_URL, r2Enabled } from '../lib/storage';
import { canSpeak, cueAt, speak, stopSpeaking, useCaptions } from '../lib/captions';
import { TR } from '../lib/translate';

/** Only one feed video plays at a time. */
let active: HTMLVideoElement | null = null;
/** The person's sound choice, shared by every feed video: once they mute, videos stay muted until they turn sound on. */
let wantSound = true;
const canHaveSound = (): boolean => wantSound && ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? false);

/**
 * Videos use the most bandwidth. Videos stored in Cloudflare R2 (no download fees) play by themselves when scrolled into view.
 * Videos still stored in Supabase wait for a press on Play, so they do not use up Supabase's free bandwidth.
 * Set FORCE_AUTOPLAY to true to autoplay everything.
 */
const FORCE_AUTOPLAY = true;


/**
 * A feed video that plays by itself (muted, as browsers require) when most of it is on screen and pauses when it scrolls away.
 * Play/Pause and sound buttons stay visible. If the person pauses it, it stays paused until they press Play again.
 * The file is only requested when the video is close to the screen.
 */
export function FeedVideo({ src, postId, version = 0 }: { src: string; postId?: string; version?: number }) {
  const { t, lang } = useI18n();
  const w = TR[lang];
  const AUTOPLAY = FORCE_AUTOPLAY || (r2Enabled && src.startsWith(`${R2_URL}/`));
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const manualPause = useRef(false);
  const visible = useRef(false);
  const [near, setNear] = useState(false);
  const [armed, setArmed] = useState(false); // pressed Play at least once
  const live = AUTOPLAY ? near : armed;
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(() => !canHaveSound());
  const [progress, setProgress] = useState(0);
  // Subtitles and "Listen" (the translation read aloud) when the post has speech text
  const caps = useCaptions(postId ?? '', Boolean(postId) && near, version);
  const [cc, setCc] = useState<boolean | null>(null);
  const [dub, setDub] = useState(false);
  const dubRef = useRef(false);
  const [cue, setCue] = useState('');
  const showCc = cc ?? caps.translated;

  // Start loading shortly before the video scrolls into view.
  useEffect(() => {
    const el = box.current;
    if (!el || !AUTOPLAY) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [AUTOPLAY]);

  const start = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (active && active !== v) active.pause();
    active = v;
    // Sound is on when the browser allows it (after the person has tapped or clicked on the page); otherwise muted.
    const wantMuted = dubRef.current || !canHaveSound();
    v.muted = wantMuted;
    setMuted(wantMuted);
    v.play().catch(() => {
      if (!v.muted) { // blocked with sound: play muted instead; the sound button turns it on
        v.muted = true;
        setMuted(true);
        v.play().catch(() => setPlaying(false));
      } else setPlaying(false);
    });
  }, []);

  // Play while mostly visible, pause when it leaves the screen or the tab is hidden.
  useEffect(() => {
    const el = box.current;
    const v = video.current;
    if (!el || !v || !live) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (AUTOPLAY && !manualPause.current) start();
        } else v.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    const onHide = () => document.hidden && v.pause();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onHide);
      v.pause();
      if (active === v) active = null;
    };
  }, [live, start, AUTOPLAY]);

  // Browsers only autoplay muted video: make sure the element itself is muted (React alone does not always set it) before any play().
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.defaultMuted = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
  }, [live]);

  // First press on Play: the file is requested now, then plays.
  useEffect(() => { if (armed) start(); }, [armed, start]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (!armed) { manualPause.current = false; setArmed(true); return; }
    if (v.paused) {
      manualPause.current = false;
      start();
    } else {
      manualPause.current = true;
      v.pause();
    }
  };

  useEffect(() => {
    dubRef.current = dub;
    if (dub && video.current) { video.current.muted = true; setMuted(true); }
    if (!dub) stopSpeaking();
    return () => stopSpeaking();
  }, [dub]);
  useEffect(() => {
    if (dub && playing && cue) speak(cue, lang);
    if (!playing) stopSpeaking();
  }, [dub, playing, cue, lang]);

  const v_sync = (next: boolean) => {
    if (video.current) video.current.muted = next;
    setMuted(next);
  };

  const seek = (value: number) => {
    const v = video.current;
    if (v && Number.isFinite(v.duration)) v.currentTime = (value / 100) * v.duration;
  };

  return (
    <div ref={box} className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={video}
        src={live ? src : undefined}
        muted={muted}
        playsInline
        loop
        preload={live ? 'metadata' : 'none'}
        className="max-h-[32rem] min-h-40 w-full bg-black"
        onLoadedData={() => { const v = video.current; if (AUTOPLAY && v && v.paused && visible.current && !manualPause.current) start(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
          if (caps.cues) setCue(cueAt(caps.cues, v.currentTime));
        }}
        onClick={toggle}
      />
      {!armed && !AUTOPLAY && (
        <button type="button" onClick={toggle} aria-label={t('play')} className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white"><Play className="h-6 w-6 fill-white" aria-hidden="true" /></span>
        </button>
      )}
      {showCc && cue && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center px-3">
          <span className="rounded bg-black/75 px-2 py-1 text-center text-sm text-white">{cue}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
        <button type="button" onClick={toggle} aria-label={playing ? t('pause') : t('play')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
          {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </button>
        <input
          type="range" min={0} max={100} step={0.1} value={progress} onChange={(e) => seek(Number(e.target.value))}
          aria-label={t('seek')} className="h-1 min-w-0 flex-1 accent-white"
        />
        {caps.cues && (
          <button type="button" onClick={() => setCc(!showCc)} aria-pressed={showCc} aria-label={w.captions} title={w.captions}
            className={`flex h-8 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold text-white hover:bg-black/80 ${showCc ? 'bg-white/30' : 'bg-black/60'}`}>CC</button>
        )}
        {caps.cues && canSpeak() && (
          <button type="button" onClick={() => setDub(!dub)} aria-pressed={dub} aria-label={dub ? w.stopListen : w.listen} title={dub ? w.stopListen : w.listen}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white hover:bg-black/80 ${dub ? 'bg-white/30' : 'bg-black/60'}`}>
            <Headphones className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={() => { if (dub) { setDub(false); dubRef.current = false; } const next = !muted; wantSound = !next; v_sync(next); }} aria-label={muted ? t('sound_on') : t('sound_off')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
          {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
