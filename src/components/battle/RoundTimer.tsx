import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { formatClock } from '../../lib/battle';
import { useI18n } from '../../state/I18n';

/** Countdown to a server-set end time. Everyone sees the same time. */
export function RoundTimer({ endsAt, offsetMs, big = false }: { endsAt: string | null; offsetMs: number; big?: boolean }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = (new Date(endsAt).getTime() - (now + offsetMs)) / 1000;
  const over = left <= 0;
  return (
    <span
      role="timer"
      aria-live="off"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold tabular-nums ${big ? 'text-lg' : 'text-xs'} ${over ? 'bg-red-100 text-red-700' : left <= 10 ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-800'}`}
    >
      <Timer className={big ? 'h-5 w-5' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {over ? t('times_up') : formatClock(left)}
    </span>
  );
}
