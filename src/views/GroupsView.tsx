import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { isSafe } from '../lib/moderation';
import type { Group, PublicProfile } from '../lib/types';
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
    const { data, error } = await supabase.from('groups').insert({ owner_id: user.id, name: name.trim(), tagline: tagline.trim(), category }).select('id').single();
    setBusy(false);
    if (error || !data) return toast(t('error_generic'), 'error');
    toast(t('squad_created'));
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
        action={<button type="button" className="btn btn-primary" onClick={() => setCreating((c) => !c)}>{t('create_squad')}</button>}
      />
      {creating && (
        <form onSubmit={create} className="card mb-5 space-y-3">
          <div>
            <label className="label" htmlFor="g-name">{t('squad_name')}</label>
            <input id="g-name" className="input" value={name} minLength={2} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="g-tag">{t('tagline')}</label>
            <input id="g-tag" className="input" value={tagline} maxLength={100} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="g-cat">{t('category')}</label>
            <select id="g-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`gcat_${c}` as Key)}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{t('create_squad')}</button>
        </form>
      )}
      {groups === null ? <Loading /> : groups.length === 0 ? <Empty text={t('groups_empty')} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <article key={g.id} className="card flex flex-col gap-3">
              <button type="button" className="text-left" onClick={() => go('groups', g.id)}>
                <span className="text-xs text-zinc-500">{t(`gcat_${g.category}` as Key)}</span>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                {g.tagline && <p className="text-sm text-zinc-600">{g.tagline}</p>}
              </button>
              <div className="mt-auto flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Users className="h-3.5 w-3.5" aria-hidden="true" />{t('members_n', { n: g.member_count })}</span>
                {g.owner_id !== user?.id && (
                  <button type="button" className={`btn btn-sm ${mine.has(g.id) ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleJoin(g)}>
                    {mine.has(g.id) ? t('leave_squad') : t('join_squad')}
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

export function GroupRoom({ id }: { id: string }) {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [missing, setMissing] = useState(false);
  const [member, setMember] = useState(false);
  const [members, setMembers] = useState<PublicProfile[]>([]);
  const [showCall, setShowCall] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
    if (!data) return setMissing(true);
    setGroup(data as Group);
    if (!user) return setMember(false);
    const { data: me } = await supabase.from('group_members').select('user_id').eq('group_id', id).eq('user_id', user.id).maybeSingle();
    setMember(Boolean(me));
    if (me) {
      const { data: rows } = await supabase.from('group_members').select(`profile:profiles!user_id(${PUBLIC_PROFILE})`).eq('group_id', id).limit(100);
      setMembers((rows ?? []).map((r) => (Array.isArray(r.profile) ? r.profile[0] : r.profile) as unknown as PublicProfile).filter(Boolean));
    }
  }, [id, user]);

  useEffect(() => {
    setGroup(null);
    setMissing(false);
    load();
  }, [load]);

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
    setShowCall(false);
    load();
  };

  const remove = async () => {
    if (!window.confirm(t('confirm_delete_squad'))) return;
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) return toast(t('error_generic'), 'error');
    go('groups');
  };

  if (missing) return <Empty text={t('squad_not_found')}><button type="button" className="btn btn-primary" onClick={() => go('groups')}>{t('back')}</button></Empty>;
  if (!group) return <Loading />;
  const owner = group.owner_id === user?.id;

  return (
    <div className="space-y-5">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900" onClick={() => go('groups')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('back')}
      </button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">{t(`gcat_${group.category}` as Key)} · {t('members_n', { n: group.member_count })}</p>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.tagline && <p className="text-sm text-zinc-600">{group.tagline}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!member && <button type="button" className="btn btn-primary" onClick={join}>{t('join_squad')}</button>}
          {member && !owner && <button type="button" className="btn btn-ghost" onClick={leave}>{t('leave_squad')}</button>}
          {owner && <button type="button" className="btn btn-danger" onClick={remove}>{t('delete')}</button>}
          {!owner && <ReportButton targetType="group" targetId={group.id} />}
        </div>
      </header>

      {!member ? <Empty text={t('join_to_see')} /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t('squad_call')}</h2>
                <Chip active={showCall} onClick={() => setShowCall((s) => !s)}>{showCall ? t('hide') : t('show')}</Chip>
              </div>
              {showCall && <LiveRoom roomName={`group:${group.id}`} video />}
            </section>
            <section className="card">
              <h2 className="mb-3 font-semibold">{t('members')}</h2>
              <ul className="flex flex-wrap gap-3">
                {members.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="flex items-center gap-2 text-sm" onClick={() => go('profile', m.id)}>
                      <Avatar p={m} size={28} />{m.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <ChatPanel roomType="group" roomId={group.id} />
        </div>
      )}
    </div>
  );
}
