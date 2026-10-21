/** Adds a small Kezzo mark (logo + name) in the bottom-right corner of a picture or video, in the browser. */

export const WATERMARK_MAX_VIDEO_SECONDS = 180;

const K1 = new Path2D('M253,92 192,93 193,354 253,307zM442,206 291,324 291,391 412,524 489,525 354,360 486,207z');

/** Draws the mark on a canvas of size w x h. */
export function drawMark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const base = Math.max(14, Math.min(w, h) * 0.04); // text size
  const logoH = base * 1.5;
  const k = logoH / 448; // logo viewBox is 316 x 448
  const logoW = 316 * k;
  const gap = base * 0.45;
  const padX = base * 0.7;
  const padY = base * 0.45;
  ctx.save();
  ctx.font = `700 ${base}px "Helvetica Neue", Roboto, Arial, sans-serif`;
  const textW = ctx.measureText('Kezzo').width;
  const boxW = padX * 2 + logoW + gap + textW;
  const boxH = padY * 2 + logoH;
  const margin = base * 0.9;
  const x = w - margin - boxW;
  const y = h - margin - boxH;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, boxH * 0.3);
  ctx.fill();
  // logo
  ctx.translate(x + padX, y + padY);
  ctx.scale(k, k);
  ctx.translate(-180, -86);
  ctx.fillStyle = '#ffffff';
  ctx.fill(K1);
  ctx.fillStyle = '#fa6b05';
  ctx.beginPath();
  ctx.arc(223, 488, 38.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // name
  ctx.save();
  ctx.font = `700 ${base}px "Helvetica Neue", Roboto, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText('Kezzo', x + padX + logoW + gap, y + boxH / 2 + base * 0.04);
  ctx.restore();
}

const slug = (s: string) => (s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'kezzo').slice(0, 40);

export async function watermarkPhoto(url: string, name: string, index = 0): Promise<File> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('fetch');
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
