import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { REVIEWS, reviewError } from '../lib/reviewText';
import { useI18n } from '../state/I18n';

/** Five small stars, filled up to `value`. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} width={size} height={size} aria-hidden="true" className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'} />)}
    </span>
  );
}

interface Rev { id: string; rating: number; comment: string; created_at: string; reviewer: string }

/** On a profile: the average rating and, on tap, the latest reviews. Shows nothing until there is a review. */
export function SellerReviews({ sellerId }: { sellerId: string }) {
  const { lang } = useI18n();
  const w = REVIEWS[lang];
  const [list, setList] = useState<Rev[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void supabase.rpc('seller_reviews', { p_seller: sellerId, p_limit: 20 }).then(({ data }) => setList(Array.isArray(data) ? (data as Rev[]) : []));
  }, [sellerId]);
  if (!list || list.length === 0) return null;
  const avg = list.reduce((a, r) => a + r.rating, 0) / list.length;
  return (
    <div className="pt-2 text-sm">
      <button type="button" className="inline-flex items-center gap-2 hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Stars value={avg} /><b>{avg.toFixed(1)}</b><span className="text-zinc-500">({list.length})</span>
        <span className="text-xs font-semibold text-accent">{open ? w.hide : w.show}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {list.map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-300 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-zinc-500">{r.reviewer} · {new Date(r.created_at).toLocaleDateString(lang)}</span></div>
              {r.comment && <p className="mt-1 break-words text-sm text-zinc-700">{r.comment}</p>}
              <p className="mt-1 text-[11px] text-zinc-400">{w.confirmed}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** In the buyer's order list: pick 1–5 stars, add a few words, send. */
export function ReviewForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const { lang } = useI18n();
  const w = REVIEWS[lang];
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    if (!rating) return;
    setBusy(true);
    const { error } = await supabase.rpc('review_order', { p_order: orderId, p_rating: rating, p_comment: comment.trim() });
    setBusy(false);
    if (error) return setMsg(reviewError(lang, error.message));
    onDone();
  };
  return (
    <div className="space-y-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3">
      <p className="text-xs font-medium text-zinc-600">{w.rate}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" aria-label={`${i} / 5`} aria-pressed={rating === i} onClick={() => setRating(i)} className="rounded p-0.5">
            <Star width={26} height={26} aria-hidden="true" className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'} />
          </button>
        ))}
      </div>
      <input className="input" value={comment} maxLength={300} placeholder={w.commentPh} aria-label={w.commentPh} onChange={(e) => setComment(e.target.value)} />
      {msg && <p className="text-xs text-red-700">{msg}</p>}
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || !rating} onClick={() => void send()}>{w.send}</button>
    </div>
  );
}
