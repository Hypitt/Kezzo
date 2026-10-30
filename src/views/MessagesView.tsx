import { api } from '../lib/api';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Mic, PhoneOff, Send, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { isSafe } from '../lib/moderation';
import { timeAgo } from '../lib/format';
import type { DirectMessage, PublicProfile } from '../lib/types';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { useToast } from '../state/Toast';
import { useCalls } from '../state/Calls';
import { Avatar, Empty, Loading } from '../components/ui';
import { Tx } from '../components/Tx';

interface Conversation { otherId: string; last: DirectMessage; unread: number }
const COLUMNS = 'id,sender_id,recipient_id,body,read_at,created_at';

export function MessagesView({ otherId }: { otherId?: string }) {
  const { user, blocked } = useAuth();
  const { t, lang } = useI18n();
  const { go } = useRouter();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [refresh, setRefresh] = useState(0);
  const me = user!.id;

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('direct_messages').select(COLUMNS)
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order('created_at', { ascending: false }).limit(300);
    const map = new Map<string, Conversation>();
    for (const m of (data ?? []) as DirectMessage[]) {
      const other = m.sender_id === me ? m.recipient_id : m.sender_id;
      const entry = map.get(other) ?? { otherId: other, last: m, unread: 0 };
      if (m.recipient_id === me && !m.read_at) entry.unread += 1;
      map.set(other, entry);
    }
    const list = [...map.values()];
    setConvs(list);
    const ids = list.map((c) => c.otherId);
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select(PUBLIC_PROFILE).in('id', ids);
      setPeople((prev) => ({ ...prev, ...Object.fromEntries(((profiles ?? []) as PublicProfile[]).map((p) => [p.id, p])) }));
    }
  }, [me]);

  useEffect(() => {
    loadConversations();
    const channel = supabase
      .channel(`dm:${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${me}` }, () => {
        loadConversations();
        setRefresh((n) => n + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, loadConversations]);

  const visible = (convs ?? []).filter((c) => !blocked.includes(c.otherId));

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
      <aside className={`${otherId ? 'hidden md:block' : ''} card p-0 sm:p-0`} aria-label={t('nav_messages')}>
        <h1 className="border-b border-zinc-100 px-4 py-3 text-base font-semibold">{t('nav_messages')}</h1>
        {convs === null ? <Loading /> : visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">{t('no_conversations')}</p>
        ) : (
          <ul className="max-h-[32rem] overflow-y-auto">
            {visible.map((c) => {
              const p = people[c.otherId];
              return (
                <li key={c.otherId}>
                  <button type="button" onClick={() => go('messages', c.otherId)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 ${otherId === c.otherId ? 'bg-zinc-50' : ''}`}>
                    {p ? <Avatar p={p} size={36} /> : <span className="h-9 w-9 rounded-full bg-zinc-100" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{p?.display_name ?? '…'}</span>
                        <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(c.last.created_at, lang)}</span>
                      </span>
                      <span className="block truncate text-xs text-zinc-500">{c.last.body}</span>
                    </span>
                    {c.unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-medium text-white">{c.unread}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className={`${otherId ? '' : 'hidden md:block'} md:col-span-2`}>
        {otherId ? (
          <Thread key={otherId} otherId={otherId} me={me} refreshKey={refresh} onSent={loadConversations} />
        ) : (
          <Empty text={t('pick_conversation')} />
        )}
      </section>
    </div>
  );
}

function Thread({ otherId, me, refreshKey, onSent }: { otherId: string; me: string; refreshKey: number; onSent: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { go } = useRouter();
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const { active, startCall, endCall } = useCalls();
  // The call runs in a floating window (see CallDock), so it keeps going while the person browses the rest of Kezzo.
  const calling = active?.kind === 'dm' && active.target === otherId;

  useEffect(() => {
    supabase.from('profiles').select(PUBLIC_PROFILE).eq('id', otherId).maybeSingle().then(({ data }) => setOther((data as PublicProfile | null) ?? null));
  }, [otherId]);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase
        .from('direct_messages').select(COLUMNS)
        .or(`and(sender_id.eq.${me},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me})`)
        .order('created_at', { ascending: false }).limit(200);
      if (off) return;
      setMessages(((data ?? []) as DirectMessage[]).reverse());
      await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', otherId).is('read_at', null);
      if (!off) onSent();
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, otherId, refreshKey]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (!isSafe(body)) return toast(t('blocked_content'), 'error');
    const { data, error } = await supabase.from('direct_messages').insert({ sender_id: me, recipient_id: otherId, body }).select(COLUMNS).single();
    if (error || !data) return toast(t('dm_not_allowed'), 'error');
    setText('');
    setMessages((m) => [...m, data as DirectMessage]);
    // Optional email to the other person (they can turn it off). Failures never matter here.
    void api('notify-message', { messageId: (data as DirectMessage).id }).catch(() => undefined);
    onSent();
  };

  return (
    <div className="card flex h-[32rem] flex-col p-0 sm:p-0">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
        <button type="button" className="md:hidden" onClick={() => go('messages')} aria-label={t('back')}><ArrowLeft className="h-4 w-4" /></button>
        {other && <button type="button" className="flex items-center gap-2" onClick={() => go('profile', other.id)}><Avatar p={other} size={30} /><span className="text-sm font-semibold">{other.display_name}</span></button>}
        <div className="ml-auto flex gap-2">
          {calling ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={endCall}><PhoneOff className="h-3.5 w-3.5" aria-hidden="true" />{t('call_end')}</button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startCall('dm', otherId, false, other?.display_name ?? '')}><Mic className="h-3.5 w-3.5" aria-hidden="true" />{t('voice_call')}</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => startCall('dm', otherId, true, other?.display_name ?? '')}><Video className="h-3.5 w-3.5" aria-hidden="true" />{t('video_call')}</button>
            </>
          )}
        </div>
      </header>
      {calling && <p className="border-b border-zinc-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">{t('call_hint')}</p>}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="text-sm text-zinc-500">{t('say_hello')}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === me ? 'justify-end' : ''}`}>
            <p className={`max-w-[80%] break-words rounded-2xl px-3 py-1.5 text-sm ${m.sender_id === me ? 'bg-zinc-900 text-white' : 'bg-zinc-100'}`}><Tx text={m.body} enabled={m.sender_id !== me} /></p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-zinc-100 p-3">
        <input className="input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={t('message_placeholder')} aria-label={t('message_placeholder')} />
        <button className="btn btn-primary" disabled={!text.trim()} aria-label={t('send')}><Send className="h-4 w-4" aria-hidden="true" /></button>
      </form>
    </div>
  );
}
