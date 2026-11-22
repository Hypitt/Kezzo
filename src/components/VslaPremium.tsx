import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { copyText } from '../lib/share';
import { VSLA_PREMIUM, toCsv, vslaPremiumError } from '../lib/vslaPremiumText';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';

interface Method { id: string; method: string; account_name: string; account_number: string; instructions: string }

/** The group's own payment method: members see it and copy the number; treasurers (with a Premium owner) add or remove it. */
export function GroupPayCard({ groupId, admin }: { groupId: string; admin: boolean }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = VSLA_PREMIUM[lang];
  const [list, setList] = useState<Method[]>([]);
  const [f, setF] = useState({ method: '', account_name: '', account_number: '', instructions: '' });
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('vsla_pay_methods', { p_group: groupId });
    setList(Array.isArray(data) ? (data as Method[]) : []);
  }, [groupId]);
  useEffect(() => { void load(); }, [load]);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.method.trim()) return;
    const { error } = await supabase.from('vsla_group_methods').insert({ group_id: groupId, method: f.method.trim(), account_name: f.account_name.trim(), account_number: f.account_number.trim(), instructions: f.instructions.trim() });
    toast(error ? vslaPremiumError(lang, error.message) : w.done, error ? 'error' : 'info');
    if (!error) { setF({ method: '', account_name: '', account_number: '', instructions: '' }); void load(); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('vsla_group_methods').delete().eq('id', id);
    toast(error ? w.err : w.done, error ? 'error' : 'info');
    void load();
  };
  const copy = async (s: string) => { await copyText(s); toast(w.copied); };
  if (list.length === 0 && !admin) return null;
  return (
    <div className="space-y-2 rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-sm">
      <p className="font-semibold">{admin ? w.addT : w.payT}</p>
      {list.length > 0 && !admin && <p className="text-xs text-zinc-600">{w.payNote}</p>}
      {list.map((m) => (
        <div key={m.id} className="rounded-lg border border-zinc-300 bg-white p-2">
          <p className="font-medium">{m.method}</p>
          {m.account_name && <p className="text-xs text-zinc-600">{w.accName}: {m.account_name}</p>}
          {m.account_number && <p className="flex items-center gap-2 text-xs text-zinc-600">{w.accNumber}: <b className="text-sm text-zinc-900">{m.account_number}</b>
            <button type="button" className="btn btn-ghost !px-2 !py-1" aria-label={w.copy} onClick={() => void copy(m.account_number)}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button></p>}
          {m.instructions && <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">{m.instructions}</p>}
          {admin && <button type="button" className="btn btn-ghost btn-sm mt-1 text-red-600" onClick={() => void remove(m.id)}>{w.del}</button>}
        </div>
      ))}
      {admin && (
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={add}>
          <input className="input" placeholder={w.method} aria-label={w.method} maxLength={40} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} />
          <input className="input" placeholder={w.accName} aria-label={w.accName} maxLength={80} value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} />
          <input className="input" placeholder={w.accNumber} aria-label={w.accNumber} maxLength={80} value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} />
          <input className="input" placeholder={w.instr} aria-label={w.instr} maxLength={500} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
          <button className="btn btn-primary btn-sm sm:col-span-2" disabled={!f.method.trim()}>{w.add}</button>
          <p className="text-xs text-zinc-500 sm:col-span-2">{w.premiumNeeded}</p>
        </form>
      )}
    </div>
  );
}

/** Field agent: sends a contribution for a member; a treasurer approves it. */
export function AgentForm({ groupId, members, onSent }: { groupId: string; members: Array<{ id: string; display_name: string; active?: boolean }>; onSent: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = VSLA_PREMIUM[lang];
  const [member, setMember] = useState('');
  const [kind, setKind] = useState<'shares' | 'social'>('shares');
  const [n, setN] = useState('1');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setBusy(true);
    const { error } = await supabase.rpc('vsla_agent_submit', { p_group: groupId, p_member: member, p_kind: kind, p_shares: kind === 'shares' ? Number(n) : 0, p_amount: kind === 'social' ? Number(amount) : null, p_note: note.trim(), p_date: null });
    setBusy(false);
    toast(error ? vslaPremiumError(lang, error.message) : w.agentSent, error ? 'error' : 'info');
    if (!error) { setAmount(''); setNote(''); onSent(); }
  };
  return (
    <form className="space-y-2" onSubmit={send}>
      <p className="text-xs text-zinc-500">{w.agentHelp}</p>
      <select className="input" aria-label={w.agentMember} value={member} onChange={(e) => setMember(e.target.value)}>
        <option value="">{w.agentMember}</option>{members.filter((m) => m.active !== false).map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select className="input" aria-label={w.agentShares} value={kind} onChange={(e) => setKind(e.target.value as 'shares' | 'social')}><option value="shares">{w.agentShares}</option><option value="social">{w.agentSocial}</option></select>
        {kind === 'shares'
          ? <input className="input" type="number" min={1} aria-label={w.agentCount} placeholder={w.agentCount} value={n} onChange={(e) => setN(e.target.value)} />
          : <input className="input" type="number" min={0} step="any" aria-label={w.agentAmount} placeholder={w.agentAmount} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </div>
      <input className="input" maxLength={120} aria-label={w.agentNote} placeholder={w.agentNote} value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={busy || !member}>{w.agentSend}</button>
    </form>
  );
}

/** Treasurers of a Premium group: download every recorded entry as a CSV file (opens in Excel). */
export function ExportButton({ groupId, name }: { groupId: string; name: string }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = VSLA_PREMIUM[lang];
  const run = async () => {
    const { data, error } = await supabase.rpc('vsla_export', { p_group: groupId });
    if (error) return toast(vslaPremiumError(lang, error.message), 'error');
    const rows = (data as Array<{ meeting_date: string; cycle: string; member: string; kind: string; shares: number; amount: number; note: string }>) ?? [];
    const csv = toCsv([['date', 'cycle', 'member', 'type', 'shares', 'amount', 'note'], ...rows.map((r) => [r.meeting_date, r.cycle, r.member, r.kind, r.shares, r.amount, r.note])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/[^\w-]+/g, '_') || 'group'}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run()}><Download className="h-3.5 w-3.5" aria-hidden="true" />{w.exportCsv}</button>;
}

interface Report { group_id: string; name: string; currency: string; members: number; shares_total: number; social_total: number; fines_total: number; loans_out: number; outstanding: number }

/** Totals per group and per currency across the groups the person manages. Shows nothing without Premium. */
export function ReportCard() {
  const { lang } = useI18n();
  const w = VSLA_PREMIUM[lang];
  const [rows, setRows] = useState<Report[]>([]);
  useEffect(() => { void supabase.rpc('vsla_report').then(({ data }) => setRows(Array.isArray(data) ? (data as Report[]) : [])); }, []);
  if (rows.length === 0) return null;
  const cur: string[] = Array.from(new Set<string>(rows.map((r) => r.currency)));
  const sum = (c: string, k: keyof Report) => rows.filter((r) => r.currency === c).reduce((a, r) => a + Number(r[k]), 0);
  const n = (v: number) => v.toLocaleString(lang, { maximumFractionDigits: 2 });
  return (
    <div className="card overflow-x-auto p-0 text-zinc-900">
      <div className="px-3 pt-3"><h2 className="text-sm font-semibold">{w.reportT}</h2><p className="text-xs text-zinc-500">{w.reportHelp}</p></div>
      <table className="mt-2 w-full text-left text-sm">
        <thead><tr><th className="p-2">{w.colGroup}</th><th className="p-2">{w.colMembers}</th><th className="p-2">{w.colShares}</th><th className="p-2">{w.colSocial}</th><th className="p-2">{w.colFines}</th><th className="p-2">{w.colOut}</th><th className="p-2">{w.colOwed}</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.group_id}><td className="p-2 font-medium">{r.name} <span className="text-xs text-zinc-500">{r.currency}</span></td><td className="p-2">{r.members}</td><td className="p-2">{n(r.shares_total)}</td><td className="p-2">{n(r.social_total)}</td><td className="p-2">{n(r.fines_total)}</td><td className="p-2">{n(r.loans_out)}</td><td className="p-2">{n(r.outstanding)}</td></tr>)}
          {cur.length > 1 || rows.length > 1 ? cur.map((c) => <tr key={c} className="font-semibold"><td className="p-2">{w.totalLabel} {c}</td><td className="p-2">{sum(c, 'members')}</td><td className="p-2">{n(sum(c, 'shares_total'))}</td><td className="p-2">{n(sum(c, 'social_total'))}</td><td className="p-2">{n(sum(c, 'fines_total'))}</td><td className="p-2">{n(sum(c, 'loans_out'))}</td><td className="p-2">{n(sum(c, 'outstanding'))}</td></tr>) : null}
        </tbody>
      </table>
    </div>
  );
}
