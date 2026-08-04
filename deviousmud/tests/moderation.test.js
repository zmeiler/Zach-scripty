/**
 * Moderation and abuse-limit tests.
 *
 * These exercise the pieces a single operator depends on: that a mute actually
 * silences, that a ban outlasts a reconnect, that reports capture context, and
 * that the limits refuse the traffic they are meant to refuse.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ChatGuard, ModerationStore, isReservedName, describePenalty } from '../server/moderation.js';
import { ConnectionLimiter, LoginThrottle, SlidingWindow, normaliseAddress, describeWait } from '../server/limits.js';
import { REPORT_REASONS } from '../shared/reports.js';

async function tempStore(options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-mod-'));
  const store = new ModerationStore({ dir, keepChatLog: false, ...options });
  await store.load();
  return { store, dir };
}

// -------------------------------------------------------------- mutes, bans

test('a mute silences a player until it expires', async () => {
  const { store } = await tempStore();
  assert.equal(store.muteStatus('Rowan'), null);

  store.mute('Rowan', 10, 'unkind words', 'Zach');
  const mute = store.muteStatus('Rowan');
  assert.ok(mute, 'the player should be muted');
  assert.equal(mute.reason, 'unkind words');
  assert.equal(mute.by, 'Zach');

  // Names are matched case-insensitively - "rowan" is the same player.
  assert.ok(store.muteStatus('rowan'));

  // Once the clock passes the expiry the mute reads as gone.
  assert.equal(store.muteStatus('Rowan', Date.now() + 11 * 60_000), null);
});

test('an indefinite mute never expires on its own', async () => {
  const { store } = await tempStore();
  store.mute('Rowan', 0, 'repeated spam', 'Zach');
  assert.ok(store.muteStatus('Rowan', Date.now() + 365 * 24 * 3_600_000));
  assert.ok(store.unmute('Rowan'));
  assert.equal(store.muteStatus('Rowan'), null);
});

test('bans survive a restart', async () => {
  const { store, dir } = await tempStore();
  store.ban('Nuisance', 24, 'kept bullying after a warning', 'Zach');
  await store.flush();

  const reloaded = new ModerationStore({ dir, keepChatLog: false });
  await reloaded.load();
  const ban = reloaded.banStatus('nuisance');
  assert.ok(ban, 'the ban should still be there after loading from disk');
  assert.equal(ban.reason, 'kept bullying after a warning');
});

test('expired penalties are pruned on load', async () => {
  const { store, dir } = await tempStore();
  store.mutes.set('old', { until: Date.now() - 1000, reason: 'x', by: 'y' });
  store.bans.set('older', { until: Date.now() - 5000, reason: 'x', by: 'y' });
  await store.flush();

  const reloaded = new ModerationStore({ dir, keepChatLog: false });
  const stats = await reloaded.load();
  assert.equal(stats.mutes, 0);
  assert.equal(stats.bans, 0);
});

test('penalty messages tell the player what happened and for how long', () => {
  const timed = describePenalty({ until: Date.now() + 60_000, reason: 'spam' }, 'muted');
  assert.match(timed, /You are muted until/);
  assert.match(timed, /Reason: spam/);
  const forever = describePenalty({ until: 0, reason: 'bullying' }, 'banned');
  assert.match(forever, /until a moderator lifts it/);
});

// ------------------------------------------------------------------ admins

test('moderators are remembered and can be revoked', async () => {
  const { store, dir } = await tempStore({ admins: ['Zach'] });
  assert.ok(store.isAdmin('zach'), 'boot-time admins are recognised case-insensitively');
  assert.equal(store.isAdmin('Rowan'), false);

  store.grantAdmin('Rowan');
  await store.flush();
  const reloaded = new ModerationStore({ dir, keepChatLog: false });
  await reloaded.load();
  assert.ok(reloaded.isAdmin('Rowan'));

  reloaded.revokeAdmin('Rowan');
  assert.equal(reloaded.isAdmin('Rowan'), false);
});

// ----------------------------------------------------------------- reports

test('a report captures the conversation around it', async () => {
  const { store, dir } = await tempStore();
  store.noteChat('Rowan', 'hello everyone');
  store.noteChat('Nuisance', 'go away rowan');
  store.noteChat('Briar', 'that was unkind');

  const result = await store.addReport({
    reporter: 'Rowan',
    target: 'Nuisance',
    reason: 'bullying',
    note: 'they keep saying it'
  });
  assert.equal(result.ok, true);
  assert.ok(result.id);

  const written = await fs.readFile(path.join(dir, 'reports.jsonl'), 'utf8');
  const record = JSON.parse(written.trim().split('\n').pop());
  assert.equal(record.target, 'Nuisance');
  assert.equal(record.reason, 'bullying');
  assert.equal(record.context.length, 3, 'the surrounding chat is included');
  assert.deepEqual(record.context.map((line) => line.subject), [false, true, false]);
});

test('report flooding is refused', async () => {
  const { store } = await tempStore({ reportsPerHour: 2 });
  for (let i = 0; i < 2; i += 1) {
    const ok = await store.addReport({ reporter: 'Spammer', target: 'Someone', reason: 'other' });
    assert.equal(ok.ok, true);
  }
  const third = await store.addReport({ reporter: 'Spammer', target: 'Someone', reason: 'other' });
  assert.equal(third.ok, false);
  assert.match(third.reason, /lot of reports/);

  // A different player is unaffected.
  const other = await store.addReport({ reporter: 'Rowan', target: 'Someone', reason: 'other' });
  assert.equal(other.ok, true);
});

test('recent reports come back newest first', async () => {
  const { store } = await tempStore();
  await store.addReport({ reporter: 'A', target: 'X', reason: 'spam' });
  await store.addReport({ reporter: 'B', target: 'Y', reason: 'rude' });
  const recent = await store.recentReports(5);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].reporter, 'B');
});

test('every report reason the client offers is a real one', () => {
  assert.ok(REPORT_REASONS.length >= 5);
  for (const reason of REPORT_REASONS) {
    assert.ok(reason.id && reason.label, 'reasons need an id and a label');
  }
});

// ------------------------------------------------------------- chat guard

test('the chat guard stops flooding', () => {
  const guard = new ChatGuard({ perTenSeconds: 3, repeats: 99 });
  const now = Date.now();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(guard.check('Rowan', `message ${i}`, now).ok, true);
  }
  const flooded = guard.check('Rowan', 'message 4', now);
  assert.equal(flooded.ok, false);
  assert.equal(flooded.reason, 'flood');
  // Ten seconds later the window has moved on.
  assert.equal(guard.check('Rowan', 'message 5', now + 11_000).ok, true);
});

test('the chat guard stops repetition', () => {
  const guard = new ChatGuard({ perTenSeconds: 99, repeats: 3 });
  const now = Date.now();
  assert.equal(guard.check('Rowan', 'buy my stuff', now).ok, true);
  assert.equal(guard.check('Rowan', 'buy my stuff', now).ok, true);
  const blocked = guard.check('Rowan', 'BUY  MY   STUFF', now);
  assert.equal(blocked.ok, false, 'case and spacing changes are still repetition');
  assert.equal(blocked.reason, 'repeat');
  // Saying something else resets it.
  assert.equal(guard.check('Rowan', 'sorry', now).ok, true);
});

// -------------------------------------------------------------------- names

test('staff-sounding and NPC names are reserved', () => {
  for (const name of ['admin', 'Moderator', 'M0derator', 'staff', 'Mayor Aldric', 'system', 'DeviousMud', 'xX_admin']) {
    assert.equal(isReservedName(name), true, `${name} should be reserved`);
  }
  for (const name of ['Rowan', 'Briar', 'Sparrow', 'Modest Pete']) {
    assert.equal(isReservedName(name), false, `${name} should be allowed`);
  }
});

// ------------------------------------------------------------------ limits

test('connections per address are capped and released', () => {
  const limiter = new ConnectionLimiter(2);
  assert.equal(limiter.add('1.2.3.4'), true);
  assert.equal(limiter.add('1.2.3.4'), true);
  assert.equal(limiter.add('1.2.3.4'), false, 'the third is refused');
  assert.equal(limiter.add('5.6.7.8'), true, 'a different address is unaffected');

  limiter.remove('1.2.3.4');
  assert.equal(limiter.add('1.2.3.4'), true, 'closing a tab frees a slot');
});

test('IPv6-mapped IPv4 addresses count as one address', () => {
  assert.equal(normaliseAddress('::ffff:1.2.3.4'), '1.2.3.4');
  const limiter = new ConnectionLimiter(1);
  assert.equal(limiter.add('1.2.3.4'), true);
  assert.equal(limiter.add('::ffff:1.2.3.4'), false);
});

test('failed logins back off, and success forgives', () => {
  const throttle = new LoginThrottle({ failures: 3, backoffMs: 1000, backoffMaxMs: 10_000 });
  const now = Date.now();
  assert.equal(throttle.blockedFor('ip:1', now), 0);

  assert.equal(throttle.fail('ip:1', now), 0, 'the first attempts are free');
  assert.equal(throttle.fail('ip:1', now), 0);
  const wait = throttle.fail('ip:1', now);
  assert.ok(wait > 0, 'the third failure starts a cool-off');
  assert.ok(throttle.blockedFor('ip:1', now) > 0);

  // Each further failure doubles the wait, up to the cap.
  const longer = throttle.fail('ip:1', now);
  assert.ok(longer > wait);
  for (let i = 0; i < 10; i += 1) throttle.fail('ip:1', now);
  assert.ok(throttle.blockedFor('ip:1', now) <= 10_000, 'the wait is capped');

  // Waiting it out clears the block, and a success wipes the slate.
  assert.equal(throttle.blockedFor('ip:1', now + 20_000), 0);
  throttle.succeed('ip:1');
  assert.equal(throttle.blockedFor('ip:1', now), 0);
});

test('the sliding window counts and forgets', () => {
  const window = new SlidingWindow(1000, 2);
  const now = Date.now();
  assert.equal(window.hit('a', now), true);
  assert.equal(window.hit('a', now), true);
  assert.equal(window.hit('a', now), false);
  assert.equal(window.count('a', now), 3);
  assert.equal(window.hit('a', now + 1500), true, 'the window has moved on');
  assert.equal(window.sweep(now + 10_000), 0, 'stale keys are dropped entirely');
});

test('waits are described in words a child can read', () => {
  assert.equal(describeWait(5000), '5 seconds');
  assert.equal(describeWait(1000), '1 second');
  assert.equal(describeWait(120_000), '2 minutes');
});
