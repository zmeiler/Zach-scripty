# Group play — design proposal

**Status:** proposal, awaiting review. No code written.

---

## 1. The problem, measured

DeviousMud has multiplayer plumbing — you can see other players, chat with them
and trade with them — but there is no activity in the game that two people do
*together*. Every skill, every fight and every quest is solo; other players are
scenery.

That gap is measurable. Two identically-equipped level-70 characters were put in
front of Cinderheart in the real engine:

| | Solo | Two players |
| --- | --- | --- |
| Fight length | 157 ticks (~95 s) | 97 ticks (~58 s) |
| Times the boss hit player A | — | **26** |
| Times the boss hit player B | — | **1** |
| Loot owned by | the soloist | **all four drops to A**, who landed the last hit |

Three separate faults in one run:

1. **No threat.** `npc.targetId` holds a single player id, chosen once and kept
   until that player dies or leaves. The second player is never attacked, so the
   fight is not harder with two — it is *easier per person*, and the second
   player is functionally invulnerable.
2. **No shared reward.** `defeatNpc(player, npc)` credits loot to the single
   `player` argument — whoever landed the killing blow. The other participant
   gets nothing, and `recordEvent(player, 'kill', ...)` means they get no quest
   credit either.
3. **No group.** There is no way to say "we are doing this together", so the
   engine has nothing to reason about even if it wanted to.

The consequence beyond the boss: the endgame I just built is tuned for one
person at combat level 70 in full adamant. Most players will never get there
alone, and there is currently no way for three friends at level 45 to get there
at all.

**Experience XP is the one thing that already works.** `tickPlayerCombat` awards
XP to whoever dealt the damage, proportionally. That behaviour is correct for
groups and needs no change — it is worth stating explicitly so it does not get
"fixed".

---

## 2. What this proposal is

Five things, in dependency order:

1. A **party** — an explicit group of up to five, with invites, a panel and a
   chat channel.
2. A **threat table** on every creature, replacing the single target, so a fight
   has roles.
3. **Loot and quest credit** that belong to everyone who fought, not to whoever
   landed the last hit.
4. **Boss scaling** by party size, so Cinderheart becomes reachable for a group
   at a lower level than a soloist needs.
5. **Party awareness** — seeing your friends on the minimap and in a panel
   wherever they are, including a level below you.

---

## 3. Design decisions, and why

### 3.1 Threat is damage plus your combat style

The obvious implementation of aggro is a damage table: whoever has hit hardest
gets attacked. That alone gives a group *a* dynamic, but not roles — the best
damage dealer is always the one being hit, which is backwards.

Every other game solves this with a taunt button. **I would rather not add a
button.** The game already has four combat styles that nobody has a strong
reason to switch between, and Defensive is currently the least interesting of
them. So:

```
threat added = damage dealt × styleWeight
    accurate    1.0
    aggressive  1.0
    controlled  1.0
    defensive   1.8
```

A player on Defensive style attracts nearly twice the attention for the same
damage, and takes less of it because their defence bonus applies. That is a tank
— built entirely out of a mechanic that already exists, discovered by playing
rather than by reading, and with a real trade-off (you give up attack or
strength XP to hold aggro).

Two supporting rules:

* **Decay.** Threat multiplies by 0.98 each tick, so a fight re-evaluates
  rather than locking in whoever hit first.
* **Hysteresis.** The creature only switches target when a challenger exceeds
  the current target's threat by 20%. Without this, two similar players make the
  creature flip target every tick, which looks broken and feels random.

**Solo behaviour must not change.** A one-entry threat table has to behave
exactly as today's single target does — same aggro radius, same leash, same
"the wolf takes an interest in you". This is the single biggest regression risk
in the proposal and the existing 104 tests are the safety net.

### 3.2 Loot belongs to everyone who fought

Currently a ground item has one `owner` and a 60-second private window. The
change is that `owner` becomes a list, populated at the moment of the kill from
the threat table — everyone who dealt damage, on the same plane.

For **unique drops** (the boss's blade, cape and amulet) one list is not enough:
four people cannot each take the one blade. Those entries get an explicit
`unique: true` flag and are assigned to a single player, chosen at random
**weighted by damage dealt**, with the result announced in party chat:

> *Cinderheart drops an emberforged blade. It goes to Rowan.*

I considered a rolling or bidding system and rejected it. This game is meant to
be readable over a child's shoulder; loot councils and dice rolls generate
exactly the kind of argument it should not host. Contribution decides, the
result is stated plainly, and there is nothing to negotiate.

**Ownership is computed at kill time from the threat table, not from current
party membership.** That closes the obvious abuse — a leader cannot kick people
the instant the boss dies and take the drops.

### 3.3 Quest credit goes to everyone who fought

`recordEvent(player, 'kill', type)` fires for every player in the threat table
on the creature's plane. Three friends doing *The Foreman's Tally* together each
get their six bats.

Requiring *damage dealt* rather than *party membership* means someone standing
at the ladder doing nothing gets no credit, without needing an anti-leech rule
of its own.

### 3.4 Bosses get more health, not harder hits

Party size is counted when the fight is engaged and locked for its duration:

```
hp      × 1 + 0.55 × (n − 1)      capped at n = 5   →  up to ×3.2
summons × n                        (wisps, at each phase)
maxHit  unchanged
```

Scaling health and adds but **not** damage is a deliberate family-friendly
choice: a bigger group makes the fight *longer and busier*, not more punishing.
A child in a party of four should not be one-shot because their friends turned
up.

Locking at engagement (rather than recounting continuously) means a group cannot
inflate the boss and then have everyone log out, and cannot shrink it by having
people step outside mid-fight. It resets with the boss.

These numbers are guesses and will be tuned the same way the solo fight was —
by simulating it at several party sizes and gear tiers, not by feel.

### 3.5 Parties cross planes; the benefits do not

You stay in a party when a friend climbs a ladder — you can still see where they
are and talk to them, which is exactly when you most want to. But threat, loot
and kill credit all require being on the same plane, because a plane is a sealed
world and that rule has earned its keep.

---

## 4. Safety and moderation

A party is a new social surface, so it gets the same treatment as the others:

* **Invites are rate limited** — `DM_PARTY_INVITES_PER_MIN`, default 6, using
  the existing `SlidingWindow`. Invite spam is a harassment vector.
* **An invite is a prompt, never a teleport or an automatic join.**
* **Party chat goes through `filterChat` and the `ChatGuard`** exactly like
  public chat, is refused from muted players, and is recorded in `chat.log` with
  its channel — so a moderator reviewing a report sees the party conversation
  too. Players are already told chat is recorded.
* **`/report` works on party members**, and the report's chat context includes
  party lines.
* **No loot drama by construction** — see 3.2.

---

## 5. What changes, file by file

| File | Change |
| --- | --- |
| `shared/constants.js` | `PARTY_SIZE = 5`, `CHAT_CHANNELS += 'party'`, threat decay/hysteresis/style-weight constants |
| `shared/engine/party.js` | **new** — `Party` and `PartyRegistry`: membership, leader, invites, disband |
| `shared/engine/threat.js` | **new** — the threat table, decay, target selection with hysteresis |
| `shared/engine/game.js` | replace `npc.targetId` with a threat table; loot ownership; kill credit; boss scaling; `cmdParty` |
| `shared/engine/combat.js` | `threatWeight(styleId)` |
| `shared/npcs.js` | `unique: true` on the three Cinderheart uniques |
| `client/js/state.js` | party state, `party` message, party chat channel |
| `client/js/actions.js` | `party` commands (invite/accept/decline/leave/disband) |
| `client/js/ui/panels.js` | party section at the top of the People panel: members, health bars, plane, leave |
| `client/js/ui/chat.js` | a Party tab beside All/Game/Players/System |
| `client/js/ui/menu.js` | "Invite to party" in the right-click menu on a player |
| `client/js/renderer.js` | party members on the minimap at any distance on the same plane |
| `server/index.js` | invite rate limit; party chat through the guard and the log |
| `tests/party.test.js` | **new** |

`shared/engine/game.js` is the only large diff, and most of it is the threat
change rippling through the combat paths.

---

## 6. Phases

Each lands as its own commit, tested and verified before the next starts — the
same shape as the mine.

1. **The party itself.** Invite, accept, decline, leave, disband, leader
   handover. Party panel and party chat channel. Nothing about combat yet; at
   the end of this phase you can group up and talk, and that is all.
2. **Threat.** Replace the single target everywhere. Solo behaviour verified
   unchanged before anything group-specific is layered on.
3. **Shared loot and kill credit.**
4. **Boss scaling**, tuned by simulation at party sizes 1–5.
5. **Party awareness** — minimap markers, health bars, "on the level below you".
6. **Docs, and verification in three real browsers at once.**

---

## 7. How it gets tested

Around twenty new tests, plus a browser run:

**The party** — invites need consent; you cannot invite yourself, someone
already in a party, or a sixth member; leaving as leader hands over rather than
disbanding; the last member out disbands it; a disconnect removes you.

**Threat** — a solo fight behaves exactly as before; the highest-damage player
is attacked; Defensive style pulls the target off a higher-damage attacker;
target does not flicker between two similar players; threat decays; climbing a
ladder or dying drops you off the table entirely.

**Loot and credit** — every damage dealer can pick up the drops immediately
while a bystander waits out the private window; a unique goes to exactly one
player and is announced; kill credit reaches every damage dealer's quest log but
not a bystander's; being kicked after the kill does not remove your loot.

**Scaling** — the boss's health scales with the party engaged, resets on wipe,
and does not change mid-fight when someone leaves.

**Safety** — invite flooding is refused; a muted player cannot party-chat;
party chat is filtered and recorded.

**In the browser** — three tabs, one party: invite and accept, fight Cinderheart
together, watch the target switch when someone goes Defensive, and check each
tab can pick up its own loot.

---

## 8. Risks and open questions

* **The threat change touches every combat path.** `tickNpc`, `tickNpcCombat`,
  `startCombat`, `defeatNpc`, `knockOut`, `climb` and the boss reset all read or
  write `targetId` today. The mitigation is that phase 2 changes *only* the
  representation and must leave all 104 existing tests green before any
  group-specific behaviour is added.
* **Scaling numbers are guesses** until simulated. If a party of five at level
  45 trivialises the boss, the coefficient moves; that is a one-line change and
  the simulation harness already exists.
* **Parties are transient.** They do not survive a server restart and are not
  saved with a character. That seems right for a game of this size — a
  persistent clan is a different feature — but it is a decision worth naming.
* **Solo mode.** Parties are meaningless in offline play. The People panel
  should say so plainly rather than showing a dead Invite button.
* **Trade and party overlap.** Leaving a party mid-trade must not cancel the
  trade, and vice versa; they are independent.

---

## 9. Explicitly not in this proposal

Player-versus-player combat, loot rolling or bidding, persistent clans or
guilds, instanced dungeons, voice chat, and party-only content. The first two
conflict with the game's first design pillar; the rest are larger features that
this work does not block and would be easier to add afterwards.
