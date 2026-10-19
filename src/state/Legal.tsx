import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { LegalBody, type LegalTab } from '../views/LegalView';
import { useI18n } from './I18n';

interface LegalValue { openLegal: (tab: LegalTab) => void }
const LegalContext = createContext<LegalValue | null>(null);

/**
 * Terms and Privacy open in a pop-up on top of the current screen. That keeps people on the sign-up or
 * sign-in form (a new browser tab would lose it) and works before a profile exists.
 */
export function LegalProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<LegalTab | null>(null);
  const openLegal = useCallback((next: LegalTab) => setTab(next), []);
  const value = useMemo(() => ({ openLegal }), [openLegal]);

  useEffect(() => {
    if (!tab) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTab(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  return (
    <LegalContext.Provider value={value}>
      {children}
      {tab && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && setTab(null)}>
          <div role="dialog" aria-modal="true" aria-label={t(tab)} className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button type="button" className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" onClick={() => setTab(null)} aria-label={t('close')}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <LegalBody tab={tab} onTab={setTab} />
            <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => setTab(null)}>{t('close')}</button>
          </div>
        </div>
      )}
    </LegalContext.Provider>
  );
}

export function useLegal(): LegalValue {
  const ctx = useContext(LegalContext);
  if (!ctx) throw new Error('useLegal must be used inside LegalProvider');
  return ctx;
}

/** "By continuing you agree to the Terms and Privacy Policy" with working links. */
export function LegalNotice({ prefixKey = 'legal_notice' }: { prefixKey?: 'legal_notice' | 'agree_prefix' }) {
  const { t } = useI18n();
  const { openLegal } = useLegal();
  return (
    <>
      {t(prefixKey)}{' '}
      <button type="button" className="underline" onClick={() => openLegal('terms')}>{t('terms')}</button> {t('and')}{' '}
      <button type="button" className="underline" onClick={() => openLegal('privacy')}>{t('privacy')}</button>.
    </>
  );
}
