# Kezzo

Kezzo is a social platform where creators compete in **live battles** (roasts, dance, singing, debate, comedy), post photos / audio / video, join **squads**, chat, and call each other. The audience votes with virtual coins. Everything is multi-user and stored in a real database.

> Coins are virtual points. They cannot be bought or cashed out.

## Features

- **Search & Feeds** is the default landing page (also right after login or sign-up). Search everyone's posts, battles and people; filter by *Everyone* or *Following*.
- **Google sign-in** (Supabase Auth), then a short onboarding (handle, display name, 16+ confirmation, Terms and Privacy).
- **Posts**: text, photo, audio and video (video up to 90 s, files up to 50 MB). Likes, comments, edit, delete. Optional price in coins: paid files are stored in a private bucket and only owner and buyers can open them.
- **Live battles**: 2 to 5 contenders, video or audio, real-time audio/video through **LiveKit**, live votes (1 / 5 / 10 coins), host controls (start, next round, remove contender, end and pay out), realtime chat, and an optional AI recap (Gemini) based on votes and chat.
- **Squads**: create or join, members-only chat, group calls.
- **Messages**: realtime direct messages, 1:1 calls, per-user message policy (everyone / followers / nobody).
- **Profiles**: edit profile, avatar, 24-hour status, follow / unfollow, block, report, wallet with history, monthly 100 coins, full account deletion.
- **English and French** UI, plus Terms and Privacy pages.
- **Safety**: Report buttons (stored in a `reports` table), blocking, content length limits, row-level security everywhere.

## Tech stack

| Area | Technology |
| --- | --- |
| Front end | React 19, TypeScript, Vite, Tailwind CSS 4, lucide-react |
| Database, auth, storage, realtime | Supabase (PostgreSQL + RLS, Google OAuth, Storage, Realtime) |
| Live audio / video | LiveKit (`livekit-client` in the browser, `livekit-server-sdk` for tokens) |
| Server functions | Vercel serverless functions in `/api` (the same handlers run in Express for local dev) |
| AI recap | Google Gemini (`@google/genai`), optional |
| Hosting / version control | Vercel / GitHub |

## How it works

```
Browser (React) ──► Supabase (auth, Postgres + RLS, storage, realtime)
      │
      └──► /api/*  (Vercel functions, hold the secrets)
             ├─ livekit-token  : checks who you are and what you may do, then signs a LiveKit token
             ├─ livekit-kick   : host removes a contender
             └─ ai-judge       : host asks Gemini for a recap
```

- The browser only ever holds the **anon key**, which is safe because RLS protects every table.
- Coins, battles, votes and unlocks change **only** through `SECURITY DEFINER` SQL functions (`cast_vote`, `end_battle`, `unlock_post`, ...). Clients cannot write to those tables or edit their own balance.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY`) exist only on the server.

## Project structure

```
api/                 Vercel serverless functions (+ _lib/server.ts shared helpers)
scripts/dev-server.ts  Local dev server (Express + Vite) and self-hosted production server
supabase/schema.sql  Whole database: tables, RLS, functions, storage buckets, realtime
src/
  state/             Auth, i18n, toast and router providers
  lib/               Supabase client, data loaders, translations, helpers
  components/        Navbar, PostCard, ChatPanel, LiveRoom (LiveKit), ...
  views/             Search, Home, Battles, BattleRoom, Create, Media, Groups, Messages, Profile, Legal
docs/TESTING.md      Manual test plan (two accounts)
```

## Prerequisites

- Node.js 20.19+ (22 recommended) and npm
- A [Supabase](https://supabase.com) project
- A [LiveKit Cloud](https://livekit.io) project (free tier is fine)
- A Google Cloud project for OAuth credentials
- A [Vercel](https://vercel.com) account and a GitHub account
- Optional: a [Gemini API key](https://aistudio.google.com/apikey) for the AI recap

## Setup

### 1. Get the code and install

```bash
git clone https://github.com/YOUR-USER/kezzo.git
cd kezzo
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a project. Copy **Project URL**, **anon key** and **service_role key** from *Project Settings → API*.
2. Open *SQL Editor → New query*, paste the whole of `supabase/schema.sql` and run it. It is safe to run again.
3. *Authentication → Providers → Google*: enable it and paste your Google client ID and secret (step 3 below).
4. *Authentication → URL Configuration*:
   - **Site URL**: your production URL (e.g. `https://kezzo.vercel.app`)
   - **Redirect URLs**: add `http://localhost:3000/**` and `https://YOUR-DOMAIN/**` (add your Vercel preview URL pattern too if you use previews).
5. *Project Settings → API → Realtime*: nothing to change; the schema adds the needed tables to the realtime publication.

### 3. Google OAuth

1. In Google Cloud Console → *APIs & Services → OAuth consent screen*: configure the app (name, support email).
2. *Credentials → Create credentials → OAuth client ID → Web application*.
3. **Authorized redirect URI**: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (shown in the Supabase Google provider page).
4. Copy the client ID and secret into Supabase (step 2.3).

### 4. LiveKit

1. Create a project at LiveKit Cloud.
2. Copy the **WebSocket URL** (`wss://...livekit.cloud`), **API key** and **API secret** from *Settings → Keys*.

### 5. Environment variables

Fill in `.env.local` (see `.env.example`):

| Variable | Where used | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | anon key (safe, protected by RLS) |
| `VITE_CONTACT_EMAIL` | browser | shown in Terms / Privacy |
| `SUPABASE_URL` | server | same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **secret**, bypasses RLS, never expose |
| `LIVEKIT_URL` | server | `wss://...` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | server | **secret** |
| `GEMINI_API_KEY` | server | optional |

### 6. Run locally

```bash
npm run dev      # http://localhost:3000 (Vite + the /api functions)
npm run lint     # TypeScript checks
npm run build    # production build into dist/
```

Camera and microphone need HTTPS, except on `localhost`, where they work.

## Deploy to Vercel

1. Push the repo to GitHub (below).
2. In Vercel: **Add New → Project**, import the repo. Framework preset **Vite** (detected from `vercel.json`).
3. *Settings → Environment Variables*: add every variable from the table above for **Production** (and Preview if wanted).
4. Deploy. Then set the production URL as Supabase **Site URL** and add it to the **Redirect URLs** (step 2.4).
5. Check `https://YOUR-DOMAIN/api/health`: it should report `supabase`, `livekit` (and `gemini`) as `true`.

Self-hosting instead of Vercel: `npm run build && npm run start` serves `dist/` and the API on `PORT` (default 3000).

## Upload to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USER/kezzo.git
git push -u origin main
```

Before pushing, run `git status` and confirm **no `.env` or `.env.local` file is listed** (they are in `.gitignore`). Only `.env.example` (placeholders) is committed. After your first `npm install`, commit `package-lock.json` too. A CI workflow (`.github/workflows/ci.yml`) runs lint and build on every push.

## Security notes

- Never commit real keys. If a secret ever leaks, rotate it in Supabase / LiveKit / Google immediately.
- RLS is enabled on every table; see `supabase/schema.sql` for each policy.
- Paid media lives in the private `media-paid` bucket; storage policies allow only the owner and users who unlocked the post.
- The keyword filter in `src/lib/moderation.ts` is minimal and bypassable. The real tools are Report and Block. Reports land in the `reports` table: review them in the Supabase dashboard, and have a moderation process before a public launch.
- Hardening ideas for production: a Content-Security-Policy header, rate limiting on `/api/*` (for example Vercel Firewall), CAPTCHA on sign-up, and an admin view for reports.
- The Terms and Privacy text is a template. Have a lawyer review it, especially for GDPR / Quebec Law 25 and for any plan to make coins redeemable for money (that would change legal requirements, including gambling rules).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Kezzo is not configured yet" screen | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, restart `npm run dev` |
| Google sign-in returns to the site but you are not signed in | Check the Redirect URLs in Supabase and the Google redirect URI |
| "Enter live room" says LiveKit is not configured | Set the three `LIVEKIT_*` server variables |
| Camera / mic blocked | Allow access in the browser's site settings; HTTPS is required outside localhost |
| Votes or unlocks say "not authenticated" | Finish onboarding so your profile row exists |
| AI recap says not configured | Set `GEMINI_API_KEY` (optional feature) |

## License

MIT. See `LICENSE`.
