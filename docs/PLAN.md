# NeighBoxed — the plan, from side project to a real business

The game rules (houses, earning, worlds, couples) live in [`DESIGN.md`](DESIGN.md). This file is the **what is left, in what order, and why**: the full player journey, the look, the performance rules, and the business. Every item has a "done when" so nothing is half-built again (like a playground with no way to reach it).

## Status (2026-10-24, evening)

| Phase | State |
|---|---|
| 1. Fix the loop | **Done.** Active-time earning, the 2 m back path, signpost and playground view, the playground out of the house shadow and lit, honest guide and README. |
| 2. UI system | **Done.** One language for the HUD and every panel (night glass, hairline rules, Josefin Sans and Oswald), a Firewatch-style title screen, minigame screens like the reference score screen. |
| 3. Accounts & cloud save | **Done.** Magic-link sign-in, `start_player`, your home saved to your account, guest home carried over (only what the account owns). Needs the Auth URL settings below before sign-in links work. |
| 4. Friends & worlds | **Done.** Tags, requests, remove, block, report; worlds, invite links and codes, join, leave, remove (creator), the fund and slots, delete account. |
| 5. Together live | **Done:** presence, movement, chat with bubbles, emotes, visiting homes. **Left:** sitting together and the joint hug animation. |
| 6. Server economy | **Done.** Buying, the daily gift, quests, minigame pay, visits and active-time earning (with the friends and partner multipliers) are server functions with daily caps. |
| 7. Games & quests | **Started:** Star catch is a 3D side-view game (Starfall Bridge); daily quests. **Left:** the couple quiz and the arcade (both two-player, live), levels. |
| 8–10 | Not started: landing page, privacy policy and terms, analytics and crash reports, moderation queue view, hosting (Vercel), apps (Capacitor), payments. |

Also done beyond the plan: walk freely between homes and through small things (only fences, walls and neighbours' gardens stop you), a 3 m gap between plots, and the street the same on every screen.

**To switch sign-in on** (Supabase dashboard → Authentication → URL Configuration): set *Site URL* to the address the game is played at (`http://localhost:5173` while testing, the real domain later) and add the same address to *Redirect URLs*. Without it the sign-in email's link lands on the wrong page.

The sections below are the original plan.


---

## 1. The player journey, end to end

Each step lists what the player does, what they see, and what must exist for it to work.

### 1.1 Finding the game
- Lands on **neighboxed.com**: one dreamy hero shot of a lit house on the cliff at night, one line ("A little home for you and your people"), one button: **Play free**. No sign-up wall before the first look.
- Arrives through an **invite link** (`neighboxed.com/i/AB12CD`): the page says *"Mochi invited you to Moonlit Cove"* with Mochi's cube and house, then **Join**.
- Done when: the landing page, invite page and share previews (Open Graph image per world) work on phone and desktop.

### 1.2 First minute (no account yet)
- Plays straight away as a **guest**: their own starter home, the welcome guide (4 short cards), a first quest ("Turn on your lamp", "Walk to the cliff", "Place something").
- After the first quest, a soft prompt: **Save your home** (email magic link, or Google/Apple). The guest save moves into the account; nothing is lost.
- Picks a **name** (unique tag like `Sera#2841`) and a **cube colour**.
- Done when: guest → account keeps every item and placement; refreshing never loses progress.

### 1.3 Connecting with people
| Action | How | Rules |
|---|---|---|
| **Add a friend** | Search by name tag, share your **friend code / link / QR**, or tap someone in your world | Request → they accept. Friends list shows online status and "in their home / at the playground". |
| **Remove a friend** | Friend card → Remove | Silent; they just drop off each other's lists. |
| **Block** | Any profile or chat line → Block | They can't message, invite or see you online. Leaves shared worlds' chat for you. |
| **Report** | Profile / chat line → Report (reason) | Goes to the moderation queue with the chat context. |
| **Create a world** | World tab → New world (name, emoji) | You are its creator. Max 2 worlds per person. |
| **Invite to a world** | Invite link, or pick friends | Invite expires in 7 days; the invitee must accept. |
| **Join / leave a world** | Accept invite / World → Leave | Leaving frees your plot; your house and items go with you. |
| **Remove a member** | Creator only, member card → Remove | 24 h notice to them; their items stay theirs. |
| **Transfer / delete a world** | Creator: hand over to a member, or delete | Delete needs typing the world name; members keep their homes. |
| **Ask someone to be your partner** | Their card → Ask to be partners | Must be friends in the same world; they accept → the cloud merge plays for **both** live. |
| **End a couple** | Couple page → End | 24 h cooldown, can cancel; each gets their own items back (see DESIGN 1.5). |
| **Delete account** | Settings → Delete account | 7-day grace, then everything is erased. Legally required. |

- Done when: every row works between two real accounts on two devices, and every action has a notification for the other person.

### 1.4 Being together (the heart of the game)
- **See each other live**: cubes move smoothly (positions sent ~8 times a second, smoothed), name tags, a speech bubble over the head when they chat.
- **Chat**: world chat and 1-to-1, emoji, short messages; bad words filtered; history kept 30 days.
- **Emotes** (radial wheel): wave, hug, heart, dance, laugh, sleep. A **hug** next to someone plays a joint animation.
- **Do things together**: sit side by side on a sofa or bench, lie in bed, swing at the playground, watch the sea from the cliff. Each spot has a "sit" point; two people on one piece = a little heart puff and the together-bonus.
- **Visit**: walk next door, knock, enter if their door is open (owner chooses: open / friends / closed). Visiting gives both a small reward once a day.
- **Gifts**: send an item or Boxets to a friend, wrapped as a box that appears on their doorstep.
- **Photos**: a camera button (hide the HUD, frame, save/share with a NeighBoxed watermark). This is free marketing.
- Done when: two people can meet, chat, hug, sit together and send a gift in under 2 minutes without help.

### 1.5 Why come back every day
1. **Time together pays**: Boxets every 30 active minutes, more with friends online and most with your partner (already designed; must actually pay out).
2. **Daily gift** (done) + **3 daily quests** + **1 weekly couple/friends quest**.
3. **Playground games** (each 1–3 minutes, multiplayer first):
   - *Star catch*: catch falling stars together, a shared score.
   - *Couple quiz*: "how well do you know me", answered by both.
   - *Arcade*: a small co-op game (e.g. stack the boxes, cliff race).
4. **Levels**: your home level rises with what you do; levels unlock rooms, items and emotes.
5. **Seasons and events**: monthly item sets, holiday decorations (Diwali lamps, winter snow, Valentine's), limited for that month.
6. **Notifications**: "Mochi is online", "Your partner sent you a gift", "Your daily gift is ready", "Your streak is about to end". Opt-in, max 2 a day.

### 1.6 The home
- *Done:* place, move, rotate, undo, auto-furnish, paint, floors, fences, signs, lamps and curtains you can click.
- Left: **storage chest** (pick up items into it), **sell back** (50%), **themed room presets**, **pets** (a cat on the bed, later), **more rooms** as house tiers bought with Boxets.

### 1.7 Leaving and returning
- Logging off: your cube walks into the house, the lights dim on your plot for others.
- Coming back after days away: a "while you were away" card (who visited, gifts, what changed).

---

## 2. Bugs and gaps found in the current build (fix first)

| # | Problem | Done when |
|---|---|---|
| 1 | **No earning at all.** The HUD shows "30/30 min" but nothing ever pays; `earn()` is never called since the Play window was removed. | Active-time earning pays every 30 min (locally now, server later); playground stations pay their caps. |
| 2 | **Back path is a 30 cm squeeze** in the starter home; nothing shows the playground exists. | A clear 1.2 m path round the house, a signpost "Playground ↑", and "Playground" in the eye-button view list. |
| 3 | Playground stations are all "coming soon". | Star catch playable (solo now, together later). |
| 4 | The welcome guide reappears after switching starter ↔ couple house. | Shown once per account. |
| 5 | Neighbours, partner and sign name ("Sera & DeM") are sample data. | Replaced by real accounts in phase 2; until then labelled as demo. |
| 6 | Guide and README promise visiting and time-together earning that don't exist. | Promises match what works. |
| 7 | Never tested on a real phone. | 60 fps on an iPhone 12 / Pixel 6, no overheating in 20 minutes, touch controls feel natural. |

---

## 3. The look: a classy, dreamy UI system

One design language for every panel, the HUD and the menus. Rules:

- **Material**: frosted night glass. Panels are deep indigo (`#1a1730` at 72% with a 20 px backdrop blur), a 1 px inner border of soft gold at 18%, 20 px corner radius, a long soft shadow. Nothing flat-white, nothing boxy.
- **Colour**: night indigo, moonlight lavender, lamp gold (`#ffd27a`) as the single accent for "do this" buttons, rose (`#ff8fb8`) only for couple things, sky cyan (`#7fe0ff`) only for games. Never more than one accent per panel.
- **Type**: one display face for titles (Oswald now; try a softer rounded serif such as *Fraunces* for headings), one clean body face; 3 sizes only (title, body, small); generous letter spacing on small caps labels.
- **Motion**: panels rise 8 px and fade in over 220 ms with an ease-out; buttons glow slightly on hover; numbers (Boxets) count up; a soft chime on rewards. Everything respects "reduce motion".
- **HUD**: minimal and in the corners. Top left: name + Boxets pill. Top right: compass, eye button. Bottom: the dock as a floating glass bar with icon + tiny label. Chat and emotes bottom right. Nothing covers the middle of the screen.
- **Icons**: one hand-made line set, 1.75 px strokes, rounded ends.
- **Every panel** has: a title, at most one primary button, an obvious close, keyboard and touch support, and an empty state with a friendly line instead of a blank list.
- Done when: a style sheet of tokens (colours, radii, blur, spacing, motion) drives every screen, and a screenshot of any panel looks like it belongs to the same game.

---

## 4. Performance and quality gates (checked before every release)

- **Budgets** on a mid-range phone: 60 fps target, 30 fps floor; < 150 draw calls; < 300k triangles in view; < 200 MB memory; first load < 4 MB gzipped, playable in < 5 s on 4G.
- **How**: merged static meshes (done), fake lights (done), one shadow pass drawn once (done), adaptive resolution (done), 30 fps when idle (done); next: LOD for neighbours' houses, instancing for fences/trees/rocks, texture atlas, lazy-load the playground and shop previews, compress models (Draco/Meshopt) and textures (KTX2).
- **Z-fighting**: `__cc.debug.zfight()` must return **zero** in every room, both home kinds, the garden, street and playground. Run as an automated test in a headless browser before each release; the `settleCoplanar` offset stays as a safety net.
- **Walkability**: `__cc.debug.reach()` must reach every room, both gates, the cliff walk and the playground, with every corridor at least 0.8 m wide. Also an automated test.
- **Network**: < 5 KB/s per player in a world; positions only sent when moving.

---

## 5. Build order

Each phase ends with a playable build. Estimates are focused work sessions with me.

| Phase | What | Done when | Size |
|---|---|---|---|
| **1. Fix the loop** | Section 2 items 1–4, 6; time-together earning (local); Star catch playable solo; the back path | A new player can earn, spend, and reach and play at the playground | 1–2 sessions |
| **2. UI system** | Section 3 tokens; restyle HUD, dock, every panel, guide | Every screen matches the dreamy glass look | 1–2 sessions |
| **3. Accounts & cloud save** | Supabase tables + security rules, magic link + Google, guest → account, home saved on the server | Same home on phone and laptop | 2 sessions |
| **4. Friends & worlds** | Everything in table 1.3 except couples; invite links | Two real accounts can friend, make a world, invite, join, leave, remove, block, report | 2–3 sessions |
| **5. Together live** | Live movement, presence, chat, emotes, sitting together, visiting | Two people can meet, chat, hug, sit together | 2–3 sessions |
| **6. Server economy** | Earning, buying, daily gift, gifts, couple merge/breakup all done by the server | Nobody can cheat Boxets by editing the browser | 2 sessions |
| **7. Games & quests** | Star catch together, Couple quiz, daily/weekly quests, levels | There is something new to do every day | 3 sessions |
| **8. Launch prep** | Landing page, privacy policy, terms, 13+ age gate, delete account, analytics, crash reports, moderation queue, domain, Vercel | Ready for strangers | 2 sessions |
| **9. Soft launch** | 50–200 real players (friends, college, Reddit/Discord) | We know day-1 / day-7 retention | 4 weeks |
| **10. Apps & money** | Capacitor iPhone/Android, store listings, payments | In the App Store and Play Store | 2–3 sessions |

---

## 6. From side project to a million-dollar business

### 6.1 The bet
Cosy social games for friends and couples (think *Animal Crossing* pocket camp meets a couples app like *Paired* / *Between*) are a proven, under-served space on the web. NeighBoxed's angle: **a shared little home you build together, playable instantly in a browser, no download**.

### 6.2 How it makes money (cosmetic only, never pay-to-win)
1. **Boxets packs** (₹99 / $1.99 up to $19.99). Everything can still be earned by playing.
2. **NeighBoxed Plus** subscription ($3.99/month, couples share one): extra house tier, 2× daily gift, exclusive monthly set, more photo frames, profile flair.
3. **Seasonal passes** ($4.99): a month of themed rewards through quests.
4. **Couple bundles** for Valentine's, anniversaries (the game knows your couple date and can offer an anniversary gift).

### 6.3 The numbers that matter
- **$1M a year ≈ $83k a month.** With a typical 3–5% of monthly players paying about $8 a month on average, that needs **about 250k–350k monthly players**. Couples convert better (they gift each other), so the couple features are the money features.
- Targets that show it is working: **day-1 retention > 40%, day-7 > 15%, day-30 > 7%**; each new player brings **> 0.5** friends (the invite link is the growth engine: a couples/friends game spreads itself).
- Server cost stays small: Supabase + Vercel ≈ $25–$300 a month up to ~50k players.

### 6.4 Growth
1. **Built-in virality**: every world needs friends; invite links with a pretty preview; shareable photos with the watermark.
2. **Short videos**: TikTok / Reels / Shorts of couples building a home, the cloud merge moment, cosy night timelapses. Post 3 a week from launch; the cloud merge is the hero clip.
3. **Communities**: Reddit (r/CozyGamers, r/LongDistance, r/WebGames), Discord, college groups; long-distance couples are the sharpest audience.
4. **Web game portals** (CrazyGames, Poki) for reach, then the app stores.
5. **Creators**: send cosy-game streamers early access and a custom item.

### 6.5 Milestones
| When | Goal |
|---|---|
| Month 1 | Phases 1–6 done; private beta with 20 friends |
| Month 2 | Phases 7–8; soft launch 200 players; fix retention |
| Month 3 | Public web launch + portals; first payments; 5k players |
| Month 6 | Apps in stores; Plus subscription; 50k players; ~$5–10k/month |
| Month 12 | 250k+ monthly players; seasonal content team of 1–2 artists; ~$80k/month |

### 6.6 Risks and answers
- **Empty worlds** → solo play must be fun on its own (home building, games, quests) and invites must be one tap.
- **Safety with strangers** → no public chat with strangers at launch: you only meet people through invites and friend codes. Block/report from day one.
- **Cheating** → every Boxet moves on the server (phase 6).
- **Phones too slow** → the performance gates in section 4, tested on real phones every release.
- **Doing it alone** → keep scope to this list; cut anything that doesn't serve "be together".

---

## 7. Decisions made
- Magic link sign-in (plus Google later), ages 13+, daily earning cap 600, only the world's creator removes members (2026-10-24).
- Supabase project: `neighboxed` (`ecbodzfhvtdnrjcjwitc`).
