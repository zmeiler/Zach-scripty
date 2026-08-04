/**
 * Quest tests.
 *
 * A broken quest is the worst kind of bug in a game like this: nothing crashes,
 * the player just quietly cannot finish. So the first half of this file checks
 * that every quest is *startable* and *finishable* at all - that a dialogue
 * somewhere offers it, that a dialogue somewhere completes it, and that every
 * item, creature and NPC it names actually exists. The second half plays the
 * whole mine chain through the real engine.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../shared/engine/game.js';
import { QUESTS, QUEST_IDS } from '../shared/quests.js';
import { DIALOGUE } from '../shared/dialogue.js';
import { NPC_TYPES } from '../shared/npcs.js';
import { getItem } from '../shared/items.js';
import { buildWorld, makeRng, planeAt } from '../shared/world.js';
import { SURFACE } from '../shared/constants.js';

/** Every effect of every kind, across every dialogue node in the game. */
function allEffects() {
  const out = [];
  for (const [npcType, tree] of Object.entries(DIALOGUE)) {
    for (const [nodeId, node] of Object.entries(tree.nodes)) {
      for (const effect of node.effects || []) out.push({ npcType, nodeId, effect });
      for (const option of node.options || []) {
        for (const effect of option.effects || []) out.push({ npcType, nodeId, effect });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------- consistency

test('every quest can be started by talking to somebody', () => {
  const starts = new Set(allEffects().filter((e) => e.effect.type === 'startQuest').map((e) => e.effect.quest));
  for (const id of QUEST_IDS) {
    assert.ok(starts.has(id), `nothing in the game offers "${QUESTS[id].name}"`);
  }
});

test('every quest can be finished by talking to somebody', () => {
  const finishes = new Set(allEffects().filter((e) => e.effect.type === 'completeQuest').map((e) => e.effect.quest));
  for (const id of QUEST_IDS) {
    assert.ok(finishes.has(id), `"${QUESTS[id].name}" can be started but never completed`);
  }
});

test('every quest names things that exist', () => {
  for (const id of QUEST_IDS) {
    const quest = QUESTS[id];
    for (const other of quest.requires?.quests || []) {
      assert.ok(QUESTS[other], `${id} requires an unknown quest: ${other}`);
    }
    for (const stage of quest.stages) {
      const objective = stage.objective;
      assert.ok(objective.label, `${id} stage ${stage.id} has no label for the journal`);
      if (objective.type === 'collect') {
        assert.ok(getItem(objective.item), `${id} asks for an unknown item: ${objective.item}`);
      } else if (objective.type === 'kill') {
        assert.ok(NPC_TYPES[objective.npc], `${id} asks you to fight an unknown creature: ${objective.npc}`);
      } else if (objective.type === 'talk') {
        assert.ok(NPC_TYPES[objective.npc], `${id} sends you to an unknown NPC: ${objective.npc}`);
        assert.ok(DIALOGUE[objective.npc], `${objective.npc} has nothing to say`);
      }
    }
    for (const item of quest.rewards?.items || []) {
      assert.ok(getItem(item.id), `${id} rewards an unknown item: ${item.id}`);
    }
  }
});

test('the quest chain is a chain, with no requirement that loops back', () => {
  const seen = new Set();
  const resolve = (id, trail = []) => {
    assert.equal(trail.includes(id), false, `requirement loop: ${[...trail, id].join(' -> ')}`);
    if (seen.has(id)) return;
    for (const other of QUESTS[id].requires?.quests || []) resolve(other, [...trail, id]);
    seen.add(id);
  };
  for (const id of QUEST_IDS) resolve(id);
  assert.equal(seen.size, QUEST_IDS.length);
});

test('every quest-giver is somewhere a player can reach them', () => {
  const game = new Game({ world: buildWorld(), rng: makeRng(3) });
  const givers = new Set();
  for (const quest of Object.values(QUESTS)) {
    for (const stage of quest.stages) {
      if (stage.objective.type === 'talk') givers.add(stage.objective.npc);
    }
  }
  for (const type of givers) {
    const npc = [...game.npcs.values()].find((entry) => entry.type === type);
    assert.ok(npc, `${type} is named by a quest but never spawns`);
    assert.ok(npc.def.friendly, `${type} needs to be talkable`);
  }
});

// ------------------------------------------------------------ the mine chain

function questReady(player) {
  // A character who has done everything up to the point the mine opens.
  for (const id of ['welcome', 'lost_lantern', 'wolves_at_the_gate', 'the_deep_seam']) {
    player.quests[id] = { stage: 99, counter: 0, completed: true };
  }
  for (const skill of Object.keys(player.skills)) {
    player.skills[skill].level = 60;
    player.skills[skill].xp = 273742;
  }
  player.hp = 60;
}

/** Talks to an NPC and walks the conversation, taking the first option each time. */
function converse(game, player, npcType, choices = []) {
  const npc = [...game.npcs.values()].find((entry) => entry.type === npcType);
  assert.ok(npc, `${npcType} is not in the world`);
  player.plane = npc.plane;
  player.x = npc.x;
  player.y = npc.y;
  game.openDialogue(player, npc);
  for (const choice of choices) game.cmdDialogue(player, { option: choice });
  return npc;
}

test('the mine quests can be started, in order, and not before', () => {
  const game = new Game({ world: buildWorld(), rng: makeRng(11) });
  const player = game.addPlayer('p1', { name: 'Delver' });
  questReady(player);
  game.drain();

  // Mira offers the first one now that the seam is open.
  converse(game, player, 'miner_mira', [0]);
  assert.equal(player.quests.lights_in_the_dark.stage, 1, 'Mira should have started it');

  // Dorn will not offer the second before the first is done.
  converse(game, player, 'foreman_dorn', []);
  assert.equal(player.quests.the_foremans_tally.stage, 0);
});

test('Lights in the Dark: torch, ladder, foreman', () => {
  const game = new Game({ world: buildWorld(), rng: makeRng(11) });
  const player = game.addPlayer('p1', { name: 'Delver' });
  questReady(player);
  converse(game, player, 'miner_mira', [0]);
  game.drain();

  // Stage 1 wants a light.
  assert.equal(player.quests.lights_in_the_dark.stage, 1);
  player.inventory[0] = { id: 'torch', count: 1 };
  game.checkQuests(player);
  assert.equal(player.quests.lights_in_the_dark.stage, 2, 'holding a torch finishes the first stage');

  // Stage 2 wants the climb itself.
  player.plane = SURFACE;
  player.x = game.world.mineEntrance.x;
  player.y = game.world.mineEntrance.y;
  game.climb(player, game.world.mineEntrance);
  assert.equal(player.plane, 1);
  assert.equal(player.quests.lights_in_the_dark.stage, 3, 'climbing down finishes the second stage');

  // Stage 3 is Dorn, who is standing right there.
  converse(game, player, 'foreman_dorn', []);
  assert.equal(player.quests.lights_in_the_dark.completed, true);
  assert.ok(
    player.inventory.some((slot) => slot && slot.id === 'miners_lantern'),
    'and he hands over a lantern'
  );
});

test('the whole mine chain plays through to the Forge-warden ring', () => {
  const game = new Game({ world: buildWorld(), rng: makeRng(11) });
  const player = game.addPlayer('p1', { name: 'Delver' });
  questReady(player);

  const give = (id, count = 1) => {
    const slot = player.inventory.findIndex((entry) => !entry);
    player.inventory[slot] = { id, count };
    game.checkQuests(player);
  };
  const defeat = (type, times) => {
    for (let i = 0; i < times; i += 1) {
      const npc = [...game.npcs.values()].find((entry) => entry.type === type);
      npc.hp = 0;
      game.defeatNpc(player, npc);
      npc.dead = false;
      npc.hp = npc.maxHp;
    }
  };

  // 1. Lights in the Dark.
  converse(game, player, 'miner_mira', [0]);
  give('torch');
  player.plane = SURFACE;
  game.climb(player, game.world.mineEntrance);
  converse(game, player, 'foreman_dorn', []);
  assert.equal(player.quests.lights_in_the_dark.completed, true);

  // 2. The Foreman's Tally.
  converse(game, player, 'foreman_dorn', [0]);
  assert.equal(player.quests.the_foremans_tally.stage, 1);
  defeat('cave_bat', 6);
  assert.equal(player.quests.the_foremans_tally.stage, 2);
  defeat('tunnel_crawler', 4);
  assert.equal(player.quests.the_foremans_tally.stage, 3);
  give('iron_ore', 8);
  assert.equal(player.quests.the_foremans_tally.stage, 4);
  converse(game, player, 'foreman_dorn', []);
  assert.equal(player.quests.the_foremans_tally.completed, true);

  // 3. Deeper Than Dorn Went.
  converse(game, player, 'foreman_dorn', [0]);
  assert.equal(player.quests.deeper_than_dorn_went.stage, 1);
  const down = planeAt(game.world, 1).objects.find((obj) => obj.type === 'ladder_down');
  player.plane = 1;
  game.climb(player, down);
  assert.equal(player.plane, 2);
  assert.equal(player.quests.deeper_than_dorn_went.stage, 2, 'reaching the Deep Seam is the first stage');
  give('mithril_ore', 3);
  assert.equal(player.quests.deeper_than_dorn_went.stage, 3);
  give('mithril_bar', 1);
  assert.equal(player.quests.deeper_than_dorn_went.stage, 4);
  defeat('deep_golem', 3);
  assert.equal(player.quests.deeper_than_dorn_went.stage, 5);
  converse(game, player, 'foreman_dorn', []);
  assert.equal(player.quests.deeper_than_dorn_went.completed, true);

  // 4. The Sleeping Forge.
  converse(game, player, 'miner_mira', [0]);
  assert.equal(player.quests.the_sleeping_forge.stage, 1, 'Mira offers the last one herself');
  give('ember_shard', 2);
  assert.equal(player.quests.the_sleeping_forge.stage, 2);
  defeat('cinder_guardian', 3);
  assert.equal(player.quests.the_sleeping_forge.stage, 3);
  defeat('cinderheart', 1);
  assert.equal(player.quests.the_sleeping_forge.stage, 4);
  converse(game, player, 'miner_mira', []);

  assert.equal(player.quests.the_sleeping_forge.completed, true);
  assert.ok(
    player.inventory.some((slot) => slot && slot.id === 'forge_wardens_ring'),
    'the last quest pays out the Forge-warden\'s ring'
  );
  // The two shards were the price of the telling.
  assert.equal(player.inventory.some((slot) => slot && slot.id === 'ember_shard'), false);
});

test('the mine quests gate on skills, not just on each other', () => {
  const game = new Game({ world: buildWorld(), rng: makeRng(11) });
  const player = game.addPlayer('p1', { name: 'Novice' });
  questReady(player);
  for (const skill of Object.keys(player.skills)) player.skills[skill].level = 1;
  player.quests.lights_in_the_dark = { stage: 99, counter: 0, completed: true };

  converse(game, player, 'foreman_dorn', [0]);
  assert.equal(player.quests.the_foremans_tally.stage, 0, 'mining 15 is required first');
});
