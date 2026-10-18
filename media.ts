/** Reads the duration (seconds) of an audio/video file in the browser. */
export function mediaDuration(file: File, kind: 'audio' | 'video'): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const finish = () => {
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
    };
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error('timeout'));
    }, 8000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const seconds = el.duration;
      finish();
      if (Number.isFinite(seconds)) resolve(seconds);
      else reject(new Error('unknown duration'));
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      finish();
      reject(new Error('unreadable file'));
    };
    el.src = url;
  });
}
