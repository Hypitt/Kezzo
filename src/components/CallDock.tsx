import { useState } from 'react';
import { Maximize2, Minimize2, PhoneOff } from 'lucide-react';
import { useI18n } from '../state/I18n';
import { LiveRoom } from './LiveRoom';

/**
 * The running call, in a small window pinned to the corner of the screen. It sits above every page, so people can scroll,
 * open profiles or chat while the call keeps going. Minimizing only hides the pictures; the call and the sound continue.
 */
export function CallDock({ roomName, video, label, onEnd }: { roomName: string; video: boolean; label: string; onEnd: () => void }) {
  const { t } = useI18n();
  const [min, setMin] = useState(false);
  return (
    <div
      className="fixed bottom-20 right-3 z-[90] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl ring-1 ring-black/10 lg:bottom-4 lg:right-4"
      role="region"
      aria-label={label}
    >
      <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 text-white">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
        <button type="button" onClick={() => setMin((m) => !m)} className="rounded p-1 text-zinc-300 hover:bg-white/10 hover:text-white" aria-label={t(min ? 'call_max' : 'call_min')} title={t(min ? 'call_max' : 'call_min')}>
          {min ? <Maximize2 className="h-4 w-4" aria-hidden="true" /> : <Minimize2 className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button type="button" onClick={onEnd} className="rounded p-1 text-red-300 hover:bg-white/10 hover:text-red-200" aria-label={t('call_end')} title={t('call_end')}>
          <PhoneOff className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {/* Kept mounted (just hidden) while minimized so the call and sound never stop */}
      <div className={min ? 'hidden' : 'max-h-[70vh] overflow-y-auto p-2'}>
        <LiveRoom roomName={roomName} video={video} autoJoin onEnd={onEnd} />
      </div>
    </div>
  );
}
