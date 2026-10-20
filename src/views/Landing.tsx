import { useEffect, useState, type ReactNode } from 'react';
import { Heart, Languages, MessageCircle, Mic, Radio, Swords, UserPlus, Users, Video, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { PENDING_GROUP, PENDING_JOIN } from '../lib/invite';

/**
 * The public page every visitor sees first. Everything else in Kezzo needs an account.
 * Plain markup and CSS (no pictures, no scripts beyond two tiny read-only calls) so it opens fast on any connection.
 * Palette: white and warm stone surfaces, near-black text, one brand red used only for the main buttons and small accents.
 */

const COPY = {
  en: {
    login: 'Log in', signup: 'Sign up', language: 'Language',
    eyebrow: 'Live battles · Live streams · Groups',
    live: (n: number) => (n === 1 ? '1 battle live right now' : `${n} battles live right now`),
    h1a: 'Social is better', h1b: 'when you’re in it.',
    lead: 'A place to discover people, share your world, join live conversations, challenge creators, and turn ordinary moments into something everyone can be part of.',
    cta: 'Create your free account', ctaNote: 'Free to join · 16+ · Takes less than a minute',
    mockLive: 'LIVE', mockRound: 'Round 2', mockVotes: 'votes',
    lines: ['Don’t just scroll. Get involved.', 'Your people. Your moments. Your stage.', 'More than a feed. A whole experience.', 'Where the crowd makes the moment.'],
    battlesKicker: 'Open to everyone', battlesTitle: 'Live battles that anyone can join',
    battlesText: 'Discover ongoing battles without having to know the creators beforehand. Watch, vote with your coins as it happens, or step on stage yourself.',
    battlesPoints: ['Find battles happening right now', 'Vote live and watch the scores move', 'Join the stage with up to 5 competitors'],
    battlesCta: 'Sign up to join a battle',
    liveKicker: 'Three ways to be live', liveTitle: 'Live together, not just alone',
    liveText: 'Solo broadcasts, group livestreams and battles are different experiences, and Kezzo treats them that way. Bring friends or other creators on screen and talk with your audience as it happens.',
    modes: [
      ['Solo broadcast', 'Go live on your own with live chat. No battle needed.'],
      ['Group livestream', 'Invite guests onto the screen. Viewers ask to join, you decide who comes up.'],
      ['Battle', 'Creator versus creator, with a live scoreboard and votes from the crowd.'],
    ],
    feedKicker: 'More than likes', feedTitle: 'A feed that leads to participation',
    feedText: 'Videos, audio, photos and posts are there to start something. React, comment, follow, join a group and jump into the live moments around you.',
    feedNow: 'Available now', feedNowItems: ['Video, audio, photo and text posts', 'Likes, comments and follows', 'Groups, chats and calls', '24-hour status updates'],
    feedSoon: 'Coming soon', feedSoonItems: ['Polls', 'Audience questions', 'Challenges', 'Creator prompts'],
    groupsKicker: 'Communities', groupsTitle: 'Groups you can join', groupsText: 'Open groups from the Kezzo community. Sign up or log in to join.',
    example: 'Example', exGroups: [['Podcast & talk', 'Voices, interviews and live Q&A'], ['Creators corner', 'Share your setup and tips'], ['Friends & fun', 'Challenges with your crew']],
    groupMembers: (n: number) => (n === 1 ? '1 member' : `${n} members`), groupJoin: 'Sign up to join',
    cats: { dance: 'Dance crew', roasting: 'Roasting', singing: 'Singing', debate: 'Debate', comedy: 'Comedy', other: 'Community' } as Record<string, string>,
    members: 'Kezzo is for members. Sign up or log in to see the feed, videos, live streams, battles and profiles.',
    finalTitle: 'Don’t just scroll. Get involved.', finalSub: 'Join Kezzo today and be part of the next moment.',
    terms: 'Terms', privacy: 'Privacy', contact: 'Contact',
  },
  fr: {
    login: 'Se connecter', signup: 'S’inscrire', language: 'Langue',
    eyebrow: 'Battles en direct · Directs · Groupes',
    live: (n: number) => (n === 1 ? '1 battle en direct maintenant' : `${n} battles en direct maintenant`),
    h1a: 'Le social est meilleur', h1b: 'quand on y participe.',
    lead: 'Un endroit pour découvrir des gens, partager votre univers, rejoindre des conversations en direct, défier des créateurs et transformer des moments ordinaires en quelque chose auquel tout le monde peut participer.',
    cta: 'Créer mon compte gratuit', ctaNote: 'Gratuit · 16 ans et plus · Moins d’une minute',
    mockLive: 'EN DIRECT', mockRound: 'Manche 2', mockVotes: 'votes',
    lines: ['Ne faites pas que défiler. Participez.', 'Vos gens. Vos moments. Votre scène.', 'Plus qu’un fil. Toute une expérience.', 'Là où la foule fait le moment.'],
    battlesKicker: 'Ouvert à tous', battlesTitle: 'Des battles en direct où tout le monde peut entrer',
    battlesText: 'Découvrez les battles en cours sans avoir à connaître les créateurs d’avance. Regardez, votez avec vos pièces en direct, ou montez vous-même sur scène.',
    battlesPoints: ['Trouvez les battles qui se déroulent maintenant', 'Votez en direct et regardez les scores bouger', 'Montez sur scène avec jusqu’à 5 concurrents'],
    battlesCta: 'S’inscrire pour rejoindre un battle',
    liveKicker: 'Trois façons d’être en direct', liveTitle: 'En direct ensemble, pas seulement seul',
    liveText: 'Les diffusions solo, les directs de groupe et les battles sont des expériences différentes, et Kezzo les traite ainsi. Faites monter vos amis ou d’autres créateurs à l’écran et échangez avec votre public en temps réel.',
    modes: [
      ['Diffusion solo', 'Passez en direct seul, avec clavardage en direct. Aucun battle nécessaire.'],
      ['Direct de groupe', 'Invitez des personnes à l’écran. Les spectateurs demandent à monter, vous choisissez qui vient.'],
      ['Battle', 'Créateur contre créateur, avec un tableau des scores en direct et les votes de la foule.'],
    ],
    feedKicker: 'Plus que des J’aime', feedTitle: 'Un fil qui mène à la participation',
    feedText: 'Les vidéos, l’audio, les photos et les publications servent à lancer quelque chose. Réagissez, commentez, abonnez-vous, joignez un groupe et entrez dans les moments en direct autour de vous.',
    feedNow: 'Disponible maintenant', feedNowItems: ['Publications vidéo, audio, photo et texte', 'J’aime, commentaires et abonnements', 'Groupes, messages et appels', 'Statuts de 24 heures'],
    feedSoon: 'Bientôt', feedSoonItems: ['Sondages', 'Questions du public', 'Défis', 'Suggestions pour créateurs'],
    groupsKicker: 'Communautés', groupsTitle: 'Des groupes à rejoindre', groupsText: 'Des groupes ouverts de la communauté Kezzo. Inscrivez-vous ou connectez-vous pour les rejoindre.',
    example: 'Exemple', exGroups: [['Podcast et discussions', 'Voix, entrevues et questions en direct'], ['Coin des créateurs', 'Partagez votre installation et vos astuces'], ['Amis et plaisir', 'Des défis entre amis']],
    groupMembers: (n: number) => (n === 1 ? '1 membre' : `${n} membres`), groupJoin: 'S’inscrire pour rejoindre',
    cats: { dance: 'Équipe de danse', roasting: 'Roasting', singing: 'Chant', debate: 'Débat', comedy: 'Humour', other: 'Communauté' } as Record<string, string>,
    members: 'Kezzo est réservé aux membres. Inscrivez-vous ou connectez-vous pour voir le fil, les vidéos, les directs, les battles et les profils.',
    finalTitle: 'Ne faites pas que défiler. Participez.', finalSub: 'Joignez Kezzo aujourd’hui et faites partie du prochain moment.',
    terms: 'Conditions', privacy: 'Confidentialité', contact: 'Contact',
  },
} as const;

const MODE_ICONS: LucideIcon[] = [Mic, Users, Swords];

interface LandingGroup { id: string; name: string; tagline: string; category: string; member_count: number }

const outline = 'btn border border-zinc-300 bg-white text-zinc-900 hover:bg-stone-100';

/** White top bar with the logo, language switch and the Log in / Sign up buttons. */
function Header() {
  const { openAuth } = useAuth();
  const { lang, setLang } = useI18n();
  const { go } = useRouter();
  const c = COPY[lang];
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 text-zinc-900 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('search'); }} className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-zinc-900">
          <img src="/logo.svg" alt="" width="20" height="28" className="h-7 w-auto" decoding="async" />
          Kezzo
        </a>
        <div className="flex items-center gap-2">
          <button type="button" className={`${outline} btn-sm`} onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} aria-label={c.language}>
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />{lang.toUpperCase()}
          </button>
          <button type="button" className={`${outline} btn-sm`} onClick={() => openAuth('signin')}>{c.login}</button>
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
    <footer className="border-t border-stone-200 bg-stone-50 px-4 py-8 text-center text-xs text-zinc-500">
      <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <button type="button" className="underline hover:text-zinc-900" onClick={() => go('legal', 'terms')}>{c.terms}</button>
        <button type="button" className="underline hover:text-zinc-900" onClick={() => go('legal', 'privacy')}>{c.privacy}</button>
        <a className="underline hover:text-zinc-900" href="mailto:kezzo.app@gmail.com">{c.contact}</a>
      </div>
      <p>© {new Date().getFullYear()} WeDIL Inc., Montréal, Québec</p>
    </footer>
  );
}

/** Header and footer around a public page (the landing page, and the Terms and Privacy pages while signed out). */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** A calm, stylised battle frame made of plain boxes: shows the idea without loading any picture. */
/** A real photo from public/landing. No drawn avatar: until the photo is added, a plain neutral circle is shown. */
function Person({ photo }: { photo: string }) {
  const [ok, setOk] = useState(true);
  return (
    <span className="relative inline-block h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-stone-200">
      {ok && <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setOk(false)} />}
    </span>
  );
}

/** Full-tile real photo (public/landing); hidden when the file is missing. */
function Cover({ photo }: { photo: string }) {
  const [ok, setOk] = useState(true);
  return ok ? <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={() => setOk(false)} /> : null;
}

/** Community video behind the hero. Optional: without /landing/hero.mp4 the card stays solid dark. Skipped for reduced motion or slow data. */
function HeroVideo() {
  const [play, setPlay] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
    const slow = nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '');
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setPlay(!slow && !still);
  }, []);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <img src="/landing/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" decoding="async" />
      {play && (
        <video
          className={`h-full w-full object-cover transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
          autoPlay muted loop playsInline preload="metadata" poster="/landing/hero.jpg"
          onCanPlay={() => setReady(true)} onError={() => setReady(false)}
        >
          <source src="/landing/hero.mp4" type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/35" />
    </div>
  );
}

function BattleMock() {
  const { lang } = useI18n();
  const c = COPY[lang];
  const tile = (name: string, pct: number, bar: string, n: number) => (
    <div className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-xl bg-stone-200 p-3">
      <Cover photo={`/landing/tile-${n + 1}.jpg`} />
      <span className="relative self-end rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-900 shadow-sm">{pct}%</span>
      <div className="relative rounded-lg bg-white/90 p-2">
        <p className="text-sm font-semibold text-zinc-900">{name}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-stone-300"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-stone-200 bg-white p-3 shadow-sm" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" />{c.mockLive}</span>
        <span>{c.mockRound} · 0:42</span>
        <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />1.2k</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tile('Maya', 54, 'bg-accent', 0)}
        {tile('Jo', 46, 'bg-zinc-800', 1)}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-accent" />+5 {c.mockVotes}</span>
        <span className="font-semibold text-zinc-900">Maya 54% · Jo 46%</span>
      </div>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-zinc-700">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-accent" aria-hidden="true">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
      </span>
      {children}
    </li>
  );
}

export function Landing({ invite }: { invite?: string }) {
  const { openAuth } = useAuth();
  const { lang } = useI18n();
  const c = COPY[lang];
  const [groups, setGroups] = useState<LandingGroup[]>([]);
  const [liveBattles, setLiveBattles] = useState(0);

  // A group invite opened while signed out: remember it and ask the person to sign up. They join right after.
  useEffect(() => {
    if (!invite) return;
    try { localStorage.setItem(PENDING_JOIN, invite); } catch { /* private mode: the link still works once signed in */ }
    openAuth('signup');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  useEffect(() => {
    document.title = lang === 'fr' ? 'Kezzo – Battles de créateurs en direct' : 'Kezzo – Live creator battles';
  }, [lang]);

  // Featured groups and a live counter. Nothing is shown if there is nothing to show (or if update-8.sql has not been run yet).
  useEffect(() => {
    let off = false;
    void (async () => {
      const [g, s] = await Promise.all([supabase.rpc('landing_groups'), supabase.rpc('landing_stats')]);
      if (off) return;
      if (!g.error && Array.isArray(g.data)) setGroups(g.data as LandingGroup[]);
      const stats = s.data as { live_battles?: number } | null;
      if (!s.error && stats?.live_battles) setLiveBattles(Number(stats.live_battles));
    })();
    return () => { off = true; };
  }, []);

  const joinGroup = (id: string) => {
    try { localStorage.setItem(PENDING_GROUP, id); } catch { /* ignore */ }
    openAuth('signup');
  };

  return (
    <PublicFrame>
      {/* Hero: a card with a short community video behind it */}
      <section className="bg-white px-3 pb-3 pt-4 sm:px-4 sm:pb-4 sm:pt-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-zinc-900 text-white">
          <HeroVideo />
          <div className="relative grid items-center gap-12 px-5 py-12 sm:px-10 sm:py-16 lg:grid-cols-2">
            <div>
              {liveBattles > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {c.live(liveBattles)}
                </span>
              )}
              <h1 className="mt-5 text-4xl font-bold leading-[1.08] text-white sm:text-6xl">
                {c.h1a}<br />{c.h1b}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{c.lead}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-accent px-6 py-3 text-base" onClick={() => openAuth('signup')}>{c.cta}</button>
                <button type="button" className="btn border border-white/60 bg-transparent px-6 py-3 text-base text-white hover:bg-white/10" onClick={() => openAuth('signin')}>{c.login}</button>
              </div>
              <p className="mt-3 text-xs text-white/70">{c.ctaNote}</p>
            </div>
            <BattleMock />
          </div>
        </div>
      </section>

      {/* Four lines that sum Kezzo up */}
      <section className="border-y border-stone-200 bg-stone-50 px-4 py-6" aria-label="Kezzo">
        <ul className="mx-auto grid max-w-6xl gap-x-8 gap-y-5 text-center sm:grid-cols-2 lg:grid-cols-4">
          {c.lines.map((line) => <li key={line} className="font-display text-lg font-semibold leading-snug text-zinc-900">{line}</li>)}
        </ul>
      </section>

      {/* Groups: real featured groups when a group admin chose to feature one, otherwise clearly labelled examples */}
      <section className="bg-white px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.groupsKicker}</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{c.groupsTitle}</h2>
          <p className="mt-1 text-sm text-zinc-600">{c.groupsText}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.length > 0 ? groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-zinc-900"><Users className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{g.name}</h3>
                  <p className="truncate text-xs text-zinc-500">{c.cats[g.category] ?? c.cats.other} · {c.groupMembers(g.member_count)}</p>
                </div>
                <button type="button" className={`${outline} btn-sm shrink-0`} onClick={() => joinGroup(g.id)}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{c.groupJoin}
                </button>
              </li>
            )) : c.exGroups.map(([name, text], i) => (
              <li key={name} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="relative h-24">
                  <img src={['/landing/group-podcast.jpg', '/landing/group-creators.jpg', '/landing/group-friends.jpg'][i]} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">{c.example}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{name}</h3><p className="truncate text-xs text-zinc-500">{text}</p></div>
                  <button type="button" className={`${outline} btn-sm shrink-0`} onClick={() => openAuth('signup')}>{c.groupJoin}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Battles anyone can join */}
      <section className="bg-white px-4 py-12 text-zinc-900">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.battlesKicker}</p>
            <h2 className="mt-2 text-3xl font-bold">{c.battlesTitle}</h2>
            <p className="mt-3 leading-relaxed text-zinc-600">{c.battlesText}</p>
            <ul className="mt-5 space-y-3">{c.battlesPoints.map((p) => <Check key={p}>{p}</Check>)}</ul>
            <button type="button" className="btn btn-accent mt-6 px-5 py-2.5" onClick={() => openAuth('signup')}>{c.battlesCta}</button>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6" aria-hidden="true">
            <div className="space-y-3">
              {[['Dance', 'Maya vs Jo', 0, 1], ['Comedy', 'Sam vs Lee vs Noor', 2, 3], ['Singing', 'Ana vs Eli', 4, 5]].map(([tag, who, a, b], row) => (
                <div key={who as string} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex -space-x-3">
                      <Person photo={`/landing/battle-${row * 2 + 1}.jpg`} />
                      <Person photo={`/landing/battle-${row * 2 + 2}.jpg`} />
                    </span>
                    <div><p className="text-sm font-semibold text-zinc-900">{who}</p><p className="text-xs text-zinc-500">{tag}</p></div>
                  </div>
                  <Swords className="h-4 w-4 text-zinc-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Solo, group, battle */}
      <section className="bg-stone-50 px-4 py-12 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.liveKicker}</p>
            <h2 className="mt-2 text-3xl font-bold">{c.liveTitle}</h2>
            <p className="mt-3 leading-relaxed text-zinc-600">{c.liveText}</p>
          </div>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {c.modes.map(([title, text], i) => {
              const Icon = MODE_ICONS[i];
              return (
                <li key={title} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <img src={['/landing/mode-solo.jpg', '/landing/mode-group.jpg', '/landing/mode-battle.jpg'][i]} alt="" className="h-28 w-full object-cover" loading="lazy" decoding="async" />
                  <div className="p-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-4 w-4 text-accent" aria-hidden="true" />{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">{text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Participation */}
      <section className="bg-white px-4 py-12 text-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.feedKicker}</p>
            <h2 className="mt-2 text-3xl font-bold">{c.feedTitle}</h2>
            <p className="mt-3 leading-relaxed text-zinc-600">{c.feedText}</p>
            <img src="/landing/feed.jpg" alt="" className="mt-5 h-44 w-full rounded-xl object-cover sm:h-52" loading="lazy" decoding="async" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Radio className="h-4 w-4 text-accent" aria-hidden="true" />{c.feedNow}</h3>
              <ul className="mt-3 space-y-3">{c.feedNowItems.map((p) => <Check key={p}>{p}</Check>)}</ul>
            </div>
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-zinc-500" aria-hidden="true" />{c.feedSoon}</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">{c.feedSoonItems.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="bg-zinc-900 px-4 py-16 text-center text-white">
        <h2 className="text-3xl font-bold sm:text-4xl">{c.finalTitle}</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">{c.finalSub}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-accent px-6 py-3 text-base" onClick={() => openAuth('signup')}>{c.signup}</button>
          <button type="button" className="btn border border-zinc-500 bg-transparent px-6 py-3 text-base text-white hover:bg-zinc-800" onClick={() => openAuth('signin')}>{c.login}</button>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-xs text-zinc-400">{c.members}</p>
      </section>
    </PublicFrame>
  );
}
