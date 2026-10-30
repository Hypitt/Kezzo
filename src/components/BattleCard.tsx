import { useState } from 'react';
import { Coins, Users, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import type { Battle } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { Avatar } from './ui';
import { Tx } from './Tx';

export function BattleCard({ battle }: { battle: Battle }) {
  const { t } = useI18n();
  const { go } = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const live = battle.status === 'live';
  const open = battle.status === 'open';
  // The host can always close their own battle from the list (for example when nobody joined), without opening it first.
  const canEnd = Boolean(user && battle.host_id === user.id && (live || open));
  const end = async () => {
    if (!window.confirm(t(open ? 'confirm_cancel' : 'confirm_end'))) return;
    setBusy(true);
    const { error } = await supabase.rpc('end_battle', { p_battle: battle.id });
    setBusy(false);
    if (error) return toast(explain(error, t), 'error');
    toast(t(open ? 'cancelled_toast' : 'ended_toast'));
    setGone(true);
  };
  if (gone) return null;
  return (
    <div className="card space-y-3 transition hover:border-zinc-400">
    <button type="button" onClick={() => go('battles', battle.id)} className="block w-full space-y-3 text-left">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-700">
          {battle.category === 'custom' && battle.custom_theme ? battle.custom_theme : t(`cat_${battle.category}` as Key)}
        </span>
        <span className={`inline-flex items-center gap-1.5 font-medium ${live ? 'text-accent' : 'text-zinc-500'}`}>
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />}
          {t(`status_${battle.status}` as Key)}
        </span>
      </div>
      <h3 className="text-base font-semibold leading-snug"><Tx text={battle.title} note={false} /></h3>
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
    {canEnd && (
      <button type="button" className="btn btn-ghost btn-sm w-full" disabled={busy} onClick={end}>
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />{t(open ? 'cancel_battle' : 'end_battle')}
      </button>
    )}
    </div>
  );
}
