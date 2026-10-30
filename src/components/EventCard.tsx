import { CalendarDays, ExternalLink, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { EventRow } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ShareButton } from './ShareButton';
import { publicUrl, removePublic } from '../lib/storage';
import { useTranslated } from '../lib/translate';
import { TranslationNote } from './TranslationNote';

export function EventCard({ event, onChange }: { event: EventRow; onChange: () => void }) {
  const { user, ensureAuth } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const mine = user?.id === event.host_id;
  const tx = useTranslated([event.title, event.description ?? '', event.location ?? ''], !mine, true);
  const cover = event.cover_path ? publicUrl('media-public', event.cover_path) : null;
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
  const past = new Date(event.ends_at ?? event.starts_at).getTime() < Date.now();

  const toggle = async () => {
    if (!ensureAuth() || !user) return;
    const { error } = event.me
      ? await supabase.from('event_rsvps').delete().match({ event_id: event.id, user_id: user.id })
      : await supabase.from('event_rsvps').insert({ event_id: event.id, user_id: user.id });
    if (error) toast(t('error_generic'), 'error');
    onChange();
  };
  const remove = async () => {
    if (!window.confirm(t('confirm_delete'))) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) return toast(t('error_generic'), 'error');
    if (event.cover_path) void removePublic('media-public', [event.cover_path]);
    onChange();
  };

  return (
    <article className="card overflow-hidden !p-0">
      {cover && <img src={cover} alt="" className="h-40 w-full object-cover" loading="lazy" decoding="async" />}
      <div className="space-y-2 p-4">
        <h3 className="text-base font-semibold">{tx.out[0]}</h3>
        <p className="flex items-center gap-1.5 text-sm text-zinc-700"><CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{fmt(event.starts_at)}{event.ends_at ? ` → ${fmt(event.ends_at)}` : ''}</p>
        {event.location && <p className="flex items-center gap-1.5 text-sm text-zinc-700"><MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /><span className="break-words">{tx.out[2]}</span></p>}
        {event.description && <p className="whitespace-pre-wrap break-words text-sm text-zinc-600">{tx.out[1]}</p>}
        <TranslationNote tx={tx} />
        <p className="text-xs text-zinc-500">{t('hosted_by')} <button type="button" className="underline" onClick={() => go('profile', event.host_id)}>{event.host.display_name}</button> · {t('event_going_n', { n: event.going ?? 0 })}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!past && <button type="button" className={`btn btn-sm ${event.me ? 'btn-ghost border-accent text-accent' : 'btn-primary'}`} onClick={() => void toggle()} aria-pressed={Boolean(event.me)}>{t(event.me ? 'event_going' : 'event_im_going')}</button>}
          {event.link && <a className="btn btn-ghost btn-sm" href={event.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{t('event_join_online')}</a>}
          <ShareButton type="event" id={event.id} title={event.title} />
          {past && <span className="text-xs text-zinc-500">{t('event_past')}</span>}
          <span className="flex-1" />
          {mine && <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove()}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('delete')}</button>}
        </div>
      </div>
    </article>
  );
}
