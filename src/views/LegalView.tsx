import { LEGAL, type LegalBlock } from '../lib/legal';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Chip } from '../components/ui';

export type LegalTab = 'terms' | 'privacy';

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p className="text-sm leading-relaxed text-zinc-700">{block}</p>;
  if (Array.isArray(block)) {
    return <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-700">{block.map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>{block.head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-700">
          {block.rows.map((row) => (
            <tr key={row[0]} className="align-top">
              {row.map((cell, i) => <td key={i} className={`px-3 py-2 ${i === 0 ? 'font-medium text-zinc-900' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The Terms / Privacy text with its two tabs. Used by the legal page and by the pop-up shown at sign-in. */
export function LegalBody({ tab, onTab }: { tab: LegalTab; onTab: (tab: LegalTab) => void }) {
  const { lang, t } = useI18n();
  const doc = LEGAL[lang][tab];
  return (
    <div>
      <div className="mb-5 flex gap-2">
        <Chip active={tab === 'privacy'} onClick={() => onTab('privacy')}>{t('privacy')}</Chip>
        <Chip active={tab === 'terms'} onClick={() => onTab('terms')}>{t('terms')}</Chip>
      </div>
      <h1 className="mb-1 text-2xl font-bold">{doc.title}</h1>
      <p className="mb-6 text-xs text-zinc-500">{doc.updated}</p>
      <div className="space-y-5">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-1 text-base font-semibold">{s.h}</h2>
            <div className="space-y-2">{s.body.map((b, i) => <Block key={i} block={b} />)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function LegalView({ id }: { id?: string }) {
  const { go } = useRouter();
  const tab: LegalTab = id === 'terms' ? 'terms' : 'privacy';
  return (
    <div className="mx-auto max-w-2xl">
      <LegalBody tab={tab} onTab={(next) => go('legal', next)} />
    </div>
  );
}
