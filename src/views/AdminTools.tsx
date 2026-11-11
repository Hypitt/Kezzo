import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, EyeOff, Search as SearchIcon, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminText } from '../lib/adminText';
import type { ContestRow } from '../lib/contestHub';
import { useI18n } from '../state/I18n';
import { useRouter, type Tab } from '../state/Router';
import { useToast } from '../state/Toast';
import { Avatar, Chip, Empty, Loading } from '../components/ui';

/** Moderation tools for Kezzo admins. Every action is checked and logged in the database. */

const card = 'rounded-xl border border-zinc-200 bg-white p-3 text-zinc-900';
const tag = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold';

interface Overview { open_reports: number; restricted_users: number; contests_open: number; contests_hidden: number; actions_24h: number; members: number }
interface ReportRow { target_type: string; target_id: string; report_count: number; last_at: string; reason: string; resolved: boolean; resolution: string | null; preview: string | null; owner_id: string | null; owner_name: string | null; owner_status: string | null }
interface UserRow { id: string; handle: string; display_name: string; avatar_url: string | null; created_at: string; posts: number; open_reports: number; status: 'suspended' | 'banned' | null; until: string | null; reason: string | null; is_admin: boolean }
interface ContentRow { id: string; kind: string; title: string; author_id: string; author_name: string; created_at: string; post_id: string | null; reports: number }
interface LogRow { id: string; created_at: string; admin_name: string | null; action: string; target_type: string | null; target_id: string | null; detail: string }

const when = (iso: string, lang: string) => new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });

/** Where an item can be opened in the app. */
function useOpen() {
  const { go } = useRouter();
  return (type: string, id: string, postId?: string | null) => {
    const map: Record<string, Tab> = { post: 'post', profile: 'profile', battle: 'battles', group: 'groups', opportunity: 'opportunities', listing: 'market' };
    if (type === 'comment' && postId) return go('post', postId);
    if (map[type]) go(map[type], id);
  };
}
const canOpen = (type: string, postId?: string | null) => ['post', 'profile', 'battle', 'group', 'opportunity'].includes(type) || (type === 'comment' && Boolean(postId));

function Row({ children }: { children: ReactNode }) {
  return <li className={`${card} flex flex-wrap items-center gap-x-3 gap-y-2`}>{children}</li>;
}

/** Suspend, ban or restore one member. */
function RestrictButtons({ userId, status, onDone }: { userId: string; status: string | null; onDone: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const a = adminText(lang);
  const run = async (next: 'active' | 'suspended' | 'banned', days: number | null) => {
    let reason = '';
    if (next === 'banned' && !window.confirm(a.banAsk)) return;
    if (next === 'suspended' && !window.confirm(a.suspendAsk)) return;
    if (next !== 'active') reason = window.prompt(a.reasonAsk) ?? '';
    const { error } = await supabase.rpc('admin_set_user_status', { p_user: userId, p_status: next, p_reason: reason, p_days: days });
    if (error) return toast(a.err, 'error');
    toast(a.done);
    onDone();
  };
  return status ? (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run('active', null)}>{a.restore}</button>
  ) : (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run('suspended', 7)}>{a.suspend7}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run('suspended', 30)}>{a.suspend30}</button>
      <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void run('banned', null)}>{a.ban}</button>
    </>
  );
}

export function AdminOverview({ onTab }: { onTab: (t: string) => void }) {
  const { lang } = useI18n();
  const a = adminText(lang);
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => { void supabase.rpc('admin_overview').then(({ data }) => setO((data as Overview | null) ?? null)); }, []);
  if (!o) return <Loading />;
  const tile = (label: string, value: number, tab: string, alert = false) => (
    <button type="button" onClick={() => onTab(tab)} className={`${card} text-left hover:border-zinc-400 ${alert && value > 0 ? 'border-zinc-900' : ''}`}>
      <span className="block text-xs text-zinc-600">{label}</span>
      <span className="mt-1 block text-2xl font-semibold tabular-nums">{value}</span>
    </button>
  );
  return (
    <div className="space-y-5">
      {o.open_reports > 0 ? (
        <button type="button" onClick={() => onTab('reports')} className="flex w-full items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-semibold text-white">
          <span>{a.needsAttention}: {o.open_reports} {a.openReports.toLowerCase()}</span><span aria-hidden="true">→</span>
        </button>
      ) : <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600">{a.allClear}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tile(a.openReports, o.open_reports, 'reports', true)}
        {tile(a.restricted, o.restricted_users, 'users')}
        {tile(a.members, o.members, 'users')}
        {tile(a.contestsOpen, o.contests_open, 'contests')}
        {tile(a.contestsHidden, o.contests_hidden, 'contests')}
        {tile(a.actions24, o.actions_24h, 'log')}
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">{a.quick}</h2>
        <div className="flex flex-wrap gap-2">
          {([['reports', a.goReports], ['users', a.goUsers], ['content', a.goContent], ['contests', a.goContests], ['analytics', a.goAnalytics], ['site', a.goSite]] as const).map(([t, label]) => (
            <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => onTab(t)}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminReports({ onChanged }: { onChanged: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const a = adminText(lang);
  const open = useOpen();
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_reports', { p_status: status, p_limit: 100 });
    setRows(Array.isArray(data) ? (data as ReportRow[]) : []);
  }, [status]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  const typeName = (t: string) => ({ post: a.tPost, profile: a.tProfile, battle: a.tBattle, group: a.tGroup, message: a.tMessage, opportunity: a.tOpportunity } as Record<string, string>)[t] ?? t;

  const refresh = () => { void load(); onChanged(); };
  const dismiss = async (r: ReportRow) => {
    const { error } = await supabase.rpc('admin_resolve_reports', { p_type: r.target_type, p_id: r.target_id, p_resolution: 'dismissed' });
    if (error) return toast(a.err, 'error');
    refresh();
  };
  const remove = async (r: ReportRow) => {
    if (!window.confirm(a.removeAsk)) return;
    const { error } = await supabase.rpc('admin_remove_content', { p_type: r.target_type, p_id: r.target_id, p_reason: r.reason });
    if (error) return toast(a.err, 'error');
    toast(a.done);
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([['open', a.rOpen], ['resolved', a.rResolved], ['all', a.rAll]] as const).map(([k, l]) => <Chip key={k} active={status === k} onClick={() => setStatus(k)}>{l}</Chip>)}
      </div>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty text={a.noReports} /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <Row key={`${r.target_type}:${r.target_id}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`${tag} bg-zinc-900 text-white`}>{typeName(r.target_type)}</span>
                  <span className={`${tag} bg-zinc-100 text-zinc-700`}>{r.reason}</span>
                  <span className="text-zinc-500">{r.report_count} {a.reportsN} · {when(r.last_at, lang)}</span>
                  {r.resolved && <span className={`${tag} bg-emerald-100 text-emerald-800`}>{a.resolvedAs}{r.resolution ? `: ${r.resolution}` : ''}</span>}
                </p>
                <p className="mt-1 truncate text-sm font-medium">{r.preview ?? a.gone}</p>
                {r.owner_name && (
                  <p className="text-xs text-zinc-600">{a.by} {r.owner_name}
                    {r.owner_status && <span className={`${tag} ml-2 bg-red-100 text-red-700`}>{r.owner_status === 'banned' ? a.banned : a.suspended}</span>}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canOpen(r.target_type) && r.preview !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(r.target_type, r.target_id)}>{a.view}</button>}
                {!r.resolved && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void dismiss(r)}><Check className="h-4 w-4" aria-hidden="true" />{a.dismiss}</button>}
                {!r.resolved && r.target_type !== 'profile' && r.preview !== null && <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" aria-hidden="true" />{a.remove}</button>}
                {!r.resolved && r.owner_id && <RestrictButtons userId={r.owner_id} status={r.owner_status} onDone={refresh} />}
              </div>
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUsers() {
  const { lang } = useI18n();
  const a = adminText(lang);
  const open = useOpen();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'restricted' | 'reported'>('all');
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [more, setMore] = useState(false);
  const PAGE = 40;

  const load = useCallback(async (offset: number) => {
    const { data } = await supabase.rpc('admin_users', { p_q: term, p_filter: filter, p_limit: PAGE, p_offset: offset });
    const list = Array.isArray(data) ? (data as UserRow[]) : [];
    setMore(list.length === PAGE);
    setRows((old) => (offset === 0 ? list : [...(old ?? []), ...list]));
  }, [term, filter]);
  useEffect(() => { setRows(null); void load(0); }, [load]);

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={a.searchUsers} aria-label={a.searchUsers} />
        <button className="btn btn-primary" aria-label={a.search}><SearchIcon className="h-4 w-4" aria-hidden="true" /></button>
      </form>
      <div className="flex gap-2">
        {([['all', a.fAll], ['restricted', a.fRestricted], ['reported', a.fReported]] as const).map(([k, l]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}
      </div>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty text={a.noUsers} /> : (
        <ul className="space-y-2">
          {rows.map((u) => (
            <Row key={u.id}>
              <Avatar p={{ display_name: u.display_name, avatar_url: u.avatar_url }} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{u.display_name}</span>
                  <span className="text-xs font-normal text-zinc-500">@{u.handle}</span>
                  {u.is_admin && <span className={`${tag} bg-zinc-900 text-white`}>{a.adminTag}</span>}
                  {u.status && <span className={`${tag} bg-red-100 text-red-700`}>{u.status === 'banned' ? a.banned : `${a.suspended}${u.until ? ` ${a.until} ${new Date(u.until).toLocaleDateString(lang)}` : ''}`}</span>}
                </p>
                <p className="text-xs text-zinc-600">{a.joined} {new Date(u.created_at).toLocaleDateString(lang)} · {u.posts} {a.posts}{u.open_reports > 0 ? ` · ${u.open_reports} ${a.reportsShort}` : ''}</p>
                {u.reason && <p className="truncate text-xs text-zinc-500">{u.reason}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => open('profile', u.id)}>{a.viewProfile}</button>
                {!u.is_admin && <RestrictButtons userId={u.id} status={u.status} onDone={() => void load(0)} />}
              </div>
            </Row>
          ))}
        </ul>
      )}
      {more && <button type="button" className="btn btn-ghost w-full" onClick={() => void load(rows?.length ?? 0)}>{a.more}</button>}
    </div>
  );
}

export function AdminContent({ onChanged }: { onChanged: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const a = adminText(lang);
  const open = useOpen();
  const [type, setType] = useState<'post' | 'comment' | 'group' | 'battle' | 'opportunity'>('post');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<ContentRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_content', { p_type: type, p_q: term, p_limit: 50 });
    setRows(Array.isArray(data) ? (data as ContentRow[]) : []);
  }, [type, term]);
  useEffect(() => { setRows(null); void load(); }, [load]);

  const remove = async (r: ContentRow) => {
    if (!window.confirm(a.removeAsk)) return;
    const { error } = await supabase.rpc('admin_remove_content', { p_type: type, p_id: r.id, p_reason: '' });
    if (error) return toast(a.err, 'error');
    toast(a.done);
    setRows((l) => (l ?? []).filter((x) => x.id !== r.id));
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([['post', a.tPost], ['comment', a.tComment], ['group', a.tGroup], ['battle', a.tBattle], ['opportunity', a.tOpportunity]] as const).map(([k, l]) => <Chip key={k} active={type === k} onClick={() => setType(k)}>{l}</Chip>)}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={a.searchContent} aria-label={a.searchContent} />
        <button className="btn btn-primary" aria-label={a.search}><SearchIcon className="h-4 w-4" aria-hidden="true" /></button>
      </form>
      <p className="text-xs text-zinc-500">{a.contentNote}</p>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty text={a.noContent} /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-zinc-600">{a.by} {r.author_name} · {when(r.created_at, lang)}{r.reports > 0 ? ` · ${r.reports} ${a.reportsN}` : ''}</p>
              </div>
              <div className="flex gap-2">
                {canOpen(type, r.post_id) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(type, r.id, r.post_id)}>{a.view}</button>}
                <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" aria-hidden="true" />{a.remove}</button>
              </div>
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminContests({ onChanged }: { onChanged: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const a = adminText(lang);
  const [rows, setRows] = useState<ContestRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('contest_list');
    setRows(Array.isArray(data) ? (data as ContestRow[]) : []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (c: ContestRow) => {
    const { error } = await supabase.rpc('admin_hide_contest', { p_id: c.id, p_hidden: !c.hidden });
    if (error) return toast(a.err, 'error');
    void load(); onChanged();
  };
  const del = async (c: ContestRow) => {
    if (!window.confirm(a.delContestAsk)) return;
    const { error } = await supabase.rpc('delete_contest', { p_id: c.id });
    if (error) return toast(a.err, 'error');
    void load(); onChanged();
  };
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty text={a.noContests} />;
  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <Row key={c.id}>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{c.title}</span>
              {c.hidden && <span className={`${tag} bg-red-100 text-red-700`}><EyeOff className="mr-1 h-3 w-3" aria-hidden="true" />{a.hidden}</span>}
            </p>
            <p className="text-xs text-zinc-600">{c.phase} · {c.entries} {a.entries} · {c.official ? a.official : `${a.by} ${c.owner_name ?? '–'}`} · {new Date(c.ends_at).toLocaleDateString(lang)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('contest', c.id)}>{a.open}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggle(c)}>{c.hidden ? a.show : a.hide}</button>
            <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void del(c)}>{a.del}</button>
          </div>
        </Row>
      ))}
    </ul>
  );
}

export function AdminLog() {
  const { lang } = useI18n();
  const a = adminText(lang);
  const [rows, setRows] = useState<LogRow[] | null>(null);
  useEffect(() => { void supabase.rpc('admin_log', { p_limit: 150 }).then(({ data }) => setRows(Array.isArray(data) ? (data as LogRow[]) : [])); }, []);
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty text={a.noLog} />;
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-zinc-600"><tr><th className="py-1 pr-3">{a.logWhen}</th><th className="pr-3">{a.logWho}</th><th className="pr-3">{a.logWhat}</th><th>{a.logOn}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 align-top">
              <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-zinc-600">{when(r.created_at, lang)}</td>
              <td className="pr-3">{r.admin_name ?? '–'}</td>
              <td className="pr-3 font-medium">{r.action}</td>
              <td className="text-xs text-zinc-600">{r.target_type ?? ''}{r.detail ? ` · ${r.detail}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
