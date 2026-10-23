import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Pencil, RefreshCw, Trash2, Trophy, Heart, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { thumbPath } from '../lib/media';
import { removePublic } from '../lib/storage';
import { loadPosts, newSeed } from '../lib/data';
import type { Post } from '../lib/types';
import { Thumb } from '../components/ContestThumb';
import { PostCard } from '../components/PostCard';
import { ContestBadge } from '../components/ContestBadge';
import { CONTEST, phaseOf, type Contest, type Entry } from '../lib/contest';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ShareButton } from '../components/ShareButton';
import { Avatar, Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

interface AdminEntry { post_id: string; title: string; author_name: string; likes: number; commenters: number; score: number; disqualified: boolean }
interface MyPost { id: string; kind: 'photo' | 'video'; title: string; media_path: string }

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const ADMIN = {
  en: { title: 'Contest (admin)', save: 'Save contest', create: 'New contest', t: 'Title', th: 'Theme', pr: 'Prize (e.g. $100 cash)', ru: 'Rules', st: 'Starts', en: 'Ends', dq: 'Remove', saved: 'Saved', restore: 'Restore', removedTag: 'Removed', entriesTitle: 'All entries', endNow: 'End now', plus1: '+1 day', plus7: '+7 days', del: 'Delete this contest', delAsk: 'Delete this contest and its entries? The posts stay on Kezzo.', stats: (n: number, l: number, c: number) => `${n} entries · ${l} likes · ${c} commenters`, hint: 'Saving with an existing contest changes it; “New contest” starts a separate one.' },
  fr: { title: 'Concours (admin)', save: 'Enregistrer', create: 'Nouveau concours', t: 'Titre', th: 'Thème', pr: 'Prix (ex. 100 $ comptant)', ru: 'Règlement', st: 'Début', en: 'Fin', dq: 'Retirer', saved: 'Enregistré', restore: 'Rétablir', removedTag: 'Retirée', entriesTitle: 'Toutes les participations', endNow: 'Terminer maintenant', plus1: '+1 jour', plus7: '+7 jours', del: 'Supprimer ce concours', delAsk: 'Supprimer ce concours et ses participations ? Les publications restent sur Kezzo.', stats: (n: number, l: number, c: number) => `${n} participations · ${l} j’aime · ${c} commentateurs`, hint: 'Enregistrer modifie le concours actuel ; « Nouveau concours » en démarre un autre.' },
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
  const [mineDetail, setMineDetail] = useState<{ title: string; body: string } | null>(null);
  const [editing, setEditing] = useState<{ title: string; body: string } | null>(null);
  const [allEntries, setAllEntries] = useState<AdminEntry[]>([]);
  const isAdmin = useRef(false);
  const [tab, setTab] = useState<'vote' | 'rank'>('vote');
  const [posts, setPosts] = useState<Post[]>([]);
  const [shown, setShown] = useState(6);
  const seed = useRef(newSeed());

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('contest_current');
    const c = Array.isArray(data) ? ((data[0] as Contest | undefined) ?? null) : null;
    setContest(c);
    if (c) {
      const { data: rows } = await supabase.rpc('contest_board', { p_contest: c.id });
      setBoard(Array.isArray(rows) ? (rows as Entry[]) : []);
      if (isAdmin.current) {
        const adm = await supabase.rpc('admin_contest_entries', { p_contest: c.id });
        setAllEntries(!adm.error && Array.isArray(adm.data) ? (adm.data as AdminEntry[]) : []);
      }
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
    void supabase.rpc('is_admin').then(({ data }) => { isAdmin.current = data === true; setAdmin(data === true); if (data === true) void load(); });
  }, [user, load]);

  // The entries as full posts (video player, like, comments), in a random order that stays the same during the visit.
  const boardKey = board.map((e) => e.post_id).join(',');
  useEffect(() => {
    if (!board.length) { setPosts([]); return; }
    let off = false;
    void loadPosts(user?.id ?? null, { ids: board.map((e) => e.post_id), limit: 50 }).then((rows) => {
      if (off) return;
      const key = (id: string) => { let h = 0; for (const ch of id + seed.current) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
      setPosts([...rows].sort((a, b) => key(a.id) - key(b.id)));
    }).catch(() => undefined);
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey, user?.id]);

  const entry = user ? board.find((e) => e.author_id === user.id) : undefined;
  const phase = contest ? phaseOf(contest) : 'soon';
  const ms = contest ? Math.max(0, Date.parse(contest.ends_at) - Date.now()) : 0;
  const left = { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000) };

  useEffect(() => {
    if (!entry) { setMineDetail(null); return; }
    void supabase.from('posts').select('title,body').eq('id', entry.post_id).single()
      .then(({ data }) => setMineDetail(data ? { title: (data.title as string) ?? '', body: (data.body as string) ?? '' } : null));
  }, [entry?.post_id]);

  useEffect(() => {
    if (!user || !contest || phase !== 'open' || entry) return;
    void supabase.from('posts').select('id,kind,title,media_path')
      .eq('author_id', user.id).in('kind', ['photo', 'video']).eq('media_bucket', 'media-public').eq('download_price', 0)
      .gte('created_at', contest.starts_at).order('created_at', { ascending: false }).limit(30)
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

  const saveEdit = async () => {
    if (!entry || !editing || !editing.title.trim()) return;
    const { error } = await supabase.from('posts').update({ title: editing.title.trim(), body: editing.body.trim() }).eq('id', entry.post_id);
    if (error) { toast(w.errGeneric, 'error'); return; }
    setMineDetail({ title: editing.title.trim(), body: editing.body.trim() });
    setEditing(null);
    toast(w.updated);
    void load();
  };

  const withdraw = async () => {
    if (!contest || !window.confirm(w.withdrawAsk)) return;
    const { error } = await supabase.rpc('withdraw_contest_entry', { p_contest: contest.id });
    if (error) { toast(w.errClosed, 'error'); return; }
    toast(w.removed);
    setMine(null);
    void load();
  };

  const deletePost = async () => {
    if (!entry || !window.confirm(w.deleteAsk)) return;
    const { data: row } = await supabase.from('posts').select('media_bucket,media_path,media_extra').eq('id', entry.post_id).single();
    const { error } = await supabase.from('posts').delete().eq('id', entry.post_id);
    if (error) { toast(w.errGeneric, 'error'); return; }
    if (row?.media_bucket === 'media-public' && row.media_path) {
      const files = [row.media_path as string, ...((row.media_extra as string[] | null) ?? []), thumbPath(row.media_path as string)];
      await removePublic('media-public', files);
    }
    toast(w.removed);
    setMine(null);
    void load();
  };

  const setEnd = async (iso: string) => {
    if (!contest) return;
    const { error } = await supabase.rpc('admin_save_contest', {
      p_id: contest.id, p_title: contest.title, p_theme: contest.theme, p_prize: contest.prize, p_rules: contest.rules,
      p_starts: contest.starts_at, p_ends: iso,
    });
    if (error) { toast(error.message, 'error'); return; }
    toast(A.saved);
    void load();
  };
  const plusDays = (d: number) => void setEnd(new Date(Math.max(Date.now(), Date.parse(contest?.ends_at ?? '')) + d * 86400000).toISOString());

  const restore = async (postId: string) => {
    if (!contest) return;
    await supabase.rpc('admin_disqualify_entry', { p_contest: contest.id, p_post: postId, p_flag: false });
    void load();
  };

  const deleteContest = async () => {
    if (!contest || !window.confirm(A.delAsk)) return;
    const { error } = await supabase.rpc('admin_delete_contest', { p_id: contest.id });
    if (error) { toast(error.message, 'error'); return; }
    setContest(null); setBoard([]); setAllEntries([]);
    toast(A.saved);
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
              <span className="text-zinc-600">{w.entriesN(board.length)}</span>
              {phase === 'open' && <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{left.d === 0 && left.h < 6 ? w.lastHours : w.left(left.d, left.h)}</span>}
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
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-zinc-700">{w.entered}</p>
                  <div className="flex gap-3">
                    <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-200"><Thumb kind={entry.kind} path={entry.media_path} title={entry.title} /></div>
                    {editing ? (
                      <div className="min-w-0 flex-1 space-y-2">
                        <input className={field} maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label={w.myEntry} />
                        <textarea className={field} rows={3} maxLength={2000} placeholder={w.desc} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-accent btn-sm" disabled={!editing.title.trim()} onClick={() => void saveEdit()}>{w.save}</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>{w.cancel}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{mineDetail?.title || entry.title}</p>
                        {mineDetail?.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-zinc-600">{mineDetail.body}</p>}
                        <p className="mt-1 text-xs text-zinc-600">{w.score}: {entry.score} · #{entry.rank}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ShareButton type="post" id={entry.post_id} title={mineDetail?.title || entry.title} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('post', entry.post_id)}><ExternalLink className="h-4 w-4" aria-hidden="true" />{w.view}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ title: mineDetail?.title ?? entry.title, body: mineDetail?.body ?? '' })}><Pencil className="h-4 w-4" aria-hidden="true" />{w.edit}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void withdraw()}>{w.withdraw}</button>
                    <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void deletePost()}><Trash2 className="h-4 w-4" aria-hidden="true" />{w.deletePost}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-zinc-600">{w.enterHelp}</p>
                  <button type="button" className="btn btn-accent mt-3" onClick={() => go('create', 'contest')}>{w.uploadNew}</button>
                  {mine !== null && mine.length > 0 && <p className="mt-4 text-sm font-medium">{w.orPick}</p>}
                  {mine === null || mine.length === 0 ? null : (
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

          <div className="flex gap-2">
            <Chip active={tab === 'vote'} onClick={() => setTab('vote')}>{w.tabVote}</Chip>
            <Chip active={tab === 'rank'} onClick={() => setTab('rank')}>{w.tabRank}</Chip>
          </div>

          {tab === 'vote' && (
            <section aria-label={w.tabVote} className="space-y-4">
              <p className="text-sm text-zinc-600">{w.voteHelp}</p>
              {board.length === 0 ? <Empty text={w.empty} /> : posts.slice(0, shown).map((p) => {
                const e = board.find((x) => x.post_id === p.id);
                return (
                  <div key={p.id} className="overflow-hidden rounded-2xl border-2 border-accent bg-orange-50">
                    {e && (
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-zinc-800">
                        <ContestBadge info={{ rank: e.rank, score: e.score, winner: phase === 'ended' && e.rank === 1 }} link={false} />
                        <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{e.likes}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{e.commenters}</span>
                        <span className="font-semibold">{w.score}: {e.score}</span>
                      </div>
                    )}
                    <PostCard post={p}
                      onChange={(next) => setPosts((l) => l.map((x) => (x.id === next.id ? next : x)))}
                      onDelete={(id) => { setPosts((l) => l.filter((x) => x.id !== id)); void load(); }} />
                    {phase === 'open' && <p className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-800"><Heart className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{w.voteHint}</p>}
                  </div>
                );
              })}
              <LoadMore show={posts.length > shown} busy={false} onClick={() => setShown((n) => n + 6)} label={w.more} />
            </section>
          )}

          {tab === 'rank' && <section aria-label={w.board}>
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
          </section>}
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
          {contest && (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <p className="text-xs text-zinc-600">{A.stats(allEntries.length, allEntries.reduce((n, e) => n + e.likes, 0), allEntries.reduce((n, e) => n + e.commenters, 0))}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => plusDays(1)}>{A.plus1}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => plusDays(7)}>{A.plus7}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={phase === 'ended'} onClick={() => void setEnd(new Date().toISOString())}>{A.endNow}</button>
                <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void deleteContest()}>{A.del}</button>
              </div>
              <h3 className="mt-4 text-sm font-semibold">{A.entriesTitle}</h3>
              <ul className="mt-2 divide-y divide-zinc-100 text-sm">
                {allEntries.map((e) => (
                  <li key={e.post_id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate">{e.author_name} · {e.title} · {e.score}{e.disqualified && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{A.removedTag}</span>}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('post', e.post_id)}>{w.view}</button>
                    {e.disqualified
                      ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void restore(e.post_id)}>{A.restore}</button>
                      : <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void disqualify(e.post_id)}>{A.dq}</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
