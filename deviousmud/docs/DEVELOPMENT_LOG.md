# Development log

A record of how DeviousMud was built, in the order the decisions were actually
made, including the things that broke and what fixed them.

---

## Phase 1 — Deciding the shape of the thing

The brief asked for a browser MMORPG with character creation, exploration,
quests and other players, plus a backend and setup documentation. Three early
decisions shaped everything else.

**No dependencies, no build step.** Anything that needs `npm install` before it
runs is one broken lockfile away from not running at all. The cost is writing a
WebSocket server and an art pipeline by hand; the benefit is `git clone && npm
start`, on any machine with Node 18+, forever.

**No asset files.** Sprite sheets are the single largest source of licensing
trouble in a hobby game. Drawing every tile, character and item icon with canvas
primitives keeps the repository text-only and the download tiny. The trade-off is
a chunky retro look, which suits a tile game.

**One engine, two hosts.** Rather than writing a "demo mode" that imitates the
game, the simulation lives in `shared/engine/game.js` with no Node or DOM imports
so the browser can instantiate the same class the server runs. Offline play is
then the real game, and there is exactly one place where rules live.

---

## Phase 2 — World and engine

### Challenge: shipping a 9,216-tile map to every client

Sending the map is wasteful, and storing it as a data file makes it tedious to
edit. **Solution:** generate it. `buildWorld(seed)` paints regions, carves a lake
with a wobbled ellipse, cuts a quarry, lays roads, drops in four buildings and
scatters resources with a seeded PRNG. Both sides run it; the server sends only a
checksum at login, and the client warns in the console if it disagrees (a stale
cached build). The determinism is covered by a test that builds the world twice
and compares checksums.

### Challenge: proving the generated world is actually playable

Procedural generation can happily wall a shop inside a rock. **Solution:** a test
that A*-pathfinds from the spawn point to every village fixture and asserts the
path ends adjacent to it. It caught an early layout where the quarry's rock wall
sealed the mine off entirely — the fix was to paint the main road *after* the
quarry so it cuts a doorway through the wall.

### Challenge: characters slipping through building corners

The first pathfinder allowed any diagonal step, so players cut across the corner
of the bank. **Solution:** a diagonal step is legal only when both adjacent
orthogonal tiles are also clear (`canStep` in `pathfinding.js`).

### Challenge: unreachable click targets feeling broken

Clicking a tree across a lake originally did nothing at all. **Solution:** when A*
exhausts its budget it returns the path to the closest node it reached, so the
character walks as far as it sensibly can — the same forgiving behaviour the games
this one takes after have.

---

## Phase 3 — The server

### Challenge: WebSockets without a library

`ws` is 20 files of well-tested edge cases, and re-implementing it is the sort of
thing that looks easy until a browser sends a fragmented frame. **Solution:**
implement the parts a game client actually uses — handshake with the SHA-1 accept
key, masked frame parsing, continuation frames, ping/pong, close handshake — with
a 256 KB payload cap so a hostile client cannot make the server allocate
unbounded memory. Roughly 200 lines in `server/websocket.js`.

### Bug: one closed browser tab took the whole server down

Closing a tab mid-frame produces `ECONNRESET` on the socket. The connection class
re-emitted it as an `error` event, and `EventEmitter` throws when `error` has no
listener — so the process exited and every other player was disconnected. Found
by watching the server log after a scripted browser test closed its pages.

**Solution:** connections attach their own no-op `error` listener at construction
(so an unhandled emit can never throw), the socket error path now runs the same
close bookkeeping as a clean close, and the server logs anything that is not a
routine reset. This is the single most valuable bug the automated playthrough
found.

### Challenge: client modules 404ing at the site root

Serving `client/index.html` at `/` broke every relative import: the browser
resolved `./css/styles.css` to `/css/styles.css`, and `../../shared/...` to
somewhere above the root. **Solution:** redirect `/` to `/client/` and serve the
project root, so the client sits at its real path and `shared/` resolves exactly
as it does on disk. Path traversal is blocked by resolving each request against
the document root and rejecting anything that escapes it.

---

## Phase 4 — The client

### Challenge: making 600 ms ticks look like a game

A tick-based server updates positions six hundred milliseconds apart, which reads
as teleporting. **Solution:** the renderer keeps a `renderX/renderY` per entity
and eases it towards the authoritative position each frame, with a snap threshold
so a respawn does not slide the character across the map. The camera follows the
player with the same easing.

### Bug: every inventory icon was blank

Item sprites are cached as offscreen canvases, and the UI put them into slots with
`canvas.cloneNode(true)`. That copies the element and its size — but not a single
pixel, because canvas contents are not part of the DOM. The first screenshot
showed 28 empty boxes with only the coin quantity visible.

**Solution:** a `spriteElement()` helper that creates a fresh canvas and
`drawImage`s the cached bitmap into it. The cache still does the expensive drawing
once per item.

### Challenge: one interaction model for mouse and touch

Right click has no touch equivalent, and long-press has no mouse equivalent.
**Solution:** one rule, both inputs. Left click or tap performs the primary
action; right click or a 420 ms press opens the full menu, whose first entry is
always that same primary action. The hint bar names the primary action on hover
so a mouse player always knows what a click will do.

---

## Phase 5 — Playing it, and fixing what playing revealed

A headless Chromium script drives a real character through the game — register,
talk to the mayor, take the quest, chop a tree, buy from Bea, bank, walk to the
meadow and fight — while a second browser logs in as another player. It asserts no
console errors and screenshots each step. Nearly every remaining bug came from
looking at those screenshots.

### Bug: "deposit all" deposited one item

Non-stackable items occupy one slot each, and the bank/trade code worked on the
clicked slot only. So "deposit all logs" moved a single log, and withdrawing ten
gave one back. **Solution:** deposit, withdraw and trade-offer now operate on the
item *id* across all slots, capped by what will fit. Three tests now pin this
behaviour, since it is exactly the kind of thing that quietly regresses.

### Bug: rock golems mugging brand-new characters

The mining test failed intermittently. The cause was not mining: the first copper
rock in the world happens to sit deep in Copper Hollow, and a level-3 character
walking there was flattened by an aggressive level-24 golem before swinging a
pickaxe. **Solutions**, both worth having: aggressive creatures now ignore anyone
below a third of their level and only notice players within three tiles, and two
starter rocks sit beside the village so the first ore never requires a dangerous
walk. The test now uses those, which is also the route a real beginner takes.

### Bug: the meadow looked like a rat farm

The first combat screenshot showed roughly thirty creatures on one screen, each
with a name label, and a minimap covered in red dots. **Solution:** halve the
spawn grids and widen their spacing, and only label a creature when it is within
six tiles or is the player's current target. Townsfolk stay labelled always.

### Smaller fixes from the same pass

* The fountain was invisible: a pale grey basin on a pale grey square. Given a
  dark rim and a brighter pool.
* Characters read as too small against 32px tiles; sprites now draw at 115% tile
  width with the feet anchored to the tile.
* Registration errors ("that name is already taken") surfaced correctly, which the
  script confirmed by accident when it reran with the same character name.

---

## Phase 6 — Content and safety

Quests are data (`shared/quests.js`) and so are conversations
(`shared/dialogue.js`): an NPC has entry rules evaluated against quest state and
inventory, and options carrying effects. Adding a quest is a data edit, not an
engine change. Because the client only reports which option index it chose, quest
rewards cannot be forged by a modified client.

The family-friendly requirement is enforced in code rather than by hoping: the
server filters URLs, email addresses, phone numbers and unkind words out of chat
before other players see them; there is no player-versus-player combat; defeat
never costs items; and the game makes no third-party requests at all.

---

---

## Phase 7 — Going isometric

The flat top-down view worked, but it read as a map rather than a place. Turning
the camera was a contained change *because* of the earlier architecture: the
engine only ever deals in tile coordinates, so nothing in `shared/` moved. The
work was projection maths, a new art set, and picking.

### The projection

Tiles became 2:1 diamonds — `screenX = (tx-ty)·32`, `screenY = (tx+ty)·16` — with
depth `tx + ty`, so anything further south or east draws later. `client/js/iso.js`
holds the maths and nothing else, which means it has no DOM imports and the whole
projection is unit-testable in Node: six tests now cover the round trip from tile
to screen and back, depth ordering, and the shading helper.

### Custom isometric art

`client/js/isoSprites.js` is a second art set drawn for the new angle: diamond
floors with grain and slab joints, walls and cliffs as cubes with a lit top and
two shaded faces, props standing on a diamond footprint, and characters in
three-quarter view. One decision does most of the work — a single light source
above and to the north-west, expressed as three brightness factors that *every*
surface uses. Without that, hand-drawn shapes look like a pile of unrelated
sprites; with it, they look like one world.

Four facings come from two drawings: a front and a back view, mirrored. East and
south face the camera, north and west face away.

### Bug: buildings that looked like kerbs

The first render had walls that read as low steps, not walls. The cube sprite was
sized `ISO_TILE_H + height + ISO_TILE_H/2` but its faces were drawn from an
offset that pushed the bottom of the block past the canvas edge, so every wall
was silently cropped. Fixed by deriving the geometry from one rule — the sprite
is exactly `ISO_TILE_H + height` tall and its lowest point sits on the bottom
edge — which is the same anchoring rule the props already used.

### Bug: a signpost stealing clicks meant for an NPC

The new picking hit-tested the sprites drawn last frame, front to back, using
their bounding boxes. But a signpost is a thin post inside a 64 x 94 box that is
almost entirely transparent, and it draws after the tile behind it — so clicking
Tutor Pip, who stands next to one, read the signpost instead. The scripted test
caught it as "dialogue never opened", and the screenshot showed why: the wrong
tile highlighted, and the signpost's text in the chat log.

**Solution:** per-pixel picking. Each drawable now records the sprite it drew
with, and the pick maps the cursor into sprite space (mirroring when the sprite
was flipped) and reads an alpha mask before accepting the hit. Masks are built
once per sprite and cached in a `WeakMap`, so it costs one `getImageData` per
distinct sprite for the life of the page. Clicking the signpost's actual post
still selects the signpost.

### Occlusion and labels

Two smaller touches that matter more than they sound. A wall or tree between the
camera and the player fades to 42% while it would cover them, so you are never
lost inside your own building. And names are suppressed when they would overlap
one already drawn that frame — before that, standing next to Banker Cyrus
rendered the two names on top of each other as an unreadable smear.

The top-down renderer was kept and is one switch away in Options, which also
means the projection-independent parts of the renderer are exercised both ways.

---

## What I would do next

1. **Persistence**: swap the JSON store for SQLite. `AccountStore`'s five methods
   are the whole surface that changes.
2. **Bandwidth**: the per-tick state message re-sends positions for everything in
   view. Sending only entities whose position changed would cut it several-fold
   before it ever matters.
3. **Content**: the engine already supports everything a fifth quest needs; the
   world has room for a proper mine interior once multi-level maps exist.
4. **Testing**: the browser playthrough is a script in the scratchpad. Promoting
   it into the repository as a smoke test would catch UI regressions the unit
   tests cannot see — it is what caught the worst bugs in this project, including
   both isometric ones.
5. **Art**: the isometric set has one obvious gap — buildings have walls but no
   roofs, because a roof would need either a cutaway or a fade of its own. The
   occlusion fade already in place is the hook that would make it work.
