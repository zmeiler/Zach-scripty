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

---

## Phase 8 — Moderation and abuse limits

The honest assessment before this phase was that the game had no moderation at
all: a word-list chat filter and nothing else. No report button, no mute, no
kick, no ban, no record of what was said. For a game aimed at children that is
the most serious gap on the list, because the failure mode is not a crash — it
is a child seeing something.

### What players got

A report button in the People panel and in the right-click menu, opening a
window with six plain-language reasons ("Rude or unkind words", "Asking for
personal details"), an optional note, and one line that matters more than the
rest: *if something online upsets you, it is always okay to tell a grown-up you
trust*. The window is opened by the client, not the server, so it appears the
instant something upsetting happens.

A report attaches the last 25 lines of chat automatically. An accusation with no
context puts the moderator in the position of choosing who to believe; a
transcript does not.

### What operators got

Mutes, kicks, bans and moderator promotion as slash commands, with every action
logged with who did it and why, and moderators online pinged when a report
arrives. Bans are checked *before* the password, so a banned player cannot even
learn whether they typed it correctly. State persists to `moderation.json`
atomically, so a restart does not forgive anyone.

### The limits

Nothing above the engine was rate limited before. Now: connections per address,
a much smaller command budget before sign-in, a timeout for sockets that never
authenticate, an idle disconnect, a registration cap per address and in total,
and exponential login backoff keyed by address *and* account name — because
throttling only by address lets someone hammer one account from a phone, and
throttling only by name lets someone try one password against every account.

### Detail: the chat guard is separate from the command limit

A player fighting sends dozens of commands a second and that is fine. Eight chat
messages in ten seconds never is. Two limits, because one number cannot serve
both. Tripping the chat guard auto-mutes for a minute rather than disconnecting:
the fix for an excited nine-year-old is a pause, not an ejection.

### Bug: Modest Pete could not create a character

The reserved-name check refused anything starting with a staff word, so nobody
called **Modest** Pete, Modesty or Devon could play — "mod" and "dev" are three
letters and appear inside ordinary names. Caught by a test asserting that
ordinary names are allowed, which is the assertion people forget to write.

The rule now matches short words exactly and long words anywhere: `mod` must be
the whole name, while `xX_admin` is refused because it *contains* `admin`.
Names are compared after flattening lookalike characters, so `M0derator` and
`Admın` are caught too.

### Verifying it

Eighteen unit tests cover the store and the limiters, and a scripted run drives
two real browsers through the whole thing: the nuisance spams and is
auto-muted, the moderator files a report and reads it back with `/reports`,
mutes them and sees the notice arrive on the other client, then bans them and
watches the reconnect be refused with the reason and expiry. Non-moderators are
told the commands are not theirs, reserved names are refused, and nine wrong
passwords produce "Too many attempts. Please wait 15 seconds."

That last one caught something real: my own test hit the registration cap after
four characters from one address, which is exactly what it is for.

---

## Phase 9 — Depth: a vertical dimension, and a mine to put in it

The world so far was one 96 × 96 grid and everything in the engine quietly
assumed it. The goal of this phase was a mine that goes *down* — three levels,
darkness, ore worth the walk, and something at the bottom worth fighting.

### Deciding what a "plane" is

The engine change is one field, `plane`, on every entity. The design decision
was what that field *means*, and I settled on the strictest reading available: a
plane is a sealed world. Nothing on one plane can see, path to, hit, hear, loot
or trade with anything on another.

That is more restrictive than it strictly needs to be, and it is worth every
line, because the alternative is a long tail of "how did that happen?" bugs —
an aggressive creature following you up a ladder, a click from before the climb
landing on the thing that was under the cursor two seconds ago, a chat message
audible three floors down. Each of those is a guard in a different file, and
each has a test.

The one accommodation to the existing code: every accessor takes the plane as an
*optional last argument* defaulting to the surface. `isWalkable(world, x, y)`
still means what it always meant. That kept the diff to the places that actually
needed to think about depth, and the existing 56 tests passed unchanged.

### Hand-laid, not generated

My first instinct was to generate the mine procedurally, in keeping with the
surface. I wrote the room-and-corridor generator, looked at it, and threw it
away. A random cave is a maze; a designed one is a place. Every room in the mine
now has a reason to exist — an ore face, a junction, a chamber to fight in — and
the corridors are short enough that you always know roughly which way the ladder
is.

The floor plan is exported as `MINE_ROOMS`, so a creature spawn or a quest step
names *the coal face on level two* rather than a pair of numbers that would then
have to be kept in step by hand. Moving a gallery moves everything in it.

### Bug: the wall ring ate the map

Carved floors get a wall drawn around them, and everything else stays `VOID`
(drawn as nothing, so a level reads as an island of worked stone rather than a
rectangle with a border). My first version walked the grid setting any `VOID`
tile next to a floor tile to wall — in place. Each new wall was itself non-void,
so it seeded the next one, and the whole 9,216-tile plane filled in like a flood
fill. 6,578 of 9,216 tiles "carved".

The fix is one word: decide the ring from a snapshot, apply it afterwards. The
symptom was obvious in a single printed number, which is why I printed it.

### Darkness

Each plane carries a darkness value and an ambient colour. The renderer covers
the world in a sheet of that colour and light sources punch holes in it. This
has to happen on a *separate* offscreen canvas, because `destination-out` cuts
through whatever is on the canvas you are drawing to — composite it directly and
you erase the world instead of the shadow.

Light radius is computed by the server and streamed, for the player and for
everyone in view. That is not paranoia about cheating so much as consistency:
one authority for "how far can this person see" means a friend with a lantern
genuinely lights your way, and there is no second implementation to disagree.

Two small decisions made the dark feel fair rather than annoying. A candle-sized
glow always surrounds the player, so arriving without a torch is difficult
rather than impossible. And climbing into the dark empty-handed prints a line
saying so, with where to buy one — nobody should learn they needed a lantern by
walking into a wall.

### Bug: every creature hit twice as hard as its definition said

Balancing the boss, I noticed a player in full adamant losing to it in fifteen
seconds. The boss definition said `maxHit: 18`; it was hitting for 34.

`npcCombatStats` was converting `maxHit` into a strength *bonus* by multiplying
by twelve. Max hit is a function of strength level and strength bonus together,
and an NPC's strength level is its attack level — so the constant only lines up
while the two happen to be similar, which they were for every creature that
existed when the code was written (a level-24 golem, a level-11 wolf). By the
time something attacks at 70, the stated number is meaningless.

The fix is to invert the max-hit formula and solve for the bonus, so `maxHit`
means what it says at any level. A test now asserts it for every creature in the
game, present and future. Several existing creatures got very slightly stronger,
in the direction their own definitions had always claimed.

### Balancing by simulation rather than by feel

Rather than guess at the boss's numbers, I ran the fight — a scripted player at
four gear tiers, eating when low, against the real engine. The first pass said
190 hp was still unwinnable at level 70, because a defence of 62 made the boss
nearly unhittable. Defence came down to 44 and the curve landed where I wanted
it:

| Gear | Level | Result |
| --- | --- | --- |
| Steel | 40 | loses badly |
| Mithril | 50 | loses |
| Adamant | 65 | reaches one third health, loses |
| Adamant | 70 | wins in about 95 seconds |

The same script showed both boss phases firing, which is how I knew the phase
thresholds were placed somewhere a real fight actually reaches.

### The boss looked like a rat

Every NPC was drawn at one size. Cinderheart has 190 hitpoints and a name, and
on screen it was the same 48 × 72 sprite as a giant rat. NPC definitions gained
a `size`, streamed with the rest, and the renderer multiplies by it. How large
something is drawn is the only warning a player gets before they click on it.

While I was there: the aggression message read "The cinderheart takes an
interest in you", because it lowercased the name and prefixed "the". Named
creatures now get a `proper` flag, and a helper decides between *the giant rat*
and *Cinderheart*.

### Quests: testing for the bug that does not crash

The four new quests walk a player down the shaft one level at a time. The
interesting part was the test.

A broken quest is the worst kind of bug in a game like this, because nothing
crashes — the player simply, quietly, cannot finish. So before playing the chain
through, the suite walks every dialogue tree in the game collecting every effect,
and asserts that each of the eight quests is offered by *some* conversation and
completed by *some* conversation, and that every item, creature and NPC any quest
names actually exists. Those five assertions would have caught a typo in a node
id that no amount of playing the *new* content would have revealed.

Then it plays the whole chain: Mira's first line, the torch, the climb, Dorn,
six bats, four crawlers, eight iron, the second ladder, three mithril, a bar,
three golems, two ember shards, three guardians, Cinderheart, and the
Forge-warden's ring.

### Verifying it

Beyond the 100 unit tests: a scripted browser walked from the fountain to the
mine mouth, clicked down through all three levels and back up to the surface,
with no console errors; a second run screenshotted each level lit and unlit; a
third fought the boss through both phases by clicking its sprite. Reading those
screenshots is what found the boss-size problem and the "the cinderheart"
wording, neither of which any test would have flagged.

### Bug: "Dungeon not visible"

Three words of feedback, and the most useful of the project. The mine rendered
perfectly. It was also, in practice, invisible: a small brown timbered prop
twenty tiles into the far-west quarry, low-contrast against brown gravel among
forty rock props, unmarked on the minimap, mentioned by nobody unless you had
already finished a multi-hour quest chain.

I had built the content and never built the road to it. The fix was four things,
none of them in the engine:

* **Move it.** The mouth now sits three tiles inside the quarry on the road line,
  straight ahead as you arrive from the village, with a gravel path leading in.
* **Make it loud.** Heavier timbers, a lamp burning on the lintel, a glow from
  the shaft, and a brazier either side. The flame is the part that works — a
  moving light is the one thing on a screen of grey rock the eye goes to.
* **Put it on the map.** The minimap now marks any object carrying a `link`, on
  every plane, orange for down and blue for up. Underground this turned out to
  matter even more than on the surface.
* **Say it out loud.** Tutor Pip and Miner Mira both mention the shaft to a
  character who has done nothing at all, and the signposts name it.

Each of those is now a test, because "is this findable?" is exactly the kind of
property that decays silently. The lesson generalises: I verified the mine by
teleporting a scripted player to the entrance, which tested everything except
the only question a real player asks first — *where is it?*

---

## What I would do next

1. **Persistence**: swap the JSON store for SQLite. `AccountStore`'s five methods
   are the whole surface that changes.
2. **Bandwidth**: the per-tick state message re-sends positions for everything in
   view. Sending only entities whose position changed would cut it several-fold
   before it ever matters.
3. **Content**: the plane dimension that carries the mine would carry a second
   dungeon, building interiors or an upper storey at the cost of a floor plan
   and some art — the engine work is done.
4. **Testing**: the browser playthrough is a script in the scratchpad. Promoting
   it into the repository as a smoke test would catch UI regressions the unit
   tests cannot see — it is what caught the worst bugs in this project, including
   both isometric ones.
5. **Art**: the isometric set has one obvious gap — buildings have walls but no
   roofs, because a roof would need either a cutaway or a fade of its own. The
   occlusion fade already in place is the hook that would make it work.
