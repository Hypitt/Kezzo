import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { REFERRAL_ADMIN } from '../lib/referralText';
import { usd } from '../lib/referral';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Chip, Loading } from '../components/ui';

const card = 'rounded-xl border border-zinc-300 bg-white p-3 text-zinc-900';
interface Summary { settings: { enabled: boolean; reward_cents: number; min_actions: number; min_days: number; claim_window_days: number; monthly_cap: number; min_payout_cents: number; require_install: boolean; require_email: boolean; rules_text: string }; installs: number; pending: number; qualified: number; paid: number; rejected: number; owed_cents: number; paid_cents: number }
interface Payout { referrer_id: string; name: string; handle: string; payout_info: string; blocked: boolean; n: number; owed_cents: number }
interface Row { id: string; status: 'pending' | 'qualified' | 'paid' | 'rejected'; reward_cents: number; reject_reason: string; created_at: string; referrer_id: string; referrer_name: string; referrer_handle: string; referred_name: string; referred_handle: string }

/** Admin → Referrals: settings, the monthly payout list, and every referral with reject / restore. */
export function AdminReferrals() {
  const { lang } = useI18n();
  const a = REFERRAL_ADMIN[lang === 'fr' ? 'fr' : 'en'];
  const { toast } = useToast();
  const [sum, setSum] = useState<Summary | null>(null);
  const [pays, setPays] = useState<Payout[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [f, setF] = useState<Summary['settings'] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [s, p, l] = await Promise.all([
      supabase.rpc('admin_referral_summary'),
      supabase.rpc('admin_referral_payouts'),
      supabase.rpc('admin_referral_list', { p_status: filter, p_limit: 100 }),
    ]);
    if (s.data) { setSum(s.data as Summary); setF((cur) => cur ?? (s.data as Summary).settings); }
    setPays(Array.isArray(p.data) ? (p.data as Payout[]) : []);
    setRows(Array.isArray(l.data) ? (l.data as Row[]) : []);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await q;
    toast(error ? a.err : a.done, error ? 'error' : 'info');
    void load();
  };
  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!f) return;
    await run(supabase.rpc('admin_referral_settings', { p_enabled: f.enabled, p_reward: f.reward_cents, p_actions: f.min_actions, p_days: f.min_days, p_window: f.claim_window_days, p_cap: f.monthly_cap, p_min_payout: f.min_payout_cents, p_install: f.require_install, p_email: f.require_email, p_rules: f.rules_text }));
  };

  if (!sum || !f) return <Loading />;
  const num = (k: 'reward_cents' | 'min_actions' | 'min_days' | 'claim_window_days' | 'monthly_cap' | 'min_payout_cents') => (
    <div key={k}><label className="label" htmlFor={`rs-${k}`}>{{ reward_cents: a.reward, min_actions: a.actions, min_days: a.days, claim_window_days: a.window, monthly_cap: a.cap, min_payout_cents: a.minPayout }[k]}</label>
      <input id={`rs-${k}`} className="input" type="number" min={0} value={Number(f[k])} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) })} /></div>
  );
  const statuses: Array<[string, string]> = [['', a.all], ['pending', a.pending], ['qualified', a.qualified], ['paid', a.paid], ['rejected', a.rejected]];

  return (
    <div className="space-y-4">
      <div className={card}><h2 className="text-base font-semibold">{a.title}</h2><p className="mt-1 text-xs text-zinc-600">{a.help}</p></div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[[a.owed, usd(sum.owed_cents)], [a.paidT, usd(sum.paid_cents)], [a.pendingN, sum.pending], [a.qualifiedN, sum.qualified], [a.rejectedN, sum.rejected], [a.installsN, sum.installs]].map(([l, v]) => (
          <div key={String(l)} className={`${card} text-center`}><dd className="text-lg font-bold tabular-nums">{v}</dd><dt className="text-[11px] text-zinc-500">{l}</dt></div>
        ))}
      </dl>

      <section className={`${card} space-y-2`}>
        <h3 className="text-sm font-semibold">{a.payouts}</h3>
        <p className="text-xs text-zinc-600">{a.payoutsHelp}</p>
        {pays.length === 0 ? <p className="text-sm text-zinc-500">{a.noPayouts}</p> : (
          <ul className="space-y-2">
            {pays.map((p) => (
              <li key={p.referrer_id} className="space-y-2 rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-sm">
                <p><span className="font-semibold">{p.name}</span> <span className="text-zinc-500">@{p.handle}</span> · {p.n} · <span className="font-bold">{usd(p.owed_cents)}</span>
                  {p.owed_cents < f.min_payout_cents && <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px]">{a.belowMin}</span>}
                  {p.blocked && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">{a.blocked}</span>}</p>
                <p className="break-words text-xs text-zinc-600">{p.payout_info || a.noInfo}</p>
                <div className="flex flex-wrap gap-2">
                  <input className="input min-w-0 flex-1" placeholder={a.paidNote} aria-label={a.paidNote} maxLength={200} value={notes[p.referrer_id] ?? ''} onChange={(e) => setNotes({ ...notes, [p.referrer_id]: e.target.value })} />
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => { if (window.confirm(a.confirmPaid)) void run(supabase.rpc('admin_referral_mark_paid', { p_referrer: p.referrer_id, p_note: notes[p.referrer_id] ?? '' })); }}>{a.markPaid}</button>
                  <button type="button" className="btn btn-ghost btn-sm text-red-700" onClick={() => void run(supabase.rpc('admin_referral_block', { p_user: p.referrer_id, p_block: !p.blocked }))}>{p.blocked ? a.unblock : a.block}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} space-y-2`}>
        <h3 className="text-sm font-semibold">{a.list}</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">{statuses.map(([k, label]) => <Chip key={k || 'all'} active={filter === k} onClick={() => setFilter(k)}>{label}</Chip>)}</div>
        {rows.length === 0 ? <p className="text-sm text-zinc-500">{a.empty}</p> : (
          <ul className="divide-y divide-zinc-200">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.referred_name}</span> <span className="text-xs text-zinc-500">@{r.referred_handle}</span>
                  <span className="block text-xs text-zinc-500">{a.invitedBy} {r.referrer_name} @{r.referrer_handle} · {r.created_at.slice(0, 10)}{r.reject_reason ? ` · ${r.reject_reason}` : ''}</span>
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium">{({ pending: a.pending, qualified: a.qualified, paid: a.paid, rejected: a.rejected })[r.status]}</span>
                {(r.status === 'pending' || r.status === 'qualified') && <button type="button" className="btn btn-ghost btn-sm text-red-700" onClick={() => { const why = window.prompt(a.reason) ?? null; if (why !== null) void run(supabase.rpc('admin_referral_reject', { p_id: r.id, p_reason: why })); }}>{a.reject}</button>}
                {r.status === 'pending' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run(supabase.rpc('admin_referral_approve', { p_id: r.id }))}>{a.approve}</button>}
                {r.status === 'rejected' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run(supabase.rpc('admin_referral_restore', { p_id: r.id }))}>{a.restore}</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className={`${card} space-y-3`} onSubmit={saveSettings}>
        <h3 className="text-sm font-semibold">{a.settings}</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />{a.enabled}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.require_install} onChange={(e) => setF({ ...f, require_install: e.target.checked })} />{a.requireInstall}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.require_email} onChange={(e) => setF({ ...f, require_email: e.target.checked })} />{a.requireEmail}</label>
        <div className="grid gap-3 sm:grid-cols-2">{(['reward_cents', 'min_actions', 'min_days', 'claim_window_days', 'monthly_cap', 'min_payout_cents'] as const).map(num)}</div>
        <div><label className="label" htmlFor="rs-rules">{a.rulesText}</label><textarea id="rs-rules" className="input" rows={4} maxLength={1200} value={f.rules_text} onChange={(e) => setF({ ...f, rules_text: e.target.value })} /><p className="mt-1 text-xs text-zinc-500">{a.rulesHelp}</p></div>
        <button className="btn btn-primary">{a.saveSettings}</button>
      </form>
    </div>
  );
}
