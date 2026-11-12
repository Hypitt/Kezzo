import { Radio, Swords } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';

const WORDS = {
  en: { battles: 'Battles', live: 'Go live' }, fr: { battles: 'Duels', live: 'En direct' }, es: { battles: 'Duelos', live: 'En directo' },
  pt: { battles: 'Duelos', live: 'Ao vivo' }, hi: { battles: 'बैटल', live: 'लाइव' },
} as const;

/** Battles and live streams on one page, with a switch at the top. */
export function BattlesLive({ which, children }: { which: 'battles' | 'live'; children: ReactNode }) {
  const { lang } = useI18n();
  const { go } = useRouter();
  const w = WORDS[lang];
  const tab = (id: 'battles' | 'live', label: string, Icon: typeof Swords) => (
    <button type="button" key={id} aria-pressed={which === id} onClick={() => go(id)}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${which === id ? 'bg-accent text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />{label}
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-3xl gap-2">{tab('battles', w.battles, Swords)}{tab('live', w.live, Radio)}</div>
      {children}
    </div>
  );
}
