import { useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';

interface Restriction { status: 'suspended' | 'banned'; reason: string; until: string | null }

/** Tells a suspended or banned member why they cannot post (the database enforces it; this explains it). */
export function RestrictionBanner() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [r, setR] = useState<Restriction | null>(null);
  const uid = user?.id;
  useEffect(() => {
    if (!uid) { setR(null); return; }
    void supabase.rpc('my_restriction').then(({ data }) => setR(Array.isArray(data) && data[0] ? (data[0] as Restriction) : null));
  }, [uid]);
  if (!r) return null;
  const date = r.until ? new Date(r.until).toLocaleDateString(lang, { dateStyle: 'medium' }) : '';
  return (
    <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
      <p className="mx-auto flex max-w-6xl items-start gap-2">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {r.status === 'banned' ? t('restricted_banned') : date ? t('restricted_suspended', { date }) : t('restricted_suspended_open')}
          {r.reason && <> {t('restricted_reason')}: {r.reason}</>}
        </span>
      </p>
    </div>
  );
}
