import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Gift, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { copyText, WEB_TARGETS } from '../lib/share';
import { REFERRAL } from '../lib/referralText';
import { referralLink, usd } from '../lib/referral';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Chevron, Loading, PageHeader } from '../components/ui';

interface Stats {
  code: string; payout_info: string;
  settings: { enabled: boolean; paused: boolean; pause_until: string | null; pause_note: string; reward_cents: number; min_actions: number; min_days: number; monthly_cap: number; min_payout_cents: number; require_install: boolean; require_email: boolean; rules_text: string };
  pending: number; qualified: number; balance_cents: number; paid_cents: number;
  referrals: Array<{ name: string; status: 'pending' | 'qualified' | 'paid' | 'rejected'; created_at: string; reward_cents: number }>;
}

/** Invite & Earn: a personal link, how it works, what was earned, and how to be paid. */
export function InviteView() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = REFERRAL[lang];
  const [s, setS] = useState<Stats | null>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [friend, setFriend] = useState('');
  const [rules, setRules] = useState(false);

  const load = useCallback(() => {
    void supabase.rpc('referral_stats').then(({ data, error }) => {
      if (error || !data) return toast(w.err, 'error');
      setS(data as Stats);
      setInfo((data as Stats).payout_info);
    });
  }, [toast, w.err]);
  useEffect(load, [load]);

  if (!s) return <Loading />;
  const link = referralLink(s.code);
  const reward = usd(s.settings.reward_cents);
  const copy = async () => toast((await copyText(link)) ? w.copied : w.err);
  const share = async () => {
    if (typeof navigator.share === 'function') { try { await navigator.share({ title: 'Kezzo', text: w.shareText, url: link }); return; } catch { /* cancelled */ } }
    await copy();
  };
  const savePayout = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc('referral_set_payout', { p_info: info });
    setBusy(false);
    toast(error ? w.err : w.saved, error ? 'error' : 'info');
  };
  const applyCode = async (e: FormEvent) => {
    e.preventDefault();
    const code = friend.trim().replace(/^@/, '').toLowerCase();
    if (!code) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
    setBusy(false);
    if (error) return toast(w.err, 'error');
    toast(w.codeResult[String(data)] ?? w.err, data === 'ok' ? 'info' : 'error');
    if (data === 'ok') setFriend('');
  };
  const chip = (st: Stats['referrals'][number]['status']) => {
    const m = { pending: ['bg-amber-100 text-amber-800', w.stPending], qualified: ['bg-emerald-100 text-emerald-800', w.stQualified], paid: ['bg-sky-100 text-sky-800', w.stPaid], rejected: ['bg-zinc-200 text-zinc-700', w.stRejected] }[st];
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${m[0]}`}>{m[1]}</span>;
  };
  const steps = w.steps(s.settings.min_days, s.settings.min_actions);
  if (s.settings.require_install) steps.splice(2, 0, w.installStep);
  const ruleLines = s.settings.rules_text.trim()
    ? s.settings.rules_text.split('\n').map((x) => x.trim()).filter(Boolean)
    : [...w.rules(s.settings.monthly_cap, usd(s.settings.min_payout_cents)), ...(s.settings.require_install ? [w.rulesInstall] : [])];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={w.nav} sub="" />
      {s.settings.paused && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{w.paused(s.settings.pause_until ? new Date(s.settings.pause_until).toLocaleDateString() : '')}{s.settings.pause_note ? ` ${s.settings.pause_note}` : ''}</p>}
      {!s.settings.enabled && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{w.off}</p>}

      <section className="card space-y-3 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent"><Gift className="h-6 w-6" aria-hidden="true" /></span>
        <h2 className="font-display text-xl font-bold">{w.heroTitle(reward)}</h2>
        <p className="text-sm text-zinc-600">{w.heroText}</p>
        <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-left">
          <p className="text-[11px] font-medium text-zinc-500">{w.yourCode}</p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-lg font-semibold">{s.code}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy()}><Copy className="h-3.5 w-3.5" aria-hidden="true" />{w.copyLink}</button>
          </div>
          <p className="truncate text-xs text-zinc-500">{link}</p>
        </div>
        <button type="button" className="btn btn-accent w-full" onClick={() => void share()}><Share2 className="h-4 w-4" aria-hidden="true" />{w.share}</button>
        <div className="flex flex-wrap justify-center gap-2">
          {WEB_TARGETS.map((t) => (
            <a key={t.key} className="btn btn-ghost btn-sm capitalize" target="_blank" rel="noopener noreferrer" href={t.href(link, w.shareText)}>{t.key === 'x' ? 'X' : t.key}</a>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await copyText(`${w.shareText} ${link}`); toast(w.typed); window.open('https://www.tiktok.com/', '_blank', 'noopener'); }}>TikTok</button>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        {[[w.balance, usd(s.balance_cents)], [w.paid, usd(s.paid_cents)], [w.friends, String(s.qualified)], [w.waiting, String(s.pending)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-zinc-300 bg-white p-3 text-center shadow-sm"><dd className="text-xl font-bold tabular-nums">{v}</dd><dt className="text-[11px] text-zinc-500">{l}</dt></div>
        ))}
      </dl>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">{w.howTitle}</h2>
        <ol className="space-y-3">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
              <span className="text-sm"><strong className="block font-semibold">{title}</strong><span className="text-zinc-600">{text}</span></span>
            </li>
          ))}
        </ol>
        <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-left text-sm font-semibold" aria-expanded={rules} onClick={() => setRules((v) => !v)}>
          <span className="flex-1">{w.rulesTitle}</span><Chevron open={rules} />
        </button>
        {rules && <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">{ruleLines.map((r) => <li key={r}>{r}</li>)}</ul>}
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">{w.listTitle}</h2>
        {s.referrals.length === 0 ? <p className="text-sm text-zinc-500">{w.listEmpty}</p> : (
          <ul className="divide-y divide-zinc-200">
            {s.referrals.map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-2 text-sm">
                <span className="mr-auto truncate font-medium">{r.name}</span>
                {r.status !== 'pending' && r.status !== 'rejected' && <span className="text-xs font-semibold">{usd(r.reward_cents)}</span>}
                {chip(r.status)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card space-y-2" onSubmit={applyCode}>
        <h2 className="text-sm font-semibold">{w.haveCode}</h2>
        <div className="flex gap-2">
          <input className="input min-w-0 flex-1" value={friend} maxLength={20} placeholder={w.codePh} aria-label={w.codePh} onChange={(e) => setFriend(e.target.value)} />
          <button className="btn btn-ghost shrink-0" disabled={busy || !friend.trim()}>{w.codeBtn}</button>
        </div>
      </form>

      <form className="card space-y-2" onSubmit={savePayout}>
        <h2 className="text-sm font-semibold">{w.payoutTitle}</h2>
        <p className="text-xs text-zinc-500">{w.payoutHelp}</p>
        <div className="flex gap-2">
          <input className="input min-w-0 flex-1" value={info} maxLength={200} placeholder={w.payoutPh} aria-label={w.payoutTitle} onChange={(e) => setInfo(e.target.value)} />
          <button className="btn btn-primary shrink-0" disabled={busy}>{w.save}</button>
        </div>
      </form>
    </div>
  );
}
