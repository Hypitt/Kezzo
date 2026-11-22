import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Crown, Heart, ImagePlus, MapPin, MessageCircle, Pencil, Plus, Share2, ChevronDown, SlidersHorizontal, Store, Trash2, X } from 'lucide-react';
import type { Lang } from '../lib/types';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { fileExt } from '../lib/format';
import { isSafe } from '../lib/moderation';
import { compressImage, resizeCover } from '../lib/media';
import { startUpload } from '../lib/upload';
import { publicFilePath, publicUrl, removePublic } from '../lib/storage';
import { MARKET, MARKET2, MARKET_CATS, MARKET_KINDS, SHOP, formatPrice, rememberAbout, type Listing, type Shop, type MarketCat, type MarketKind, type MarketStatus } from '../lib/market';
import { readPlace, savePlace } from '../lib/opportunities';
import { copyText, shareUrl } from '../lib/share';
import { ShareButton } from '../components/ShareButton';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { limitMessage } from '../lib/premiumText';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { ReportButton } from '../components/ReportButton';
import { PayDialog } from '../components/PayDialog';
import { ORDERS } from '../lib/ordersText';
import { Avatar, Chip, Empty, Loading, LoadMore, PageHeader } from '../components/ui';

const PAGE = 18;
const SELECT = `id,seller_id,kind,category,title,body,price,currency,condition,country,city,online,contact,photos,quantity,status,hidden,created_at,seller:profiles!seller_id(${PUBLIC_PROFILE})`;
const clean = (s: string) => s.replace(/[%_,()*\\"]/g, ' ').trim();
const sellerOf = (l: Listing) => (Array.isArray(l.seller) ? l.seller[0] : l.seller) ?? null;

function Card({ l, mine, admin, fav, flag, onFav, onEdit, onChanged, onShop }: { l: Listing; mine: boolean; flag?: { premium: boolean; payable: boolean }; admin: boolean; fav: boolean; onFav: () => void; onEdit: () => void; onChanged: () => void; onShop?: () => void }) {
  const { lang } = useI18n();
  const { user, openAuth } = useAuth();
  const { go } = useRouter();
  const { toast } = useToast();
  const w = MARKET[lang];
  const m2 = MARKET2[lang];
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [qtyText, setQtyText] = useState(l.quantity === null ? '' : String(l.quantity));
  useEffect(() => { setQtyText(l.quantity === null ? '' : String(l.quantity)); }, [l.quantity]);
  const seller = sellerOf(l);
  const place = l.online && !l.country ? w.online : [l.city, l.country].filter(Boolean).join(', ');
  const price = formatPrice(l.price, l.currency, lang, w.free, w.ask);
  const photo = l.photos[0] ? publicUrl('media-public', l.photos[0]) : null;
  const gone = l.status !== 'active';

  const setStatus = async (status: MarketStatus) => {
    // putting a sold-out item back on sale clears the count, otherwise it would stay at 0
    const patch = status === 'active' && l.quantity === 0 ? { status, quantity: null } : { status };
    const { error } = await supabase.from('market_listings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', l.id);
    if (error) toast(w.errGeneric, 'error'); else onChanged();
  };
  const remove = async () => {
    if (!window.confirm(w.delAsk)) return;
    const { error } = await supabase.from('market_listings').delete().eq('id', l.id);
    if (error) { toast(w.errGeneric, 'error'); return; }
    await removePublic('media-public', l.photos);
    onChanged();
  };
  const setQty = async (n: number | null) => {
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 100000)) { toast(w.errGeneric, 'error'); return; }
    const { error } = await supabase.from('market_listings').update({ quantity: n, updated_at: new Date().toISOString() }).eq('id', l.id);
    if (error) toast(`${w.errGeneric} (${error.message})`, 'error'); else { toast(m2.qtyUpdated); onChanged(); }
  };
  const hide = async () => { await supabase.rpc('admin_hide_listing', { p_id: l.id, p_hide: !l.hidden }); onChanged(); };

  return (
    <article className="card overflow-hidden !p-0 text-zinc-900">
      <div className="relative aspect-square bg-zinc-100">
        {photo
          ? <img src={photo} alt={l.title} loading="lazy" decoding="async" className={`h-full w-full object-cover ${gone ? 'opacity-50' : ''}`} />
          : <div className="flex h-full items-center justify-center text-zinc-400"><Store className="h-10 w-10" aria-hidden="true" /></div>}
        <span className="absolute left-2 top-2 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">{w.kinds[l.kind]}</span>
        {user && !mine && (
          <button type="button" aria-pressed={fav} aria-label={fav ? m2.favRemove : m2.favAdd} title={fav ? m2.favRemove : m2.favAdd} onClick={onFav}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
            <Heart className={`h-5 w-5 ${fav ? 'fill-red-500 text-red-500' : 'text-zinc-700'}`} aria-hidden="true" />
          </button>
        )}
        {gone && <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold">{l.status === 'sold' ? w.sold : w.paused}</span>}
        {l.hidden && <span className="absolute bottom-2 left-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{w.hide}</span>}
      </div>
      <div className="space-y-1 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{l.title}</h3>
        <p className="flex shrink-0 items-center gap-2 text-base font-bold">{price}
          {l.quantity !== null && <span className={`text-xs font-semibold ${l.quantity === 0 ? 'text-red-600' : l.quantity <= 3 ? 'text-amber-600' : 'text-zinc-500'}`}>{l.quantity === 0 ? m2.soldOut : m2.left(l.quantity)}</span>}
        </p>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-600">
          <span>{w.cats[l.category]}</span>
          {l.condition && <span>{w.conds[l.condition]}</span>}
          {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{place}</span>}
          <button type="button" className="font-semibold text-accent hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? w.showLess : w.readMore}</button>
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
        {mine && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="text-xs font-semibold text-zinc-600" htmlFor={`q-${l.id}`}>{m2.qty}</label>
            <input id={`q-${l.id}`} className="input !w-20 !py-1 text-sm" inputMode="numeric" value={qtyText} maxLength={6} onChange={(e) => setQtyText(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setQty(qtyText === '' ? null : Number(qtyText))}>{m2.update}</button>
            {l.quantity !== null && l.quantity > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setQty(l.quantity! - 1)}>{m2.soldOne}</button>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {seller && (onShop
            ? <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={onShop}>{w.byLabel} <span className="font-semibold">{seller.display_name}</span> · {w.visitShop}</button>
            : <span className="text-xs text-zinc-500">{w.byLabel} {seller.display_name}</span>)}
          {flag?.premium && <Crown className="h-3.5 w-3.5 text-accent" aria-label="Premium" />}
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
              <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" onClick={() => { if (!user) { openAuth('signup'); return; } rememberAbout(l.seller_id, l.id); go('messages', l.seller_id); }}>
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{user ? w.message : w.signIn}
              </button>
              {flag?.payable && !gone && l.price !== null && l.price > 0 && user && <button type="button" className="btn btn-primary btn-sm" onClick={() => setPayOpen(true)}>{ORDERS[lang].pay}</button>}
              <ShareButton type="listing" id={l.id} title={l.title} />
              <ReportButton targetType="listing" targetId={l.id} />
            </>
          )}
          {admin && <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => void hide()}>{l.hidden ? w.unhide : w.hide}</button>}
        </div>
      </div>
      {payOpen && seller && <PayDialog target={{ sellerId: l.seller_id, sellerName: seller.display_name, listing: { id: l.id, title: l.title, price: l.price, currency: l.currency, quantity: l.quantity } }} onClose={() => setPayOpen(false)} />}
    </article>
  );
}

interface Draft { kind: MarketKind; category: MarketCat; title: string; body: string; price: string; currency: string; condition: '' | 'new' | 'used'; country: string; city: string; online: boolean; contact: string; quantity: string }

function Form({ editing, onDone, onCancel }: { editing: Listing | null; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = MARKET[lang];
  const m2 = MARKET2[lang];
  const place = readPlace();
  const [d, setD] = useState<Draft>(() => editing
    ? { kind: editing.kind, category: editing.category, title: editing.title, body: editing.body, price: editing.price === null ? '' : String(editing.price), currency: editing.currency, condition: editing.condition ?? '', country: editing.country, city: editing.city, online: editing.online, contact: editing.contact ?? '', quantity: editing.quantity === null ? '' : String(editing.quantity) }
    : { kind: 'product', category: 'other', title: '', body: '', price: '', currency: '', condition: '', country: place.country, city: place.city, online: false, contact: '', quantity: '' });
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
    const qtyText = d.quantity.trim();
    const quantity = qtyText === '' ? null : Number(qtyText);
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000)) return setErr(w.errGeneric);
    const row = {
      quantity,
      kind: d.kind, category: d.category, title: d.title.trim(), body: d.body.trim(), price, currency: d.currency.trim(),
      condition: d.kind === 'product' && d.condition ? d.condition : null, country: d.country.trim(), city: d.city.trim(),
      online: d.online, contact: d.contact.trim() || null, photos,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from('market_listings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('market_listings').insert({ ...row, seller_id: user.id });
    setBusy(false);
    if (error) return setErr(limitMessage(lang, error.message) ?? (error.message.includes('rate_limited') ? w.errRate : `${w.errGeneric} (${error.message})`));
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
      <div><label className="label" htmlFor="mk-qty">{m2.qty}</label><input id="mk-qty" className="input" inputMode="numeric" value={d.quantity} maxLength={6} onChange={(e) => set('quantity', e.target.value.replace(/\D/g, ''))} /><p className="mt-1 text-xs text-zinc-500">{m2.qtyHelp}</p></div>
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
const FILTERS_WORD: Record<Lang, string> = { en: 'Filters', fr: 'Filtres', es: 'Filtros', pt: 'Filtros', hi: 'फ़िल्टर' };

/** The seller's own shop look: name, about text, profile picture and cover. Saved in market_shops. */
function ShopEditor({ ownerId, shop, onCancel, onSaved }: { ownerId: string; shop: Shop | null; onCancel: () => void; onSaved: (s: Shop) => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = MARKET[lang];
  const sw = SHOP[lang];
  const [name, setName] = useState(shop?.name ?? '');
  const [about, setAbout] = useState(shop?.about ?? '');
  const [logo, setLogo] = useState<string | null>(shop?.logo_path ?? null);
  const [cover, setCover] = useState<string | null>(shop?.cover_path ?? null);
  const [busy, setBusy] = useState(false);
  const added = useRef<string[]>([]);

  const pick = async (file: File | undefined, which: 'logo' | 'cover') => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast(sw.tooBig);
    setBusy(true);
    try {
      const small = which === 'cover' ? await resizeCover(file) : await compressImage(file, 600, 0.85);
      const path = publicFilePath(ownerId, `${crypto.randomUUID()}.${fileExt(small.name)}`);
      await startUpload({ bucket: 'media-public', path, file: small }).done;
      added.current.push(path);
      if (which === 'logo') setLogo(path); else setCover(path);
    } catch { toast(w.errGeneric); }
    setBusy(false);
  };

  const save = async () => {
    if (!isSafe(`${name} ${about}`)) return toast(w.errGeneric);
    setBusy(true);
    const row = { owner_id: ownerId, name: name.trim().slice(0, 60), about: about.trim().slice(0, 300), logo_path: logo, cover_path: cover, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('market_shops').upsert(row);
    if (error) { setBusy(false); return toast(w.errGeneric); }
    // pictures that were replaced or removed, and ones uploaded but not kept, are deleted
    await removePublic('media-public', [shop?.logo_path, shop?.cover_path, ...added.current].filter((p) => p && p !== logo && p !== cover));
    setBusy(false);
    toast(sw.saved);
    onSaved(row);
  };

  const pickerRow = (label: string, path: string | null, which: 'logo' | 'cover', set: (v: null) => void) => (
    <div className="flex items-center gap-3">
      {path ? <img src={publicUrl('media-public', path)} alt="" className={which === 'logo' ? 'h-14 w-14 rounded-full object-cover' : 'h-14 w-28 rounded-lg object-cover'} /> : <span className={`${which === 'logo' ? 'h-14 w-14 rounded-full' : 'h-14 w-28 rounded-lg'} flex items-center justify-center bg-stone-100 text-zinc-400`}><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>}
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{label}</p></div>
      <label className="btn btn-ghost btn-sm cursor-pointer">{sw.change}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0], which); e.target.value = ''; }} /></label>
      {path && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(null)}>{sw.remove}</button>}
    </div>
  );

  return (
    <section className="card space-y-3 text-zinc-900">
      {pickerRow(sw.cover, cover, 'cover', () => setCover(null))}
      {pickerRow(sw.logo, logo, 'logo', () => setLogo(null))}
      <label className="block text-sm font-semibold">{sw.name}
        <input className="input mt-1 w-full" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold">{sw.about}
        <textarea className="input mt-1 w-full" rows={3} value={about} maxLength={300} onChange={(e) => setAbout(e.target.value)} />
      </label>
      <p className="text-xs text-zinc-500">{sw.hint}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>{sw.cancel}</button>
        <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={() => void save()} disabled={busy}>{sw.save}</button>
      </div>
    </section>
  );
}

export function MarketView({ shop }: { shop?: string }) {
  const { user, openAuth } = useAuth();
  const { go } = useRouter();
  const { toast } = useToast();
  const { lang } = useI18n();
  const w = MARKET[lang];
  const [kind, setKind] = useState<'all' | MarketKind | 'mine' | 'fav'>('all');
  const [cat, setCat] = useState<'all' | MarketCat>('all');
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<Listing[]>([]);
  const [flags, setFlags] = useState<Record<string, { premium: boolean; payable: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<{ open: boolean; editing: Listing | null }>({ open: false, editing: null });
  const [admin, setAdmin] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Listing[]>([]);
  const [owner, setOwner] = useState<{ id: string; display_name: string; avatar_url: string | null; bio: string } | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [seed] = useState(() => {
    try { const k = 'kezzo_market_seed'; const v = sessionStorage.getItem(k) ?? crypto.randomUUID(); sessionStorage.setItem(k, v); return v; } catch { return crypto.randomUUID(); }
  });
  const [place, setPlace] = useState(readPlace);
  const [saved, setSaved] = useState(readPlace);
  const [placeEdit, setPlaceEdit] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<'smart' | 'new' | 'low' | 'high'>('smart');
  const [avail, setAvail] = useState(false);
  const m2 = MARKET2[lang];
  const [shopRow, setShopRow] = useState<Shop | null>(null);
  const [editShop, setEditShop] = useState(false);
  const sw = SHOP[lang];
  const request = useRef(0);

  useEffect(() => {
    setOwner(null);
    setShopRow(null);
    setEditShop(false);
    if (!shop) return;
    void supabase.from('market_shops').select('owner_id,name,about,logo_path,cover_path').eq('owner_id', shop).maybeSingle().then(({ data }) => setShopRow((data as Shop | null) ?? null));
    void supabase.from('profiles').select('id,display_name,avatar_url,bio').eq('id', shop).maybeSingle().then(({ data }) => setOwner((data as typeof owner) ?? null));
  }, [shop]);

  useEffect(() => { const id = window.setTimeout(() => setTerm(clean(input)), 350); return () => window.clearTimeout(id); }, [input]);
  useEffect(() => {
    if (!user) { setAdmin(false); return; }
    void supabase.rpc('is_admin').then(({ data }) => setAdmin(data === true));
  }, [user]);

  useEffect(() => {
    if (!user) { setFavs(new Set()); return; }
    void supabase.from('market_favorites').select('listing_id').eq('user_id', user.id).limit(1000).then(({ data }) => setFavs(new Set((data ?? []).map((r) => String(r.listing_id)))));
  }, [user]);

  const toggleFav = async (id: string) => {
    if (!user) return;
    const on = favs.has(id);
    setFavs((f) => { const n = new Set(f); if (on) n.delete(id); else n.add(id); return n; });
    const { error } = on
      ? await supabase.from('market_favorites').delete().eq('user_id', user.id).eq('listing_id', id)
      : await supabase.from('market_favorites').insert({ user_id: user.id, listing_id: id });
    if (error) setFavs((f) => { const n = new Set(f); if (on) n.add(id); else n.delete(id); return n; });
  };

  const fetchPage = useCallback(async (offset: number): Promise<Listing[]> => {
    // Browsing the whole market: a random order that stays the same while you scroll, with items near you first, then online, then elsewhere.
    if (!shop && sort === 'smart' && (kind === 'all' || kind === 'product' || kind === 'service')) {
      let cats: string[] | null = null;
      let sellers: string[] | null = null;
      if (term) {
        const lower = term.toLowerCase();
        const c = MARKET_CATS.filter((x) => x.includes(lower) || MARKET[lang].cats[x].toLowerCase().includes(lower));
        cats = c.length ? [...c] : null;
        const { data: people } = await supabase.from('profiles').select('id').or(`display_name.ilike.%${term}%,handle.ilike.%${term.replace(/^@/, '')}%`).limit(30);
        sellers = (people ?? []).length ? (people ?? []).map((r) => String(r.id)) : null;
      }
      const { data } = await supabase.rpc('market_feed', {
        p_seed: seed, p_country: saved.country.trim(), p_city: saved.city.trim(),
        p_kind: kind === 'all' ? null : kind, p_cat: cat === 'all' ? null : cat, p_avail: avail,
        p_term: term || null, p_cats: cats, p_sellers: sellers, p_offset: offset, p_limit: PAGE,
      }).select(SELECT);
      return (data ?? []) as unknown as Listing[];
    }
    let q = supabase.from('market_listings').select(SELECT).eq('hidden', false);
    q = sort === 'low' ? q.order('price', { ascending: true, nullsFirst: false }) : sort === 'high' ? q.order('price', { ascending: false, nullsFirst: false }) : q;
    q = q.order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (shop) { q = q.eq('seller_id', shop); if (shop !== user?.id) q = q.neq('status', 'paused'); }
    else if (kind === 'mine') q = user ? q.eq('seller_id', user.id) : q.eq('seller_id', '00000000-0000-0000-0000-000000000000');
    else if (kind === 'fav') { if (favs.size === 0) return []; q = q.in('id', [...favs]).neq('status', 'paused'); }
    else { if (kind !== 'all') q = q.eq('kind', kind); q = q.neq('status', 'paused'); }
    if (cat !== 'all') q = q.eq('category', cat);
    if (avail) q = q.eq('status', 'active');
    if (term) {
      // name, description, place, category and seller (name or @handle)
      const lower = term.toLowerCase();
      const parts = [`title.ilike.%${term}%`, `body.ilike.%${term}%`, `city.ilike.%${term}%`, `country.ilike.%${term}%`];
      const cats = MARKET_CATS.filter((c) => c.includes(lower) || MARKET[lang].cats[c].toLowerCase().includes(lower));
      if (cats.length) parts.push(`category.in.(${cats.join(',')})`);
      if (!shop) {
        const { data: people } = await supabase.from('profiles').select('id').or(`display_name.ilike.%${term}%,handle.ilike.%${term.replace(/^@/, '')}%`).limit(30);
        const ids = (people ?? []).map((r) => String(r.id));
        if (ids.length) parts.push(`seller_id.in.(${ids.join(',')})`);
      }
      q = q.or(parts.join(','));
    }
    const { data } = await q;
    return (data ?? []) as unknown as Listing[];
  }, [kind, cat, term, user, shop, sort, avail, lang, seed, saved.country, saved.city, favs.size === 0 && kind === 'fav', kind === 'fav' ? favs : null]);

  const load = useCallback(() => {
    const mine = ++request.current;
    setLoading(true);
    void fetchPage(0).then((r) => { if (mine !== request.current) return; setRows(r); setMore(r.length === PAGE); setLoading(false); });
  }, [fetchPage]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.seller_id).filter((id) => !(id in flags))));
    if (!user || ids.length === 0) return;
    void supabase.rpc('seller_flags', { p_ids: ids }).then(({ data }) => {
      if (!Array.isArray(data)) return;
      setFlags((f) => { const n = { ...f }; for (const id of ids) n[id] = { premium: false, payable: false }; for (const x of data as Array<{ user_id: string; premium: boolean; payable: boolean }>) n[x.user_id] = { premium: x.premium, payable: x.payable }; return n; });
    });
  }, [rows, user, flags]);

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
    <Card key={l.id} l={l} mine={l.seller_id === user?.id} flag={flags[l.seller_id]} admin={admin} fav={favs.has(l.id)} onFav={() => void toggleFav(l.id)}
      onEdit={() => { setForm({ open: true, editing: l }); window.scrollTo(0, 0); }}
      onChanged={() => { load(); loadHidden(); }} onShop={shop ? undefined : () => go('market', l.seller_id)} />
  );
  const tabs: Array<['all' | MarketKind | 'mine' | 'fav', string]> = [['all', w.all], ['product', w.products], ['service', w.services]];
  if (user) tabs.push(['fav', m2.favorites], ['mine', w.mine]);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {shop && (
        <section className="card overflow-hidden p-0 text-zinc-900">
          <div className="relative h-32 bg-gradient-to-br from-zinc-800 to-zinc-600 sm:h-44">
            {shopRow?.cover_path && <img src={publicUrl('media-public', shopRow.cover_path)} alt="" className="h-full w-full object-cover" />}
            <button type="button" className="btn btn-sm absolute left-2 top-2 bg-white/90 text-zinc-900 hover:bg-white" onClick={() => go('market')}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{w.title}</button>
          </div>
          <div className="flex flex-wrap items-end gap-3 px-4 pb-4">
            {shopRow?.logo_path
              ? <img src={publicUrl('media-public', shopRow.logo_path)} alt="" className="-mt-8 h-16 w-16 shrink-0 rounded-full border-4 border-white bg-white object-cover" />
              : owner && <span className="-mt-8 rounded-full border-4 border-white bg-white"><Avatar p={owner} size={56} /></span>}
            <div className="min-w-0 flex-1 pt-2">
              <h1 className="truncate font-display text-lg font-bold">{shopRow?.name || (owner ? w.shopOf(owner.display_name) : w.title)}</h1>
              {(shopRow?.about || owner?.bio) && <p className="line-clamp-3 text-xs text-zinc-600">{shopRow?.about || owner?.bio}</p>}
              <p className="text-xs text-zinc-500">{w.listingsN(rows.length)}</p>
            </div>
            <div className="flex gap-2">
              {user?.id === shop && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditShop((v) => !v)}><Pencil className="h-4 w-4" aria-hidden="true" />{sw.edit}</button>}
              <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" onClick={async () => {
                const named = user ? await supabase.rpc('share_slug', { p_type: 'shop', p_id: shop }) : null;
                const url = shareUrl('shop', shop, typeof named?.data === 'string' ? named.data : undefined);
                const title = shopRow?.name || (owner ? w.shopOf(owner.display_name) : 'Kezzo');
                if (typeof navigator.share === 'function') { try { await navigator.share({ title, url }); return; } catch { /* cancelled: fall back to copy */ } }
                toast((await copyText(url)) ? w.linkCopied : w.errGeneric);
              }}><Share2 className="h-4 w-4" aria-hidden="true" />{w.shareShop}</button>
            </div>
          </div>
        </section>
      )}
      {shop && editShop && user?.id === shop && <ShopEditor ownerId={shop} shop={shopRow} onCancel={() => setEditShop(false)} onSaved={(s) => { setShopRow(s); setEditShop(false); }} />}
      {!shop && <PageHeader title={w.title} sub={w.sub}
        action={<div className="flex gap-2">{user && <button type="button" className="btn btn-ghost" onClick={() => go('market', user.id)}><Store className="h-4 w-4" aria-hidden="true" />{sw.myShop}</button>}<button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={() => (user ? setForm({ open: true, editing: null }) : openAuth('signup'))}><Plus className="h-4 w-4" aria-hidden="true" />{w.sell}</button></div>} />}

      {form.open && <Form editing={form.editing} onCancel={() => setForm({ open: false, editing: null })} onDone={() => { setForm({ open: false, editing: null }); load(); }} />}


      <div className="space-y-3">
        <div className="flex gap-2">
          <input className="input min-w-0 flex-1" placeholder={m2.searchHint} aria-label={w.search} value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="button" className="btn btn-ghost shrink-0" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{FILTERS_WORD[lang]}</span>
            {(cat !== 'all' || avail || sort !== 'smart') && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
        {!shop && <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map(([k, label]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}</div>}
        {showFilters && (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            {!shop && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {placeEdit || (!place.country && !place.city) ? (
                  <>
                    <input className="input !w-32 !py-1 text-sm" aria-label={m2.placeCountry} placeholder={m2.placeCountry} value={place.country} maxLength={60} onChange={(e) => setPlace({ ...place, country: e.target.value })} />
                    <input className="input !w-32 !py-1 text-sm" aria-label={m2.placeCity} placeholder={m2.placeCity} value={place.city} maxLength={60} onChange={(e) => setPlace({ ...place, city: e.target.value })} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const next = { country: place.country.trim(), city: place.city.trim() }; savePlace(next); setSaved(next); setPlaceEdit(false); }}>{m2.placeSave}</button>
                  </>
                ) : (
                  <button type="button" className="hover:underline" onClick={() => setPlaceEdit(true)}><span className="font-semibold">{[place.city, place.country].filter(Boolean).join(', ')}</span></button>
                )}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="input" aria-label={w.fCat} value={cat} onChange={(e) => setCat(e.target.value as 'all' | MarketCat)}>
                <option value="all">{w.anyCategory}</option>
                {MARKET_CATS.map((c) => <option key={c} value={c}>{w.cats[c]}</option>)}
              </select>
              <select className="input" aria-label={m2.sortNew} value={sort} onChange={(e) => setSort(e.target.value as 'smart' | 'new' | 'low' | 'high')}>
                <option value="smart">{m2.sortSmart}</option><option value="new">{m2.sortNew}</option><option value="low">{m2.sortLow}</option><option value="high">{m2.sortHigh}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avail} onChange={(e) => setAvail(e.target.checked)} />{m2.onlyAvail}</label>
          </div>
        )}
      </div>

      {loading ? <Loading /> : rows.length === 0 ? <Empty text={shop ? w.emptyShop : kind === 'mine' ? w.emptyMine : kind === 'fav' ? m2.emptyFav : w.empty}><Store className="mx-auto mt-3 h-6 w-6 text-zinc-400" aria-hidden="true" /></Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">{rows.map(card)}</div>
      )}
      <LoadMore show={!loading && more} busy={busy} onClick={() => void showMore()} label={w.more} />

      {admin && hiddenRows.length > 0 && (
        <section className="space-y-3" aria-label={w.hiddenTitle}>
          <h2 className="text-base font-semibold">{w.hiddenTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">{hiddenRows.map(card)}</div>
        </section>
      )}
      <p className="pt-2 text-center text-[11px] text-zinc-400">{w.safety}</p>
    </div>
  );
}
