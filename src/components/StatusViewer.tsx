import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { PersonRow } from '../lib/data';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Avatar } from './ui';

/** Full-size view of someone's 24-hour status (picture and/or text). */
export function StatusViewer({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const { t } = useI18n();
  const { go } = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={person.display_name} className="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <button type="button" className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white" onClick={onClose} aria-label={t('close')}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {person.status_image_url && <img src={person.status_image_url} alt="" className="max-h-[70vh] w-full object-contain bg-black" />}
        <div className="space-y-3 p-4">
          <button type="button" className="flex items-center gap-2 text-left" onClick={() => { onClose(); go('profile', person.id); }}>
            <Avatar p={person} size={36} />
            <span><span className="block text-sm font-semibold">{person.display_name}</span><span className="block text-xs text-zinc-500">@{person.handle}</span></span>
          </button>
          {person.status_text && <p className="whitespace-pre-wrap break-words text-base">{person.status_text}</p>}
        </div>
      </div>
    </div>
  );
}
