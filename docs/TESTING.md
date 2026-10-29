# Manual test plan

Use two different Google accounts in two browser profiles (call them **A** and **B**). Run after every deploy.

## Authentication
1. A signs in with Google. Expected: onboarding appears; after submitting, the first page is **Search & Feeds**.
2. Reload the page. Expected: still signed in, no redirect away from the current page.
3. Sign out and back in. Expected: Search & Feeds again; Home is still reachable in the navbar.
4. Try a taken handle with B. Expected: "handle is taken".

## Multi-user content
5. A creates a text post, a photo post, an audio post and a short video. B sees all four in Search & Feeds and Media.
6. B tries a file bigger than the limit shown under the file picker. Expected: rejected with a clear message. B uploads a video of about 40 MB: a progress bar fills, Cancel works, and turning the Wi-Fi off then on and pressing Retry continues instead of restarting.
7. B likes and comments on A's post. A sees the counts. A deletes B's comment. B cannot edit or delete A's post (no buttons; direct API writes fail via RLS).
8. A edits their post title. B sees the change after reload.
9. A posts a **paid** photo (price 5). B sees it locked. B unlocks it: B's voting coins drop by 5, A's reward coins rise by 5, B can now open the file. B cannot unlock twice.
10. B follows A; the "Following" filter shows A's posts. B blocks A; A's posts disappear from B's feeds.

## Battles, camera and microphone
11. A creates a video battle (2 contenders, entry fee 0). B joins the stage.
12. A and B each click **Enter live room**, then turn on camera and mic (allow the browser prompts). Expected: each sees the other's video and hears audio; no echo of your own voice; speaking tile gets a ring.
13. Deny the permission once. Expected: a clear message, no crash. Allow it and retry.
14. Switch to another tab (e.g. Home) while the camera is on. Expected: the camera light turns off.
15. A starts the battle. C (a third account) gives each competitor a free like, then a 2-coin and a 5-coin vote. Expected: the vote lands on the right numbered, coloured competitor; likes work once per competitor per round; coins are deducted; scores and prize pool update live on all screens; voting for yourself is refused.
16. Try voting with 0 coins. Expected: "not enough voting coins".
17. Create a battle with a 60% public / 40% judges split. Add 2 judges (accounts D, E). Judges score 0 to 10 with comments. Expected: judges cannot vote or join the stage; scores and comments appear for everyone; final score = 60% public share + 40% judges share.
18. Create a battle as **host only**. Expected: the host has no competitor tile (small host picture in the corner) and cannot join the stage. Create one with 5 competitors: all five fit in one frame.
19. A mutes B. Expected: B's microphone stops and B cannot switch it back on until A unmutes. A starts the competition timer: everyone sees the same countdown.
20. A removes B from the stage. Expected: B is disconnected and removed from the list.
21. A ends the battle. Expected: winner is the competitor with the top final score; rewards are paid once.
22. (Needs `GEMINI_API_KEY`) A clicks **AI recap** while live. Expected: a recap appears for everyone; the winner is not decided by the AI.

## Chat, groups, messages
23. Chat in a battle from two accounts. Expected: messages appear in real time for both.
24. A creates an open group, B joins. Both chat and share a photo, a PDF and a video; a non-member cannot open the files. A voice call and a video call work for both.
25. A creates an **invite-only** group. B cannot join from the list. A adds B by search, or sends the invite link: B opens it (even after signing in with Google) and lands in the group. A makes B admin; B can add members but cannot make admins. A removes B.
26. A messages B. Expected: B gets it in real time with an unread count. Set B's policy to "Nobody": A can no longer send. Calls work in a DM.

## Wallet, profile, safety
27. New accounts start with 100 voting coins. The monthly claim button is hidden until a new UTC month.
28. Edit profile and avatar; set a 24-hour status **with a picture**. It shows on Home (tap to enlarge) and on the profile.
29. Report a post and a profile. Rows appear in the `reports` table (Supabase dashboard).
30. Sign out and Delete account appear only at the very bottom of your own profile page, below everything else (not on other pages). Delete shows a confirmation pop-up that needs the handle typed. Expected: signed out; the profile, posts and files are gone.
31. On the sign-in and sign-up screens and on profile setup, the Terms and Privacy links open a pop-up and keep the form.

## Security spot checks (browser dev tools or the Supabase API)
32. As A, try `update wallets set voting_coins = 9999` and `insert into battle_votes ...` via the client. Expected: both fail (no permission).
33. Without signing in, request `/api/livekit-token`. Expected: 401.
34. As B, request the storage URL of A's **paid** file without unlocking. Expected: denied.

## Go Live, feed video, recording, highlights
35. On **Go Live**, start a **Solo** video stream as A. B opens it from the list, enters the room and sees A. Both can chat. A ends the stream: B sees "ended".
36. A starts a **Group** stream (2 guests). B requests a spot; A approves. Expected: B can turn on the camera without reloading. A removes B: B's camera stops and B is a viewer again. With 2 guests approved, a third approval is refused ("stage is full").
37. Home: with no live battle there is no "Live now" heading or box at all. Start a battle: the section appears.
38. Scroll a feed that has videos. Expected: a video plays (muted) when most of it is on screen and pauses when it leaves. Press Pause: it stays paused while scrolling. Play/Pause and the sound button are always visible.
39. As host, tick **Record this battle on my device**, start the battle, run it for a minute, then end it. Expected: a file downloads by itself, and a **Battle recording** card lets you download it again. Reload the page: it is still there.
40. On the ended battle, upload a 30-second video as the highlight and post it. Expected: it plays under "Highlight" for everyone. Then upload a 3-minute video: it asks you to trim; "Suggest the best moment" moves the slider; "Create 90-second clip" shows progress and a preview; post it.

## Admin statistics
41. Run `update-4.sql`, then add yourself to `admins` (see README). Sign in: an **Admin** button appears on your own profile page, next to Sign out. A second, normal account does not see it, and opening `#/admin` as that account shows "administrators only".
42. In a private window open the site and click through Search, Battles and a battle. Back in `#/admin`, press Refresh: visitors, page views and "Active in last 30 min" increase, and Top pages lists `/battles/:id` (never a real id).
43. Sign out and sign in again: Sign-ins goes up by one and the method (Google or email) is shown.
44. Turn on Do Not Track (or Global Privacy Control) in the browser, browse around: the counts do not change.
45. Switch 7 / 30 / 90 days and the Table view; hover the charts to see the tooltip. Check the page on a phone width.

## Notifications
46. Run `update-5.sql`. With accounts A and B: B likes A's post. A sees a pop-up and the bell shows 1. Open the bell: "B liked your post"; click it and the counter drops.
47. B follows A, then sends A three messages. A gets one "B sent you 3 messages" notification (not three). A opens the conversation: that notification disappears.
48. A follows B. B starts a Go Live stream (and later a battle that goes live): A gets "B is live now" and clicking opens it. A person who blocked B gets nothing.
49. Liking your own post, or unlike/like again, creates no extra notification. "Mark all as read" clears the counter. On a phone width the list opens full width under the top bar.

## Email notifications for messages
50. Run `update-6.sql`, add `RESEND_API_KEY` and `EMAIL_FROM` in Vercel and redeploy. A messages B (B's email is a real inbox): B gets "You have a new message on Kezzo" within a minute. The email has no sender name and no message text. A sends a second message right away: no second email.
51. A group with A, B, C: A writes in the group chat. B and C each get the same generic email (not A). A does not get one. A writes again right away: no new emails.
52. B unticks "Email me about new direct and group messages" in profile settings: no more emails to B. Re-tick it: emails work again.
53. In an email, click "Stop these emails": a page asks for confirmation; press the button and the profile checkbox is now unticked. A changed or truncated link shows "Invalid link". If B blocked A, B gets no email. If `RESEND_API_KEY` is missing, sending messages still works normally.

## Landing page and login required
54. Run `update-7.sql`. In a private window open the site address: the black-and-white landing page appears (hero, how it works, features, Sign up / Log in). On a phone width everything stacks and nothing scrolls sideways. EN/FR switch works.
55. Click **Sign up**: the dialog opens on the sign-up tab. Click **Log in**: it opens on the sign-in tab. After signing in you land on **Search & Feeds**.
56. Signed out, type `#/battles`, `#/profile/<id>`, `#/live`, `#/media`, `#/groups` or `#/messages` after the address: you still see the landing page. Terms and Privacy (footer links) open without logging in. Open a group invite link signed out: the sign-up dialog appears, and after signing up you join the group.
57. Sign out from your profile page: you return to the landing page. Signed-in people never see the landing page.

## Landing page: groups and live counter
58. Run `update-8.sql`. As the owner of an open group, open the group's admin tools and tick **Show this group on Kezzo's public home page**. In a private window the landing page now shows a **Groups you can join** section with that group (name, category, member count). Untick it: the section disappears (when it was the only one).
59. Click **Sign up to join** on the group card, create an account: after onboarding you land on that group's page. Switch the group to *Invite only*: the checkbox becomes disabled and the group disappears from the landing page.
60. A member who is not an admin of the group does not see the checkbox. While a battle is live, a small "1 battle live right now" pill appears above the headline; with no live battle there is no pill.

## Photos, profile grid, landing visuals
61. Run `update-9.sql`. In Create → Post → Photo, pick several photos (also add more in a second pick): thumbnails show with numbers and an X to remove each; the counter says "n of 10 photos". An 11th photo is refused with a message.
62. Publish. In the feed the post shows the first photo with a "1/4" badge and dots; swipe left/right on a phone (arrows on desktop, ←/→ keys) to see the others. A single-photo post looks as before.
63. Publish a paid multi-photo post: another account sees the lock; after unlocking, all photos swipe. Deleting the post removes every photo from storage.
64. Open a profile: posts appear three per row. A multi-photo tile has a small gallery icon, a video tile a play icon, a locked paid post a padlock. Click a tile: the full post opens in a window (Esc or the X closes it); like, comment, edit and delete work there.
65. Landing page: the line "Live battles · Live streams · Groups" is gone. The top card has a dark background; with `public/landing/hero.mp4` present the video plays muted behind white text; without it the card stays dark. With "reduce motion" on, the video does not load. The "Live battles that anyone can join" box shows faces (drawn ones, or photos if `battle-1.jpg`… exist).
66. Landing: the top card has no Sign up / Log in buttons (they stay in the header and the bottom band); the "Available now / Coming soon" boxes are gone. The hero video (`hero.mp4`, ~0.5 MB) plays muted behind the text; the Solo and Group cards play small clips only while visible. With reduce-motion or Data Saver on, only still pictures load.

## Sharing to other platforms
67. On a post, a profile, a battle page and a live page, press **Share**. A window lists WhatsApp, Facebook, X, TikTok, Instagram and Copy link (plus "More apps…" on phones). Esc or the X closes it.
68. WhatsApp, Facebook and X open their own share page with the text "“Title” on Kezzo" and a link like `https://your-site/s/post/<id>`. Copy link puts that link in the clipboard.
69. TikTok and Instagram: the text and link are copied and the app/site opens; paste it in a post, story or bio.
70. Open a shared link in a private window: you land on the Kezzo landing page; after logging in you are taken to that post (`#/post/<id>`), profile, battle, live or group. Pasting the link in WhatsApp/Facebook/X shows "Title · Kezzo" as text, with the post's photo for free photo posts; no logo is added to links and paid posts never show their media.
71. On a free photo or video post press **Share → Prepare**. The picture(s) or video come back with a small Kezzo logo + name in the bottom-right corner. Photos take a second; a video is re-recorded in real time (a progress bar shows; Cancel works; videos over 3 minutes are refused with a message).
72. After preparing, **Share to apps** (phones/Safari/Chrome on Android) opens the phone's share sheet with the file attached: pick TikTok, Instagram, WhatsApp, etc. **Download** saves the file(s) and copies the caption + link. Paid posts of other people show no watermark option.

## Language, events and polls
73. Open Kezzo in a browser set to French (or with French first in its language list): the whole app is in French. Any other language: English. Press EN/FR in the header: everything switches at once, without reloading. Reload and reopen the site later: your choice is kept. Posts, comments, messages and group names stay in the language they were written in.
74. Run `update-10.sql`. Create → **Event**: fill title, start date/time, place and/or an https online link, optional cover photo. After publishing you land on **Events & polls** (new tab) with the event on top. Another account can press **I'm going** (count goes up, press again to undo), **Join online**, **Share**. Only the host sees **Delete**.
75. Create → **Poll**: question, 2 to 6 answers, closing time. Another account votes: results (percent and count) appear after voting; they can change their vote while the poll is open. After the closing time the poll shows Closed and voting is refused.
76. In a live stream you host: below the video, **Add a poll**. Viewers vote inside the live page and results refresh every few seconds; the poll closes when the live ends. Other users do not see the Add button.
77. A shared event/poll link (`/s/event/<id>`, `/s/poll/<id>`) opens Events & polls with that item first.

## Notifications that clear themselves, and following
78. Run `update-11.sql`. Account A follows account B. B publishes a post: A's bell shows "B shared a new post". B publishes two more in a row: it becomes one line "B shared 3 new posts". Same for an event ("is promoting a new event") and a standalone poll. Clicking one opens it (a single post, the event/poll, or B's profile).
79. Click a notification: it disappears from the list and the counter drops. Open the bell and close it again without clicking: everything that was shown is gone. "Mark all as read" empties the list.
80. Open a conversation: its message notification disappears. Notifications older than 30 days are removed automatically (when the app loads and occasionally on the server).

## Fewer e-mails, at most 10 notifications
81. Run `update-12.sql`. Only direct and group messages send an e-mail (generic, at most one per 30 minutes per conversation or group, with opt-out in Settings: "Email me about new direct and group messages"). Likes, follows, posts, events, polls, lives and battles never send e-mail.
82. A new message in a group you belong to shows one in-app line "X wrote in your group" (with a counter if several). Opening that group removes it.
83. Create more than 10 notifications for one account (for example 12 likes): the bell never shows more than 10; the oldest are deleted automatically.

## Saving Supabase bandwidth (free plan)
84. Upload a profile photo from a phone (several MB): it is stored at about 256 px (tens of KB). Upload a multi-photo post: photos are stored at 1600 px max; the first photo also gets a preview file `<name>-t.jpg` in the `media-public` bucket.
85. Profile grids load the small previews (older posts fall back to the full photo); video tiles are plain dark squares with a play icon and download nothing.
86. A video in the feed shows a Play button and downloads nothing until it is pressed (to bring back autoplay, set `AUTOPLAY = true` in `src/components/FeedVideo.tsx`). Photos inside a post load lazily, one by one.
87. In the browser's network tab, reopening a page shows photos coming from the cache ("disk cache"): new uploads are kept for a year.
88. Optional one-off for photos already stored: `npm install --no-save sharp`, then `node --env-file=.env.local scripts/shrink-storage.mjs` (dry run) and with `--apply`.

## Calls and live video: "Invalid or expired session"
89. Open `https://your-site/api/health`. `supabase_server_works` must be `true` and `supabase_hosts_match` must be `true`. If it says `no: ...` the server key in Vercel (`SUPABASE_SERVICE_ROLE_KEY`) is wrong for this project; if the hosts differ, `SUPABASE_URL` in Vercel points to another Supabase project. Fix the variable, then Redeploy (changes only apply to a new deployment). Then Rejoin a call: it connects and asks for camera/microphone.


## Ringing calls (run supabase/update-13.sql first)
90. Two accounts (A and B) on two browsers. A opens the conversation with B and presses Voice call or Video call: A connects straight away (no extra Join click) and B sees a dark "Incoming call" card at the top of the screen with the caller's photo, a ringtone (after B has clicked anywhere on the page once) and Accept / Decline. The tab title blinks "Incoming call".
91. B presses Accept: B lands on the conversation with A and joins the call automatically; the ringing stops on every B device. A and B see and hear each other.
92. B presses Decline: A sees "B declined the call." and A's call screen closes by itself. In a group, the call closes only when every member who was rung has declined.
93. A presses Hide before B answers: B's incoming card disappears. If nobody answers, the card disappears after 45 seconds.
94. In a group, a member presses Voice or Video call: every other member who is online gets the incoming card ("... is starting a video call in <group>"); Accept opens the group page with the call joined. Groups with more than 50 members do not ring (members still see the Join the call button).
95. A blocked user cannot ring you; someone who is not allowed to message you cannot ring you.
96. Ringing only works while Kezzo is open in a browser tab (it also shows a browser banner if the tab is in the background and notifications were allowed). It cannot ring a phone whose browser is closed: that needs push notifications.
97. Stale login: sign in on a browser, then in Supabase delete that user's session (or sign out everywhere elsewhere). Press Join on a call: the app signs out, shows "Your session expired. Please sign in again." and the sign-in screen opens.

## Install as an app, landing page
98. The landing hero has no battle card any more (Maya / Jo): only the title, the text and the community video.
99. On the landing page header there is an "Install app" button (icon only on small screens). In Chrome or Edge, pressing it opens the browser's install window; after installing, Kezzo opens in its own window and the button disappears (also when opened from the installed icon).
100. Signed in: the same button sits in the top bar just left of your profile picture.
101. On an iPhone/iPad (Safari) or in Firefox, pressing it shows a short how-to (Share, then Add to Home Screen). French users get the French text.
102. `https://your-site/manifest.webmanifest` and `https://your-site/sw.js` open without error. The service worker caches nothing, so new versions always show.

## Stale tabs, call reliability, hero text
103. Leave Kezzo open in a tab, deploy a new version, then click to a page you had not opened yet (for example Profile): the page reloads once by itself and works. The "Failed to fetch dynamically imported module" error no longer appears in Admin → Performance and errors for normal users.
104. Start a group call (or a battle), switch to another tab for a couple of minutes (or let the login refresh), then come back: the call is still connected and the page did not reload.
105. During a call, turn Wi-Fi off for about 10 seconds and on again: the call shows "Connection lost. Reconnecting…" and comes back by itself. If you stay offline for about a minute, the Rejoin button appears; coming back online reconnects automatically.
106. The landing hero shows "Get to know the world through its people." with the new paragraph and the line "Share your culture. Discover the world. Connect beyond borders." In French the hero is in French.

## Floating call window
107. Start a voice or video call in a direct message or a group (or accept an incoming call): the call opens in a small window at the bottom right (above the bottom menu on a phone). Open other pages (Search, Profile, Messages with someone else, scroll the feed): the call keeps running with sound and the window stays.
108. The window's minimize button hides the pictures but the call and the sound continue; the red phone button (or Leave) ends the call for you. Pressing "End call" in the conversation or group does the same.
109. The conversation/group page shows "Call in progress…" instead of the call; signing out ends the call. Starting another call replaces the running one.

## Ending battles and live streams nobody joined (run supabase/update-14.sql)
110. As host, create a battle and leave it with nobody (or one person) in it. In Battles (and Search/Home), your own card shows a button "Cancel battle" (not started) or "End and pay out" (running). Press it and confirm: the card disappears, entry fees (if any) are refunded.
111. As host, go live (solo or group) and leave nobody in it. In Live, your own stream card has an "End livestream" button. It ends the stream for everyone and the card disappears.
112. Other people's cards never show these buttons. Inside the battle/live page, the host's End buttons still work as before.
113. A battle that was never started and has fewer than 2 competitors is cancelled automatically after 12 hours (fees refunded); a live stream still marked live after 12 hours is ended automatically. This runs when someone opens the Battles or Live list.

## Cancel battle fix (run supabase/update-15.sql) and new hero photo
114. As host, create a battle, leave it with 0 or 1 competitors and press "Cancel battle": it is cancelled and entry fees are refunded (before update-15 it could show "That is not possible in this battle's current state" if schema.sql had been run again after update-2).
115. The landing hero shows the group selfie on the right, fading into the warm card (on phones: below the text, fading at its top edge).
116. (After R2 is set up) Post a photo, a video, change your avatar, post a status picture: each shows, and the address of the picture starts with your pub-….r2.dev link. Delete the post: the file disappears from R2 (Cloudflare > R2 > kezzo-media). Old posts still show.
117. (Admin, R2 on) Admin page > Move old files to R2 > Move old videos: the counter goes down, old videos still play, and the files appear in the R2 bucket with r- names.
118. (R2 on) Scroll the feed: videos stored in R2 (new ones and moved old ones) start by themselves, muted, when mostly on screen, and pause when you scroll away; only one plays at a time. Pausing by hand keeps it paused. Videos still in Supabase show a Play button.
119. Landing page: under the hero text there are two buttons, Download Kezzo (opens the install window or how-to) and Sign in (opens sign in). Download is hidden once Kezzo is installed.
120. Feed videos autoplay WITH sound once you have tapped/clicked anywhere on Kezzo (browser rule); if the browser blocks it the video plays muted. Pressing the sound button mutes/unmutes every feed video from then on.
121. Profile grid: videos stored in R2 show a real frame from the video with a small Play circle on top; videos still in Supabase show a dark tile with Play.
122. (Run update-16.sql first) Language menu in the top bar (and on the landing page) lists English, Français, Español, Português, हिन्दी. Pick each: the whole app and the landing page change language, the choice is remembered after a reload, and for a signed-in person it is saved on their profile (no error after reload).
123. In a private window with the browser language set to Spanish, Portuguese or Hindi, the landing page opens in that language. With any other browser language it opens in English.
124. Hindi text shows properly (no empty boxes) on phone and computer. Terms and Privacy pages, the Admin page and emails stay in English or French for now.
125. (Run update-17.sql first) Signed out, the landing page shows a "From the community" wall of public photos and videos under the hero lines, in a different random order on each reload. Videos stored in R2 play muted while on screen; Supabase ones show a dark tile.
126. Signed out, tap the heart on a tile: it turns red and the count goes up by one; reload and it is still red; tap again to undo. Tap the comment bubble or "Log in to comment": the sign-in window opens. Comments themselves cannot be read or written without an account.
127. Sign up or sign in on the same browser: the hearts you gave as a visitor now appear as your real likes on those posts (and the guest likes are gone).
128. Profile: untick "Show my public photos and videos on Kezzo's home page": your media no longer appears on the landing wall.
129. After the first sign-in on a phone or in Chrome/Edge (not yet installed), a small card offers to install Kezzo once; Install opens the browser install window, Not now hides it for good. Nothing installs without the tap (browsers do not allow it).
130. Landing: tiles with 0 comments show no comment button; the note under the wall reads 'Log in to see more or to add yours.'; the hero shows 'Do you have any talent? Share it with the world and let it be seen.' under the tagline (in all five languages).
131. Home, Search (posts) and Media show posts in a random order that changes on every visit; pressing Load more continues the same order with no repeats or gaps. Filters (photo/video/audio, free/paid, search words, blocked users) still apply. Profile pages and a single post stay newest first.
132. If update-18.sql has not been run yet, those pages still work and simply show newest first.
133. Contest (after update-19.sql): as an admin open #/contest, fill title, prize, rules, start and end and save. A banner appears on the landing page, Home and Search for everyone; visitors who press it get the sign-up window and land on the contest page after signing in.
134. Signed in, press Enter on one of your own free public photos or videos: it appears in the ranking. Entering a second time, a paid post, a text post, or after the end date is refused with a clear message.
135. Another account likes and comments on the entry: Score = people who liked + people who commented (never the author, never visitor likes). The ranking updates on Refresh and every minute.
136. After the end date the page shows the winner (highest score; ties go to the earlier entry). Admins can press Remove on an entry to disqualify it.
137. Contest (after update-20.sql): press "Upload a new photo or video" on the contest page: the form only offers Photo and Video, has no price, and after publishing the post is entered automatically and the contest page opens. "Or choose one you already posted" lists your own free public photos and videos.
138. Your entry card: edit title and description, Share, Open, Withdraw from the contest (then enter another), Delete the post (it also leaves the contest). Withdraw, edit and delete are for while the contest is open.
139. Admin on the contest page: entry count, likes and commenters; +1 day, +7 days, End now; the list of all entries with Remove and Restore; Delete this contest.
140. Contest page, "Watch and vote" (default tab): every entry appears as a full post (video plays, like button, comments), in a random order that changes on each visit, six at a time with "Show more". Each shows its rank and score. The "Ranking" tab shows the compact leaderboard.
141. A post that is in the running contest shows an orange "Contest entry · #rank" label next to its author everywhere it appears (Home, Search, Media, profile, single post); pressing it opens the contest page. After the end the first place reads "Contest winner".
142. On the contest page every entry sits in an orange frame with its rank, likes, commenters and score above it and "Vote: tap the heart…" below it; the top card shows entries and time left ("Last hours!" under 6 hours).
143. Contest (after update-21.sql): you cannot choose an old post. The page only offers "Upload a new photo or video"; the post is entered automatically. Only uploads made after the contest start can be entered (an older post is refused). If an upload was made but not entered (for example a network drop), it appears under "Finish entering your new upload".
144. Landing page: while a contest is open a Contest section shows the title, theme, prize, time left, entries, "How it works" (3 steps) and up to 4 entries with likes and commenters; "Sign up to enter" opens sign-up and then the contest page. It disappears after the contest ends.
145. The contest section (landing page, Home and Search) has no entry thumbnails. It shows title, prize, time left, "How it works", two boxes ("Want to compete?" and "Want to vote?") and a button: "Sign in to enter or vote" for visitors, "Enter or vote" for signed-in members (opens the contest page).
146. AI translation (after update-22.sql and the CF_AI_TOKEN setting): switch the app to Español, open a post written in English: the title and text appear in Spanish with "Traducido del English · Ver original" under them. "Ver original" shows the original; "Dejar de traducir automáticamente" turns automatic translation off on this device, and a "Traducir" link then appears instead.
147. Comments in another language are translated the same way (one note under the list).
148. Upload a free video with speech: after publishing, wait a short moment; the video shows a CC button and a headphones button. CC shows subtitles in your language; the headphones button mutes the video and reads the translation aloud. Audio posts show the same buttons under the player.
149. An older own video or audio post shows "Add subtitles"; pressing it creates them. Paid media never gets subtitles. A post in the viewer's own language shows no translation note.
150. Without the Cloudflare key, nothing breaks: texts simply stay in their original language and no CC button appears.
151. Opportunities (after update-23.sql): the menu has an Opportunities item. "Share an opportunity" opens a form; a post needs a title and either a country or "Online". A link must start with https://. Posting a sixth one in a day is refused with a clear message.
152. Save your country and city under "Your place". With "Near me" the posts in your city come first, then your country, then online posts. "Online" shows only online posts, "Everywhere" shows all. Type chips and the search box narrow the list.
153. A post with a deadline in the past is not listed; one closing within 7 days shows "Closing soon".
154. On your own post: Edit, Delete (asks first), Share. On someone else's: Share and Report. The Share link opens that opportunity first.
155. As an admin: each post has a Hide button; hidden posts disappear for everyone and are listed at the bottom (admins only) with Show again.
156. Posts written in another language are translated into the viewer's language (needs the AI translation setup), with "Show original".
157. Admin page > Home page sections (after update-24.sql): untick "Community photos and videos" and "Latest posts", press Save. A visitor's landing page no longer shows the photo wall, and Home no longer shows Latest posts (a reload may be needed on a device that already loaded the page). Tick them again to bring them back.
158. A non-admin cannot change the choice (the save is refused). With nothing saved, every section shows.

