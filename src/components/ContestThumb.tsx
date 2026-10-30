import { useState } from 'react';
import { thumbPath } from '../lib/media';
import { publicUrl } from '../lib/storage';
import { AutoVideo } from './AutoVideo';

export function Thumb({ kind, path, title }: { kind: 'photo' | 'video'; path: string; title: string }) {
  const full = publicUrl('media-public', path);
  const [src, setSrc] = useState(() => publicUrl('media-public', kind === 'photo' ? thumbPath(path) : path));
  if (kind === 'photo') {
    return <img src={src} alt={title} loading="lazy" className="h-full w-full object-cover" onError={() => { if (src !== full) setSrc(full); }} />;
  }
  return <AutoVideo src={full} label={title} className="h-full w-full object-cover" />;
}
