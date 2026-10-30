import { useEffect, useRef, useState } from 'react';


/**
 * A muted, looping video that starts by itself when it is mostly on screen and pauses when it scrolls away.
 * The file is only requested when it is close to the screen.
 */
export function AutoVideo({ src, label, className }: { src: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const seen = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !('IntersectionObserver' in window)) { setNear(true); return; }
    const load = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '300px 0px' });
    const play = new IntersectionObserver(([e]) => {
      seen.current = e.isIntersecting;
      if (e.isIntersecting) { v.muted = true; void v.play().catch(() => undefined); } else v.pause();
    }, { threshold: 0.5 });
    load.observe(v);
    play.observe(v);
    return () => { load.disconnect(); play.disconnect(); v.pause(); };
  }, []);

  return <video ref={ref} src={near ? `${src}#t=0.1` : undefined} muted loop playsInline autoPlay preload={near ? 'auto' : 'none'} aria-label={label} tabIndex={-1} className={className} onLoadedData={() => { const v = ref.current; if (v && seen.current && v.paused) { v.muted = true; void v.play().catch(() => undefined); } }} />;
}
