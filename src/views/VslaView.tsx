import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Copy, Crown, PiggyBank, Plus, UserCog, UserMinus, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { VslaPanel, type VslaMember } from '../components/VslaPanel';
import { Empty, Loading, PageHeader, Spinner } from '../components/ui';

interface Details { id: string; phone: string; email: string; address: string; guarantor_name: string; guarantor_phone: string }
interface VslaGroup { id: string; name: string; description: string; owner_id: string; code: string }

// ---------------------------------------------------------------------------------------------- list

/** Savings groups (VSLA): the person's own groups, a form to start one and a box to join with a code. */
export function VslaView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<VslaGroup[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return setGroups([]);
    const { data } = await supabase.from('vsla_members').select('group:vsla_groups!group_id(id,name,description,owner_id,code)').eq('user_id', user.id).order('joined_at', { ascending: false });
    const list = (data ?? []).map((r) => (Array.isArray(r.group) ? r.group[0] : r.group) as unknown as VslaGroup).filter(Boolean);
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
                <span className="min-w-0"><span className="block truncate font-semibold">{g.name}</span>{g.description && <span className="block truncate text-xs text-zinc-500">{g.description}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- one group

export function VslaRoom({ id }: { id: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { go } = useRouter();
  const { toast } = useToast();
  const [group, setGroup] = useState<VslaGroup | null>(null);
  const [members, setMembers] = useState<VslaMember[]>([]);
  const [missing, setMissing] = useState(false);
  const [guest, setGuest] = useState('');
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Map<string, Details>>(new Map());
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, m] = await Promise.all([
      supabase.from('vsla_groups').select('id,name,description,owner_id,code').eq('id', id).maybeSingle(),
      supabase.from('vsla_members').select('id,user_id,display_name,role').eq('group_id', id).order('joined_at').limit(500),
    ]);
    if (g.error && !navigator.onLine) return; // offline: keep what is on screen
    if (!g.data) return setMissing(true);
    setGroup(g.data as VslaGroup);
    setMembers((m.data ?? []) as VslaMember[]);
    const d = await supabase.rpc('vsla_member_details', { p_group: id });
    setDetails(new Map(((d.data ?? []) as Details[]).map((x) => [x.id, x])));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const me = members.find((m) => m.user_id === user?.id);
  const admin = me?.role === 'admin';
  const owner = group?.owner_id === user?.id;

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast(t('vs_error', { why: error.message }), 'error');
    await load();
  };

  if (missing) return <Empty text={t('group_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('vsla')}>{t('back')}</button></Empty>;
  if (!group) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('vsla')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}
      </button>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        {group.description && <p className="text-sm text-zinc-600">{group.description}</p>}
      </header>

      <VslaPanel groupId={id} members={members} admin={Boolean(admin)} />

      <section className="card space-y-3" aria-label={t('members')}>
        <h2 className="font-semibold">{t('members')} ({members.length})</h2>
        <ul className="divide-y divide-zinc-100">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="mr-auto flex items-center gap-1.5">
                {m.role === 'admin' && <Crown className="h-3.5 w-3.5 text-amber-600" aria-label={t('role_admin')} />}
                {m.display_name}{!m.user_id && <span className="rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-600">{t('vsla_guest_tag')}</span>}
              </span>
              {admin && m.user_id && m.user_id !== user?.id && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => supabase.rpc('vsla_set_role', { p_group: id, p_member: m.id, p_role: m.role === 'admin' ? 'member' : 'admin' }))}>
                  {t(m.role === 'admin' ? 'vsla_make_member' : 'vsla_make_admin')}
                </button>
              )}
              {(admin || m.user_id === user?.id) && (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={t('vsla_details')} aria-expanded={editing === m.id} onClick={() => setEditing(editing === m.id ? null : m.id)}><UserCog className="h-3.5 w-3.5" aria-hidden="true" /></button>
              )}
              {(admin || m.user_id === user?.id) && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} aria-label={t('vsla_remove')} onClick={() => window.confirm(t('vsla_remove_confirm')) && act(() => supabase.rpc('vsla_remove_member', { p_group: id, p_member: m.id }).then((r) => { if (!r.error && m.user_id === user?.id) go('vsla'); return r; }))}>
                  <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {editing === m.id && (
                <div className="basis-full">
                  <MemberDetails groupId={id} member={m} initial={details.get(m.id)} onSaved={() => { setEditing(null); void load(); }} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {admin && (
          <>
            <form className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3" onSubmit={(e) => { e.preventDefault(); void act(() => supabase.rpc('vsla_add_guest', { p_group: id, p_name: guest })).then(() => setGuest('')); }}>
              <div className="min-w-0 flex-1"><label className="label" htmlFor="vg-guest">{t('vsla_add_guest')}</label><input id="vg-guest" className="input" value={guest} maxLength={60} onChange={(e) => setGuest(e.target.value)} placeholder={t('vsla_guest_name')} required /></div>
              <button className="btn btn-primary btn-sm" disabled={busy || !guest.trim()}><UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{t('vsla_add')}</button>
            </form>
            <p className="text-xs text-zinc-500">{t('vsla_guest_hint')}</p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <span className="text-xs text-zinc-500">{t('vsla_invite_code')}</span>
              <code className="font-mono font-semibold">{group.code}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void navigator.clipboard?.writeText(group.code); toast(t('link_copied')); }}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button>
            </div>
          </>
        )}
        {owner && <button type="button" className="btn btn-danger btn-sm" onClick={() => window.confirm(t('vsla_delete_confirm')) && act(() => supabase.rpc('vsla_delete_group', { p_group: id }).then((r) => { if (!r.error) go('vsla'); return r; }))}>{t('delete')}</button>}
      </section>
    </div>
  );
}

/** Optional contact details and guarantor for one member. Only treasurers and the member can see or change them. */
function MemberDetails({ groupId, member, initial, onSaved }: { groupId: string; member: VslaMember; initial?: Details; onSaved: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [f, setF] = useState({
    name: member.display_name, phone: initial?.phone ?? '', email: initial?.email ?? '', address: initial?.address ?? '',
    gname: initial?.guarantor_name ?? '', gphone: initial?.guarantor_phone ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc('vsla_update_member', { p_group: groupId, p_member: member.id, p_name: f.name, p_phone: f.phone, p_email: f.email, p_address: f.address, p_gname: f.gname, p_gphone: f.gphone });
    setBusy(false);
    if (error) return toast(t('vs_error', { why: error.message }), 'error');
    onSaved();
  };
  return (
    <form className="grid gap-3 rounded-xl bg-zinc-50 p-3 sm:grid-cols-2" onSubmit={save}>
      <div><label className="label" htmlFor={`md-n-${member.id}`}>{t('vsla_guest_name')}</label><input id={`md-n-${member.id}`} className="input" value={f.name} maxLength={60} onChange={set('name')} required /></div>
      <div><label className="label" htmlFor={`md-p-${member.id}`}>{t('vsla_phone')}</label><input id={`md-p-${member.id}`} className="input" type="tel" value={f.phone} maxLength={40} onChange={set('phone')} /></div>
      <div><label className="label" htmlFor={`md-e-${member.id}`}>{t('vsla_email')}</label><input id={`md-e-${member.id}`} className="input" type="email" value={f.email} maxLength={120} onChange={set('email')} /></div>
      <div><label className="label" htmlFor={`md-a-${member.id}`}>{t('vsla_address')}</label><input id={`md-a-${member.id}`} className="input" value={f.address} maxLength={200} onChange={set('address')} /></div>
      <div><label className="label" htmlFor={`md-gn-${member.id}`}>{t('vsla_gname')}</label><input id={`md-gn-${member.id}`} className="input" value={f.gname} maxLength={60} onChange={set('gname')} /></div>
      <div><label className="label" htmlFor={`md-gp-${member.id}`}>{t('vsla_gphone')}</label><input id={`md-gp-${member.id}`} className="input" type="tel" value={f.gphone} maxLength={40} onChange={set('gphone')} /></div>
      <p className="text-xs text-zinc-500 sm:col-span-2">{t('vsla_details_private')}</p>
      <div className="sm:col-span-2"><button className="btn btn-accent btn-sm" disabled={busy}>{busy && <Spinner />}{t('vsla_save_details')}</button></div>
    </form>
  );
}
