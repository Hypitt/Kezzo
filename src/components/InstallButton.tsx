import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useInstall } from '../lib/install';
import { useI18n } from '../state/I18n';

/**
 * "Install app" button. Hidden when Kezzo is already installed. Opens the browser's install window when there is one;
 * otherwise (iPhone/iPad Safari, Firefox, ...) it shows a short how-to.
 */
export function InstallButton({ className = '', compact = false, label, onPress }: { className?: string; compact?: boolean; label?: string; onPress?: () => void }) {
  const { t } = useI18n();
  const { installed, ios, install } = useInstall();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (!help) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHelp(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help]);

  if (installed) return null;

  const press = async () => {
    onPress?.();
    if (!(await install())) setHelp(true);
  };

  return (
    <>
      <button type="button" className={className} onClick={press} aria-label={t('install_app')} title={t('install_app')}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span className={compact ? 'hidden xl:inline' : ''}>{label ?? t('install_app')}</span>
      </button>
      {help && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && setHelp(false)}>
          <div role="dialog" aria-modal="true" aria-label={t('install_app')} className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-zinc-900 shadow-xl">
            <button type="button" className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-900" onClick={() => setHelp(false)} aria-label={t('close')}><X className="h-5 w-5" aria-hidden="true" /></button>
            <h2 className="pr-8 text-lg font-semibold">{t('install_title')}</h2>
            <p className="text-sm text-zinc-600">{t('install_intro')}</p>
            {ios ? (
              <ol className="space-y-3 text-sm">
                <li className="flex items-center gap-3"><Share className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span>{t('install_ios_1')}</span></li>
                <li className="flex items-center gap-3"><SquarePlus className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span>{t('install_ios_2')}</span></li>
                <li className="flex items-center gap-3"><Download className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span>{t('install_ios_3')}</span></li>
              </ol>
            ) : (
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>{t('install_other_1')}</li>
                <li>{t('install_other_2')}</li>
              </ul>
            )}
            <button type="button" className="btn btn-primary w-full" onClick={() => setHelp(false)}>{t('got_it')}</button>
          </div>
        </div>
      )}
    </>
  );
}
