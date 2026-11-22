import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ORDERS, orderError } from '../lib/ordersText';
import { PREMIUM } from '../lib/premiumText';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { PayInstructions } from '../components/PayDialog';
import { Chip, Loading, PageHeader } from '../components/ui';

interface Order { id: string; reference: string; role: 'buyer' | 'seller'; other_name: string; other_handle: string; seller_id: string; title: string; quantity: number; amount: number; currency: string; status: string; buyer_note: string; cancel_reason: string; created_at: string }
interface Method { id: string; country: string; method: string; type: string; account_name: string; account_number: string; instructions: string; enabled: boolean; is_default: boolean }
interface Provider { id: string; country: string; name: string; type: string }

const CHIP: Record<string, string> = { awaiting_payment: 'bg-amber-100 text-amber-800', marked_paid: 'bg-sky-100 text-sky-800', confirmed: 'bg-emerald-100 text-emerald-800', disputed: 'bg-red-100 text-red-800', preparing: 'bg-indigo-100 text-indigo-800', completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-zinc-200 text-zinc-700' };

/** Orders & payments: purchases, sales (with the seller's confirm / not-received buttons) and the seller's payment methods. */
export function OrdersView() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const w = ORDERS[lang];
  const [tab, setTab] = useState<'buy' | 'sell' | 'methods'>('buy');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [premium, setPremium] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ country: '', provider: '', type: 'mobile_money', account_name: '', account_number: '', instructions: '' });

  const load = useCallback(async () => {
    const [o, m, p, me] = await Promise.all([
      supabase.rpc('orders_mine'),
      supabase.from('user_payment_methods').select('id, country, method, type, account_name, account_number, instructions, enabled, is_default').order('created_at'),
      supabase.from('payment_providers').select('id, country, name, type').eq('enabled', true).order('sort'),
      supabase.rpc('my_plan'),
    ]);
    setOrders(Array.isArray(o.data) ? (o.data as Order[]) : []);
    setMethods((m.data as Method[] | null) ?? []);
    setProviders((p.data as Provider[] | null) ?? []);
    setPremium((me.data as { plan?: string } | null)?.plan === 'premium');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await q;
    toast(error ? orderError(lang, error.message) : w.done, error ? 'error' : 'info');
    void load();
  };
  const countries = useMemo(() => Array.from(new Set(providers.map((x) => x.country))), [providers]);
  const addMethod = async (e: FormEvent) => {
    e.preventDefault();
    const prov = providers.find((x) => x.country === form.country && x.name === form.provider);
    const name = prov ? prov.name : form.provider.trim();
    if (!form.country.trim() || !name) return;
    await run(supabase.from('user_payment_methods').insert({ country: form.country.trim(), method: name, type: prov ? prov.type : form.type, account_name: form.account_name.trim(), account_number: form.account_number.trim(), instructions: form.instructions.trim() }));
    setForm({ ...form, account_number: '', instructions: '' });
  };
  const askCancel = (o: Order) => {
    const reason = o.role === 'seller' ? (window.prompt(w.actions.cancelAsk) ?? '') : '';
    if (o.role === 'seller' && reason.trim().length < 2) return;
    void run(supabase.rpc('order_cancel', { p_id: o.id, p_reason: reason }));
  };

  if (!orders) return <Loading />;
  const list = orders.filter((o) => o.role === (tab === 'sell' ? 'seller' : 'buyer'));
  const provNames = providers.filter((x) => x.country === form.country);
  const date = (s: string) => new Date(s).toLocaleDateString(lang);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={w.title} sub={w.sub} />
      <div className="flex flex-wrap gap-2">
        <Chip active={tab === 'buy'} onClick={() => setTab('buy')}>{w.tabBuy}</Chip>
        <Chip active={tab === 'sell'} onClick={() => setTab('sell')}>{w.tabSell}</Chip>
        <Chip active={tab === 'methods'} onClick={() => setTab('methods')}>{w.tabMethods}</Chip>
      </div>

      {tab !== 'methods' && (
        <div className="space-y-2">
          {list.length === 0 && <p className="text-sm text-zinc-500">{w.noOrders}</p>}
          {list.map((o) => (
            <div key={o.id} className="card space-y-2 text-sm text-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-semibold">{o.title}{o.quantity > 1 ? ` ×${o.quantity}` : ''}</p>
                  <p className="text-xs text-zinc-500">{o.role === 'buyer' ? w.from : w.to}: {o.other_name} · {w.ref} {o.reference} · {date(o.created_at)}</p></div>
                <div className="text-right"><p className="font-bold">{o.amount} {o.currency}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[o.status] ?? ''}`}>{w.statuses[o.status]}</span></div>
              </div>
              {o.buyer_note && <p className="text-xs text-zinc-600">“{o.buyer_note}”</p>}
              {o.cancel_reason && <p className="text-xs text-red-700">{o.cancel_reason}</p>}
              <div className="flex flex-wrap gap-2">
                {o.role === 'buyer' && o.status === 'awaiting_payment' && <button className="btn btn-primary btn-sm" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? w.actions.hidePay : w.actions.showPay}</button>}
                {o.role === 'seller' && ['awaiting_payment', 'marked_paid', 'disputed'].includes(o.status) && <button className="btn btn-primary btn-sm" onClick={() => void run(supabase.rpc('order_seller_step', { p_id: o.id, p_to: 'confirmed' }))}>{w.actions.confirm}</button>}
                {o.role === 'seller' && o.status === 'marked_paid' && <button className="btn btn-ghost btn-sm" onClick={() => void run(supabase.rpc('order_seller_step', { p_id: o.id, p_to: 'disputed' }))}>{w.actions.notReceived}</button>}
                {o.role === 'seller' && o.status === 'confirmed' && <button className="btn btn-primary btn-sm" onClick={() => void run(supabase.rpc('order_seller_step', { p_id: o.id, p_to: 'preparing' }))}>{w.actions.prepare}</button>}
                {o.role === 'seller' && o.status === 'preparing' && <button className="btn btn-primary btn-sm" onClick={() => void run(supabase.rpc('order_seller_step', { p_id: o.id, p_to: 'completed' }))}>{w.actions.complete}</button>}
                {!['completed', 'cancelled'].includes(o.status) && (o.role === 'seller' || o.status === 'awaiting_payment') && <button className="btn btn-ghost btn-sm" onClick={() => askCancel(o)}>{w.actions.cancel}</button>}
              </div>
              {open === o.id && <PayInstructions order={o} onPaid={() => { setOpen(null); void load(); }} />}
            </div>
          ))}
        </div>
      )}

      {tab === 'methods' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-600">{w.methodsHelp}</p>
          {!premium && (
            <div className="card flex flex-wrap items-center justify-between gap-2 border-accent/40 bg-accent/5 text-sm">
              <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-accent" aria-hidden="true" />{w.premiumNeeded}</span>
              <button className="btn btn-primary btn-sm" onClick={() => go('premium')}>{PREMIUM[lang].nav} · {w.goPremium}</button>
            </div>
          )}
          {methods.length === 0 && <p className="text-sm text-zinc-500">{w.none}</p>}
          {methods.map((m) => (
            <div key={m.id} className="card space-y-1 text-sm text-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{m.method} <span className="text-xs font-normal text-zinc-500">{m.country} · {w.types[m.type]}</span></p>
                <span className="text-xs text-zinc-500">{m.enabled ? w.on : w.off}{m.is_default ? ` · ${w.isDefault}` : ''}</span>
              </div>
              <p className="break-all text-xs text-zinc-600">{m.account_name} {m.account_number}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn btn-ghost btn-sm" onClick={() => void run(supabase.from('user_payment_methods').update({ enabled: !m.enabled }).eq('id', m.id))}>{m.enabled ? w.off : w.on}</button>
                {!m.is_default && <button className="btn btn-ghost btn-sm" onClick={() => void run(supabase.rpc('set_default_method', { p_id: m.id }))}>{w.makeDefault}</button>}
                <button className="btn btn-ghost btn-sm text-red-600" onClick={() => void run(supabase.from('user_payment_methods').delete().eq('id', m.id))}>{w.del}</button>
              </div>
            </div>
          ))}
          {premium && (
            <form className="card space-y-2" onSubmit={addMethod}>
              <h2 className="text-sm font-semibold">{w.addT}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label className="label" htmlFor="pm-c">{w.country}</label>
                  <input id="pm-c" className="input" list="pm-countries" value={form.country} maxLength={60} onChange={(e) => setForm({ ...form, country: e.target.value, provider: '' })} placeholder={w.pickCountry} />
                  <datalist id="pm-countries">{countries.map((c) => <option key={c} value={c} />)}</datalist></div>
                <div><label className="label" htmlFor="pm-m">{w.method}</label>
                  <input id="pm-m" className="input" list="pm-provs" value={form.provider} maxLength={40} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder={w.other} />
                  <datalist id="pm-provs">{provNames.map((x) => <option key={x.id} value={x.name} />)}</datalist></div>
              </div>
              {!provNames.some((x) => x.name === form.provider) && (
                <select className="input" aria-label={w.type} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {(['mobile_money', 'bank', 'other'] as const).map((k) => <option key={k} value={k}>{w.types[k]}</option>)}
                </select>
              )}
              <input className="input" placeholder={w.accNameL} aria-label={w.accNameL} maxLength={80} value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
              <input className="input" placeholder={w.accNumberL} aria-label={w.accNumberL} maxLength={80} value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
              <textarea className="input" rows={2} placeholder={w.instrL} aria-label={w.instrL} maxLength={500} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
              <button className="btn btn-primary w-full">{w.add}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
