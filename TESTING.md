# Manual test plan

Use two different Google accounts in two browser profiles (call them **A** and **B**). Run after every deploy.

## Authentication
1. A signs in with Google. Expected: onboarding appears; after submitting, the landing page is **Search & Feeds**.
2. Reload the page. Expected: still signed in, no redirect away from the current page.
3. Sign out and back in. Expected: Search & Feeds again; Home is still reachable in the navbar.
4. Try a taken handle with B. Expected: "handle is taken".

## Multi-user content
5. A creates a text post, a photo post, an audio post and a short video (under 90 s). B sees all four in Search & Feeds and Media.
6. B tries a video over 90 s. Expected: rejected with a clear message.
7. B likes and comments on A's post. A sees the counts. A deletes B's comment. B cannot edit or delete A's post (no buttons; direct API writes fail via RLS).
8. A edits their post title. B sees the change after reload.
9. A posts a **paid** photo (price 5). B sees it locked. B unlocks it: B's voting coins drop by 5, A's reward coins rise by 5, B can now open the file. B cannot unlock twice.
10. B follows A; the "Following" filter shows A's posts. B blocks A; A's posts disappear from B's feeds.

## Battles, camera and microphone
11. A creates a video battle (2 contenders, entry fee 0). B joins the stage.
12. A and B each click **Enter live room**, then turn on camera and mic (allow the browser prompts). Expected: each sees the other's video and hears audio; no echo of your own voice; speaking tile gets a ring.
13. Deny the permission once. Expected: a clear message, no crash. Allow it and retry.
14. Switch to another tab (e.g. Home) while the camera is on. Expected: the camera light turns off.
15. A starts the battle. B (or a third account C) votes 1, 5 and 10. Expected: scores and prize pool update live on all screens; voting for yourself is refused; votes cost coins.
16. Try voting with 0 coins. Expected: "not enough voting coins".
17. A removes B from the stage. Expected: B is disconnected and removed from the list.
18. A ends the battle. Expected: winner is the top-voted contender; rewards are paid once (a second click is impossible, status is ended).
19. (Needs `GEMINI_API_KEY`) A clicks **AI recap** while live. Expected: a recap appears for everyone; the winner is not decided by the AI.

## Chat, squads, messages
20. Chat in a battle from two accounts. Expected: messages appear in real time for both.
21. A creates a squad, B joins. Both chat; a non-member sees no chat. Squad call works for both.
22. A messages B. Expected: B gets it in real time with an unread count. Set B's policy to "Nobody": A can no longer send. Calls work in a DM.

## Wallet, profile, safety
23. New accounts start with 100 voting coins. The monthly claim button is hidden until a new UTC month.
24. Edit profile and avatar; set a 24-hour status. It shows on Home and the profile.
25. Report a post and a profile. Rows appear in the `reports` table (Supabase dashboard).
26. Delete account (type the handle). Expected: signed out; the profile, posts and files are gone.

## Security spot checks (browser dev tools or the Supabase API)
27. As A, try `update wallets set voting_coins = 9999` and `insert into battle_votes ...` via the client. Expected: both fail (no permission).
28. Without signing in, request `/api/livekit-token`. Expected: 401.
29. As B, request the storage URL of A's **paid** file without unlocking. Expected: denied.
