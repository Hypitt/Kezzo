/**
 * Minimal client-side filter for the worst content. It is NOT a substitute for moderation:
 * users can bypass it, so reports (Report button) and blocks are the real safety tools.
 */
const BLOCKED: RegExp[] = [
  /\bkill\s+yourself\b/i,
  /\bkys\b/i,
  /\bcsam\b/i,
  /\bchild\s+porn/i,
  /\b(rape|raping)\s+(you|her|him|them)\b/i,
];

export function isSafe(text: string): boolean {
  return !BLOCKED.some((re) => re.test(text));
}
