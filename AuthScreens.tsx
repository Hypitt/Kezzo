import { useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { HANDLE_RE } from '../lib/format';
import { Spinner } from './ui';
import type { Profile } from '../lib/types';

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

export function SignInCard() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-zinc-200 p-6 text-center">
      <h2 className="text-lg font-semibold">{t('sign_in_title')}</h2>
      <p className="mb-5 mt-1 text-sm text-zinc-500">{t('sign_in_sub')}</p>
      <GoogleButton />
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
            {t('agree_prefix')}{' '}
            <a className="underline" href="#/legal/terms" target="_blank" rel="noreferrer">{t('terms')}</a> {t('and')}{' '}
            <a className="underline" href="#/legal/privacy" target="_blank" rel="noreferrer">{t('privacy')}</a>. {t('age_confirm')}
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
