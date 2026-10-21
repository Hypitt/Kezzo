import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, fr, type Key } from '../lib/i18n';
import type { Lang } from '../lib/types';

export type TFn = (key: Key, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'kezzo_lang';

/** The language the person chose themselves (kept across visits), if any. */
function savedLang(): Lang | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Browser/device language: French if the first language the person prefers (among French or English) is French, otherwise English. */
function detectLang(): Lang {
  const prefs = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean).map((l) => l.toLowerCase());
  const first = prefs.find((l) => l.startsWith('fr') || l.startsWith('en'));
  return first?.startsWith('fr') ? 'fr' : 'en';
}

function initialLang(): Lang {
  return savedLang() ?? detectLang();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Until the person picks a language themselves, follow the browser/device language if it changes.
  useEffect(() => {
    const onChange = () => { if (!savedLang()) setLangState(detectLang()); };
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      let text: string = (lang === 'fr' ? fr : en)[key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
