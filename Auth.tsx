import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { configured, supabase } from '../lib/supabase';
import type { Profile, Wallet } from '../lib/types';
import { useI18n } from './I18n';
import { useToast } from './Toast';

export interface NewProfile {
  handle: string;
  display_name: string;
  generation: Profile['generation'];
}
type ProfilePatch = Partial<
  Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'bio' | 'generation' | 'status_text' | 'status_expires_at' | 'language' | 'dm_policy'>
>;

interface AuthValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  wallet: Wallet | null;
  blocked: string[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  createProfile: (values: NewProfile) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshBlocked: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Returns true when signed in; otherwise shows a "sign in" message and returns false. */
  ensureAuth: () => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children, onSignedIn }: { children: ReactNode; onSignedIn?: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(configured);
  const lastUser = useRef<string | null>(null);
  const signedInCb = useRef(onSignedIn);
  signedInCb.current = onSignedIn;
  const user = session?.user ?? null;

  const loadAll = useCallback(async (uid: string) => {
    const [p, w, b] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('wallets').select('voting_coins,reward_coins,last_claim_month').eq('user_id', uid).maybeSingle(),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', uid),
    ]);
    setProfile((p.data as Profile | null) ?? null);
    setWallet((w.data as Wallet | null) ?? null);
    setBlocked((b.data ?? []).map((r) => r.blocked_id as string));
  }, []);

  useEffect(() => {
    if (!configured) return;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      const uid = next?.user.id ?? null;
      const isNewUser = uid !== lastUser.current;
      lastUser.current = uid;
      if (!uid) {
        setProfile(null);
        setWallet(null);
        setBlocked([]);
        setLoading(false);
        return;
      }
      // Do not call Supabase inside this callback directly (can deadlock); defer to the next tick.
      setTimeout(async () => {
        if (isNewUser) await loadAll(uid);
        setLoading(false);
        if (isNewUser && event === 'SIGNED_IN') signedInCb.current?.();
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadAll]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast(error.message, 'error');
  }, [toast]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const createProfile = useCallback(
    async (values: NewProfile) => {
      if (!user) throw new Error('not_authenticated');
      const meta = user.user_metadata as { avatar_url?: string; picture?: string };
      const lang = localStorage.getItem('kezzo_lang') === 'fr' ? 'fr' : 'en';
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        handle: values.handle,
        display_name: values.display_name,
        generation: values.generation,
        avatar_url: meta.avatar_url ?? meta.picture ?? null,
        language: lang,
        terms_accepted_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadAll(user.id);
    },
    [user, loadAll],
  );

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return;
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [user],
  );

  const refreshWallet = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallets').select('voting_coins,reward_coins,last_claim_month').eq('user_id', user.id).maybeSingle();
    if (data) setWallet(data as Wallet);
  }, [user]);

  const refreshBlocked = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id);
    setBlocked((data ?? []).map((r) => r.blocked_id as string));
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    for (const bucket of ['avatars', 'media-public', 'media-paid']) {
      const { data } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
    }
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut();
  }, [user]);

  const ensureAuth = useCallback(() => {
    if (user && profile) return true;
    toast(t('sign_in_required'));
    return false;
  }, [user, profile, toast, t]);

  const value = useMemo<AuthValue>(
    () => ({
      configured, loading, session, user, profile, wallet, blocked,
      signInWithGoogle, signOut, createProfile, updateProfile, refreshWallet, refreshBlocked, deleteAccount, ensureAuth,
    }),
    [loading, session, user, profile, wallet, blocked, signInWithGoogle, signOut, createProfile, updateProfile, refreshWallet, refreshBlocked, deleteAccount, ensureAuth],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
