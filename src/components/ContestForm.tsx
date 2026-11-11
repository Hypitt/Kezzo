import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { HUB, WIN, contestError, toLocalInput, type ContestRow } from '../lib/contestHub';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';

const field = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900';

/** Start or edit a contest. Members and admins use the same form; the database applies the limits. */
export function ContestForm({ contest, onSaved, onCancel }: { contest?: ContestRow; onSaved: (id: string) => void; onCancel: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const h = HUB[lang];
  const x = WIN[lang];
  const soon = new Date(Date.now() + 3600000);
  const week = new Date(Date.now() + 7 * 86400000 + 3600000);
  const [f, setF] = useState({
    title: contest?.title ?? '', theme: contest?.theme ?? '', prize: contest?.prize ?? '', rules: contest?.rules ?? '',
    starts: contest ? toLocalInput(contest.starts_at) : toLocalInput(soon.toISOString()),
    ends: contest ? toLocalInput(contest.ends_at) : toLocalInput(week.toISOString()),
    winners: contest?.winner_count ?? 1,
    places: Array.from({ length: 10 }, (_, i) => contest?.place_prizes?.[i] ?? ''),
  });
  const [busy, setBusy] = useState(false);
  const ready = f.title.trim().length >= 3 && f.starts !== '' && f.ends !== '';

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('save_contest', {
      p_id: contest?.id ?? null, p_title: f.title.trim(), p_theme: f.theme.trim(), p_prize: f.prize.trim(), p_rules: f.rules.trim(),
      p_starts: new Date(f.starts).toISOString(), p_ends: new Date(f.ends).toISOString(),
      p_winner_count: f.winners, p_place_prizes: f.places.slice(0, f.winners).map((v) => v.trim()),
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
        <label className="text-xs sm:col-span-2">{x.howMany}
          <select className={field} value={f.winners} onChange={(e) => setF({ ...f, winners: Number(e.target.value) })}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-zinc-500">{x.howManyHelp}</span>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs">{x.prizesTitle}</legend>
          <p className="text-[11px] text-zinc-500">{x.prizesHelp}</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {f.places.slice(0, f.winners).map((v, i) => (
              <input key={i} className={field} value={v} maxLength={80} placeholder={x.prizeFor(i + 1)} aria-label={x.prizeFor(i + 1)}
                onChange={(e) => setF({ ...f, places: f.places.map((p, j) => (j === i ? e.target.value : p)) })} />
            ))}
          </div>
        </fieldset>
        <label className="text-xs sm:col-span-2">{h.fRules}<textarea className={field} rows={5} value={f.rules} maxLength={3000} onChange={(e) => setF({ ...f, rules: e.target.value })} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" disabled={!ready || busy} onClick={() => void save()}>{h.save}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{h.cancel}</button>
      </div>
    </section>
  );
}
