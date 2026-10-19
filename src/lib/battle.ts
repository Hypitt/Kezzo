import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Each competitor gets a number and a colour, used on their video tile, score card and vote buttons. */
export const COMPETITOR_COLORS = [
  { bg: 'bg-rose-500', text: 'text-rose-600', soft: 'bg-rose-50', border: 'border-rose-300' },
  { bg: 'bg-sky-500', text: 'text-sky-600', soft: 'bg-sky-50', border: 'border-sky-300' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', soft: 'bg-emerald-50', border: 'border-emerald-300' },
  { bg: 'bg-amber-500', text: 'text-amber-600', soft: 'bg-amber-50', border: 'border-amber-300' },
  { bg: 'bg-violet-500', text: 'text-violet-600', soft: 'bg-violet-50', border: 'border-violet-300' },
] as const;

export const TIMER_CHOICES = [30, 60, 90, 120, 180, 300, 600] as const;

/**
 * Difference between the server clock and this device's clock (ms), so every viewer sees the same countdown
 * even when their own clock is wrong.
 */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let off = false;
    const started = Date.now();
    supabase.rpc('server_time').then(({ data }) => {
      if (off || typeof data !== 'string') return;
      const mid = (started + Date.now()) / 2;
      setOffset(new Date(data).getTime() - mid);
    });
    return () => {
      off = true;
    };
  }, []);
  return offset;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
