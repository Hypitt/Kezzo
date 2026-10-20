import { useEffect, type ReactNode } from 'react';
import { Coins, Image as ImageIcon, Languages, Radio, ShieldCheck, Swords, Users, Video, type LucideIcon } from 'lucide-react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { PENDING_JOIN } from '../lib/invite';

/**
 * The public page every visitor sees first. Everything else in Kezzo needs an account.
 * Pure markup and CSS (no pictures, no extra requests) so it opens fast, even on a slow connection.
 */

const COPY = {
  en: {
    login: 'Log in', signup: 'Sign up', language: 'Language',
    badge: 'Live creator battles',
    h1a: 'Battle live.', h1b: 'Get seen.', h1c: 'Win the crowd.',
    lead: 'Kezzo is where creators go head to head in live video and audio battles while the audience votes in real time. Perform, stream, share and grow your community.',
    cta: 'Create your free account', ctaNote: 'Free to join · 16+ · Takes less than a minute',
    mockLive: 'LIVE', mockRound: 'Round 2', mockVotes: 'votes',
    howTitle: 'How it works', howSub: 'From first vote to final score in three steps.',
    steps: [
      ['Join or host a battle', 'Step on stage with up to 5 competitors in a live video or audio battle, or host one for your own community.'],
      ['The crowd votes live', 'Fans vote with coins while you perform. Optional judges can score too, and standings move as the votes come in.'],
      ['Winners rise', 'Winners earn reward coins and bragging rights, and the best moment can be saved as a 90-second highlight.'],
    ],
    featTitle: 'Everything creators need in one place',
    feats: [
      ['Live battles', 'Dance, sing, debate, joke or roast. Battle in video or audio with a live scoreboard.'],
      ['Go Live', 'Stream solo or bring guests on stage, with live chat and no battle needed.'],
      ['Feeds and media', 'Share videos, audio, photos and text posts. Videos play as you scroll.'],
      ['Groups and chat', 'Private messages, group chats and calls to keep your community close.'],
      ['Coins and rewards', 'Start with free voting coins, get more every month and earn rewards when you win.'],
      ['Safe by design', '16+ only, with blocking, reporting and content rules to keep the community respectful.'],
    ],
    forTitleA: 'For creators', forA: ['Reach a live audience and get instant feedback', 'Record your battle and share a 90-second highlight', 'Build a following with posts, status and groups'],
    forTitleB: 'For fans', forB: ['Vote in live battles and shape the result', 'Follow your favourite creators and get notified when they go live', 'Join groups and chat with people who share your taste'],
    members: 'Kezzo is for members. Sign up or log in to see the feed, videos, live streams, battles and profiles.',
    finalTitle: 'Ready to step on stage?', finalSub: 'Join Kezzo today and start your first battle.',
    terms: 'Terms', privacy: 'Privacy', contact: 'Contact',
  },
  fr: {
    login: 'Se connecter', signup: 'S’inscrire', language: 'Langue',
    badge: 'Battles de créateurs en direct',
    h1a: 'Affrontez-vous en direct.', h1b: 'Faites-vous voir.', h1c: 'Gagnez la foule.',
    lead: 'Kezzo, c’est là où les créateurs s’affrontent dans des battles vidéo et audio en direct pendant que le public vote en temps réel. Performez, diffusez, partagez et faites grandir votre communauté.',
    cta: 'Créer mon compte gratuit', ctaNote: 'Gratuit · 16 ans et plus · Moins d’une minute',
    mockLive: 'EN DIRECT', mockRound: 'Manche 2', mockVotes: 'votes',
    howTitle: 'Comment ça marche', howSub: 'Du premier vote au score final en trois étapes.',
    steps: [
      ['Rejoignez ou animez un battle', 'Montez sur scène avec jusqu’à 5 concurrents dans un battle vidéo ou audio en direct, ou animez le vôtre pour votre communauté.'],
      ['La foule vote en direct', 'Les fans votent avec des pièces pendant que vous performez. Des juges facultatifs peuvent aussi noter, et le classement bouge au fil des votes.'],
      ['Les gagnants montent', 'Les gagnants remportent des pièces de récompense et la gloire, et le meilleur moment peut devenir un extrait de 90 secondes.'],
    ],
    featTitle: 'Tout ce qu’il faut aux créateurs, au même endroit',
    feats: [
      ['Battles en direct', 'Danse, chant, débat, humour ou roast. Affrontez-vous en vidéo ou en audio avec un tableau des scores en direct.'],
      ['Passer en direct', 'Diffusez seul ou invitez des personnes sur scène, avec clavardage en direct et sans battle.'],
      ['Fils et médias', 'Partagez vidéos, audio, photos et textes. Les vidéos démarrent pendant que vous défilez.'],
      ['Groupes et messages', 'Messages privés, clavardage de groupe et appels pour garder votre communauté proche.'],
      ['Pièces et récompenses', 'Commencez avec des pièces de vote gratuites, recevez-en chaque mois et gagnez des récompenses en gagnant.'],
      ['Sécuritaire dès la conception', '16 ans et plus seulement, avec blocage, signalement et règles de contenu pour une communauté respectueuse.'],
    ],
    forTitleA: 'Pour les créateurs', forA: ['Rejoignez un public en direct et recevez des réactions instantanées', 'Enregistrez votre battle et partagez un extrait de 90 secondes', 'Bâtissez votre communauté avec des publications, des statuts et des groupes'],
    forTitleB: 'Pour les fans', forB: ['Votez dans les battles en direct et influencez le résultat', 'Suivez vos créateurs préférés et soyez avisé quand ils passent en direct', 'Joignez des groupes et discutez avec des gens qui ont vos goûts'],
    members: 'Kezzo est réservé aux membres. Inscrivez-vous ou connectez-vous pour voir le fil, les vidéos, les directs, les battles et les profils.',
    finalTitle: 'Prêt à monter sur scène?', finalSub: 'Joignez Kezzo aujourd’hui et lancez votre premier battle.',
    terms: 'Conditions', privacy: 'Confidentialité', contact: 'Contact',
  },
} as const;

const FEAT_ICONS: LucideIcon[] = [Swords, Radio, ImageIcon, Users, Coins, ShieldCheck];

/** Black top bar with the logo, language switch and the Log in / Sign up buttons. */
function Header() {
  const { openAuth } = useAuth();
  const { lang, setLang } = useI18n();
  const { go } = useRouter();
  const c = COPY[lang];
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('search'); }} className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-white">
          <img src="/logo-white.svg" alt="" width="20" height="28" className="h-7 w-auto" decoding="async" />
          Kezzo
        </a>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-sm border border-zinc-600 bg-transparent text-white hover:bg-zinc-800" onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} aria-label={c.language}>
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />{lang.toUpperCase()}
          </button>
          <button type="button" className="btn btn-sm border border-zinc-600 bg-transparent text-white hover:bg-zinc-800" onClick={() => openAuth('signin')}>{c.login}</button>
          <button type="button" className="btn btn-sm btn-accent" onClick={() => openAuth('signup')}>{c.signup}</button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { lang } = useI18n();
  const { go } = useRouter();
  const c = COPY[lang];
  return (
    <footer className="border-t border-zinc-800 bg-black px-4 py-8 text-center text-xs text-zinc-400">
      <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <button type="button" className="underline hover:text-white" onClick={() => go('legal', 'terms')}>{c.terms}</button>
        <button type="button" className="underline hover:text-white" onClick={() => go('legal', 'privacy')}>{c.privacy}</button>
        <a className="underline hover:text-white" href="mailto:kezzo.app@gmail.com">{c.contact}</a>
      </div>
      <p>© {new Date().getFullYear()} WeDIL Inc., Montréal, Québec</p>
    </footer>
  );
}

/** Header and footer around a public page (the landing page, and the Terms and Privacy pages while signed out). */
export function PublicFrame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`flex min-h-screen flex-col ${dark ? 'bg-black' : 'bg-white'}`}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** A stylised battle frame made of plain boxes: shows the idea without loading any picture. */
function BattleMock() {
  const { lang } = useI18n();
  const c = COPY[lang];
  const tile = (name: string, pct: number, bar: string, tint: string) => (
    <div className={`relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-xl p-3 ${tint}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} aria-hidden="true" />
      <span className="self-end rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">{pct}%</span>
      <div>
        <div className="mb-2 h-10 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <p className="text-sm font-semibold text-white">{name}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/15"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-zinc-300">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 font-bold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />{c.mockLive}</span>
        <span>{c.mockRound} · 0:42</span>
        <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />1.2k</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tile('Maya', 54, 'bg-accent', 'bg-gradient-to-br from-zinc-700 to-zinc-900')}
        {tile('Jo', 46, 'bg-sky-500', 'bg-gradient-to-br from-zinc-600 to-black')}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-black px-3 py-2 text-xs text-zinc-300">
        <span className="inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-amber-400" />+5 {c.mockVotes}</span>
        <span className="font-semibold text-white">Maya 54% · Jo 46%</span>
      </div>
    </div>
  );
}

export function Landing({ invite }: { invite?: string }) {
  const { openAuth } = useAuth();
  const { lang } = useI18n();
  const c = COPY[lang];

  // A group invite opened while signed out: remember it, and ask the person to sign up. They join right after.
  useEffect(() => {
    if (!invite) return;
    try { localStorage.setItem(PENDING_JOIN, invite); } catch { /* private mode: the link still works once signed in */ }
    openAuth('signup');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  useEffect(() => {
    document.title = lang === 'fr' ? 'Kezzo – Battles de créateurs en direct' : 'Kezzo – Live creator battles';
  }, [lang]);

  return (
    <PublicFrame dark>
      {/* Hero */}
      <section className="relative overflow-hidden bg-black text-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />{c.badge}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-6xl">
              {c.h1a}<br />{c.h1b}<br /><span className="text-accent">{c.h1c}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">{c.lead}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-accent px-6 py-3 text-base" onClick={() => openAuth('signup')}>{c.cta}</button>
              <button type="button" className="btn border border-zinc-600 bg-transparent px-6 py-3 text-base text-white hover:bg-zinc-800" onClick={() => openAuth('signin')}>{c.login}</button>
            </div>
            <p className="mt-3 text-xs text-zinc-400">{c.ctaNote}</p>
          </div>
          <BattleMock />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-4 py-16 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold">{c.howTitle}</h2>
          <p className="mt-2 text-zinc-600">{c.howSub}</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {c.steps.map(([title, text], i) => (
              <li key={title} className="rounded-2xl border border-zinc-200 p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black font-display text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="bg-zinc-50 px-4 py-16 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold">{c.featTitle}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.feats.map(([title, text], i) => {
              const Icon = FEAT_ICONS[i];
              return (
                <li key={title} className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Creators and fans */}
      <section className="bg-white px-4 py-16 text-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          {([[c.forTitleA, c.forA], [c.forTitleB, c.forB]] as const).map(([title, items]) => (
            <div key={title} className="rounded-2xl bg-black p-6 text-white">
              <h3 className="text-xl font-bold">{title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                {items.map((item) => (
                  <li key={item} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-zinc-600">{c.members}</p>
      </section>

      {/* Final call to action */}
      <section className="bg-black px-4 py-16 text-center text-white">
        <h2 className="text-3xl font-bold sm:text-4xl">{c.finalTitle}</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">{c.finalSub}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-accent px-6 py-3 text-base" onClick={() => openAuth('signup')}>{c.signup}</button>
          <button type="button" className="btn border border-zinc-600 bg-transparent px-6 py-3 text-base text-white hover:bg-zinc-800" onClick={() => openAuth('signin')}>{c.login}</button>
        </div>
      </section>
    </PublicFrame>
  );
}
