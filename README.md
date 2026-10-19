# Kezzo

Kezzo is a social platform where creators compete in **live battles** (roasts, dance, singing, debate, comedy), post photos / audio / video, join **groups**, chat, share files, and call each other. The audience votes with virtual coins. Everything is multi-user and stored in a real database.

> Coins are virtual points. They cannot be bought or cashed out.

## Features

- **Search & Feeds** is the default landing page (also right after login or sign-up). Search everyone's posts, battles and people; filter by *Everyone* or *Following*.
- **Sign in or sign up with Google or with email + password** (Supabase Auth), then a short onboarding (handle, display name, 16+ confirmation). Terms and Privacy open in a pop-up from every sign-in screen.
- **Posts**: text, photo, audio and video (video up to 30 minutes). Large files upload in resumable chunks with a progress bar, Cancel and Retry; photos are shrunk in the browser first. The file-size limit follows your Supabase plan (see *Upload limits* below). Likes, comments, edit, delete. Optional price in coins: paid files are stored in a private bucket and only owner and buyers can open them.
- **Live battles**: 2 to 5 competitors in **one shared video frame** that adapts to the number of people (video or audio), through **LiveKit**. Each competitor has a number and colour on their tile, score card and vote buttons.
  - Voting: **free like** (1 point, once per competitor per round), **2-coin vote** (2 points), **5-coin vote** (5 points).
  - Up to **3 public judges** picked by the host: each scores every competitor 0 to 10 with a comment (judges cannot compete or vote).
  - **Voting weights**: 100% public, or a custom public / judges split chosen before the battle. Public score, judges' score and final score are calculated by the database.
  - The host can **host only** or **compete**, **mute / unmute** competitors (enforced by the server), and run a **competition timer** that everyone sees in sync.
  - Payout: 20% to the host, 80% to competitors by final score. Realtime chat and an optional AI recap (Gemini).
- **Groups**: create (open or invite-only), roles (owner, admin, member), admins add members or share an invite link, members-only chat with **file sharing**, and **voice or video group calls**.
- **Status** can include a picture, shown for 24 hours.
- **Messages**: realtime direct messages, 1:1 calls, per-user message policy (everyone / followers / nobody).
- **Profiles**: edit profile, avatar, 24-hour status, follow / unfollow, block, report, wallet with history, monthly 100 coins. Sign out and Delete account sit at the bottom of Settings; deleting needs a typed confirmation.
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
             ├─ livekit-mute   : host mutes / unmutes a competitor (removes their microphone permission)
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
supabase/update-2.sql  Upgrade for an existing database: groups, judges, weights, likes, status pictures
supabase/update-3.sql  Go Live streams (solo and group), livestream chat, battle highlight clip
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
2. Open *SQL Editor → New query*, paste the whole of `supabase/schema.sql` and run it. Then run `supabase/update-2.sql` and `supabase/update-3.sql` the same way. All three are safe to run again. Run `update-3.sql` before deploying the matching code: battle pages ask for its new `highlight_post_id` column.
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

### 5. Upload limits (video size)

The app itself no longer fixes 50 MB. Large files are sent with resumable uploads, and the buckets allow up to 5 GB. The real limit is set by your **Supabase plan**:

- **Free plan**: Supabase refuses any single file over **50 MB**. Keep `VITE_MAX_UPLOAD_MB` at 50 (the default) so people get a clear message instead of a failed upload.
- **Pro plan or higher**: in Supabase open *Storage → Settings*, raise **Upload file size limit** (for example 2 GB), then set `VITE_MAX_UPLOAD_MB=2000` in Vercel and redeploy.

### 6. Environment variables

Fill in `.env.local` (see `.env.example`):

| Variable | Where used | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | anon key (safe, protected by RLS) |
| `SUPABASE_URL` | server | same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **secret**, bypasses RLS, never expose |
| `LIVEKIT_URL` | server | `wss://...` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | server | **secret** |
| `VITE_MAX_UPLOAD_MB` | browser | optional, biggest upload in MB (default 50, see below) |
| `GEMINI_API_KEY` | server | optional |

### 7. Run locally

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
| Camera or mic "in use" | Close other apps or tabs that use the camera, then press the camera button again |
| No sound in a live room | Press **Tap to turn on sound** (browsers block sound until you tap) |
| Upload fails on a big file | You are over the Supabase plan limit; see *Upload limits* |
| Votes or unlocks say "not authenticated" | Finish onboarding so your profile row exists |
| AI recap says not configured | Set `GEMINI_API_KEY` (optional feature) |

## License

MIT. See `LICENSE`.

## Performance notes

- Every page is a separate chunk (`React.lazy`); the video-call library (`livekit-client`) and the resumable-upload library (`tus-js-client`) load only when someone joins a room or uploads a big file.
- `vercel.json` caches hashed files in `/assets` for a year and icons for a week; `index.html` is always revalidated.
- Feed videos and audio use `preload="none"`, images are lazy and decoded off the main thread, photos are shrunk in the browser before upload, and the Google Fonts stylesheet no longer blocks the first paint.
- The Search page requests the first page of results once (it used to request it twice for signed-in users) and loads the "people you follow" list only on the Following tab.

## Go Live, recording and highlights

- **Go Live** (`#/live`): anyone signed in can start a solo or group livestream without a battle. In a group stream viewers request a spot and the host approves them; approval takes effect inside the running LiveKit room (`api/livekit-live.ts`), nobody has to reconnect. The host can remove a guest at any time and end the stream for everyone.
- **Recording** is optional and runs only in the host's browser (`src/lib/recorder.ts`). It draws the stage into a 960 px canvas at 20 fps, mixes everyone's audio, and saves 5-second pieces to IndexedDB, so it adds no load for viewers and survives a reload. When the battle ends the file downloads automatically, and stays available on the battle page until deleted. For server-side recording of every battle, LiveKit Egress is the alternative; it needs a storage bucket and paid minutes.
- **Highlight clip**: after the battle the host uploads a video of up to 90 seconds, or picks a recording. A longer video can be trimmed in the browser (the clip is re-recorded at normal speed, so 90 seconds takes about 90 seconds). "Suggest the best moment" picks the 90 seconds with the most coin votes, judge scores and chat. The clip appears on the ended battle and in the feed.
