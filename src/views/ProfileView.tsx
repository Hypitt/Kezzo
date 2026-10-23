import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Coins, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { loadPosts } from '../lib/data';
import { compressImage } from '../lib/media';
import { CACHE_SECONDS, startUpload } from '../lib/upload';
import { fileExt, isActiveStatus } from '../lib/format';
import { isSafe } from '../lib/moderation';
import type { LedgerEntry, Post, Profile } from '../lib/types';
import type { Key } from '../lib/i18n';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ShareButton } from '../components/ShareButton';
import { PostGrid } from '../components/PostGrid';
import { ReportButton } from '../components/ReportButton';
import { SignInCard } from '../components/AuthScreens';
import { StatusViewer } from '../components/StatusViewer';
import { useLegal } from '../state/Legal';
import { AccountFooter } from '../components/AccountFooter';
import { Avatar, Empty, Loading, LoadMore, Spinner } from '../components/ui';
import { isR2Path, publicFilePath, publicUrl } from '../lib/storage';

const PAGE = 8;

export function ProfileView({ id }: { id?: string }) {
  const { user, profile: mine } = useAuth();
  const targetId = id ?? user?.id;
  if (!targetId) return <SignInCard />;
  const own = Boolean(user && targetId === user.id);
  return <ProfileBody key={targetId} targetId={targetId} own={own} mine={mine} />;
}

function ProfileBody({ targetId, own, mine }: { targetId: string; own: boolean; mine: Profile | null }) {
  const { user, ensureAuth, blocked, refreshBlocked } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [profile, setProfile] = useState<Profile | null>(own ? mine : null);
  const [missing, setMissing] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewStatus, setViewStatus] = useState(false);

  useEffect(() => {
    if (own) return setProfile(mine);
    supabase.from('profiles').select('*').eq('id', targetId).maybeSingle().then(({ data }) => {
      if (data) setProfile(data as Profile);
      else setMissing(true);
    });
  }, [own, mine, targetId]);

  const loadCounts = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', targetId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
      user && !own ? supabase.from('follows').select('followee_id').eq('follower_id', user.id).eq('followee_id', targetId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setFollowers(a.count ?? 0);
    setFollowingCount(b.count ?? 0);
    setIsFollowing(Boolean(c.data));
  }, [targetId, user, own]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    let off = false;
    setLoadingPosts(true);
    loadPosts(user?.id ?? null, { authorId: targetId, limit: PAGE })
      .then((rows) => {
        if (off) return;
        setPosts(rows);
        setHasMore(rows.length === PAGE);
      })
      .finally(() => !off && setLoadingPosts(false));
    return () => {
      off = true;
    };
  }, [targetId, user]);

  const more = async () => {
    setMoreBusy(true);
    try {
      const rows = await loadPosts(user?.id ?? null, { authorId: targetId, from: posts.length, limit: PAGE });
      setPosts((p) => [...p, ...rows]);
      setHasMore(rows.length === PAGE);
    } finally {
      setMoreBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!ensureAuth() || !user) return;
    const { error } = isFollowing
      ? await supabase.from('follows').delete().match({ follower_id: user.id, followee_id: targetId })
      : await supabase.from('follows').insert({ follower_id: user.id, followee_id: targetId });
    if (error) return toast(t('error_generic'), 'error');
    loadCounts();
  };

  const isBlocked = blocked.includes(targetId);
  const toggleBlock = async () => {
    if (!ensureAuth() || !user) return;
    const { error } = isBlocked
      ? await supabase.from('blocks').delete().match({ blocker_id: user.id, blocked_id: targetId })
      : await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: targetId });
    if (error) return toast(t('error_generic'), 'error');
    await refreshBlocked();
    toast(t(isBlocked ? 'unblocked_toast' : 'blocked_toast'));
  };

  if (missing) return <Empty text={t('profile_not_found')} />;
  if (!profile) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="card flex flex-wrap items-start gap-4">
        <Avatar p={profile} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-zinc-500">@{profile.handle}{profile.generation ? ` · ${profile.generation}` : ''}</p>
          {isActiveStatus(profile) && (
            <div className="mt-2 flex items-center gap-3">
              {profile.status_image_url && (
                <button type="button" onClick={() => setViewStatus(true)} aria-label={t('view_status')}>
                  <img src={profile.status_image_url} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
                </button>
              )}
              {profile.status_text && <p className="text-sm text-accent">{profile.status_text}</p>}
            </div>
          )}
          {profile.bio && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-700">{profile.bio}</p>}
          <p className="mt-2 text-xs text-zinc-500">{t('followers_n', { n: followers })} · {t('following_n', { n: followingCount })}</p>
          <div className="mt-3"><ShareButton type="profile" id={targetId} title={profile.display_name} /></div>
        </div>
        {!own && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleFollow}>{isFollowing ? t('unfollow') : t('follow')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (ensureAuth() ? go('messages', targetId) : undefined)}>{t('message')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleBlock}>{isBlocked ? t('unblock') : t('block')}</button>
            <ReportButton targetType="profile" targetId={targetId} />
          </div>
        )}
      </header>

      {own && <OwnSettings profile={profile} />}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('posts')}</h2>
        {loadingPosts ? <Loading /> : posts.length === 0 ? (
          <Empty text={t('no_posts_yet')}>
            {own && <button type="button" className="btn btn-primary" onClick={() => go('create', 'post')}>{t('create_post')}</button>}
          </Empty>
        ) : (
          <PostGrid
            posts={posts}
            onChange={(next) => setPosts((l) => l.map((x) => (x.id === next.id ? next : x)))}
            onDelete={(pid) => setPosts((l) => l.filter((x) => x.id !== pid))}
          />
        )}
        <LoadMore show={hasMore} busy={moreBusy} onClick={more} label={t('load_more')} />
      </section>
      {viewStatus && <StatusViewer person={profile} onClose={() => setViewStatus(false)} />}
      {own && <div className="border-t border-zinc-200 pt-2"><AccountFooter /></div>}
    </div>
  );
}

function OwnSettings({ profile }: { profile: Profile }) {
  const { user, wallet, updateProfile, refreshWallet } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { openLegal } = useLegal();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [generation, setGeneration] = useState(profile.generation);
  const [dmPolicy, setDmPolicy] = useState(profile.dm_policy);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const canClaim = Boolean(wallet && wallet.last_claim_month.slice(0, 7) < thisMonth);

  useEffect(() => {
    supabase.from('coin_ledger').select('id,delta,balance_type,reason,created_at').order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setLedger((data ?? []) as LedgerEntry[]));
  }, [wallet?.voting_coins, wallet?.reward_coins]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSafe(displayName) || !isSafe(bio)) return toast(t('blocked_content'), 'error');
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim(), bio: bio.trim(), generation, dm_policy: dmPolicy });
      toast(t('profile_saved'));
      setEditing(false);
    } catch {
      toast(t('error_generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    const small = await compressImage(file, 256, 0.8); // shown at 30-72 px everywhere: keep it tiny
    if (small.size > 2 * 1024 * 1024) { setUploading(false); return toast(t('err_avatar_big'), 'error'); }
    const path = publicFilePath(user.id, `avatar-${Date.now()}.${fileExt(small.name)}`);
    if (isR2Path(path)) {
      try { await startUpload({ bucket: 'avatars', path, file: small }).done; } catch { setUploading(false); return toast(t('err_upload'), 'error'); }
    } else {
      const { error } = await supabase.storage.from('avatars').upload(path, small, { contentType: small.type, upsert: false, cacheControl: CACHE_SECONDS });
      if (error) {
        setUploading(false);
        return toast(t('err_upload'), 'error');
      }
    }
    try {
      await updateProfile({ avatar_url: isR2Path(path) ? publicUrl('avatars', path) : supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl });
    } catch {
      toast(t('error_generic'), 'error');
    }
    setUploading(false);
  };

  const claim = async () => {
    const { error } = await supabase.rpc('claim_monthly_coins');
    if (error) return toast(explain(error, t), 'error');
    await refreshWallet();
    toast(t('claimed_toast'));
  };

  return (
    <>
      <section className="card space-y-4" aria-label={t('wallet')}>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Coins className="h-5 w-5 text-amber-600" aria-hidden="true" />{t('wallet')}</h2>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-2xl font-bold tabular-nums">{wallet?.voting_coins ?? 0}</p><p className="text-xs text-zinc-500">{t('voting_coins')}</p></div>
          <div className="rounded-xl bg-zinc-50 p-3"><p className="text-2xl font-bold tabular-nums">{wallet?.reward_coins ?? 0}</p><p className="text-xs text-zinc-500">{t('reward_coins')}</p></div>
        </div>
        <p className="text-xs text-zinc-500">{t('coins_note')}</p>
        {canClaim && <button type="button" className="btn btn-accent btn-sm" onClick={claim}>{t('claim_monthly')}</button>}
        {ledger.length > 0 && (
          <ul className="divide-y divide-zinc-100 text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex justify-between py-1.5">
                <span>{t(`ledger_${l.reason}` as Key)}</span>
                <span className={`tabular-nums ${l.delta > 0 ? 'text-emerald-700' : 'text-zinc-500'}`}>{l.delta > 0 ? '+' : ''}{l.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4" aria-label={t('settings')}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('settings')}</h2>
          {!editing && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('edit_profile')}</button>}
        </div>
        <label className="btn btn-ghost btn-sm w-fit cursor-pointer">
          {uploading && <Spinner />}
          {t('change_avatar')}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-black"
            checked={profile.email_messages}
            onChange={(e) => updateProfile({ email_messages: e.target.checked }).then(() => toast(t('profile_saved'))).catch(() => toast(t('error_generic'), 'error'))}
          />
          {t('email_messages')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-black"
            checked={profile.show_on_home}
            onChange={(e) => updateProfile({ show_on_home: e.target.checked }).then(() => toast(t('profile_saved'))).catch(() => toast(t('error_generic'), 'error'))}
          />
          {t('show_on_home')}
        </label>
        {editing && (
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="label" htmlFor="ps-name">{t('display_name')}</label>
              <input id="ps-name" className="input" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="ps-bio">{t('bio')}</label>
              <textarea id="ps-bio" className="input" rows={3} value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ps-gen">{t('generation')}</label>
                <select id="ps-gen" className="input" value={generation ?? ''} onChange={(e) => setGeneration((e.target.value || null) as Profile['generation'])}>
                  <option value="">{t('prefer_not_say')}</option>
                  <option value="Gen Z">Gen Z</option>
                  <option value="Millennial">Millennial</option>
                  <option value="Other">{t('other')}</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ps-dm">{t('dm_policy')}</label>
                <select id="ps-dm" className="input" value={dmPolicy} onChange={(e) => setDmPolicy(e.target.value as Profile['dm_policy'])}>
                  <option value="everyone">{t('dm_everyone')}</option>
                  <option value="followers">{t('dm_followers')}</option>
                  <option value="nobody">{t('dm_nobody')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" disabled={saving}>{saving && <Spinner />}{t('save')}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('cancel')}</button>
            </div>
          </form>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-4 text-xs">
          <button type="button" className="text-zinc-500 underline" onClick={() => openLegal('terms')}>{t('terms')}</button>
          <button type="button" className="text-zinc-500 underline" onClick={() => openLegal('privacy')}>{t('privacy')}</button>
        </div>

      </section>
    </>
  );
}
