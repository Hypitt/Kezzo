import { useEffect, useState, type FormEvent } from 'react';
import { Download, Heart, Lock, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { timeAgo } from '../lib/format';
import { isSafe } from '../lib/moderation';
import { PUBLIC_PROFILE } from '../lib/data';
import { thumbPath } from '../lib/media';
import type { Post, PublicProfile } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { Avatar, Spinner } from './ui';
import { FeedVideo } from './FeedVideo';
import { PhotoCarousel } from './PhotoCarousel';
import { ContestBadge, useContestEntry } from './ContestBadge';
import { CaptionedAudio } from './CaptionedAudio';
import { TranslationNote } from './TranslationNote';
import { TR, useTranslated } from '../lib/translate';
import { transcribePost } from '../lib/transcribe';
import { ReportButton } from './ReportButton';
import { ShareButton } from './ShareButton';
import { publicUrl, removePublic } from '../lib/storage';

interface Props {
  post: Post;
  onChange: (post: Post) => void;
  onDelete: (id: string) => void;
}

interface CommentRow { id: string; author_id: string; body: string; created_at: string; author?: PublicProfile }

export function PostCard({ post, onChange, onDelete }: Props) {
  const { user, ensureAuth, refreshWallet } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { go, route } = useRouter();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [extraUrls, setExtraUrls] = useState<string[]>([]);
  const extraKey = (post.media_extra ?? []).join('|');
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const contestInfo = useContestEntry(post.id, post.kind === 'photo' || post.kind === 'video');
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const mine = user?.id === post.author_id;
  const locked = post.download_price > 0 && !post.unlocked && !mine;
  const tx = useTranslated([post.title, post.body ?? ''], !mine && !editing);

  // The author can add subtitles to an older free video or audio post that has none yet.
  const [capVersion, setCapVersion] = useState(0);
  const [needsSubs, setNeedsSubs] = useState(false);
  const [subsBusy, setSubsBusy] = useState(false);
  const canSubs = mine && (post.kind === 'video' || post.kind === 'audio') && post.download_price === 0 && post.media_bucket === 'media-public';
  useEffect(() => {
    if (!canSubs) return;
    let off = false;
    void supabase.from('post_transcripts').select('post_id', { head: true, count: 'exact' }).eq('post_id', post.id)
      .then(({ count }) => { if (!off) setNeedsSubs((count ?? 0) === 0); });
    return () => { off = true; };
  }, [canSubs, post.id, capVersion]);
  const addSubtitles = async () => {
    if (!mediaUrl || subsBusy) return;
    const w = TR[lang];
    setSubsBusy(true);
    toast(w.working);
    try {
      const blob = await (await fetch(mediaUrl)).blob();
      const r = await transcribePost(post.id, blob);
      toast(r === 'ok' ? w.subsDone : r === 'no_speech' ? w.noSpeech : w.subsFail, r === 'ok' ? 'info' : 'error');
      if (r === 'ok') setCapVersion((v) => v + 1);
    } catch { toast(w.subsFail, 'error'); }
    setSubsBusy(false);
  };

  useEffect(() => {
    let cancelled = false;
    setMediaUrl(null);
    setExtraUrls([]);
    if (!post.media_path || !post.media_bucket || locked) return;
    const extra = extraKey ? extraKey.split('|') : [];
    if (post.media_bucket === 'media-public') {
      setMediaUrl(publicUrl('media-public', post.media_path));
      setExtraUrls(extra.map((p) => publicUrl('media-public', p)));
    } else {
      supabase.storage.from('media-paid').createSignedUrls([post.media_path, ...extra], 3600).then(({ data }) => {
        if (cancelled || !data) return;
        const urls = data.map((d) => d.signedUrl ?? '');
        if (urls[0]) setMediaUrl(urls[0]);
        setExtraUrls(urls.slice(1).filter(Boolean));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [post.media_path, post.media_bucket, extraKey, locked]);

  // Picture/video that can be shared with the Kezzo watermark: free posts, or the author's own.
  const shareMedia = mediaUrl && !locked && (post.download_price === 0 || mine) && (post.kind === 'photo' || post.kind === 'video')
    ? { kind: post.kind, urls: post.kind === 'photo' ? [mediaUrl, ...extraUrls] : [mediaUrl] }
    : undefined;

  const toggleLike = async () => {
    if (!ensureAuth() || !user) return;
    const next = !post.liked;
    onChange({ ...post, liked: next, likes: post.likes + (next ? 1 : -1) });
    const { error } = next
      ? await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
      : await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: user.id });
    if (error) {
      onChange(post);
      toast(t('error_generic'), 'error');
    }
  };

  const unlock = async () => {
    if (!ensureAuth()) return;
    const { error } = await supabase.rpc('unlock_post', { p_post: post.id });
    if (error) return toast(explain(error, t), 'error');
    await refreshWallet();
    onChange({ ...post, unlocked: true });
    toast(t('unlocked_toast'));
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSafe(title) || !isSafe(body)) return toast(t('blocked_content'), 'error');
    const { error } = await supabase.from('posts').update({ title: title.trim(), body: body.trim() }).eq('id', post.id);
    if (error) return toast(t('error_generic'), 'error');
    onChange({ ...post, title: title.trim(), body: body.trim() });
    setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(t('confirm_delete'))) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) return toast(t('error_generic'), 'error');
    if (post.media_bucket && post.media_path) {
      const files = [post.media_path, ...(post.media_extra ?? []), ...(post.media_bucket === 'media-public' ? [thumbPath(post.media_path)] : [])];
      if (post.media_bucket === 'media-public') await removePublic('media-public', files);
      else await supabase.storage.from(post.media_bucket).remove(files);
    }
    onDelete(post.id);
  };

  return (
    <article className="card space-y-3">
      <header className="flex items-center justify-between gap-3">
        <button type="button" className="flex min-w-0 items-center gap-2.5 text-left" onClick={() => go('profile', post.author.id)}>
          <Avatar p={post.author} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{post.author.display_name}</span>
            <span className="block truncate text-xs text-zinc-500">@{post.author.handle} · {timeAgo(post.created_at, lang)}</span>
          </span>
        </button>
        {contestInfo && <ContestBadge info={contestInfo} link={route.tab !== 'contest'} />}
        {post.download_price > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {t('price_coins', { n: post.download_price })}
          </span>
        )}
      </header>

      {editing ? (
        <form onSubmit={saveEdit} className="space-y-2">
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required aria-label={t('title')} />
          <textarea className="input" rows={3} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} aria-label={t('body')} />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm">{t('save')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('cancel')}</button>
          </div>
        </form>
      ) : (
        <div>
          <h3 className="text-base font-semibold">{tx.out[0]}</h3>
          {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">{tx.out[1]}</p>}
          <TranslationNote tx={tx} />
        </div>
      )}

      {post.kind !== 'text' && (
        <div>
          {locked ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-zinc-100 px-4 py-8 text-center">
              <Lock className="h-6 w-6 text-zinc-500" aria-hidden="true" />
              <p className="text-sm text-zinc-600">{t('locked_media')}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={unlock}>
                {t('unlock_for', { n: post.download_price })}
              </button>
            </div>
          ) : mediaUrl ? (
            <>
              {post.kind === 'photo' && <PhotoCarousel urls={[mediaUrl, ...extraUrls]} alt={post.title} />}
              {post.kind === 'video' && <FeedVideo src={mediaUrl} postId={post.download_price === 0 ? post.id : undefined} version={capVersion} />}
              {post.kind === 'audio' && (post.download_price === 0 ? <CaptionedAudio src={mediaUrl} postId={post.id} version={capVersion} /> : <audio src={mediaUrl} controls preload="none" className="w-full" />)}
              {needsSubs && <button type="button" className="btn btn-ghost btn-sm mt-2" disabled={subsBusy} onClick={() => void addSubtitles()}>{subsBusy ? TR[lang].working : TR[lang].addSubs}</button>}
              <a className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 underline" href={mediaUrl} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t('open_file')}
              </a>
            </>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl bg-zinc-100"><Spinner /></div>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <button type="button" className={`btn btn-ghost btn-sm ${post.liked ? 'border-accent text-accent' : ''}`} onClick={toggleLike} aria-pressed={post.liked}>
          <Heart className={`h-3.5 w-3.5 ${post.liked ? 'fill-current' : ''}`} aria-hidden="true" />
          {post.likes}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {post.comments}
        </button>
        <ShareButton type="post" id={post.id} title={post.title} media={shareMedia} />
        <span className="flex-1" />
        {mine ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('edit')}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('delete')}</button>
          </>
        ) : (
          <ReportButton targetType="post" targetId={post.id} />
        )}
      </footer>

      {showComments && <Comments post={post} onCount={(n) => onChange({ ...post, comments: n })} />}
    </article>
  );
}

function Comments({ post, onCount }: { post: Post; onCount: (n: number) => void }) {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [text, setText] = useState('');
  const ctx = useTranslated((rows ?? []).map((c) => c.body), true);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase.from('post_comments').select('id,author_id,body,created_at').eq('post_id', post.id).order('created_at').limit(100);
      const list = (data ?? []) as CommentRow[];
      const ids = [...new Set(list.map((c) => c.author_id))];
      const { data: people } = ids.length ? await supabase.from('profiles').select(PUBLIC_PROFILE).in('id', ids) : { data: [] };
      const map = new Map((people as PublicProfile[] | null)?.map((p) => [p.id, p]));
      if (!off) setRows(list.map((c) => ({ ...c, author: map.get(c.author_id) })));
    })();
    return () => {
      off = true;
    };
  }, [post.id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !ensureAuth() || !user) return;
    if (!isSafe(body)) return toast(t('blocked_content'), 'error');
    const { data, error } = await supabase.from('post_comments').insert({ post_id: post.id, author_id: user.id, body }).select('id,author_id,body,created_at').single();
    if (error || !data) return toast(t('error_generic'), 'error');
    const { data: me } = await supabase.from('profiles').select(PUBLIC_PROFILE).eq('id', user.id).single();
    setRows((r) => [...(r ?? []), { ...(data as CommentRow), author: me as PublicProfile }]);
    onCount(post.comments + 1);
    setText('');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('post_comments').delete().eq('id', id);
    if (error) return toast(t('error_generic'), 'error');
    setRows((r) => (r ?? []).filter((c) => c.id !== id));
    onCount(Math.max(0, post.comments - 1));
  };

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-3">
      {rows === null ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-zinc-500">{t('no_comments')}</p> : (
        <ul className="space-y-2">
          {rows.map((c, i) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              {c.author && <Avatar p={c.author} size={24} />}
              <p className="min-w-0 flex-1 break-words">
                <span className="font-semibold">{c.author?.display_name ?? '…'}</span> {ctx.out[i] ?? c.body}
              </p>
              {(c.author_id === user?.id || post.author_id === user?.id) && (
                <button type="button" className="text-zinc-400 hover:text-red-600" onClick={() => remove(c.id)} aria-label={t('delete')}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows !== null && rows.length > 0 && <TranslationNote tx={ctx} />}
      <form onSubmit={send} className="flex gap-2">
        <input className="input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={t('add_comment')} aria-label={t('add_comment')} />
        <button className="btn btn-primary" disabled={!text.trim()}>{t('send')}</button>
      </form>
    </div>
  );
}
