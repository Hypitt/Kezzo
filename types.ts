export type Lang = 'en' | 'fr';

export interface PublicProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Profile extends PublicProfile {
  bio: string;
  generation: 'Gen Z' | 'Millennial' | 'Other' | null;
  status_text: string | null;
  status_expires_at: string | null;
  language: Lang;
  dm_policy: 'everyone' | 'followers' | 'nobody';
  created_at: string;
}

export interface Wallet {
  voting_coins: number;
  reward_coins: number;
  last_claim_month: string;
}

export type PostKind = 'text' | 'photo' | 'audio' | 'video';

export interface Post {
  id: string;
  author_id: string;
  kind: PostKind;
  title: string;
  body: string;
  media_bucket: 'media-public' | 'media-paid' | null;
  media_path: string | null;
  duration_seconds: number | null;
  download_price: number;
  created_at: string;
  author: PublicProfile;
  likes: number;
  comments: number;
  liked: boolean;
  unlocked: boolean;
}

export const BATTLE_CATEGORIES = [
  'roasting', 'dance', 'singing', 'debate', 'comedy', 'genz_vs_millennial', 'clout', 'custom',
] as const;
export type BattleCategory = (typeof BATTLE_CATEGORIES)[number];
export type BattleStatus = 'open' | 'live' | 'ended';

export interface Contender {
  user_id: string;
  score: number;
  joined_at: string;
  profile: PublicProfile;
}

export interface Battle {
  id: string;
  host_id: string;
  title: string;
  category: BattleCategory;
  custom_theme: string | null;
  mode: 'video' | 'audio';
  topic: string;
  total_rounds: number;
  current_round: number;
  max_contenders: number;
  entry_fee: number;
  prize_pool: number;
  status: BattleStatus;
  winner_id: string | null;
  created_at: string;
  host: PublicProfile;
  contenders: Contender[];
}

export interface ChatMessage {
  id: string;
  room_type: 'battle' | 'group';
  room_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: PublicProfile;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  tagline: string;
  category: string;
  member_count: number;
  created_at: string;
}

export interface AiVerdict {
  id: string;
  battle_id: string;
  winner_id: string | null;
  verdict: string;
  highlights: string[];
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  delta: number;
  balance_type: 'voting' | 'reward';
  reason: string;
  created_at: string;
}
