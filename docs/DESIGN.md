# cc — design and build plan

A cosy 3D neighbourhood for friends and couples. Everyone has a house, earns coins by spending time and playing together, and spends them on rooms, furniture and skins. Web first (Three.js), app later (Capacitor wrapper).

Status: the visual prototype is done (see README). Everything below the "Rules" heading is **not built yet**.

---

## 1. Rules

### 1.1 Houses
| Stage | House | Notes |
|---|---|---|
| Solo | **Starter house: 1 bedroom**, small fenced garden | Free, one per player. *Not built yet.* |
| Partnership | Each member keeps their own house; all houses share **one fence** | Up to 4 houses (see 1.4) |
| Couple | Both houses vanish in a **cloud**; a **standard bigger house** appears (the current 4-room house) | Shared name sign ("X & Y") |

- A person can be in at most **2 worlds**.
- A couple is a *unit* inside a partnership: its one big house sits in the shared fence, and counts as **1 house** (not 2).
- Joining a world or a couple needs **acceptance** by the person being invited. Either side can leave.

### 1.2 Earning
- **Base:** `15 coins / 30 min` of *active* time per player.
- **Active** = the player moved, interacted, or played a game in the last 2 minutes, with the tab visible. Idle tabs earn nothing. Decided by the server.
- **Partnership multiplier** (per person): `min(online_active_members, 3)×`. With 3 of 5 online and active together, everyone earns 3×. Cap at 3× is deliberate: uncapped, a group of n earns n² in total.
- **Couple multiplier:** 3× while both partners are active at the same time. In the example: 15 coins → **45 coins per 30 min each**.
- **Stacking:** multipliers multiply (couple 3× × partnership up to 3×). The hard backstops are the **30-minute window** (earning needs a full window of overlap) and a **daily cap** per player (see 6).
- Mini-games, quizzes and visiting a friend's house add small extra rewards, each with their own daily cap.

### 1.3 Daily login reward (not a streak)
- One reward per calendar day on first login. **It never resets.** Missing days costs nothing.
- The reward depends on **total days logged in**, so staying longer always pays more:
  `reward(day) = min(20 + 2 × day, 150)` coins, tunable in config.
- **Milestones** add a cosmetic on days 7, 30, 100, 365.
- The server decides "today" using the player's saved time zone, so changing the device clock does nothing.

### 1.4 World size and growth
- A world starts with room for **4 houses**.
- The **5th slot costs 500 coins**, the **6th costs 1000 coins**. Hard cap **6** (also protects performance).
- The cost is paid from a shared **world fund** that any member can contribute coins to.
- Who can invite or remove: the world's creator can remove; any member can invite (and the invite still needs the invitee's acceptance). Open to change.

### 1.5 Couple house, inventory and breakups
- Every item records its **original owner**.
- On merge, both inventories pool into a **shared inventory**. Purchases afterwards are also shared but remember who bought them.
- Furnishing the bigger house: **place anything anywhere**, or press "auto-furnish", which picks randomly from the pooled items. New items can be bought and placed any time.
- **Ending a couple:** needs a request plus a short cooldown (24 h). Each person gets back **their own items** and a restored solo house. Items bought jointly go to the buyer. The shared name sign is removed.
- The couple house layout is fixed (4 rooms); larger houses can be added later as purchasable tiers.

---

## 2. Technology

| Part | Choice | Why |
|---|---|---|
| 3D | Three.js (current) | light, works in browsers, wrappable as an app |
| UI | React + Vite (current) | already in place |
| Backend | **Supabase** (Postgres, Auth, Realtime) | free tier covers a few players; one service for login, data and live messages |
| Economy logic | **Postgres functions / Edge Functions** | the server alone grants coins; the browser can never award itself anything |
| Hosting | Cloudflare Pages or Vercel (free) | static site |
| App later | Capacitor | reuses the same code for iOS / Android |

Free-tier limits change, so re-check them before launch. If realtime limits ever bite, player positions can move to direct peer-to-peer (WebRTC) connections, which cost nothing.

---

## 3. Data model (Supabase / Postgres)

```
profiles      id, display_name, timezone, coins, login_days, last_login_date, created_at
worlds        id, name, owner_id, slots (4..6), fund_coins, created_at
world_members id, world_id, profile_id, house_id, joined_at          -- unique (world_id, profile_id)
houses        id, owner_id, kind ('solo'|'couple'), name, layout jsonb   -- layout = placed items
couples       id, a_id, b_id, house_id, created_at, ended_at, end_requested_at
items         id, catalog_id, original_owner, current_holder, placed_in (house_id|null), placement jsonb
catalog       id, kind, name, price, mesh_id                           -- what exists to buy
invites       id, from_id, to_id, type ('world'|'couple'), status, created_at
presence      profile_id, world_id, house_id, last_active_at           -- written by heartbeat, read by earning
earn_log      id, profile_id, window_start, base, multiplier, coins    -- audit trail, unique (profile_id, window_start)
login_log     profile_id, date                                         -- unique, enforces one reward/day
```

All tables use **row-level security**: players read only their own world, and write only through functions.

### Server functions (the only way money moves)
- `claim_daily()` — idempotent per day; applies the formula in 1.3.
- `heartbeat(active)` — updates `presence`; no coins.
- `settle_earning()` — runs every few minutes: for each 30-minute window, computes who was active and how many, applies multipliers and caps, writes `earn_log`, adds coins. Unique key stops double-paying.
- `buy_item(catalog_id)`, `place_item(item_id, placement)`, `auto_furnish(house_id)`.
- `invite`, `accept_invite`, `leave_world`, `request_couple_end`, `confirm_couple_end`, `buy_slot(world_id)`.

---

## 4. Code structure

Game rules and 3D must stay separate so the world can change without touching the economy.

```
src/
  game/            pure JS: no Three.js
    economy.js     multipliers, caps, daily reward formula (shared with server tests)
    rules.js       world/couple/partnership rules
    api.js         thin Supabase client (auth, rpc calls, realtime channels)
    state.js       client store: profile, world, inventory
  world/           Three.js: houses, rooms, plots, cameras (exists)
    plots.js       places N plots in a row, builds the merged fence + signs
    houses/        starter.js (new), couple.js (the current 4-room house)
    placement.js   furniture placement editor
    fx.js, kit.js, bake.js ...
  ui/              React: HUD, shop, inventory, invites, daily reward modal
```

Pure functions in `economy.js` are unit-tested and **mirrored** in the SQL functions, with the same test cases run against both.

---

## 5. Build plan (phased)

Each phase ends with something playable and testable.

**Phase 0 — Foundation (1–2 days)**
- Split `src/game` from `src/world`. Add config for numbers (15/30 min, caps, prices).
- Set up Supabase project, Auth (email/magic link), environment variables, deploy to free hosting.
- Test on a real phone and measure frame rate. *(Gate: we know our mobile budget.)*

**Phase 1 — Accounts and a saved solo house**
- Login, profile, one saved house. Build the **1-bedroom starter house** and starter garden fence.
- Daily login reward + modal (`claim_daily`).
- *Done when:* you log in, see your own house, claim a reward once per day.

**Phase 2 — Two real players in one house**
- Realtime channel per house: positions at ~5 Hz, only while moving; smoothing on the receiver.
- Replace the bot partner. Presence heartbeat.
- *Done when:* two browsers see each other walk and the stairs work for both.

**Phase 3 — Earning (server-authoritative)**
- `heartbeat` + `settle_earning` with active-time rules, daily caps and the `earn_log`.
- Coin display, simple earning feedback (no spammy popups).
- *Done when:* a scripted test of 1, 2, 3, 4 active players yields the exact expected coins.

**Phase 4 — Worlds and the shared fence**
- Invites, accept, leave. `plots.js` lays out 1–6 houses in a row with one merged fence and name sign. Far houses use a **low-detail shell** (no interior, no lights).
- Slot purchase (500 / 1000) from the world fund.
- Partnership multiplier live.
- *Done when:* 4 browsers in one world, performance still at target.

**Phase 5 — Shop, inventory, placement**
- Catalog, `buy_item`, inventory UI, `placement.js` (click an item, click a spot, snap to grid/surface).
- Item ownership recorded from day one.

**Phase 6 — Couples**
- Couple invite → cloud transition (particle puff, houses swap) → standard couple house.
- Pooled inventory, auto-furnish, 3× couple earning, shared name sign.
- Breakup: request + 24 h cooldown, items returned to original owners.
- *Done when:* merge and un-merge leave every item with the right person.

**Phase 7 — Things to earn and play**
- One quiz (e.g. couple quiz), one mini-game, visiting a friend's house. Each with caps.

**Phase 8 — Polish and launch**
- Safety: report/block, name filtering, age notice. Sound. Onboarding. PWA install, then Capacitor.

---

## 6. Anti-abuse and balance

- Server-only coin changes; all functions check ownership and run in transactions.
- Active-time detection from real input; a full 30-minute window is required, so brief overlaps earn nothing.
- **Daily coin cap** per player (suggested: 600, tunable), plus caps per activity.
- Multipliers cannot exceed 9× in total (3 × 3), and only with full-window overlap.
- One account per device-ish: rate limit sign-ups and invites; invites expire after 7 days.
- Log everything (`earn_log`, `login_log`) so balance can be tuned and disputes settled.
- Keep purchases **cosmetic** so nothing is pay-to-win.

---

## 7. Performance plan (must stay smooth on a mid-range phone)

- Static geometry merged per room (done, ~230 draw calls for one house).
- With more houses: only the house you're in is fully detailed; others are **shells** (walls, roof, lit windows, no furniture) and cost ~10 calls each; swap detail in/out by distance.
- Furniture items are **instanced** where repeated (books, stools, plants).
- One real light per room, all others are fake glows; shadows baked once.
- Adaptive pixel ratio (done); render only when something changes; pause when the tab is hidden.
- Network: send positions only while moving, quantised to small integers, ≤ 5 Hz; at most 12 players per world.
- Target: 60 fps desktop, ≥ 30 fps on a mid-range phone, < 15 MB first load.

---

## 8. Open questions

1. **Cloud transition style:** a stylised puff of cloud over the plot for about 2 seconds, with the new house rising out? (needs a visual pass)
2. **Auto-furnish:** random from pooled items (as described) — should it prefer matching styles/colours, or stay purely random?
3. **Who controls placement in a couple house?** Both equally (assumed).
4. **Solo starter contents:** what comes free (bed, desk, lamp)? Suggest 5–6 plain pieces.
5. **Moderation:** friends-only world chat is planned later; do you want text chat at all in v1, or only emotes?
6. **Currency name** and the first few shop items / prices.
