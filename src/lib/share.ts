export type ShareType = 'post' | 'profile' | 'battle' | 'live' | 'group' | 'event' | 'poll' | 'opportunity';

/** The link people paste elsewhere. It shows the Kezzo name and a preview picture, then opens the right page in Kezzo. */
export function shareUrl(type: ShareType, id: string): string {
  return `${window.location.origin}/s/${type}/${id}`;
}

export interface ShareTarget { key: 'whatsapp' | 'facebook' | 'x'; href: (url: string, text: string) => string }

/** Apps that accept a ready-made link. TikTok and Instagram have no such link, so they are handled by copying. */
export const WEB_TARGETS: ShareTarget[] = [
  { key: 'whatsapp', href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { key: 'facebook', href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { key: 'x', href: (url, text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
];

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
