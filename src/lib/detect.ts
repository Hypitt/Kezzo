import type { Lang } from './types';

const WORDS: Record<'en' | 'fr' | 'es' | 'pt', string> = {
  en: 'the and is are to of in you that it for with this my we on was have not but they your what when how so be at as do can will just from about love like',
  fr: 'le la les des est et un une pour que qui dans je vous nous pas sur avec ce au du mais très bien ça comme sont être fait aussi tout cette mon ma mes ton',
  es: 'el la los las es y de que en un una para con por no mi se muy pero está son como más todo esta este hay yo tu su al lo qué cómo',
  pt: 'o a os as é e de que em um uma para com não por eu muito mas está você são como mais tudo isso esta este tem meu minha seu ao na no do da',
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(' '))])) as Record<'en' | 'fr' | 'es' | 'pt', Set<string>>;

/** A quick guess of the language of a short text (English, French, Spanish, Portuguese or Hindi). null when it is not sure. */
export function detectLang(text: string): Lang | null {
  const t = text.trim();
  if (t.length < 8) return null;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (!letters) return null;
  const deva = (letters.match(/[ऀ-ॿ]/g) ?? []).length;
  if (deva / letters.length > 0.3) return 'hi';
  const latin = (letters.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (latin / letters.length < 0.8) return null;
  const words = t.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  if (words.length < 3) return null;
  const score: Record<'en' | 'fr' | 'es' | 'pt', number> = { en: 0, fr: 0, es: 0, pt: 0 };
  for (const w of words) for (const k of ['en', 'fr', 'es', 'pt'] as const) if (SETS[k].has(w)) score[k] += 1;
  const low = t.toLowerCase();
  if (/[ñ¿¡]/.test(low)) score.es += 3;
  if (/[ãõ]/.test(low)) score.pt += 3;
  if (/ç/.test(low)) { score.fr += 1; score.pt += 1; }
  if (/[èêùâîôûœ]/.test(low)) score.fr += 2;
  const ranked = (Object.entries(score) as ['en' | 'fr' | 'es' | 'pt', number][]).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] < 2 || ranked[0][1] === ranked[1][1]) return null;
  return ranked[0][0];
}
