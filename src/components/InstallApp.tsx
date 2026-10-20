import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../lib/pwa';
import { useI18n } from '../state/I18n';

/** "Install app" button. Shows only when installing is possible and Kezzo is not installed yet. */
export function InstallApp({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const [, refresh] = useState(0);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), []);

  if (isInstalled()) return null;
  const ios = isIos();
  if (!canPromptInstall() && !ios) return null;

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 underline"
        onClick={() => (ios ? setIosHelp((v) => !v) : void promptInstall())}
        aria-expanded={ios ? iosHelp : undefined}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />{t('install_app')}
      </button>
      {ios && iosHelp && (
        <span role="note" className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 text-left text-xs text-zinc-700 shadow-lg">
          {t('install_ios_1')} <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-label={t('install_ios_share')} /> {t('install_ios_2')}
        </span>
      )}
    </span>
  );
}
