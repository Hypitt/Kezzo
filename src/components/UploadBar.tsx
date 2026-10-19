import { RotateCcw, X } from 'lucide-react';
import { formatBytes } from '../lib/media';
import type { UploadFailure } from '../lib/upload';
import type { Key } from '../lib/i18n';
import { useI18n } from '../state/I18n';

/** The translated message key for each way an upload can fail. */
export const failureKey = (reason: UploadFailure): Key =>
  reason === 'too_big' ? 'err_plan_limit' : reason === 'denied' ? 'err_upload_denied' : reason === 'network' ? 'err_upload_network' : 'err_upload';

export interface UploadState {
  sent: number;
  total: number;
  failed: boolean;
  /** Translated reason, shown when failed. */
  message?: string;
}

/** Progress bar with Cancel and Retry, used by post uploads and chat attachments. */
export function UploadBar({ state, onCancel, onRetry }: { state: UploadState; onCancel: () => void; onRetry: () => void }) {
  const { t } = useI18n();
  const pct = state.total > 0 ? Math.min(100, Math.round((state.sent / state.total) * 100)) : 0;
  return (
    <div className="space-y-1.5 rounded-lg bg-zinc-50 p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
        <span className="tabular-nums">
          {state.failed ? t('upload_failed') : t('uploading')} {pct}% · {formatBytes(state.sent)} / {formatBytes(state.total)}
        </span>
        <span className="flex gap-1">
          {state.failed && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('retry')}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label={t('cancel')}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />{t('cancel')}
          </button>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${state.failed ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
      {state.failed && state.message && <p role="alert" className="text-xs text-red-600">{state.message}</p>}
    </div>
  );
}
