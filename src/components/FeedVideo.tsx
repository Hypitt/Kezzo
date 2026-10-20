import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '../state/I18n';

/** Only one feed video plays at a time. */
let active: HTMLVideoElement | null = null;

const dataSaver = (): boolean => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * A feed video that plays by itself (muted, as browsers require) when most of it is on screen and pauses when it scrolls away.
 * Play/Pause and sound buttons stay visible. If the person pauses it, it stays paused until they press Play again.
 * The file is only requested when the video is close to the screen, and it is released again once the video is far
 * off screen, so a long feed never holds dozens of videos in the phone's memory.
 */
export function FeedVideo({ src }: { src: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const manualPause = useRef(false);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const resumeAt = useRef(0);

  // Load shortly before the video scrolls into view; free its memory once it is well off screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) return setNear(true);
      const v = video.current;
      if (v && v.getAttribute('src')) {
        resumeAt.current = v.currentTime || 0; // continue from here if they scroll back
        v.pause();
        v.removeAttribute('src');
        v.load(); // actually drops the downloaded video data
      }
      setNear(false);
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const start = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (active && active !== v) active.pause();
    active = v;
    v.play().catch(() => setPlaying(false)); // the browser may refuse; the Play button still works
  }, []);

  // Play while mostly visible, pause when it leaves the screen or the tab is hidden.
  useEffect(() => {
    const el = box.current;
    const v = video.current;
    if (!el || !v || !near) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!manualPause.current && !dataSaver() && !reducedMotion()) start();
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
  }, [near, start]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      manualPause.current = false;
      start();
    } else {
      manualPause.current = true;
      v.pause();
    }
  };

  const seek = (value: number) => {
    const v = video.current;
    if (v && Number.isFinite(v.duration)) v.currentTime = (value / 100) * v.duration;
  };

  return (
    <div ref={box} className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={video}
        src={near ? src : undefined}
        muted={muted}
        playsInline
        loop
        preload={near ? 'metadata' : 'none'}
        className="max-h-[32rem] min-h-40 w-full bg-black"
        onLoadedMetadata={(e) => {
          if (resumeAt.current > 0) e.currentTarget.currentTime = resumeAt.current;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        onClick={toggle}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
        <button type="button" onClick={toggle} aria-label={playing ? t('pause') : t('play')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
          {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </button>
        <input
          type="range" min={0} max={100} step={0.1} value={progress} onChange={(e) => seek(Number(e.target.value))}
          aria-label={t('seek')} className="h-1 min-w-0 flex-1 accent-white"
        />
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? t('sound_on') : t('sound_off')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
          {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
