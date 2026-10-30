import { useTranslated, TR } from '../lib/translate';
import { useI18n } from '../state/I18n';

/**
 * A short user text shown in the person's language, with a small "Show original" link right after it (chat lines, bios, titles).
 * `note={false}` is for places inside a button, where a second button cannot go: the original is one tap away on the page it opens.
 */
export function Tx({ text, enabled = true, note = true }: { text: string; enabled?: boolean; note?: boolean }) {
  const { lang } = useI18n();
  const w = TR[lang];
  const tx = useTranslated([text], enabled);
  return (
    <>
      {tx.out[0]}
      {note && tx.from && <button type="button" className="ml-1.5 text-[11px] underline opacity-70 hover:opacity-100" onClick={tx.toggle}>{tx.translated ? w.original : w.translated}</button>}
      {note && tx.canTranslate && <button type="button" className="ml-1.5 text-[11px] underline opacity-70 hover:opacity-100" onClick={tx.run}>{w.translate}</button>}
    </>
  );
}
