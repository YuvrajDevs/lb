# LoveBoxed — design and build plan

A cosy 3D neighbourhood for friends and couples. Everyone has a house, earns Boxets by spending time and playing together, and spends them on rooms, furniture and skins. Web first (Three.js), app later (Capacitor wrapper).

Status (October 2026): the whole game runs **locally in the browser**: both homes, the world around them, the editor with auto-furnish, the shop, wardrobe, daily gift, the couple invite / merge / breakup flow, neighbours, the earning games and the economy rules, all saved on the device (see README). What is left is **online play**: accounts, saving on the server, real friends and partners, server-checked earning, chat. Each phase below says what is already done on the client.

---

## 1. Rules

### 1.1 Houses
| Stage | House | Notes |
|---|---|---|
| Solo | **Starter house: a single room** (bed, cupboard, table, bookshelf, lamp), small fenced garden | Free, one per player. *Built (`rooms/home.js`).* |
| Partnership | Each member keeps their own house; all houses share **one fence** | Up to 4 houses (see 1.4) |
| Couple | A **big cloud** covers both plots. The couple picks **either one of their two locations** to build on; the ground there **grows** and the **standard bigger house** (the current 4-room house) rises out of the cloud | Shared name sign ("X & Y") |

- A person can be in at most **2 worlds**.
- A couple is a *unit* inside a partnership: its one big house sits in the shared fence, and counts as **1 house** (not 2). The plot they did **not** pick is freed, so the world gets a spare slot back.
- The couple chooses the location; the ground expansion pushes neighbouring plots along the row (no overlap).
- Joining a world or a couple needs **acceptance** by the person being invited. Either side can leave.

### 1.2 Earning
- **Base:** `15 Boxets / 30 min` of *active* time per player.
- **Active** = the player moved, interacted, or played a game in the last 2 minutes, with the tab visible. Idle tabs earn nothing. Decided by the server.
- **Partnership multiplier** (per person): `min(online_active_members, 3)×`. With 3 of 5 online and active together, everyone earns 3×. Cap at 3× is deliberate: uncapped, a group of n earns n² in total.
- **Couple multiplier:** 3× while both partners are active at the same time. In the example: 15 Boxets → **45 Boxets per 30 min each**.
- **Stacking:** multipliers multiply (couple 3× × partnership up to 3×). The hard backstops are the **30-minute window** (earning needs a full window of overlap) and a **daily cap** per player (see 6).
- Mini-games, quizzes and visiting a friend's house add small extra rewards, each with their own daily cap.

### 1.3 Daily login reward
- Rewards follow the **calendar day since you joined**: day 1, day 2, day 3 ... Each day's reward can be claimed **only on that day**.
- **Missed days are gone, not owed.** If you skip day 3 and day 4 and log in on day 5, you get the **day-5 reward only**. Nothing is backfilled and nothing resets, so a missed day just costs you that day's reward.
- Rewards rise the longer you have been around: `reward(day) = min(20 + 2 × day, 150)` Boxets, tunable in config.
- **Milestones** add a cosmetic on days 7, 30, 100, 365 (claimable on that day only).
- One claim per day, enforced by `login_log`. The server decides "today" from the player's saved time zone, so changing the device clock does nothing.

> Note: this replaces the earlier "total days logged in" idea. Under that idea, skipping day 3 would still have paid the 4th-login amount on day 5; now it pays the day-5 amount.

### 1.4 World size and growth
- A world starts with room for **4 houses**.
- The **5th slot costs 500 Boxets**, the **6th costs 1000 Boxets**. Hard cap **6** (also protects performance).
- The cost is paid from a shared **world fund** that any member can contribute Boxets to.
- Who can invite or remove: the world's creator can remove; any member can invite (and the invite still needs the invitee's acceptance). Open to change.

### 1.5 Couple house, inventory and breakups
- Every item records its **original owner**.
- On merge, both inventories pool into a **shared inventory**. Purchases afterwards are also shared but remember who bought them.
- Furnishing the bigger house: **place anything anywhere**, or press "auto-furnish". Auto-furnish **prefers matching items**: every catalog item has a style tag and a colour palette; it finds the most common style among the pooled items, fills the rooms with those first, and only then fills gaps from the rest. New items can be bought and placed any time.
- **Ending a couple:** needs a request plus a short cooldown (24 h). Each person gets back **their own items** and a restored solo house. Items bought jointly go to the buyer. The shared name sign is removed.
- The couple house layout is fixed (4 rooms); larger houses can be added later as purchasable tiers.

---

## 2. Technology

| Part | Choice | Why |
|---|---|---|
| 3D | Three.js (current) | light, works in browsers, wrappable as an app |
| UI | React + Vite (current) | already in place |
| Backend | **Supabase** (Postgres, Auth, Realtime) | free tier covers a few players; one service for login, data and live messages |
| Economy logic | **Postgres functions / Edge Functions** | the server alone grants Boxets; the browser can never award itself anything |
| Hosting | Cloudflare Pages or Vercel (free) | static site |
| App later | Capacitor | reuses the same code for iOS / Android |

Free-tier limits change, so re-check them before launch. If realtime limits ever bite, player positions can move to direct peer-to-peer (WebRTC) connections, which cost nothing.

---

## 3. Data model (Supabase / Postgres)

```
profiles      id, display_name, timezone, boxets, login_days, last_login_date, created_at
worlds        id, name, owner_id, slots (4..6), fund_boxets, created_at
world_members id, world_id, profile_id, house_id, joined_at          -- unique (world_id, profile_id)
houses        id, owner_id, kind ('solo'|'couple'), name, layout jsonb   -- layout = placed items
couples       id, a_id, b_id, house_id, created_at, ended_at, end_requested_at
items         id, catalog_id, original_owner, current_holder, placed_in (house_id|null), placement jsonb
catalog       id, kind, name, price, mesh_id, style, palette[]         -- what exists to buy; style/palette drive auto-furnish
invites       id, from_id, to_id, type ('world'|'couple'), status, created_at
presence      profile_id, world_id, house_id, last_active_at           -- written by heartbeat, read by earning
earn_log      id, profile_id, window_start, base, multiplier, boxets    -- audit trail, unique (profile_id, window_start)
login_log     profile_id, date, day_number                             -- unique (profile_id, date), enforces one reward/day
chat_messages id, world_id, house_id|null, from_id, text, created_at, deleted
reports       id, reporter_id, message_id, reason, created_at
blocks        blocker_id, blocked_id
```

All tables use **row-level security**: players read only their own world, and write only through functions.

### Server functions (the only way money moves)
- `claim_daily()` — idempotent per day; computes `day_number` from the join date and applies the formula in 1.3 (never pays for missed days).
- `send_chat(world_id, text)` — length cap, rate limit, word filter, blocked-user check; `report_message`, `block`.
- `heartbeat(active)` — updates `presence`; no Boxets.
- `settle_earning()` — runs every few minutes: for each 30-minute window, computes who was active and how many, applies multipliers and caps, writes `earn_log`, adds Boxets. Unique key stops double-paying.
- `buy_item(catalog_id)`, `place_item(item_id, placement)`, `auto_furnish(house_id)` (style-matching).
- `invite`, `accept_invite`, `leave_world`, `request_couple_end`, `confirm_couple_end`, `buy_slot(world_id)`.

---

## 4. Code structure

Game rules and 3D must stay separate so the world can change without touching the economy.

```
src/
  game/            pure JS: no Three.js (unit-tested: npm test)
    economy.js     multipliers, caps, daily reward, earning caps, slot prices (to mirror in SQL)
    catalog.js     items, prices, styles      areas.js   rooms, plots, windows, no-build zones
    defaults.js    standard furnishing        grid.js    placement maths
    store.js       local save standing in for the server (to be replaced by api.js + Supabase)
  world/           Three.js
    game.js        renderer, cameras, input, movement, pathfinding, lamps/curtains, merge animation
    house.js       the starter home or the couple house, roof, garden      rooms/  each room
    scenery.js     cliff, sea, sky, land (night / evening palettes)        neighbours.js  other plots
    editor.js, autofurnish.js, furnish.js, items/, switches.js, zfight.js, fx.js, kit.js, bake.js
  ui/              React screens: shop, wardrobe, editor, world, play, daily gift, settings
```

Pure functions in `economy.js` are unit-tested and **mirrored** in the SQL functions, with the same test cases run against both.

---

## 5. Build plan (phased)

Each phase ends with something playable and testable.

**Phase 0 — Foundation (1–2 days)**
- Split `src/game` from `src/world`. Add config for numbers (15/30 min, caps, prices).
- Set up Supabase project, Auth (email/magic link), environment variables, deploy to free hosting.
- Test on a real phone and measure frame rate. *(Gate: we know our mobile budget.)*

**Phase 1 — Accounts and a saved solo house** *(client done: starter home, daily gift; left: login, server save, `claim_daily`)*
- Login, profile, one saved house. Build the **single-room starter house** (bed, cupboard, table, bookshelf, lamp) and starter garden fence.
- Daily login reward + modal (`claim_daily`), including the missed-days rule (skip days 3–4, log in on 5 → day-5 reward only).
- *Done when:* you log in, see your own house, claim a reward once per day.

**Phase 2 — Two real players in one house** *(left: realtime; the partner is still a local bot)*
- Realtime channel per house: positions at ~5 Hz, only while moving; smoothing on the receiver.
- Replace the bot partner. Presence heartbeat.
- **Chat:** speech bubbles over cubes and a small log; world-members only, 120-character cap, rate limit, word filter, report and block (see 6).
- *Done when:* two browsers see each other walk and the stairs work for both.

**Phase 3 — Earning (server-authoritative)**
- `heartbeat` + `settle_earning` with active-time rules, daily caps and the `earn_log`.
- Coin display, simple earning feedback (no spammy popups).
- *Done when:* a scripted test of 1, 2, 3, 4 active players yields the exact expected Boxets.

**Phase 4 — Worlds and the shared fence** *(client done: neighbour plots with simple houses, slots and fund; left: real invites, one shared fence)*
- Invites, accept, leave. `plots.js` lays out 1–6 houses in a row with one merged fence and name sign. Far houses use a **low-detail shell** (no interior, no lights).
- Slot purchase (500 / 1000) from the world fund.
- Partnership multiplier live.
- *Done when:* 4 browsers in one world, performance still at target.

**Phase 5 — Shop, inventory, placement** *(client done; left: `buy_item` / `place_item` on the server)*
- Catalog, `buy_item`, inventory UI, `placement.js` (click an item, click a spot, snap to grid/surface).
- Item ownership recorded from day one.

**Phase 6 — Couples** *(client done: invite, cloud merge, couple house, auto-furnish, 24 h breakup; left: pooled inventory with owners on the server, choosing the location)*
- Couple invite → they **choose one of their two locations** → a **big cloud** covers both plots → the ground there grows (neighbours shift along the row) → the standard couple house rises out of the cloud. The other plot is freed.
- Pooled inventory, style-matching auto-furnish, 3× couple earning, shared name sign.
- Breakup: request + 24 h cooldown, items returned to original owners.
- *Done when:* merge and un-merge leave every item with the right person.

**Phase 7 — Things to earn and play** *(client done: star catch, couple quiz, visits, daily caps; left: server-side payouts, comparing quiz answers)*
- One quiz (e.g. couple quiz), one mini-game, visiting a friend's house. Each with caps.

**Phase 8 — Polish and launch**
- Safety review (age notice, name filtering), sound, onboarding, PWA install, then Capacitor.

---

## 6. Anti-abuse and balance

- Server-only Boxet changes; all functions check ownership and run in transactions.
- Active-time detection from real input; a full 30-minute window is required, so brief overlaps earn nothing.
- **Daily Boxet cap** per player (suggested: 600, tunable), plus caps per activity.
- Multipliers cannot exceed 9× in total (3 × 3), and only with full-window overlap.
- One account per device-ish: rate limit sign-ups and invites; invites expire after 7 days.
- Log everything (`earn_log`, `login_log`) so balance can be tuned and disputes settled.
- Keep purchases **cosmetic** so nothing is pay-to-win.
- **Chat safety:** messages only reach members of the same world; max 120 characters; rate limit (e.g. 1 message / 2 s); server-side word filter; **report** and **block** on every message; moderators can delete; chat history kept short (e.g. 7 days). Each player can switch chat off.

---

## 7. Performance plan (must stay smooth on a mid-range phone)

- Static geometry merged per room (done, ~230 draw calls for one house before the scenery; re-measure on a phone).
- With more houses: only the house you're in is fully detailed; others are **shells** (walls, roof, lit windows, no furniture) and cost ~10 calls each; swap detail in/out by distance.
- Furniture items are **instanced** where repeated (books, stools, plants).
- One real light per room, all others are fake glows; shadows baked once.
- Adaptive pixel ratio (done); 60 fps cap, 30 when idle, near-stop when hidden (done).
- Flicker (z-fighting): checked with `__cc.debug.zfight()`; every material has a fixed polygon-offset priority as a safety net (done).
- Network: send positions only while moving, quantised to small integers, ≤ 5 Hz; at most 12 players per world.
- Target: 60 fps desktop, ≥ 30 fps on a mid-range phone, < 15 MB first load.

---

## 8. Decisions made

- **Couple merge:** a big cloud covers both plots; the couple picks either location, the ground grows, the standard house rises out of the cloud; the other plot is freed.
- **Auto-furnish:** prefers matching style and colour.
- **Starter house:** a single room with a bed, cupboard, table, bookshelf and lamp.
- **Chat:** included, with the safety rules above.
- **Currency:** **Boxets**.
- **Daily login:** rewards follow the calendar day since joining; missed days are lost, never backfilled.

## 9. Still open

1. Real prices and balance (the catalogue uses 100 to 2,400 Boxets per tier; earning caps are 60 / 30 / 30 a day for the games).
2. Maximum number of **couples** per world (each counts as 1 house, so up to 6).
3. Who may remove a member from a world (currently: the creator).
4. How big the grown plot is, and how neighbouring plots move when it grows.
