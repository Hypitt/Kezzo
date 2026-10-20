import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from '../state/Router';

/**
 * A person's name, handle or picture that opens their profile.
 * `ref` is a user id, or "@handle" (the profile page looks the handle up).
 * Inside a live battle or stream, pass `newTab` so watching (or broadcasting) is never interrupted.
 */
export function ProfileLink({ to, children, className = '', newTab = false, title }: {
  to: string; children: ReactNode; className?: string; newTab?: boolean; title?: string;
}) {
  const { go } = useRouter();
  const href = `#/profile/${to}`; // ids and handles only use letters, digits, _ and -
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation(); // the link may sit inside a clickable card
    if (newTab || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let the browser open a new tab
    e.preventDefault();
    go('profile', to);
  };
  return (
    <a
      href={href}
      onClick={open}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener' : undefined}
      title={title}
      className={`hover:underline ${className}`}
    >
      {children}
    </a>
  );
}

const MENTION = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,20})(?![A-Za-z0-9_])/g;

/** Text with every @handle turned into a link to that person's profile. */
export function RichText({ text, newTab = false, linkClassName = 'font-medium' }: { text: string; newTab?: boolean; linkClassName?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = (m.index ?? 0) + m[1].length; // where the "@" is
    if (start > last) parts.push(text.slice(last, start));
    const handle = m[2].toLowerCase();
    parts.push(
      <ProfileLink key={`${start}-${handle}`} to={`@${handle}`} newTab={newTab} className={linkClassName}>
        @{m[2]}
      </ProfileLink>,
    );
    last = start + 1 + m[2].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
