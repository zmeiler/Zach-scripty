/**
 * Moderation: mutes, bans, reports, and the chat record behind them.
 *
 * The design goal is that a single operator can run this game for children and
 * actually answer the question "what happened?". So a report captures the
 * conversation around it, not just an accusation, and every action a moderator
 * takes is written down with who did it and why.
 *
 * State lives in three files under the data directory:
 *   moderation.json  mutes, bans and the moderator list (rewritten atomically)
 *   reports.jsonl    one JSON object per report, append only
 *   chat.log         public chat, append only, rotated at a size cap
 *
 * Chat logging can be turned off with DM_CHAT_LOG=off. It is on by default:
 * for a game aimed at children, being able to review what was said is a safety
 * feature, and it should be disclosed to players rather than hidden.
 */

import fs from 'node:fs/promises';
import { appendFile, statSync } from 'node:fs';
import path from 'node:path';
import { NPC_TYPES } from '../shared/npcs.js';
import { REPORT_REASONS } from '../shared/reports.js';
import { LIMITS, SlidingWindow } from './limits.js';

export { REPORT_REASONS };

const CHAT_LOG_MAX_BYTES = 8 * 1024 * 1024;
const CHAT_CONTEXT_LINES = 25;
const CHAT_BUFFER_LINES = 120;

/** Names nobody may take: staff-sounding words and every NPC in the world. */
const RESERVED_WORDS = [
  'admin', 'administrator', 'mod', 'moderator', 'staff', 'system', 'server',
  'support', 'help', 'helper', 'owner', 'dev', 'developer', 'deviousmud',
  'emberfall', 'guide', 'official'
];

const NPC_NAMES = Object.values(NPC_TYPES).map((def) => def.name.toLowerCase());

/**
 * Characters that read as other characters. Someone calling themselves
 * "M0derator" or "Admın" is trying to be mistaken for staff.
 */
function skeleton(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
    .replace(/0/g, 'o')
    .replace(/1|!|\|/g, 'l')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/\$/g, 's');
}

/**
 * True when a name is too close to staff, or to somebody who already lives in
 * the world.
 *
 * Short words are matched exactly and long ones anywhere in the name. That
 * distinction matters: blocking any name *containing* "mod" would turn away
 * Modest Pete and anyone called Modesty, while "xX_admin" plainly wants to be
 * mistaken for staff.
 */
export function isReservedName(name) {
  const flat = skeleton(name);
  if (!flat) return true;
  if (NPC_NAMES.some((npc) => skeleton(npc) === flat)) return true;
  return RESERVED_WORDS.some((word) => (word.length >= 5 ? flat.includes(word) : flat === word));
}

export class ModerationStore {
  constructor(options = {}) {
    const dir = options.dir || path.join(process.cwd(), 'server', 'data');
    this.file = options.file || path.join(dir, 'moderation.json');
    this.reportsFile = options.reportsFile || path.join(dir, 'reports.jsonl');
    this.chatLogFile = options.chatLogFile || path.join(dir, 'chat.log');
    this.keepChatLog = options.keepChatLog ?? process.env.DM_CHAT_LOG !== 'off';

    this.mutes = new Map();   // key -> { until, reason, by }
    this.bans = new Map();    // key -> { until, reason, by }
    this.admins = new Set();
    this.reportCount = 0;
    this.recent = [];         // rolling public chat, newest last
    this.dirty = false;
    this.saveTimer = null;

    for (const name of options.admins || []) this.admins.add(key(name));
    this.reportLimiter = new SlidingWindow(60 * 60_000, options.reportsPerHour ?? LIMITS.reportsPerHour);
  }

  async load() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      for (const [name, entry] of Object.entries(parsed.mutes || {})) this.mutes.set(name, entry);
      for (const [name, entry] of Object.entries(parsed.bans || {})) this.bans.set(name, entry);
      for (const name of parsed.admins || []) this.admins.add(key(name));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await fs.mkdir(path.dirname(this.file), { recursive: true });
    }
    this.prune();
    return { mutes: this.mutes.size, bans: this.bans.size, admins: this.admins.size };
  }

  // ------------------------------------------------------------- moderators

  isAdmin(name) {
    return this.admins.has(key(name));
  }

  grantAdmin(name) {
    this.admins.add(key(name));
    this.markDirty();
  }

  revokeAdmin(name) {
    this.admins.delete(key(name));
    this.markDirty();
  }

  // ------------------------------------------------------------ mutes, bans

  /** Active mute for a name, or null. Expired entries are dropped on read. */
  muteStatus(name, now = Date.now()) {
    return active(this.mutes, key(name), now);
  }

  banStatus(name, now = Date.now()) {
    return active(this.bans, key(name), now);
  }

  /** `minutes` of 0 means indefinite. */
  mute(name, minutes, reason, by) {
    const entry = {
      until: minutes > 0 ? Date.now() + minutes * 60_000 : 0,
      reason: reason || 'No reason given',
      by: by || 'system',
      at: new Date().toISOString()
    };
    this.mutes.set(key(name), entry);
    this.markDirty();
    return entry;
  }

  unmute(name) {
    const existed = this.mutes.delete(key(name));
    if (existed) this.markDirty();
    return existed;
  }

  /** `hours` of 0 means indefinite. */
  ban(name, hours, reason, by) {
    const entry = {
      until: hours > 0 ? Date.now() + hours * 3_600_000 : 0,
      reason: reason || 'No reason given',
      by: by || 'system',
      at: new Date().toISOString()
    };
    this.bans.set(key(name), entry);
    this.markDirty();
    return entry;
  }

  unban(name) {
    const existed = this.bans.delete(key(name));
    if (existed) this.markDirty();
    return existed;
  }

  /** Drops expired mutes and bans. Called on load and periodically. */
  prune(now = Date.now()) {
    let removed = 0;
    for (const map of [this.mutes, this.bans]) {
      for (const [name, entry] of map) {
        if (entry.until && entry.until <= now) {
          map.delete(name);
          removed += 1;
        }
      }
    }
    if (removed) this.markDirty();
    return removed;
  }

  // ------------------------------------------------------------------- chat

  /** Records a public message for context and, optionally, for the log file. */
  noteChat(name, text, channel = 'public') {
    const line = { at: new Date().toISOString(), name, text, channel };
    this.recent.push(line);
    if (this.recent.length > CHAT_BUFFER_LINES) this.recent.shift();
    if (this.keepChatLog) this.appendChatLog(line);
    return line;
  }

  appendChatLog(line) {
    try {
      const stat = statSync(this.chatLogFile, { throwIfNoEntry: false });
      if (stat && stat.size > CHAT_LOG_MAX_BYTES) {
        // Keep exactly one previous log; a game server should not quietly eat a disk.
        fs.rename(this.chatLogFile, `${this.chatLogFile}.1`).catch(() => {});
      }
    } catch {
      /* stat failures are not worth failing a chat message over */
    }
    const marker = line.channel === 'blocked' ? '\t[blocked]' : '';
    appendFile(this.chatLogFile, `${line.at}\t${line.name}${marker}\t${line.text}\n`, () => {});
  }

  /** The conversation around a report: recent lines, with the accused's marked. */
  chatContext(targetName, limit = CHAT_CONTEXT_LINES) {
    const target = key(targetName);
    return this.recent.slice(-limit).map((line) => ({
      at: line.at,
      name: line.name,
      text: line.text,
      blocked: line.channel === 'blocked',
      subject: key(line.name) === target
    }));
  }

  // ---------------------------------------------------------------- reports

  /**
   * Files a report. Returns { ok, id } or { ok: false, reason } when the
   * reporter is filing too many.
   */
  async addReport({ reporter, target, reason, note }) {
    if (!this.reportLimiter.hit(key(reporter))) {
      return { ok: false, reason: 'You have sent a lot of reports recently. Please give us time to read them.' };
    }
    this.reportCount += 1;
    const id = `r${Date.now().toString(36)}${this.reportCount.toString(36)}`;
    const record = {
      id,
      at: new Date().toISOString(),
      reporter,
      target,
      reason,
      note: note ? String(note).slice(0, 200) : '',
      context: this.chatContext(target)
    };
    try {
      await fs.mkdir(path.dirname(this.reportsFile), { recursive: true });
      await fs.appendFile(this.reportsFile, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (err) {
      return { ok: false, reason: 'The report could not be saved. Please tell an adult.', error: err.message };
    }
    return { ok: true, id, record };
  }

  /** Most recent reports, newest first, for the in-game moderator view. */
  async recentReports(limit = 10) {
    try {
      const raw = await fs.readFile(this.reportsFile, 'utf8');
      const lines = raw.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).reverse().map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------------ persistence

  markDirty() {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush().catch((err) => console.error('[moderation] save failed:', err.message));
    }, 1000);
    this.saveTimer.unref?.();
  }

  async flush() {
    if (!this.dirty) return false;
    this.dirty = false;
    const payload = JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      mutes: Object.fromEntries(this.mutes),
      bans: Object.fromEntries(this.bans),
      admins: [...this.admins]
    }, null, 2);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, payload, 'utf8');
    await fs.rename(tmp, this.file);
    return true;
  }

  stats() {
    return { mutes: this.mutes.size, bans: this.bans.size, admins: this.admins.size, chatLog: this.keepChatLog };
  }
}

/**
 * Chat flood and repetition guard.
 *
 * Separate from the general command rate limit: a player may legitimately send
 * forty commands a second while fighting, but eight messages in ten seconds is
 * always someone hammering the chat box.
 */
export class ChatGuard {
  constructor(options = {}) {
    this.window = new SlidingWindow(10_000, options.perTenSeconds ?? LIMITS.chatPerTenSeconds);
    this.repeatLimit = options.repeats ?? LIMITS.chatRepeats;
    this.last = new Map(); // key -> { text, count }
  }

  /**
   * @returns {{ok: true}} or {{ok: false, reason, message}}
   */
  check(name, text, now = Date.now()) {
    const id = key(name);
    const flat = String(text).toLowerCase().replace(/\s+/g, ' ').trim();

    if (!this.window.hit(id, now)) {
      return { ok: false, reason: 'flood', message: 'You are chatting very fast. Take a breath!' };
    }

    const previous = this.last.get(id);
    if (previous && previous.text === flat) {
      previous.count += 1;
      if (previous.count >= this.repeatLimit) {
        return { ok: false, reason: 'repeat', message: 'You have said that a few times already.' };
      }
    } else {
      this.last.set(id, { text: flat, count: 1 });
    }
    return { ok: true };
  }

  forget(name) {
    this.last.delete(key(name));
    this.window.clear(key(name));
  }
}

function key(name) {
  return String(name || '').trim().toLowerCase();
}

function active(map, id, now) {
  const entry = map.get(id);
  if (!entry) return null;
  if (entry.until && entry.until <= now) {
    map.delete(id);
    return null;
  }
  return entry;
}

/** Formats a mute/ban for the person it was applied to. */
export function describePenalty(entry, kind = 'muted') {
  if (!entry) return '';
  const until = entry.until
    ? `until ${new Date(entry.until).toUTCString().replace('GMT', 'UTC')}`
    : 'until a moderator lifts it';
  return `You are ${kind} ${until}. Reason: ${entry.reason}`;
}
