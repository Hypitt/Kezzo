import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { HUB, contestError, toLocalInput, type ContestRow } from '../lib/contestHub';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';

const field = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900';

/** Start or edit a contest. Members and admins use the same form; the database applies the limits. */
export function ContestForm({ contest, onSaved, onCancel }: { contest?: ContestRow; onSaved: (id: string) => void; onCancel: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const h = HUB[lang];
  const soon = new Date(Date.now() + 3600000);
  const week = new Date(Date.now() + 7 * 86400000 + 3600000);
  const [f, setF] = useState({
    title: contest?.title ?? '', theme: contest?.theme ?? '', prize: contest?.prize ?? '', rules: contest?.rules ?? '',
    starts: contest ? toLocalInput(contest.starts_at) : toLocalInput(soon.toISOString()),
    ends: contest ? toLocalInput(contest.ends_at) : toLocalInput(week.toISOString()),
  });
  const [busy, setBusy] = useState(false);
  const ready = f.title.trim().length >= 3 && f.starts !== '' && f.ends !== '';

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('save_contest', {
      p_id: contest?.id ?? null, p_title: f.title.trim(), p_theme: f.theme.trim(), p_prize: f.prize.trim(), p_rules: f.rules.trim(),
      p_starts: new Date(f.starts).toISOString(), p_ends: new Date(f.ends).toISOString(),
    });
    setBusy(false);
    if (error) return toast(contestError(error.message, h), 'error');
    toast(h.saved);
    onSaved((data as string | null) ?? contest?.id ?? '');
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900" aria-label={contest ? h.editTitle : h.newTitle}>
      <h2 className="text-sm font-semibold">{contest ? h.editTitle : h.newTitle}</h2>
      <p className="mt-1 text-xs text-zinc-500">{h.fHint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">{h.fTitle}<input className={field} value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="text-xs">{h.fTheme}<input className={field} value={f.theme} maxLength={200} onChange={(e) => setF({ ...f, theme: e.target.value })} /></label>
        <label className="text-xs">{h.fPrize}<input className={field} value={f.prize} maxLength={120} onChange={(e) => setF({ ...f, prize: e.target.value })} /></label>
        <label className="text-xs">{h.fStarts}<input type="datetime-local" className={field} value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} /></label>
        <label className="text-xs">{h.fEnds}<input type="datetime-local" className={field} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></label>
        <label className="text-xs sm:col-span-2">{h.fRules}<textarea className={field} rows={5} value={f.rules} maxLength={3000} onChange={(e) => setF({ ...f, rules: e.target.value })} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" disabled={!ready || busy} onClick={() => void save()}>{h.save}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{h.cancel}</button>
      </div>
    </section>
  );
}
