import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useInstall } from '../lib/install';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { InstallButton } from './InstallButton';

const FLAG = 'kezzo_install_offered';
const seen = (): boolean => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(FLAG, '1'); } catch { /* storage unavailable */ } };

/**
 * Right after a person signs up or signs in on a device, Kezzo offers once to install the app.
 * Browsers never allow a silent install: the person must tap the button, then the browser shows its own install window.
 */
export function InstallOffer() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const { installed, canPrompt, ios } = useInstall();
  const [open, setOpen] = useState(false);
  const ready = Boolean(user && profile) && !installed && (canPrompt || ios) && !seen();

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setOpen(true), 1500);
    return () => window.clearTimeout(id);
  }, [ready]);

  if (!open || installed) return null;
  const close = () => { markSeen(); setOpen(false); };
  return (
    <div role="dialog" aria-label={t('install_title')} className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-sm rounded-2xl bg-white p-4 text-zinc-900 shadow-2xl ring-1 ring-zinc-200 sm:left-auto sm:right-4">
      <button type="button" onClick={close} aria-label={t('close')} className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-900"><X className="h-4 w-4" aria-hidden="true" /></button>
      <p className="flex items-center gap-2 pr-6 text-sm font-semibold"><Download className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{t('install_title')}</p>
      <p className="mt-1 text-xs text-zinc-600">{t('install_intro')}</p>
      <div className="mt-3 flex items-center gap-2">
        <InstallButton className="btn btn-primary btn-sm" onPress={close} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>{t('not_now')}</button>
      </div>
    </div>
  );
}
