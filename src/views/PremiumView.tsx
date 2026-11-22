import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Crown, HandCoins, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PREMIUM } from '../lib/premiumText';
import { GUIDE } from '../lib/premiumGuideText';
import { SAFE, isSensitiveError } from '../lib/safeText';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { PayMethodCard } from '../components/PayMethodCard';
import { Loading, PageHeader } from '../components/ui';

interface MyPlan { plan: 'free' | 'premium'; status: 'active' | 'grace' | 'free' | 'expired' | 'suspended'; expires_at: string | null; grace_until: string | null; limits: Record<string, number> }
interface Price { id: string; country: string; currency: string; duration: 'week' | 'month' | 'quarter'; amount: number }
interface Account { id: string; country: string; method: string; account_name: string; account_number: string; instructions: string; pay_link: string; qr_data: string }
interface Pay { id: string; country: string; duration: string; currency: string; amount: number; reference: string; status: 'pending' | 'approved' | 'rejected'; reason: string; created_at: string }
interface Limit { plan: string; key: string; value: number }

const LIMIT_ORDER = ['listings', 'payment_methods', 'live_rooms_month', 'live_minutes', 'vsla_groups', 'vsla_members', 'featured_month', 'export'];

function Step({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children?: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-white'}`}>{done ? <Check className="h-4 w-4" aria-hidden="true" /> : n}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div><h3 className="text-sm font-semibold">{title}</h3>{hint && <p className="text-xs text-zinc-500">{hint}</p>}</div>
        {children}
      </div>
    </section>
  );
}

/** Premium: one clear page. Status and the main button on top, then three steps to subscribe, then (once Premium) how to get paid. */
export function PremiumView() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const w = PREMIUM[lang];
  const g = GUIDE[lang];
  const formRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<MyPlan | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [country, setCountry] = useState('');
  const [duration, setDuration] = useState('');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, p, l, h] = await Promise.all([
      supabase.rpc('my_plan'),
      supabase.from('plan_prices').select('id, country, currency, duration, amount').eq('active', true).order('country'),
      supabase.from('plan_limits').select('plan, key, value'),
      supabase.from('subscription_payments').select('id, country, duration, currency, amount, reference, status, reason, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    setMe((m.data as MyPlan | null) ?? { plan: 'free', status: 'free', expires_at: null, grace_until: null, limits: {} });
    setPrices((p.data as Price[] | null) ?? []);
    setLimits((l.data as Limit[] | null) ?? []);
    setPays((h.data as Pay[] | null) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const countries = useMemo(() => Array.from(new Set(prices.map((p) => p.country))), [prices]);
  useEffect(() => {
    if (!country) { setAccounts([]); return; }
    void supabase.rpc('kezzo_pay_methods', { p_country: country }).then(({ data }) => setAccounts(Array.isArray(data) ? (data as Account[]) : []));
  }, [country]);
  const forCountry = prices.filter((p) => p.country === country);
  const price = prices.find((p) => p.country === country && p.duration === duration);
  const accts = accounts;
  const waiting = pays.find((p) => p.status === 'pending');
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(lang) : '');

  if (!me) return <Loading />;
  const isPremium = me.plan === 'premium';
  const lim = (plan: string, key: string) => limits.find((x) => x.plan === plan && x.key === key)?.value;
  const show = (key: string, v: number | undefined) => (v === undefined ? '–' : key === 'export' ? (v ? w.yes : w.no) : key === 'listings' && v >= 500 ? w.unlimited : String(v));
  const status = me.status === 'active' ? w.statusActive(date(me.expires_at)) : me.status === 'grace' ? w.statusGrace(date(me.grace_until)) : me.status === 'suspended' ? w.statusSuspended : me.status === 'expired' ? w.statusExpired : w.statusFree;
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const pickCountry = (c: string) => { setCountry(c); setDuration(prices.find((p) => p.country === c && p.duration === 'month')?.duration ?? prices.find((p) => p.country === c)?.duration ?? ''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!price || ref.trim().length < 3) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_premium', { p_country: country, p_duration: duration, p_reference: ref.trim(), p_note: note.trim() });
    setBusy(false);
    if (error) return toast(isSensitiveError(error.message) ? SAFE[lang].sensitive : w.err, 'error');
    toast(w.results[String(data)] ?? w.err, data === 'ok' ? 'info' : 'error');
    if (data === 'ok') { setRef(''); setNote(''); void load(); }
  };
  const cancel = async (id: string) => {
    const { error } = await supabase.rpc('cancel_premium_submission', { p_id: id });
    toast(error ? w.err : w.done, error ? 'error' : 'info');
    void load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={w.title} sub={w.sub} />

      <div className={`card space-y-3 ${isPremium ? 'border-accent/50 bg-accent/5' : ''}`}>
        <div className="flex items-start gap-3"><Crown className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><p className="text-sm font-medium">{status}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={scrollToForm}>{isPremium ? g.renew : g.subscribe}</button>
          {isPremium && <button type="button" className="btn btn-ghost" onClick={() => go('orders', 'methods')}><HandCoins className="h-4 w-4" aria-hidden="true" />{g.getPaidCta}</button>}
          <button type="button" className="btn btn-ghost" onClick={() => go('orders')}><Receipt className="h-4 w-4" aria-hidden="true" />{g.ordersCta}</button>
        </div>
      </div>

      {isPremium && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><h2 className="text-sm font-semibold">{g.getPaidT}</h2><p className="text-xs text-zinc-500">{g.getPaidH}</p></div>
          <button type="button" className="btn btn-accent btn-sm" onClick={() => go('orders', 'methods')}>{g.getPaidCta}</button>
        </div>
      )}

      {!isPremium && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold">{g.whyT}</h2>
          <ul className="space-y-1.5 text-sm text-zinc-700">{g.why.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span>{t}</span></li>)}</ul>
        </div>
      )}

      <div ref={formRef} className="card space-y-5 scroll-mt-20">
        <h2 className="text-base font-semibold">{isPremium ? g.renew : g.subscribe}</h2>
        {countries.length === 0 ? <p className="text-sm text-zinc-500">{w.noPrices}</p> : waiting ? (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">{w.results.pending}</p>
            <p className="text-xs">{waiting.amount} {waiting.currency} · {w.durations[waiting.duration]} · {waiting.reference}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void cancel(waiting.id)}>{w.cancel}</button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            <Step n={1} title={g.step1T} hint={g.step1H} done={Boolean(price)}>
              <select className="input" aria-label={w.country} value={country} onChange={(e) => pickCountry(e.target.value)}>
                <option value="">{w.pickCountry}</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {country && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {forCountry.map((p) => (
                    <button key={p.id} type="button" aria-pressed={duration === p.duration} onClick={() => setDuration(p.duration)}
                      className={`rounded-lg border p-2.5 text-left text-sm transition ${duration === p.duration ? 'border-accent bg-accent/10' : 'border-zinc-300 bg-white hover:bg-zinc-50'}`}>
                      <span className="block text-xs text-zinc-500">{w.durations[p.duration]}</span><b>{p.amount} {p.currency}</b>
                    </button>
                  ))}
                </div>
              )}
            </Step>

            <Step n={2} title={g.step2T} hint={g.step2H} done={false}>
              {!price ? <p className="text-xs text-zinc-500">{g.pickFirst}</p> : (
                <div className="space-y-2">
                  <p className="text-sm">{w.price}: <b className="text-base">{price.amount} {price.currency}</b></p>
                  {accts.length === 0 ? <p className="text-sm text-zinc-500">{w.noAccounts}</p> : accts.map((a) => <PayMethodCard key={a.id} m={a} />)}
                </div>
              )}
            </Step>

            <Step n={3} title={g.step3T} hint={g.step3H}>
              <p className="text-xs text-amber-800">{SAFE[lang].warn}</p>
              <input className="input" value={ref} maxLength={80} placeholder={w.refPh} aria-label={w.refL} disabled={!price} onChange={(e) => setRef(e.target.value)} />
              <input className="input" value={note} maxLength={300} placeholder={w.noteL} aria-label={w.noteL} disabled={!price} onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-primary w-full" disabled={busy || !price || ref.trim().length < 3}>{busy ? w.sending : w.send}</button>
            </Step>
          </form>
        )}
        <p className="text-xs text-zinc-500">{w.notice}</p>
      </div>

      {pays.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold">{w.historyT}</h2>
          {pays.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-2 text-sm first:border-0 first:pt-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.amount} {p.currency} · {w.durations[p.duration] ?? p.duration}</p>
                <p className="truncate text-xs text-zinc-500">{p.reference} · {date(p.created_at)}{p.status === 'rejected' && p.reason ? ` · ${w.reason}: ${p.reason}` : ''}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : p.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{p.status === 'approved' && <Check className="h-3 w-3" aria-hidden="true" />}{w.statuses[p.status]}</span>
            </div>
          ))}
        </div>
      )}

      <details className="card group p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm font-semibold">{g.moreT}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="space-y-3 overflow-x-auto px-3 pb-3">
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-2">{w.feature}</th><th className="p-2">{w.free}</th><th className="p-2">{w.premium}</th></tr></thead>
            <tbody>{w.rows.map(([f, a, b]) => <tr key={f}><td className="p-2">{f}</td><td className="p-2 text-zinc-600">{a}</td><td className="p-2 font-medium">{b}</td></tr>)}</tbody>
          </table>
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-2">{w.limitsT}</th><th className="p-2">{w.free}</th><th className="p-2">{w.premium}</th></tr></thead>
            <tbody>{LIMIT_ORDER.map((k) => <tr key={k}><td className="p-2">{w.limitNames[k]}</td><td className="p-2 text-zinc-600">{show(k, lim('free', k))}</td><td className="p-2 font-medium">{show(k, lim('premium', k))}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
