import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Film, Scissors, Sparkles, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { explain } from '../../lib/errors';
import { formatClock } from '../../lib/battle';
import { formatBytes } from '../../lib/media';
import {
  HIGHLIGHT_SECONDS, clipSupported, deleteRecording, downloadBlob, fileExtension, listRecordings, makeClip, onRecordingsChanged,
  openForClip, recordingBlob, suggestStart, type RecordingInfo,
} from '../../lib/recorder';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, startUpload, type UploadFailure, type UploadHandle } from '../../lib/upload';
import type { Battle } from '../../lib/types';
import { useAuth } from '../../state/Auth';
import { useI18n } from '../../state/I18n';
import { useToast } from '../../state/Toast';
import { FeedVideo } from '../FeedVideo';
import { UploadBar, failureKey, type UploadState } from '../UploadBar';
import { Spinner } from '../ui';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'battle';
/** Files already saved to the device in this browser session (so the automatic download never runs twice). */
const downloaded = new Set<string>();

// --------------------------------------------------------------------------------------------- public highlight

/** The highlight clip posted by the host, shown to everyone on an ended battle. */
export function HighlightCard({ battle, canRemove, onRemoved }: { battle: Battle; canRemove: boolean; onRemoved: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const postId = battle.highlight_post_id;

  useEffect(() => {
    setSrc(null);
    if (!postId) return;
    let off = false;
    supabase.from('posts').select('media_path').eq('id', postId).maybeSingle().then(({ data }) => {
      if (!off && data?.media_path) setSrc(supabase.storage.from('media-public').getPublicUrl(data.media_path as string).data.publicUrl);
    });
    return () => { off = true; };
  }, [postId]);

  if (!postId || !src) return null;
  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('set_battle_highlight', { p_battle: battle.id, p_post: null });
    setBusy(false);
    if (error) return toast(explain(error, t), 'error');
    onRemoved();
  };
  return (
    <section className="card space-y-3" aria-label={t('hl_card_title')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Film className="h-4 w-4 text-accent" aria-hidden="true" />{t('hl_card_title')}</h2>
        {canRemove && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={remove}>{t('hl_remove')}</button>}
      </div>
      <FeedVideo src={src} />
    </section>
  );
}

// --------------------------------------------------------------------------------------------- host: recording + highlight

/** Host-only panel on an ended battle: download the recording, then post a highlight of up to 90 seconds. */
export function RecordingPanel({ battle, autoDownload, onChanged }: { battle: Battle; autoDownload: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  const [list, setList] = useState<RecordingInfo[]>([]);

  const refresh = useCallback(async () => {
    const rows = await listRecordings(battle.id);
    setList(rows);
    if (autoDownload) {
      for (const r of rows) {
        if (!r.finished || downloaded.has(r.key)) continue;
        downloaded.add(r.key);
        const blob = await recordingBlob(r);
        if (blob) downloadBlob(blob, `${slug(battle.title)}-part${r.part}.${fileExtension(r.mime)}`);
      }
    }
  }, [battle.id, battle.title, autoDownload]);

  useEffect(() => {
    void refresh();
    return onRecordingsChanged(() => void refresh());
  }, [refresh]);

  const save = async (r: RecordingInfo) => {
    const blob = await recordingBlob(r);
    if (blob) downloadBlob(blob, `${slug(battle.title)}-part${r.part}.${fileExtension(r.mime)}`);
  };

  return (
    <div className="space-y-5">
      {list.length > 0 && (
        <section className="card space-y-3" aria-label={t('rec_title')}>
          <h2 className="flex items-center gap-2 font-semibold"><Download className="h-4 w-4" aria-hidden="true" />{t('rec_title')}</h2>
          <p className="text-xs text-zinc-500">{t('rec_saved_note')}</p>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-sm">
                <span className="mr-auto">
                  {t('rec_part', { n: r.part })} · {formatClock(r.durationMs / 1000)} · {formatBytes(r.size)}
                  {!r.finished && <span className="ml-2 text-xs text-amber-700">{t('rec_recovered')}</span>}
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => save(r)}><Download className="h-3.5 w-3.5" aria-hidden="true" />{t('rec_download')}</button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={t('rec_delete')} onClick={() => window.confirm(t('rec_delete_confirm')) && deleteRecording(r)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <HighlightSection battle={battle} recordings={list} onPosted={onChanged} />
    </div>
  );
}

interface Source {
  blob: Blob;
  url: string;
  seconds: number;
  label: string;
  /** Wall-clock start of the video, when known (lets us line votes and chat up with it). */
  startedAt?: number;
}

function HighlightSection({ battle, recordings, onPosted }: { battle: Battle; recordings: RecordingInfo[]; onPosted: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [source, setSource] = useState<Source | null>(null);
  const [start, setStart] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [making, setMaking] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const cancel = useRef({ cancelled: false });
  const handle = useRef<UploadHandle | null>(null);
  const preview = useRef<HTMLVideoElement>(null);

  // Free the video memory when leaving.
  useEffect(() => () => {
    cancel.current.cancelled = true;
    handle.current?.cancel();
  }, []);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const reset = () => { setSource(null); setClip(null); setStart(0); setError(null); setUpload(null); };

  const load = async (blob: Blob, label: string, startedAt?: number, knownSeconds?: number) => {
    reset();
    setLoading(true);
    try {
      const { url, seconds } = await openForClip(blob);
      setSource({ blob, url, seconds: knownSeconds ?? seconds, label, startedAt });
    } catch {
      setError(t('hl_unreadable'));
    } finally {
      setLoading(false);
    }
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) return setError(t('hl_not_video'));
    void load(file, file.name);
  };
  const useRecording = async (r: RecordingInfo) => {
    const blob = await recordingBlob(r);
    if (!blob) return setError(t('hl_unreadable'));
    void load(blob, t('rec_part', { n: r.part }), r.startedAt, r.durationMs / 1000);
  };

  const tooLong = Boolean(source && source.seconds > HIGHLIGHT_SECONDS + 0.5);
  const length = source ? Math.min(HIGHLIGHT_SECONDS, source.seconds - start) : 0;

  // Show the chosen moment in the preview player.
  useEffect(() => {
    const v = preview.current;
    if (v && tooLong && !clip) v.currentTime = start;
  }, [start, tooLong, clip, source]);

  const suggest = async () => {
    if (!source?.startedAt) return;
    const origin = source.startedAt;
    const [votes, chat, scores] = await Promise.all([
      supabase.from('battle_votes').select('created_at,amount').eq('battle_id', battle.id).limit(3000),
      supabase.from('chat_messages').select('created_at').eq('room_type', 'battle').eq('room_id', battle.id).limit(3000),
      supabase.from('judge_scores').select('updated_at').eq('battle_id', battle.id).limit(500),
    ]);
    const sec = (iso: string) => (Date.parse(iso) - origin) / 1000;
    const events = [
      ...(votes.data ?? []).map((v) => ({ t: sec(v.created_at as string), w: Number(v.amount) })),
      ...(chat.data ?? []).map((c) => ({ t: sec(c.created_at as string), w: 1 })),
      ...(scores.data ?? []).map((s) => ({ t: sec(s.updated_at as string), w: 3 })),
    ];
    const at = Math.floor(suggestStart(events, source.seconds));
    setStart(Math.min(at, Math.max(0, Math.floor(source.seconds - HIGHLIGHT_SECONDS))));
    toast(t('hl_suggested'));
  };

  const create = async () => {
    if (!source) return;
    cancel.current = { cancelled: false };
    setMaking(0);
    setError(null);
    try {
      const blob = await makeClip(source.blob, start, length, setMaking, cancel.current);
      setClip({ blob, url: URL.createObjectURL(blob), seconds: length });
    } catch (err) {
      if ((err as Error).message !== 'cancelled') setError(t('hl_clip_failed'));
    } finally {
      setMaking(null);
    }
  };

  const post = async (blob: Blob, seconds: number) => {
    if (!user) return;
    if (blob.size > MAX_UPLOAD_BYTES) return setError(t('err_file_too_big', { n: MAX_UPLOAD_LABEL }));
    const ext = fileExtension(blob.type || 'video/webm');
    const file = new File([blob], `highlight.${ext}`, { type: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    setPosting(true);
    setError(null);
    try {
      setUpload({ sent: 0, total: file.size, failed: false });
      const h = startUpload({ bucket: 'media-public', path, file, onProgress: (sent, total) => setUpload((u) => (u ? { ...u, sent, total, failed: false } : u)) });
      handle.current = h;
      await h.done;
      const { data, error: insErr } = await supabase.from('posts').insert({
        author_id: user.id, kind: 'video', title: `${t('hl_card_title')}: ${battle.title}`.slice(0, 120), body: '',
        media_bucket: 'media-public', media_path: path, duration_seconds: Math.min(HIGHLIGHT_SECONDS, Math.max(1, Math.round(seconds))), download_price: 0,
      }).select('id').single();
      if (insErr || !data) throw new Error(t('error_generic'));
      const { error: rpcErr } = await supabase.rpc('set_battle_highlight', { p_battle: battle.id, p_post: data.id });
      if (rpcErr) throw rpcErr;
      toast(t('hl_posted_toast'));
      setUpload(null);
      reset();
      onPosted();
    } catch (err) {
      const reason = (err as { reason?: UploadFailure }).reason;
      if (reason === 'cancelled') return;
      if (reason) setUpload({ sent: 0, total: file.size, failed: true, message: t(failureKey(reason)) });
      else setError(explain(err, t));
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="card space-y-4" aria-label={t('hl_title')}>
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Film className="h-4 w-4 text-accent" aria-hidden="true" />{t('hl_title')}</h2>
        <p className="mt-1 text-xs text-zinc-500">{t('hl_sub', { n: HIGHLIGHT_SECONDS })}</p>
      </div>

      {!source && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-primary cursor-pointer">
            <Upload className="h-4 w-4" aria-hidden="true" />{t('hl_upload')}
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {recordings.map((r) => (
            <button key={r.key} type="button" className="btn btn-ghost" disabled={loading} onClick={() => useRecording(r)}>
              <Film className="h-4 w-4" aria-hidden="true" />{t('hl_use_recording', { n: r.part })}
            </button>
          ))}
          {loading && <Spinner />}
        </div>
      )}

      {source && (
        <div className="space-y-3">
          <p className="text-sm"><span className="font-medium">{source.label}</span> · {formatClock(source.seconds)}</p>
          {!clip && <video ref={preview} src={source.url} controls playsInline className="max-h-80 w-full rounded-xl bg-black" />}
          {clip && <video src={clip.url} controls playsInline className="max-h-80 w-full rounded-xl bg-black" />}

          {tooLong && !clip && (
            <div className="space-y-3 rounded-xl bg-zinc-50 p-3">
              <p className="text-sm text-zinc-700">{t('hl_too_long', { n: Math.round(source.seconds), max: HIGHLIGHT_SECONDS })}</p>
              {!clipSupported() ? (
                <p className="text-xs text-amber-700">{t('hl_trim_unsupported')}</p>
              ) : (
                <>
                  <label className="label" htmlFor="hl-start">{t('hl_start', { from: formatClock(start), to: formatClock(start + length) })}</label>
                  <input id="hl-start" type="range" min={0} max={Math.max(0, Math.floor(source.seconds - HIGHLIGHT_SECONDS))} step={1} value={start} className="w-full" disabled={making !== null} onChange={(e) => setStart(Number(e.target.value))} />
                  <div className="flex flex-wrap gap-2">
                    {source.startedAt && <button type="button" className="btn btn-ghost btn-sm" disabled={making !== null} onClick={suggest}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('hl_suggest')}</button>}
                    <button type="button" className="btn btn-accent btn-sm" disabled={making !== null} onClick={create}><Scissors className="h-3.5 w-3.5" aria-hidden="true" />{t('hl_make_clip', { n: HIGHLIGHT_SECONDS })}</button>
                    {making !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancel.current.cancelled = true; }}>{t('cancel')}</button>}
                  </div>
                  {making !== null && (
                    <div className="space-y-1" aria-live="polite">
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(making * 100)}%` }} /></div>
                      <p className="text-xs text-zinc-500">{t('hl_making', { pct: Math.round(making * 100) })}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {upload && <UploadBar state={upload} onCancel={() => { handle.current?.cancel(); setUpload(null); setPosting(false); }} onRetry={() => post(clip?.blob ?? source.blob, clip?.seconds ?? source.seconds)} />}

          <div className="flex flex-wrap gap-2">
            {(clip || !tooLong) && (
              <button type="button" className="btn btn-accent" disabled={posting} onClick={() => post(clip?.blob ?? source.blob, clip?.seconds ?? source.seconds)}>
                {posting && <Spinner />}{t('hl_post')}
              </button>
            )}
            {clip && <button type="button" className="btn btn-ghost" disabled={posting} onClick={() => setClip(null)}>{t('hl_edit_clip')}</button>}
            <button type="button" className="btn btn-ghost" disabled={posting || making !== null} onClick={reset}>{t('hl_choose_other')}</button>
          </div>
          {source.blob.size > 0 && <p className="text-xs text-zinc-500">{formatBytes((clip ?? source).blob.size)}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
