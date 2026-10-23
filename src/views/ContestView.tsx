import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Trophy, Heart, MessageCircle, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { thumbPath } from '../lib/media';
import { isR2Path, publicUrl } from '../lib/storage';
import { CONTEST, phaseOf, type Contest, type Entry } from '../lib/contest';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ShareButton } from '../components/ShareButton';
import { Avatar, Empty, Loading, PageHeader } from '../components/ui';

interface MyPost { id: string; kind: 'photo' | 'video'; title: string; media_path: string }

function Thumb({ kind, path, title }: { kind: 'photo' | 'video'; path: string; title: string }) {
  const full = publicUrl('media-public', path);
  const [src, setSrc] = useState(() => publicUrl('media-public', kind === 'photo' ? thumbPath(path) : path));
  if (kind === 'photo') {
    return <img src={src} alt={title} loading="lazy" className="h-full w-full object-cover" onError={() => { if (src !== full) setSrc(full); }} />;
  }
  if (isR2Path(path)) return <video src={`${full}#t=0.5`} muted playsInline preload="metadata" aria-label={title} className="h-full w-full object-cover" />;
  return <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-white"><Play className="h-5 w-5 fill-white" aria-hidden="true" /></span>;
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const ADMIN = {
  en: { title: 'Contest (admin)', save: 'Save contest', create: 'New contest', t: 'Title', th: 'Theme', pr: 'Prize (e.g. $100 cash)', ru: 'Rules', st: 'Starts', en: 'Ends', dq: 'Remove', saved: 'Saved', hint: 'Saving with an existing contest changes it; “New contest” starts a separate one.' },
  fr: { title: 'Concours (admin)', save: 'Enregistrer', create: 'Nouveau concours', t: 'Titre', th: 'Thème', pr: 'Prix (ex. 100 $ comptant)', ru: 'Règlement', st: 'Début', en: 'Fin', dq: 'Retirer', saved: 'Enregistré', hint: 'Enregistrer modifie le concours actuel ; « Nouveau concours » en démarre un autre.' },
} as const;

/** One contest at a time: people enter a photo or video, the audience likes and comments, and the live ranking shows the winner. */
export function ContestView() {
  const { user, openAuth } = useAuth();
  const { lang } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const w = CONTEST[lang];
  const A = lang === 'fr' ? ADMIN.fr : ADMIN.en;

  const [contest, setContest] = useState<Contest | null>(null);
  const [board, setBoard] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<MyPost[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [form, setForm] = useState({ id: '', title: '', theme: '', prize: '', rules: '', starts: '', ends: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('contest_current');
    const c = Array.isArray(data) ? ((data[0] as Contest | undefined) ?? null) : null;
    setContest(c);
    if (c) {
      const { data: rows } = await supabase.rpc('contest_board', { p_contest: c.id });
      setBoard(Array.isArray(rows) ? (rows as Entry[]) : []);
      setForm({ id: c.id, title: c.title, theme: c.theme, prize: c.prize, rules: c.rules, starts: toLocalInput(c.starts_at), ends: toLocalInput(c.ends_at) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!user) { setAdmin(false); return; }
    void supabase.rpc('is_admin').then(({ data }) => setAdmin(data === true));
  }, [user]);

  const entry = user ? board.find((e) => e.author_id === user.id) : undefined;
  const phase = contest ? phaseOf(contest) : 'soon';

  useEffect(() => {
    if (!user || !contest || phase !== 'open' || entry) return;
    void supabase.from('posts').select('id,kind,title,media_path')
      .eq('author_id', user.id).in('kind', ['photo', 'video']).eq('media_bucket', 'media-public').eq('download_price', 0)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setMine((data ?? []) as MyPost[]));
  }, [user, contest, phase, entry]);

  const enter = async (postId: string) => {
    if (!contest || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('enter_contest', { p_contest: contest.id, p_post: postId });
    setBusy(false);
    if (error) {
      const m = error.message ?? '';
      toast(m.includes('already_entered') ? w.errAlready : m.includes('ended') || m.includes('not_started') ? w.errClosed : w.errGeneric, 'error');
      return;
    }
    toast(w.thanks, 'info');
    void load();
  };

  const save = async (asNew: boolean) => {
    const { error } = await supabase.rpc('admin_save_contest', {
      p_id: asNew ? null : form.id || null, p_title: form.title, p_theme: form.theme, p_prize: form.prize, p_rules: form.rules,
      p_starts: new Date(form.starts).toISOString(), p_ends: new Date(form.ends).toISOString(),
    });
    if (error) { toast(error.message, 'error'); return; }
    toast(A.saved, 'info');
    setCreating(false);
    void load();
  };

  const disqualify = async (postId: string) => {
    if (!contest) return;
    await supabase.rpc('admin_disqualify_entry', { p_contest: contest.id, p_post: postId, p_flag: true });
    void load();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
  const field = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900';

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={contest?.title ?? w.nav} sub={contest?.theme || undefined}
        action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" />{w.refresh}</button>} />

      {!contest && <Empty text={w.none} />}

      {contest && (
        <>
          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-zinc-900">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold"><Trophy className="h-5 w-5 text-accent" aria-hidden="true" />{contest.prize || w.nav}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{phase === 'soon' ? w.soon : phase === 'open' ? w.open : w.ended}</span>
              <span className="text-zinc-600">{phase === 'soon' ? `${w.startsOn} ${fmt(contest.starts_at)}` : `${w.endsOn} ${fmt(contest.ends_at)}`}</span>
            </div>
            <h2 className="mt-4 text-sm font-semibold">{w.how}</h2>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
              <li>{w.step1}</li><li>{w.step2}</li><li>{w.step3}</li>
            </ol>
            {contest.rules && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">{w.rulesTitle}</summary>
                <p className="mt-2 whitespace-pre-line text-zinc-700">{contest.rules}</p>
              </details>
            )}
          </section>

          {phase === 'ended' && board[0] && (
            <section className="rounded-2xl border border-accent bg-white p-4 text-zinc-900">
              <p className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-5 w-5 text-accent" aria-hidden="true" />{w.winner}</p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar p={{ display_name: board[0].author_name, avatar_url: board[0].author_avatar }} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{board[0].author_name}</p>
                  <p className="truncate text-sm text-zinc-600">{board[0].title} · {board[0].score}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{w.winnerNote}</p>
            </section>
          )}

          {phase === 'open' && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900" aria-label={w.enter}>
              <h2 className="text-sm font-semibold">{w.enter}</h2>
              {!user ? (
                <button type="button" className="btn btn-accent mt-3" onClick={() => openAuth('signup')}>{w.signup}</button>
              ) : entry ? (
                <p className="mt-2 text-sm text-zinc-700">{w.entered}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-zinc-600">{w.enterHelp}</p>
                  {mine === null ? <Loading /> : mine.length === 0 ? (
                    <div className="mt-3 space-y-3"><p className="text-sm text-zinc-600">{w.noPosts}</p>
                      <button type="button" className="btn btn-accent" onClick={() => go('create')}>{w.upload}</button></div>
                  ) : (
                    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {mine.map((p) => (
                        <li key={p.id} className="overflow-hidden rounded-xl border border-zinc-200">
                          <div className="aspect-[4/5] bg-zinc-200"><Thumb kind={p.kind} path={p.media_path} title={p.title} /></div>
                          <button type="button" disabled={busy} className="btn btn-accent btn-sm w-full rounded-none" onClick={() => void enter(p.id)}>{busy ? w.entering : w.pick}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}
          {phase === 'soon' && <p className="text-sm text-zinc-600">{w.closed}</p>}

          <section aria-label={w.board}>
            <h2 className="mb-3 text-lg font-semibold">{w.board}</h2>
            {board.length === 0 ? <Empty text={w.empty} /> : (
              <ol className="space-y-3">
                {board.map((e) => (
                  <li key={e.post_id} className={`flex items-center gap-3 rounded-2xl border bg-white p-2 text-zinc-900 ${e.author_id === user?.id ? 'border-accent' : 'border-zinc-200'}`}>
                    <span className="w-8 shrink-0 text-center text-lg font-bold">{e.rank}</span>
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-200"><Thumb kind={e.kind} path={e.media_path} title={e.title} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.title || e.author_name}</p>
                      <p className="truncate text-xs text-zinc-600">{e.author_name}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-600">
                        <span className="inline-flex items-center gap-1" title={w.likes}><Heart className="h-3.5 w-3.5" aria-hidden="true" />{e.likes}</span>
                        <span className="inline-flex items-center gap-1" title={w.commenters}><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{e.commenters}</span>
                        <span className="font-semibold text-zinc-900">{w.score}: {e.score}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('post', e.post_id)}><ExternalLink className="h-4 w-4" aria-hidden="true" />{w.view}</button>
                      {phase !== 'ended' && <ShareButton type="post" id={e.post_id} title={e.title || e.author_name} />}
                      {admin && <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void disqualify(e.post_id)}>{A.dq}</button>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {admin && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900" aria-label={A.title}>
          <h2 className="text-sm font-semibold">{A.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{A.hint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs sm:col-span-2">{A.t}<input className={field} value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="text-xs">{A.th}<input className={field} value={form.theme} maxLength={200} onChange={(e) => setForm({ ...form, theme: e.target.value })} /></label>
            <label className="text-xs">{A.pr}<input className={field} value={form.prize} maxLength={120} onChange={(e) => setForm({ ...form, prize: e.target.value })} /></label>
            <label className="text-xs">{A.st}<input type="datetime-local" className={field} value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} /></label>
            <label className="text-xs">{A.en}<input type="datetime-local" className={field} value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} /></label>
            <label className="text-xs sm:col-span-2">{A.ru}<textarea className={field} rows={5} value={form.rules} maxLength={3000} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {contest && !creating && <button type="button" className="btn btn-accent btn-sm" disabled={!form.title || !form.starts || !form.ends} onClick={() => void save(false)}>{A.save}</button>}
            <button type="button" className="btn btn-ghost btn-sm" disabled={creating && (!form.title || !form.starts || !form.ends)}
              onClick={() => { if (!creating && contest) { setCreating(true); setForm({ id: '', title: '', theme: '', prize: '', rules: '', starts: '', ends: '' }); } else void save(true); }}>
              {creating || !contest ? A.save : A.create}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
