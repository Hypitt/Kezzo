import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../state/I18n';

/** Photos shown one at a time; swipe (touch) or use the arrows / keyboard. Works with a single photo too. */
export function PhotoCarousel({ urls, alt }: { urls: string[]; alt: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [urls.length]);

  const goTo = (i: number) => {
    const el = box.current;
    if (!el) return;
    const next = Math.max(0, Math.min(urls.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setIndex(next);
  };
  const onScroll = () => {
    const el = box.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (urls.length === 1) {
    return <img src={urls[0]} alt={alt} className="max-h-[32rem] w-full rounded-xl bg-zinc-100 object-contain" loading="lazy" decoding="async" />;
  }

  return (
    <div className="relative" role="group" aria-roledescription="carousel" aria-label={alt}>
      <div
        ref={box} onScroll={onScroll} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-xl bg-zinc-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((u, i) => (
          <img
            key={u} src={u} alt={t('photo_n', { i: i + 1, n: urls.length })}
            className="h-[min(32rem,70vh)] w-full shrink-0 snap-center object-contain" loading="lazy" decoding="async" draggable={false}
          />
        ))}
      </div>
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white" aria-hidden="true">{index + 1}/{urls.length}</span>
      {index > 0 && (
        <button type="button" onClick={() => goTo(index - 1)} aria-label={t('prev_photo')} className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white sm:flex">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      {index < urls.length - 1 && (
        <button type="button" onClick={() => goTo(index + 1)} aria-label={t('next_photo')} className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white sm:flex">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden="true">
        {urls.map((u, i) => <span key={u} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />)}
      </div>
    </div>
  );
}
