import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { Spinner } from '../components/ui';
import { DEFAULT_THEME, FONTS, applyTheme, contrast, currentTheme, loadTheme, saveTheme, type Theme } from '../lib/theme';

const W = {
  en: {
    back: 'Back to admin', title: 'Colors, fonts and text size', sub: 'Changes show on your screen right away, on the landing page and in the whole app. Visitors see them after you save.',
    colors: 'Colors', accent: 'Main color', accentHelp: 'Buttons, links and highlights.', ink: 'Dark color', inkHelp: 'Headings, text and dark bars.', soft: 'Soft background', softHelp: 'Alternating sections and cards.',
    fonts: 'Fonts', heading: 'Headings', body: 'Body text', sizes: 'Text size', app: 'In the app', landing: 'On the landing page',
    sample: 'Get to know the world through its people.', sampleBody: 'Share your culture, discover music, food and languages from around the world.', btn: 'Create your free account',
    save: 'Save', reset: 'Back to the original look', saved: 'Saved. Everyone sees the new look.', lowContrast: 'White text on this main color is hard to read (contrast {n}:1, aim for 4.5:1 or more). Pick a darker color.',
  },
  fr: {
    back: 'Retour à l’admin', title: 'Couleurs, polices et taille du texte', sub: 'Les changements s’affichent tout de suite sur votre écran, sur la page d’accueil et dans toute l’appli. Les visiteurs les voient après l’enregistrement.',
    colors: 'Couleurs', accent: 'Couleur principale', accentHelp: 'Boutons, liens et mises en avant.', ink: 'Couleur foncée', inkHelp: 'Titres, texte et barres foncées.', soft: 'Fond doux', softHelp: 'Sections en alternance et cartes.',
    fonts: 'Polices', heading: 'Titres', body: 'Texte', sizes: 'Taille du texte', app: 'Dans l’appli', landing: 'Sur la page d’accueil',
    sample: 'Découvrez le monde à travers ses gens.', sampleBody: 'Partagez votre culture, découvrez la musique, la cuisine et les langues du monde entier.', btn: 'Créer mon compte gratuit',
    save: 'Enregistrer', reset: 'Revenir au look d’origine', saved: 'Enregistré. Tout le monde voit le nouveau look.', lowContrast: 'Le texte blanc sur cette couleur est difficile à lire (contraste {n}:1, visez 4,5:1 ou plus). Choisissez une couleur plus foncée.',
  },
};

const SIZES = [85, 90, 95, 100, 105, 110, 115, 120, 125];

export function ThemeEditorView() {
  const { lang } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const w = lang === 'fr' ? W.fr : W.en;
  const [draft, setDraft] = useState<Theme>(currentTheme());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    void loadTheme().then((t) => { if (!off) setDraft(t); });
    // Leaving without saving puts the saved look back.
    return () => { off = true; applyTheme(currentTheme()); };
  }, []);

  const change = (patch: Partial<Theme>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    applyTheme(next); // live preview on this screen
  };

  const save = async () => {
    setBusy(true);
    const err = await saveTheme(draft);
    setBusy(false);
    toast(err ?? w.saved, err ? 'error' : 'info');
  };

  const ratio = contrast(draft.accent, '#ffffff');
  const colorRow = (key: 'accent' | 'ink' | 'soft', label: string, help: string) => (
    <div className="flex items-center gap-3">
      <input type="color" aria-label={label} className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" value={draft[key]} onChange={(e) => change({ [key]: e.target.value } as Partial<Theme>)} />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-zinc-500">{help}</p></div>
      <code className="text-xs text-zinc-500">{draft[key]}</code>
    </div>
  );
  const fontSelect = (key: 'headingFont' | 'bodyFont', label: string) => (
    <div>
      <label className="label" htmlFor={`th-${key}`}>{label}</label>
      <select id={`th-${key}`} className="input" value={draft[key]} onChange={(e) => change({ [key]: e.target.value } as Partial<Theme>)}>
        {FONTS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
      </select>
    </div>
  );
  const sizeRow = (key: 'appScale' | 'landingScale', label: string) => (
    <div>
      <label className="label" htmlFor={`th-${key}`}>{label}: {draft[key]}%</label>
      <input id={`th-${key}`} className="w-full accent-[var(--color-accent)]" type="range" min={85} max={125} step={5} list="th-steps" value={draft[key]} onChange={(e) => change({ [key]: Number(e.target.value) } as Partial<Theme>)} />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-zinc-900">
      <div>
        <button type="button" className="text-sm text-zinc-600 underline" onClick={() => go('admin')}>{w.back}</button>
        <h1 className="mt-2 text-2xl font-bold">{w.title}</h1>
        <p className="text-sm text-zinc-600">{w.sub}</p>
      </div>

      <section className="card space-y-4">
        <h2 className="text-base font-semibold">{w.colors}</h2>
        {colorRow('accent', w.accent, w.accentHelp)}
        {ratio < 4.5 && <p className="text-xs text-amber-700">{w.lowContrast.replace('{n}', ratio.toFixed(1))}</p>}
        {colorRow('ink', w.ink, w.inkHelp)}
        {colorRow('soft', w.soft, w.softHelp)}
      </section>

      <section className="card space-y-4">
        <h2 className="text-base font-semibold">{w.fonts}</h2>
        <div className="grid gap-4 sm:grid-cols-2">{fontSelect('headingFont', w.heading)}{fontSelect('bodyFont', w.body)}</div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-base font-semibold">{w.sizes}</h2>
        <datalist id="th-steps">{SIZES.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="grid gap-4 sm:grid-cols-2">{sizeRow('appScale', w.app)}{sizeRow('landingScale', w.landing)}</div>
        <p className="text-xs text-zinc-500">{lang === 'fr' ? 'L’aperçu ci-dessous utilise la taille de l’appli. La page d’accueil prend sa propre taille quand on l’ouvre.' : 'The preview below uses the app size. The landing page uses its own size when it opens.'}</p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5" aria-label="Preview">
        <h2 className="font-display text-2xl font-extrabold leading-tight">{w.sample}</h2>
        <p className="mt-2 text-zinc-600">{w.sampleBody}</p>
        <button type="button" className="btn btn-accent mt-4 rounded-full px-6 py-2.5">{w.btn}</button>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-accent" disabled={busy} onClick={save}>{busy && <Spinner />}{w.save}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => change(DEFAULT_THEME)}><RotateCcw className="h-4 w-4" aria-hidden="true" />{w.reset}</button>
      </div>
    </div>
  );
}
