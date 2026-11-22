import { Chevron } from './ui';
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useI18n } from '../state/I18n';
import { VSLA } from '../lib/vslaText';

/** A short "how it works" for savings groups, four numbered steps. Closed by default so the page stays clean. */
export function VslaGuide({ startOpen = false }: { startOpen?: boolean }) {
  const { lang } = useI18n();
  const w = VSLA[lang];
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 text-zinc-900">
      <button type="button" className="flex w-full items-center gap-2 text-left text-sm font-semibold" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <HelpCircle className="h-4 w-4 text-accent" aria-hidden="true" />
        <span className="flex-1">{open ? w.guideTitle : w.guideShow}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
          {w.guideSteps.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
              <span className="text-sm"><strong className="block font-semibold">{title}</strong><span className="text-zinc-600">{text}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
