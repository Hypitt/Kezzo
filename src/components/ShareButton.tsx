import { useEffect, useRef, useState } from 'react';
import { Download, Link2, Share2, X } from 'lucide-react';
import { watermarkPhoto, watermarkVideo, WATERMARK_MAX_VIDEO_SECONDS } from '../lib/watermark';
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
export interface ShareMedia { kind: 'photo' | 'video'; urls: string[] }

export function ShareButton({ type, id, title, media, className = 'btn btn-ghost btn-sm' }: { type: ShareType; id: string; title: string; media?: ShareMedia; className?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prep, setPrep] = useState<{ state: 'idle' | 'working' | 'ready' | 'error'; ratio: number; files: File[]; message?: string }>({ state: 'idle', ratio: 0, files: [] });
  const stop = useRef(false);
  const url = shareUrl(type, id);
  const text = t(`share_text_${type}` as never, { title }) as string;
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
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

  const prepare = async () => {
    if (!media) return;
    stop.current = false;
    setPrep({ state: 'working', ratio: 0, files: [] });
    try {
      const files = media.kind === 'photo'
        ? await Promise.all(media.urls.map((u, i) => watermarkPhoto(u, title, i)))
        : [await watermarkVideo(media.urls[0], title, (ratio) => setPrep((p) => (p.state === 'working' ? { ...p, ratio } : p)), () => stop.current)];
      setPrep({ state: 'ready', ratio: 1, files });
    } catch (err) {
      const m = (err as Error).message;
      if (m === 'cancelled') return setPrep({ state: 'idle', ratio: 0, files: [] });
      setPrep({ state: 'error', ratio: 0, files: [], message: t(m === 'too_long' ? 'share_video_too_long' : 'share_media_failed', { n: WATERMARK_MAX_VIDEO_SECONDS / 60 }) });
    }
  };
  const canShareFiles = (files: File[]) => typeof navigator.canShare === 'function' && navigator.canShare({ files });
  const shareFiles = async () => {
    try {
      await navigator.share({ files: prep.files, title: 'Kezzo', text: `${text} ${url}` });
      setOpen(false);
    } catch { /* cancelled */ }
  };
  const download = () => {
    prep.files.forEach((f, i) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      setTimeout(() => { a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, i * 350);
    });
    void copyText(`${text} ${url}`);
    toast(t('share_downloaded'));
  };
  const close = () => { stop.current = true; setOpen(false); setPrep({ state: 'idle', ratio: 0, files: [] }); };

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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t('share')} onClick={close}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('share_title')}</h2>
              <button type="button" className="rounded-full p-1 hover:bg-zinc-100" onClick={close} aria-label={t('close')}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-zinc-50 p-2.5">
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
            {media && (
              <div className="mt-3 rounded-xl border border-zinc-200 p-3">
                <p className="text-sm font-semibold">{t(media.kind === 'photo' ? 'share_media_photo' : 'share_media_video')}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{t('share_media_hint')}</p>
                {prep.state === 'idle' && <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => void prepare()}>{t('share_media_prepare')}</button>}
                {prep.state === 'working' && (
                  <div className="mt-2" role="status">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(prep.ratio * 100)}%` }} /></div>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-500"><span>{t('share_media_working')}</span><button type="button" className="underline" onClick={() => { stop.current = true; }}>{t('cancel')}</button></div>
                  </div>
                )}
                {prep.state === 'error' && <p role="alert" className="mt-2 text-xs text-red-600">{prep.message}</p>}
                {prep.state === 'ready' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canShareFiles(prep.files) && <button type="button" className="btn btn-primary btn-sm" onClick={() => void shareFiles()}><Share2 className="h-3.5 w-3.5" aria-hidden="true" />{t('share_media_send')}</button>}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={download}><Download className="h-3.5 w-3.5" aria-hidden="true" />{t('share_media_download')}</button>
                  </div>
                )}
              </div>
            )}
            {canNative && <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => void native()}><Share2 className="h-4 w-4" aria-hidden="true" />{t('share_more')}</button>}
            <p className="mt-3 text-xs text-zinc-500">{t('share_hint')}</p>
          </div>
        </div>
      )}
    </>
  );
}
