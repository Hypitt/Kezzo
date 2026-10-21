import { supabase } from './supabase';
import { PUBLIC_PROFILE } from './data';
import type { PublicProfile } from './types';

export interface PollOption { id: string; label: string; votes: number; mine: boolean }
export interface PollView {
  id: string;
  author_id: string;
  question: string;
  live_id: string | null;
  closes_at: string | null;
  created_at: string;
  author: PublicProfile;
  open: boolean;
  total: number;
  myOption: string | null;
  options: PollOption[];
}

const one = <T,>(v: T | T[] | null | undefined): T => (Array.isArray(v) ? v[0] : (v as T));

/** Polls with their answers and results. `liveId` = polls shown inside a live stream; `standalone` = polls that belong to no live; `ids` = specific polls. */
export async function loadPolls(o: { liveId?: string; standalone?: boolean; ids?: string[]; limit?: number }): Promise<PollView[]> {
  let q = supabase.from('polls')
    .select(`id,author_id,question,live_id,closes_at,created_at,author:profiles!author_id(${PUBLIC_PROFILE}),options:poll_options(id,label,position)`)
    .order('created_at', { ascending: false }).limit(o.limit ?? 20);
  if (o.liveId) q = q.eq('live_id', o.liveId);
  if (o.standalone) q = q.is('live_id', null);
  if (o.ids) q = q.in('id', o.ids);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string; options: { id: string; label: string; position: number }[] }>;
  if (rows.length === 0) return [];
  const { data: res, error: e2 } = await supabase.rpc('poll_results', { p_ids: rows.map((r) => r.id) });
  if (e2) throw e2;
  const results = (res ?? []) as { poll_id: string; option_id: string; votes: number; mine: boolean; open: boolean }[];
  return rows.map((r) => {
    const mine = results.filter((x) => x.poll_id === r.id);
    const options = [...r.options].sort((a, b) => a.position - b.position).map((opt) => {
      const x = mine.find((m) => m.option_id === opt.id);
      return { id: opt.id, label: opt.label, votes: x?.votes ?? 0, mine: x?.mine ?? false };
    });
    return {
      id: r.id, author_id: r.author_id as string, question: r.question as string, live_id: (r.live_id as string | null) ?? null,
      closes_at: (r.closes_at as string | null) ?? null, created_at: r.created_at as string, author: one(r.author as PublicProfile | PublicProfile[]),
      open: mine[0]?.open ?? false, total: options.reduce((n, x) => n + x.votes, 0), myOption: options.find((x) => x.mine)?.id ?? null, options,
    };
  });
}
