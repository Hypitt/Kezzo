import { track } from '../lib/analytics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { configured, supabase } from '../lib/supabase';
import type { Profile, Wallet } from '../lib/types';
import { useI18n } from './I18n';
import { useToast } from './Toast';
import { api } from '../lib/api';
import { r2Enabled } from '../lib/storage';

export interface NewProfile {
  handle: string;
  display_name: string;
  generation: Profile['generation'];
}
type ProfilePatch = Partial<
  Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'bio' | 'generation' | 'status_text' | 'status_expires_at' | 'status_image_url' | 'language' | 'dm_policy' | 'email_messages'>
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
  /** Email + password. Resolves with `needsConfirmation` when Supabase sent a confirmation email. */
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  /** True while the user arrived from a password-reset email and must choose a new password. */
  recovering: boolean;
  authOpen: boolean;
  openAuth: (mode?: 'signin' | 'signup') => void;
  authMode: 'signin' | 'signup';
  closeAuth: () => void;
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
  const [recovering, setRecovering] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const lastUser = useRef<string | null>(null);
  const signedInCb = useRef(onSignedIn);
  signedInCb.current = onSignedIn;
  // Same person = same object. Supabase hands out a new user object on every token refresh and whenever the tab is focused again;
  // pages that reload when `user` changes would otherwise restart (and cut the call) each time.
  const sessionUser = session?.user ?? null;
  const user = useMemo(() => sessionUser, [sessionUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true);
        setAuthOpen(true);
      }
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
        if (isNewUser && event === 'SIGNED_IN') {
          const provider = (next?.user.app_metadata as { provider?: string } | undefined)?.provider;
          track({ kind: 'signin', detail: provider === 'google' ? 'google' : 'email' });
          signedInCb.current?.();
        }
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

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
    // With "Confirm email" on, an already-registered address comes back with no identities and no error.
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovering(false);
  }, []);

  const openAuth = useCallback((mode?: 'signin' | 'signup') => {
    setAuthMode(mode === 'signup' ? 'signup' : 'signin');
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setRecovering(false);
  }, []);

  const signOut = useCallback(async () => {
    track({ kind: 'signout' });
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
      track({ kind: 'signup', detail: (user.app_metadata as { provider?: string } | undefined)?.provider === 'google' ? 'google' : 'email' });
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
    // Files this person shared in group chats live in a private bucket.
    const { data: shared } = await supabase.from('chat_messages').select('file_path').eq('author_id', user.id).not('file_path', 'is', null).limit(1000);
    const sharedPaths = (shared ?? []).map((r) => r.file_path as string).filter(Boolean);
    if (sharedPaths.length) await supabase.storage.from('chat-files').remove(sharedPaths);
    for (const bucket of ['avatars', 'media-public', 'media-paid']) {
      const { data } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
    }
    if (r2Enabled) await api('r2-delete', { all: true }).catch(() => undefined); // files kept in Cloudflare R2
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut();
  }, [user]);

  const ensureAuth = useCallback(() => {
    if (user && profile) return true;
    toast(t('sign_in_required'));
    if (!user) setAuthOpen(true);
    return false;
  }, [user, profile, toast, t]);

  const value = useMemo<AuthValue>(
    () => ({
      configured, loading, session, user, profile, wallet, blocked,
      signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, updatePassword, recovering,
      authOpen, authMode, openAuth, closeAuth,
      signOut, createProfile, updateProfile, refreshWallet, refreshBlocked, deleteAccount, ensureAuth,
    }),
    [loading, session, user, profile, wallet, blocked, signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset,
      updatePassword, recovering, authOpen, authMode, openAuth, closeAuth, signOut, createProfile, updateProfile, refreshWallet, refreshBlocked, deleteAccount, ensureAuth],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
