import { useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import type { Key } from '../lib/i18n';

const REASONS = ['spam', 'harassment', 'sexual', 'violence', 'other'] as const;

export function ReportButton({ targetType, targetId }: { targetType: 'post' | 'profile' | 'battle' | 'group'; targetId: string }) {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const send = async (reason: (typeof REASONS)[number]) => {
    if (!ensureAuth() || !user) return;
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
    setOpen(false);
    toast(error ? t('error_generic') : t('report_sent'), error ? 'error' : 'info');
  };

  return (
    <span className="relative">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {t('report')}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
          {REASONS.map((r) => (
            <button key={r} type="button" className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-zinc-100" onClick={() => send(r)}>
              {t(`report_${r}` as Key)}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
