/** Where an invite code waits while a visitor signs in. Kept outside the Groups page so the app shell stays small. */
export const PENDING_JOIN = 'kezzo.pendingJoin';

/** If someone opened an invite link while signed out, finish joining after they sign in. */
export function pendingInvite(): string | null {
  try { return localStorage.getItem(PENDING_JOIN); } catch { return null; }
}
