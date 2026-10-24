# NeighBoxed

A cosy little neighbourhood on a cliff by the sea, where friends and couples live as floating cubes in doll houses. You decorate your home, earn Boxets by spending time and playing together, and when two people become a couple their homes merge into one bigger house.

Built with Vite, React and plain [Three.js](https://threejs.org), with [Supabase](https://supabase.com) for accounts, saving and live play. You can play straight away as a guest (saved on the device); signing in with Google keeps your home on your account and lets you play with friends. The plan is in [`docs/PLAN.md`](docs/PLAN.md), the rules in [`docs/DESIGN.md`](docs/DESIGN.md).

```
npm install
npm run dev     # play at http://localhost:5173
npm test        # the rules: economy, rooms, furniture placement
npm run build
```

## The world

- **Your home.** On your own you live in a **starter home**: one room with a bed, cupboard, table, bookshelf and lamp, on a small fenced plot. As a **couple** you share the **four-room house** (study and bedroom upstairs, kitchen and living room downstairs, with stairs, a balcony and a shared name sign).
- **Around it.** The plot sits on a cliff top: a moonlit sea with rolling swells in front, a cliff walk with lamps and a railing, and behind the house a magical land of terraced hills, pine trees, crystals, glowing mushrooms, fireflies and floating islands. A stream runs past under a wooden deck and falls over the cliff as a waterfall. Thick fog hides the far edges.
- **Neighbours.** The other homes in your world stand on their own plots along the cliff (simple versions, lit when their owners are online).
- **Time of day.** Night, a pink-and-orange evening, or follow your own clock (Settings).

## Moving and looking

- **WASD / arrows** to move; **hold Space** to run. **Click** anywhere on the floor, in the garden or on the cliff walk to walk there: the path goes around furniture and through the front door and garden gate.
- The **eye button** under the compass picks the view: my eyes, close-up (behind you), room, house, outside (from above, following you), playground.
- **First person** (my eyes): hold and drag to look around.
- **Compass:** drag to spin, ‹ › to turn, click for the front view. Walls facing the camera fade so you can see in.
- **Stairs** are walked up and down. **Doors and the garden gate** open as you come near. You can step out onto the **balcony**.
- **Click a lamp** to switch it off or on (with every lamp off, only moonlight comes in through the window). **Click curtains** to open or close them. Both are remembered.

## Together (signed in)

- **Your world** is a street of up to six homes in one row along the cliff (in the order people joined, the same on every screen). Walk between the homes, out to the cliff and to the playground.
- **Invite** with a link or a six-letter code (7 days); join a friend's world with theirs. The world's creator can remove someone; anyone can leave.
- **Friends** find you by your tag (like `sera#2841`): requests, remove, block, report.
- **Live:** see everyone's cube move, chat (Enter or T) with speech bubbles, emotes (wave, hug, heart, dance...).
- **Visit** a neighbour: stand at their gate (or Visit in the World panel) and their real house loads around you.
- **Couples:** ask a friend in your world; when they say yes the homes merge into one four-room house that both can furnish. Ending it takes 24 hours, and everyone gets their own home back.
- **The server owns money:** buying, the daily gift, quests, minigame pay and active-time earning are server functions with daily caps (`supabase/migrations`). Every table is behind row level security.

## Screens (the dock)

- **Shop:** 18 categories x 10 tiers = 180 items, 100 to 2,400 Boxets. Skins and hats can be tried on.
- **Wardrobe:** dress your cube.
- **Edit home:** place, move, turn and pick up furniture on a 10 cm grid (snaps of 0.1 / 0.3 / 0.6), with no-build zones for doorways, stairs, windows and the garden path. **Auto-furnish** fills a room with things you own but haven't placed, in a matching style. **Reset** brings back the standard furnishing. Undo / redo with Ctrl+Z / Ctrl+Y. Paint, flooring, fences and name signs too. Curtains fit themselves to the window they hang at.
- **World:** neighbours and house slots (4 free, then 500 and 1,000 Boxets from the shared world fund); the couple page: send a couple invite (the homes merge in a big cloud and the four-room house rises), or request to end it (a 24-hour wait, which can be cancelled).
- **Earning:** every 30 minutes of active play pays 15 Boxets: up to 3× with friends online in your world, and 3× more while your partner is on too. At most 600 a day from everything.
- **Today:** three daily quests (20 Boxets each, 30 more for all three) and the daily gift:
  a reward for each calendar day since you joined; milestone days (7, 30, 100, 365) also give a hat, a golden frame, a glowing sign and a legendary skin.
- **Settings:** names, graphics quality, time of day, reduce motion, hints, sound, controls, your account (sign in, sign out, delete account).
- **The playground** (out of the back gate): walk up to a station to play. **Star catch** teleports you to Starfall Bridge, a 3D side-view game: float along the bridge and catch falling stars, dodge meteors (2 Boxets a point, up to 60 a day).

## Look and performance

- Warm yellow lamps, soft halos, glossy floors, real see-through windows on every side.
- Static geometry is merged into a few meshes per room (`src/world/bake.js`); most lighting is faked with glows, pools and beams (`src/world/fx.js`); the moon's shadows are drawn once.
- At most 60 frames a second, 30 when nothing is moving, almost none in a hidden tab; the sharpness adapts to keep frames smooth. Quality: Low / Medium (default) / High.

## Developer tools

Open the game with `?debug` for `window.__cc` (the game) and `window.__store`. Add `&save=name` to use a separate save, so testing never touches the real one.

- `__cc.debug.zfight()` lists any spot where two surfaces would flicker against each other (z-fighting). Every material also gets a small fixed drawing priority as a safety net (`src/world/zfight.js`).
- `__cc.debug.reach()` checks which parts of the floor plan can be walked to.
- Settings → Developer: +500 Boxets, next day, reset, and switch between the starter home and the couple house.

## Code map

- `src/net/`: online: `client.js` (Supabase), `account.js` (sign-in, loading your account into the store, saving your home, server calls), `live.js` (the world's Realtime channel: presence, movement, chat, emotes).
- `src/games/`: minigames in their own 3D scenes (`starfall.js`).
- `supabase/`: the database (`migrations/`, applied in order) and `seed.sql` (the catalogue).
- `src/game/`: the rules, no 3D: `economy.js` (earning, daily gift, caps, slots), `catalog.js` (items and prices), `areas.js` (rooms, plots, windows, no-build zones), `defaults.js` (standard furnishing), `grid.js` (placement maths), `store.js` (the local save, standing in for the server), `audio.js` (synthesised music and sounds).
- `src/world/`: the 3D world: `game.js` (renderer, cameras, input, movement, pathfinding, interactions), `house.js` (rooms, roof, garden), `shell.js` and `exterior.js` (a room's inside and outside), `rooms/` (what each room has built in), `scenery.js` (cliff, sea, sky, land), `neighbours.js`, `furnish.js` and `items/` (furniture models), `editor.js`, `autofurnish.js`, `switches.js` (lamps and curtains), `zfight.js`.
- `src/ui/`: the screens. `tests/`: `npm test`.
