import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { PREMIUM } from '../lib/premiumText';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Chip, Loading } from '../components/ui';

const card = 'rounded-xl border border-zinc-300 bg-white p-3 text-zinc-900';
const W = {
  en: { tab: 'Premium', help: 'Premium fees are paid to Kezzo outside the app. Check your own account, then approve. A reference can only be used once.', review: 'Payments', members: 'Subscribers', limits: 'Limits', prices: 'Prices', accounts: 'Accounts', pending: 'Waiting', approved: 'Approved', rejected: 'Rejected', all: 'All',
    approve: 'Approve', reject: 'Reject', reasonPh: 'Reason shown to the member', none: 'Nothing here.', err: 'Something went wrong.', done: 'Saved.', save: 'Save', add: 'Add', del: 'Delete', suspend: 'Suspend', restore: 'Restore',
    country: 'Country', currency: 'Currency', amount: 'Amount', method: 'Method', accName: 'Account name', accNumber: 'Number', instr: 'Instructions', until: 'until', free: 'Free', premium: 'Premium', helpLimits: 'Changes apply right away for new listings, groups and members.' },
  fr: { tab: 'Premium', help: 'Les frais Premium sont payés à Kezzo hors de l’application. Vérifiez votre propre compte, puis approuvez. Une référence ne peut servir qu’une fois.', review: 'Paiements', members: 'Abonnés', limits: 'Limites', prices: 'Prix', accounts: 'Comptes', pending: 'En attente', approved: 'Approuvés', rejected: 'Rejetés', all: 'Tous',
    approve: 'Approuver', reject: 'Rejeter', reasonPh: 'Motif montré au membre', none: 'Rien ici.', err: 'Une erreur est survenue.', done: 'Enregistré.', save: 'Enregistrer', add: 'Ajouter', del: 'Supprimer', suspend: 'Suspendre', restore: 'Rétablir',
    country: 'Pays', currency: 'Devise', amount: 'Montant', method: 'Méthode', accName: 'Nom du compte', accNumber: 'Numéro', instr: 'Instructions', until: 'jusqu’au', free: 'Gratuit', premium: 'Premium', helpLimits: 'Les changements s’appliquent tout de suite aux nouvelles annonces, groupes et membres.' },
};
interface Row { id: string; user_id: string; name: string; handle: string; country: string; duration: string; currency: string; amount: number; reference: string; note: string; status: 'pending' | 'approved' | 'rejected'; reason: string; created_at: string }
interface Member { user_id: string; name: string; handle: string; status: string; expires_at: string; suspended: boolean }
interface Limit { plan: string; key: string; value: number }
interface Price { id: string; country: string; currency: string; duration: string; amount: number; active: boolean }
interface Account { id: string; country: string; method: string; account_name: string; account_number: string; instructions: string; active: boolean }
const KEYS = ['listings', 'payment_methods', 'live_rooms_month', 'live_minutes', 'vsla_groups', 'vsla_members', 'featured_month', 'export'];

/** Admin → Premium: approve payments, see subscribers, edit limits, country prices and Kezzo's collection accounts. */
export function AdminPremium() {
  const { lang } = useI18n();
  const a = W[lang === 'fr' ? 'fr' : 'en'];
  const p = PREMIUM[lang];
  const { toast } = useToast();
  const [part, setPart] = useState<'review' | 'members' | 'limits' | 'prices' | 'accounts'>('review');
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [accts, setAccts] = useState<Account[]>([]);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [np, setNp] = useState({ country: '', currency: '', duration: 'month', amount: '' });
  const [na, setNa] = useState({ country: '', method: '', account_name: '', account_number: '', instructions: '' });

  const load = useCallback(async () => {
    const [r, m, l, pr, ac] = await Promise.all([
      supabase.rpc('admin_premium_review', { p_status: status, p_limit: 100 }),
      supabase.rpc('admin_premium_members'),
      supabase.from('plan_limits').select('plan, key, value'),
      supabase.from('plan_prices').select('id, country, currency, duration, amount, active').order('country'),
      supabase.from('collection_accounts').select('id, country, method, account_name, account_number, instructions, active').order('country'),
    ]);
    setRows(Array.isArray(r.data) ? (r.data as Row[]) : []);
    setMembers(Array.isArray(m.data) ? (m.data as Member[]) : []);
    setLimits((l.data as Limit[] | null) ?? []);
    setPrices((pr.data as Price[] | null) ?? []);
    setAccts((ac.data as Account[] | null) ?? []);
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await q;
    toast(error ? a.err : a.done, error ? 'error' : 'info');
    void load();
  };
  const date = (s: string) => new Date(s).toLocaleDateString(lang);
  const addPrice = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(np.amount);
    if (!np.country.trim() || !np.currency.trim() || !(amount > 0)) return;
    await run(supabase.from('plan_prices').upsert({ country: np.country.trim(), currency: np.currency.trim().toUpperCase(), duration: np.duration, amount, active: true }, { onConflict: 'country,duration' }));
    setNp({ ...np, amount: '' });
  };
  const addAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!na.country.trim() || !na.method.trim()) return;
    await run(supabase.from('collection_accounts').insert({ ...na, country: na.country.trim(), method: na.method.trim() }));
    setNa({ country: na.country, method: '', account_name: '', account_number: '', instructions: '' });
  };

  if (!rows) return <Loading />;
  const parts: Array<[typeof part, string]> = [['review', a.review], ['members', a.members], ['limits', a.limits], ['prices', a.prices], ['accounts', a.accounts]];
  const statuses: Array<[string, string]> = [['pending', a.pending], ['approved', a.approved], ['rejected', a.rejected], ['', a.all]];

  return (
    <div className="space-y-4">
      <div className={card}><h2 className="text-base font-semibold">{a.tab}</h2><p className="mt-1 text-xs text-zinc-600">{a.help}</p></div>
      <div className="flex flex-wrap gap-2">{parts.map(([k, l]) => <Chip key={k} active={part === k} onClick={() => setPart(k)}>{l}</Chip>)}</div>

      {part === 'review' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">{statuses.map(([k, l]) => <Chip key={k || 'all'} active={status === k} onClick={() => setStatus(k)}>{l}</Chip>)}</div>
          {rows.length === 0 && <p className="text-sm text-zinc-500">{a.none}</p>}
          {rows.map((r) => (
            <div key={r.id} className={`${card} space-y-2 text-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.name} <span className="text-xs font-normal text-zinc-500">@{r.handle}</span></p>
                <span className="text-xs text-zinc-500">{p.statuses[r.status]} · {date(r.created_at)}</span>
              </div>
              <p>{r.amount} {r.currency} · {p.durations[r.duration]} · {r.country}</p>
              <p className="break-all text-xs text-zinc-600">{p.refL}: <b className="text-zinc-900">{r.reference}</b>{r.note ? ` · ${r.note}` : ''}</p>
              {r.status === 'rejected' && r.reason && <p className="text-xs text-red-700">{p.reason}: {r.reason}</p>}
              {r.status === 'pending' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-primary btn-sm" onClick={() => void run(supabase.rpc('admin_premium_decide', { p_id: r.id, p_approve: true, p_reason: '' }))}>{a.approve}</button>
                  <input className="input min-w-0 flex-1" placeholder={a.reasonPh} maxLength={200} value={why[r.id] ?? ''} onChange={(e) => setWhy({ ...why, [r.id]: e.target.value })} aria-label={a.reasonPh} />
                  <button className="btn btn-ghost btn-sm" onClick={() => void run(supabase.rpc('admin_premium_decide', { p_id: r.id, p_approve: false, p_reason: why[r.id] ?? '' }))}>{a.reject}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {part === 'members' && (
        <div className="space-y-2">
          {members.length === 0 && <p className="text-sm text-zinc-500">{a.none}</p>}
          {members.map((m) => (
            <div key={m.user_id} className={`${card} flex flex-wrap items-center justify-between gap-2 text-sm`}>
              <div><p className="font-medium">{m.name} <span className="text-xs font-normal text-zinc-500">@{m.handle}</span></p>
                <p className="text-xs text-zinc-500">{m.suspended ? p.statusSuspended : m.status === 'active' ? a.premium : m.status === 'grace' ? 'grace' : a.free} · {a.until} {date(m.expires_at)}</p></div>
              <button className="btn btn-ghost btn-sm" onClick={() => void run(supabase.rpc('admin_premium_suspend', { p_user: m.user_id, p_suspend: !m.suspended }))}>{m.suspended ? a.restore : a.suspend}</button>
            </div>
          ))}
        </div>
      )}

      {part === 'limits' && (
        <div className={`${card} space-y-2`}>
          <p className="text-xs text-zinc-600">{a.helpLimits}</p>
          <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm">
            <span /><b>{a.free}</b><b>{a.premium}</b>
            {KEYS.map((k) => (
              <LimitRow key={k} label={p.limitNames[k]} free={limits.find((x) => x.plan === 'free' && x.key === k)?.value ?? 0} prem={limits.find((x) => x.plan === 'premium' && x.key === k)?.value ?? 0}
                onSave={(plan, v) => void run(supabase.from('plan_limits').upsert({ plan, key: k, value: v }, { onConflict: 'plan,key' }))} />
            ))}
          </div>
        </div>
      )}

      {part === 'prices' && (
        <div className="space-y-2">
          <form className={`${card} grid gap-2 sm:grid-cols-5`} onSubmit={addPrice}>
            <input className="input" placeholder={a.country} aria-label={a.country} value={np.country} maxLength={60} onChange={(e) => setNp({ ...np, country: e.target.value })} />
            <input className="input" placeholder={a.currency} aria-label={a.currency} value={np.currency} maxLength={8} onChange={(e) => setNp({ ...np, currency: e.target.value })} />
            <select className="input" aria-label={p.duration} value={np.duration} onChange={(e) => setNp({ ...np, duration: e.target.value })}>{(['week', 'month', 'quarter'] as const).map((d) => <option key={d} value={d}>{p.durations[d]}</option>)}</select>
            <input className="input" type="number" min={0} step="any" placeholder={a.amount} aria-label={a.amount} value={np.amount} onChange={(e) => setNp({ ...np, amount: e.target.value })} />
            <button className="btn btn-primary">{a.add}</button>
          </form>
          {prices.map((x) => (
            <div key={x.id} className={`${card} flex items-center justify-between gap-2 text-sm`}>
              <span>{x.country} · {p.durations[x.duration]} · <b>{x.amount} {x.currency}</b></span>
              <button className="btn btn-ghost btn-sm" onClick={() => void run(supabase.from('plan_prices').delete().eq('id', x.id))}>{a.del}</button>
            </div>
          ))}
        </div>
      )}

      {part === 'accounts' && (
        <div className="space-y-2">
          <form className={`${card} grid gap-2 sm:grid-cols-2`} onSubmit={addAccount}>
            <input className="input" placeholder={a.country} aria-label={a.country} value={na.country} maxLength={60} onChange={(e) => setNa({ ...na, country: e.target.value })} />
            <input className="input" placeholder={a.method} aria-label={a.method} value={na.method} maxLength={40} onChange={(e) => setNa({ ...na, method: e.target.value })} />
            <input className="input" placeholder={a.accName} aria-label={a.accName} value={na.account_name} maxLength={80} onChange={(e) => setNa({ ...na, account_name: e.target.value })} />
            <input className="input" placeholder={a.accNumber} aria-label={a.accNumber} value={na.account_number} maxLength={80} onChange={(e) => setNa({ ...na, account_number: e.target.value })} />
            <textarea className="input sm:col-span-2" rows={2} placeholder={a.instr} aria-label={a.instr} value={na.instructions} maxLength={500} onChange={(e) => setNa({ ...na, instructions: e.target.value })} />
            <button className="btn btn-primary sm:col-span-2">{a.add}</button>
          </form>
          {accts.map((x) => (
            <div key={x.id} className={`${card} flex items-center justify-between gap-2 text-sm`}>
              <span className="min-w-0 truncate">{x.country} · {x.method} · {x.account_name} {x.account_number}</span>
              <button className="btn btn-ghost btn-sm shrink-0" onClick={() => void run(supabase.from('collection_accounts').delete().eq('id', x.id))}>{a.del}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LimitRow({ label, free, prem, onSave }: { label: string; free: number; prem: number; onSave: (plan: string, v: number) => void }) {
  const [f, setF] = useState(String(free));
  const [pr, setPr] = useState(String(prem));
  useEffect(() => { setF(String(free)); setPr(String(prem)); }, [free, prem]);
  const commit = (plan: string, s: string, old: number) => { const v = Math.max(0, Math.floor(Number(s) || 0)); if (v !== old) onSave(plan, v); };
  return (
    <>
      <span>{label}</span>
      <input className="input" type="number" min={0} value={f} aria-label={`${label} Free`} onChange={(e) => setF(e.target.value)} onBlur={() => commit('free', f, free)} />
      <input className="input" type="number" min={0} value={pr} aria-label={`${label} Premium`} onChange={(e) => setPr(e.target.value)} onBlur={() => commit('premium', pr, prem)} />
    </>
  );
}
