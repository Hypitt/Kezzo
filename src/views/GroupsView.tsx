import { PENDING_JOIN } from '../lib/invite';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Copy, Crown, Link2, Lock, Mic, RefreshCw, Shield, UserMinus, UserPlus, Users, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { PUBLIC_PROFILE, loadPeople, type PersonRow } from '../lib/data';
import { isSafe } from '../lib/moderation';
import type { Group, GroupMember, GroupRole, PublicProfile } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ChatPanel } from '../components/ChatPanel';
import { LiveRoom } from '../components/LiveRoom';
import { ReportButton } from '../components/ReportButton';
import { Avatar, Chip, Empty, Loading, PageHeader, Spinner } from '../components/ui';

const CATEGORIES = ['dance', 'roasting', 'singing', 'debate', 'comedy', 'other'] as const;

export function GroupsView() {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('dance');
  const [policy, setPolicy] = useState<Group['join_policy']>('open');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').order('member_count', { ascending: false }).limit(60);
    setGroups((data ?? []) as Group[]);
    if (user) {
      const { data: m } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
      setMine(new Set((m ?? []).map((r) => r.group_id as string)));
    } else {
      setMine(new Set());
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth() || !user) return;
    if (!isSafe(name) || !isSafe(tagline)) return toast(t('blocked_content'), 'error');
    setBusy(true);
    const { data, error } = await supabase.from('groups')
      .insert({ owner_id: user.id, name: name.trim(), tagline: tagline.trim(), category, join_policy: policy }).select('id').single();
    setBusy(false);
    if (error || !data) return toast(t('error_generic'), 'error');
    toast(t('group_created'));
    go('groups', data.id as string);
  };

  const toggleJoin = async (g: Group) => {
    if (!ensureAuth() || !user) return;
    const joined = mine.has(g.id);
    const { error } = joined
      ? await supabase.from('group_members').delete().match({ group_id: g.id, user_id: user.id })
      : await supabase.from('group_members').insert({ group_id: g.id, user_id: user.id });
    if (error) return toast(t('error_generic'), 'error');
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('nav_groups')}
        sub={t('groups_sub')}
        action={<button type="button" className="btn btn-primary" onClick={() => (ensureAuth() ? setCreating((c) => !c) : undefined)}>{t('create_group')}</button>}
      />
      {creating && (
        <form onSubmit={create} className="card mb-5 space-y-3">
          <div>
            <label className="label" htmlFor="g-name">{t('group_name')}</label>
            <input id="g-name" className="input" value={name} minLength={2} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="g-tag">{t('tagline')}</label>
            <input id="g-tag" className="input" value={tagline} maxLength={100} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="g-cat">{t('category')}</label>
              <select id="g-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`gcat_${c}` as Key)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="g-policy">{t('who_can_join')}</label>
              <select id="g-policy" className="input" value={policy} onChange={(e) => setPolicy(e.target.value as Group['join_policy'])}>
                <option value="open">{t('join_open')}</option>
                <option value="invite">{t('join_invite')}</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{t('create_group')}</button>
        </form>
      )}
      {groups === null ? <Loading /> : groups.length === 0 ? <Empty text={t('groups_empty')} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <article key={g.id} className="card flex flex-col gap-3">
              <button type="button" className="text-left" onClick={() => go('groups', g.id)}>
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  {t(`gcat_${g.category}` as Key)}
                  {g.join_policy === 'invite' && <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden="true" />{t('invite_only')}</span>}
                </span>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                {g.tagline && <p className="text-sm text-zinc-600">{g.tagline}</p>}
              </button>
              <div className="mt-auto flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Users className="h-3.5 w-3.5" aria-hidden="true" />{t('members_n', { n: g.member_count })}</span>
                {g.owner_id !== user?.id && (mine.has(g.id) || g.join_policy === 'open') && (
                  <button type="button" className={`btn btn-sm ${mine.has(g.id) ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleJoin(g)}>
                    {mine.has(g.id) ? t('leave_group') : t('join_group')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** Opens an invite link (#/join/<code>): signs the person in if needed, then adds them to the group. */
export function JoinGroupView({ code }: { code?: string }) {
  const { user, profile, openAuth, loading } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const [error, setError] = useState<string | null>(null);
  const invite = code ?? '';

  useEffect(() => {
    if (!invite) return;
    // Remember the invite: Google sign-in reloads the page, and the link would otherwise be forgotten.
    try { localStorage.setItem(PENDING_JOIN, invite); } catch { /* private mode: the link still works while signed in */ }
  }, [invite]);

  useEffect(() => {
    if (loading || !invite) return;
    if (!user || !profile) { openAuth(); return; }
    let off = false;
    (async () => {
      const { data, error: err } = await supabase.rpc('join_group_by_code', { p_code: invite });
      if (off) return;
      try { localStorage.removeItem(PENDING_JOIN); } catch { /* ignore */ }
      if (err || !data) return setError(explain(err, t));
      go('groups', data as string);
    })();
    return () => { off = true; };
  }, [loading, user, profile, invite, openAuth, go, t]);

  if (error) {
    return (
      <Empty text={error}>
        <button type="button" className="btn btn-primary" onClick={() => go('groups')}>{t('back')}</button>
      </Empty>
    );
  }
  return (
    <div className="mx-auto max-w-sm space-y-3 py-10 text-center text-sm text-zinc-600">
      <Loading />
      <p>{user && profile ? t('joining_group') : t('sign_in_to_join_group')}</p>
    </div>
  );
}

type CallMode = null | 'audio' | 'video';

export function GroupRoom({ id }: { id: string }) {
  const { user, ensureAuth } = useAuth();
  useEffect(() => { void supabase.rpc('clear_notifications_for', { p_kind: 'group', p_ref: id }); }, [id]);
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [missing, setMissing] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [call, setCall] = useState<CallMode>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
    if (!data) return setMissing(true);
    setGroup(data as Group);
    if (!user) return setMembers([]);
    const { data: rows } = await supabase.from('group_members')
      .select(`user_id,role,profile:profiles!user_id(${PUBLIC_PROFILE})`).eq('group_id', id).limit(300);
    const list = (rows ?? []).map((r) => ({
      user_id: r.user_id as string,
      role: r.role as GroupRole,
      profile: (Array.isArray(r.profile) ? r.profile[0] : r.profile) as unknown as PublicProfile,
    })).filter((m) => m.profile);
    const order: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };
    list.sort((a, b) => order[a.role] - order[b.role] || a.profile.display_name.localeCompare(b.profile.display_name));
    setMembers(list);
  }, [id, user]);

  useEffect(() => {
    setGroup(null);
    setMissing(false);
    load();
  }, [load]);

  // Member list updates live (someone added, removed or promoted).
  useEffect(() => {
    const channel = supabase.channel(`group-members:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? null;
  const member = myRole !== null;
  const owner = myRole === 'owner';
  const admin = myRole === 'owner' || myRole === 'admin';

  const join = async () => {
    if (!ensureAuth() || !user) return;
    const { error } = await supabase.from('group_members').insert({ group_id: id, user_id: user.id });
    if (error) return toast(t('error_generic'), 'error');
    load();
  };

  const leave = async () => {
    if (!user) return;
    const { error } = await supabase.from('group_members').delete().match({ group_id: id, user_id: user.id });
    if (error) return toast(t('error_generic'), 'error');
    setCall(null);
    load();
  };

  const remove = async () => {
    if (!window.confirm(t('confirm_delete_group'))) return;
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) return toast(t('error_generic'), 'error');
    go('groups');
  };

  if (missing) return <Empty text={t('group_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('groups')}>{t('back')}</button></Empty>;
  if (!group) return <Loading />;

  return (
    <div className="space-y-5">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('groups')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}
      </button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            {t(`gcat_${group.category}` as Key)} · {t('members_n', { n: group.member_count })}
            {group.join_policy === 'invite' && <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden="true" />{t('invite_only')}</span>}
          </p>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.tagline && <p className="text-sm text-zinc-600">{group.tagline}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!member && group.join_policy === 'open' && <button type="button" className="btn btn-primary" onClick={join}>{t('join_group')}</button>}
          {member && !owner && <button type="button" className="btn btn-ghost" onClick={leave}>{t('leave_group')}</button>}
          {owner && <button type="button" className="btn btn-danger" onClick={remove}>{t('delete')}</button>}
          {!owner && <ReportButton targetType="group" targetId={group.id} />}
        </div>
      </header>

      {!member ? <Empty text={group.join_policy === 'invite' ? t('invite_only_hint') : t('join_to_see')} /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{t('group_call')}</h2>
                {call ? (
                  <Chip active onClick={() => setCall(null)}>{t('hide')}</Chip>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCall('audio')}><Mic className="h-3.5 w-3.5" aria-hidden="true" />{t('voice_call')}</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setCall('video')}><Video className="h-3.5 w-3.5" aria-hidden="true" />{t('video_call')}</button>
                  </div>
                )}
              </div>
              {call && <LiveRoom key={call} roomName={`group:${group.id}`} video={call === 'video'} />}
            </section>

            <section className="card space-y-3">
              <h2 className="font-semibold">{t('members')} ({members.length})</h2>
              <ul className="divide-y divide-zinc-100">
                {members.map((m) => (
                  <MemberRow key={m.user_id} m={m} groupId={id} myRole={myRole} me={user?.id ?? ''} onChanged={load} />
                ))}
              </ul>
            </section>

            {admin && <AdminTools group={group} owner={owner} members={members} onChanged={() => { load(); }} onPolicy={(p) => setGroup({ ...group, join_policy: p })} onFeatured={(on) => setGroup((g) => (g ? { ...g, featured: on } : g))} />}
          </div>
          <ChatPanel roomType="group" roomId={group.id} allowFiles canModerate={admin} />
        </div>
      )}
    </div>
  );
}

function MemberRow({ m, groupId, myRole, me, onChanged }: { m: GroupMember; groupId: string; myRole: GroupRole | null; me: string; onChanged: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [busy, setBusy] = useState(false);
  const canRemove = m.user_id !== me && m.role !== 'owner' && (myRole === 'owner' || (myRole === 'admin' && m.role === 'member'));
  const canPromote = myRole === 'owner' && m.role !== 'owner';

  const run = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return toast(explain(error, t), 'error');
    onChanged();
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => go('profile', m.user_id)}>
        <Avatar p={m.profile} size={32} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{m.profile.display_name}</span>
          <span className="block truncate text-xs text-zinc-500">@{m.profile.handle}</span>
        </span>
      </button>
      {m.role !== 'member' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">
          {m.role === 'owner' ? <Crown className="h-3 w-3 text-amber-500" aria-hidden="true" /> : <Shield className="h-3 w-3" aria-hidden="true" />}
          {t(m.role === 'owner' ? 'role_owner' : 'role_admin')}
        </span>
      )}
      {canPromote && (
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run('set_group_role', { p_group: groupId, p_user: m.user_id, p_role: m.role === 'admin' ? 'member' : 'admin' })}>
          {t(m.role === 'admin' ? 'remove_admin' : 'make_admin')}
        </button>
      )}
      {canRemove && (
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => window.confirm(t('confirm_remove_member')) && run('remove_group_member', { p_group: groupId, p_user: m.user_id })}>
          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />{t('remove')}
        </button>
      )}
    </li>
  );
}

/** Owner / admin tools: add people directly, share an invite link, choose who may join. */
function AdminTools({ group, owner, members, onChanged, onPolicy, onFeatured }: {
  group: Group; owner: boolean; members: GroupMember[]; onChanged: () => void; onPolicy: (p: Group['join_policy']) => void; onFeatured: (on: boolean) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PersonRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('group_invites').select('code').eq('group_id', group.id).maybeSingle().then(({ data }) => setCode((data?.code as string | undefined) ?? null));
  }, [group.id]);

  // Search people as the admin types (after a short pause).
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const handle = window.setTimeout(() => {
      loadPeople(q, 0, 8).then((rows) => setResults(rows)).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [term]);

  const memberIds = new Set(members.map((m) => m.user_id));
  const link = code ? `${window.location.origin}/#/join/${code}` : '';

  const add = async (p: PersonRow) => {
    setBusy(p.id);
    const { error } = await supabase.rpc('add_group_member', { p_group: group.id, p_user: p.id });
    setBusy(null);
    if (error) return toast(explain(error, t), 'error');
    toast(t('member_added', { name: p.display_name }));
    onChanged();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast(t('link_copied'));
    } catch {
      window.prompt(t('copy_link_manually'), link);
    }
  };

  const reset = async () => {
    if (!window.confirm(t('confirm_reset_link'))) return;
    setBusy('reset');
    const { data, error } = await supabase.rpc('reset_invite_code', { p_group: group.id });
    setBusy(null);
    if (error) return toast(explain(error, t), 'error');
    setCode(data as string);
  };

  const changePolicy = async (policy: Group['join_policy']) => {
    const { error } = await supabase.from('groups').update({ join_policy: policy }).eq('id', group.id);
    if (error) return toast(t('error_generic'), 'error');
    onPolicy(policy);
    if (policy === 'invite') onFeatured(false); // the database also un-features an invite-only group
  };

  const changeFeatured = async (on: boolean) => {
    const { error } = await supabase.rpc('set_group_featured', { p_group: group.id, p_on: on });
    if (error) return toast(t('error_generic'), 'error');
    onFeatured(on);
    toast(t('profile_saved'));
  };

  return (
    <section className="card space-y-5" aria-label={t('admin_tools')}>
      <h2 className="flex items-center gap-2 font-semibold"><Shield className="h-4 w-4" aria-hidden="true" />{t('admin_tools')}</h2>

      <div className="space-y-2">
        <label className="label" htmlFor="ga-search">{t('add_members')}</label>
        <input id="ga-search" className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('search_people_placeholder')} autoComplete="off" />
        {searching && <p className="text-xs text-zinc-500">{t('searching')}</p>}
        {results.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar p={p} size={28} />
                <span className="min-w-0 flex-1 text-sm"><span className="block truncate font-medium">{p.display_name}</span><span className="block truncate text-xs text-zinc-500">@{p.handle}</span></span>
                {memberIds.has(p.id) ? (
                  <span className="text-xs text-zinc-500">{t('already_in_group')}</span>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => add(p)}>
                    {busy === p.id ? <Spinner /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}{t('add')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <span className="label">{t('invite_link')}</span>
        <div className="flex gap-2">
          <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t('invite_link')} />
          <button type="button" className="btn btn-ghost" onClick={copy} disabled={!code}><Copy className="h-4 w-4" aria-hidden="true" />{t('copy')}</button>
          <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy === 'reset' || !code} aria-label={t('reset_link')} title={t('reset_link')}><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-zinc-500"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('invite_link_hint')}</p>
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-black disabled:opacity-40"
            checked={Boolean(group.featured) && group.join_policy === 'open'}
            disabled={group.join_policy !== 'open'}
            onChange={(e) => void changeFeatured(e.target.checked)}
          />
          {t('feature_group')}
        </label>
        <p className="mt-1 text-xs text-zinc-500">{group.join_policy === 'open' ? t('feature_group_hint') : t('feature_group_invite')}</p>
      </div>

      {owner && (
        <div>
          <label className="label" htmlFor="ga-policy">{t('who_can_join')}</label>
          <select id="ga-policy" className="input" value={group.join_policy} onChange={(e) => changePolicy(e.target.value as Group['join_policy'])}>
            <option value="open">{t('join_open')}</option>
            <option value="invite">{t('join_invite')}</option>
          </select>
        </div>
      )}
    </section>
  );
}
