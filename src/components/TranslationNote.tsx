import { Languages } from 'lucide-react';
import { TR, useAutoTranslate, type Translated } from '../lib/translate';
import { useI18n } from '../state/I18n';

/** The small line under translated text: where it was translated from, and how to see the original. */
export function TranslationNote({ tx }: { tx: Translated }) {
  const { lang } = useI18n();
  const w = TR[lang];
  const [auto, setAuto] = useAutoTranslate();
  const link = 'underline hover:text-zinc-900';
  if (tx.busy) return <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><Languages className="h-3 w-3" aria-hidden="true" />…</p>;
  if (tx.canTranslate) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
        <Languages className="h-3 w-3" aria-hidden="true" />
        <button type="button" className={link} onClick={tx.run}>{w.translate}</button>
        <button type="button" className={link} onClick={() => setAuto(true)}>{w.auto}</button>
      </p>
    );
  }
  if (tx.failed && !tx.from) return <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400"><Languages className="h-3 w-3" aria-hidden="true" />{w.unavailable}: {tx.failed}</p>;
  if (!tx.from) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
      <Languages className="h-3 w-3" aria-hidden="true" />
      {tx.translated && <span>{w.from(tx.from)}</span>}
      <button type="button" className={link} onClick={tx.toggle}>{tx.translated ? w.original : w.translated}</button>
      {auto && <button type="button" className={link} onClick={() => setAuto(false)}>{w.stopAuto}</button>}
    </p>
  );
}
