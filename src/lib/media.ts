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

/** Longest video allowed (seconds): 60 minutes, like Instagram feed videos. Matches the database rule. */
export const MAX_VIDEO_SECONDS = 3600;

/**
 * Shrinks big photos in the browser before upload (max 1440 px by default, JPEG). This makes uploads much faster.
 * GIFs and small files are left alone. If anything goes wrong the original file is returned.
 */
export async function compressImage(file: File, maxSide = 1440, quality = 0.86): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    // Small files that are already small enough on screen are kept as they are.
    if (scale === 1 && file.size < 400 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    const type = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024 ? 'image/png' : 'image/jpeg';
    if (type === 'image/jpeg') {
      // JPEG has no transparency: paint white first, or see-through parts of a PNG turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    // Keep the original only if it already had the right size and re-saving would not make it smaller.
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    const ext = type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
