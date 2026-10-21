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

/** Longest video allowed (seconds). Matches the database rule. */
export const MAX_VIDEO_SECONDS = 1800;

/**
 * Shrinks big photos in the browser before upload (max 1600 px, JPEG). This makes uploads much faster.
 * GIFs and small files are left alone. If anything goes wrong the original file is returned.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 150 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024 ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob || blob.size >= file.size) return file;
    const ext = type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** A small square-ish preview (about 480 px, 30-60 KB) used in grids so the full photo is only loaded when opened. */
export async function makeThumbnail(file: File, maxSide = 480): Promise<File | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.72));
    return blob ? new File([blob], 'thumb.jpg', { type: 'image/jpeg' }) : null;
  } catch {
    return null;
  }
}

/** Where the preview of a photo is stored: next to it, with "-t.jpg" added. */
export const thumbPath = (path: string): string => path.replace(/\.[^.\/]+$/, '') + '-t.jpg';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
