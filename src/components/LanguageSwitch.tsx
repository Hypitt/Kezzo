import { ChevronDown } from 'lucide-react';
import { LANGS, isLang, type Lang } from '../lib/types';
import { useI18n } from '../state/I18n';

/** Language menu (English, Français, Español, Português, हिन्दी). `className` styles the pill; `onPick` runs after a choice. */
export function LanguageSwitch({ className = '', onPick }: { className?: string; onPick?: (lang: Lang) => void }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className={`relative inline-flex cursor-pointer items-center ${className}`}>
      <select
        aria-label={t('language')}
        value={lang}
        onChange={(e) => {
          if (!isLang(e.target.value)) return;
          setLang(e.target.value);
          onPick?.(e.target.value);
        }}
        className="cursor-pointer appearance-none bg-transparent font-[inherit] text-[inherit] outline-none"
      >
        {LANGS.map((l) => <option key={l.code} value={l.code} className="text-zinc-900">{l.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none ml-1 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
    </label>
  );
}
