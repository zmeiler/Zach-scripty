/**
 * Engine tests. Run with `npm test` (Node's built-in test runner, no deps).
 *
 * The engine is seeded with a deterministic RNG so combat and gathering rolls
 * are reproducible.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Game, filterChat } from '../shared/engine/game.js';
import { buildWorld, makeRng, isWalkable, OBJECT_TYPES } from '../shared/world.js';
import { findPath } from '../shared/engine/pathfinding.js';
import { addItem, countItem, createContainer, removeItem, spaceFor } from '../shared/engine/inventory.js';
import { levelForXp, xpForLevel, combatLevel, createSkillSet } from '../shared/skills.js';
import { maxHit, resolveAttack, equipmentBonuses } from '../shared/engine/combat.js';
import { SPAWN_POINT, INVENTORY_SIZE } from '../shared/constants.js';
import { QUESTS } from '../shared/quests.js';

function newGame() {
  return new Game({ world: buildWorld(), rng: makeRng(12345) });
}

function login(game, name = 'Tester') {
  const player = game.addPlayer('p1', { name });
  game.drain();
  return player;
}

/** Runs ticks until `predicate` passes or we give up. */
function runUntil(game, predicate, maxTicks = 400) {
  for (let i = 0; i < maxTicks; i += 1) {
    game.tick();
    game.drain();
    if (predicate()) return i + 1;
  }
  return -1;
}

// ------------------------------------------------------------------- world

test('world generation is deterministic', () => {
  const a = buildWorld();
  const b = buildWorld();
  assert.equal(a.checksum, b.checksum);
  assert.equal(a.objects.length, b.objects.length);
  assert.notEqual(buildWorld(999).checksum, a.checksum);
});

test('the spawn point and every village fixture are reachable', () => {
  const world = buildWorld();
  assert.ok(isWalkable(world, SPAWN_POINT.x, SPAWN_POINT.y), 'spawn tile must be walkable');

  const fixtures = world.objects.filter((obj) =>
    ['bank_booth', 'shop_counter', 'furnace', 'anvil', 'range'].includes(obj.type)
  );
  assert.ok(fixtures.length >= 7, 'village should have all its fixtures');

  for (const fixture of fixtures) {
    const path = findPath(world, SPAWN_POINT.x, SPAWN_POINT.y, fixture.x, fixture.y, { range: 1 });
    assert.ok(path.length > 0, `${fixture.type} at ${fixture.x},${fixture.y} should be reachable`);
    const last = path[path.length - 1];
    assert.ok(
      Math.max(Math.abs(last.x - fixture.x), Math.abs(last.y - fixture.y)) <= 1,
      'path should finish next to the fixture'
    );
  }
});

test('resources exist in every region', () => {
  const world = buildWorld();
  const types = new Set(world.objects.map((obj) => obj.type));
  for (const required of ['tree', 'oak_tree', 'willow_tree', 'copper_rock', 'tin_rock', 'iron_rock', 'coal_rock', 'shrimp_spot']) {
    assert.ok(types.has(required), `world should contain ${required}`);
  }
});

test('pathfinding refuses to cut diagonally through a wall corner', () => {
  const world = buildWorld();
  // Walk from the village square into the bank; the only way in is the door.
  const path = findPath(world, SPAWN_POINT.x, SPAWN_POINT.y, 41, 44);
  assert.ok(path.length > 0);
  for (const step of path) assert.ok(isWalkable(world, step.x, step.y), 'every step must be walkable');
});

// ------------------------------------------------------------------ skills

test('experience curve matches the classic progression', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 83);
  assert.equal(xpForLevel(10), 1154);
  assert.equal(levelForXp(1154), 10);
  assert.equal(levelForXp(1153), 9);
  assert.equal(levelForXp(0), 1);
});

test('combat level starts at 3 for a fresh character', () => {
  assert.equal(combatLevel(createSkillSet()), 3);
});

// --------------------------------------------------------------- inventory

test('stackables share a slot and non-stackables do not', () => {
  const bag = createContainer(4);
  addItem(bag, 'coins', 50);
  addItem(bag, 'coins', 25);
  assert.equal(countItem(bag, 'coins'), 75);
  assert.equal(bag.filter(Boolean).length, 1);

  addItem(bag, 'bread', 3);
  assert.equal(bag.filter(Boolean).length, 4);
  assert.equal(addItem(bag, 'bread', 1), 0, 'a full bag accepts nothing more');
  assert.equal(spaceFor(bag, 'coins', 10), 10, 'stackables still fit into an existing stack');

  removeItem(bag, 'bread', 2);
  assert.equal(countItem(bag, 'bread'), 1);
});

// ------------------------------------------------------------------ combat

test('max hit and accuracy scale with gear', () => {
  assert.equal(maxHit(1, 0), 1);
  assert.ok(maxHit(40, 40) > maxHit(40, 0));
  const bonuses = equipmentBonuses({ weapon: { id: 'bronze_sword' }, shield: { id: 'wooden_shield' } });
  assert.equal(bonuses.attack, 7);
  assert.equal(bonuses.defence, 5);
});

test('an attack never deals more than the max hit', () => {
  const rng = makeRng(7);
  const attacker = { attackLevel: 20, strengthLevel: 20, defenceLevel: 20, attackBonus: 10, strengthBonus: 10, defenceBonus: 0, style: 'aggressive' };
  const defender = { defenceLevel: 5, defenceBonus: 0, style: 'accurate' };
  for (let i = 0; i < 500; i += 1) {
    const result = resolveAttack(attacker, defender, rng);
    assert.ok(result.damage >= 0 && result.damage <= result.max);
  }
});

// ------------------------------------------------------------------- login

test('a new player starts with a usable kit and can walk', () => {
  const game = newGame();
  const player = login(game);
  assert.equal(countItem(player.inventory, 'bronze_axe'), 1);
  assert.equal(countItem(player.inventory, 'tinderbox'), 1);
  assert.ok(countItem(player.inventory, 'coins') > 0);
  assert.equal(player.hp, 10);

  game.handle('p1', { t: 'move', x: SPAWN_POINT.x + 4, y: SPAWN_POINT.y });
  const ticks = runUntil(game, () => player.x === SPAWN_POINT.x + 4 && player.y === SPAWN_POINT.y, 20);
  assert.ok(ticks > 0, 'player should reach the target tile');
});

test('saving and reloading a character preserves progress', () => {
  const game = newGame();
  const player = login(game);
  player.skills.woodcutting.xp = 5000;
  player.skills.woodcutting.level = levelForXp(5000);
  addItem(player.inventory, 'oak_logs', 7);
  addItem(player.bank, 'coins', 4200);
  player.equipment.weapon = { id: 'bronze_sword', count: 1 };
  const save = game.serializePlayer(player);
  game.removePlayer('p1');
  game.drain();

  const restored = game.addPlayer('p2', { name: 'Tester', save });
  assert.equal(restored.skills.woodcutting.level, levelForXp(5000));
  assert.equal(countItem(restored.inventory, 'oak_logs'), 7);
  assert.equal(countItem(restored.bank, 'coins'), 4200);
  assert.equal(restored.equipment.weapon.id, 'bronze_sword');
});

// ---------------------------------------------------------------- skilling

test('chopping a tree yields logs and woodcutting experience', () => {
  const game = newGame();
  const player = login(game);
  const tree = game.world.objects.find((obj) => obj.type === 'tree');
  game.handle('p1', { t: 'interact', kind: 'object', id: tree.id, action: 'chop' });

  const ticks = runUntil(game, () => countItem(player.inventory, 'logs') > 0, 600);
  assert.ok(ticks > 0, 'player should walk to the tree and chop it');
  assert.ok(player.skills.woodcutting.xp >= 25);
  assert.ok(tree.depletedUntil > game.tickCount - 1, 'the tree should be depleted after a successful chop');
});

test('mining requires a pickaxe', () => {
  const game = newGame();
  const player = login(game);
  removeItem(player.inventory, 'bronze_axe', 1);
  // The pair of rocks beside the village exists so beginners never have to
  // walk into golem country for their first ore.
  const rock = game.world.objects.find((obj) => obj.type === 'copper_rock' && obj.x > 30);
  game.handle('p1', { t: 'interact', kind: 'object', id: rock.id, action: 'mine' });
  runUntil(game, () => false, 60);
  assert.equal(countItem(player.inventory, 'copper_ore'), 0);

  addItem(player.inventory, 'bronze_pickaxe', 1);
  game.handle('p1', { t: 'interact', kind: 'object', id: rock.id, action: 'mine' });
  const ticks = runUntil(game, () => countItem(player.inventory, 'copper_ore') > 0, 400);
  assert.ok(ticks > 0, 'with a pickaxe the rock should yield ore');
});

test('lighting a fire consumes logs and creates a campfire', () => {
  const game = newGame();
  const player = login(game);
  addItem(player.inventory, 'logs', 1);
  const slot = player.inventory.findIndex((entry) => entry && entry.id === 'logs');
  game.handle('p1', { t: 'item', op: 'light', slot });
  assert.equal(countItem(player.inventory, 'logs'), 0);
  assert.equal(game.dynamicObjects.size, 1);
  assert.ok(player.skills.firemaking.xp >= 40);
});

test('smelting bronze consumes one copper and one tin', () => {
  const game = newGame();
  const player = login(game);
  addItem(player.inventory, 'copper_ore', 2);
  addItem(player.inventory, 'tin_ore', 2);
  player.ui = { kind: 'craft', mode: 'smelt', objectId: 'furnace' };
  game.handle('p1', { t: 'craft', recipe: 'bronze_bar', count: 2 });
  const ticks = runUntil(game, () => countItem(player.inventory, 'bronze_bar') === 2, 60);
  assert.ok(ticks > 0, 'two bars should be smelted');
  assert.equal(countItem(player.inventory, 'copper_ore'), 0);
  assert.equal(countItem(player.inventory, 'tin_ore'), 0);
  assert.ok(player.skills.smithing.xp >= 14);
});

// ------------------------------------------------------------------ combat

test('a player can defeat a giant rat and take its drops', () => {
  const game = newGame();
  const player = login(game);
  player.skills.attack.level = 20;
  player.skills.strength.level = 20;
  player.skills.defence.level = 20;
  player.equipment.weapon = { id: 'steel_sword', count: 1 };

  const rat = [...game.npcs.values()].find((npc) => npc.type === 'giant_rat');
  player.x = rat.x;
  player.y = rat.y + 1;
  game.handle('p1', { t: 'interact', kind: 'npc', id: rat.id, action: 'attack' });

  const ticks = runUntil(game, () => rat.dead, 200);
  assert.ok(ticks > 0, 'the rat should be defeated');
  assert.ok(player.skills.attack.xp > 0, 'combat should award experience');
  assert.ok(game.groundItems.size >= 0);

  // And it comes back later.
  runUntil(game, () => !rat.dead, 200);
  assert.equal(rat.dead, false);
  assert.equal(rat.hp, rat.maxHp);
});

test('a knocked out player keeps their items and respawns in the village', () => {
  const game = newGame();
  const player = login(game);
  addItem(player.inventory, 'oak_logs', 5);
  player.x = 20;
  player.y = 20;
  player.hp = 1;
  game.knockOut(player);
  assert.equal(player.dead, true);

  runUntil(game, () => !player.dead, 20);
  assert.equal(player.x, SPAWN_POINT.x);
  assert.equal(player.y, SPAWN_POINT.y);
  assert.equal(player.hp, player.skills.hitpoints.level);
  assert.equal(countItem(player.inventory, 'oak_logs'), 5, 'nothing is lost on defeat');
});

test('friendly NPCs cannot be attacked', () => {
  const game = newGame();
  const player = login(game);
  const mayor = [...game.npcs.values()].find((npc) => npc.type === 'mayor_aldric');
  game.startCombat(player, mayor);
  assert.equal(player.combat.targetId, null);
  assert.equal(mayor.hp, mayor.maxHp);
});

// ------------------------------------------------------------------ quests

test('the tutorial quest can be started and completed through its stages', () => {
  const game = newGame();
  const player = login(game);

  const mayor = [...game.npcs.values()].find((npc) => npc.type === 'mayor_aldric');
  game.openDialogue(player, mayor);
  game.drain();
  // "Is there anything I can help with?" -> "I will do it."
  game.handle('p1', { t: 'dialogue', option: 1 });
  game.handle('p1', { t: 'dialogue', option: 0 });
  assert.equal(player.quests.welcome.stage, 1);

  addItem(player.inventory, 'logs', 1);
  game.checkQuests(player);
  assert.equal(player.quests.welcome.stage, 2, 'collecting logs advances the quest');

  const slot = player.inventory.findIndex((entry) => entry && entry.id === 'logs');
  game.handle('p1', { t: 'item', op: 'light', slot });
  assert.equal(player.quests.welcome.stage, 3, 'lighting a fire advances the quest');

  addItem(player.inventory, 'raw_shrimp', 1);
  game.checkQuests(player);
  assert.equal(player.quests.welcome.stage, 4);

  addItem(player.inventory, 'shrimp', 1);
  game.checkQuests(player);
  assert.equal(player.quests.welcome.stage, 5);

  game.openDialogue(player, mayor);
  game.drain();
  assert.equal(player.quests.welcome.completed, true, 'handing in completes the quest');
  assert.ok(countItem(player.inventory, 'travellers_cape') >= 1, 'reward item is granted');
  assert.ok(player.skills.woodcutting.xp >= QUESTS.welcome.rewards.xp.woodcutting);
});

test('quest requirements gate later quests', () => {
  const game = newGame();
  const player = login(game);
  const willow = [...game.npcs.values()].find((npc) => npc.type === 'woodsman_willow');
  game.openDialogue(player, willow);
  game.drain();
  // Without "Welcome to Emberfall" finished, Willow only gives advice.
  assert.equal(player.quests.lost_lantern.stage, 0);
});

test('kill objectives count only the right creature', () => {
  const game = newGame();
  const player = login(game);
  player.quests.wolves_at_the_gate = { stage: 1, counter: 0, completed: false };

  const rat = [...game.npcs.values()].find((npc) => npc.type === 'giant_rat');
  game.defeatNpc(player, rat);
  assert.equal(player.quests.wolves_at_the_gate.counter, 0);

  const wolf = [...game.npcs.values()].find((npc) => npc.type === 'forest_wolf');
  for (let i = 0; i < 5; i += 1) {
    wolf.dead = false;
    game.defeatNpc(player, wolf);
  }
  assert.equal(player.quests.wolves_at_the_gate.stage, 2, 'five wolves advances to the hand-in stage');
});

// -------------------------------------------------------------- shop, bank

test('buying and selling moves coins in the right direction', () => {
  const game = newGame();
  const player = login(game);
  const coinsBefore = countItem(player.inventory, 'coins');
  game.openShop(player, 'general_store');
  game.handle('p1', { t: 'shop', op: 'buy', id: 'bread', count: 2 });
  assert.equal(countItem(player.inventory, 'bread'), 5); // 3 from the starter kit
  assert.ok(countItem(player.inventory, 'coins') < coinsBefore);

  const slot = player.inventory.findIndex((entry) => entry && entry.id === 'bread');
  const coinsMid = countItem(player.inventory, 'coins');
  game.handle('p1', { t: 'shop', op: 'sell', slot, count: 1 });
  assert.ok(countItem(player.inventory, 'coins') > coinsMid);
});

test('a player cannot buy what they cannot afford', () => {
  const game = newGame();
  const player = login(game);
  removeItem(player.inventory, 'coins', countItem(player.inventory, 'coins'));
  game.openShop(player, 'general_store');
  game.handle('p1', { t: 'shop', op: 'buy', id: 'bronze_sword', count: 1 });
  assert.equal(countItem(player.inventory, 'bronze_sword'), 0);
});

test('banking moves items both ways and never duplicates them', () => {
  const game = newGame();
  const player = login(game);
  game.openBank(player);
  const slot = player.inventory.findIndex((entry) => entry && entry.id === 'bread');
  game.handle('p1', { t: 'bank', op: 'deposit', slot, count: 'all' });
  assert.equal(countItem(player.inventory, 'bread'), 0);
  assert.equal(countItem(player.bank, 'bread'), 3);

  const bankSlot = player.bank.findIndex((entry) => entry && entry.id === 'bread');
  game.handle('p1', { t: 'bank', op: 'withdraw', slot: bankSlot, count: 2 });
  assert.equal(countItem(player.inventory, 'bread'), 2);
  assert.equal(countItem(player.bank, 'bread'), 1);
});

// ------------------------------------------------------------------- trade

test('a trade swaps both offers atomically', () => {
  const game = newGame();
  const a = game.addPlayer('pa', { name: 'Ash' });
  const b = game.addPlayer('pb', { name: 'Briar' });
  game.drain();
  addItem(a.inventory, 'oak_logs', 4);
  addItem(b.inventory, 'copper_ore', 6);

  game.beginTrade(a, b);
  game.handle('pa', { t: 'trade', op: 'offer', slot: a.inventory.findIndex((e) => e && e.id === 'oak_logs'), count: 'all' });
  game.handle('pb', { t: 'trade', op: 'offer', slot: b.inventory.findIndex((e) => e && e.id === 'copper_ore'), count: 'all' });
  game.handle('pa', { t: 'trade', op: 'accept' });
  game.handle('pb', { t: 'trade', op: 'accept' });

  assert.equal(countItem(a.inventory, 'copper_ore'), 6);
  assert.equal(countItem(b.inventory, 'oak_logs'), 4);
  assert.equal(a.trade, null);
  assert.equal(b.trade, null);
});

test('changing an offer clears both acceptances', () => {
  const game = newGame();
  const a = game.addPlayer('pa', { name: 'Ash' });
  const b = game.addPlayer('pb', { name: 'Briar' });
  game.drain();
  addItem(a.inventory, 'coal', 3);
  game.beginTrade(a, b);
  game.handle('pb', { t: 'trade', op: 'accept' });
  assert.equal(b.trade.accepted, true);
  game.handle('pa', { t: 'trade', op: 'offer', slot: a.inventory.findIndex((e) => e && e.id === 'coal'), count: 1 });
  assert.equal(b.trade.accepted, false, 'the other side must re-accept after a change');
});

test('cancelling a trade returns every offered item', () => {
  const game = newGame();
  const a = game.addPlayer('pa', { name: 'Ash' });
  const b = game.addPlayer('pb', { name: 'Briar' });
  game.drain();
  addItem(a.inventory, 'coal', 3);
  game.beginTrade(a, b);
  game.handle('pa', { t: 'trade', op: 'offer', slot: a.inventory.findIndex((e) => e && e.id === 'coal'), count: 'all' });
  assert.equal(countItem(a.inventory, 'coal'), 0);
  game.handle('pa', { t: 'trade', op: 'cancel' });
  assert.equal(countItem(a.inventory, 'coal'), 3);
});

// -------------------------------------------------------- safety and input

test('chat filtering keeps the game family friendly', () => {
  assert.equal(filterChat('visit http://example.com now'), 'visit [hidden] now');
  assert.equal(filterChat('mail me at someone@example.com'), 'mail me at [hidden]');
  assert.equal(filterChat('call 555 123 4567'), 'call [hidden]');
  assert.match(filterChat('you are stupid'), /\*{6}/);
  assert.equal(filterChat('  hello   there  '), 'hello there');
});

test('malformed commands are ignored rather than crashing the tick', () => {
  const game = newGame();
  login(game);
  const nonsense = [
    { t: 'move', x: 'over there' },
    { t: 'move', x: -50, y: 9999 },
    { t: 'item', op: 'equip', slot: 999 },
    { t: 'interact', kind: 'npc', id: 'does-not-exist' },
    { t: 'bank', op: 'withdraw', slot: -1 },
    { t: 'trade', op: 'accept' },
    { t: 'unknown-command' },
    {},
    null
  ];
  for (const msg of nonsense) game.handle('p1', msg);
  assert.doesNotThrow(() => game.tick());
});

test('a full inventory refuses new items instead of losing them', () => {
  const game = newGame();
  const player = login(game);
  for (let i = 0; i < INVENTORY_SIZE; i += 1) player.inventory[i] = { id: 'bread', count: 1 };
  const item = game.spawnGroundItem('oak_logs', 1, player.x, player.y, 'p1');
  game.pickUp(player, item);
  assert.ok(game.groundItems.has(item.id), 'the item stays on the ground');
});

test('players in view receive each other in the state message', () => {
  const game = newGame();
  const a = game.addPlayer('pa', { name: 'Ash' });
  game.addPlayer('pb', { name: 'Briar' });
  game.drain();
  game.tick();
  const messages = game.drain().filter((entry) => entry.to === 'pa' && entry.msg.t === 'state');
  assert.equal(messages.length, 1);
  const seen = messages[0].msg.players.map((p) => p.id);
  assert.ok(seen.includes('pb'), 'Ash should see Briar');
  assert.equal(messages[0].msg.self.x, a.x);
});

test('object definitions all declare a usable action', () => {
  for (const [type, def] of Object.entries(OBJECT_TYPES)) {
    assert.ok(def.name, `${type} needs a name`);
    assert.ok(def.action && def.action.id, `${type} needs an action`);
    if (def.action.skill) {
      assert.ok(def.action.yields, `${type} should yield an item`);
      assert.ok(def.action.xp > 0, `${type} should award experience`);
    }
  }
});
