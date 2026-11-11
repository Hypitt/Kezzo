import { useEffect, useRef, useState } from 'react';
import { R2_URL, r2Enabled } from '../lib/storage';

/**
 * A muted, looping video that starts by itself when it is mostly on screen and pauses when it scrolls away.
 * The file is only requested when it is close to the screen.
 * Only files stored in Cloudflare R2 (no download fees) play by themselves. A video still in Supabase shows just its first frame,
 * because letting every tile stream would use up the Supabase bandwidth quota.
 */
export function AutoVideo({ src, label, className }: { src: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const seen = useRef(false);
  const free = r2Enabled && src.startsWith(`${R2_URL}/`);

  useEffect(() => {
    const v = ref.current;
    if (!v || !('IntersectionObserver' in window)) { setNear(true); return; }
    const load = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '300px 0px' });
    const play = !free ? null : new IntersectionObserver(([e]) => {
      seen.current = e.isIntersecting;
      if (e.isIntersecting) { v.muted = true; void v.play().catch(() => undefined); } else v.pause();
    }, { threshold: 0.5 });
    load.observe(v);
    play?.observe(v);
    return () => { load.disconnect(); play?.disconnect(); v.pause(); };
  }, [free]);

  return <video ref={ref} src={near ? `${src}#t=0.1` : undefined} muted loop playsInline autoPlay={free} preload={near ? 'metadata' : 'none'} aria-label={label} tabIndex={-1} className={className} onLoadedData={() => { const v = ref.current; if (v && seen.current && v.paused) { v.muted = true; void v.play().catch(() => undefined); } }} />;
}
