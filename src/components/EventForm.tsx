import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import { fileExt } from '../lib/format';
import { isSafe } from '../lib/moderation';
import { compressImage } from '../lib/media';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, startUpload } from '../lib/upload';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Spinner } from './ui';

/** Promote an event: title, date, place and/or online link, optional cover photo. */
export function EventForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { user, ensureAuth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth() || !user) return;
    setError(null);
    if (!title.trim()) return setError(t('err_title_required'));
    if (!starts) return setError(t('event_err_date'));
    const startDate = new Date(starts);
    const endDate = ends ? new Date(ends) : null;
    if (endDate && endDate <= startDate) return setError(t('event_err_end'));
    const url = link.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) return setError(t('event_err_link'));
    if (![title, description, location].every(isSafe)) return setError(t('blocked_content'));
    if (cover && cover.size > MAX_UPLOAD_BYTES) return setError(t('err_file_too_big', { n: MAX_UPLOAD_MB }));
    setBusy(true);
    let coverPath: string | null = null;
    try {
      if (cover) {
        const file = await compressImage(cover);
        coverPath = `${user.id}/${crypto.randomUUID()}.${fileExt(file.name)}`;
        await startUpload({ bucket: 'media-public', path: coverPath, file, onProgress: () => undefined }).done;
      }
      const { data, error: err } = await supabase.from('events').insert({
        host_id: user.id, title: title.trim(), description: description.trim(), starts_at: startDate.toISOString(),
        ends_at: endDate ? endDate.toISOString() : null, location: location.trim(), link: url || null, cover_path: coverPath,
      }).select('id').single();
      if (err) throw err;
      toast(t('event_created'));
      onCreated(data.id as string);
    } catch (err) {
      if (coverPath) void supabase.storage.from('media-public').remove([coverPath]);
      setError(typeof err === 'object' && err && 'reason' in err ? t('error_generic') : explain(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="ev-title">{t('title')}</label>
        <input id="ev-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="ev-desc">{t('body')}</label>
        <textarea id="ev-desc" className="input" rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ev-start">{t('event_starts')}</label>
          <input id="ev-start" type="datetime-local" className="input" value={starts} onChange={(e) => setStarts(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="ev-end">{t('event_ends')}</label>
          <input id="ev-end" type="datetime-local" className="input" value={ends} onChange={(e) => setEnds(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ev-loc">{t('event_place')}</label>
        <input id="ev-loc" className="input" value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ev-link">{t('event_link')}</label>
        <input id="ev-link" type="url" inputMode="url" className="input" placeholder="https://" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} />
        <p className="mt-1 text-xs text-zinc-500">{t('event_link_hint')}</p>
      </div>
      <div>
        <label className="label" htmlFor="ev-cover">{t('event_cover')}</label>
        <input id="ev-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{t('event_publish')}</button>
    </form>
  );
}
