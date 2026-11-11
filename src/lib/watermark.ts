/** Adds the Kezzo logo in the bottom-right corner of a picture or video, in the browser. */

export const WATERMARK_MAX_VIDEO_SECONDS = 180;

// The Kezzo logo exactly as supplied (public/logo.png); only the artwork area of the picture is drawn.
let logoImg: HTMLImageElement | null = null;
const CROP = { x: 317 / 2000, y: 479 / 2000, w: 1501 / 2000, h: 697 / 2000 };

/** Loads the logo once. Call (and wait for) this before drawing a mark. */
export async function loadLogo(): Promise<void> {
  if (logoImg) return;
  const img = new Image();
  img.src = '/logo.png';
  await img.decode();
  logoImg = img;
}

/** Draws the logo on a white rounded plate in the bottom-right corner of a canvas of size w x h. */
export function drawMark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!logoImg) return;
  const boxH = Math.max(36, Math.min(w, h) * 0.09);
  const boxW = boxH * (CROP.w / CROP.h);
  const margin = boxH * 0.4;
  const x = w - margin - boxW;
  const y = h - margin - boxH;
  const n = logoImg.naturalWidth;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, boxH * 0.12);
  ctx.fill();
  ctx.drawImage(logoImg, CROP.x * n, CROP.y * n, CROP.w * n, CROP.h * n, x, y, boxW, boxH);
  ctx.restore();
}

const slug = (s: string) => (s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'kezzo').slice(0, 40);

export async function watermarkPhoto(url: string, name: string, index = 0): Promise<File> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('fetch');
  await loadLogo();
  const bitmap = await createImageBitmap(await res.blob());
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  drawMark(ctx, w, h);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9));
  if (!blob) throw new Error('encode');
  return new File([blob], `kezzo-${slug(name)}-${index + 1}.jpg`, { type: 'image/jpeg' });
}

function recorderType(): string {
  const options = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
}

/** Re-records the video with the mark. It plays in real time, so a 60 s video takes about 60 s. */
export async function watermarkVideo(url: string, name: string, onProgress: (ratio: number) => void, cancelled: () => boolean): Promise<File> {
  const type = recorderType();
  if (!type || typeof HTMLCanvasElement.prototype.captureStream !== 'function') throw new Error('unsupported');
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('fetch');
  await loadLogo();
  const objectUrl = URL.createObjectURL(await res.blob());
  const video = document.createElement('video');
  video.src = objectUrl;
  video.playsInline = true;
  video.preload = 'auto';
  let audioCtx: AudioContext | null = null;
  try {
    await new Promise<void>((ok, bad) => { video.onloadedmetadata = () => ok(); video.onerror = () => bad(new Error('video')); });
    if (video.duration > WATERMARK_MAX_VIDEO_SECONDS) throw new Error('too_long');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale) & ~1;
    const h = Math.round(video.videoHeight * scale) & ~1;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');

    const out = canvas.captureStream(30);
    // The sound goes straight into the recording, not to the speakers.
    try {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaElementSource(video).connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => out.addTrack(tr));
    } catch { /* no sound track: continue silently */ }

    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(out, { mimeType: type, videoBitsPerSecond: 2_500_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((ok) => { rec.onstop = () => ok(); });

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h);
      drawMark(ctx, w, h);
      onProgress(Math.min(1, video.currentTime / video.duration));
      if (cancelled()) { video.pause(); rec.stop(); return; }
      if (!video.ended) raf = requestAnimationFrame(draw);
    };
    rec.start(500);
    await video.play();
    draw();
    await new Promise<void>((ok) => { video.onended = () => ok(); const t = setInterval(() => { if (cancelled()) { clearInterval(t); ok(); } }, 300); video.addEventListener('ended', () => clearInterval(t)); });
    cancelAnimationFrame(raf);
    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    if (cancelled()) throw new Error('cancelled');
    const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
    return new File(chunks, `kezzo-${slug(name)}.${ext}`, { type: type.split(';')[0] });
  } finally {
    video.pause();
    URL.revokeObjectURL(objectUrl);
    void audioCtx?.close();
  }
}
