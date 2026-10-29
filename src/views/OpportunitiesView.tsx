import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Briefcase, Calendar, ExternalLink, Mail, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { isSafe } from '../lib/moderation';
import { OPP, OPP_KINDS, readPlace, savePlace, type OppKind, type Opportunity, type Place } from '../lib/opportunities';
import { useTranslated } from '../lib/translate';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { ReportButton } from '../components/ReportButton';
import { ShareButton } from '../components/ShareButton';
import { TranslationNote } from '../components/TranslationNote';
import { Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

const PAGE = 15;
const SELECT = `id,author_id,kind,title,org,body,country,city,online,deadline,link,contact,hidden,created_at,author:profiles!author_id(${PUBLIC_PROFILE})`;
const clean = (s: string) => s.replace(/[%_,()*\\"]/g, ' ').trim();
const today = () => new Date().toISOString().slice(0, 10);
const field = 'input';

type Scope = 'near' | 'online' | 'all';

function Card({ o, mine, admin, onEdit, onDeleted, onHide }: { o: Opportunity; mine: boolean; admin: boolean; onEdit: () => void; onDeleted: () => void; onHide: () => void }) {
  const { lang } = useI18n();
  const w = OPP[lang];
  const tx = useTranslated([o.title, o.body], !mine);
  const author = Array.isArray(o.author) ? o.author[0] : o.author;
  const days = o.deadline ? Math.ceil((Date.parse(o.deadline) - Date.parse(today())) / 86400000) : null;
  const place = o.online ? w.online : [o.city, o.country].filter(Boolean).join(', ');
  const closed = days !== null && days < 0;
  return (
    <article className="card space-y-2 text-zinc-900">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 font-semibold text-white">{w.kinds[o.kind]}</span>
        <span className="inline-flex items-center gap-1 text-zinc-600"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{place}</span>
        {o.deadline && (
          <span className={`inline-flex items-center gap-1 ${days !== null && days >= 0 && days <= 7 ? 'font-semibold text-accent' : 'text-zinc-600'}`}>
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />{w.deadline}: {o.deadline}{closed ? ` · ${w.closed}` : days !== null && days <= 7 ? ` · ${w.soon}` : ''}
          </span>
        )}
        {o.hidden && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">{w.hide}</span>}
      </div>
      <h3 className="text-base font-semibold">{tx.out[0]}</h3>
      {o.org && <p className="text-sm text-zinc-600">{o.org}</p>}
      {o.body && <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{tx.out[1]}</p>}
      <TranslationNote tx={tx} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {o.link && <a className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" href={o.link} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{w.apply}</a>}
        {o.contact && <span className="inline-flex items-center gap-1 text-xs text-zinc-700"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{w.contact}: {o.contact}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
        {author && <span className="text-xs text-zinc-500">{w.by} {author.display_name}</span>}
        <span className="flex-1" />
        <ShareButton type="opportunity" id={o.id} title={o.title} />
        {mine ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{w.edit}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={async () => {
              if (!window.confirm(w.delAsk)) return;
              const { error } = await supabase.from('opportunities').delete().eq('id', o.id);
              if (!error) onDeleted();
            }}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{w.del}</button>
          </>
        ) : <ReportButton targetType="opportunity" targetId={o.id} />}
        {admin && <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={onHide}>{o.hidden ? w.unhide : w.hide}</button>}
      </div>
    </article>
  );
}

interface Draft { kind: OppKind; title: string; org: string; body: string; country: string; city: string; online: boolean; deadline: string; link: string; contact: string }
const blank = (p: Place): Draft => ({ kind: 'scholarship', title: '', org: '', body: '', country: p.country, city: p.city, online: false, deadline: '', link: '', contact: '' });

function Form({ editing, place, onDone, onCancel }: { editing: Opportunity | null; place: Place; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = OPP[lang];
  const [d, setD] = useState<Draft>(() => editing
    ? { kind: editing.kind, title: editing.title, org: editing.org, body: editing.body, country: editing.country, city: editing.city, online: editing.online, deadline: editing.deadline ?? '', link: editing.link ?? '', contact: editing.contact ?? '' }
    : blank(place));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErr(null);
    if (!d.online && !d.country.trim()) return setErr(w.errPlace);
    if (!isSafe(d.title) || !isSafe(d.body) || !isSafe(d.org)) return setErr(w.errSafe);
    if (d.link.trim() && !/^https?:\/\//i.test(d.link.trim())) return setErr(w.errLink);
    const row = {
      kind: d.kind, title: d.title.trim(), org: d.org.trim(), body: d.body.trim(), country: d.country.trim(), city: d.city.trim(),
      online: d.online, deadline: d.deadline || null, link: d.link.trim() || null, contact: d.contact.trim() || null,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from('opportunities').update(row).eq('id', editing.id)
      : await supabase.from('opportunities').insert({ ...row, author_id: user.id });
    setBusy(false);
    if (error) return setErr(error.message.includes('rate_limited') ? w.errRate : w.errGeneric);
    toast(editing ? w.saved : w.posted);
    onDone();
  };

  return (
    <form onSubmit={submit} className="card space-y-3 text-zinc-900">
      <h2 className="text-base font-semibold">{w.formTitle}</h2>
      <div>
        <span className="label">{w.fKind}</span>
        <div className="flex flex-wrap gap-2">{OPP_KINDS.map((k) => <Chip key={k} active={d.kind === k} onClick={() => set('kind', k)}>{w.kinds[k]}</Chip>)}</div>
      </div>
      <div><label className="label" htmlFor="op-title">{w.fTitle}</label><input id="op-title" className={field} value={d.title} maxLength={120} minLength={3} required onChange={(e) => set('title', e.target.value)} /></div>
      <div><label className="label" htmlFor="op-org">{w.fOrg}</label><input id="op-org" className={field} value={d.org} maxLength={100} onChange={(e) => set('org', e.target.value)} /></div>
      <div><label className="label" htmlFor="op-body">{w.fBody}</label><textarea id="op-body" className={field} rows={5} value={d.body} maxLength={3000} onChange={(e) => set('body', e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.online} onChange={(e) => set('online', e.target.checked)} />{w.fOnline}</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="op-country">{w.fCountry}</label><input id="op-country" className={field} value={d.country} maxLength={60} onChange={(e) => set('country', e.target.value)} /></div>
        <div><label className="label" htmlFor="op-city">{w.fCity}</label><input id="op-city" className={field} value={d.city} maxLength={80} onChange={(e) => set('city', e.target.value)} /></div>
        <div><label className="label" htmlFor="op-deadline">{w.fDeadline}</label><input id="op-deadline" type="date" className={field} value={d.deadline} onChange={(e) => set('deadline', e.target.value)} /></div>
        <div><label className="label" htmlFor="op-contact">{w.fContact}</label><input id="op-contact" className={field} value={d.contact} maxLength={120} onChange={(e) => set('contact', e.target.value)} /></div>
      </div>
      <div><label className="label" htmlFor="op-link">{w.fLink}</label><input id="op-link" type="url" inputMode="url" className={field} value={d.link} maxLength={300} placeholder="https://" onChange={(e) => set('link', e.target.value)} /></div>
      <p className="text-xs text-zinc-500">{w.warn}</p>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button className="btn bg-zinc-900 text-white hover:bg-zinc-700" disabled={busy}>{editing ? w.save : w.publish}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{w.cancel}</button>
      </div>
    </form>
  );
}

/** Scholarships, jobs, training and events that members share, with the ones near them shown first. */
export function OpportunitiesView({ focus }: { focus?: string }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const w = OPP[lang];
  const [kind, setKind] = useState<'all' | OppKind>('all');
  const [scope, setScope] = useState<Scope>('near');
  const [term, setTerm] = useState('');
  const [input, setInput] = useState('');
  const [place, setPlace] = useState<Place>(readPlace);
  const [placeDraft, setPlaceDraft] = useState<Place>(readPlace);
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [first, setFirst] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<{ open: boolean; editing: Opportunity | null }>({ open: false, editing: null });
  const [admin, setAdmin] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Opportunity[]>([]);
  const request = useRef(0);

  useEffect(() => { const id = window.setTimeout(() => setTerm(clean(input)), 350); return () => window.clearTimeout(id); }, [input]);
  useEffect(() => {
    if (!user) return;
    void supabase.rpc('is_admin').then(({ data }) => setAdmin(data === true));
  }, [user]);

  const fetchPage = useCallback(async (offset: number): Promise<Opportunity[]> => {
    let q = supabase.from('opportunities').select(SELECT).eq('hidden', false)
      .or(`deadline.is.null,deadline.gte.${today()}`)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (kind !== 'all') q = q.eq('kind', kind);
    if (scope === 'online') q = q.eq('online', true);
    if (scope === 'near' && place.country.trim()) q = q.or(`country.ilike.${clean(place.country)},online.eq.true`);
    if (term) q = q.ilike('title', `%${term}%`);
    const { data } = await q;
    const list = (data ?? []) as unknown as Opportunity[];
    if (scope !== 'near' || !place.country.trim()) return list;
    const rank = (o: Opportunity) => (!o.online && place.city && o.city.toLowerCase() === place.city.trim().toLowerCase() ? 0 : !o.online ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [kind, scope, term, place]);

  const load = useCallback(() => {
    const mine = ++request.current;
    setLoading(true);
    void fetchPage(0).then((r) => {
      if (mine !== request.current) return;
      setRows(r); setMore(r.length === PAGE); setLoading(false);
    });
  }, [fetchPage]);
  useEffect(() => { load(); }, [load]);

  // A shared link opens that opportunity first
  useEffect(() => {
    if (!focus) { setFirst(null); return; }
    void supabase.from('opportunities').select(SELECT).eq('id', focus).maybeSingle().then(({ data }) => setFirst((data as unknown as Opportunity) ?? null));
  }, [focus]);

  const loadHidden = useCallback(() => {
    if (!admin) return;
    void supabase.rpc('admin_opportunities_hidden').then(({ data }) => setHiddenRows(Array.isArray(data) ? (data as Opportunity[]) : []));
  }, [admin]);
  useEffect(() => { loadHidden(); }, [loadHidden]);

  const showMore = async () => {
    setBusy(true);
    const r = await fetchPage(rows.length);
    setRows((l) => [...l, ...r.filter((x) => !l.some((y) => y.id === x.id))]);
    setMore(r.length === PAGE);
    setBusy(false);
  };

  const hide = async (o: Opportunity) => {
    await supabase.rpc('admin_hide_opportunity', { p_id: o.id, p_hide: !o.hidden });
    load(); loadHidden();
    setFirst((f) => (f && f.id === o.id ? { ...f, hidden: !o.hidden } : f));
  };

  const card = (o: Opportunity) => (
    <Card key={o.id} o={o} mine={o.author_id === user?.id} admin={admin}
      onEdit={() => { setForm({ open: true, editing: o }); window.scrollTo(0, 0); }}
      onDeleted={() => { load(); setFirst(null); }} onHide={() => void hide(o)} />
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={w.title} sub={w.sub}
        action={<button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={() => setForm({ open: true, editing: null })}><Plus className="h-4 w-4" aria-hidden="true" />{w.share}</button>} />

      {form.open && <Form editing={form.editing} place={place} onCancel={() => setForm({ open: false, editing: null })}
        onDone={() => { setForm({ open: false, editing: null }); load(); }} />}

      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{w.warn}</p>

      <section className="card space-y-2 text-zinc-900" aria-label={w.yourPlace}>
        <p className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-4 w-4" aria-hidden="true" />{w.yourPlace}</p>
        {!place.country && <p className="text-xs text-zinc-500">{w.placeHint}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); savePlace(placeDraft); setPlace(placeDraft); }}>
          <input className="input w-40" placeholder={w.country} aria-label={w.country} value={placeDraft.country} maxLength={60} onChange={(e) => setPlaceDraft({ ...placeDraft, country: e.target.value })} />
          <input className="input w-40" placeholder={w.city} aria-label={w.city} value={placeDraft.city} maxLength={80} onChange={(e) => setPlaceDraft({ ...placeDraft, city: e.target.value })} />
          <button className="btn btn-ghost">{w.savePlace}</button>
        </form>
      </section>

      <div className="space-y-2">
        <input className="input" placeholder={w.search} aria-label={w.search} value={input} onChange={(e) => setInput(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {(['all', ...OPP_KINDS] as const).map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{w.kinds[k]}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={scope === 'near'} onClick={() => setScope('near')}>{w.near}</Chip>
          <Chip active={scope === 'online'} onClick={() => setScope('online')}>{w.onlineOnly}</Chip>
          <Chip active={scope === 'all'} onClick={() => setScope('all')}>{w.everywhere}</Chip>
        </div>
      </div>

      {first && !rows.some((r) => r.id === first.id) && card(first)}
      {loading ? <Loading /> : rows.length === 0 && !first ? <Empty text={w.empty}><Briefcase className="mx-auto mt-3 h-6 w-6 text-zinc-400" aria-hidden="true" /></Empty> : (
        <div className="space-y-4">{rows.map(card)}</div>
      )}
      <LoadMore show={!loading && more} busy={busy} onClick={() => void showMore()} label={w.more} />

      {admin && hiddenRows.length > 0 && (
        <section className="space-y-3" aria-label={w.hiddenTitle}>
          <h2 className="text-base font-semibold">{w.hiddenTitle}</h2>
          {hiddenRows.map(card)}
        </section>
      )}
    </div>
  );
}
