import { useEffect, useState, type ReactNode } from 'react';
import { Spinner } from './ui';
import { useI18n } from '../state/I18n';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** When set, the person must type this exact text before the confirm button works. */
  requireText?: string;
  requireLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A proper confirmation pop-up (instead of the browser's plain prompt). */
export function ConfirmDialog({ title, children, confirmLabel, requireText, requireLabel, danger = true, busy = false, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const ok = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="space-y-2 text-sm text-zinc-600">{children}</div>
        {requireText && (
          <div>
            <label className="label" htmlFor="confirm-text">{requireLabel}</label>
            <input id="confirm-text" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>{t('cancel')}</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={!ok || busy}>
            {busy && <Spinner />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
