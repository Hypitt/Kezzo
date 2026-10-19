# Manual test plan

Use two different Google accounts in two browser profiles (call them **A** and **B**). Run after every deploy.

## Authentication
1. A signs in with Google. Expected: onboarding appears; after submitting, the landing page is **Search & Feeds**.
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
30. In Settings, Sign out and Delete account are at the bottom. Delete shows a confirmation pop-up that needs the handle typed. Expected: signed out; the profile, posts and files are gone.
31. On the sign-in and sign-up screens and on profile setup, the Terms and Privacy links open a pop-up and keep the form.

## Security spot checks (browser dev tools or the Supabase API)
32. As A, try `update wallets set voting_coins = 9999` and `insert into battle_votes ...` via the client. Expected: both fail (no permission).
33. Without signing in, request `/api/livekit-token`. Expected: 401.
34. As B, request the storage URL of A's **paid** file without unlocking. Expected: denied.
