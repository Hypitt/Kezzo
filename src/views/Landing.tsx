import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Languages, Mic, Swords, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { PENDING_GROUP, PENDING_JOIN } from '../lib/invite';
import { InstallButton } from '../components/InstallButton';

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
    h1a: 'Get to know the world', h1b: 'through its people.',
    lead: 'Show the world what makes your culture unique. Share your traditions, celebrate your heritage, exchange stories, and discover music, food, languages, and lifestyles from around the world.',
    leadTag: 'Share your culture. Discover the world.',
    cta: 'Create your free account', ctaNote: 'Free to join · 16+ · Takes less than a minute',
    lines: ['Don’t just watch. Be part of it.', 'Your people. Your moments. Your stage.'],
    pillars: [
      ['02 · Social participation', 'Don’t just scroll. Get involved.', 'Join conversations, react to live moments, meet new people, and become part of experiences that bring communities together.'],
      ['03 · Cultural exchange', 'Your culture. Your stories. Your world.', 'Show the world what makes your culture unique. Share your traditions, celebrate your heritage, exchange stories, and discover music, food, languages, and lifestyles from around the world.'],
      ['04 · Live competitions', 'Bring your talent. Join the challenge.', 'Take part in live competitions, challenge creators, showcase your skills, and rally your community. Step into the action and see what happens when talent meets friendly competition.'],
      ['05 · Live events', 'Be there when it happens.', 'Discover live events, join shared experiences, meet people with similar interests, and be part of the moments everyone is talking about.'],
      ['06 · Community & connection', 'More than a feed. A whole experience.', 'From cultural discoveries to live competitions and community events, find new ways to express yourself, connect with others, and make every interaction count.'],
    ],
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
    example: 'Example', exGroups: [['Podcast & talk', 'Voices, interviews and live Q&A', 2415], ['Creators corner', 'Share your setup and tips', 1248], ['Friends & fun', 'Challenges with your crew', 862]],
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
    h1a: 'Découvrez le monde', h1b: 'à travers ses gens.',
    lead: 'Montrez au monde ce qui rend votre culture unique. Partagez vos traditions, célébrez votre héritage, échangez des histoires et découvrez la musique, la cuisine, les langues et les modes de vie du monde entier.',
    leadTag: 'Partagez votre culture. Découvrez le monde.',
    cta: 'Créer mon compte gratuit', ctaNote: 'Gratuit · 16 ans et plus · Moins d’une minute',
    lines: ['Ne faites pas que regarder. Faites-en partie.', 'Vos gens. Vos moments. Votre scène.'],
    pillars: [
      ['02 · Participation sociale', 'Ne faites pas que défiler. Participez.', 'Joignez des conversations, réagissez aux moments en direct, rencontrez de nouvelles personnes et faites partie d’expériences qui rassemblent les communautés.'],
      ['03 · Échange culturel', 'Votre culture. Vos histoires. Votre monde.', 'Montrez au monde ce qui rend votre culture unique. Partagez vos traditions, célébrez votre héritage, échangez des histoires et découvrez la musique, la cuisine, les langues et les modes de vie du monde entier.'],
      ['04 · Compétitions en direct', 'Apportez votre talent. Relevez le défi.', 'Participez à des compétitions en direct, défiez des créateurs, mettez vos talents en valeur et mobilisez votre communauté. Entrez dans l’action et voyez ce qui arrive quand le talent rencontre la compétition amicale.'],
      ['05 · Événements en direct', 'Soyez là quand ça se passe.', 'Découvrez des événements en direct, vivez des expériences partagées, rencontrez des gens qui partagent vos intérêts et faites partie des moments dont tout le monde parle.'],
      ['06 · Communauté et connexion', 'Plus qu’un fil. Toute une expérience.', 'Des découvertes culturelles aux compétitions en direct et aux événements communautaires, trouvez de nouvelles façons de vous exprimer, de vous connecter aux autres et de donner du sens à chaque interaction.'],
    ],
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
    example: 'Exemple', exGroups: [['Podcast et discussions', 'Voix, entrevues et questions en direct', 2415], ['Coin des créateurs', 'Partagez votre installation et vos astuces', 1248], ['Amis et plaisir', 'Des défis entre amis', 862]],
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
          <InstallButton compact className={`${outline} btn-sm`} />
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

/** Tiny looping clip: shows a still picture, and only plays (muted) while on screen. Stays a still for reduced motion / Save-Data. */
function LoopVideo({ name, className }: { name: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
    if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setOk(true);
    const v = ref.current;
    if (!v || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) void v.play().catch(() => undefined); else v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return ok
    ? <video ref={ref} className={className} muted loop playsInline preload="none" poster={`/landing/${name}.jpg`} src={`/landing/${name}.mp4`} aria-hidden="true" />
    : <img src={`/landing/${name}.jpg`} alt="" className={className} loading="lazy" decoding="async" />;
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
    document.title = 'Kezzo';
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
      {/* Hero: warm light card with a photo of people (white background, blended into the card) */}
      <section className="bg-white px-3 pb-3 pt-4 sm:px-4 sm:pb-4 sm:pt-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff8f4] via-[#fdeee6] to-[#f8d9cb] text-zinc-900">
          <div className="relative grid items-end gap-0 lg:grid-cols-[1.05fr_1fr]">
            <div className="px-5 pb-6 pt-10 sm:px-10 sm:pb-12 sm:pt-12 lg:self-center">
              {liveBattles > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-800 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {c.live(liveBattles)}
                </span>
              )}
              <h1 className="mt-5 text-4xl font-bold leading-[1.08] text-zinc-900 sm:text-5xl">
                {c.h1a}<br /><span className="text-accent">{c.h1b}</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-700 sm:text-base">{c.lead}</p>
              <p className="mt-4 max-w-xl text-base font-semibold leading-snug text-zinc-900 sm:text-lg">{c.leadTag}</p>
            </div>
            <div className="relative">
              {/* a soft colour disc behind the people */}
              <div className="pointer-events-none absolute inset-x-[10%] top-[8%] aspect-square rounded-full bg-[#f4b9a3]/45" aria-hidden="true" />
              <img
                src="/landing/hero-people.jpg"
                alt=""
                width="1400"
                height="1059"
                className="relative block w-full object-contain object-bottom mix-blend-multiply"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Two lines that sum Kezzo up */}
      <section className="border-y border-stone-200 bg-stone-50 px-4 py-3" aria-label="Kezzo">
        <ul className="mx-auto grid max-w-3xl gap-x-6 gap-y-2 text-center sm:grid-cols-2">
          {c.lines.map((line) => <li key={line} className="font-display text-sm font-semibold leading-snug text-zinc-900 sm:text-base">{line}</li>)}
        </ul>
      </section>

      {/* Groups: real featured groups when a group admin chose to feature one, otherwise clearly labelled examples */}
      <section className="bg-white px-4 py-6 text-zinc-900">
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
            )) : c.exGroups.map(([name, text, n], i) => (
              <li key={name} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="relative h-24">
                  <img src={['/landing/group-podcast.jpg', '/landing/group-creators.jpg', '/landing/group-friends.jpg'][i]} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">{c.example}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{name}</h3><p className="truncate text-xs text-zinc-500">{text}</p><p className="text-xs font-medium text-zinc-700">{c.groupMembers(n as number)}</p></div>
                  <button type="button" className={`${outline} btn-sm shrink-0`} onClick={() => openAuth('signup')}>{c.groupJoin}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Five things Kezzo is about */}
      <section className="bg-white px-4 py-10 text-zinc-900" aria-label="Kezzo">
        <ul className="mx-auto max-w-6xl divide-y divide-stone-200 border-y border-stone-200">
          {c.pillars.map(([kicker, title, text]) => (
            <li key={kicker} className="grid gap-2 py-6 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</p>
                <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{title}</h2>
              </div>
              <p className="leading-relaxed text-zinc-600 lg:pt-6">{text}</p>
            </li>
          ))}
        </ul>
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
                  {i < 2
                    ? <LoopVideo name={['clip-solo', 'clip-group'][i]} className="h-28 w-full object-cover" />
                    : <img src="/landing/mode-battle.jpg" alt="" className="h-28 w-full object-cover" loading="lazy" decoding="async" />}
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
          </div>
          <img src="/landing/feed.jpg" alt="" className="h-56 w-full rounded-xl object-cover sm:h-64" loading="lazy" decoding="async" />
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
