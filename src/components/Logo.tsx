/**
 * The Kezzo logo, exactly as supplied (public/logo.png). The picture has a lot of empty white space around the artwork,
 * so only the part with the artwork is shown (the file itself is not changed). Give the height with a class, for example "h-8".
 * The logo has a white background: on a dark bar, put it on a white chip.
 */
export function Logo({ className = 'h-8' }: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden ${className}`} style={{ aspectRatio: '1501 / 697' }} role="img" aria-label="Kezzo">
      <img
        src="/logo.png" alt="" width={800} height={800} decoding="async"
        style={{ position: 'absolute', left: '-21.12%', top: '-68.72%', width: '133.24%', maxWidth: 'none', height: 'auto' }}
      />
    </span>
  );
}
