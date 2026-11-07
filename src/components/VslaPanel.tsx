import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { PiggyBank, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Spinner } from './ui';
export interface VslaMember { id: string; user_id: string | null; display_name: string; role: 'admin' | 'member' }

interface Cycle { id: string; name: string; currency: string; share_price: number; max_shares: number; loan_interest_pct: number; loan_multiple: number | null; frequency?: 'weekly' | 'biweekly' | 'monthly'; status: 'active' | 'closed' }
interface Loan { id: string; member_id: string; principal: number; interest_pct: number; due_date: string | null; guarantor_id?: string | null; status: 'open' | 'repaid' }
interface Entry { id: string; member_id: string; kind: 'shares' | 'social' | 'fine' | 'loan_repay'; amount: number; shares: number; loan_id: string | null; note: string; meeting_date: string; created_at: string }
interface Book { cycle: Cycle | null; loans: Loan[]; entries: Entry[] }
type Op = { id: string; type: 'record'; args: Record<string, unknown> } | { id: string; type: 'lend'; args: Record<string, unknown> } | { id: string; type: 'start'; args: Record<string, unknown> };

const num = (v: unknown) => Number(v) || 0;
const cacheKey = (g: string) => `kezzo-vsla-book:${g}`;
const queueKey = (g: string) => `kezzo-vsla-queue:${g}`;
const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: the books still work online */ } };
const isNetwork = (e: { message?: string } | null) => !navigator.onLine || /fetch|network|load failed/i.test(e?.message ?? '');

/**
 * Village savings and loans (VSLA) books for a group. Everyone in the group can read them; admins record each meeting.
 * Entries are sent with a unique id, so when the phone is offline they wait on the device and are sent later without ever being counted twice.
 */
export function VslaPanel({ groupId, members, admin }: { groupId: string; members: VslaMember[]; admin: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<Op[]>(() => read<Op[]>(queueKey(groupId), []));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: cycles, error } = await supabase.from('vsla_cycles').select('*').eq('group_id', groupId).order('started_at', { ascending: false }).limit(1);
    if (error) {
      setOffline(true);
      setBook((b) => b ?? read<Book>(cacheKey(groupId), { cycle: null, loans: [], entries: [] }));
      return;
    }
    const cycle = (cycles?.[0] as Cycle | undefined) ?? null;
    let loans: Loan[] = [];
    let entries: Entry[] = [];
    if (cycle) {
      const [l, e] = await Promise.all([
        supabase.from('vsla_loans').select('id,member_id,principal,interest_pct,due_date,guarantor_id,status').eq('cycle_id', cycle.id).limit(2000),
        supabase.from('vsla_entries').select('id,member_id,kind,amount,shares,loan_id,note,meeting_date,created_at').eq('cycle_id', cycle.id).order('created_at', { ascending: false }).limit(3000),
      ]);
      loans = ((l.data ?? []) as Loan[]).map((x) => ({ ...x, principal: num(x.principal), interest_pct: num(x.interest_pct) }));
      entries = ((e.data ?? []) as Entry[]).map((x) => ({ ...x, amount: num(x.amount) }));
    }
    const next = { cycle: cycle ? { ...cycle, share_price: num(cycle.share_price), loan_interest_pct: num(cycle.loan_interest_pct) } : null, loans, entries };
    setOffline(false);
    setBook(next);
    write(cacheKey(groupId), next);
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);

  /** Sends everything waiting on this device. Stops at the first network failure; drops entries the server refuses. */
  const sync = useCallback(async () => {
    let left = read<Op[]>(queueKey(groupId), []);
    if (left.length === 0 || !navigator.onLine) return;
    let sent = 0;
    for (const op of [...left]) {
      const res = op.type === 'record' ? await supabase.rpc('vsla_record', op.args)
        : op.type === 'lend' ? await supabase.rpc('vsla_lend', op.args)
        : await supabase.rpc('vsla_start_cycle', op.args);
      if (res.error && isNetwork(res.error)) break;
      if (res.error) toast(t('vs_error', { why: res.error.message }), 'error'); else sent += 1;
      left = left.filter((x) => x.id !== op.id);
      write(queueKey(groupId), left);
    }
    setQueue(left);
    if (sent) { toast(t('vs_synced', { n: sent })); void load(); }
  }, [groupId, load, t, toast]);

  useEffect(() => {
    void sync();
    const on = () => { void sync(); void load(); };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [sync, load]);

  /** Runs an action now, or keeps it on the device when there is no connection. */
  const submit = async (type: Op['type'], rpc: 'vsla_record' | 'vsla_lend' | 'vsla_start_cycle', args: Record<string, unknown>) => {
    setBusy(true);
    const res = navigator.onLine ? await supabase.rpc(rpc, args) : { error: { message: 'offline' } };
    setBusy(false);
    if (!res.error) { void load(); return true; }
    if (isNetwork(res.error)) {
      const next = [...queue, { id: crypto.randomUUID(), type, args } as Op];
      write(queueKey(groupId), next);
      setQueue(next);
      toast(t('vs_offline_queued'));
      return true;
    }
    toast(t('vs_error', { why: res.error.message }), 'error');
    return false;
  };

  const names = useMemo(() => new Map(members.map((m) => [m.id, m.display_name])), [members]);
  const nameOf = (id: string) => names.get(id) ?? '—';

  const stats = useMemo(() => {
    const cycle = book?.cycle;
    const perMember = new Map<string, { shares: number; saved: number; owes: number }>();
    const row = (id: string) => { let r = perMember.get(id); if (!r) { r = { shares: 0, saved: 0, owes: 0 }; perMember.set(id, r); } return r; };
    let social = 0, fines = 0, repaid = 0, lent = 0, accrued = 0;
    for (const e of book?.entries ?? []) {
      if (e.kind === 'shares') { row(e.member_id).shares += e.shares; row(e.member_id).saved += e.amount; }
      else if (e.kind === 'social') social += e.amount;
      else if (e.kind === 'fine') fines += e.amount;
      else repaid += e.amount;
    }
    const paidOn = new Map<string, number>();
    for (const e of book?.entries ?? []) if (e.loan_id) paidOn.set(e.loan_id, (paidOn.get(e.loan_id) ?? 0) + e.amount);
    const owedByLoan = new Map<string, number>();
    for (const l of book?.loans ?? []) {
      lent += l.principal;
      const total = l.principal * (1 + l.interest_pct / 100);
      accrued += total - l.principal;
      owedByLoan.set(l.id, Math.max(0, total - (paidOn.get(l.id) ?? 0)));
      row(l.member_id).owes += Math.max(0, total - (paidOn.get(l.id) ?? 0));
    }
    const saved = [...perMember.values()].reduce((s, r) => s + r.saved, 0);
    const cash = saved + social + fines + repaid - lent;
    const pool = saved + fines + accrued; // what the members share out once every loan is repaid
    return { cycle, owedByLoan, perMember, saved, social, cash, lent, pool, outstanding: [...perMember.values()].reduce((s, r) => s + r.owes, 0) };
  }, [book]);

  if (!book) return <div className="card"><Spinner /></div>;
  const cycle = book.cycle;
  const fmt = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cycle?.currency ?? ''}`.trim();

  return (
    <section className="card space-y-4" aria-label={t('vs_title')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><PiggyBank className="h-4 w-4 text-accent" aria-hidden="true" />{t('vs_title')}{cycle && <span className="text-xs font-normal text-zinc-500">· {cycle.name}{cycle.status === 'closed' ? ` (${t('vs_closed')})` : ''}</span>}</h2>
        {queue.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{t('vs_pending', { n: queue.length })}</span>}
      </div>
      {offline && <p className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700"><WifiOff className="h-3.5 w-3.5" aria-hidden="true" />{t('vs_offline_banner')}</p>}

      {!cycle || cycle.status === 'closed' ? (
        <>
          {!cycle && <p className="text-sm text-zinc-500">{t('vs_intro')}</p>}
          {admin && <StartCycle busy={busy} onStart={(a) => submit('start', 'vsla_start_cycle', { ...a, p_group: groupId })} />}
        </>
      ) : null}

      {cycle && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[[t('vs_cash'), stats.cash], [t('vs_savings'), stats.saved], [t('vs_loans_out'), stats.outstanding], [t('vs_social'), stats.social]].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-zinc-50 p-2.5"><dt className="text-[11px] text-zinc-500">{label}</dt><dd className="font-semibold">{fmt(value as number)}</dd></div>
            ))}
          </dl>
          <p className="text-xs text-zinc-500">
            {t('vs_rules2', { freq: t(`vs_freq_${cycle.frequency ?? 'weekly'}` as 'vs_freq_weekly'), price: fmt(cycle.share_price), max: cycle.max_shares, pct: cycle.loan_interest_pct })}
            {cycle.loan_multiple ? ` ${t('vs_limit_note', { mult: cycle.loan_multiple })}` : ''}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-[11px] text-zinc-500"><th className="py-1 font-medium">{t('vs_member')}</th><th className="font-medium">{t('vs_col_shares')}</th><th className="font-medium">{t('vs_col_saved')}</th><th className="font-medium">{t('vs_col_owes')}</th><th className="font-medium">{t('vs_col_payout')}</th></tr></thead>
              <tbody>
                {members.map((m) => {
                  const r = stats.perMember.get(m.id) ?? { shares: 0, saved: 0, owes: 0 };
                  const payout = stats.saved > 0 ? (r.saved / stats.saved) * stats.pool : 0;
                  return <tr key={m.id} className="border-t border-zinc-100"><td className="py-1.5 pr-2">{m.display_name}</td><td>{r.shares}</td><td>{fmt(r.saved)}</td><td>{r.owes > 0 ? fmt(r.owes) : '—'}</td><td>{fmt(payout)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">{t('vs_estimate_note')}</p>

          {book.loans.some((l) => l.status === 'open') && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t('vs_open_loans')}</h3>
              <ul className="divide-y divide-zinc-100 text-sm">
                {book.loans.filter((l) => l.status === 'open').map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-2 py-1.5">
                    <span className="mr-auto">{nameOf(l.member_id)}{l.guarantor_id && <span className="text-xs text-zinc-500"> · {t('vs_guarantor_is', { name: nameOf(l.guarantor_id) })}</span>}</span>
                    <span className="font-medium">{fmt(stats.owedByLoan.get(l.id) ?? 0)}</span>
                    {l.due_date && <span className="text-xs text-zinc-400">{t('vs_due_on', { date: l.due_date })}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {admin && cycle.status === 'active' && (
            <>
              <RecordForm cycle={cycle} members={members} perMember={stats.perMember} cash={stats.cash} fmt={fmt} loans={book.loans.filter((l) => l.status === 'open')} nameOf={nameOf} busy={busy} onSubmit={submit} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.confirm(t('vs_close_confirm')) && supabase.rpc('vsla_close', { p_cycle: cycle.id }).then(({ error }) => (error ? toast(t('vs_error', { why: error.message }), 'error') : load()))}>{t('vs_close')}</button>
            </>
          )}

          {book.entries.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t('vs_recent')}</h3>
              <ul className="divide-y divide-zinc-100 text-sm">
                {book.entries.slice(0, 15).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-2 py-1.5">
                    <span className="mr-auto">{nameOf(e.member_id)} · <span className="text-zinc-500">{t(`vs_kind_${e.kind}` as 'vs_kind_shares')}{e.kind === 'shares' ? ` ×${e.shares}` : ''}</span></span>
                    <span className="font-medium">{fmt(e.amount)}</span>
                    <span className="text-xs text-zinc-400">{e.meeting_date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StartCycle({ busy, onStart }: { busy: boolean; onStart: (a: Record<string, unknown>) => Promise<boolean> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Cycle 1');
  const [currency, setCurrency] = useState('');
  const [price, setPrice] = useState('');
  const [interest, setInterest] = useState('10');
  const [multiple, setMultiple] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  if (!open) return <button type="button" className="btn btn-accent btn-sm" onClick={() => setOpen(true)}>{t('vs_start')}</button>;
  const go = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onStart({ p_name: name, p_currency: currency, p_price: Number(price), p_interest: Number(interest), p_multiple: multiple ? Number(multiple) : null, p_frequency: frequency, p_client: crypto.randomUUID() });
    if (ok) setOpen(false);
  };
  return (
    <form className="grid gap-3 rounded-xl bg-zinc-50 p-3 sm:grid-cols-2" onSubmit={go}>
      <div><label className="label" htmlFor="vs-name">{t('vs_cycle_name')}</label><input id="vs-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="sm:col-span-2">
        <span className="label">{t('vs_freq')}</span>
        <div className="flex flex-wrap gap-1.5">
          {(['weekly', 'biweekly', 'monthly'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={frequency === f} onClick={() => setFrequency(f)} className={`chip ${frequency === f ? 'bg-zinc-900 text-white' : ''}`}>{t(`vs_freq_${f}` as 'vs_freq_weekly')}</button>
          ))}
        </div>
      </div>
      <div><label className="label" htmlFor="vs-cur">{t('vs_currency')}</label><input id="vs-cur" className="input" value={currency} maxLength={6} placeholder="KES, UGX, RWF…" onChange={(e) => setCurrency(e.target.value)} required /></div>
      <div><label className="label" htmlFor="vs-price">{t('vs_share_price')}</label><input id="vs-price" className="input" type="number" min="0.01" step="any" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
      <div><label className="label" htmlFor="vs-int">{t('vs_interest')}</label><input id="vs-int" className="input" type="number" min="0" max="100" step="any" inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} required /></div>
      <div><label className="label" htmlFor="vs-mult">{t('vs_multiple_opt')}</label><input id="vs-mult" className="input" type="number" min="1" max="10" step="1" inputMode="numeric" value={multiple} onChange={(e) => setMultiple(e.target.value)} /></div>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button className="btn btn-accent btn-sm" disabled={busy}>{busy && <Spinner />}{t('vs_start')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('cancel')}</button>
      </div>
    </form>
  );
}

type Kind = 'shares' | 'social' | 'fine' | 'loan_repay' | 'loan';
function RecordForm({ cycle, members, perMember, cash, fmt, loans, nameOf, busy, onSubmit }: {
  cycle: Cycle; members: VslaMember[]; perMember: Map<string, { saved: number; owes: number }>; cash: number; fmt: (n: number) => string; loans: Loan[]; nameOf: (id: string) => string; busy: boolean;
  onSubmit: (type: Op['type'], rpc: 'vsla_record' | 'vsla_lend', args: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>('shares');
  const [member, setMember] = useState(members[0]?.id ?? '');
  const [shares, setShares] = useState('1');
  const [amount, setAmount] = useState('');
  const [loan, setLoan] = useState('');
  const [due, setDue] = useState('');
  const [guarantor, setGuarantor] = useState('');
  const [note, setNote] = useState('');
  // Soft warnings only: treasurers decide, nothing is blocked.
  const asked = Number(amount) || 0;
  const mine = perMember.get(member) ?? { saved: 0, owes: 0 };
  const overLimit = kind === 'loan' && cycle.loan_multiple !== null && asked + mine.owes > mine.saved * (cycle.loan_multiple ?? 0);
  const overCash = kind === 'loan' && asked > cash;
  const kinds: Kind[] = ['shares', 'social', 'fine', 'loan', 'loan_repay'];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const client = crypto.randomUUID();
    const ok = kind === 'loan'
      ? await onSubmit('lend', 'vsla_lend', { p_cycle: cycle.id, p_member: member, p_principal: Number(amount), p_due: due || null, p_guarantor: guarantor || null, p_client: client })
      : await onSubmit('record', 'vsla_record', {
        p_cycle: cycle.id, p_member: member, p_kind: kind, p_shares: kind === 'shares' ? Number(shares) : 0,
        p_amount: kind === 'shares' ? null : Number(amount), p_loan: kind === 'loan_repay' ? loan : null, p_note: note, p_date: new Date().toISOString().slice(0, 10), p_client: client,
      });
    if (ok) { setAmount(''); setNote(''); setShares('1'); setGuarantor(''); }
  };

  return (
    <form className="space-y-3 rounded-xl bg-zinc-50 p-3" onSubmit={save}>
      <div className="flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
            className={`chip ${kind === k ? 'bg-zinc-900 text-white' : ''}`}>{t(`vs_kind_${k}` as 'vs_kind_shares')}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {kind !== 'loan_repay' && (
          <div><label className="label" htmlFor="vs-m">{t('vs_member')}</label>
            <select id="vs-m" className="input" value={member} onChange={(e) => setMember(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></div>
        )}
        {kind === 'loan_repay' && (
          <div><label className="label" htmlFor="vs-l">{t('vs_loan')}</label>
            <select id="vs-l" className="input" value={loan} onChange={(e) => setLoan(e.target.value)} required>
              <option value="">—</option>{loans.map((l) => <option key={l.id} value={l.id}>{nameOf(l.member_id)} · {l.principal.toLocaleString()}</option>)}</select></div>
        )}
        {kind === 'shares' ? (
          <div><label className="label" htmlFor="vs-s">{t('vs_n_shares')} (≤ {cycle.max_shares})</label>
            <input id="vs-s" className="input" type="number" min="1" max={cycle.max_shares} step="1" inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value)} required /></div>
        ) : (
          <div><label className="label" htmlFor="vs-a">{t('vs_amount')}</label>
            <input id="vs-a" className="input" type="number" min="0.01" step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        )}
        {kind === 'loan' && (
          <div><label className="label" htmlFor="vs-g">{t('vs_guarantor')}</label>
            <select id="vs-g" className="input" value={guarantor} onChange={(e) => setGuarantor(e.target.value)}>
              <option value="">{t('vs_guarantor_none')}</option>{members.filter((m) => m.id !== member).map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></div>
        )}
        {kind === 'loan' && <div><label className="label" htmlFor="vs-d">{t('vs_due')}</label><input id="vs-d" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>}
        {kind !== 'loan' && <div><label className="label" htmlFor="vs-n">{t('vs_note')}</label><input id="vs-n" className="input" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></div>}
      </div>
      {overLimit && <p className="text-xs text-amber-700">{t('vs_warn_limit', { max: fmt(mine.saved * (cycle.loan_multiple ?? 0)) })}</p>}
      {overCash && <p className="text-xs text-amber-700">{t('vs_warn_cash', { cash: fmt(cash) })}</p>}
      <button className="btn btn-accent btn-sm" disabled={busy}>{busy && <Spinner />}{t('vs_save')}</button>
    </form>
  );
}
