import { supabase } from './supabase';

/**
 * Biggest file the app accepts, in MB. The real ceiling is your Supabase plan:
 *   Free plan = 50 MB per file. Pro plan = raise "Upload file size limit" in Supabase (Storage > Settings),
 *   then set VITE_MAX_UPLOAD_MB (for example 2000) in Vercel and redeploy.
 */
const configured = Number(import.meta.env.VITE_MAX_UPLOAD_MB);
export const MAX_UPLOAD_MB = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 5000) : 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Files at or below this size use a single quick request; bigger ones are sent in resumable chunks. */
const SIMPLE_LIMIT = 6 * 1024 * 1024;
const CHUNK = 6 * 1024 * 1024; // Supabase requires exactly 6 MB chunks for resumable uploads

/** Uploaded files get random names and never change, so browsers may keep them for a year (saves Supabase bandwidth). */
export const CACHE_SECONDS = '31536000';

export type UploadFailure = 'too_big' | 'denied' | 'network' | 'cancelled' | 'unknown';

export class UploadError extends Error {
  reason: UploadFailure;
  constructor(reason: UploadFailure) {
    super(reason);
    this.reason = reason;
  }
}

export interface UploadHandle {
  /** Resolves when the whole file is stored. Rejects with UploadError. */
  done: Promise<void>;
  cancel: () => void;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
}

function reasonFromStatus(status: number | undefined): UploadFailure {
  if (status === 413) return 'too_big';
  if (status === 400 || status === 401 || status === 403 || status === 415) return 'denied';
  return status === undefined || status === 0 || status >= 500 || status === 408 || status === 429 ? 'network' : 'unknown';
}

/**
 * Uploads a file to Supabase Storage. Small files go in one request; large files use the resumable (TUS) protocol:
 * progress is reported, dropped connections are retried automatically, and calling startUpload again with the
 * same path continues where it stopped instead of starting over.
 */
export function startUpload({ bucket, path, file, onProgress }: UploadOptions): UploadHandle {
  let cancelled = false;
  let upload: import('tus-js-client').Upload | null = null;

  const done = (async () => {
    if (file.size <= SIMPLE_LIMIT) {
      onProgress?.(0, file.size);
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false, cacheControl: CACHE_SECONDS });
      if (cancelled) throw new UploadError('cancelled');
      if (error) {
        const raw = (error as { statusCode?: string | number }).statusCode;
        const status = raw === undefined ? undefined : Number(raw);
        if (status === 409) { onProgress?.(file.size, file.size); return; } // an earlier attempt already stored it
        throw new UploadError(reasonFromStatus(status));
      }
      onProgress?.(file.size, file.size);
      return;
    }

    const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const freshToken = async (): Promise<string> => (await supabase.auth.getSession()).data.session?.access_token ?? anon;

    const tus = await import('tus-js-client'); // only needed for big files
    await new Promise<void>((resolve, reject) => {
      upload = new tus.Upload(file, {
        endpoint: `${base}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000],
        headers: { apikey: anon, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: CHUNK,
        // Tie "resume" to this exact storage path, so a retry can never continue into a different file name.
        fingerprint: async (f: File) => ['kezzo', bucket, path, f.name, f.size, f.lastModified].join('|'),
        metadata: { bucketName: bucket, objectName: path, contentType: file.type || 'application/octet-stream', cacheControl: CACHE_SECONDS },
        // The sign-in token is refreshed before every request, so a long upload never fails with "expired".
        onBeforeRequest: async (req) => {
          req.setHeader('Authorization', `Bearer ${await freshToken()}`);
        },
        onProgress: (sent, total) => onProgress?.(sent, total),
        onError: (err) => {
          const status = (err as { originalResponse?: { getStatus: () => number } }).originalResponse?.getStatus();
          reject(new UploadError(cancelled ? 'cancelled' : reasonFromStatus(status)));
        },
        onSuccess: () => resolve(),
      });
      // Continue a previous attempt for the same file if one exists.
      upload.findPreviousUploads().then((previous) => {
        if (previous.length && upload) upload.resumeFromPreviousUpload(previous[0]);
        upload?.start();
      }).catch(() => upload?.start());
    });
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      upload?.abort(true).catch(() => undefined);
    },
  };
}
