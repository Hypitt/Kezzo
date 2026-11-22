import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { copyText } from '../lib/share';
import { PREMIUM } from '../lib/premiumText';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Loading, PageHeader } from '../components/ui';

interface MyPlan { plan: 'free' | 'premium'; status: 'active' | 'grace' | 'free' | 'expired' | 'suspended'; expires_at: string | null; grace_until: string | null; limits: Record<string, number> }
interface Price { id: string; country: string; currency: string; duration: 'week' | 'month' | 'quarter'; amount: number }
interface Account { id: string; country: string; method: string; account_name: string; account_number: string; instructions: string }
interface Pay { id: string; country: string; duration: string; currency: string; amount: number; reference: string; status: 'pending' | 'approved' | 'rejected'; reason: string; created_at: string }
interface Limit { plan: string; key: string; value: number }

const LIMIT_ORDER = ['listings', 'payment_methods', 'live_rooms_month', 'live_minutes', 'vsla_groups', 'vsla_members', 'featured_month', 'export'];

/** Premium: what each plan includes, the person's status, and the manual subscription form. */
export function PremiumView() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = PREMIUM[lang];
  const [me, setMe] = useState<MyPlan | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [country, setCountry] = useState('');
  const [duration, setDuration] = useState('month');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, p, a, l, h] = await Promise.all([
      supabase.rpc('my_plan'),
      supabase.from('plan_prices').select('id, country, currency, duration, amount').eq('active', true).order('country'),
      supabase.from('collection_accounts').select('id, country, method, account_name, account_number, instructions').eq('active', true),
      supabase.from('plan_limits').select('plan, key, value'),
      supabase.from('subscription_payments').select('id, country, duration, currency, amount, reference, status, reason, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    setMe((m.data as MyPlan | null) ?? { plan: 'free', status: 'free', expires_at: null, grace_until: null, limits: {} });
    setPrices((p.data as Price[] | null) ?? []);
    setAccounts((a.data as Account[] | null) ?? []);
    setLimits((l.data as Limit[] | null) ?? []);
    setPays((h.data as Pay[] | null) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const countries = useMemo(() => Array.from(new Set(prices.map((p) => p.country))), [prices]);
  const price = prices.find((p) => p.country === country && p.duration === duration);
  const durations = prices.filter((p) => p.country === country).map((p) => p.duration);
  const accts = accounts.filter((a) => a.country.toLowerCase() === country.toLowerCase());
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(lang) : '');

  if (!me) return <Loading />;
  const lim = (plan: string, key: string) => limits.find((x) => x.plan === plan && x.key === key)?.value;
  const show = (key: string, v: number | undefined) => (v === undefined ? '–' : key === 'export' ? (v ? w.yes : w.no) : key === 'listings' && v >= 500 ? w.unlimited : String(v));
  const status = me.status === 'active' ? w.statusActive(date(me.expires_at)) : me.status === 'grace' ? w.statusGrace(date(me.grace_until)) : me.status === 'suspended' ? w.statusSuspended : me.status === 'expired' ? w.statusExpired : w.statusFree;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!price || !ref.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_premium', { p_country: country, p_duration: duration, p_reference: ref.trim(), p_note: note.trim() });
    setBusy(false);
    if (error) return toast(w.err, 'error');
    toast(w.results[String(data)] ?? w.err, data === 'ok' ? 'info' : 'error');
    if (data === 'ok') { setRef(''); setNote(''); void load(); }
  };
  const cancel = async (id: string) => {
    const { error } = await supabase.rpc('cancel_premium_submission', { p_id: id });
    toast(error ? w.err : w.done, error ? 'error' : 'info');
    void load();
  };
  const copy = async (s: string) => { await copyText(s); toast(w.copied); };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={w.title} sub={w.sub} />
      <div className={`card flex items-start gap-3 ${me.plan === 'premium' ? 'border-accent/50 bg-accent/5' : ''}`}>
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-sm font-medium">{status}</p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">{w.feature}</th><th className="p-2">{w.free}</th><th className="p-2">{w.premium}</th></tr></thead>
          <tbody>{w.rows.map(([f, a, b]) => <tr key={f}><td className="p-2">{f}</td><td className="p-2 text-zinc-600">{a}</td><td className="p-2 font-medium">{b}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <h2 className="px-3 pt-3 text-sm font-semibold">{w.limitsT}</h2>
        <table className="mt-1 w-full text-left text-sm">
          <thead><tr><th className="p-2" /><th className="p-2">{w.free}</th><th className="p-2">{w.premium}</th></tr></thead>
          <tbody>{LIMIT_ORDER.map((k) => <tr key={k}><td className="p-2">{w.limitNames[k]}</td><td className="p-2 text-zinc-600">{show(k, lim('free', k))}</td><td className="p-2 font-medium">{show(k, lim('premium', k))}</td></tr>)}</tbody>
        </table>
      </div>

      <form className="card space-y-3" onSubmit={submit}>
        <h2 className="text-sm font-semibold">{w.howT}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">{w.how.map((s) => <li key={s}>{s}</li>)}</ol>
        {countries.length === 0 ? <p className="text-sm text-zinc-500">{w.noPrices}</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="pm-country">{w.country}</label>
                <select id="pm-country" className="input" value={country} onChange={(e) => { setCountry(e.target.value); setDuration('month'); }}>
                  <option value="">{w.pickCountry}</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="label" htmlFor="pm-dur">{w.duration}</label>
                <select id="pm-dur" className="input" value={duration} disabled={!country} onChange={(e) => setDuration(e.target.value)}>
                  {(['week', 'month', 'quarter'] as const).filter((d) => durations.includes(d)).map((d) => <option key={d} value={d}>{w.durations[d]}</option>)}
                </select></div>
            </div>
            {price && (
              <div className="space-y-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm">
                <p><span className="text-zinc-500">{w.price}: </span><b>{price.amount} {price.currency}</b></p>
                {accts.length === 0 ? <p className="text-zinc-500">{w.noAccounts}</p> : accts.map((a) => (
                  <div key={a.id} className="rounded-md border border-zinc-300 bg-white p-2">
                    <p className="font-medium">{w.payTo}: {a.method}</p>
                    {a.account_name && <p className="text-xs text-zinc-600">{w.accName}: {a.account_name}</p>}
                    {a.account_number && <p className="flex items-center gap-2 text-xs text-zinc-600">{w.accNumber}: <b className="text-sm text-zinc-900">{a.account_number}</b>
                      <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => void copy(a.account_number)} aria-label={w.copy}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button></p>}
                    {a.instructions && <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">{a.instructions}</p>}
                  </div>
                ))}
              </div>
            )}
            <div><label className="label" htmlFor="pm-ref">{w.refL}</label><input id="pm-ref" className="input" value={ref} maxLength={80} minLength={3} placeholder={w.refPh} onChange={(e) => setRef(e.target.value)} /></div>
            <div><label className="label" htmlFor="pm-note">{w.noteL}</label><input id="pm-note" className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></div>
            <button className="btn btn-primary w-full" disabled={busy || !price || ref.trim().length < 3}>{busy ? w.sending : w.send}</button>
          </>
        )}
        <p className="text-xs text-zinc-500">{w.notice}</p>
      </form>

      {pays.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold">{w.historyT}</h2>
          {pays.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-2 text-sm first:border-0 first:pt-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.amount} {p.currency} · {w.durations[p.duration] ?? p.duration}</p>
                <p className="truncate text-xs text-zinc-500">{p.reference} · {date(p.created_at)}{p.status === 'rejected' && p.reason ? ` · ${w.reason}: ${p.reason}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : p.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{p.status === 'approved' && <Check className="h-3 w-3" aria-hidden="true" />}{w.statuses[p.status]}</span>
                {p.status === 'pending' && <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => void cancel(p.id)}>{w.cancel}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
