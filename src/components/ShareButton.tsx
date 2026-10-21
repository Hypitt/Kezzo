import { useEffect, useState } from 'react';
import { Link2, Share2, X } from 'lucide-react';
import { copyText, shareUrl, WEB_TARGETS, type ShareType } from '../lib/share';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';

const BADGE: Record<string, { label: string; bg: string }> = {
  whatsapp: { label: 'WA', bg: '#25d366' },
  facebook: { label: 'f', bg: '#1877f2' },
  x: { label: 'X', bg: '#000000' },
  tiktok: { label: 'TT', bg: '#111111' },
  instagram: { label: 'IG', bg: '#d6249f' },
};

/** "Share" button: opens a small window with WhatsApp, Facebook, X, TikTok, Instagram and Copy link. */
export function ShareButton({ type, id, title, className = 'btn btn-ghost btn-sm' }: { type: ShareType; id: string; title: string; className?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const url = shareUrl(type, id);
  const text = t(`share_text_${type}` as never, { title }) as string;
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);

  const copyLink = async () => {
    toast(t((await copyText(url)) ? 'share_copied' : 'error_generic'));
    setOpen(false);
  };
  // TikTok and Instagram cannot be opened with a ready-made post: copy the text and link, then open the app or site.
  const viaCopy = async (site: string) => {
    const ok = await copyText(`${text} ${url}`);
    toast(t(ok ? 'share_social_copied' : 'error_generic'));
    window.open(site, '_blank', 'noopener');
    setOpen(false);
  };
  const native = async () => {
    try {
      await navigator.share({ title: 'Kezzo', text, url });
      setOpen(false);
    } catch { /* cancelled */ }
  };

  const item = 'flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100';
  const badge = (k: string) => (
    <span className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: BADGE[k]?.bg }} aria-hidden="true">{BADGE[k]?.label}</span>
  );

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />{t('share')}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t('share')} onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('share_title')}</h2>
              <button type="button" className="rounded-full p-1 hover:bg-zinc-100" onClick={() => setOpen(false)} aria-label={t('close')}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-zinc-50 p-2.5">
              <img src="/logo.svg" alt="" className="h-7 w-5 shrink-0" />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="truncate text-xs text-zinc-500">{url.replace(/^https?:\/\//, '')}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {WEB_TARGETS.map((w) => (
                <a key={w.key} className={item} href={w.href(url, text)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                  {badge(w.key)}{t(`share_${w.key}` as never)}
                </a>
              ))}
              <button type="button" className={item} onClick={() => void viaCopy('https://www.tiktok.com/')}>{badge('tiktok')}TikTok</button>
              <button type="button" className={item} onClick={() => void viaCopy('https://www.instagram.com/')}>{badge('instagram')}Instagram</button>
              <button type="button" className={item} onClick={() => void copyLink()}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 text-zinc-800" aria-hidden="true"><Link2 className="h-5 w-5" /></span>{t('share_copy')}
              </button>
            </div>
            {canNative && <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => void native()}><Share2 className="h-4 w-4" aria-hidden="true" />{t('share_more')}</button>}
            <p className="mt-3 text-xs text-zinc-500">{t('share_hint')}</p>
          </div>
        </div>
      )}
    </>
  );
}
