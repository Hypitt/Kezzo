import type { TFn } from '../state/I18n';
import type { Key } from './i18n';

const KNOWN = [
  'insufficient_coins', 'already_claimed', 'battle_full', 'already_joined', 'not_live', 'cannot_vote_self',
  'not_host', 'not_enough_contenders', 'bad_status', 'own_post', 'not_paid', 'already_unlocked',
  'not_authenticated', 'invalid_vote', 'host_cannot_leave', 'not_found', 'last_round',
] as const;

/** Turns a Supabase/Postgres error into a friendly, translated message. */
export function explain(err: unknown, t: TFn): string {
  const message =
    typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  const code = KNOWN.find((k) => message.includes(k));
  return code ? t(`err_${code}` as Key) : t('error_generic');
}
