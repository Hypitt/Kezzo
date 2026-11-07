import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Banknote, CalendarDays, ChevronDown, Copy, Crown, LogOut, MessageCircle, Pencil, PiggyBank, Plus, Send, UserMinus, UserPlus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { VslaPanel, type VslaMember, type VslaView as PanelView } from '../components/VslaPanel';
import { Empty, Loading, PageHeader, Spinner } from '../components/ui';

interface Details { id: string; phone: string; email: string; address: string; id_number: string; guarantor_name: string; guarantor_phone: string }
interface Msg { id: string; sender_id: string; recipient: 'group' | 'admins'; thread_user: string | null; body: string; created_at: string }
interface VslaGroup { id: string; name: string; description: string; owner_id: string; code: string }

// ---------------------------------------------------------------------------------------------- list

/** Savings groups (VSLA): the person's own groups, a form to start one and a box to join with a code. */
export function VslaView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Array<VslaGroup & { role: string }> | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return setGroups([]);
    const { data } = await supabase.from('vsla_members').select('role,group:vsla_groups!group_id(id,name,description,owner_id,code)').eq('user_id', user.id).eq('active', true).order('joined_at', { ascending: false });
    const list = (data ?? []).map((r) => ({ ...((Array.isArray(r.group) ? r.group[0] : r.group) as unknown as VslaGroup), role: r.role as string })).filter((g) => g.id);
    setGroups(list);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc('vsla_create_group', { p_name: name, p_description: desc });
    setBusy(false);
    if (error) return toast(t('vs_error', { why: error.message }), 'error');
    go('vsla', data as string);
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc('vsla_join', { p_code: code });
    setBusy(false);
    if (error) return toast(t('vs_error', { why: error.message }), 'error');
    go('vsla', data as string);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('nav_vsla')}
        sub={t('vs_intro')}
        action={!creating && <button type="button" className="btn btn-accent" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t('vsla_create')}</button>}
      />
      {creating && (
        <form className="card space-y-3" onSubmit={create}>
          <div><label className="label" htmlFor="vg-name">{t('vsla_group_name')}</label><input id="vg-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label className="label" htmlFor="vg-desc">{t('vsla_group_desc')}</label><input id="vg-desc" className="input" value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="flex gap-2">
            <button className="btn btn-accent" disabled={busy || name.trim().length < 2}>{busy && <Spinner />}{t('vsla_create')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>{t('cancel')}</button>
          </div>
        </form>
      )}
      <form className="card flex flex-wrap items-end gap-2" onSubmit={join}>
        <div className="min-w-0 flex-1"><label className="label" htmlFor="vg-code">{t('vsla_join_code')}</label><input id="vg-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} required /></div>
        <button className="btn btn-primary" disabled={busy || !code.trim()}>{t('vsla_join')}</button>
      </form>

      {groups === null ? <Loading /> : groups.length === 0 ? <Empty text={t('vsla_none_groups')} /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <button type="button" className="card flex w-full items-center gap-3 text-left transition hover:border-zinc-400" onClick={() => go('vsla', g.id)}>
                <PiggyBank className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{g.name}</span>{g.description && <span className="block truncate text-xs text-zinc-500">{g.description}</span>}</span>
                {g.role === 'admin' && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{t('vsla_treasurer')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- one group

type RoomTab = PanelView | 'members' | 'messages';
const TABS: Array<{ id: RoomTab; icon: typeof PiggyBank; key: 'vs_tab_overview' | 'vs_tab_contrib' | 'vs_tab_loans' | 'vs_tab_members' | 'vs_tab_messages' }> = [
  { id: 'overview', icon: PiggyBank, key: 'vs_tab_overview' },
  { id: 'contrib', icon: CalendarDays, key: 'vs_tab_contrib' },
  { id: 'loans', icon: Banknote, key: 'vs_tab_loans' },
  { id: 'members', icon: Users, key: 'vs_tab_members' },
  { id: 'messages', icon: MessageCircle, key: 'vs_tab_messages' },
];

/** Turns the database's short error codes into plain words. */
function useWhy() {
  const { t } = useI18n();
  return (message: string) => {
    if (message.includes('has_shares_or_debt')) return t('vsla_err_blocked');
    if (message.includes('last_admin')) return t('vsla_err_last_admin');
    return message;
  };
}

export function VslaRoom({ id }: { id: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const [group, setGroup] = useState<VslaGroup | null>(null);
  const [members, setMembers] = useState<VslaMember[]>([]);
  const [details, setDetails] = useState<Map<string, Details>>(new Map());
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<RoomTab>('overview');

  const load = useCallback(async () => {
    const [g, m] = await Promise.all([
      supabase.from('vsla_groups').select('id,name,description,owner_id,code').eq('id', id).maybeSingle(),
      supabase.from('vsla_members').select('id,user_id,display_name,role,active').eq('group_id', id).order('joined_at').limit(500),
    ]);
    if (g.error && !navigator.onLine) return; // offline: keep what is on screen
    if (!g.data) return setMissing(true);
    setGroup(g.data as VslaGroup);
    setMembers((m.data ?? []) as VslaMember[]);
    const d = await supabase.rpc('vsla_member_details', { p_group: id });
    setDetails(new Map(((d.data ?? []) as Details[]).map((x) => [x.id, x])));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const me = members.find((m) => m.user_id === user?.id && m.active !== false);
  const admin = me?.role === 'admin';

  if (missing) return <Empty text={t('group_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('vsla')}>{t('back')}</button></Empty>;
  if (!group) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('vsla')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}
      </button>
      <header className="space-y-0.5">
        <h1 className="text-xl font-bold">{group.name}</h1>
        {group.description && <p className="text-sm text-zinc-600">{group.description}</p>}
      </header>

      <nav className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-0.5" aria-label={group.name}>
        {TABS.map((x) => {
          const Icon = x.icon;
          return (
            <button key={x.id} type="button" onClick={() => setTab(x.id)} aria-current={tab === x.id ? 'page' : undefined}
              className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition ${tab === x.id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-white'}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{t(x.key)}
            </button>
          );
        })}
      </nav>

      {/* The books stay mounted while another tab is open, so nothing reloads and the offline queue keeps running. */}
      <div hidden={tab === 'members' || tab === 'messages'}>
        <VslaPanel groupId={id} members={members} admin={Boolean(admin)} meId={me?.id ?? null} view={tab === 'contrib' || tab === 'loans' ? tab : 'overview'} />
      </div>
      {tab === 'members' && <MembersTab group={group} members={members} details={details} me={me} admin={Boolean(admin)} owner={group.owner_id === user?.id} onChanged={load} />}
      {tab === 'messages' && <MessagesTab groupId={id} members={members} admin={Boolean(admin)} meUser={user?.id ?? ''} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- members

function MembersTab({ group, members, details, me, admin, owner, onChanged }: {
  group: VslaGroup; members: VslaMember[]; details: Map<string, Details>; me?: VslaMember; admin: boolean; owner: boolean; onChanged: () => void;
}) {
  const { t } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const why = useWhy();
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [guest, setGuest] = useState('');
  const [busy, setBusy] = useState(false);
  const live = members.filter((m) => m.active !== false);

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>, after?: () => void) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast(t('vs_error', { why: why(error.message) }), 'error');
    after?.();
    onChanged();
  };

  return (
    <section className="card space-y-3" aria-label={t('members')}>
      <h2 className="font-semibold">{t('members')} ({live.length})</h2>
      <ul className="divide-y divide-zinc-100">
        {live.map((m) => {
          const d = details.get(m.id);
          const mine = m.id === me?.id;
          const canSee = admin || mine;
          const expanded = open === m.id;
          return (
            <li key={m.id} className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={expanded} onClick={() => { setOpen(expanded ? null : m.id); setEdit(null); }}>
                  {m.role === 'admin' && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label={t('vsla_treasurer')} />}
                  <span className="truncate font-medium">{m.display_name}{mine && <span className="font-normal text-zinc-500"> ({t('vsla_you')})</span>}</span>
                  {!m.user_id && <span className="shrink-0 rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-600">{t('vsla_guest_tag')}</span>}
                  {canSee && <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-400 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />}
                </button>
              </div>
              {expanded && canSee && (
                <div className="mt-2 space-y-3 rounded-xl bg-zinc-50 p-3">
                  {edit === m.id ? (
                    <MemberDetails groupId={group.id} member={m} initial={d} onSaved={() => { setEdit(null); onChanged(); }} />
                  ) : (
                    <>
                      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                        {([['vsla_phone', d?.phone], ['vsla_email', d?.email], ['vsla_address', d?.address], ['vsla_id_number', d?.id_number], ['vsla_gname', d?.guarantor_name], ['vsla_gphone', d?.guarantor_phone]] as const).map(([k, v]) => (
                          <div key={k}><dt className="text-[11px] text-zinc-500">{t(k).replace(/ \(.*\)$/, '')}</dt><dd className="break-words">{v || <span className="text-zinc-400">—</span>}</dd></div>
                        ))}
                      </dl>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit(m.id)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('vsla_edit_details')}</button>
                        {admin && m.user_id && !mine && (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => supabase.rpc('vsla_set_role', { p_group: group.id, p_member: m.id, p_role: m.role === 'admin' ? 'member' : 'admin' }))}>
                            {t(m.role === 'admin' ? 'vsla_make_member' : 'vsla_make_admin')}
                          </button>
                        )}
                        {admin && !mine && (
                          <button type="button" className="btn btn-ghost btn-sm text-red-700" disabled={busy} onClick={() => window.confirm(t('vsla_remove_confirm')) && act(() => supabase.rpc('vsla_remove_member', { p_group: group.id, p_member: m.id }))}>
                            <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />{t('vsla_remove')}
                          </button>
                        )}
                        {mine && (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm(t('vsla_leave_confirm')) && act(() => supabase.rpc('vsla_leave', { p_group: group.id }), () => go('vsla'))}>
                            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />{t('vsla_leave')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {admin && (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void act(() => supabase.rpc('vsla_add_guest', { p_group: group.id, p_name: guest }), () => setGuest('')); }}>
            <div className="min-w-0 flex-1"><label className="label" htmlFor="vg-guest">{t('vsla_add_guest')}</label><input id="vg-guest" className="input" value={guest} maxLength={60} onChange={(e) => setGuest(e.target.value)} placeholder={t('vsla_guest_name')} required /></div>
            <button className="btn btn-primary btn-sm" disabled={busy || !guest.trim()}><UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{t('vsla_add')}</button>
          </form>
          <p className="text-xs text-zinc-500">{t('vsla_guest_hint')}</p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            <span className="text-xs text-zinc-500">{t('vsla_invite_code')}</span>
            <code className="font-mono font-semibold">{group.code}</code>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void navigator.clipboard?.writeText(group.code); toast(t('link_copied')); }}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button>
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">{t('vsla_remove_rule')}</p>
      {owner && <button type="button" className="btn btn-danger btn-sm" onClick={() => window.confirm(t('vsla_delete_confirm')) && act(() => supabase.rpc('vsla_delete_group', { p_group: group.id }), () => go('vsla'))}>{t('delete')}</button>}
    </section>
  );
}

/** Optional contact details, ID number and guarantor for one member. Only treasurers and the member can see or change them. */
function MemberDetails({ groupId, member, initial, onSaved }: { groupId: string; member: VslaMember; initial?: Details; onSaved: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [f, setF] = useState({
    name: member.display_name, phone: initial?.phone ?? '', email: initial?.email ?? '', address: initial?.address ?? '', idn: initial?.id_number ?? '',
    gname: initial?.guarantor_name ?? '', gphone: initial?.guarantor_phone ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc('vsla_update_member', { p_group: groupId, p_member: member.id, p_name: f.name, p_phone: f.phone, p_email: f.email, p_address: f.address, p_id_number: f.idn, p_gname: f.gname, p_gphone: f.gphone });
    setBusy(false);
    if (error) return toast(t('vs_error', { why: error.message }), 'error');
    onSaved();
  };
  const field = (k: keyof typeof f, label: Parameters<typeof t>[0], extra: { type?: string; max: number; required?: boolean }) => (
    <div><label className="label" htmlFor={`md-${k}-${member.id}`}>{t(label)}</label>
      <input id={`md-${k}-${member.id}`} className="input" type={extra.type ?? 'text'} value={f[k]} maxLength={extra.max} required={extra.required} onChange={set(k)} /></div>
  );
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
      {field('name', 'vsla_guest_name', { max: 60, required: true })}
      {field('phone', 'vsla_phone', { type: 'tel', max: 40 })}
      {field('email', 'vsla_email', { type: 'email', max: 120 })}
      {field('address', 'vsla_address', { max: 200 })}
      {field('idn', 'vsla_id_number', { max: 40 })}
      <span className="hidden sm:block" />
      {field('gname', 'vsla_gname', { max: 60 })}
      {field('gphone', 'vsla_gphone', { type: 'tel', max: 40 })}
      <p className="text-xs text-zinc-500 sm:col-span-2">{t('vsla_details_private')}</p>
      <div className="sm:col-span-2"><button className="btn btn-accent btn-sm" disabled={busy}>{busy && <Spinner />}{t('vsla_save_details')}</button></div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------- messages

/** The group's own chat, plus a private line between each member and the treasurers. */
function MessagesTab({ groupId, members, admin, meUser }: { groupId: string; members: VslaMember[]; admin: boolean; meUser: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [channel, setChannel] = useState<'group' | 'admins'>('group');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thread, setThread] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const nameOfUser = useMemo(() => new Map(members.filter((m) => m.user_id).map((m) => [m.user_id as string, m.display_name])), [members]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('vsla_messages').select('id,sender_id,recipient,thread_user,body,created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(300);
    setMsgs(((data ?? []) as Msg[]).reverse());
  }, [groupId]);
  useEffect(() => {
    void load();
    const ch = supabase.channel(`vsla-msgs:${groupId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vsla_messages', filter: `group_id=eq.${groupId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [groupId, load]);

  const threads = useMemo(() => [...new Set(msgs.filter((m) => m.recipient === 'admins' && m.thread_user).map((m) => m.thread_user as string))], [msgs]);
  const shown = msgs.filter((m) => (channel === 'group' ? m.recipient === 'group' : m.recipient === 'admins' && (!admin || m.thread_user === (thread || threads[0]))));
  const activeThread = admin ? (thread || threads[0] || '') : '';

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('vsla_post_message', { p_group: groupId, p_recipient: channel, p_thread: channel === 'admins' && admin ? activeThread : null, p_body: text });
    setBusy(false);
    if (error) return toast(t('vs_error', { why: error.message }), 'error');
    setText('');
    void load();
  };

  return (
    <section className="card space-y-3" aria-label={t('vs_tab_messages')}>
      <div className="flex gap-1.5">
        <button type="button" aria-pressed={channel === 'group'} className={`chip ${channel === 'group' ? 'bg-zinc-900 text-white' : ''}`} onClick={() => setChannel('group')}>{t('vsla_chat_group')}</button>
        <button type="button" aria-pressed={channel === 'admins'} className={`chip ${channel === 'admins' ? 'bg-zinc-900 text-white' : ''}`} onClick={() => setChannel('admins')}>{t(admin ? 'vsla_chat_inbox' : 'vsla_chat_treasurers')}</button>
      </div>
      {channel === 'admins' && <p className="text-xs text-zinc-500">{t(admin ? 'vsla_chat_inbox_hint' : 'vsla_chat_private_hint')}</p>}
      {channel === 'admins' && admin && (threads.length === 0 ? <p className="text-sm text-zinc-500">{t('vsla_chat_none')}</p> : (
        <select className="input" aria-label={t('vsla_chat_inbox')} value={activeThread} onChange={(e) => setThread(e.target.value)}>
          {threads.map((u) => <option key={u} value={u}>{nameOfUser.get(u) ?? '—'}</option>)}
        </select>
      ))}
      <ul className="max-h-96 space-y-2 overflow-y-auto" aria-live="polite">
        {shown.length === 0 && !(channel === 'admins' && admin && threads.length === 0) && <li className="text-sm text-zinc-500">{t('vsla_chat_empty')}</li>}
        {shown.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.sender_id === meUser ? 'ml-auto bg-zinc-900 text-white' : 'bg-zinc-100'}`}>
            {m.sender_id !== meUser && <span className="block text-[11px] font-semibold opacity-70">{nameOfUser.get(m.sender_id) ?? '—'}</span>}
            <span className="whitespace-pre-wrap break-words">{m.body}</span>
          </li>
        ))}
      </ul>
      {(channel === 'group' || !admin || activeThread) && (
        <form className="flex gap-2" onSubmit={send}>
          <input className="input flex-1" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={t('vsla_chat_ph')} aria-label={t('vsla_chat_ph')} />
          <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label={t('send')}>{busy ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />}</button>
        </form>
      )}
    </section>
  );
}
