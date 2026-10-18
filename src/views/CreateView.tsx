import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { fileExt } from '../lib/format';
import { isSafe } from '../lib/moderation';
import { mediaDuration } from '../lib/media';
import { BATTLE_CATEGORIES, type BattleCategory, type PostKind } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { Chip, PageHeader, Spinner } from '../components/ui';

type Mode = 'post' | 'battle' | 'status';
const MAX_BYTES = 50 * 1024 * 1024;
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth() || !user) return;
    setError(null);
    if (!title.trim()) return setError(t('err_title_required'));
    if (!isSafe(title) || !isSafe(body)) return setError(t('blocked_content'));

    let bucket: 'media-public' | 'media-paid' | null = null;
    let path: string | null = null;
    let duration: number | null = null;
    setBusy(true);
    try {
      if (kind !== 'text') {
        if (!file) throw new Error(t('err_file_required'));
        if (file.size > MAX_BYTES) throw new Error(t('err_file_too_big'));
        if (kind !== 'photo') {
          try {
            duration = Math.round(await mediaDuration(file, kind));
          } catch {
            throw new Error(t('err_file_unreadable'));
          }
          if (kind === 'video' && duration > 90) throw new Error(t('err_video_too_long'));
        }
        bucket = price > 0 ? 'media-paid' : 'media-public';
        path = `${user.id}/${crypto.randomUUID()}.${fileExt(file.name)}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(t('err_upload'));
      }
      const { error: insErr } = await supabase.from('posts').insert({
        author_id: user.id, kind, title: title.trim(), body: body.trim(),
        media_bucket: bucket, media_path: path, duration_seconds: duration, download_price: kind === 'text' ? 0 : price,
      });
      if (insErr) {
        if (bucket && path) await supabase.storage.from(bucket).remove([path]);
        throw new Error(t('error_generic'));
      }
      toast(t('post_published'));
      go('search');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">{t('post_type')}</span>
        <div className="flex flex-wrap gap-2">
          {(['text', 'photo', 'audio', 'video'] as PostKind[]).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => { setKind(k); setFile(null); if (k === 'text') setPrice(0); }}>
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
            <input id="pf-file" type="file" accept={ACCEPT[kind]} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm" />
            <p className="mt-1 text-xs text-zinc-500">{t(kind === 'video' ? 'file_hint_video' : 'file_hint')}</p>
          </div>
          <div>
            <label className="label" htmlFor="pf-price">{t('price_label')}</label>
            <input id="pf-price" type="number" min={0} max={100} className="input" value={price} onChange={(e) => setPrice(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
            <p className="mt-1 text-xs text-zinc-500">{t('price_hint')}</p>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{t('publish')}</button>
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
      <p className="text-xs text-zinc-500">{t('battle_rules')}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{t('launch_battle')}</button>
    </form>
  );
}

function StatusForm() {
  const { profile, updateProfile, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [text, setText] = useState('');
  const active = profile?.status_text && profile.status_expires_at && new Date(profile.status_expires_at) > new Date();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    if (!isSafe(text)) return toast(t('blocked_content'), 'error');
    try {
      await updateProfile({ status_text: text.trim(), status_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
      toast(t('status_saved'));
      go('home');
    } catch {
      toast(t('error_generic'), 'error');
    }
  };

  const clear = async () => {
    try {
      await updateProfile({ status_text: null, status_expires_at: null });
      toast(t('status_cleared'));
    } catch {
      toast(t('error_generic'), 'error');
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {active && <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm">{t('current_status')}: <strong>{profile?.status_text}</strong></p>}
      <div>
        <label className="label" htmlFor="sf-text">{t('status_text')}</label>
        <input id="sf-text" className="input" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} required />
        <p className="mt-1 text-xs text-zinc-500">{t('status_hint')}</p>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={!text.trim()}>{t('status_post')}</button>
        {active && <button type="button" className="btn btn-ghost" onClick={clear}>{t('status_clear')}</button>}
      </div>
    </form>
  );
}
