import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { detectLang } from './detect';
import { LANGS, type Lang } from './types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';

export interface TrWords {
  from: (lang: string) => string; original: string; translated: string; translate: string; stopAuto: string; auto: string;
  captions: string; listen: string; stopListen: string; addSubs: string; working: string; subsDone: string; subsFail: string; noSpeech: string; cc: string;
}

export const TR: Record<Lang, TrWords> = {
  en: { from: (l) => `Translated from ${l}`, original: 'Show original', translated: 'Show translation', translate: 'Translate', stopAuto: 'Stop auto-translating', auto: 'Translate automatically',
    captions: 'Subtitles', listen: 'Listen', stopListen: 'Stop listening', addSubs: 'Add subtitles', working: 'Creating subtitles…', subsDone: 'Subtitles added', subsFail: 'Could not create subtitles for this file.', noSpeech: 'No speech found.', cc: 'Subtitles' },
  fr: { from: (l) => `Traduit du ${l}`, original: 'Voir l’original', translated: 'Voir la traduction', translate: 'Traduire', stopAuto: 'Arrêter la traduction automatique', auto: 'Traduire automatiquement',
    captions: 'Sous-titres', listen: 'Écouter', stopListen: 'Arrêter l’écoute', addSubs: 'Ajouter des sous-titres', working: 'Création des sous-titres…', subsDone: 'Sous-titres ajoutés', subsFail: 'Impossible de créer des sous-titres pour ce fichier.', noSpeech: 'Aucune parole détectée.', cc: 'Sous-titres' },
  es: { from: (l) => `Traducido del ${l}`, original: 'Ver original', translated: 'Ver traducción', translate: 'Traducir', stopAuto: 'Dejar de traducir automáticamente', auto: 'Traducir automáticamente',
    captions: 'Subtítulos', listen: 'Escuchar', stopListen: 'Dejar de escuchar', addSubs: 'Añadir subtítulos', working: 'Creando subtítulos…', subsDone: 'Subtítulos añadidos', subsFail: 'No se pudieron crear subtítulos para este archivo.', noSpeech: 'No se encontró voz.', cc: 'Subtítulos' },
  pt: { from: (l) => `Traduzido do ${l}`, original: 'Ver original', translated: 'Ver tradução', translate: 'Traduzir', stopAuto: 'Parar de traduzir automaticamente', auto: 'Traduzir automaticamente',
    captions: 'Legendas', listen: 'Ouvir', stopListen: 'Parar de ouvir', addSubs: 'Adicionar legendas', working: 'Criando legendas…', subsDone: 'Legendas adicionadas', subsFail: 'Não foi possível criar legendas para este arquivo.', noSpeech: 'Nenhuma fala encontrada.', cc: 'Legendas' },
  hi: { from: (l) => `${l} से अनुवादित`, original: 'मूल देखें', translated: 'अनुवाद देखें', translate: 'अनुवाद करें', stopAuto: 'अपने-आप अनुवाद बंद करें', auto: 'अपने-आप अनुवाद करें',
    captions: 'उपशीर्षक', listen: 'सुनें', stopListen: 'सुनना बंद करें', addSubs: 'उपशीर्षक जोड़ें', working: 'उपशीर्षक बन रहे हैं…', subsDone: 'उपशीर्षक जुड़ गए', subsFail: 'इस फ़ाइल के उपशीर्षक नहीं बन सके।', noSpeech: 'कोई आवाज़ नहीं मिली।', cc: 'उपशीर्षक' },
};

export const langName = (code: string): string => LANGS.find((l) => l.code === code)?.label ?? code.toUpperCase();

// ---- the "translate automatically" choice (kept on this device)
const AUTO_KEY = 'kezzo_autotranslate';
const readAuto = (): boolean => { try { return localStorage.getItem(AUTO_KEY) !== 'off'; } catch { return true; } };
export function useAutoTranslate(): [boolean, (on: boolean) => void] {
  const [auto, setAuto] = useState(readAuto);
  useEffect(() => {
    const on = () => setAuto(readAuto());
    window.addEventListener('kezzo:autotranslate', on);
    return () => window.removeEventListener('kezzo:autotranslate', on);
  }, []);
  const set = useCallback((v: boolean) => {
    try { localStorage.setItem(AUTO_KEY, v ? 'on' : 'off'); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event('kezzo:autotranslate'));
  }, []);
  return [auto, set];
}

// ---- saved translations on this device and a pause when the server says it cannot translate right now
const memory = new Map<string, string>();
let pausedUntil = 0;

async function fetchTranslations(items: { t: string; s: string }[], target: Lang): Promise<string[]> {
  const out = items.map((i) => memory.get(`${target}|${i.s}|${i.t}`) ?? null);
  const todo = items.map((i, idx) => ({ ...i, idx })).filter((x) => out[x.idx] === null);
  if (todo.length) {
    if (Date.now() < pausedUntil) throw new Error('paused');
    try {
      for (let i = 0; i < todo.length; i += 20) {
        const group = todo.slice(i, i + 20);
        const res = await api<{ out: string[] }>('translate', { action: 'text', target, items: group.map((g) => ({ t: g.t, s: g.s })) });
        group.forEach((g, k) => { out[g.idx] = res.out[k] ?? g.t; memory.set(`${target}|${g.s}|${g.t}`, res.out[k] ?? g.t); });
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 503 || status === 429 || status === 502) pausedUntil = Date.now() + 5 * 60_000;
      throw err;
    }
  }
  return out.map((o, i) => o ?? items[i].t);
}

export interface Translated {
  out: string[];            // what to show
  from: string | null;      // language name of the original, when it was translated
  translated: boolean;      // currently showing the translation
  canTranslate: boolean;    // a foreign text is here but nothing was translated yet (auto-translate is off)
  busy: boolean;
  toggle: () => void;       // original <-> translation
  run: () => void;          // translate now (when auto-translate is off)
}

/** Shows texts in the person's language. Texts already in it (or of unknown language) stay as they are. */
export function useTranslated(texts: string[], enabled = true): Translated {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [auto] = useAutoTranslate();
  const key = texts.join('\u0001');
  const items = useMemo(() => texts.map((t) => ({ t, s: detectLang(t) })), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const foreign = enabled && !!user && items.some((i) => i.s && i.s !== lang);
  const [result, setResult] = useState<string[] | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => { setResult(null); setShowOriginal(false); setAsked(false); }, [key, lang]);

  const go = auto || asked;
  useEffect(() => {
    if (!foreign || !go) return;
    let off = false;
    setBusy(true);
    const need = items.map((i) => (i.s && i.s !== lang ? { t: i.t, s: i.s } : null));
    const send = need.filter((x): x is { t: string; s: string } => x !== null);
    void fetchTranslations(send, lang)
      .then((res) => {
        if (off) return;
        let k = 0;
        setResult(items.map((i, idx) => (need[idx] ? res[k++] : i.t)));
      })
      .catch(() => undefined)
      .finally(() => !off && setBusy(false));
    return () => { off = true; };
  }, [foreign, go, items, lang]);

  const fromCode = items.find((i) => i.s && i.s !== lang)?.s ?? null;
  const done = result !== null;
  return {
    out: done && !showOriginal ? result : texts,
    from: done && fromCode ? langName(fromCode) : null,
    translated: done && !showOriginal,
    canTranslate: foreign && !go,
    busy,
    toggle: () => setShowOriginal((v) => !v),
    run: () => setAsked(true),
  };
}
