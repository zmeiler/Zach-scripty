/**
 * Parties.
 *
 * A party is a transient group of up to `PARTY_SIZE` players. It lives only in
 * memory: it is not saved with a character and does not survive a restart,
 * because a persistent clan is a different feature with different rules.
 *
 * This module knows nothing about the world, combat or planes - it is
 * membership bookkeeping and nothing else, which is what makes it testable on
 * its own and what will keep phase 2's threat work honest.
 *
 * Every operation returns `{ ok, reason }` rather than throwing, because every
 * one of them can legitimately fail for a reason the player should be told:
 * the party is full, the invite lapsed, they already left.
 */

import { PARTY_INVITE_TTL_MS, PARTY_MAX_PENDING, PARTY_SIZE } from '../constants.js';

export class Party {
  constructor(id, leaderId) {
    this.id = id;
    this.leaderId = leaderId;
    this.members = [leaderId];
    this.createdAt = 0;
  }

  get size() {
    return this.members.length;
  }

  has(playerId) {
    return this.members.includes(playerId);
  }

  isLeader(playerId) {
    return this.leaderId === playerId;
  }
}

export class PartyRegistry {
  constructor(options = {}) {
    this.maxSize = options.maxSize ?? PARTY_SIZE;
    this.inviteTtl = options.inviteTtl ?? PARTY_INVITE_TTL_MS;
    this.maxPending = options.maxPending ?? PARTY_MAX_PENDING;
    this.now = options.now ?? (() => Date.now());

    this.parties = new Map();          // partyId -> Party
    this.byPlayer = new Map();         // playerId -> Party
    this.invites = new Map();          // inviteeId -> [{ partyId, fromId, at }]
    this.nextId = 1;
  }

  partyOf(playerId) {
    return this.byPlayer.get(playerId) || null;
  }

  /** Everyone grouped with this player, including themselves. Never empty. */
  membersWith(playerId) {
    const party = this.partyOf(playerId);
    return party ? [...party.members] : [playerId];
  }

  /** True when two players are in the same party. A player is not their own ally. */
  allied(a, b) {
    if (a === b) return false;
    const party = this.partyOf(a);
    return Boolean(party && party.has(b));
  }

  // ------------------------------------------------------------- invites

  /**
   * Offers `toId` a place in `fromId`'s party, creating one if `fromId` is not
   * already in a party. Nothing happens to the invitee until they accept - an
   * invite is a prompt, never a join.
   */
  invite(fromId, toId) {
    if (fromId === toId) return { ok: false, reason: 'You cannot invite yourself.' };

    let party = this.partyOf(fromId);
    if (party && !party.isLeader(fromId)) {
      return { ok: false, reason: 'Only the party leader can invite.' };
    }
    if (party && party.size >= this.maxSize) {
      return { ok: false, reason: `A party can hold ${this.maxSize} people.` };
    }
    if (this.partyOf(toId)) {
      return { ok: false, reason: 'They are already in a party.' };
    }

    const pending = this.pendingFor(toId);
    if (pending.length >= this.maxPending) {
      return { ok: false, reason: 'They have too many invites waiting. Give them a moment.' };
    }
    // A second invite from the same party replaces the first rather than
    // stacking, so a repeated click cannot fill someone's list on its own.
    const existing = party && pending.find((entry) => entry.partyId === party.id);
    if (existing) {
      existing.at = this.now();
      return { ok: true, party, resent: true };
    }

    // The party is only created once the invite is definitely going out, so a
    // refused invite does not leave the inviter in a party of one.
    if (!party) party = this.create(fromId);

    pending.push({ partyId: party.id, fromId, at: this.now() });
    this.invites.set(toId, pending);
    return { ok: true, party };
  }

  /** Invites for a player that have not lapsed, oldest first. */
  pendingFor(playerId) {
    const now = this.now();
    const live = (this.invites.get(playerId) || []).filter(
      (entry) => now - entry.at < this.inviteTtl && this.parties.has(entry.partyId)
    );
    if (live.length) this.invites.set(playerId, live);
    else this.invites.delete(playerId);
    return live;
  }

  accept(playerId, partyId = null) {
    if (this.partyOf(playerId)) return { ok: false, reason: 'You are already in a party.' };

    const pending = this.pendingFor(playerId);
    // With no party named, the most recent invite is the one being answered.
    const entry = partyId
      ? pending.find((item) => item.partyId === partyId)
      : pending[pending.length - 1];
    if (!entry) return { ok: false, reason: 'That invite has lapsed.' };

    const party = this.parties.get(entry.partyId);
    if (!party) return { ok: false, reason: 'That party is no longer there.' };
    if (party.size >= this.maxSize) return { ok: false, reason: 'That party is full.' };

    party.members.push(playerId);
    this.byPlayer.set(playerId, party);
    this.invites.delete(playerId);
    return { ok: true, party };
  }

  decline(playerId, partyId = null) {
    const pending = this.pendingFor(playerId);
    if (pending.length === 0) return { ok: false, reason: 'There is nothing to decline.' };
    const remaining = partyId ? pending.filter((entry) => entry.partyId !== partyId) : [];
    const declined = partyId ? pending.find((entry) => entry.partyId === partyId) : pending[pending.length - 1];
    if (remaining.length) this.invites.set(playerId, remaining);
    else this.invites.delete(playerId);
    // A party that exists only to hold one hopeful leader is not worth keeping.
    this.pruneLonely(declined ? declined.partyId : null);
    return { ok: true, declined: declined || null };
  }

  // ------------------------------------------------------- joining, leaving

  create(leaderId) {
    const party = new Party(`p${this.nextId}`, leaderId);
    this.nextId += 1;
    party.createdAt = this.now();
    this.parties.set(party.id, party);
    this.byPlayer.set(leaderId, party);
    return party;
  }

  /**
   * Removes a player. If they were the leader the badge passes to whoever has
   * been in the party longest - a party should not dissolve because one person
   * had to go, and it should never be left without a leader.
   */
  leave(playerId) {
    const party = this.partyOf(playerId);
    if (!party) return { ok: false, reason: 'You are not in a party.' };

    party.members = party.members.filter((id) => id !== playerId);
    this.byPlayer.delete(playerId);

    if (party.size === 0) {
      this.parties.delete(party.id);
      return { ok: true, party, disbanded: true };
    }

    let promoted = null;
    if (party.leaderId === playerId) {
      party.leaderId = party.members[0];
      promoted = party.leaderId;
    }
    // One person is not a party. Dropping to a single member disbands it, so
    // nobody is left in a group with themselves wondering why.
    if (party.size === 1) {
      this.byPlayer.delete(party.members[0]);
      this.parties.delete(party.id);
      return { ok: true, party, disbanded: true, wasAlone: party.members[0] };
    }
    return { ok: true, party, promoted };
  }

  /** Leader-only removal of somebody else. */
  remove(leaderId, targetId) {
    const party = this.partyOf(leaderId);
    if (!party) return { ok: false, reason: 'You are not in a party.' };
    if (!party.isLeader(leaderId)) return { ok: false, reason: 'Only the party leader can do that.' };
    if (leaderId === targetId) return { ok: false, reason: 'Use Leave to go on your own.' };
    if (!party.has(targetId)) return { ok: false, reason: 'They are not in your party.' };
    return { ...this.leave(targetId), removedBy: leaderId };
  }

  disband(playerId) {
    const party = this.partyOf(playerId);
    if (!party) return { ok: false, reason: 'You are not in a party.' };
    if (!party.isLeader(playerId)) return { ok: false, reason: 'Only the party leader can disband.' };
    const members = [...party.members];
    for (const id of members) this.byPlayer.delete(id);
    this.parties.delete(party.id);
    return { ok: true, party, members, disbanded: true };
  }

  /** Called when a player disconnects: the same as leaving, but never fails. */
  forget(playerId) {
    this.invites.delete(playerId);
    for (const [inviteeId, entries] of this.invites) {
      const kept = entries.filter((entry) => entry.fromId !== playerId);
      if (kept.length) this.invites.set(inviteeId, kept);
      else this.invites.delete(inviteeId);
    }
    if (!this.partyOf(playerId)) return null;
    return this.leave(playerId);
  }

  /** Drops a party that has been left holding a single hopeful leader. */
  pruneLonely(partyId) {
    if (!partyId) return;
    const party = this.parties.get(partyId);
    if (!party || party.size > 1) return;
    const stillWanted = [...this.invites.values()].some((entries) =>
      entries.some((entry) => entry.partyId === partyId)
    );
    if (stillWanted) return;
    for (const id of party.members) this.byPlayer.delete(id);
    this.parties.delete(partyId);
  }

  /** Housekeeping: drops lapsed invites and any party they were holding open. */
  sweep() {
    for (const inviteeId of [...this.invites.keys()]) this.pendingFor(inviteeId);
    for (const partyId of [...this.parties.keys()]) this.pruneLonely(partyId);
  }
}
