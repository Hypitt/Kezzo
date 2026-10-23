import { useEffect, useRef, useState } from 'react';
import { ContestBanner } from '../components/ContestBanner';
import { StatusViewer } from '../components/StatusViewer';
import { loadActiveStatuses, loadBattles, loadPosts, newSeed, type PersonRow } from '../lib/data';
import type { Battle, Post } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { BattleCard } from '../components/BattleCard';
import { PostCard } from '../components/PostCard';
import { Avatar, Empty, Loading } from '../components/ui';

export function HomeView() {
  const { user, profile, blocked } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const seed = useRef(newSeed());
  const [statuses, setStatuses] = useState<PersonRow[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<PersonRow | null>(null);

  useEffect(() => {
    let off = false;
    Promise.all([
      loadActiveStatuses(),
      loadBattles({ status: ['live'], limit: 4 }),
      loadPosts(user?.id ?? null, { limit: 6, excludeAuthors: blocked, shuffleSeed: seed.current }),
    ])
      .then(([s, b, p]) => {
        if (off) return;
        setStatuses(s.filter((x) => !blocked.includes(x.id)));
        setBattles(b);
        setPosts(p);
      })
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [user, blocked]);

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ContestBanner onOpen={() => go('contest')} />
      <section aria-label={t('statuses')}>
        <h2 className="mb-3 text-lg font-semibold">{t('statuses')}</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {profile && (
            <button type="button" className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs" onClick={() => go('create', 'status')}>
              <span className="rounded-full border-2 border-dashed border-zinc-300 p-0.5"><Avatar p={profile} size={52} /></span>
              <span className="w-full truncate text-center text-zinc-500">{t('set_status')}</span>
            </button>
          )}
          {statuses.map((p) => (
            <button key={p.id} type="button" className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs" onClick={() => setViewing(p)} title={p.status_text ?? ''}>
              <span className="rounded-full border-2 border-accent p-0.5">
                {p.status_image_url
                  ? <img src={p.status_image_url} alt="" className="h-[52px] w-[52px] rounded-full bg-zinc-100 object-cover" loading="lazy" />
                  : <Avatar p={p} size={52} />}
              </span>
              <span className="w-full truncate text-center">{p.display_name}</span>
            </button>
          ))}
          {!profile && statuses.length === 0 && <p className="text-sm text-zinc-500">{t('statuses_empty')}</p>}
        </div>
      </section>

      {battles.length > 0 && (
        <section aria-label={t('live_now')}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('live_now')}</h2>
            <button type="button" className="text-sm text-zinc-500 underline" onClick={() => go('battles')}>{t('see_all')}</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">{battles.map((b) => <BattleCard key={b.id} battle={b} />)}</div>
        </section>
      )}

      <section aria-label={t('latest_posts')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('latest_posts')}</h2>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => go('search')}>{t('see_all')}</button>
        </div>
        {posts.length === 0 ? (
          <Empty text={t('feed_empty')} />
        ) : (
          <div className="space-y-4">
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
      </section>
      {viewing && <StatusViewer person={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
