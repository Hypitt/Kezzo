import { useState } from 'react';
import { Play } from 'lucide-react';
import { thumbPath } from '../lib/media';
import { isR2Path, publicUrl } from '../lib/storage';

export function Thumb({ kind, path, title }: { kind: 'photo' | 'video'; path: string; title: string }) {
  const full = publicUrl('media-public', path);
  const [src, setSrc] = useState(() => publicUrl('media-public', kind === 'photo' ? thumbPath(path) : path));
  if (kind === 'photo') {
    return <img src={src} alt={title} loading="lazy" className="h-full w-full object-cover" onError={() => { if (src !== full) setSrc(full); }} />;
  }
  if (isR2Path(path)) return <video src={`${full}#t=0.5`} muted playsInline preload="metadata" aria-label={title} className="h-full w-full object-cover" />;
  return <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-white"><Play className="h-5 w-5 fill-white" aria-hidden="true" /></span>;
}
