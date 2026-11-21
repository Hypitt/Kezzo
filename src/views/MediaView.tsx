import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPosts, newSeed } from '../lib/data';
import type { Post, PostKind } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { PostCard } from '../components/PostCard';
import { Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

const PAGE = 8;
type KindFilter = 'all' | 'photo' | 'audio' | 'video';

export function MediaView() {
  const { user, blocked } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [kind, setKind] = useState<KindFilter>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);
  const seed = useRef(newSeed());

  const fetchPage = useCallback(
    (offset: number) =>
      loadPosts(user?.id ?? null, {
        from: offset,
        limit: PAGE,
        shuffleSeed: seed.current,
        excludeAuthors: blocked,
        kinds: kind === 'all' ? (['photo', 'audio', 'video'] as PostKind[]) : [kind],
      }),
    [user, blocked, kind],
  );

  useEffect(() => {
    const mine = ++request.current;
    setLoading(true);
    fetchPage(0)
      .then((rows) => {
        if (mine !== request.current) return;
        setPosts(rows);
        setHasMore(rows.length === PAGE);
      })
      .catch(() => mine === request.current && toast(t('error_generic'), 'error'))
      .finally(() => mine === request.current && setLoading(false));
  }, [fetchPage, toast, t]);

  const more = async () => {
    setBusy(true);
    try {
      const rows = await fetchPage(posts.length);
      setPosts((p) => [...p, ...rows]);
      setHasMore(rows.length === PAGE);
    } catch {
      toast(t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('nav_media')} sub={t('media_sub')} />
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {(['all', 'photo', 'audio', 'video'] as KindFilter[]).map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{t(`kind_${k}` as const)}</Chip>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : posts.length === 0 ? (
        <Empty text={t('media_empty')}>
          <button type="button" className="btn btn-primary" onClick={() => go('create', 'post')}>{t('create_post')}</button>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onChange={(next) => setPosts((l) => l.map((x) => (x.id === next.id ? next : x)))}
              onDelete={(id) => setPosts((l) => l.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
      <LoadMore show={!loading && hasMore} busy={busy} onClick={more} label={t('load_more')} />
    </div>
  );
}
