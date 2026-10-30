import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, RotateCcw, Trash2, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { COPY } from './Landing';
import { EMPTY_CONTENT, IMAGE_SLOTS, flatten, loadContent, orderOf, type SiteContent } from '../lib/siteContent';
import { compressImage } from '../lib/media';
import { fileExt } from '../lib/format';
import { publicFilePath, publicUrl } from '../lib/storage';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, startUpload } from '../lib/upload';
import type { Lang } from '../lib/types';

const LANGS: Lang[] = ['en', 'fr', 'es', 'pt', 'hi'];
const W = {
  en: {
    title: 'Edit the public homepage', sub: 'This is the page people see before they sign in. Change texts, pictures, the video and the order of sections, then press Save. Anything you leave alone keeps its original text or picture.',
    back: 'Back to Admin', save: 'Save changes', saved: 'Saved. The public page is updated.', texts: 'Texts', textsSub: 'Pick a language, then change any text. Leave a box as it is to keep the original. Use the arrow to go back to the original.',
    pictures: 'Pictures', hero: 'Top banner photo', feed: 'Participation section photo', replace: 'Choose a picture', original: 'Original picture in use', restore: 'Use the original',
    video: 'Featured video', videoSub: 'Shown as its own section. It plays with controls, only when the visitor presses play. Show or hide it in “Home page sections”.', videoTitle: 'Title above the video',
    videoPick: 'Choose a video', videoNone: 'No video yet', videoRemove: 'Remove video', order: 'Order of sections', orderSub: 'The top banner always stays first. Use the arrows to move a section.',
    names: { tagline: 'Two taglines strip', video: 'Featured video', contest: 'Contest box', media: 'Community photos and videos', groups: 'Groups', about: 'Five things Kezzo is about', modes: 'Solo, group, battle', join: 'Participation', cta: 'Final sign-up call' } as Record<string, string>,
    uploading: 'Uploading…', tooBig: (n: number) => `That file is too big (max ${n} MB).`, fail: 'Upload failed. Try again.', changed: 'changed', reset: 'Original',
  },
  fr: {
    title: 'Modifier la page d’accueil publique', sub: 'C’est la page que voient les gens avant de se connecter. Changez les textes, les images, la vidéo et l’ordre des sections, puis enregistrez. Ce que vous ne touchez pas garde son texte ou son image d’origine.',
    back: 'Retour à l’admin', save: 'Enregistrer', saved: 'Enregistré. La page publique est à jour.', texts: 'Textes', textsSub: 'Choisissez une langue, puis modifiez un texte. Laissez une case telle quelle pour garder l’original. La flèche rétablit l’original.',
    pictures: 'Images', hero: 'Photo de la bannière du haut', feed: 'Photo de la section participation', replace: 'Choisir une image', original: 'Image d’origine utilisée', restore: 'Reprendre l’original',
    video: 'Vidéo à la une', videoSub: 'Affichée dans sa propre section, avec commandes, lue seulement quand le visiteur appuie sur lecture. Affichez ou masquez-la dans « Sections de la page d’accueil ».', videoTitle: 'Titre au-dessus de la vidéo',
    videoPick: 'Choisir une vidéo', videoNone: 'Pas encore de vidéo', videoRemove: 'Retirer la vidéo', order: 'Ordre des sections', orderSub: 'La bannière du haut reste toujours en premier. Utilisez les flèches pour déplacer une section.',
    names: { tagline: 'Bandeau des deux phrases', video: 'Vidéo à la une', contest: 'Encadré du concours', media: 'Photos et vidéos de la communauté', groups: 'Groupes', about: 'Les cinq choses de Kezzo', modes: 'Solo, groupe, battle', join: 'Participation', cta: 'Appel final à s’inscrire' } as Record<string, string>,
    uploading: 'Envoi…', tooBig: (n: number) => `Ce fichier est trop gros (max ${n} Mo).`, fail: 'Échec de l’envoi. Réessayez.', changed: 'modifié', reset: 'Original',
  },
};

export function SiteEditorView() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const w = lang === 'fr' ? W.fr : W.en;
  const [c, setC] = useState<SiteContent>(EMPTY_CONTENT);
  const [tl, setTl] = useState<Lang>(lang);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const slot = useRef<string>('hero');
  const vidRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadContent(true).then((x) => { setC(x); setLoaded(true); }); }, []);

  const defaults = flatten(COPY[tl]);
  const over = c.texts[tl] ?? {};
  const setText = (path: string, v: string) => {
    const next = { ...over };
    if (v === defaults[path] || v === '') delete next[path]; else next[path] = v;
    setC({ ...c, texts: { ...c.texts, [tl]: next } });
  };

  const upload = async (file: File, kind: 'image' | 'video'): Promise<string | null> => {
    if (!user) return null;
    if (file.size > MAX_UPLOAD_BYTES) { toast(w.tooBig(MAX_UPLOAD_MB), 'error'); return null; }
    try {
      const f = kind === 'image' ? await compressImage(file) : file;
      const path = publicFilePath(user.id, `site-${crypto.randomUUID()}.${fileExt(f.name)}`);
      await startUpload({ bucket: 'media-public', path, file: f, onProgress: () => undefined }).done;
      return publicUrl('media-public', path);
    } catch { toast(w.fail, 'error'); return null; }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    const key = slot.current;
    setBusy(key);
    const url = await upload(file, 'image');
    setBusy(null);
    if (url) setC((p) => ({ ...p, images: { ...p.images, [key]: url } }));
  };
  const pickVideo = async (file: File | undefined) => {
    if (!file) return;
    setBusy('video');
    const url = await upload(file, 'video');
    setBusy(null);
    if (url) setC((p) => ({ ...p, video: { ...p.video, url } }));
  };

  const order = orderOf(c.order);
  const move = (i: number, d: number) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setC({ ...c, order: next });
  };

  const save = async () => {
    setBusy('save');
    const { error } = await supabase.rpc('admin_set_content', { p_content: c });
    setBusy(null);
    if (error) { toast(error.message, 'error'); return; }
    await loadContent(true);
    toast(w.saved);
  };

  const paths = Object.keys(defaults);
  return (
    <div className="mx-auto max-w-3xl space-y-5 text-zinc-900">
      <div>
        <button type="button" className="text-sm text-zinc-600 underline" onClick={() => go('admin')}>{w.back}</button>
        <h1 className="mt-2 text-2xl font-bold">{w.title}</h1>
        <p className="text-sm text-zinc-600">{w.sub}</p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold">{w.pictures}</h2>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="grid gap-4 sm:grid-cols-2">
          {IMAGE_SLOTS.map((s) => (
            <div key={s} className="space-y-2">
              <p className="text-sm font-medium">{w[s]}</p>
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-xs text-zinc-500">
                <img src={c.images[s] ?? (s === 'hero' ? '/landing/hero-photo.jpg' : '/landing/feed.jpg')} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm border border-zinc-300" disabled={busy !== null} onClick={() => { slot.current = s; imgRef.current?.click(); }}>
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />{busy === s ? w.uploading : w.replace}
                </button>
                {c.images[s] && (
                  <button type="button" className="btn btn-sm border border-zinc-300" onClick={() => { const { [s]: _drop, ...rest } = c.images; void _drop; setC({ ...c, images: rest }); }}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />{w.restore}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-base font-semibold">{w.video}</h2>
          <p className="text-xs text-zinc-500">{w.videoSub}</p>
        </div>
        <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={(e) => { void pickVideo(e.target.files?.[0]); e.target.value = ''; }} />
        {c.video.url ? <video src={c.video.url} controls playsInline preload="metadata" className="max-h-60 w-full rounded-lg bg-black" /> : <p className="text-sm text-zinc-500">{w.videoNone}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm border border-zinc-300" disabled={busy !== null} onClick={() => vidRef.current?.click()}>
            <Video className="h-4 w-4" aria-hidden="true" />{busy === 'video' ? w.uploading : w.videoPick}
          </button>
          {c.video.url && (
            <button type="button" className="btn btn-sm border border-zinc-300" onClick={() => setC({ ...c, video: {} })}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />{w.videoRemove}
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">{w.videoTitle}: {lang === 'fr' ? 'dans Textes, « videoTitle »' : 'in Texts, “videoTitle”'}</p>
      </section>

      <section className="card space-y-2">
        <div>
          <h2 className="text-base font-semibold">{w.order}</h2>
          <p className="text-xs text-zinc-500">{w.orderSub}</p>
        </div>
        <ol className="space-y-1">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-sm">
              <span className="w-5 text-zinc-400">{i + 1}</span>
              <span className="flex-1">{w.names[id] ?? id}</span>
              <button type="button" aria-label="up" className="rounded p-1 hover:bg-zinc-200 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" aria-label="down" className="rounded p-1 hover:bg-zinc-200 disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ol>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-base font-semibold">{w.texts}</h2>
          <p className="text-xs text-zinc-500">{w.textsSub}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {LANGS.map((l) => (
            <button key={l} type="button" onClick={() => setTl(l)} className={`rounded-lg px-3 py-1 text-sm font-medium ${tl === l ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div className="space-y-3">
          {[...paths, 'videoTitle'].filter((p, i, a) => a.indexOf(p) === i).map((p) => {
            const val = over[p] ?? defaults[p] ?? '';
            const long = val.length > 80;
            const edited = over[p] !== undefined;
            return (
              <label key={p} className="block">
                <span className="mb-0.5 flex items-center gap-2 text-xs text-zinc-500">
                  <code>{p}</code>{edited && <span className="rounded bg-zinc-900 px-1.5 text-[10px] text-white">{w.changed}</span>}
                  {edited && <button type="button" className="ml-auto flex items-center gap-1 underline" onClick={() => setText(p, defaults[p] ?? '')}><RotateCcw className="h-3 w-3" aria-hidden="true" />{w.reset}</button>}
                </span>
                {long
                  ? <textarea className="input w-full" rows={3} maxLength={2000} value={val} onChange={(e) => setText(p, e.target.value)} />
                  : <input className="input w-full" maxLength={2000} value={val} onChange={(e) => setText(p, e.target.value)} />}
              </label>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-16 z-10 flex justify-end lg:bottom-3">
        <button type="button" className="btn bg-zinc-900 px-6 text-white shadow-lg hover:bg-zinc-700" disabled={busy !== null || !loaded} onClick={() => void save()}>{busy === 'save' ? w.uploading : w.save}</button>
      </div>
    </div>
  );
}
