import { LEGAL } from '../lib/legal';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Chip } from '../components/ui';

export type LegalTab = 'terms' | 'privacy';

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
      <p className="mb-6 text-xs text-zinc-500">{LEGAL[lang].updated}</p>
      <div className="space-y-5">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-1 text-base font-semibold">{s.h}</h2>
            <p className="text-sm leading-relaxed text-zinc-700">{s.p}</p>
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
