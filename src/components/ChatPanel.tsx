import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { isSafe } from '../lib/moderation';
import type { ChatMessage, PublicProfile } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';

interface Props {
  roomType: 'battle' | 'group';
  roomId: string;
  canWrite?: boolean;
}

const COLUMNS = 'id,room_type,room_id,author_id,body,created_at';

/** Realtime chat for battle rooms (public) and squad rooms (members only; enforced by RLS). */
export function ChatPanel({ roomType, roomId, canWrite = true }: Props) {
  const { user, ensureAuth, blocked } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const authors = useRef(new Map<string, PublicProfile>());
  const list = useRef<HTMLDivElement>(null);

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

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !ensureAuth() || !user) return;
    if (!isSafe(body)) return toast(t('blocked_content'), 'error');
    const { data, error } = await supabase
      .from('chat_messages').insert({ room_type: roomType, room_id: roomId, author_id: user.id, body }).select(COLUMNS).single();
    if (error || !data) return toast(t('error_generic'), 'error');
    setText('');
    const [row] = await hydrate([data as ChatMessage]);
    setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
  };

  const visible = messages.filter((m) => !blocked.includes(m.author_id));

  return (
    <section className="card flex h-[28rem] flex-col p-0 sm:p-0" aria-label={t('chat')}>
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">{t('chat')}</h2>
      <div ref={list} className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {visible.length === 0 && <p className="text-zinc-500">{t('chat_empty')}</p>}
        {visible.map((m) => (
          <p key={m.id} className="break-words">
            <button type="button" className="font-semibold hover:underline" onClick={() => m.author && go('profile', m.author.id)}>
              {m.author?.display_name ?? '…'}
            </button>{' '}
            <span className="text-zinc-700">{m.body}</span>
          </p>
        ))}
      </div>
      {canWrite ? (
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-100 p-3">
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
