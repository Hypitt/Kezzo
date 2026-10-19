import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, FileText, Paperclip, Send, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { fileExt } from '../lib/format';
import { compressImage, formatBytes } from '../lib/media';
import { isSafe } from '../lib/moderation';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, startUpload, type UploadFailure, type UploadHandle } from '../lib/upload';
import type { ChatMessage, PublicProfile } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { UploadBar, failureKey, type UploadState } from './UploadBar';

interface Props {
  roomType: 'battle' | 'group';
  roomId: string;
  canWrite?: boolean;
  /** Group chats can share files (stored privately; only members can open them). */
  allowFiles?: boolean;
  /** Group owners and admins can delete anyone's message. */
  canModerate?: boolean;
}

const COLUMNS = 'id,room_type,room_id,author_id,body,created_at,file_path,file_name,file_type,file_size';

/** Realtime chat for battle rooms (public) and group rooms (members only; enforced by RLS). */
export function ChatPanel({ roomType, roomId, canWrite = true, allowFiles = false, canModerate = false }: Props) {
  const { user, ensureAuth, blocked } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [upload, setUpload] = useState<UploadState | null>(null);
  const authors = useRef(new Map<string, PublicProfile>());
  const list = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle | null>(null);
  const pending = useRef<{ file: File; path: string } | null>(null);

  const hydrate = useCallback(async (rows: ChatMessage[]): Promise<ChatMessage[]> => {
    const need = [...new Set(rows.map((r) => r.author_id))].filter((id) => !authors.current.has(id));
    if (need.length) {
      const { data } = await supabase.from('profiles').select(PUBLIC_PROFILE).in('id', need);
      (data as PublicProfile[] | null)?.forEach((p) => authors.current.set(p.id, p));
    }
    return rows.map((r) => ({ ...r, author: authors.current.get(r.author_id) }));
  }, []);

  useEffect(() => {
    let off = false;
    setMessages([]);
    (async () => {
      const { data } = await supabase
        .from('chat_messages').select(COLUMNS).eq('room_type', roomType).eq('room_id', roomId)
        .order('created_at', { ascending: false }).limit(60);
      const rows = await hydrate(((data ?? []) as ChatMessage[]).reverse());
      if (!off) setMessages(rows);
    })();
    const channel = supabase
      .channel(`chat:${roomType}:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, async (payload) => {
        const [row] = await hydrate([payload.new as ChatMessage]);
        if (!off) setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row].slice(-200)));
      })
      .subscribe();
    return () => {
      off = true;
      supabase.removeChannel(channel);
    };
  }, [roomType, roomId, hydrate]);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  // Stop an unfinished upload if the chat is closed.
  useEffect(() => () => handle.current?.cancel(), []);

  const addRow = async (data: ChatMessage) => {
    const [row] = await hydrate([data]);
    setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !ensureAuth() || !user) return;
    if (!isSafe(body)) return toast(t('blocked_content'), 'error');
    const { data, error } = await supabase
      .from('chat_messages').insert({ room_type: roomType, room_id: roomId, author_id: user.id, body }).select(COLUMNS).single();
    if (error || !data) return toast(t('error_generic'), 'error');
    setText('');
    await addRow(data as ChatMessage);
  };

  const runUpload = async () => {
    const job = pending.current;
    if (!job || !user) return;
    const total = job.file.size;
    setUpload({ sent: 0, total, failed: false });
    const h = startUpload({
      bucket: 'chat-files', path: job.path, file: job.file,
      onProgress: (sent, all) => setUpload((u) => (u ? { ...u, sent, total: all, failed: false } : u)),
    });
    handle.current = h;
    try {
      await h.done;
      const caption = text.trim();
      const { data, error } = await supabase.from('chat_messages').insert({
        room_type: roomType, room_id: roomId, author_id: user.id, body: isSafe(caption) ? caption : '',
        file_path: job.path, file_name: job.file.name.slice(0, 120), file_type: job.file.type || null, file_size: job.file.size,
      }).select(COLUMNS).single();
      if (error || !data) throw new Error('insert');
      pending.current = null;
      setUpload(null);
      setText('');
      await addRow(data as ChatMessage);
    } catch (err) {
      const reason = err instanceof Error && 'reason' in err ? (err as { reason: UploadFailure }).reason : 'unknown';
      if (reason === 'cancelled') return;
      setUpload({ sent: 0, total, failed: true, message: t(failureKey(reason)) });
    }
  };

  const pick = async (file: File | undefined) => {
    if (picker.current) picker.current.value = '';
    if (!file || !ensureAuth() || !user) return;
    if (file.size > MAX_UPLOAD_BYTES) return toast(t('err_file_too_big', { n: MAX_UPLOAD_MB }), 'error');
    const ready = await compressImage(file);
    pending.current = { file: ready, path: `group/${roomId}/${user.id}/${crypto.randomUUID()}.${fileExt(ready.name)}` };
    void runUpload();
  };

  const cancelUpload = () => {
    handle.current?.cancel();
    pending.current = null;
    setUpload(null);
  };

  const remove = async (m: ChatMessage) => {
    if (!window.confirm(t('confirm_delete'))) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', m.id);
    if (error) return toast(t('error_generic'), 'error');
    if (m.file_path && m.author_id === user?.id) await supabase.storage.from('chat-files').remove([m.file_path]);
    setMessages((list2) => list2.filter((x) => x.id !== m.id));
  };

  const visible = messages.filter((m) => !blocked.includes(m.author_id));

  return (
    <section className="card flex h-[28rem] flex-col p-0 sm:p-0" aria-label={t('chat')}>
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">{t('chat')}</h2>
      <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {visible.length === 0 && <p className="text-zinc-500">{t('chat_empty')}</p>}
        {visible.map((m) => (
          <div key={m.id} className="group/msg break-words">
            <p>
              <button type="button" className="font-semibold hover:underline" onClick={() => m.author && go('profile', m.author.id)}>
                {m.author?.display_name ?? '…'}
              </button>{' '}
              {m.body && <span className="text-zinc-700">{m.body}</span>}
              {(m.author_id === user?.id || canModerate) && roomType === 'group' && (
                <button type="button" className="ml-2 inline-flex align-middle text-zinc-400 hover:text-red-600" onClick={() => remove(m)} aria-label={t('delete')}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </p>
            {m.file_path && <ChatFile message={m} />}
          </div>
        ))}
      </div>
      {upload && <div className="px-3 pb-2"><UploadBar state={upload} onCancel={cancelUpload} onRetry={() => void runUpload()} /></div>}
      {canWrite ? (
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-100 p-3">
          {allowFiles && (
            <>
              <input ref={picker} type="file" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label={t('attach_file')} />
              <button type="button" className="btn btn-ghost" onClick={() => picker.current?.click()} disabled={Boolean(upload && !upload.failed)} aria-label={t('attach_file')} title={t('attach_file')}>
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
          <input className="input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={t('chat_placeholder')} aria-label={t('chat_placeholder')} />
          <button className="btn btn-primary" disabled={!text.trim()} aria-label={t('send')}>
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <p className="border-t border-zinc-100 p-3 text-center text-xs text-zinc-500">{t('chat_closed')}</p>
      )}
    </section>
  );
}

/** A shared file inside a message. Private files are opened through short-lived links. */
function ChatFile({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const type = message.file_type ?? '';
  const inline = /^(image|audio|video)\//.test(type);

  useEffect(() => {
    if (!inline || !message.file_path) return;
    let off = false;
    supabase.storage.from('chat-files').createSignedUrl(message.file_path, 3600).then(({ data }) => {
      if (!off && data) setUrl(data.signedUrl);
    });
    return () => {
      off = true;
    };
  }, [inline, message.file_path]);

  const download = async () => {
    if (!message.file_path) return;
    const { data } = await supabase.storage.from('chat-files').createSignedUrl(message.file_path, 300, { download: message.file_name ?? true });
    if (!data) return;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mt-1.5 space-y-1.5">
      {type.startsWith('image/') && url && (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={message.file_name ?? ''} className="max-h-48 rounded-lg border border-zinc-200 object-cover" loading="lazy" decoding="async" /></a>
      )}
      {type.startsWith('video/') && url && <video src={url} controls preload="none" className="max-h-56 rounded-lg" />}
      {type.startsWith('audio/') && url && <audio src={url} controls preload="none" className="w-full max-w-xs" />}
      <button type="button" onClick={download} className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs hover:bg-zinc-100">
        <FileText className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{message.file_name}</span>
          {message.file_size != null && <span className="text-zinc-500">{formatBytes(message.file_size)}</span>}
        </span>
        <Download className="h-4 w-4 shrink-0" aria-label={t('download')} />
      </button>
    </div>
  );
}
