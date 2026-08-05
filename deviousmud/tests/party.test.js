/**
 * Party tests — phase 1: membership only.
 *
 * Nothing about combat, loot or quests changes with a party yet, and one of
 * these tests exists to hold that line: grouping up must not alter a single
 * number in a fight until phase 2 deliberately makes it.
 *
 * The rest are the awkward cases a party gets into. Most bugs in a feature like
 * this are not "invite does not work" — they are "the leader left and now
 * nobody can invite anyone", "I declined and the inviter is stuck in a party of
 * one", "they logged out mid-invite and the party outlived them".
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../shared/engine/game.js';
import { PartyRegistry } from '../shared/engine/party.js';
import { buildWorld, makeRng } from '../shared/world.js';
import { CHAT_CHANNELS, PARTY_SIZE } from '../shared/constants.js';

function newGame() {
  return new Game({ world: buildWorld(), rng: makeRng(808) });
}

/** A game with `count` players standing together in the village square. */
function withPlayers(count) {
  const game = newGame();
  const players = [];
  for (let i = 0; i < count; i += 1) {
    const player = game.addPlayer(`p${i}`, { name: `Player${i}` });
    player.x = 48 + (i % 3);
    player.y = 52;
    players.push(player);
  }
  game.drain();
  return { game, players };
}

/** Puts everyone after the first into the first player's party. */
function group(game, players) {
  for (const member of players.slice(1)) {
    game.cmdParty(players[0], { op: 'invite', id: member.id });
    game.cmdParty(member, { op: 'accept' });
  }
  game.drain();
  return game.parties.partyOf(players[0].id);
}

const messagesFor = (game, id) =>
  game.drain().filter((entry) => entry.to === id && entry.msg.t === 'msg').map((entry) => entry.msg.text);

// ------------------------------------------------------------- the registry

test('an invite is a prompt, not a join', () => {
  const registry = new PartyRegistry();
  const result = registry.invite('a', 'b');
  assert.equal(result.ok, true);
  assert.equal(registry.partyOf('b'), null, 'nothing happens to them until they answer');
  assert.ok(registry.partyOf('a'), 'the inviter has a party waiting');
  assert.equal(registry.pendingFor('b').length, 1);

  registry.accept('b');
  assert.equal(registry.partyOf('b').id, registry.partyOf('a').id);
  assert.equal(registry.pendingFor('b').length, 0, 'accepting clears the invite');
});

test('you cannot invite yourself, or somebody already in a party', () => {
  const registry = new PartyRegistry();
  assert.equal(registry.invite('a', 'a').ok, false);

  registry.invite('a', 'b');
  registry.accept('b');
  const taken = registry.invite('c', 'b');
  assert.equal(taken.ok, false);
  assert.match(taken.reason, /already in a party/);
});

test('only the leader invites', () => {
  const registry = new PartyRegistry();
  registry.invite('a', 'b');
  registry.accept('b');
  const notLeader = registry.invite('b', 'c');
  assert.equal(notLeader.ok, false);
  assert.match(notLeader.reason, /leader/);
});

test('a party fills up and then refuses', () => {
  const registry = new PartyRegistry();
  for (let i = 1; i < PARTY_SIZE; i += 1) {
    assert.equal(registry.invite('a', `m${i}`).ok, true);
    assert.equal(registry.accept(`m${i}`).ok, true);
  }
  assert.equal(registry.partyOf('a').size, PARTY_SIZE);
  const full = registry.invite('a', 'one-too-many');
  assert.equal(full.ok, false);
  assert.match(full.reason, new RegExp(String(PARTY_SIZE)));
});

test('invites lapse, and take an empty party with them', () => {
  let clock = 1000;
  const registry = new PartyRegistry({ inviteTtl: 5000, now: () => clock });
  registry.invite('a', 'b');
  assert.equal(registry.pendingFor('b').length, 1);

  clock += 6000;
  assert.equal(registry.pendingFor('b').length, 0, 'the invite has lapsed');
  registry.sweep();
  assert.equal(registry.partyOf('a'), null, 'and the party it was holding open is gone');
});

test('declining releases the inviter rather than leaving them in a party of one', () => {
  const registry = new PartyRegistry();
  registry.invite('a', 'b');
  registry.decline('b');
  assert.equal(registry.pendingFor('b').length, 0);
  assert.equal(registry.partyOf('a'), null);
});

test('a repeated invite refreshes rather than stacking', () => {
  let clock = 0;
  const registry = new PartyRegistry({ now: () => clock });
  registry.invite('a', 'b');
  clock += 100;
  const again = registry.invite('a', 'b');
  assert.equal(again.ok, true);
  assert.equal(again.resent, true);
  assert.equal(registry.pendingFor('b').length, 1, 'one invite, not two');
});

test('a player can only be asked so many times at once', () => {
  const registry = new PartyRegistry({ maxPending: 2 });
  assert.equal(registry.invite('a', 'z').ok, true);
  assert.equal(registry.invite('b', 'z').ok, true);
  const third = registry.invite('c', 'z');
  assert.equal(third.ok, false);
  assert.match(third.reason, /too many invites/);
});

test('the leader leaving hands over instead of disbanding', () => {
  const registry = new PartyRegistry();
  for (const id of ['b', 'c']) {
    registry.invite('a', id);
    registry.accept(id);
  }
  const result = registry.leave('a');
  assert.equal(result.disbanded, undefined);
  assert.equal(result.promoted, 'b', 'the longest-standing member takes over');
  assert.equal(registry.partyOf('b').leaderId, 'b');
});

test('a party of one is not a party', () => {
  const registry = new PartyRegistry();
  registry.invite('a', 'b');
  registry.accept('b');
  const result = registry.leave('a');
  assert.equal(result.disbanded, true);
  assert.equal(result.wasAlone, 'b');
  assert.equal(registry.partyOf('b'), null, 'the last one out is not left grouped with themselves');
});

test('only the leader removes or disbands', () => {
  const registry = new PartyRegistry();
  for (const id of ['b', 'c']) {
    registry.invite('a', id);
    registry.accept(id);
  }
  assert.equal(registry.remove('b', 'c').ok, false);
  assert.equal(registry.disband('b').ok, false);
  assert.equal(registry.remove('a', 'a').ok, false, 'the leader leaves rather than removing themselves');

  const removed = registry.remove('a', 'c');
  assert.equal(removed.ok, true);
  assert.equal(registry.partyOf('c'), null);

  const gone = registry.disband('a');
  assert.equal(gone.ok, true);
  assert.equal(registry.partyOf('a'), null);
  assert.equal(registry.partyOf('b'), null);
});

test('a disconnect leaves the party and cancels invites that player sent', () => {
  const registry = new PartyRegistry();
  for (const id of ['b', 'c']) {
    registry.invite('a', id);
    registry.accept(id);
  }
  registry.invite('a', 'd');
  assert.equal(registry.pendingFor('d').length, 1);

  registry.forget('a');
  assert.equal(registry.partyOf('a'), null);
  assert.equal(registry.pendingFor('d').length, 0, 'an invite from somebody who left is not answerable');
  assert.equal(registry.partyOf('b').leaderId, 'b');
});

test('allies are mutual, and nobody is their own ally', () => {
  const registry = new PartyRegistry();
  registry.invite('a', 'b');
  registry.accept('b');
  assert.equal(registry.allied('a', 'b'), true);
  assert.equal(registry.allied('b', 'a'), true);
  assert.equal(registry.allied('a', 'a'), false);
  assert.equal(registry.allied('a', 'stranger'), false);
  assert.deepEqual(registry.membersWith('stranger'), ['stranger'], 'an ungrouped player is their own group');
});

// ---------------------------------------------------------------- in game

test('two players can group up through the engine', () => {
  const { game, players } = withPlayers(2);
  const [a, b] = players;

  game.cmdParty(a, { op: 'invite', id: b.id });
  assert.ok(game.parties.pendingFor(b.id).length, 'the invitation is waiting');
  assert.equal(game.parties.partyOf(b.id), null);

  game.cmdParty(b, { op: 'accept' });
  const party = game.parties.partyOf(a.id);
  assert.ok(party);
  assert.equal(party.size, 2);
  assert.equal(party.leaderId, a.id);
});

test('the party panel says who is where', () => {
  const { game, players } = withPlayers(2);
  const [a, b] = players;
  group(game, players);
  b.plane = 1;

  const view = game.partyView(a);
  assert.equal(view.members.length, 2);
  const other = view.members.find((member) => member.id === b.id);
  assert.equal(other.name, b.name);
  assert.equal(other.plane, 1);
  assert.equal(other.where, 'Copper Hollow Mine', 'you can see which level they are on');
  assert.ok(other.maxHp > 0, 'and how they are doing');
});

test('party chat reaches the whole party and nobody else', () => {
  const { game, players } = withPlayers(3);
  const [a, b, outsider] = players;
  game.cmdParty(a, { op: 'invite', id: b.id });
  game.cmdParty(b, { op: 'accept' });
  // The outsider is standing right next to them.
  outsider.x = a.x;
  outsider.y = a.y;
  game.drain();

  game.handle(a.id, { t: 'chat', channel: 'party', text: 'down the ladder, both of you' });
  const heard = game.drain().filter((entry) => entry.msg.t === 'chat');
  assert.deepEqual(heard.map((entry) => entry.to).sort(), [a.id, b.id].sort());
  assert.equal(heard[0].msg.channel, 'party');
});

test('party chat crosses planes, which is most of the point of it', () => {
  const { game, players } = withPlayers(2);
  const [a, b] = players;
  group(game, players);
  b.plane = 2;
  b.x = 20;
  b.y = 20;

  game.drain();
  game.handle(a.id, { t: 'chat', channel: 'party', text: 'are you all right down there' });
  const heard = game.drain().filter((entry) => entry.msg.t === 'chat');
  assert.equal(heard.length, 2, 'a floor between you is not a reason to lose contact');
});

test('party chat is filtered like every other channel', () => {
  const { game, players } = withPlayers(2);
  const [a] = players;
  group(game, players);
  game.drain();

  game.handle(a.id, { t: 'chat', channel: 'party', text: 'visit https://example.com now' });
  const said = game.drain().find((entry) => entry.msg.t === 'chat').msg.text;
  assert.match(said, /\[hidden\]/);
});

test('talking to a party you are not in tells you so', () => {
  const { game, players } = withPlayers(1);
  game.drain();
  game.handle(players[0].id, { t: 'chat', channel: 'party', text: 'hello?' });
  const out = game.drain();
  assert.equal(out.some((entry) => entry.msg.t === 'chat'), false);
  assert.ok(out.some((entry) => /not in a party/.test(entry.msg.text || '')));
});

test('logging out leaves the party and tells the others', () => {
  const { game, players } = withPlayers(3);
  const [a, b, c] = players;
  group(game, players);
  game.drain();

  game.removePlayer(c.id);
  assert.equal(game.parties.partyOf(a.id).size, 2);
  const told = messagesFor(game, a.id);
  assert.ok(told.some((text) => /Player2 has gone offline/.test(text)));
});

test('the last player logging out disbands the party cleanly', () => {
  const { game, players } = withPlayers(2);
  const [a, b] = players;
  group(game, players);
  game.removePlayer(b.id);
  assert.equal(game.parties.partyOf(a.id), null);
  assert.equal(game.parties.parties.size, 0, 'no party is left behind holding one person');
});

test("removing somebody tells them, and does not tell them they left of their own accord", () => {
  const { game, players } = withPlayers(3);
  const [a, , c] = players;
  group(game, players);
  game.drain();

  game.cmdParty(a, { op: 'remove', id: c.id });
  assert.equal(game.parties.partyOf(c.id), null);
  assert.ok(messagesFor(game, c.id).some((text) => /removed from the party/.test(text)));
});

test('leaving clears your own party panel, not just everyone else\'s', () => {
  // Caught in a live browser: the leaver kept seeing the party they had left,
  // because the update only went to whoever was still in it.
  const { game, players } = withPlayers(3);
  const [a] = players;
  group(game, players);
  game.drain();

  game.cmdParty(a, { op: 'leave' });
  const sent = game.drain().filter((entry) => entry.to === a.id && entry.msg.t === 'party');
  assert.ok(sent.length, 'the leaver is told');
  assert.equal(sent[sent.length - 1].msg.party, null);
});

test('being removed clears your panel too', () => {
  const { game, players } = withPlayers(3);
  const [a, , c] = players;
  group(game, players);
  game.drain();

  game.cmdParty(a, { op: 'remove', id: c.id });
  const sent = game.drain().filter((entry) => entry.to === c.id && entry.msg.t === 'party');
  assert.equal(sent[sent.length - 1].msg.party, null);
});

test('disbanding clears every panel including the leader\'s', () => {
  const { game, players } = withPlayers(3);
  const [a] = players;
  group(game, players);
  game.drain();

  game.cmdParty(a, { op: 'disband' });
  const sent = game.drain().filter((entry) => entry.msg.t === 'party');
  const seen = new Set(sent.filter((entry) => entry.msg.party === null).map((entry) => entry.to));
  assert.equal(seen.size, 3, 'all three panels are cleared');
});

test('a party message carries its channel so the client can colour it', () => {
  const { game, players } = withPlayers(2);
  const [a] = players;
  group(game, players);
  game.drain();

  game.handle(a.id, { t: 'chat', channel: 'party', text: 'hello party' });
  const line = game.drain().find((entry) => entry.msg.t === 'chat').msg;
  assert.equal(line.channel, 'party', 'without this the client renders it as public chat');
});

test('you can still answer an invitation while knocked out', () => {
  const { game, players } = withPlayers(2);
  const [a, b] = players;
  game.cmdParty(a, { op: 'invite', id: b.id });
  b.dead = true;

  game.handle(b.id, { t: 'party', op: 'accept' });
  assert.ok(game.parties.partyOf(b.id), 'being unconscious is not a reason to be left out');
});

test('party is a chat channel the client knows about', () => {
  assert.ok(CHAT_CHANNELS.includes('party'));
});

// --------------------------------------------------- nothing else changed

test('being in a party changes nothing about a fight yet', () => {
  // Phase 1 is membership only. If this starts failing, something has leaked
  // forward from a later phase without being designed.
  const solo = newGame();
  const soloPlayer = solo.addPlayer('solo', { name: 'Solo' });
  const grouped = newGame();
  const groupedPlayer = grouped.addPlayer('g1', { name: 'Grouped' });
  const friend = grouped.addPlayer('g2', { name: 'Friend' });
  grouped.cmdParty(groupedPlayer, { op: 'invite', id: friend.id });
  grouped.cmdParty(friend, { op: 'accept' });

  const fight = (game, player) => {
    const npc = [...game.npcs.values()].find((entry) => entry.type === 'giant_rat');
    player.plane = npc.plane;
    player.x = npc.x + 1;
    player.y = npc.y;
    game.startCombat(player, npc);
    let ticks = 0;
    while (!npc.dead && ticks < 300) {
      game.tick();
      ticks += 1;
    }
    return { ticks, loot: [...game.groundItems.values()].map((item) => item.owner) };
  };

  const a = fight(solo, soloPlayer);
  const b = fight(grouped, groupedPlayer);
  assert.equal(a.ticks, b.ticks, 'the same fight takes the same time whether or not you are grouped');
  assert.deepEqual(b.loot, b.loot.map(() => groupedPlayer.id), 'loot still belongs to the fighter alone');
});
