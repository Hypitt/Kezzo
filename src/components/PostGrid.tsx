import { useEffect, useState } from 'react';
import { AutoVideo } from './AutoVideo';
import { Images, Lock, Music, Play, Type, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { thumbPath } from '../lib/media';
import type { Post } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { PostCard } from './PostCard';
import { publicUrl } from '../lib/storage';

/** Profile posts, three tiles per row. Pressing a tile opens the full post (with its swipeable photos) in a window. */
export function PostGrid({ posts, onChange, onDelete }: { posts: Post[]; onChange: (p: Post) => void; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = posts.find((p) => p.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpenId(null);
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [openId]);

  return (
    <>
      <ul className="grid grid-cols-3 gap-1 sm:gap-2">
        {posts.map((p) => (
          <li key={p.id}>
            <Tile post={p} onOpen={() => setOpenId(p.id)} label={`${t('open_post')}: ${p.title}`} />
          </li>
        ))}
      </ul>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpenId(null)}>
          <div className="relative my-auto w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="absolute -top-2 right-0 z-10 flex h-8 w-8 -translate-y-full items-center justify-center rounded-full bg-white text-zinc-900 shadow" onClick={() => setOpenId(null)} aria-label={t('close')}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <PostCard
              post={open}
              onChange={onChange}
              onDelete={(id) => { setOpenId(null); onDelete(id); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ post, onOpen, label }: { post: Post; onOpen: () => void; label: string }) {
  const { user } = useAuth();
  const locked = post.download_price > 0 && !post.unlocked && user?.id !== post.author_id;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setSrc(null);
    if (locked || !post.media_path || !post.media_bucket || (post.kind !== 'photo' && post.kind !== 'video')) return;
    if (post.kind === 'video') return; // the tile is a plain dark square: no video bytes are downloaded for a grid
    if (post.media_bucket === 'media-public') setSrc(publicUrl('media-public', thumbPath(post.media_path)));
    else supabase.storage.from('media-paid').createSignedUrl(post.media_path, 3600).then(({ data }) => !off && data && setSrc(data.signedUrl));
    return () => {
      off = true;
    };
  }, [post.media_path, post.media_bucket, post.kind, locked]);

  const extra = post.media_extra?.length ?? 0;
  const videoFrame = post.kind === 'video' && !locked && post.media_bucket === 'media-public' && post.media_path
    ? publicUrl('media-public', post.media_path) : null;
  return (
    <button type="button" onClick={onOpen} aria-label={label} className="relative block aspect-square w-full overflow-hidden rounded-md bg-zinc-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      {locked ? (
        <span className="flex h-full w-full items-center justify-center text-zinc-500"><Lock className="h-6 w-6" aria-hidden="true" /></span>
      ) : post.kind === 'photo' && src ? (
        <img
          src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async"
          onError={() => { // older posts have no preview: use the full photo
            if (post.media_bucket === 'media-public' && post.media_path && src.includes('-t.jpg')) setSrc(publicUrl('media-public', post.media_path));
          }}
        />
      ) : post.kind === 'video' ? (
        <span className="relative flex h-full w-full items-center justify-center bg-zinc-800 text-white">
          {/* Videos play by themselves (muted) while on screen */}
          {videoFrame
            ? <AutoVideo src={videoFrame} label={post.title} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
            : <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/45"><Play className="h-5 w-5 fill-white" aria-hidden="true" /></span>}
        </span>
      ) : post.kind === 'audio' ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-zinc-500"><Music className="h-6 w-6" aria-hidden="true" /><span className="line-clamp-2 text-center text-[11px]">{post.title}</span></span>
      ) : post.kind === 'text' ? (
        <span className="flex h-full w-full flex-col gap-1 p-2 text-zinc-600"><Type className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="line-clamp-4 text-xs font-medium">{post.title}</span></span>
      ) : null}
      {extra > 0 && !locked && <Images className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
    </button>
  );
}
