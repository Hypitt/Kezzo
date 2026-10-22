import { useCallback, useEffect, useRef, useState } from 'react';
import { loadBattles } from '../lib/data';
import { supabase } from '../lib/supabase';
import { BATTLE_CATEGORIES, type Battle, type BattleStatus } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { BattleCard } from '../components/BattleCard';
import { Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

const PAGE = 12;
type Filter = 'active' | 'live' | 'open' | 'ended';
const STATUSES: Record<Filter, BattleStatus[]> = { active: ['live', 'open'], live: ['live'], open: ['open'], ended: ['ended'] };

export function BattlesView() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [filter, setFilter] = useState<Filter>('active');
  const [category, setCategory] = useState('');
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);

  // Forgotten battles that nobody joined are cancelled after 12 hours (entry fees refunded); tidy up when the list opens.
  useEffect(() => { void supabase.rpc('close_stale_rooms'); }, []);

  const fetchPage = useCallback(
    (offset: number) => loadBattles({ status: STATUSES[filter], category: category || undefined, from: offset, limit: PAGE }),
    [filter, category],
  );

  useEffect(() => {
    const mine = ++request.current;
    setLoading(true);
    fetchPage(0)
      .then((rows) => {
        if (mine !== request.current) return;
        setBattles(rows);
        setHasMore(rows.length === PAGE);
      })
      .catch(() => mine === request.current && toast(t('error_generic'), 'error'))
      .finally(() => mine === request.current && setLoading(false));
  }, [fetchPage, toast, t]);

  const more = async () => {
    setBusy(true);
    try {
      const rows = await fetchPage(battles.length);
      setBattles((b) => [...b, ...rows]);
      setHasMore(rows.length === PAGE);
    } catch {
      toast(t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('nav_battles')}
        sub={t('battles_sub')}
        action={<button type="button" className="btn btn-accent" onClick={() => go('create', 'battle')}>{t('create_battle')}</button>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(Object.keys(STATUSES) as Filter[]).map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{t(`filter_${f}` as Key)}</Chip>
        ))}
        <select className="input ml-auto w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('category')}>
          <option value="">{t('all_categories')}</option>
          {BATTLE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}` as Key)}</option>)}
        </select>
      </div>
      {loading ? <Loading /> : battles.length === 0 ? (
        <Empty text={t('battles_empty')}>
          <button type="button" className="btn btn-primary" onClick={() => go('create', 'battle')}>{t('create_battle')}</button>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">{battles.map((b) => <BattleCard key={b.id} battle={b} />)}</div>
      )}
      <LoadMore show={!loading && hasMore} busy={busy} onClick={more} label={t('load_more')} />
    </div>
  );
}
