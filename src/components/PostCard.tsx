import { useEffect, useState, type FormEvent } from 'react';
import { Download, Heart, Lock, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { timeAgo } from '../lib/format';
import { isSafe } from '../lib/moderation';
import { PUBLIC_PROFILE } from '../lib/data';
import type { Post, PublicProfile } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { Avatar, Spinner } from './ui';
import { FeedVideo } from './FeedVideo';
import { ReportButton } from './ReportButton';

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
  const { go } = useRouter();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const mine = user?.id === post.author_id;
  const locked = post.download_price > 0 && !post.unlocked && !mine;

  useEffect(() => {
    let cancelled = false;
    setMediaUrl(null);
    if (!post.media_path || !post.media_bucket || locked) return;
    if (post.media_bucket === 'media-public') {
      setMediaUrl(supabase.storage.from('media-public').getPublicUrl(post.media_path).data.publicUrl);
    } else {
      supabase.storage.from('media-paid').createSignedUrl(post.media_path, 3600).then(({ data }) => {
        if (!cancelled && data) setMediaUrl(data.signedUrl);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [post.media_path, post.media_bucket, locked]);

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

  // Always start editing from what the post says now (it may have changed since the card first appeared).
  const startEdit = () => {
    setTitle(post.title);
    setBody(post.body);
    setEditing(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle) return toast(t('err_title_required'), 'error');
    if (!isSafe(nextTitle) || !isSafe(nextBody)) return toast(t('blocked_content'), 'error');
    setSaving(true);
    // Ask for the saved row back: if the database refused the change silently, nothing comes back.
    const { data, error } = await supabase.from('posts').update({ title: nextTitle, body: nextBody }).eq('id', post.id).select('id');
    setSaving(false);
    if (error) return toast(explain(error, t), 'error');
    if (!data?.length) return toast(t('err_not_saved'), 'error');
    onChange({ ...post, title: nextTitle, body: nextBody });
    setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(t('confirm_delete'))) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) return toast(t('error_generic'), 'error');
    if (post.media_bucket && post.media_path) await supabase.storage.from(post.media_bucket).remove([post.media_path]);
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
            <button className="btn btn-primary btn-sm" disabled={saving}>{saving && <Spinner />}{t('save')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('cancel')}</button>
          </div>
        </form>
      ) : (
        <div>
          <h3 className="text-base font-semibold">{post.title}</h3>
          {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">{post.body}</p>}
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
              {post.kind === 'photo' && <img src={mediaUrl} alt={post.title} className="max-h-[32rem] w-full rounded-xl bg-zinc-100 object-contain" loading="lazy" decoding="async" />}
              {post.kind === 'video' && <FeedVideo src={mediaUrl} />}
              {post.kind === 'audio' && <audio src={mediaUrl} controls preload="none" className="w-full" />}
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
        <span className="flex-1" />
        {mine ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startEdit} disabled={editing}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('edit')}</button>
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
          {rows.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              {c.author && <Avatar p={c.author} size={24} />}
              <p className="min-w-0 flex-1 break-words">
                <span className="font-semibold">{c.author?.display_name ?? '…'}</span> {c.body}
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
      <form onSubmit={send} className="flex gap-2">
        <input className="input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={t('add_comment')} aria-label={t('add_comment')} />
        <button className="btn btn-primary" disabled={!text.trim()}>{t('send')}</button>
      </form>
    </div>
  );
}
