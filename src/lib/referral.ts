/** Invite & Earn: where a friend's code waits while they sign up, and the link people share. */
export const PENDING_REF = 'kezzo.pendingRef';

/** Remember ?ref=CODE from the address (kept until the new member has an account). */
export function captureRef(): void {
  try {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code && /^[a-zA-Z0-9_]{3,20}$/.test(code)) localStorage.setItem(PENDING_REF, code.toLowerCase());
  } catch { /* storage blocked: the code can still be typed by hand */ }
}
export function pendingRef(): string | null {
  try { return localStorage.getItem(PENDING_REF); } catch { return null; }
}
export function clearRef(): void {
  try { localStorage.removeItem(PENDING_REF); } catch { /* ignore */ }
}
export const referralLink = (code: string): string => `${window.location.origin}/r/${code}`;
export const usd = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
