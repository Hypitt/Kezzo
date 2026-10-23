import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { thumbPath } from '../lib/media';
import { isR2Path, publicUrl } from '../lib/storage';
import { useAuth } from '../state/Auth';

interface Item {
  id: string; kind: 'photo' | 'video'; title: string; media_path: string;
  author_name: string; author_avatar: string | null; likes: number; comments: number;
}

export interface MediaWords { kicker: string; title: string; note: string; cta: string; like: string; comments: string }

const VISITOR_KEY = 'kezzo_guest';
const LIKED_KEY = 'kezzo_guest_liked';

/** A random id for this browser (no personal data). It lets a visitor's likes be remembered and, after sign-up, turned into real likes. */
export function guestId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
const readLiked = (): string[] => {
  try { return JSON.parse(localStorage.getItem(LIKED_KEY) ?? '[]') as string[]; } catch { return []; }
};
const writeLiked = (ids: string[]) => {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
};
/** Called after sign-in: the likes given as a visitor become the account's likes. */
export async function claimGuestLikes(): Promise<void> {
  try {
    if (!readLiked().length) return;
    await supabase.rpc('claim_guest_likes', { p_visitor: guestId() });
    writeLiked([]);
  } catch { /* try again next time */ }
}

function Tile({ item, liked, onLike, onComment, words }: { item: Item; liked: boolean; onLike: () => void; onComment: () => void; words: MediaWords }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(() => publicUrl('media-public', item.kind === 'photo' ? thumbPath(item.media_path) : item.media_path));
  const full = publicUrl('media-public', item.media_path);
  const playable = item.kind === 'video' && isR2Path(item.media_path); // R2 has no download fees; other videos stay a still tile

  // A video preview plays (muted, looping) only while mostly on screen.
  useEffect(() => {
    const el = box.current;
    const v = video.current;
    if (!el || !v || !playable) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => undefined); else v.pause();
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); v.pause(); };
  }, [playable]);

  return (
    <div ref={box} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-zinc-200">
      {item.kind === 'photo' ? (
        <img src={src} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover"
          onError={() => { if (src !== full) setSrc(full); }} />
      ) : playable ? (
        <video ref={video} src={`${full}#t=0.1`} muted loop playsInline preload="metadata" aria-label={item.title} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-white"><Play className="h-8 w-8 fill-white" aria-hidden="true" /></span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-8 text-white">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.author_name}</span>
        <button type="button" onClick={onLike} aria-pressed={liked} aria-label={`${words.like}: ${item.title}`}
          className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-xs hover:bg-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-accent text-accent' : ''}`} aria-hidden="true" />{item.likes}
        </button>
        {item.comments > 0 && (
          <button type="button" onClick={onComment} aria-label={`${words.comments}: ${item.title}`}
            className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-xs hover:bg-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{item.comments}
          </button>
        )}
      </div>
    </div>
  );
}

/** Photos and videos from the community, in random order, shown to visitors before they sign in. Liking works for everyone; comments need an account. */
export function LandingMedia({ words }: { words: MediaWords }) {
  const { openAuth } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [liked, setLiked] = useState<string[]>(readLiked);

  useEffect(() => {
    let off = false;
    void (async () => {
      const { data } = await supabase.rpc('landing_media', { p_limit: 12 });
      if (!off && Array.isArray(data)) setItems(data as Item[]);
    })();
    return () => { off = true; };
  }, []);

  const like = async (item: Item) => {
    const now = !liked.includes(item.id);
    const next = now ? [...liked, item.id] : liked.filter((x) => x !== item.id);
    setLiked(next);
    writeLiked(next);
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, likes: Math.max(0, i.likes + (now ? 1 : -1)) } : i)));
    const { data, error } = await supabase.rpc('guest_like', { p_post: item.id, p_visitor: guestId(), p_like: now });
    if (error) { // could not save: undo
      setLiked(liked);
      writeLiked(liked);
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, likes: Math.max(0, i.likes + (now ? -1 : 1)) } : i)));
    } else if (typeof data === 'number') {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, likes: data } : i)));
    }
  };

  if (!items.length) return null;
  return (
    <section className="bg-white px-4 py-8 text-zinc-900 sm:py-10" aria-label={words.title}>
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">{words.kicker}</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{words.title}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Tile key={item.id} item={item} liked={liked.includes(item.id)} words={words}
              onLike={() => void like(item)} onComment={() => openAuth('signin')} />
          ))}
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-600">
          {words.note}
          <button type="button" className="btn btn-sm border border-zinc-300 bg-white text-zinc-900 hover:bg-stone-100" onClick={() => openAuth('signin')}>{words.cta}</button>
        </p>
      </div>
    </section>
  );
}
