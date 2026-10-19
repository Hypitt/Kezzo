import { useEffect, useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { HANDLE_RE } from '../lib/format';
import { Spinner } from './ui';
import type { Profile } from '../lib/types';
import { LegalNotice } from '../state/Legal';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  const { t } = useI18n();
  return (
    <button type="button" className="btn btn-ghost w-full" onClick={signInWithGoogle}>
      <GoogleLogo />
      {t('sign_in_google')}
    </button>
  );
}

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authErrorKey(err: unknown): Parameters<ReturnType<typeof useI18n>['t']>[0] {
  const e = err as { code?: string; message?: string; status?: number };
  const msg = (e.message ?? '').toLowerCase();
  if (e.code === 'invalid_credentials' || msg.includes('invalid login')) return 'err_invalid_credentials';
  if (e.code === 'user_already_exists' || msg.includes('already registered')) return 'err_email_taken';
  if (e.code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'err_email_unconfirmed';
  if (e.code === 'weak_password' || msg.includes('password should')) return 'err_password_short';
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || msg.includes('rate limit')) return 'err_rate_limit';
  return 'error_generic';
}

/** Email + password form: sign in, sign up, forgot password and "choose a new password". */
function EmailForm({ mode, setMode, onDone }: { mode: Mode; setMode: (m: Mode) => void; onDone: () => void }) {
  const { signInWithEmail, signUpWithEmail, sendPasswordReset, updatePassword } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    setError(null);
    setNotice(null);
    if (mode !== 'recovery' && !EMAIL_RE.test(mail)) return setError(t('err_email_invalid'));
    if (mode !== 'forgot' && password.length < 8) return setError(t('err_password_short'));
    if ((mode === 'signup' || mode === 'recovery') && password !== confirm) return setError(t('err_password_mismatch'));
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(mail, password);
        onDone();
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithEmail(mail, password);
        if (needsConfirmation) setNotice(t('check_email_confirm'));
        else onDone();
      } else if (mode === 'forgot') {
        await sendPasswordReset(mail);
        setNotice(t('reset_sent'));
      } else {
        await updatePassword(password);
        toast(t('password_updated'));
        onDone();
      }
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const submitLabel =
    mode === 'signin' ? t('sign_in') : mode === 'signup' ? t('create_account') : mode === 'forgot' ? t('send_reset') : t('set_password');

  return (
    <form onSubmit={submit} className="space-y-3 text-left" noValidate>
      {mode !== 'recovery' && (
        <div>
          <label className="label" htmlFor="auth-email">{t('email')}</label>
          <input
            id="auth-email" type="email" className="input" value={email} autoComplete="email" inputMode="email"
            onChange={(e) => setEmail(e.target.value)} required
          />
        </div>
      )}
      {mode !== 'forgot' && (
        <div>
          <label className="label" htmlFor="auth-password">{mode === 'recovery' ? t('new_password') : t('password')}</label>
          <input
            id="auth-password" type="password" className="input" value={password} minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)} required
          />
          {mode !== 'signin' && <p className="mt-1 text-xs text-zinc-500">{t('password_hint')}</p>}
        </div>
      )}
      {(mode === 'signup' || mode === 'recovery') && (
        <div>
          <label className="label" htmlFor="auth-confirm">{t('confirm_password')}</label>
          <input
            id="auth-confirm" type="password" className="input" value={confirm} autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)} required
          />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Spinner />}
        {submitLabel}
      </button>
      {mode === 'signin' && (
        <button type="button" className="block w-full text-center text-xs text-zinc-500 underline" onClick={() => setMode('forgot')}>
          {t('forgot_password')}
        </button>
      )}
      {mode === 'forgot' && (
        <button type="button" className="block w-full text-center text-xs text-zinc-500 underline" onClick={() => setMode('signin')}>
          {t('back_to_sign_in')}
        </button>
      )}
    </form>
  );
}

/** Both ways in, side by side: Google, or email + password (sign in / sign up). */
export function AuthPanel({ onDone, initialMode = 'signin' }: { onDone: () => void; initialMode?: Mode }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(initialMode);

  if (mode === 'recovery') {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">{t('new_password')}</h2>
        <EmailForm mode="recovery" setMode={setMode} onDone={onDone} />
      </div>
    );
  }

  const tab = (m: 'signin' | 'signup', label: string) => (
    <button
      type="button" role="tab" aria-selected={mode === m}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === m ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h2 className="text-center text-lg font-semibold">{mode === 'signup' ? t('create_account') : t('sign_in_title')}</h2>
      <p className="mb-4 mt-1 text-center text-sm text-zinc-500">{t('sign_in_sub')}</p>
      {mode !== 'forgot' && (
        <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-zinc-100 p-1">
          {tab('signin', t('sign_in'))}
          {tab('signup', t('sign_up'))}
        </div>
      )}
      <GoogleButton />
      <div className="my-4 flex items-center gap-3 text-xs text-zinc-400" aria-hidden="true">
        <span className="h-px flex-1 bg-zinc-200" />
        {t('or')}
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <EmailForm mode={mode} setMode={setMode} onDone={onDone} />
      <p className="mt-4 text-center text-xs text-zinc-500"><LegalNotice /></p>
    </div>
  );
}

export function SignInCard() {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-zinc-200 p-6">
      <AuthPanel onDone={() => undefined} />
    </div>
  );
}

/** Pop-up opened by the navbar "Sign in" button, or whenever a signed-out user tries to act. */
export function AuthDialog() {
  const { authOpen, closeAuth, recovering, user } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeAuth();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, closeAuth]);

  // Close automatically once signed in (except while choosing a new password).
  useEffect(() => {
    if (authOpen && user && !recovering) closeAuth();
  }, [authOpen, user, recovering, closeAuth]);

  if (!authOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && closeAuth()}>
      <div role="dialog" aria-modal="true" aria-label={t('sign_in')} className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <AuthPanel onDone={closeAuth} initialMode={recovering ? 'recovery' : 'signin'} />
        <button type="button" className="mt-4 block w-full text-center text-xs text-zinc-500 underline" onClick={closeAuth}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

/** Shows children only when signed in; otherwise the sign-in card. */
export function Gate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <SignInCard />;
}

export function SetupNotice() {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
      <h1 className="mb-2 text-lg font-semibold">Kezzo is not configured yet</h1>
      <p>
        Add <code className="rounded bg-white px-1">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-white px-1">VITE_SUPABASE_ANON_KEY</code> to <code className="rounded bg-white px-1">.env.local</code>{' '}
        (or to your Vercel environment variables), then restart. See the README for the full setup.
      </p>
    </div>
  );
}

export function Onboarding() {
  const { user, createProfile, signOut } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const [displayName, setDisplayName] = useState((meta.full_name || meta.name || '').slice(0, 40));
  const [handle, setHandle] = useState('');
  const [generation, setGeneration] = useState<Profile['generation']>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const h = handle.trim().toLowerCase().replace(/^@/, '');
    if (!HANDLE_RE.test(h)) return setError(t('err_handle_format'));
    if (!displayName.trim()) return setError(t('err_name_required'));
    if (!agreed) return setError(t('err_agree_required'));
    setBusy(true);
    setError(null);
    try {
      await createProfile({ handle: h, display_name: displayName.trim(), generation });
      toast(t('welcome_toast'));
      go('search');
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === '23505' ? t('err_handle_taken') : t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold">{t('onboarding_title')}</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-500">{t('onboarding_sub')}</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="ob-name">{t('display_name')}</label>
          <input id="ob-name" className="input" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="ob-handle">{t('handle')}</label>
          <div className="flex items-center rounded-lg border border-zinc-300 focus-within:border-zinc-900">
            <span className="pl-3 text-sm text-zinc-400">@</span>
            <input
              id="ob-handle"
              className="w-full rounded-lg bg-transparent px-2 py-2 text-sm outline-none"
              value={handle}
              maxLength={20}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder="your_name"
              autoComplete="off"
              required
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{t('handle_hint')}</p>
        </div>
        <div>
          <label className="label" htmlFor="ob-gen">{t('generation')}</label>
          <select id="ob-gen" className="input" value={generation ?? ''} onChange={(e) => setGeneration((e.target.value || null) as Profile['generation'])}>
            <option value="">{t('prefer_not_say')}</option>
            <option value="Gen Z">Gen Z</option>
            <option value="Millennial">Millennial</option>
            <option value="Other">{t('other')}</option>
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            <LegalNotice prefixKey="agree_prefix" /> {t('age_confirm')}
          </span>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Spinner />}
          {t('create_profile')}
        </button>
        <button type="button" className="w-full text-center text-sm text-zinc-500 underline" onClick={signOut}>
          {t('sign_out')}
        </button>
      </form>
    </div>
  );
}
