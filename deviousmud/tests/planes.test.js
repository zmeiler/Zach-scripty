/**
 * Tests for the vertical dimension.
 *
 * The rule the whole feature rests on is simple: a plane is a sealed world.
 * Nothing sees, paths to, hits or hears anything on another level, and the only
 * way between two levels is a ladder. Most of what follows is that rule, poked
 * from a different angle each time.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../shared/engine/game.js';
import { findPath } from '../shared/engine/pathfinding.js';
import { OBJECT_TYPES, buildWorld, checksumWorld, isWalkable, makeRng, planeAt, planeDarkness, planeLights, objectAt, regionAt } from '../shared/world.js';
import { PLANE_COUNT, SPAWN_POINT, SURFACE, TILE, VIEW_RADIUS } from '../shared/constants.js';
import { NPC_TYPES } from '../shared/npcs.js';
import { getItem } from '../shared/items.js';
import { SMELTING, SMITHING } from '../shared/crafting.js';
import { maxHit, npcCombatStats } from '../shared/engine/combat.js';

function newGame() {
  return new Game({ world: buildWorld(), rng: makeRng(4242) });
}

/** Every tile you can stand on that is reachable on foot from (x, y). */
function floodFill(world, plane, x, y) {
  const seen = new Set([`${x},${y}`]);
  const queue = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !isWalkable(world, nx, ny, plane)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function ladderOn(world, plane, type) {
  return planeAt(world, plane).objects.find((obj) => obj.type === type);
}

// ------------------------------------------------------------------- shape

test('the world is a stack of planes with the surface at the bottom of the list', () => {
  const world = buildWorld();
  assert.equal(world.planes.length, PLANE_COUNT);
  assert.equal(world.planes[SURFACE].id, 'surface');
  // The surface aliases still point at plane 0, so old callers are unaffected.
  assert.equal(world.tiles, world.planes[SURFACE].tiles);
  assert.equal(world.objects, world.planes[SURFACE].objects);
  assert.ok(world.allObjects.length > world.objects.length, 'the mine adds objects of its own');
});

test('every mine level is one connected space', () => {
  const world = buildWorld();
  for (let plane = 1; plane < PLANE_COUNT; plane += 1) {
    const ladder = ladderOn(world, plane, 'ladder_up');
    assert.ok(ladder, `plane ${plane} needs a way back up`);

    const reachable = floodFill(world, plane, ladder.x, ladder.y);
    let walkable = 0;
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) if (isWalkable(world, x, y, plane)) walkable += 1;
    }
    assert.equal(reachable.size, walkable, `plane ${plane} has an unreachable pocket`);
    assert.ok(walkable > 300, `plane ${plane} is too small to be worth visiting`);
  }
});

test('the mine is carved out of solid rock, not laid on an empty grid', () => {
  const world = buildWorld();
  for (let plane = 1; plane < PLANE_COUNT; plane += 1) {
    const tiles = planeAt(world, plane).tiles;
    let voids = 0;
    for (const tile of tiles) if (tile === TILE.VOID) voids += 1;
    assert.ok(voids > tiles.length * 0.5, `plane ${plane} should be mostly undug rock`);
  }
});

test('every ladder lands somewhere you can stand', () => {
  const world = buildWorld();
  const links = world.allObjects.filter((obj) => obj.link);
  assert.ok(links.length >= 5, 'surface down, and a pair between each level');
  for (const ladder of links) {
    assert.ok(
      isWalkable(world, ladder.link.x, ladder.link.y, ladder.link.plane),
      `${ladder.type} at ${ladder.x},${ladder.y} drops you inside a wall`
    );
    // The tile it points at holds the ladder you would use to come back.
    const partner = objectAt(world, ladder.link.x, ladder.link.y, ladder.link.plane);
    assert.ok(partner, 'a ladder should face another ladder');
    assert.equal(partner.link.plane, ladder.plane);
  }
});

test('the mine is reachable from the village on foot', () => {
  const world = buildWorld();
  const entrance = world.mineEntrance;
  assert.ok(entrance, 'Copper Hollow needs a mouth');
  const path = findPath(world, SPAWN_POINT.x, SPAWN_POINT.y, entrance.x, entrance.y, { range: 1, plane: SURFACE });
  assert.ok(path.length > 0, 'you should be able to walk to the mine entrance');
});

test('each plane names itself', () => {
  const world = buildWorld();
  assert.equal(regionAt(world, SPAWN_POINT.x, SPAWN_POINT.y, SURFACE).name, 'Emberfall Village');
  assert.equal(regionAt(world, 40, 40, 1).name, 'Copper Hollow Mine');
  assert.equal(regionAt(world, 40, 40, 3).name, 'The Ember Chamber');
});

// ------------------------------------------------------------- pathfinding

test('pathfinding never leaves the plane it started on', () => {
  const world = buildWorld();
  const ladder = ladderOn(world, 1, 'ladder_up');
  // The mine coordinates are open rock on the surface, and vice versa: asking
  // for a route on the wrong plane must not accidentally succeed.
  const wrongPlane = findPath(world, ladder.x, ladder.y, SPAWN_POINT.x, SPAWN_POINT.y, { plane: 1 });
  for (const step of wrongPlane) {
    assert.ok(isWalkable(world, step.x, step.y, 1), 'every step must be walkable on the search plane');
  }
  // A* walks as close as it can when the goal is unreachable, so the test is
  // that it never actually arrives - not that it refuses to move.
  const arrived = wrongPlane.some((step) => step.x === SPAWN_POINT.x && step.y === SPAWN_POINT.y);
  assert.equal(arrived, false, 'the village is not reachable from inside the mine');
});

// -------------------------------------------------------------- travelling

test('a player can climb all the way down and all the way back', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  const entrance = game.world.mineEntrance;
  player.x = entrance.x + 1;
  player.y = entrance.y;

  game.handle('p1', { t: 'interact', kind: 'object', id: entrance.id, action: 'climb' });
  game.tick();
  assert.equal(player.plane, 1, 'entering the mine puts you on the first level');
  assert.ok(isWalkable(game.world, player.x, player.y, 1));

  for (let plane = 1; plane <= PLANE_COUNT - 2; plane += 1) {
    const down = ladderOn(game.world, plane, 'ladder_down');
    game.handle('p1', { t: 'interact', kind: 'object', id: down.id, action: 'climb' });
    for (let i = 0; i < 200 && player.plane === plane; i += 1) game.tick();
    assert.equal(player.plane, plane + 1, `should have descended to plane ${plane + 1}`);
  }

  for (let plane = PLANE_COUNT - 1; plane >= 1; plane -= 1) {
    const up = ladderOn(game.world, plane, 'ladder_up');
    game.handle('p1', { t: 'interact', kind: 'object', id: up.id, action: 'climb' });
    for (let i = 0; i < 240 && player.plane === plane; i += 1) game.tick();
    assert.equal(player.plane, plane - 1, `should have climbed to plane ${plane - 1}`);
  }
  assert.equal(player.plane, SURFACE);
  assert.equal(player.x, game.world.mineEntrance.x);
});

test('the state stream stops at the edge of your own level', () => {
  const game = newGame();
  const above = game.addPlayer('a', { name: 'Above' });
  const below = game.addPlayer('b', { name: 'Below' });

  // Same tile, different levels: the only thing separating them is the plane.
  above.x = below.x = 40;
  above.y = below.y = 44;
  below.plane = 1;

  game.drain();
  game.tick();
  const messages = game.drain().filter((entry) => entry.msg.t === 'state');
  const forAbove = messages.find((entry) => entry.to === 'a').msg;
  const forBelow = messages.find((entry) => entry.to === 'b').msg;

  assert.deepEqual(forAbove.players.map((p) => p.id), ['a'], 'the player underground is not visible');
  assert.deepEqual(forBelow.players.map((p) => p.id), ['b']);
  assert.equal(forBelow.self.plane, 1);
  // Villagers stand on the surface, so nobody underground should see one - but
  // the mine has creatures of its own, and those are exactly what you should see.
  const surfaceOnly = new Set([...game.npcs.values()].filter((npc) => npc.plane === SURFACE).map((npc) => npc.id));
  assert.equal(forBelow.npcs.some((npc) => surfaceOnly.has(npc.id)), false);
  assert.equal(forAbove.npcs.every((npc) => surfaceOnly.has(npc.id)), true);
});

test('a click cannot reach through the floor', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  player.plane = 1;
  const ladder = ladderOn(game.world, 1, 'ladder_up');
  player.x = ladder.x;
  player.y = ladder.y;

  // A signpost on the surface, several planes away from where the player is.
  const signpost = game.world.objects.find((obj) => obj.type === 'signpost');
  game.handle('p1', { t: 'interact', kind: 'object', id: signpost.id, action: 'read' });
  assert.equal(player.pending, null, 'an object on another plane is not a legal target');

  // And an NPC.
  const villager = [...game.npcs.values()].find((npc) => npc.plane === SURFACE);
  game.handle('p1', { t: 'interact', kind: 'npc', id: villager.id, action: 'talk' });
  assert.equal(player.pending, null);
});

test('chat carries only as far as the level you are standing on', () => {
  const game = newGame();
  const above = game.addPlayer('a', { name: 'Above' });
  const below = game.addPlayer('b', { name: 'Below' });
  above.x = below.x = 40;
  above.y = below.y = 44;
  below.plane = 1;

  game.drain();
  game.handle('a', { t: 'chat', text: 'hello down there' });
  const heard = game.drain().filter((entry) => entry.msg.t === 'chat');
  assert.deepEqual(heard.map((entry) => entry.to), ['a'], 'only the shouter hears it');
});

test('climbing a ladder ends the fight you were in', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  const npc = [...game.npcs.values()].find((entry) => !entry.def.friendly);
  npc.plane = SURFACE;
  player.x = npc.x + 1;
  player.y = npc.y;
  game.startCombat(player, npc);
  assert.equal(player.combat.targetId, npc.id);

  const entrance = game.world.mineEntrance;
  game.climb(player, entrance);
  assert.equal(player.plane, 1);
  assert.equal(player.combat.targetId, null, 'you cannot fight through a floor');
  assert.equal(npc.targetId, null, 'and nothing follows you down');
});

test('being knocked out underground wakes you up on the surface', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  player.plane = 2;
  const ladder = ladderOn(game.world, 2, 'ladder_up');
  player.x = ladder.x;
  player.y = ladder.y;

  player.hp = 1;
  game.knockOut(player);
  assert.equal(player.dead, true);
  for (let i = 0; i < 12 && player.dead; i += 1) game.tick();

  assert.equal(player.dead, false);
  assert.equal(player.plane, SURFACE);
  assert.equal(player.x, SPAWN_POINT.x);
});

test('a character saved underground comes back underground', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  const ladder = ladderOn(game.world, 1, 'ladder_up');
  player.plane = 1;
  player.x = ladder.x;
  player.y = ladder.y;

  const save = game.removePlayer('p1');
  assert.equal(save.plane, 1);

  const reloaded = game.addPlayer('p2', { name: 'Digger', save });
  assert.equal(reloaded.plane, 1);
  assert.ok(isWalkable(game.world, reloaded.x, reloaded.y, 1));
});

test('a save pointing at a plane that no longer exists lands by the fountain', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Lost', save: { plane: 99, x: 5, y: 5 } });
  assert.equal(player.plane, SURFACE);
  assert.ok(isWalkable(game.world, player.x, player.y, SURFACE));
});

test('a campfire lit underground stays underground', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  const other = game.addPlayer('p2', { name: 'Surface' });
  const ladder = ladderOn(game.world, 1, 'ladder_up');
  player.plane = 1;
  player.x = ladder.x + 3;
  player.y = ladder.y + 3;
  other.x = player.x;
  other.y = player.y;

  const fire = game.addDynamicObject('campfire', player.x, player.y, 1, 50);
  assert.equal(fire.plane, 1);
  assert.equal(objectAt(game.world, fire.x, fire.y, 1), fire);
  assert.equal(objectAt(game.world, fire.x, fire.y, SURFACE), null, 'and never appears on the surface');

  game.drain();
  game.tick();
  const states = game.drain().filter((entry) => entry.msg.t === 'state');
  const surfaceView = states.find((entry) => entry.to === 'p2').msg;
  assert.equal(surfaceView.objects.filter((obj) => obj.dynamic).length, 0);
});

test('dropped loot stays on the level it was dropped on', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  player.plane = 1;
  const ladder = ladderOn(game.world, 1, 'ladder_up');
  player.x = ladder.x;
  player.y = ladder.y;

  const item = game.spawnGroundItem('coins', 5, player.x, player.y, player.plane, player.id);
  assert.equal(item.plane, 1);

  const surfacePlayer = game.addPlayer('p2', { name: 'Surface' });
  surfacePlayer.x = item.x;
  surfacePlayer.y = item.y;
  game.drain();
  game.tick();
  const view = game.drain().find((entry) => entry.to === 'p2' && entry.msg.t === 'state').msg;
  assert.equal(view.items.length, 0, 'you cannot see loot through the floor');
});

test('an aggressive creature will not chase across a plane boundary', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  const beast = [...game.npcs.values()].find((npc) => npc.def.aggressive);
  player.plane = 1;
  player.x = beast.x;
  player.y = beast.y;
  player.skills.attack.level = 40;
  player.skills.strength.level = 40;
  player.skills.defence.level = 40;
  player.skills.hitpoints.level = 40;

  for (let i = 0; i < 5; i += 1) game.tickNpc(beast);
  assert.equal(beast.targetId, null, 'standing directly below is not standing next to');
});

test('the checksum notices a change on any plane, not just the surface', () => {
  const world = buildWorld();
  const same = buildWorld();
  assert.equal(world.checksum, same.checksum);

  // Move one wall on the deepest level and the checksum has to disagree.
  const deep = planeAt(same, 3);
  deep.tiles[50 * same.width + 50] = deep.tiles[50 * same.width + 50] === TILE.EMBER ? TILE.CRYSTAL : TILE.EMBER;
  assert.notEqual(world.checksum, checksumWorld(same));
});

// ------------------------------------------------------------------- light

test('the best light you are carrying is the one that counts', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  assert.equal(game.lightRadius(player), 0, 'a starter kit has nothing that glows');

  player.inventory[0] = { id: 'torch', count: 1 };
  const torch = game.lightRadius(player);
  assert.ok(torch > 0);

  // A better light in the bag wins over a worse one in hand, and vice versa.
  player.inventory[1] = { id: 'miners_lantern', count: 1 };
  assert.ok(game.lightRadius(player) > torch);

  player.inventory[1] = null;
  player.equipment.weapon = { id: 'torch', count: 1 };
  player.inventory[0] = null;
  assert.equal(game.lightRadius(player), torch, 'a worn torch lights the same as a carried one');
});

test('planes carry their own darkness, and the surface has none', () => {
  const world = buildWorld();
  assert.equal(planeDarkness(world, SURFACE), 0);
  assert.ok(planeDarkness(world, 1) > 0);
  assert.ok(planeDarkness(world, 2) > planeDarkness(world, 1), 'deeper is darker');
});

test('every landing has a light burning at it', () => {
  const world = buildWorld();
  for (let plane = 1; plane < PLANE_COUNT; plane += 1) {
    const lights = planeLights(world, plane);
    assert.ok(lights.length > 0, `plane ${plane} needs at least one lit spot`);
    const ladder = ladderOn(world, plane, 'ladder_up');
    const nearest = Math.min(...lights.map((l) => Math.max(Math.abs(l.x - ladder.x), Math.abs(l.y - ladder.y))));
    assert.ok(nearest <= 6, `the foot of the ladder on plane ${plane} is unlit`);
  }
});

test('walking into the dark without a light says so', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  game.drain();
  game.climb(player, game.world.mineEntrance);
  const said = game.drain().filter((entry) => entry.msg.t === 'msg').map((entry) => entry.msg.text);
  assert.ok(said.some((text) => /dark down here/.test(text)), 'the player should be warned');

  // With a lantern, no warning.
  player.inventory[0] = { id: 'miners_lantern', count: 1 };
  game.drain();
  game.climb(player, ladderOn(game.world, 1, 'ladder_up'));
  game.climb(player, game.world.mineEntrance);
  const quiet = game.drain().filter((entry) => entry.msg.t === 'msg').map((entry) => entry.msg.text);
  assert.equal(quiet.some((text) => /dark down here/.test(text)), false);
});

test('the state message tells the client how far everyone can see', () => {
  const game = newGame();
  const player = game.addPlayer('p1', { name: 'Digger' });
  const friend = game.addPlayer('p2', { name: 'Friend' });
  friend.x = player.x + 1;
  friend.y = player.y;
  friend.inventory[0] = { id: 'torch', count: 1 };

  game.drain();
  game.tick();
  const view = game.drain().find((entry) => entry.to === 'p1' && entry.msg.t === 'state').msg;
  assert.equal(view.self.light, 0);
  const other = view.players.find((entry) => entry.id === 'p2');
  assert.ok(other.light > 0, 'a friend carrying a torch lights the way for you too');
});

// ----------------------------------------------------------------- content

test('every creature spawns somewhere it can actually stand', () => {
  const game = newGame();
  for (const npc of game.npcs.values()) {
    assert.ok(
      isWalkable(game.world, npc.x, npc.y, npc.plane),
      `${npc.type} spawned inside a wall at ${npc.x},${npc.y} on plane ${npc.plane}`
    );
  }
});

test('the mine is populated from top to bottom, getting harder as it goes', () => {
  const game = newGame();
  const levels = [1, 2, 3].map((plane) => {
    const here = [...game.npcs.values()].filter((npc) => npc.plane === plane && !npc.def.friendly);
    return { plane, count: here.length, top: Math.max(...here.map((npc) => npc.def.level || 0)) };
  });
  for (const level of levels) assert.ok(level.count >= 5, `plane ${level.plane} is empty`);
  assert.ok(levels[1].top > levels[0].top, 'the second level is harder than the first');
  assert.ok(levels[2].top > levels[1].top, 'the third is harder than the second');
});

test('every drop a creature can leave is a real item', () => {
  for (const [type, def] of Object.entries(NPC_TYPES)) {
    for (const drop of def.drops || []) {
      assert.ok(getItem(drop.id), `${type} drops an unknown item: ${drop.id}`);
    }
  }
});

test('a creature hits exactly as hard as its definition says', () => {
  for (const [type, def] of Object.entries(NPC_TYPES)) {
    if (!def.maxHit) continue;
    const stats = npcCombatStats(def);
    assert.equal(
      maxHit(stats.strengthLevel, stats.strengthBonus),
      def.maxHit,
      `${type} says it hits for ${def.maxHit}`
    );
  }
});

test('the new ore tiers run all the way from rock to armour', () => {
  const world = buildWorld();
  for (const [rock, ore, bar, gear] of [
    ['mithril_rock', 'mithril_ore', 'mithril_bar', 'mithril_platebody'],
    ['adamant_rock', 'adamant_ore', 'adamant_bar', 'adamant_platebody']
  ]) {
    const found = world.allObjects.filter((obj) => obj.type === rock);
    assert.ok(found.length > 0, `${rock} should exist somewhere`);
    assert.ok(found.every((obj) => obj.plane > 0), `${rock} belongs underground`);
    assert.equal(OBJECT_TYPES[rock].action.yields, ore);

    const smelt = SMELTING.find((recipe) => recipe.id === bar);
    assert.ok(smelt, `${bar} should be smeltable`);
    assert.ok(smelt.inputs.some((input) => input.id === ore));

    const smith = SMITHING.find((recipe) => recipe.id === gear);
    assert.ok(smith, `${gear} should be smithable`);
    assert.equal(smith.bar, bar);
    assert.ok(getItem(gear).bonuses.defence > getItem('steel_platebody').bonuses.defence);
  }
});

// ------------------------------------------------------------------- boss

function bossFight(game) {
  const boss = [...game.npcs.values()].find((npc) => npc.type === 'cinderheart');
  const player = game.addPlayer('hero', { name: 'Hero' });
  player.plane = boss.plane;
  player.x = boss.x + 1;
  player.y = boss.y;
  for (const skill of ['attack', 'strength', 'defence', 'hitpoints']) {
    player.skills[skill].level = 70;
    player.skills[skill].xp = 999999;
  }
  player.hp = 70;
  return { boss, player };
}

test('there is exactly one boss, and it waits in its own chamber', () => {
  const game = newGame();
  const bosses = [...game.npcs.values()].filter((npc) => npc.def.boss);
  assert.equal(bosses.length, 1);
  assert.equal(bosses[0].plane, PLANE_COUNT - 1);
  assert.equal(bosses[0].def.wander, 0, 'it does not go wandering');
});

test('the boss wakes up in stages, and each stage fires once', () => {
  const game = newGame();
  const { boss, player } = bossFight(game);
  game.startCombat(player, boss);
  game.drain();

  boss.hp = Math.floor(boss.maxHp * 0.6);
  game.tickBossPhases(boss);
  assert.equal(boss.phasesDone, 1, 'the first stage has fired');
  const summoned = [...game.npcs.values()].filter((npc) => npc.summonedBy === boss.id);
  assert.ok(summoned.length > 0, 'it calls something to it');
  assert.ok(summoned.every((npc) => npc.plane === boss.plane));

  // Ticking again at the same health must not fire it a second time.
  game.tickBossPhases(boss);
  assert.equal(boss.phasesDone, 1);
  assert.equal([...game.npcs.values()].filter((npc) => npc.summonedBy === boss.id).length, summoned.length);

  boss.hp = Math.floor(boss.maxHp * 0.3);
  game.tickBossPhases(boss);
  assert.equal(boss.phasesDone, 2);
  assert.equal(boss.enraged, true, 'the last stage stokes it');

  const said = game.drain().filter((entry) => entry.msg.t === 'msg').map((entry) => entry.msg.text);
  assert.ok(said.some((text) => /Cinderheart stirs/.test(text)));
});

test('walking away from the boss puts everything back as it was', () => {
  const game = newGame();
  const { boss, player } = bossFight(game);
  game.startCombat(player, boss);
  boss.hp = 40;
  game.tickBossPhases(boss);
  assert.ok([...game.npcs.values()].some((npc) => npc.summonedBy === boss.id));

  // Climbing out ends the fight.
  player.plane = SURFACE;
  game.tickNpcCombat(boss);
  assert.equal(boss.hp, boss.maxHp, 'the boss heals back up');
  assert.equal(boss.phasesDone, 0);
  assert.equal(boss.enraged, false);
  assert.equal([...game.npcs.values()].some((npc) => npc.summonedBy === boss.id), false, 'and dismisses its wisps');
});

test('defeating the boss dismisses its wisps and tells the world', () => {
  const game = newGame();
  const { boss, player } = bossFight(game);
  game.startCombat(player, boss);
  boss.hp = 40;
  game.tickBossPhases(boss);
  game.drain();

  boss.hp = 0;
  game.defeatNpc(player, boss);
  assert.equal([...game.npcs.values()].some((npc) => npc.summonedBy === boss.id), false);
  const said = game.drain().filter((entry) => entry.msg.t === 'msg').map((entry) => entry.msg.text);
  assert.ok(said.some((text) => /settles back down to sleep/.test(text)), 'it goes back to sleep, it is not killed');
  assert.ok(said.some((text) => /has calmed Cinderheart/.test(text)), 'and the whole world hears about it');
});

test('a summoned wisp never respawns', () => {
  const game = newGame();
  const { boss, player } = bossFight(game);
  const wisp = game.summonNpc('ember_wisp', boss);
  assert.ok(wisp.temporary);

  wisp.hp = 0;
  game.defeatNpc(player, wisp);
  game.tickNpc(wisp);
  assert.equal(game.npcs.has(wisp.id), false, 'it is gone for good');
});

test('view radius still bounds what you receive on a mine level', () => {
  const game = newGame();
  const near = game.addPlayer('near', { name: 'Near' });
  const far = game.addPlayer('far', { name: 'Far' });
  const ladder = ladderOn(game.world, 1, 'ladder_up');
  for (const player of [near, far]) {
    player.plane = 1;
    player.x = ladder.x;
    player.y = ladder.y;
  }
  far.x = ladder.x + VIEW_RADIUS + 4;

  game.drain();
  game.tick();
  const view = game.drain().find((entry) => entry.to === 'near' && entry.msg.t === 'state').msg;
  assert.deepEqual(view.players.map((p) => p.id), ['near']);
});
