/** Turns a QR-code picture chosen by the person into a small data URL (max 480 px) that is stored with the payment method. */
export async function qrFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not_image');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let out = canvas.toDataURL('image/png');
  if (out.length > 150000) out = canvas.toDataURL('image/jpeg', 0.9);
  if (out.length > 190000) throw new Error('too_big');
  return out;
}
