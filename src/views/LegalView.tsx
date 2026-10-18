import { LEGAL } from '../lib/legal';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Chip } from '../components/ui';

export function LegalView({ id }: { id?: string }) {
  const { lang, t } = useI18n();
  const { go } = useRouter();
  const tab = id === 'terms' ? 'terms' : 'privacy';
  const doc = LEGAL[lang][tab];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex gap-2">
        <Chip active={tab === 'privacy'} onClick={() => go('legal', 'privacy')}>{t('privacy')}</Chip>
        <Chip active={tab === 'terms'} onClick={() => go('legal', 'terms')}>{t('terms')}</Chip>
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
