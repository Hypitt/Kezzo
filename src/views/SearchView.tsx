import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { loadBattles, loadPeople, loadPosts, type PersonRow } from '../lib/data';
import { supabase } from '../lib/supabase';
import { isActiveStatus } from '../lib/format';
import type { Battle, Post } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { BattleCard } from '../components/BattleCard';
import { PostCard } from '../components/PostCard';
import { Avatar, Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

type Tab = 'feed' | 'battles' | 'people';
const PAGE = 12;

/** Default landing page: a searchable feed of everyone's posts, battles and people. */
export function SearchView() {
  const { user, blocked } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<Tab>('feed');
  const [scope, setScope] = useState<'all' | 'following'>('all');
  const [following, setFollowing] = useState<string[] | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setTerm(input), 300);
    return () => window.clearTimeout(id);
  }, [input]);

  useEffect(() => {
    if (!user) return setFollowing([]);
    supabase.from('follows').select('followee_id').eq('follower_id', user.id).then(({ data }) => {
      setFollowing((data ?? []).map((r) => r.followee_id as string));
    });
  }, [user]);

  const fetchPage = useCallback(
    async (offset: number): Promise<number> => {
      if (tab === 'feed') {
        if (scope === 'following' && following === null) return 0;
        const rows = await loadPosts(user?.id ?? null, {
          q: term, from: offset, limit: PAGE, excludeAuthors: blocked,
          authorIds: scope === 'following' ? (following ?? []) : undefined,
        });
        setPosts((p) => (offset ? [...p, ...rows] : rows));
        return rows.length;
      }
      if (tab === 'battles') {
        const rows = await loadBattles({ q: term, from: offset, limit: PAGE });
        setBattles((b) => (offset ? [...b, ...rows] : rows));
        return rows.length;
      }
      const rows = (await loadPeople(term, offset, PAGE)).filter((p) => !blocked.includes(p.id));
      setPeople((l) => (offset ? [...l, ...rows] : rows));
      return rows.length;
    },
    [tab, scope, following, term, user, blocked],
  );

  useEffect(() => {
    const mine = ++request.current;
    setLoading(true);
    fetchPage(0)
      .then((n) => mine === request.current && setHasMore(n === PAGE))
      .catch(() => mine === request.current && toast(t('error_generic'), 'error'))
      .finally(() => mine === request.current && setLoading(false));
  }, [fetchPage, toast, t]);

  const loadMore = async () => {
    const count = tab === 'feed' ? posts.length : tab === 'battles' ? battles.length : people.length;
    setMoreBusy(true);
    try {
      setHasMore((await fetchPage(count)) === PAGE);
    } catch {
      toast(t('error_generic'), 'error');
    } finally {
      setMoreBusy(false);
    }
  };

  const list = tab === 'feed' ? posts : tab === 'battles' ? battles : people;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('nav_search')} sub={t('search_sub')} />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          className="input pl-9"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search_placeholder')}
          aria-label={t('search_placeholder')}
        />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Chip active={tab === 'feed'} onClick={() => setTab('feed')}>{t('tab_feed')}</Chip>
        <Chip active={tab === 'battles'} onClick={() => setTab('battles')}>{t('tab_battles')}</Chip>
        <Chip active={tab === 'people'} onClick={() => setTab('people')}>{t('tab_people')}</Chip>
        {tab === 'feed' && user && (
          <>
            <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden="true" />
            <Chip active={scope === 'all'} onClick={() => setScope('all')}>{t('scope_all')}</Chip>
            <Chip active={scope === 'following'} onClick={() => setScope('following')}>{t('scope_following')}</Chip>
          </>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text={term ? t('no_results') : t(tab === 'feed' ? 'feed_empty' : tab === 'battles' ? 'battles_empty' : 'people_empty')}>
          {!term && tab !== 'people' && (
            <button type="button" className="btn btn-primary" onClick={() => go('create', tab === 'battles' ? 'battle' : 'post')}>
              {t(tab === 'battles' ? 'create_battle' : 'create_post')}
            </button>
          )}
        </Empty>
      ) : tab === 'feed' ? (
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
      ) : tab === 'battles' ? (
        <div className="grid gap-4 sm:grid-cols-2">{battles.map((b) => <BattleCard key={b.id} battle={b} />)}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" className="card flex w-full items-center gap-3 text-left transition hover:border-zinc-400" onClick={() => go('profile', p.id)}>
                <Avatar p={p} size={44} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.display_name}</span>
                  <span className="block truncate text-xs text-zinc-500">@{p.handle}</span>
                  {isActiveStatus(p) ? <span className="block truncate text-xs text-accent">{p.status_text}</span> : p.bio && <span className="block truncate text-xs text-zinc-500">{p.bio}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <LoadMore show={!loading && hasMore} busy={moreBusy} onClick={loadMore} label={t('load_more')} />
    </div>
  );
}
