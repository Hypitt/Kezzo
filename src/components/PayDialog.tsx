import { useEffect, useState, type FormEvent } from 'react';
import { Copy, X } from 'lucide-react';
import { PayMethodCard } from './PayMethodCard';
import { supabase } from '../lib/supabase';
import { copyText } from '../lib/share';
import { ORDERS, orderError } from '../lib/ordersText';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { Spinner } from './ui';

export interface PayTarget { sellerId: string; sellerName: string; listing?: { id: string; title: string; price: number | null; currency: string; quantity: number | null } }
interface Created { id: string; reference: string; amount: number; currency: string; title: string }
export interface PayMethod { id: string; method: string; type: string; account_name: string; account_number: string; instructions: string; is_default: boolean; pay_link: string; qr_data: string }

/** Shows the seller's payment methods for one order, the reference, the safety notice and the "I've paid" button. */
export function PayInstructions({ order, onPaid, onLater }: { order: { id: string; reference: string; amount: number; currency: string; title: string }; onPaid?: () => void; onLater?: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = ORDERS[lang];
  const [methods, setMethods] = useState<PayMethod[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase.rpc('order_payment_methods', { p_order: order.id }).then(({ data }) => setMethods(Array.isArray(data) ? (data as PayMethod[]) : []));
  }, [order.id]);
  const copy = async (s: string) => { await copyText(s); toast(w.copied); };
  const paid = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('order_mark_paid', { p_id: order.id, p_note: note.trim() });
    setBusy(false);
    if (error) return toast(orderError(lang, error.message), 'error');
    toast(w.done);
    onPaid?.();
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3">
        <p className="font-semibold">{order.title} · {order.amount} {order.currency}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-zinc-600">{w.useRef}: <b className="text-base text-zinc-900">{order.reference}</b>
          <button type="button" className="btn btn-ghost !px-2 !py-1" aria-label={w.copy} onClick={() => void copy(order.reference)}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button></p>
      </div>
      <p className="font-medium">{w.payTo}</p>
      {methods === null ? <Spinner /> : methods.length === 0 ? <p className="text-zinc-500">{w.noMethods}</p> : methods.map((m) => <PayMethodCard key={m.id} m={m} />)}
      <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{w.notice}</p>
      {onPaid && (
        <>
          <input className="input" value={note} maxLength={300} placeholder={w.txnNote} aria-label={w.txnNote} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void paid()}>{w.iPaid}</button>
            {onLater && <button type="button" className="btn btn-ghost" onClick={onLater}>{w.later}</button>}
          </div>
        </>
      )}
    </div>
  );
}

/** The Pay / Support me window: asks quantity or amount, creates the order, then shows how to pay. */
export function PayDialog({ target, onClose }: { target: PayTarget; onClose: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const w = ORDERS[lang];
  const l = target.listing;
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [order, setOrder] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc('create_order', { p_seller: target.sellerId, p_listing: l?.id ?? null, p_qty: qty, p_amount: l ? null : Number(amount), p_currency: l ? null : currency.trim().toUpperCase() });
    setBusy(false);
    if (error) return toast(orderError(lang, error.message), 'error');
    setOrder(data as Created);
  };
  const max = l?.quantity ?? 100;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={l ? w.pay : w.support}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 text-zinc-900 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-base font-semibold">{l ? w.pay : w.support} · {target.sellerName}</h2>
          <button type="button" className="btn btn-ghost !px-2" onClick={onClose} aria-label="×"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        {order ? (
          <PayInstructions order={order} onPaid={() => { onClose(); go('orders'); }} onLater={() => { toast(w.orderMade); onClose(); go('orders'); }} />
        ) : (
          <form className="space-y-3" onSubmit={start}>
            {l ? (
              <>
                <p className="text-sm font-medium">{l.title}</p>
                <div><label className="label" htmlFor="pd-qty">{w.qty}</label>
                  <input id="pd-qty" className="input" type="number" min={1} max={max} value={qty} onChange={(e) => setQty(Math.min(max, Math.max(1, Math.floor(Number(e.target.value) || 1))))} /></div>
                {l.price !== null && <p className="text-sm">{w.total}: <b>{Math.round(l.price * qty * 100) / 100} {l.currency}</b></p>}
              </>
            ) : (
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <div><label className="label" htmlFor="pd-amt">{w.supportAmt}</label><input id="pd-amt" className="input" type="number" min={0} step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <div><label className="label" htmlFor="pd-cur">{w.currencyL}</label><input id="pd-cur" className="input" maxLength={8} value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
              </div>
            )}
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{w.notice}</p>
            <button className="btn btn-primary w-full" disabled={busy || (!l && !(Number(amount) > 0))}>{busy ? w.creating : w.start}</button>
          </form>
        )}
      </div>
    </div>
  );
}
