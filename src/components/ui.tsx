import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { initials } from '../lib/format';

export function Avatar({ p, size = 36 }: { p: { display_name: string; avatar_url: string | null }; size?: number }) {
  const style = { width: size, height: size };
  return p.avatar_url ? (
    <img
      src={p.avatar_url}
      alt=""
      style={style}
      className="shrink-0 rounded-full bg-zinc-100 object-cover"
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span
      style={{ ...style, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700"
      aria-hidden="true"
    >
      {initials(p.display_name)}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} aria-hidden="true" />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-zinc-500">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500">
      <p>{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'}`}
    >
      {children}
    </button>
  );
}

export function LoadMore({ show, busy, onClick, label }: { show: boolean; busy: boolean; onClick: () => void; label: string }) {
  if (!show) return null;
  return (
    <div className="mt-5 flex justify-center">
      <button type="button" className="btn btn-ghost" onClick={onClick} disabled={busy}>
        {busy && <Spinner />}
        {label}
      </button>
    </div>
  );
}
