import { supabase } from './supabase';
import type { Battle, BattleStatus, Post, PostKind, PublicProfile } from './types';

export const PUBLIC_PROFILE = 'id,handle,display_name,avatar_url';

/** Strips characters that would break PostgREST filter syntax. */
export function cleanTerm(term?: string): string {
  return (term ?? '').replace(/[%,()*\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

const one = <T,>(v: T | T[] | null | undefined): T => (Array.isArray(v) ? v[0] : (v as T));

// ---------------------------------------------------------------- posts
const POST_SELECT =
  `id,author_id,kind,title,body,media_bucket,media_path,duration_seconds,download_price,created_at,` +
  `author:profiles!author_id(${PUBLIC_PROFILE}),likes:post_likes(count),comments:post_comments(count)`;

export interface PostQuery {
  q?: string;
  authorId?: string;
  authorIds?: string[];
  excludeAuthors?: string[];
  kinds?: PostKind[];
  paid?: boolean | null;
  from?: number;
  limit?: number;
}

export async function loadPosts(me: string | null, o: PostQuery = {}): Promise<Post[]> {
  if (o.authorIds && o.authorIds.length === 0) return [];
  const from = o.from ?? 0;
  const limit = o.limit ?? 12;
  let q = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).range(from, from + limit - 1);
  if (o.authorId) q = q.eq('author_id', o.authorId);
  if (o.authorIds) q = q.in('author_id', o.authorIds);
  if (o.excludeAuthors?.length) q = q.not('author_id', 'in', `(${o.excludeAuthors.join(',')})`);
  if (o.kinds?.length) q = q.in('kind', o.kinds);
  if (o.paid === true) q = q.gt('download_price', 0);
  if (o.paid === false) q = q.eq('download_price', 0);
  const term = cleanTerm(o.q);
  if (term) q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;
  const ids = rows.map((r) => r.id);

  const liked = new Set<string>();
  const unlocked = new Set<string>();
  if (me && ids.length) {
    const [l, u] = await Promise.all([
      supabase.from('post_likes').select('post_id').eq('user_id', me).in('post_id', ids),
      supabase.from('post_unlocks').select('post_id').eq('user_id', me).in('post_id', ids),
    ]);
    (l.data ?? []).forEach((r) => liked.add(r.post_id as string));
    (u.data ?? []).forEach((r) => unlocked.add(r.post_id as string));
  }

  return rows.map((r) => {
    const likes = r.likes as { count: number }[] | undefined;
    const comments = r.comments as { count: number }[] | undefined;
    return {
      ...(r as unknown as Post),
      author: one(r.author as PublicProfile | PublicProfile[]),
      likes: likes?.[0]?.count ?? 0,
      comments: comments?.[0]?.count ?? 0,
      liked: liked.has(r.id),
      unlocked: unlocked.has(r.id),
    };
  });
}

// -------------------------------------------------------------- battles
export const BATTLE_SELECT =
  `id,host_id,title,category,custom_theme,mode,topic,total_rounds,current_round,max_contenders,entry_fee,prize_pool,status,winner_id,created_at,` +
  `host:profiles!host_id(${PUBLIC_PROFILE}),` +
  `contenders:battle_contenders(user_id,score,joined_at,profile:profiles!user_id(${PUBLIC_PROFILE}))`;

export function normalizeBattle(row: unknown): Battle {
  const r = row as Record<string, unknown>;
  const contenders = ((r.contenders as Array<Record<string, unknown>>) ?? []).map((c) => ({
    user_id: c.user_id as string,
    score: c.score as number,
    joined_at: c.joined_at as string,
    profile: one(c.profile as PublicProfile | PublicProfile[]),
  }));
  contenders.sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return { ...(r as unknown as Battle), host: one(r.host as PublicProfile | PublicProfile[]), contenders };
}

export interface BattleQuery {
  q?: string;
  status?: BattleStatus[];
  category?: string;
  from?: number;
  limit?: number;
}

export async function loadBattles(o: BattleQuery = {}): Promise<Battle[]> {
  const from = o.from ?? 0;
  const limit = o.limit ?? 12;
  let q = supabase.from('battles').select(BATTLE_SELECT).order('created_at', { ascending: false }).range(from, from + limit - 1);
  if (o.status?.length) q = q.in('status', o.status);
  if (o.category) q = q.eq('category', o.category);
  const term = cleanTerm(o.q);
  if (term) q = q.or(`title.ilike.%${term}%,topic.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(normalizeBattle);
}

// ---------------------------------------------------------------- people
export interface PersonRow extends PublicProfile {
  bio: string;
  status_text: string | null;
  status_expires_at: string | null;
}
const PERSON_SELECT = `${PUBLIC_PROFILE},bio,status_text,status_expires_at`;

export async function loadPeople(term?: string, from = 0, limit = 12): Promise<PersonRow[]> {
  let q = supabase.from('profiles').select(PERSON_SELECT).order('created_at', { ascending: false }).range(from, from + limit - 1);
  const clean = cleanTerm(term).replace(/^@/, '');
  if (clean) q = q.or(`handle.ilike.%${clean}%,display_name.ilike.%${clean}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PersonRow[];
}

/** People whose 24-hour status is still active. */
export async function loadActiveStatuses(limit = 24): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from('profiles').select(PERSON_SELECT)
    .gt('status_expires_at', new Date().toISOString())
    .order('status_expires_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as PersonRow[]).filter((p) => p.status_text);
}
