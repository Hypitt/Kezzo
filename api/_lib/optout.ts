import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signed links so an email can switch itself off with one click, without signing in. The secret never leaves the server. */
function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return key;
}

export function optOutSignature(userId: string): string {
  return createHmac('sha256', secret()).update(`email-optout:${userId}`).digest('hex');
}

export function validOptOut(userId: string, signature: string): boolean {
  const expected = Buffer.from(optOutSignature(userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
