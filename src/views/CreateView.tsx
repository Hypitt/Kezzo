import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { fileExt } from '../lib/format';
import { formatClock } from '../lib/battle';
import { isSafe } from '../lib/moderation';
import { MAX_VIDEO_SECONDS, compressImage, mediaDuration } from '../lib/media';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, startUpload, type UploadFailure, type UploadHandle } from '../lib/upload';
import { BATTLE_CATEGORIES, type BattleCategory, type PostKind } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { UploadBar, failureKey, type UploadState } from '../components/UploadBar';
import { Chip, PageHeader, Spinner } from '../components/ui';

type Mode = 'post' | 'battle' | 'status';
const ACCEPT: Record<Exclude<PostKind, 'text'>, string> = {
  photo: 'image/jpeg,image/png,image/webp,image/gif',
  audio: 'audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg',
  video: 'video/mp4,video/webm,video/quicktime',
};

export function CreateView({ initial }: { initial?: string }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(initial === 'battle' || initial === 'status' ? initial : 'post');
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t('nav_create')} />
      <div className="mb-5 flex gap-2">
        <Chip active={mode === 'post'} onClick={() => setMode('post')}>{t('create_post')}</Chip>
        <Chip active={mode === 'battle'} onClick={() => setMode('battle')}>{t('create_battle')}</Chip>
        <Chip active={mode === 'status'} onClick={() => setMode('status')}>{t('create_status')}</Chip>
      </div>
      <div className="card">{mode === 'post' ? <PostForm /> : mode === 'battle' ? <BattleForm /> : <StatusForm />}</div>
    </div>
  );
}

interface PostJob {
  bucket: 'media-public' | 'media-paid';
  path: string;
  file: File;
  duration: number | null;
  uploaded: boolean;
}

function PostForm() {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [kind, setKind] = useState<PostKind>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const job = useRef<PostJob | null>(null);
  const handle = useRef<UploadHandle | null>(null);

  // Stop an unfinished upload when the person leaves this form.
  useEffect(() => () => handle.current?.cancel(), []);

  /** Uploads (or resumes) the file, then saves the post. Safe to call again after a failure. */
  const run = async () => {
    if (!user) return;
    const j = job.current;
    setBusy(true);
    setError(null);
    try {
      if (j && !j.uploaded) {
        setUpload({ sent: 0, total: j.file.size, failed: false });
        const h = startUpload({
          bucket: j.bucket, path: j.path, file: j.file,
          onProgress: (sent, total) => setUpload((u) => (u ? { ...u, sent, total, failed: false } : u)),
        });
        handle.current = h;
        await h.done;
        j.uploaded = true;
      }
      const { error: insErr } = await supabase.from('posts').insert({
        author_id: user.id, kind, title: title.trim(), body: body.trim(),
        media_bucket: j?.bucket ?? null, media_path: j?.path ?? null, duration_seconds: j?.duration ?? null,
        download_price: kind === 'text' ? 0 : price,
      });
      if (insErr) throw new Error(t('error_generic'));
      job.current = null;
      setUpload(null);
      toast(t('post_published'));
      go('search');
    } catch (err) {
      const reason = (err as { reason?: UploadFailure }).reason;
      if (reason === 'cancelled') return;
      if (reason) setUpload({ sent: 0, total: j?.file.size ?? 0, failed: true, message: t(failureKey(reason)) });
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelUpload = () => {
    handle.current?.cancel();
    if (job.current?.uploaded === false) job.current = null;
    setUpload(null);
    setBusy(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth() || !user) return;
    setError(null);
    if (!title.trim()) return setError(t('err_title_required'));
    if (!isSafe(title) || !isSafe(body)) return setError(t('blocked_content'));

    if (kind === 'text') {
      job.current = null;
      return run();
    }
    if (!file) return setError(t('err_file_required'));
    if (file.size > MAX_UPLOAD_BYTES) return setError(t('err_file_too_big', { n: MAX_UPLOAD_MB }));
    setBusy(true);
    let duration: number | null = null;
    if (kind !== 'photo') {
      try {
        duration = Math.round(await mediaDuration(file, kind));
      } catch {
        setBusy(false);
        return setError(t('err_file_unreadable'));
      }
      if (kind === 'video' && duration > MAX_VIDEO_SECONDS) {
        setBusy(false);
        return setError(t('err_video_too_long', { min: MAX_VIDEO_SECONDS / 60 }));
      }
    }
    const ready = kind === 'photo' ? await compressImage(file) : file; // smaller photos upload much faster
    // The storage path is created once, so Retry continues the same upload instead of starting over.
    if (!job.current || job.current.file !== ready) {
      job.current = {
        bucket: price > 0 ? 'media-paid' : 'media-public',
        path: `${user.id}/${crypto.randomUUID()}.${fileExt(ready.name)}`,
        file: ready, duration, uploaded: false,
      };
    }
    return run();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">{t('post_type')}</span>
        <div className="flex flex-wrap gap-2">
          {(['text', 'photo', 'audio', 'video'] as PostKind[]).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => { if (busy) return; setKind(k); setFile(null); job.current = null; if (k === 'text') setPrice(0); }}>
              {t(`kind_${k}` as Key)}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pf-title">{t('title')}</label>
        <input id="pf-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="pf-body">{t('body')}</label>
        <textarea id="pf-body" className="input" rows={4} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
      </div>
      {kind !== 'text' && (
        <>
          <div>
            <label className="label" htmlFor="pf-file">{t('file')}</label>
            <input id="pf-file" type="file" accept={ACCEPT[kind]} disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); job.current = null; setUpload(null); }} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm" />
            <p className="mt-1 text-xs text-zinc-500">{kind === 'video' ? t('file_hint_video', { n: MAX_UPLOAD_MB, min: MAX_VIDEO_SECONDS / 60 }) : t('file_hint', { n: MAX_UPLOAD_MB })}</p>
          </div>
          <div>
            <label className="label" htmlFor="pf-price">{t('price_label')}</label>
            <input id="pf-price" type="number" min={0} max={100} className="input" value={price} disabled={busy} onChange={(e) => {
              const next = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              // Free and paid files live in different places, so switching between them means uploading again.
              if ((next > 0) !== (price > 0)) { job.current = null; setUpload(null); }
              setPrice(next);
            }} />
            <p className="mt-1 text-xs text-zinc-500">{t('price_hint')}</p>
          </div>
        </>
      )}
      {upload && <UploadBar state={upload} onCancel={cancelUpload} onRetry={() => void run()} />}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{busy && upload && !upload.failed ? t('uploading') : t('publish')}</button>
    </form>
  );
}

function BattleForm() {
  const { ensureAuth, refreshWallet } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BattleCategory>('roasting');
  const [theme, setTheme] = useState('');
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [topic, setTopic] = useState('');
  const [rounds, setRounds] = useState(3);
  const [max, setMax] = useState(2);
  const [fee, setFee] = useState(0);
  const [hostCompetes, setHostCompetes] = useState(true);
  const [customWeights, setCustomWeights] = useState(false);
  const [publicWeight, setPublicWeight] = useState(70);
  const [roundSeconds, setRoundSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    setError(null);
    if (![title, topic, theme].every(isSafe)) return setError(t('blocked_content'));
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc('create_battle', {
      p_title: title, p_category: category, p_custom_theme: category === 'custom' ? theme : null,
      p_mode: mode, p_topic: topic, p_rounds: rounds, p_max: max, p_fee: fee,
      p_host_competes: hostCompetes, p_public_weight: customWeights ? publicWeight : 100, p_round_seconds: roundSeconds,
    });
    setBusy(false);
    if (rpcErr || !data) return setError(explain(rpcErr, t));
    await refreshWallet();
    toast(t('battle_created'));
    go('battles', data as string);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="bf-title">{t('title')}</label>
        <input id="bf-title" className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="bf-cat">{t('category')}</label>
          <select id="bf-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as BattleCategory)}>
            {BATTLE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}` as Key)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bf-mode">{t('format')}</label>
          <select id="bf-mode" className="input" value={mode} onChange={(e) => setMode(e.target.value as 'video' | 'audio')}>
            <option value="video">{t('mode_video')}</option>
            <option value="audio">{t('mode_audio')}</option>
          </select>
        </div>
      </div>
      {category === 'custom' && (
        <div>
          <label className="label" htmlFor="bf-theme">{t('custom_theme')}</label>
          <input id="bf-theme" className="input" value={theme} maxLength={60} onChange={(e) => setTheme(e.target.value)} required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="bf-topic">{t('topic')}</label>
        <input id="bf-topic" className="input" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="bf-max">{t('contenders')}</label>
          <select id="bf-max" className="input" value={max} onChange={(e) => setMax(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bf-rounds">{t('rounds')}</label>
          <select id="bf-rounds" className="input" value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bf-fee">{t('entry_fee')}</label>
          <input id="bf-fee" type="number" min={0} max={100} className="input" value={fee} onChange={(e) => setFee(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">{t('your_role')}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={hostCompetes} onClick={() => setHostCompetes(true)}>{t('role_compete')}</Chip>
          <Chip active={!hostCompetes} onClick={() => setHostCompetes(false)}>{t('role_host_only')}</Chip>
        </div>
        <p className="text-xs text-zinc-500">{t(hostCompetes ? 'role_compete_hint' : 'role_host_only_hint')}</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="label">{t('voting_weights')}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={!customWeights} onClick={() => setCustomWeights(false)}>{t('weights_public_100')}</Chip>
          <Chip active={customWeights} onClick={() => setCustomWeights(true)}>{t('weights_custom')}</Chip>
        </div>
        {customWeights && (
          <div className="space-y-1">
            <input type="range" min={0} max={100} step={5} value={publicWeight} className="w-full" onChange={(e) => setPublicWeight(Number(e.target.value))} aria-label={t('voting_weights')} />
            <p className="text-sm font-medium">{t('weights_badge', { pub: publicWeight, jud: 100 - publicWeight })}</p>
          </div>
        )}
        <p className="text-xs text-zinc-500">{t('weights_hint')}</p>
      </fieldset>
      <div>
        <label className="label" htmlFor="bf-timer">{t('round_timer')}</label>
        <select id="bf-timer" className="input" value={roundSeconds} onChange={(e) => setRoundSeconds(Number(e.target.value))}>
          <option value={0}>{t('timer_off')}</option>
          {[30, 60, 90, 120, 180, 300, 600].map((n) => <option key={n} value={n}>{formatClock(n)}</option>)}
        </select>
        <p className="mt-1 text-xs text-zinc-500">{t('round_timer_hint')}</p>
      </div>
      <p className="text-xs text-zinc-500">{t('battle_rules')}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{t('launch_battle')}</button>
    </form>
  );
}

function StatusForm() {
  const { user, profile, updateProfile, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const handle = useRef<UploadHandle | null>(null);
  const active = (profile?.status_text || profile?.status_image_url) && profile?.status_expires_at && new Date(profile.status_expires_at) > new Date();

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  useEffect(() => () => handle.current?.cancel(), []);

  /** Best-effort removal of the previous status picture. */
  const dropOldImage = async () => {
    const old = profile?.status_image_url?.split('/object/public/media-public/')[1];
    if (old) await supabase.storage.from('media-public').remove([decodeURIComponent(old)]);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth() || !user) return;
    if (!isSafe(text)) return toast(t('blocked_content'), 'error');
    if (!text.trim() && !image) return;
    setBusy(true);
    try {
      let imageUrl: string | null = null;
      if (image) {
        const ready = await compressImage(image, 1600, 0.85);
        const path = `${user.id}/status-${crypto.randomUUID()}.${fileExt(ready.name)}`;
        setUpload({ sent: 0, total: ready.size, failed: false });
        const h = startUpload({ bucket: 'media-public', path, file: ready, onProgress: (sent, total) => setUpload((u) => (u ? { ...u, sent, total } : u)) });
        handle.current = h;
        await h.done;
        imageUrl = supabase.storage.from('media-public').getPublicUrl(path).data.publicUrl;
      }
      await updateProfile({
        status_text: text.trim() || null,
        status_image_url: imageUrl,
        status_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      await dropOldImage();
      toast(t('status_saved'));
      go('home');
    } catch (err) {
      const reason = (err as { reason?: UploadFailure }).reason;
      if (reason === 'cancelled') return;
      toast(reason ? t(failureKey(reason)) : t('error_generic'), 'error');
    } finally {
      setUpload(null);
      setBusy(false);
    }
  };

  const clear = async () => {
    try {
      await dropOldImage();
      await updateProfile({ status_text: null, status_image_url: null, status_expires_at: null });
      toast(t('status_cleared'));
    } catch {
      toast(t('error_generic'), 'error');
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {active && (
        <div className="space-y-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm">
          {profile?.status_image_url && <img src={profile.status_image_url} alt="" className="max-h-40 rounded-lg object-cover" />}
          {profile?.status_text && <p>{t('current_status')}: <strong>{profile.status_text}</strong></p>}
        </div>
      )}
      <div>
        <label className="label" htmlFor="sf-text">{t('status_text')}</label>
        <input id="sf-text" className="input" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} />
        <p className="mt-1 text-xs text-zinc-500">{t('status_hint')}</p>
      </div>
      <div>
        <label className="label" htmlFor="sf-image">{t('status_picture')}</label>
        <input id="sf-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm" />
        {preview && (
          <div className="mt-2 flex items-start gap-3">
            <img src={preview} alt={t('status_picture_preview')} className="max-h-40 rounded-lg object-cover" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImage(null)} disabled={busy}>{t('remove')}</button>
          </div>
        )}
      </div>
      {upload && <UploadBar state={upload} onCancel={() => { handle.current?.cancel(); setUpload(null); setBusy(false); }} onRetry={() => undefined} />}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={busy || (!text.trim() && !image)}>{busy && <Spinner />}{t('status_post')}</button>
        {active && <button type="button" className="btn btn-ghost" onClick={clear} disabled={busy}>{t('status_clear')}</button>}
      </div>
    </form>
  );
}
