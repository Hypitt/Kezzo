import { useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { isSafe } from '../lib/moderation';
import { timeAgo } from '../lib/format';
import type { PollView } from '../lib/polls';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Avatar, Spinner } from './ui';
import { ShareButton } from './ShareButton';
import { useTranslated } from '../lib/translate';
import { TranslationNote } from './TranslationNote';

/** One poll: vote while it is open, see the results after voting or once it is closed. */
export function PollCard({ poll, onChange, showShare = true }: { poll: PollView; onChange: () => void; showShare?: boolean }) {
  const { user, ensureAuth } = useAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const showResults = !poll.open || poll.myOption !== null;
  const mine = user?.id === poll.author_id;
  const tx = useTranslated([poll.question, ...poll.options.map((o) => o.label)], !mine, true);

  const vote = async (optionId: string) => {
    if (!ensureAuth() || busy || optionId === poll.myOption) return;
    setBusy(optionId);
    const { error } = await supabase.rpc('vote_poll', { p_option: optionId });
    setBusy(null);
    if (error) toast(explain(error, t), 'error');
    onChange();
  };
  const remove = async () => {
    if (!window.confirm(t('confirm_delete'))) return;
    const { error } = await supabase.from('polls').delete().eq('id', poll.id);
    if (error) return toast(t('error_generic'), 'error');
    onChange();
  };

  return (
    <article className="card space-y-3">
      <header className="flex items-center gap-2.5">
        <Avatar p={poll.author} size={32} />
        <p className="min-w-0 flex-1 truncate text-xs text-zinc-500"><span className="font-semibold text-zinc-800">{poll.author.display_name}</span> · {timeAgo(poll.created_at, lang)}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${poll.open ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600'}`}>{t(poll.open ? 'poll_open' : 'poll_closed')}</span>
      </header>
      <h3 className="text-base font-semibold">{tx.out[0]}</h3>
      <ul className="space-y-2">
        {poll.options.map((o, oi) => {
          const pct = poll.total > 0 ? Math.round((o.votes / poll.total) * 100) : 0;
          const mineOpt = poll.myOption === o.id;
          return (
            <li key={o.id}>
              <button
                type="button" disabled={!poll.open || busy !== null} onClick={() => void vote(o.id)} aria-pressed={mineOpt}
                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm ${mineOpt ? 'border-accent' : 'border-zinc-200'} ${poll.open ? 'hover:bg-zinc-50' : 'cursor-default'}`}
              >
                {showResults && <span className="absolute inset-y-0 left-0 bg-zinc-100" style={{ width: `${pct}%` }} aria-hidden="true" />}
                <span className="relative flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words">{tx.out[oi + 1]}{mineOpt && <span className="ml-1.5 text-xs font-semibold text-accent">{t('poll_your_vote')}</span>}</span>
                  {busy === o.id ? <Spinner /> : showResults && <span className="shrink-0 text-xs tabular-nums text-zinc-600">{pct}% · {o.votes}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <TranslationNote tx={tx} />
      <footer className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>{t('poll_votes_n', { n: poll.total })}{poll.closes_at && poll.open ? ` · ${t('poll_closes', { when: new Date(poll.closes_at).toLocaleString(lang) })}` : ''}</span>
        <span className="flex-1" />
        {showShare && <ShareButton type="poll" id={poll.id} title={poll.question} />}
        {mine && <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove()}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t('delete')}</button>}
      </footer>
    </article>
  );
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const DURATIONS: [string, number | null][] = [['poll_dur_none', null], ['poll_dur_1h', 3600], ['poll_dur_24h', 86400], ['poll_dur_7d', 604800]];

/** Create a poll. With `liveId` it is shown inside that live stream and closes when the stream ends. */
export function PollForm({ liveId, onCreated }: { liveId?: string; onCreated: (id: string) => void }) {
  const { ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [dur, setDur] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    setError(null);
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return setError(t('poll_err_question'));
    if (clean.length < MIN_OPTIONS) return setError(t('poll_err_options'));
    if (!isSafe(question) || clean.some((o) => !isSafe(o))) return setError(t('blocked_content'));
    setBusy(true);
    const { data, error: err } = await supabase.rpc('create_poll', {
      p_question: question.trim(), p_options: clean, p_live: liveId ?? null,
      p_closes: dur ? new Date(Date.now() + dur * 1000).toISOString() : null,
    });
    setBusy(false);
    if (err) return setError(explain(err, t));
    toast(t('poll_created'));
    setQuestion('');
    setOptions(['', '']);
    onCreated(String(data));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="poll-q">{t('poll_question')}</label>
        <input id="poll-q" className="input" value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <span className="label">{t('poll_answers')}</span>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" value={o} maxLength={80} placeholder={t('poll_answer_n', { n: i + 1 })} aria-label={t('poll_answer_n', { n: i + 1 })}
              onChange={(e) => setOptions((l) => l.map((x, idx) => (idx === i ? e.target.value : x)))} />
            {options.length > MIN_OPTIONS && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOptions((l) => l.filter((_, idx) => idx !== i))} aria-label={t('remove')}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
            )}
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOptions((l) => [...l, ''])}><Plus className="h-3.5 w-3.5" aria-hidden="true" />{t('poll_add_answer')}</button>
        )}
      </div>
      {!liveId && (
        <div>
          <label className="label" htmlFor="poll-d">{t('poll_duration')}</label>
          <select id="poll-d" className="input" value={dur ?? ''} onChange={(e) => setDur(e.target.value ? Number(e.target.value) : null)}>
            {DURATIONS.map(([k, v]) => <option key={k} value={v ?? ''}>{t(k as never)}</option>)}
          </select>
        </div>
      )}
      {liveId && <p className="text-xs text-zinc-500">{t('poll_live_hint')}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{t('poll_publish')}</button>
    </form>
  );
}
