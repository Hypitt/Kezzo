import { Coins, Users } from 'lucide-react';
import type { Battle } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Avatar } from './ui';

export function BattleCard({ battle }: { battle: Battle }) {
  const { t } = useI18n();
  const { go } = useRouter();
  const live = battle.status === 'live';
  return (
    <button type="button" onClick={() => go('battles', battle.id)} className="card w-full space-y-3 text-left transition hover:border-zinc-400">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-700">
          {battle.category === 'custom' && battle.custom_theme ? battle.custom_theme : t(`cat_${battle.category}` as Key)}
        </span>
        <span className={`inline-flex items-center gap-1.5 font-medium ${live ? 'text-accent' : 'text-zinc-500'}`}>
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
          {t(`status_${battle.status}` as Key)}
        </span>
      </div>
      <h3 className="text-base font-semibold leading-snug">{battle.title}</h3>
      {battle.topic && <p className="line-clamp-2 text-sm text-zinc-500">{battle.topic}</p>}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {battle.contenders.slice(0, 5).map((c) => (
            <span key={c.user_id} className="rounded-full ring-2 ring-white"><Avatar p={c.profile} size={28} /></span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{battle.contenders.length}/{battle.max_contenders}</span>
          <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{battle.prize_pool}</span>
        </div>
      </div>
    </button>
  );
}
