import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Send, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { formatClock } from '../lib/battle';
import { formatBytes } from '../lib/media';
import { deleteRecording, downloadBlob, fileExtension, listRecordings, onRecordingsChanged, recordingBlob, type RecordingInfo } from '../lib/recorder';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, startUpload, type UploadFailure, type UploadHandle } from '../lib/upload';
import { publicFilePath } from '../lib/storage';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { UploadBar, failureKey, type UploadState } from './UploadBar';
import { Spinner } from './ui';

export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'session';

/**
 * One saved recording: download it, post it to your profile as a video or audio post, or delete it.
 * Posting uses the normal upload path, so it is subject to the same size limit as any other upload.
 */
export function RecordingRow({ r, title, onPosted }: { r: RecordingInfo; title: string; onPosted?: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [posting, setPosting] = useState(false);
  const handle = useRef<UploadHandle | null>(null);
  useEffect(() => () => handle.current?.cancel(), []);

  const save = async () => {
    const blob = await recordingBlob(r);
    if (blob) downloadBlob(blob, `${fileSlug(title)}-part${r.part}.${fileExtension(r.mime)}`);
  };

  const post = async () => {
    if (!user || posting) return;
    if (r.size > MAX_UPLOAD_BYTES) return toast(t('err_file_too_big', { n: MAX_UPLOAD_MB }), 'error');
    const blob = await recordingBlob(r);
    if (!blob) return toast(t('hl_unreadable'), 'error');
    const ext = fileExtension(r.mime);
    const type = r.video ? (ext === 'mp4' ? 'video/mp4' : 'video/webm') : (ext === 'mp4' || ext === 'm4a' ? 'audio/mp4' : 'audio/webm');
    const file = new File([blob], `session.${ext}`, { type });
    const path = publicFilePath(user.id, `${crypto.randomUUID()}.${ext}`);
    setPosting(true);
    try {
      setUpload({ sent: 0, total: file.size, failed: false });
      const h = startUpload({ bucket: 'media-public', path, file, onProgress: (sent, total) => setUpload((u) => (u ? { ...u, sent, total, failed: false } : u)) });
      handle.current = h;
      await h.done;
      const { error } = await supabase.from('posts').insert({
        author_id: user.id, kind: r.video ? 'video' : 'audio', title: t('rec_post_title', { title }).slice(0, 120), body: '',
        media_bucket: 'media-public', media_path: path, duration_seconds: Math.max(1, Math.round(r.durationMs / 1000)), download_price: 0,
      });
      if (error) throw error;
      toast(t('rec_posted_toast'));
      setUpload(null);
      onPosted?.();
    } catch (err) {
      const reason = (err as { reason?: UploadFailure }).reason;
      if (reason === 'cancelled') return setUpload(null);
      if (reason) setUpload({ sent: 0, total: file.size, failed: true, message: t(failureKey(reason)) });
      else {
        setUpload(null);
        toast(explain(err, t), 'error');
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <li className="space-y-2 rounded-xl border border-zinc-200 p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto">
          {t('rec_part', { n: r.part })} · {formatClock(r.durationMs / 1000)} · {formatBytes(r.size)}
          {!r.finished && <span className="ml-2 text-xs text-amber-700">{t('rec_recovered')}</span>}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={save}><Download className="h-3.5 w-3.5" aria-hidden="true" />{t('rec_download')}</button>
        {user && r.finished && (
          <button type="button" className="btn btn-accent btn-sm" disabled={posting} onClick={post}>
            {posting ? <Spinner /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}{t('rec_post')}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" aria-label={t('rec_delete')} onClick={() => window.confirm(t('rec_delete_confirm')) && deleteRecording(r)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
      </div>
      {r.size > MAX_UPLOAD_BYTES && <p className="text-xs text-amber-700">{t('rec_post_too_big', { n: MAX_UPLOAD_MB })}</p>}
      {upload && <UploadBar state={upload} onCancel={() => handle.current?.cancel()} onRetry={post} />}
    </li>
  );
}

/** The host's saved recordings of a Live session (the Battle page has its own panel with highlights). */
export function LiveRecordings({ recordingId, title }: { recordingId: string; title: string }) {
  const { t } = useI18n();
  const [list, setList] = useState<RecordingInfo[]>([]);
  const refresh = useCallback(async () => setList(await listRecordings(recordingId)), [recordingId]);
  useEffect(() => {
    void refresh();
    return onRecordingsChanged(() => void refresh());
  }, [refresh]);
  if (list.length === 0) return null;
  return (
    <section className="card space-y-3" aria-label={t('live_rec_title')}>
      <h2 className="flex items-center gap-2 font-semibold"><Download className="h-4 w-4" aria-hidden="true" />{t('live_rec_title')}</h2>
      <p className="text-xs text-zinc-500">{t('rec_saved_note')}</p>
      <ul className="space-y-2">{list.map((r) => <RecordingRow key={r.key} r={r} title={title} />)}</ul>
    </section>
  );
}
