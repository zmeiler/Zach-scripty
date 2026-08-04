# DeviousMud — Design Specification

This document describes what the game is, how it plays, how it is drawn, and how
it is built. It is written to be read alongside the source: every section names
the files that implement it.

---

## 1. Design pillars

1. **Gentle by default.** Nothing in the world punishes curiosity. Defeat costs a
   short walk, never items or experience. Creatures "scamper away" rather than
   die. Nothing in the text would embarrass a parent reading over a shoulder.
2. **Immediately playable.** No account required to try it, no install, no build
   step, no downloads beyond the page itself. The tutorial quest is available ten
   seconds after the title screen.
3. **One codebase, two modes.** The simulation is a plain ES module that runs
   identically on the server and in the browser, so offline play is the same game
   rather than a cut-down imitation.
4. **The server is the referee.** The client renders and sends intents. Every
   rule — reach, level requirements, prices, drops, quest state — is enforced in
   `shared/engine/game.js` on the authoritative side.
5. **Reachable on any device.** One layout that reflows from a 1440px desktop to a
   360px phone, with touch equivalents for every mouse interaction and keyboard
   equivalents for every touch one.

---

## 2. The world

**Emberfall** is a stack of four 96 × 96 tile *planes*, generated
deterministically from a seed by `shared/world.js`. The map is never
transmitted: both sides run `buildWorld()` and compare a checksum at login.

Plane 0 is the surface. Planes 1–3 are the mine that descends under Copper
Hollow.

| Region | Plane | Location | Contains |
| --- | --- | --- | --- |
| Emberfall Village | 0 | centre | Bank, general store, smithy (furnace + anvil), kitchen (range), fountain, eight townsfolk |
| Whispering Woods | 0 | north | Trees, oaks, willows, forest wolves, goblin scamps |
| Copper Hollow | 0 | west | Copper, tin, iron and coal rocks; cave imps; rock golems; the mine mouth |
| Lake Serene | 0 | east | Shrimp, trout and salmon fishing spots, sandy shore, willows |
| Sunny Meadow | 0 | south | Flowers, giant rats, meadow boars, goblin scamps |
| Copper Hollow Mine | 1 | below | Eight galleries; copper through coal; bats, crawlers, dust sprites; Foreman Dorn |
| The Deep Seam | 2 | below | Eight galleries; mithril, coal, iron; coal lurkers, shale hounds, deep golems, crystal beetles |
| The Ember Chamber | 3 | below | A landing, an approach and one large hall; adamant; ember wisps, cinder guardians, **Cinderheart** |

### Planes

A plane is a sealed world. It owns its own tile array, its own object list and
its own object index; nothing on one plane can see, path to, hit, hear or loot
anything on another. Every entity — player, NPC, ground item, dynamic object,
world object — carries a `plane`, saved and restored with the character.

Every accessor takes the plane as an optional last argument defaulting to the
surface (`tileAt(world, x, y, plane = 0)`), so code that only ever meant the
overworld is unaffected. `findPath` searches one plane and never leaves it: a
ladder is an *action*, not a step, which is what keeps the pathfinder honest.

The mine levels are hand-laid rather than randomly generated — a random cave is
a maze, a designed one is a place. Rooms are named rectangles, corridors are
L-shaped tunnels between named rooms, and the wall ring is derived from whatever
was carved. Everything else stays `VOID`, drawn as nothing at all, so a level
reads as an island of worked stone rather than a rectangle with a border. The
floor plan is exported as `MINE_ROOMS`, so creature spawns and quest steps name
a gallery instead of repeating coordinates.

### Darkness and light

Each plane carries a `dark` value from 0 (daylight) and an `ambient` colour. The
surface is 0; the mine runs 0.55, 0.78 and 0.45 — the Ember Chamber lights
itself. The renderer covers the world in a sheet of the plane's ambient colour
and light sources punch holes in it.

Light comes from the best source a player carries — a torch, a miner's lantern,
Willow's lantern — and the *server* computes the radius and streams it, for the
player and for everyone else in view, so a friend with a lantern lights your way
and a client cannot light its own. Braziers burn at every landing and down the
walls of the boss chamber; campfires light too. A small glow always surrounds
the player, so arriving without a torch is difficult rather than impossible, and
anyone who climbs into the dark empty-handed is told where to buy one.

### Tiles

`GRASS, DARKGRASS, FLOWERS, PATH, GRAVEL, WATER, SAND, STONE, WALL, PLANK,
BRIDGE, CAVE, ROCKFACE, MINE_FLOOR, MINE_WALL, EMBER, CRYSTAL, VOID`. `WATER`,
`WALL`, `ROCKFACE`, `MINE_WALL`, `CRYSTAL` and `VOID` are impassable, as is any
tile holding a blocking object (trees, rocks, furniture) — a felled tree still
leaves a stump in the way. Each mine level has its own floor and wall, so a
glance at the screen tells you how deep you are without a word of interface.

### World objects

Defined in `OBJECT_TYPES` (`shared/world.js`): trees (3 tiers), rocks (6 tiers),
fishing spots (3 tiers), bank booths, shop counter, furnace, anvil, cooking range,
fountain, signposts, braziers, mine carts, ladders, the mine mouth, and
player-created campfires. Each carries a single action descriptor — skill, level,
XP, tool, yield, respawn delay — which is the only place those numbers exist.

Ladders and the mine mouth carry a `link` on the *instance* — which plane and
tile they deliver you to — so the type says only what it looks like and what the
menu entry reads. Each pair points at the other, so climbing either way leaves
you at the foot of the one you would use to go back.

---

## 3. Gameplay systems

### 3.1 Ticks and movement

The world advances every **600 ms**. On each tick a player takes one step
(walking) or two (running). Run energy drains 1.1/tick while running and recovers
0.55/tick otherwise. Paths come from A* over the tile grid
(`shared/engine/pathfinding.js`) with diagonal moves forbidden when either
adjacent orthogonal tile is blocked, so nobody slips through a building corner.
When a target is unreachable, the player walks as close as possible instead of
refusing to move.

### 3.2 Skills

Ten skills: **attack, strength, defence, hitpoints, woodcutting, mining, fishing,
cooking, firemaking, smithing**. Level 1–99 on the classic curve
(`shared/skills.js`): 83 xp for level 2, 1,154 for level 10, 13m for 99.
Hitpoints starts at 10; combat level is `0.25·(def+hp) + 0.325·(att+str)`.

Gathering success per tick:

```
chance = min(0.9, 0.12 + 0.022·(level − requirement) + 0.09·toolPower)
```

so a better axe is felt immediately and a higher level keeps paying off.

### 3.3 Combat

Melee only, one attack every four ticks, one target at a time.

```
attackRoll  = (attackLevel  + styleBonus + 8) · (equipmentAttack  + 64)
defenceRoll = (defenceLevel + styleBonus + 8) · (equipmentDefence + 64)

hitChance = attackRoll > defenceRoll
          ? 1 − (defenceRoll + 2) / (2·(attackRoll + 1))
          : attackRoll / (2·(defenceRoll + 1))

maxHit = floor(0.5 + (strengthLevel + styleBonus + 8)·(equipmentStrength + 64) / 640)
damage = hit ? random integer in [1, maxHit] : 0
```

Four styles trade experience for effect: Accurate (+3 attack), Aggressive
(+3 strength), Defensive (+3 defence), Controlled (split). Experience is
`damage · 4` into the style's skill plus `damage · 1.33` hitpoints.

Creatures are aggressive only if defined so, only within three tiles, and never
towards a character below a third of their level. They give up and walk home if
led more than twelve tiles from their spawn.

**Defeat** knocks a player out for five ticks; they wake at the fountain with full
hitpoints and everything they were carrying. There is no player-versus-player
combat anywhere in the game.

### 3.4 Items and equipment

Inventory is 28 slots; stackable items (coins) share one, everything else takes a
slot each. Ten equipment slots: head, cape, amulet, weapon, body, shield, legs,
gloves, boots, ring. Roughly sixty items spanning tools, ores, bars, logs, fish,
food, bronze/iron/steel gear, and quest pieces (`shared/items.js`). Equipment
requirements are checked server-side on every equip.

### 3.5 Production

* **Firemaking** — use logs with a tinderbox to create a campfire that burns for
  150 ticks and can be cooked on.
* **Cooking** — raw fish on a fire or range; burn chance falls with level and is
  40% lower on a range than on a fire.
* **Smelting** — furnace: copper + tin → bronze; iron (55% success) → iron;
  iron + 2 coal → steel.
* **Smithing** — anvil plus hammer: sixteen recipes from a bronze dagger to a
  steel platebody.

### 3.6 Quests

Eight quests, data-driven in `shared/quests.js`, each a list of stages with a
single objective (`collect`, `kill`, `action` or `talk`). Collect/kill/action
stages advance themselves; `talk` stages wait for the hand-in conversation.

| Quest | Difficulty | Shape | Reward |
| --- | --- | --- | --- |
| Welcome to Emberfall | Novice | Chop → light → catch → cook → report | 250 coins, traveller's cape, 480 xp |
| Willow's Lost Lantern | Novice | Recover lantern glass from cave imps | 400 coins, steel axe, 750 xp |
| Wolves at the Gate | Intermediate | See off five forest wolves | 800 coins, bronze platebody + shield, 3.1k xp |
| The Deep Seam | Experienced | Smelt 4 bronze bars, defeat 2 golems, recover an ancient coin | 1,500 coins, guardian blade, 7.4k xp |
| Lights in the Dark | Novice | Get a torch, climb into the mine, find Foreman Dorn | 600 coins, miner's lantern, 1.2k xp |
| The Foreman's Tally | Intermediate | Clear the upper galleries, mine 8 iron | 1,200 coins, miner's boots, 5.3k xp |
| Deeper Than Dorn Went | Experienced | Reach the Deep Seam, mine and smelt mithril, see off 3 deep golems | 2,500 coins, mithril pickaxe, 17.5k xp |
| The Sleeping Forge | Master | Two ember shards, past the guardians, settle Cinderheart | 6,000 coins, Forge-warden's ring, 60k xp |

The last four form a chain that paces the descent: each requires the one before
it *and* a skill floor, so the mine is walked down a level at a time rather than
sprinted through. A dead-end quest is the worst bug this kind of game can have —
nothing crashes, the player just quietly cannot finish — so the test suite
asserts that every quest in the game is offered by some dialogue, completed by
some dialogue, and names only items, creatures and NPCs that exist.

Conversations are data too (`shared/dialogue.js`): each NPC has entry rules
evaluated against quest state and inventory, then a node graph whose options can
carry effects (`startQuest`, `completeQuest`, `giveItem`, `openShop`, …). The
client only ever reports "I chose option 2", so quest rewards cannot be forged.

### 3.7 Economy and other players

* **Shop** — Bea stocks fifteen lines; stock drifts back toward its baseline every
  30 seconds. Buy at 135% of base value, sell at 55%.
* **Bank** — 120 slots, deposit-all and deposit-worn buttons. Non-stackable items
  are handled across slots, so "deposit all logs" means all of them.
* **Trading** — eight slots each side, both must accept, any change to either
  offer clears both acceptances, and the swap only happens if both inventories
  have room. Cancelling or disconnecting returns every offered item.
* **Social** — public chat with bubbles above heads, six emotes, a nearby-player
  list, and other players' worn equipment visible on their sprite.

---

## 4. User interface

### 4.1 Screens

1. **Title** — server status probe, log in, create character, or play solo.
2. **Character creation** — six appearance dials (skin, hair colour, hair style,
   top, trousers, build) with a live preview drawn by the in-game sprite code.
3. **Game** — the shell described below.

### 4.2 Game shell

```
┌──────────────────────────────┬────────────┐
│  canvas viewport             │  sidebar   │   desktop ≥ 980px
│   ├ orbs (hitpoints, energy) │  ├ tabs    │
│   ├ region label             │  ├ panel   │
│   ├ minimap                  │            │
│   ├ hint bar / action menu   │            │
│   └ dialogue box             │            │
├──────────────────────────────┤            │
│  chat log + entry            │            │
└──────────────────────────────┴────────────┘
```

On screens narrower than 980px the sidebar becomes a bottom sheet that slides up
when a tab is tapped, the chat log shrinks to about a third of the height, and a
column of floating touch buttons (run, chat, panels) appears.

### 4.3 Elements

| Element | Behaviour |
| --- | --- |
| Hitpoints orb | Ring fills with current/max; number in the centre |
| Energy orb | Run energy; click or `R` toggles walking/running |
| Minimap | Terrain rasterised once, entity dots each frame; click to walk |
| View toggle | Options → View switches isometric / top-down, remembered per browser |
| Hint bar | Names the action a left click would perform |
| Action menu | Right click or long press; first entry is the left-click action |
| Inventory | 4 × 7 grid, drag to rearrange, click to use, right click for options |
| Equipment | Body-shaped layout, attack/strength/defence totals, style picker |
| Skills | Ten tiles with level and a progress bar; click for exact xp to next level |
| Quest journal | Status, description, per-stage journal entries, live objective |
| People | Nearby players with a trade button, plus emotes |
| Options | Names, sound, high contrast, larger text, zoom, log out, shortcut list |
| Chat | Four filters (all/game/players/system), 300-line history |
| Windows | Shop, bank, furnace/anvil, trade — one dialog element, `Esc` closes |

### 4.4 Rendering

The default view is **isometric**; a top-down view is one switch away in Options.
The simulation is unaware of either — it only ever deals in tile coordinates, so
the projection lives entirely in `client/js/iso.js` and `renderer.js`.

**Projection.** Tiles are 2:1 diamonds, 64 x 32 at zoom 1:

```
screenX = (tx - ty) * 32        tx = (screenY/16 + screenX/32) / 2
screenY = (tx + ty) * 16        ty = (screenY/16 - screenX/32) / 2
```

Depth is `tx + ty`: anything further south or east is nearer the camera and is
drawn later. Tiles on the same diagonal share a depth and never overlap.

**Art.** There are still no image files. `client/js/isoSprites.js` draws the
isometric set — diamond floors with grain, tufts and slab joints; walls and
cliffs as cubes with a lit top and two shaded faces; trees, rocks, furnaces and
the fountain as props that stand on a diamond footprint; characters in
three-quarter view. One light source, above and to the north-west, drives every
surface through three brightness factors (`FACE.top/left/right`), which is what
makes the scene read as one set of objects rather than a pile of sprites.
`client/js/sprites.js` keeps the top-down art and all the flat UI item icons.

**Anchoring** is a single convention: floors are centred on the tile centre,
props put their bottom edge on the tile's lower vertex (their sprite includes
the footprint), and characters stand with their feet just below the tile centre.

**Facing.** Four directions come from two drawings: a front and a back view,
mirrored horizontally. East and south face the camera; north and west face away.

**Occlusion.** A wall or tree standing between the camera and the player fades
to 42% while it would cover them, so you are never hidden inside your own
building.

**Picking** hit-tests the sprites actually drawn last frame, front to back, per
pixel rather than per rectangle — a signpost is mostly empty space inside its
bounding box, and a box test lets it steal clicks aimed at whoever stands
behind it. Alpha masks are built once per sprite and cached.

**Labels** are suppressed when they would collide with a name already drawn that
frame; your own name and your current target always win.

The renderer runs on `requestAnimationFrame`, easing every entity towards its
last server position (and snapping on teleports), so 600 ms ticks look
continuous. Draw order is floors → depth-sorted solids, props, ground items and
characters → health bars, names, chat bubbles → hit splats → vignette. The
minimap stays top-down in both projections: a map you glance at should be a map.

### 4.5 Accessibility

* Full keyboard play: movement, panels, chat, escape, run toggle.
* Semantic landmarks, `role="tablist"`, `aria-selected`, `aria-live` on the chat
  log, region label and toasts; every icon button has a label.
* Minimum 44px touch targets, visible focus rings, high-contrast theme, larger
  text option, and `prefers-reduced-motion` honoured.
* Colour is never the only signal: health shows a number as well as a ring;
  quest state is written out as well as coloured.

---

## 5. Backend architecture

```
browser
  ├── client/js/main.js ──── SocketTransport ──ws──┐
  └── (offline) SoloTransport → Game (same class)  │
                                                   ▼
                                        server/index.js
                                        ├── http: static + /api/status
                                        ├── websocket.js (RFC 6455, zero deps)
                                        ├── accounts.js (scrypt + JSON store)
                                        └── Game  ← shared/engine/game.js
                                              ├── world (shared/world.js)
                                              ├── entities: players, NPCs, loot
                                              └── 600ms tick loop
```

### 5.1 Server responsibilities

`server/index.js` runs one process with three jobs: serve the client, answer
`/api/status`, and host the world. A `setInterval` at 600 ms calls `game.tick()`
and flushes the engine's outbox, batching all messages for a player into a single
WebSocket frame.

`server/websocket.js` implements the protocol directly on Node's `upgrade` event:
handshake, frame parsing with masking, fragmentation, ping/pong heartbeats, close
handshake, and a 256 KB payload cap.

`server/accounts.js` stores characters in one JSON file, written atomically
(temp file then rename) and debounced by two seconds. Passwords are scrypt hashes
with per-account salts, compared with `timingSafeEqual`.

### 5.2 The engine

`shared/engine/game.js` owns all state and all rules. It has no Node or DOM
imports, which is what lets the browser run it for solo play. Its interface is
four methods: `addPlayer`, `removePlayer`, `handle(playerId, message)`, `tick()`,
plus `drain()` to collect outbound messages. Sub-modules cover pathfinding,
inventory containers, combat maths, quest bookkeeping and the dialogue runner.

### 5.3 Protocol

JSON over WebSocket. Client → server:

| Message | Payload |
| --- | --- |
| `auth` | `mode` (login/register/guest), `name`, `password`, `appearance` |
| `move` | `x`, `y` |
| `interact` | `kind` (npc/object/player/ground_item), `id`, `action` |
| `item` | `op` (use/equip/eat/light/drop/swap/examine), `slot`, `count`/`to` |
| `unequip`, `chat`, `emote`, `style`, `run`, `dialogue` | small, self-describing |
| `shop`, `bank`, `craft`, `trade` | `op` plus slot/id/count |

Server → client: `hello`, `login`, `state` (every tick), `inventory`, `skills`,
`quests`, `msg`, `chat`, `dialogue`, `shop`, `bank`, `craft`, `trade`, `closeUI`,
`effect`, `authError` — delivered inside a `batch` envelope.

A `state` message carries only what the player can see — 17 tiles, **on their own
plane**: self status, nearby players and NPCs, ground items, changed object
states, and this tick's hit splats. Appearance and equipment are versioned per
player and re-sent only when they change or when someone new comes into view;
changing plane clears the version cache in both directions, since from every
other player's point of view you simply vanished.

A `plane` message is sent the instant a ladder is used, ahead of the state
message, so the client can swap levels and snap the camera in the same frame
rather than easing across half the map. It carries the plane's id, name,
darkness and ambient colour.

### 5.4 Data model

```jsonc
{
  "name": "Wren",
  "appearance": { "skin": 1, "hair": 0, "hairColour": 1, "shirt": 1, "legs": 0, "build": 0 },
  "x": 48, "y": 52, "hp": 10, "energy": 100, "run": true, "attackStyle": "accurate",
  "skills": { "attack": 0, "hitpoints": 1154, "woodcutting": 25, "…": 0 },
  "inventory": [{ "id": "bronze_axe", "count": 1 }, null, "…"],
  "bank": ["…"],
  "equipment": { "weapon": { "id": "bronze_sword", "count": 1 }, "…": null },
  "quests": { "welcome": { "stage": 5, "counter": 0, "completed": true } }
}
```

Only experience totals are stored, never levels — retuning the curve cannot
corrupt a character. Quest state is three small fields per quest, so content can
be re-edited without migrating saves.

### 5.5 Scaling notes

The single-file store is deliberate: it keeps first-run setup to one command. It
comfortably holds a few hundred characters. Beyond that, `AccountStore` is the
only thing that needs replacing — its five methods (`load`, `register`,
`authenticate`, `saveCharacter`, `flush`) map directly onto a `players` table.
The tick loop is O(players + NPCs); the per-player state message dominates cost,
which is why it is view-limited and delta-versioned. Multiple worlds would run as
multiple processes behind the proxy, one `Game` each.

### 5.6 Moderation and abuse limits

Two modules, deliberately outside the engine: moderation is about *accounts and
connections*, not about game rules, and keeping it out of `shared/` means the
simulation stays pure and testable.

`server/limits.js` holds every "how much may one stranger do" answer: a sliding
-window counter, a per-address connection cap, and a login throttle that backs
off exponentially and is keyed by address *and* account name. All values are
environment variables (see README).

`server/moderation.js` holds mutes, bans, moderators, reports and the chat
record. Mutes and bans are `{ until, reason, by, at }` keyed by lower-cased
name, written atomically to `moderation.json`; `until: 0` means "until a
moderator lifts it". Reports append to `reports.jsonl` with the last 25 lines of
surrounding chat, including messages the flood guard *blocked* — what someone
tried to say is evidence too. A `ChatGuard` catches flooding and repetition
separately from the general command limit, because forty commands a second is
normal in a fight while eight messages in ten seconds never is.

`server/commands.js` interprets slash commands typed in chat. They are handled
before the message reaches the engine, so a player can never make another
player's client run one.

The chat path for one message is therefore: rate limit → slash command? →
mute check → flood/repeat guard → record for context → engine broadcast.

Chat logging is on by default and disclosed to players on login. For a game
aimed at children, being able to answer "what happened?" is a safety feature;
hiding that it happens would not be. `DM_CHAT_LOG=off` turns it off.

### 5.7 Security

* Everything from the client is treated as hostile: types coerced, indices bounds
  checked, ids resolved against server state, and every action re-validated for
  reach, level, cost and space.
* Rate limit of 40 commands/second per connection (8 before sign-in); oversized
  frames close the socket; unauthenticated sockets are dropped after 45 seconds
  and idle players after 30 minutes.
* Static file serving resolves each path against the document root and refuses
  anything that escapes it; responses carry `nosniff` and frame-options headers.
* No third-party requests, no CDN, no analytics, no cookies — the only stored
  state is the account file on the server and preferences in `localStorage`.

---

## 6. Testing

`npm test` runs 100 tests in Node's built-in runner with a seeded RNG.

* **Engine (32)** — world determinism and fixture reachability, corner-safe
  pathfinding, the experience curve, container rules, combat bounds,
  login/save/restore, gathering and smelting, combat and respawn, quest
  progression and gating, shop and bank arithmetic, the full trade lifecycle,
  chat filtering, and a fuzz-ish pass of malformed commands that must not break
  the tick.
* **Isometric projection (6)** — round-tripping tile ↔ screen, depth ordering.
* **Moderation and abuse limits (18)** — mutes, bans that survive a restart,
  report context, flood and repeat detection, reserved names, connection caps,
  login backoff.
* **Planes, light and the boss (35)** — each mine level is one connected space
  (proved by flood fill), every ladder lands somewhere you can stand, nothing
  sees or hits or hears across a plane, pathfinding never leaves its plane, a
  player can climb the whole way down and back, saves restore underground,
  every creature spawns somewhere walkable and hits exactly as hard as its
  definition says, and a boss's phases fire once each and reset when you walk
  away.
* **Quests (9)** — every quest can be started and finished by *some* dialogue
  and names only things that exist, requirements form a chain with no loop, and
  the whole four-quest mine chain plays through the real engine end to end.

---

## 7. Ideas deliberately left out

Player-versus-player combat, item loss, trading with strangers by whisper, and
any external link — each conflicts with pillar 1. A grand exchange, ranged and
magic combat, party/group play and seasonal events are all natural next steps
that the current data-driven content layer would support without engine changes.

Multi-floor dungeons *were* on this list, and are now the largest feature in the
game; the plane dimension that carries them would also carry building interiors,
a second dungeon, or an upper storey, at the cost of a floor plan and some art.
