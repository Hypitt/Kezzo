import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { loadPosts } from '../lib/data';
import type { Post } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { PostCard } from '../components/PostCard';
import { Empty, Loading } from '../components/ui';

/** One post, opened from a shared link (#/post/<id>). */
export function PostView({ id }: { id?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let off = false;
    setState('loading');
    if (!id) { setState('missing'); return; }
    loadPosts(user?.id ?? null, { id, limit: 1 })
      .then((rows) => { if (off) return; setPost(rows[0] ?? null); setState(rows[0] ? 'ready' : 'missing'); })
      .catch(() => !off && setState('missing'));
    return () => { off = true; };
  }, [id, user?.id]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('search')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}
      </button>
      {state === 'loading' ? <Loading /> : state === 'missing' || !post ? <Empty text={t('post_not_found')} /> : (
        <PostCard post={post} onChange={setPost} onDelete={() => go('search')} />
      )}
    </div>
  );
}
