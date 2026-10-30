import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Minus, RefreshCw, ShieldAlert, Table2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { Chip, Loading, PageHeader, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { r2Enabled } from '../lib/storage';
import { HomeSections } from '../components/HomeSections';

/** Admin statistics. Only people listed in the `admins` table can load data (checked in the database, not here). */

interface Totals {
  visitors: number; views: number; sessions: number; signins: number; active_users: number; errors: number;
  load_avg: number | null; load_p75: number | null; bounce_rate: number; pages_per_session: number;
}
interface Named { name: string; visitors?: number; sessions?: number; n?: number; last_seen?: string }
interface Stats {
  days: number; tz: string; generated_at: string; tracking_since: string | null;
  current: Partial<Totals>; previous: Partial<Totals>;
  new_visitors: number; online_now: number;
  daily: { day: string; visitors: number; views: number; signins: number; new_users: number }[];
  hours: { hour: number; views: number }[];
  pages: { path: string; views: number; visitors: number }[];
  referrers: Named[]; countries: Named[]; devices: Named[]; browsers: Named[]; systems: Named[]; languages: Named[];
  signin_methods: Named[]; errors: Named[];
  platform: Record<string, number>;
}

const BLUE = '#2a78d6';
const ORANGE = '#eb6834';

const TEXT = {
  en: {
    title: 'Admin statistics', sub: 'How Kezzo is being used and how it performs. Visitors are anonymous.',
    days: (n: number) => `Last ${n} days`, refresh: 'Refresh', updated: 'Updated', noAccess: 'This page is for administrators only.',
    noAccessHelp: 'Ask the owner to add your account to the admins table.', failed: 'Could not load the statistics.',
    empty: 'No visits recorded yet. Statistics appear as soon as people open the site (visits with Do Not Track on are not counted).',
    since: 'Counting since', vsPrev: 'vs previous period',
    visitors: 'Visitors', views: 'Page views', sessions: 'Visits', signins: 'Sign-ins', newUsers: 'New accounts', active: 'Active members',
    bounce: 'Bounce rate', pps: 'Pages per visit', load: 'Page load (75th pct.)', errors: 'Errors', online: 'Active in last 30 min',
    newVisitors: 'First-time visitors', returning: 'Returning visitors',
    traffic: 'Traffic', trafficSub: 'Visitors and page views per day', growth: 'Sign-ins and new accounts', growthSub: 'Per day',
    hours: 'Busy hours', hoursSub: 'Page views by hour of day (your time zone)',
    pages: 'Top pages', referrers: 'Where visitors come from', countries: 'Countries', devices: 'Devices', browsers: 'Browsers', systems: 'Operating systems', languages: 'Languages',
    methods: 'Sign-in methods', platform: 'Platform activity', health: 'Performance and errors',
    users: 'Total members', registered: 'Registered users', registeredSub: 'All accounts, all time', today: 'Today', yesterday: 'Yesterday', todaySub: 'Today since midnight in your time zone, and yesterday as a full day', auto: 'Updates itself every minute', posts: 'Posts (period)', likes: 'Likes', comments: 'Comments', follows: 'Follows', battles: 'Battles created', battlesLive: 'Battles live now',
    battlesEnded: 'Battles ended (all time)', votes: 'Votes', lives: 'Go Live streams', liveNow: 'Streams live now', groups: 'Groups (all time)', messages: 'Messages', reports: 'Reports (all time)',
    table: 'Table', chart: 'Chart', day: 'Day', direct: 'direct', none: 'No data yet', error: 'Error', times: 'Times', last: 'Last seen',
    loadNote: 'Time until the page finished loading. Under 2.5 s is good.',
  },
  fr: {
    title: 'Statistiques admin', sub: 'Comment Kezzo est utilisé et sa performance. Les visiteurs sont anonymes.',
    days: (n: number) => `${n} derniers jours`, refresh: 'Actualiser', updated: 'Mis à jour', noAccess: 'Cette page est réservée aux administrateurs.',
    noAccessHelp: 'Demandez au propriétaire d’ajouter votre compte à la table admins.', failed: 'Impossible de charger les statistiques.',
    empty: 'Aucune visite enregistrée pour l’instant. Les statistiques apparaissent dès que des personnes ouvrent le site (les visites avec « Ne pas suivre » ne sont pas comptées).',
    since: 'Compté depuis le', vsPrev: 'vs période précédente',
    visitors: 'Visiteurs', views: 'Pages vues', sessions: 'Visites', signins: 'Connexions', newUsers: 'Nouveaux comptes', active: 'Membres actifs',
    bounce: 'Taux de rebond', pps: 'Pages par visite', load: 'Chargement (75e centile)', errors: 'Erreurs', online: 'Actifs ces 30 min',
    newVisitors: 'Nouveaux visiteurs', returning: 'Visiteurs récurrents',
    traffic: 'Trafic', trafficSub: 'Visiteurs et pages vues par jour', growth: 'Connexions et nouveaux comptes', growthSub: 'Par jour',
    hours: 'Heures de pointe', hoursSub: 'Pages vues par heure (votre fuseau horaire)',
    pages: 'Pages les plus vues', referrers: 'D’où viennent les visiteurs', countries: 'Pays', devices: 'Appareils', browsers: 'Navigateurs', systems: 'Systèmes', languages: 'Langues',
    methods: 'Méthodes de connexion', platform: 'Activité de la plateforme', health: 'Performance et erreurs',
    users: 'Membres au total', registered: 'Utilisateurs inscrits', registeredSub: 'Tous les comptes, depuis le début', today: 'Aujourd’hui', yesterday: 'Hier', todaySub: 'Aujourd’hui depuis minuit (votre fuseau horaire) et hier en journée complète', auto: 'Se met à jour chaque minute', posts: 'Publications (période)', likes: 'J’aime', comments: 'Commentaires', follows: 'Abonnements', battles: 'Battles créés', battlesLive: 'Battles en direct',
    battlesEnded: 'Battles terminés (total)', votes: 'Votes', lives: 'Directs (Go Live)', liveNow: 'Directs en cours', groups: 'Groupes (total)', messages: 'Messages', reports: 'Signalements (total)',
    table: 'Tableau', chart: 'Graphique', day: 'Jour', direct: 'direct', none: 'Aucune donnée', error: 'Erreur', times: 'Fois', last: 'Dernière fois',
    loadNote: 'Temps avant la fin du chargement de la page. Sous 2,5 s, c’est bon.',
  },
} as const;
type Words = (typeof TEXT)['en'] | (typeof TEXT)['fr'];

const nf = (n: number | null | undefined) => (n == null ? '–' : new Intl.NumberFormat().format(n));

function Delta({ now, before, w }: { now: number; before: number; w: Words }) {
  if (!before && !now) return <span className="text-xs text-zinc-500">–</span>;
  if (!before) return <span className="text-xs text-zinc-500">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const Icon = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-zinc-600" title={`${w.vsPrev}: ${nf(before)}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

function Tile({ label, value, extra, note }: { label: string; value: string; extra?: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3" title={note}>
      <div className="text-xs text-zinc-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</div>
      <div className="mt-0.5 min-h-4">{extra}</div>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

interface Series { name: string; color: string; values: number[] }

/** Line chart with a hover crosshair and tooltip. Two series at most, same scale. */
function LineChart({ labels, series, area = true }: { labels: string[]; series: Series[]; area?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, L = 34, R = 10, T = 10, B = 24;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const every = Math.max(1, Math.ceil(n / 6));
  const short = (d: string) => d.slice(5);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - L - R);
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / (W - L - R)) * (n - 1)))));
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.name).join(', ')}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={L} x2={W - R} y1={y(tk)} y2={y(tk)} stroke="#e4e4e7" strokeWidth="1" />
            <text x={L - 6} y={y(tk) + 3} textAnchor="end" fontSize="10" fill="#52514e">{nf(tk)}</text>
          </g>
        ))}
        {labels.map((d, i) => (i % every === 0 ? <text key={d} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#52514e">{short(d)}</text> : null))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.name}>
              {area && si === 0 && n > 1 && <polygon points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} fill={s.color} opacity="0.1" />}
              {n > 1 ? <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#a1a1aa" strokeWidth="1" />
            {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="#fcfcfb" strokeWidth="2" />)}
          </g>
        )}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})` }}
        >
          <div className="mb-0.5 font-medium text-zinc-900">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 text-zinc-700">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.name}: <b className="tabular-nums text-zinc-900">{nf(s.values[hover])}</b>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-700">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden="true" />{s.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function HourBars({ data }: { data: { hour: number; views: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.views));
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5" role="img" aria-label="Page views by hour">
        {data.map((d) => (
          <div key={d.hour} className="flex h-full flex-1 items-end" title={`${String(d.hour).padStart(2, '0')}:00 · ${nf(d.views)}`}>
            <div className="w-full rounded-t-sm" style={{ height: `${Math.max(2, (d.views / max) * 100)}%`, background: BLUE, opacity: d.views ? 1 : 0.25 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>
    </div>
  );
}

/** Ranked list with a thin bar under each label. */
function Ranking({ rows, empty }: { rows: { label: string; value: number; extra?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${nf(r.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-zinc-800">{r.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-900">{nf(r.value)}{r.extra ? <span className="ml-1 text-xs text-zinc-500">{r.extra}</span> : null}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: BLUE }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {sub && <p className="text-xs text-zinc-600">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Moves old public videos (and optionally photos) from Supabase Storage to Cloudflare R2, one post at a time. */
function MoveToR2({ fr }: { fr: boolean }) {
  const [running, setRunning] = useState(false);
  const [moved, setMoved] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const stop = useRef(false);

  const run = async (kind: 'video' | 'all') => {
    stop.current = false;
    setRunning(true);
    setNote('');
    const skip: string[] = [];
    try {
      for (;;) {
        if (stop.current) break;
        const r = await api<{ remaining: number; moved?: string | null; failedId?: string; error?: string }>('r2', { action: 'migrate', kind, skip });
        setLeft(r.remaining);
        if (r.failedId) {
          skip.push(r.failedId);
          setFailed((f) => [...f, `${r.failedId?.slice(0, 8)}: ${r.error ?? ''}`]);
        } else if (r.moved) setMoved((m) => m + 1);
        if (!r.moved && !r.failedId) break;
        if (r.remaining <= 0) break;
      }
      setNote(fr ? 'Terminé.' : 'Finished.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Error');
    }
    setRunning(false);
  };

  return (
    <Panel
      title={fr ? 'Déplacer les anciens fichiers vers R2' : 'Move old files to R2'}
      sub={fr ? 'Les anciennes vidéos et photos publiques quittent Supabase (moins de bande passante). Gardez cette page ouverte.' : 'Old public videos and photos leave Supabase (less bandwidth). Keep this page open while it runs.'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={running} onClick={() => void run('video')}>{fr ? 'Déplacer les vidéos' : 'Move old videos'}</button>
        <button type="button" className="btn btn-ghost" disabled={running} onClick={() => void run('all')}>{fr ? 'Vidéos et photos' : 'Videos and photos'}</button>
        {running && <button type="button" className="btn btn-ghost" onClick={() => { stop.current = true; }}>{fr ? 'Arrêter' : 'Stop'}</button>}
        {running && <Spinner />}
      </div>
      <p className="text-sm text-zinc-700" role="status">
        {fr ? 'Déplacés' : 'Moved'}: {moved}{left !== null ? ` · ${fr ? 'restants' : 'left'}: ${left}` : ''} {note}
      </p>
      {failed.length > 0 && <ul className="list-disc pl-5 text-xs text-red-700">{failed.map((f) => <li key={f}>{f}</li>)}</ul>}
    </Panel>
  );
}

export function AdminView() {
  const { user, loading, openAuth } = useAuth();
  const { lang } = useI18n();
  const { go } = useRouter();
  const w: Words = TEXT[lang === 'fr' ? 'fr' : 'en'];
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [table, setTable] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data: res, error } = await supabase.rpc('admin_stats', { p_days: days, p_tz: tz });
    if (error) setState(/not_admin/.test(error.message) ? 'denied' : 'failed');
    else {
      setData(res as Stats);
      setState('ready');
    }
    setBusy(false);
  }, [days]);

  useEffect(() => {
    if (!user) return;
    void load();
    // Real numbers refresh by themselves every minute while the tab is open and visible.
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [user, load]);

  const labels = useMemo(() => data?.daily.map((d) => d.day) ?? [], [data]);

  if (loading) return <Loading />;
  if (!user) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-zinc-500" aria-hidden="true" />
        <p className="text-sm text-zinc-700">{w.noAccess}</p>
        <button type="button" className="btn btn-primary" onClick={() => openAuth()}>{lang === 'fr' ? 'Se connecter' : 'Sign in'}</button>
      </div>
    );
  }
  if (state === 'denied') {
    return (
      <div className="card mx-auto max-w-md space-y-2 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-zinc-500" aria-hidden="true" />
        <p className="font-medium text-zinc-900">{w.noAccess}</p>
        <p className="text-sm text-zinc-600">{w.noAccessHelp}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('search')}>OK</button>
      </div>
    );
  }
  if (state === 'loading' || !data) return state === 'failed' ? <p role="alert" className="text-sm text-red-600">{w.failed}</p> : <Loading />;

  const c = data.current, p = data.previous;
  const tile = (label: string, key: keyof Totals, fmt: (v: number) => string = nf, note?: string) => (
    <Tile label={label} value={c[key] == null ? '–' : fmt(c[key] as number)} note={note}
      extra={<Delta now={(c[key] as number) ?? 0} before={(p[key] as number) ?? 0} w={w} />} />
  );
  const returning = Math.max(0, (c.visitors ?? 0) - data.new_visitors);
  const pf = data.platform;
  const hasTraffic = (c.views ?? 0) > 0 || (p.views ?? 0) > 0;
  const name = (n: string) => (n === 'direct' ? w.direct : n);
  const rows = (list: Named[], key: 'visitors' | 'sessions' | 'n') => list.map((r) => ({ label: name(r.name), value: r[key] ?? 0 }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={w.title}
        sub={w.sub}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={busy}>
            {busy ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}{w.refresh}
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((n) => <Chip key={n} active={days === n} onClick={() => setDays(n)}>{w.days(n)}</Chip>)}
        <span className="ml-auto text-xs text-zinc-500">
          {w.auto} · {w.updated} {new Date(data.generated_at).toLocaleTimeString()}
          {data.tracking_since ? ` · ${w.since} ${new Date(data.tracking_since).toLocaleDateString()}` : ''}
        </span>
      </div>

      {!hasTraffic && <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-700">{w.empty}</p>}

      <Panel title={w.today} sub={w.todaySub}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 rounded-xl border border-zinc-900 bg-white p-3 sm:col-span-3 lg:col-span-1" title={w.registeredSub}>
            <div className="text-xs text-zinc-600">{w.registered}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">{nf(pf.users)}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{w.registeredSub}</div>
          </div>
          {([['visitors', w.visitors], ['views', w.views], ['signins', w.signins], ['new_users', w.newUsers]] as const).map(([key, label]) => {
            const last = data.daily[data.daily.length - 1];
            const before = data.daily[data.daily.length - 2];
            return <Tile key={key} label={`${w.today} · ${label}`} value={nf(last?.[key] ?? 0)} extra={<Delta now={last?.[key] ?? 0} before={before?.[key] ?? 0} w={w} />} />;
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['visitors', w.visitors], ['views', w.views], ['signins', w.signins], ['new_users', w.newUsers]] as const).map(([key, label]) => {
            const before = data.daily[data.daily.length - 2];
            return (
              <div key={key} className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">{w.yesterday} · {label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-700">{nf(before?.[key] ?? 0)}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tile(w.visitors, 'visitors')}
        {tile(w.views, 'views')}
        {tile(w.sessions, 'sessions')}
        {tile(w.signins, 'signins')}
        <Tile label={w.newUsers} value={nf(pf.new_users)} />
        {tile(w.active, 'active_users')}
        {tile(w.bounce, 'bounce_rate', (v) => `${v}%`)}
        {tile(w.pps, 'pages_per_session', (v) => v.toFixed(1))}
        <Tile label={w.newVisitors} value={nf(data.new_visitors)} />
        <Tile label={w.returning} value={nf(returning)} />
        <Tile label={w.online} value={nf(data.online_now)} />
      </div>

      <Panel
        title={w.traffic}
        sub={w.trafficSub}
        action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setTable((v) => !v)}><Table2 className="h-4 w-4" aria-hidden="true" />{table ? w.chart : w.table}</button>}
      >
        {table ? (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-zinc-600">
                <tr><th className="py-1 pr-3">{w.day}</th><th className="pr-3">{w.visitors}</th><th className="pr-3">{w.views}</th><th className="pr-3">{w.signins}</th><th>{w.newUsers}</th></tr>
              </thead>
              <tbody className="tabular-nums">
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-zinc-100"><td className="py-1 pr-3">{d.day}</td><td>{nf(d.visitors)}</td><td>{nf(d.views)}</td><td>{nf(d.signins)}</td><td>{nf(d.new_users)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LineChart labels={labels} series={[
            { name: w.views, color: BLUE, values: data.daily.map((d) => d.views) },
            { name: w.visitors, color: ORANGE, values: data.daily.map((d) => d.visitors) },
          ]} />
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={w.growth} sub={w.growthSub}>
          <LineChart labels={labels} area={false} series={[
            { name: w.signins, color: BLUE, values: data.daily.map((d) => d.signins) },
            { name: w.newUsers, color: ORANGE, values: data.daily.map((d) => d.new_users) },
          ]} />
        </Panel>
        <Panel title={w.hours} sub={w.hoursSub}><HourBars data={data.hours} /></Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Panel title={w.pages}>
          <Ranking empty={w.none} rows={data.pages.map((r) => ({ label: r.path, value: r.views, extra: `(${nf(r.visitors)})` }))} />
        </Panel>
        <Panel title={w.referrers}><Ranking empty={w.none} rows={rows(data.referrers, 'sessions')} /></Panel>
        <Panel title={w.countries}><Ranking empty={w.none} rows={rows(data.countries, 'visitors')} /></Panel>
        <Panel title={w.devices}><Ranking empty={w.none} rows={rows(data.devices, 'visitors')} /></Panel>
        <Panel title={w.browsers}><Ranking empty={w.none} rows={rows(data.browsers, 'visitors')} /></Panel>
        <Panel title={w.systems}><Ranking empty={w.none} rows={rows(data.systems, 'visitors')} /></Panel>
        <Panel title={w.languages}><Ranking empty={w.none} rows={rows(data.languages, 'visitors')} /></Panel>
        <Panel title={w.methods}><Ranking empty={w.none} rows={rows(data.signin_methods, 'n')} /></Panel>
      </div>

      <Panel title={w.platform}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label={w.posts} value={nf(pf.new_posts)} />
          <Tile label={w.likes} value={nf(pf.likes)} />
          <Tile label={w.comments} value={nf(pf.comments)} />
          <Tile label={w.follows} value={nf(pf.follows)} />
          <Tile label={w.battles} value={nf(pf.new_battles)} />
          <Tile label={w.battlesLive} value={nf(pf.battles_live)} />
          <Tile label={w.battlesEnded} value={nf(pf.battles_ended)} />
          <Tile label={w.votes} value={nf(pf.votes)} />
          <Tile label={w.lives} value={nf(pf.live_streams)} />
          <Tile label={w.liveNow} value={nf(pf.live_now)} />
          <Tile label={w.messages} value={nf(pf.messages)} />
          <Tile label={w.groups} value={nf(pf.groups)} />
        </div>
      </Panel>

      <Panel title={w.health} sub={w.loadNote}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tile(w.load, 'load_p75', (v) => `${(v / 1000).toFixed(1)} s`)}
          <Tile label={lang === 'fr' ? 'Chargement moyen' : 'Average load'} value={c.load_avg == null ? '–' : `${(c.load_avg / 1000).toFixed(1)} s`} />
          {tile(w.errors, 'errors')}
          <Tile label={w.reports} value={nf(pf.reports)} />
        </div>
        {data.errors.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-600"><tr><th className="py-1 pr-3">{w.error}</th><th className="pr-3">{w.times}</th><th>{w.last}</th></tr></thead>
            <tbody>
              {data.errors.map((e) => (
                <tr key={e.name} className="border-t border-zinc-100 align-top">
                  <td className="break-all py-1 pr-3 font-mono text-xs">{e.name}</td>
                  <td className="pr-3 tabular-nums">{nf(e.n)}</td>
                  <td className="whitespace-nowrap text-xs text-zinc-600">{e.last_seen ? new Date(e.last_seen).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <button type="button" className="btn btn-accent" onClick={() => go('contest')}>{lang === 'fr' ? 'Gérer le concours' : 'Manage the contest'}</button>
      <button type="button" className="btn btn-accent" onClick={() => go('site')}>{lang === 'fr' ? 'Modifier la page d’accueil publique' : 'Edit the public homepage'}</button>
      <HomeSections fr={lang === 'fr'} />
      {r2Enabled && <MoveToR2 fr={lang === 'fr'} />}
    </div>
  );
}
