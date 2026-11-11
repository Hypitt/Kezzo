import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, MapPin, MessageCircle, Pencil, Plus, Store, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { fileExt } from '../lib/format';
import { isSafe } from '../lib/moderation';
import { compressImage } from '../lib/media';
import { startUpload } from '../lib/upload';
import { publicFilePath, publicUrl, removePublic } from '../lib/storage';
import { MARKET, MARKET_CATS, MARKET_KINDS, formatPrice, type Listing, type MarketCat, type MarketKind, type MarketStatus } from '../lib/market';
import { readPlace } from '../lib/opportunities';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ReportButton } from '../components/ReportButton';
import { Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

const PAGE = 18;
const SELECT = `id,seller_id,kind,category,title,body,price,currency,condition,country,city,online,contact,photos,status,hidden,created_at,seller:profiles!seller_id(${PUBLIC_PROFILE})`;
const clean = (s: string) => s.replace(/[%_,()*\\"]/g, ' ').trim();
const sellerOf = (l: Listing) => (Array.isArray(l.seller) ? l.seller[0] : l.seller) ?? null;

function Card({ l, mine, admin, onEdit, onChanged }: { l: Listing; mine: boolean; admin: boolean; onEdit: () => void; onChanged: () => void }) {
  const { lang } = useI18n();
  const { user, openAuth } = useAuth();
  const { go } = useRouter();
  const { toast } = useToast();
  const w = MARKET[lang];
  const [open, setOpen] = useState(false);
  const seller = sellerOf(l);
  const place = l.online && !l.country ? w.online : [l.city, l.country].filter(Boolean).join(', ');
  const price = formatPrice(l.price, l.currency, lang, w.free, w.ask);
  const photo = l.photos[0] ? publicUrl('media-public', l.photos[0]) : null;
  const gone = l.status !== 'active';

  const setStatus = async (status: MarketStatus) => {
    const { error } = await supabase.from('market_listings').update({ status, updated_at: new Date().toISOString() }).eq('id', l.id);
    if (error) toast(w.errGeneric, 'error'); else onChanged();
  };
  const remove = async () => {
    if (!window.confirm(w.delAsk)) return;
    const { error } = await supabase.from('market_listings').delete().eq('id', l.id);
    if (error) { toast(w.errGeneric, 'error'); return; }
    await removePublic('media-public', l.photos);
    onChanged();
  };
  const hide = async () => { await supabase.rpc('admin_hide_listing', { p_id: l.id, p_hide: !l.hidden }); onChanged(); };

  return (
    <article className="card overflow-hidden !p-0 text-zinc-900">
      <div className="relative aspect-[4/3] bg-zinc-100">
        {photo
          ? <img src={photo} alt={l.title} loading="lazy" decoding="async" className={`h-full w-full object-cover ${gone ? 'opacity-50' : ''}`} />
          : <div className="flex h-full items-center justify-center text-zinc-400"><Store className="h-10 w-10" aria-hidden="true" /></div>}
        <span className="absolute left-2 top-2 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">{w.kinds[l.kind]}</span>
        {gone && <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold">{l.status === 'sold' ? w.sold : w.paused}</span>}
        {l.hidden && <span className="absolute bottom-2 left-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{w.hide}</span>}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="text-base font-bold">{price}</p>
        <h3 className="text-sm font-semibold">{l.title}</h3>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-600">
          <span>{w.cats[l.category]}</span>
          {l.condition && <span>{w.conds[l.condition]}</span>}
          {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{place}</span>}
        </p>
        {open && (
          <div className="space-y-2 pt-1">
            {l.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {l.photos.slice(1).map((p) => <img key={p} src={publicUrl('media-public', p)} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />)}
              </div>
            )}
            {l.body && <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{l.body}</p>}
            {l.online && l.country && <p className="text-xs text-zinc-600">{w.online}</p>}
            {l.contact && <p className="text-xs text-zinc-700">{w.contact}: {l.contact}</p>}
          </div>
        )}
        <button type="button" className="text-xs font-semibold text-accent hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? w.showLess : w.readMore}</button>
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
          {seller && <span className="text-xs text-zinc-500">{w.byLabel} {seller.display_name}</span>}
          <span className="flex-1" />
          {mine ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setStatus(l.status === 'sold' ? 'active' : 'sold')}>{l.status === 'sold' ? w.markActive : w.markSold}</button>
              {l.status !== 'sold' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setStatus(l.status === 'paused' ? 'active' : 'paused')}>{l.status === 'paused' ? w.markActive : w.pause}</button>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{w.edit}</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove()}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{w.del}</button>
            </>
          ) : (
            <>
              <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" onClick={() => (user ? go('messages', l.seller_id) : openAuth('signup'))}>
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{user ? w.message : w.signIn}
              </button>
              <ReportButton targetType="listing" targetId={l.id} />
            </>
          )}
          {admin && <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void hide()}>{l.hidden ? w.unhide : w.hide}</button>}
        </div>
      </div>
    </article>
  );
}

interface Draft { kind: MarketKind; category: MarketCat; title: string; body: string; price: string; currency: string; condition: '' | 'new' | 'used'; country: string; city: string; online: boolean; contact: string }

function Form({ editing, onDone, onCancel }: { editing: Listing | null; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = MARKET[lang];
  const place = readPlace();
  const [d, setD] = useState<Draft>(() => editing
    ? { kind: editing.kind, category: editing.category, title: editing.title, body: editing.body, price: editing.price === null ? '' : String(editing.price), currency: editing.currency, condition: editing.condition ?? '', country: editing.country, city: editing.city, online: editing.online, contact: editing.contact ?? '' }
    : { kind: 'product', category: 'other', title: '', body: '', price: '', currency: '', condition: '', country: place.country, city: place.city, online: false, contact: '' });
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? []);
  const added = useRef<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const addPhotos = async (files: FileList | null) => {
    if (!user || !files) return;
    setUploading(true);
    setErr(null);
    for (const f of Array.from(files).slice(0, 5 - photos.length)) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const small = await compressImage(f, 1400, 0.8);
        const path = publicFilePath(user.id, `market-${crypto.randomUUID()}.${fileExt(small.name) || 'jpg'}`);
        await startUpload({ bucket: 'media-public', path, file: small }).done;
        added.current.push(path);
        setPhotos((p) => [...p, path]);
      } catch { setErr(w.errPhoto); }
    }
    setUploading(false);
  };

  const cancel = () => { void removePublic('media-public', added.current); onCancel(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || uploading) return;
    setErr(null);
    if (!d.online && !d.country.trim()) return setErr(w.errPlace);
    if (!isSafe(d.title) || !isSafe(d.body)) return setErr(w.errSafe);
    const priceText = d.price.trim().replace(',', '.');
    const price = priceText === '' ? null : Number(priceText);
    if (price !== null && (!Number.isFinite(price) || price < 0)) return setErr(w.errGeneric);
    const row = {
      kind: d.kind, category: d.category, title: d.title.trim(), body: d.body.trim(), price, currency: d.currency.trim(),
      condition: d.kind === 'product' && d.condition ? d.condition : null, country: d.country.trim(), city: d.city.trim(),
      online: d.online, contact: d.contact.trim() || null, photos,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from('market_listings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('market_listings').insert({ ...row, seller_id: user.id });
    setBusy(false);
    if (error) return setErr(error.message.includes('rate_limited') ? w.errRate : w.errGeneric);
    if (editing) await removePublic('media-public', editing.photos.filter((p) => !photos.includes(p)));
    toast(editing ? w.saved : w.posted);
    onDone();
  };

  return (
    <form onSubmit={submit} className="card space-y-3 text-zinc-900">
      <h2 className="text-base font-semibold">{editing ? w.formEdit : w.formNew}</h2>
      <div>
        <span className="label">{w.fKind}</span>
        <div className="flex flex-wrap gap-2">{MARKET_KINDS.map((k) => <Chip key={k} active={d.kind === k} onClick={() => set('kind', k)}>{w.kinds[k]}</Chip>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="mk-title">{w.fTitle}</label><input id="mk-title" className="input" value={d.title} maxLength={120} minLength={3} required onChange={(e) => set('title', e.target.value)} /></div>
        <div>
          <label className="label" htmlFor="mk-cat">{w.fCat}</label>
          <select id="mk-cat" className="input" value={d.category} onChange={(e) => set('category', e.target.value as MarketCat)}>
            {MARKET_CATS.map((c) => <option key={c} value={c}>{w.cats[c]}</option>)}
          </select>
        </div>
        {d.kind === 'product' && (
          <div>
            <label className="label" htmlFor="mk-cond">{w.fCond}</label>
            <select id="mk-cond" className="input" value={d.condition} onChange={(e) => set('condition', e.target.value as Draft['condition'])}>
              <option value="">–</option><option value="new">{w.conds.new}</option><option value="used">{w.conds.used}</option>
            </select>
          </div>
        )}
        <div><label className="label" htmlFor="mk-price">{w.fPrice}</label><input id="mk-price" className="input" inputMode="decimal" value={d.price} maxLength={14} onChange={(e) => set('price', e.target.value)} /></div>
        <div><label className="label" htmlFor="mk-cur">{w.fCurrency}</label><input id="mk-cur" className="input" value={d.currency} maxLength={12} placeholder="USD, CAD, FCFA, €" onChange={(e) => set('currency', e.target.value)} /></div>
      </div>
      <p className="-mt-1 text-xs text-zinc-500">{w.fPriceHelp}</p>
      <div><label className="label" htmlFor="mk-body">{w.fBody}</label><textarea id="mk-body" className="input" rows={5} value={d.body} maxLength={3000} onChange={(e) => set('body', e.target.value)} /></div>

      <div>
        <span className="label">{w.fPhotos}</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p} className="relative h-20 w-20">
              <img src={publicUrl('media-public', p)} alt="" className="h-full w-full rounded-lg object-cover" />
              <button type="button" aria-label={w.removePhoto} className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900 p-1 text-white" onClick={() => setPhotos((l) => l.filter((x) => x !== p))}><X className="h-3 w-3" aria-hidden="true" /></button>
            </div>
          ))}
          {photos.length < 5 && (
            <label className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-400 text-[11px] text-zinc-600 ${uploading ? 'opacity-50' : ''}`}>
              <ImagePlus className="h-5 w-5" aria-hidden="true" />{uploading ? w.uploading : w.addPhoto}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">{w.fPhotosHelp}</p>
      </div>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.online} onChange={(e) => set('online', e.target.checked)} />{w.fOnline}</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="mk-country">{w.fCountry}</label><input id="mk-country" className="input" value={d.country} maxLength={60} onChange={(e) => set('country', e.target.value)} /></div>
        <div><label className="label" htmlFor="mk-city">{w.fCity}</label><input id="mk-city" className="input" value={d.city} maxLength={80} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="mk-contact">{w.fContact}</label><input id="mk-contact" className="input" value={d.contact} maxLength={120} onChange={(e) => set('contact', e.target.value)} /></div>
      </div>
      <p className="text-xs text-zinc-500">{w.safety}</p>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button className="btn bg-zinc-900 text-white hover:bg-zinc-700" disabled={busy || uploading}>{editing ? w.save : w.publish}</button>
        <button type="button" className="btn btn-ghost" onClick={cancel}>{w.cancel}</button>
      </div>
    </form>
  );
}

/** Members sell products and services. No payments yet: buyers message sellers and arrange the deal themselves. */
export function MarketView() {
  const { user, openAuth } = useAuth();
  const { lang } = useI18n();
  const w = MARKET[lang];
  const [kind, setKind] = useState<'all' | MarketKind | 'mine'>('all');
  const [cat, setCat] = useState<'all' | MarketCat>('all');
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<{ open: boolean; editing: Listing | null }>({ open: false, editing: null });
  const [admin, setAdmin] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Listing[]>([]);
  const request = useRef(0);

  useEffect(() => { const id = window.setTimeout(() => setTerm(clean(input)), 350); return () => window.clearTimeout(id); }, [input]);
  useEffect(() => {
    if (!user) { setAdmin(false); return; }
    void supabase.rpc('is_admin').then(({ data }) => setAdmin(data === true));
  }, [user]);

  const fetchPage = useCallback(async (offset: number): Promise<Listing[]> => {
    let q = supabase.from('market_listings').select(SELECT).eq('hidden', false)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (kind === 'mine') q = user ? q.eq('seller_id', user.id) : q.eq('seller_id', '00000000-0000-0000-0000-000000000000');
    else { if (kind !== 'all') q = q.eq('kind', kind); q = q.neq('status', 'paused'); }
    if (cat !== 'all') q = q.eq('category', cat);
    if (term) q = q.or(`title.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`);
    const { data } = await q;
    return (data ?? []) as unknown as Listing[];
  }, [kind, cat, term, user]);

  const load = useCallback(() => {
    const mine = ++request.current;
    setLoading(true);
    void fetchPage(0).then((r) => { if (mine !== request.current) return; setRows(r); setMore(r.length === PAGE); setLoading(false); });
  }, [fetchPage]);
  useEffect(() => { load(); }, [load]);

  const loadHidden = useCallback(() => {
    if (!admin) return;
    void supabase.rpc('admin_listings_hidden').then(({ data }) => setHiddenRows(Array.isArray(data) ? (data as Listing[]) : []));
  }, [admin]);
  useEffect(() => { loadHidden(); }, [loadHidden]);

  const showMore = async () => {
    setBusy(true);
    const r = await fetchPage(rows.length);
    setRows((l) => [...l, ...r.filter((x) => !l.some((y) => y.id === x.id))]);
    setMore(r.length === PAGE);
    setBusy(false);
  };

  const card = (l: Listing) => (
    <Card key={l.id} l={l} mine={l.seller_id === user?.id} admin={admin}
      onEdit={() => { setForm({ open: true, editing: l }); window.scrollTo(0, 0); }}
      onChanged={() => { load(); loadHidden(); }} />
  );
  const tabs: Array<['all' | MarketKind | 'mine', string]> = [['all', w.all], ['product', w.products], ['service', w.services]];
  if (user) tabs.push(['mine', w.mine]);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader title={w.title} sub={w.sub}
        action={<button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={() => (user ? setForm({ open: true, editing: null }) : openAuth('signup'))}><Plus className="h-4 w-4" aria-hidden="true" />{w.sell}</button>} />

      {form.open && <Form editing={form.editing} onCancel={() => setForm({ open: false, editing: null })} onDone={() => { setForm({ open: false, editing: null }); load(); }} />}

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600">{w.safety}</p>

      <div className="space-y-2">
        <input className="input" placeholder={w.search} aria-label={w.search} value={input} onChange={(e) => setInput(e.target.value)} />
        <div className="flex flex-wrap gap-2">{tabs.map(([k, label]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}</div>
        <select className="input" aria-label={w.fCat} value={cat} onChange={(e) => setCat(e.target.value as 'all' | MarketCat)}>
          <option value="all">{w.anyCategory}</option>
          {MARKET_CATS.map((c) => <option key={c} value={c}>{w.cats[c]}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : rows.length === 0 ? <Empty text={kind === 'mine' ? w.emptyMine : w.empty}><Store className="mx-auto mt-3 h-6 w-6 text-zinc-400" aria-hidden="true" /></Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">{rows.map(card)}</div>
      )}
      <LoadMore show={!loading && more} busy={busy} onClick={() => void showMore()} label={w.more} />

      {admin && hiddenRows.length > 0 && (
        <section className="space-y-3" aria-label={w.hiddenTitle}>
          <h2 className="text-base font-semibold">{w.hiddenTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">{hiddenRows.map(card)}</div>
        </section>
      )}
    </div>
  );
}
