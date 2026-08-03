/**
 * Account storage.
 *
 * Passwords are hashed with scrypt and a per-account random salt - the plain
 * text is never written anywhere. Character data lives in the same record, so
 * one JSON file is the entire database. That is deliberate: this project is
 * meant to be cloned and run in under a minute, and swapping this module for a
 * real database is a contained change (see docs/DESIGN.md).
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from '../shared/constants.js';

const SCRYPT_KEYLEN = 64;
const SAVE_DEBOUNCE_MS = 2000;

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 _-]*$/;

export function validateName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < MIN_NAME_LENGTH) return { ok: false, reason: `Names need at least ${MIN_NAME_LENGTH} characters.` };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, reason: `Names can be at most ${MAX_NAME_LENGTH} characters.` };
  if (!NAME_PATTERN.test(name)) return { ok: false, reason: 'Use letters, numbers, spaces, hyphens or underscores.' };
  return { ok: true, name };
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString('hex'));
    });
  });
}

export class AccountStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.accounts = new Map();
    this.dirty = false;
    this.saveTimer = null;
    this.loaded = false;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const [key, value] of Object.entries(parsed.accounts || {})) {
        this.accounts.set(key, value);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    }
    this.loaded = true;
    return this.accounts.size;
  }

  key(name) {
    return name.toLowerCase();
  }

  has(name) {
    return this.accounts.has(this.key(name));
  }

  get(name) {
    return this.accounts.get(this.key(name)) || null;
  }

  async register(name, password, appearance) {
    const check = validateName(name);
    if (!check.ok) return { ok: false, reason: check.reason };
    if (this.has(check.name)) return { ok: false, reason: 'That name is already taken.' };
    if (typeof password !== 'string' || password.length < 4) {
      return { ok: false, reason: 'Passwords need at least 4 characters.' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPassword(password, salt);
    const account = {
      name: check.name,
      salt,
      hash,
      created: new Date().toISOString(),
      lastLogin: null,
      save: { name: check.name, appearance }
    };
    this.accounts.set(this.key(check.name), account);
    this.markDirty();
    return { ok: true, account };
  }

  async authenticate(name, password) {
    const check = validateName(name);
    if (!check.ok) return { ok: false, reason: check.reason };
    const account = this.get(check.name);
    if (!account) return { ok: false, reason: 'No character with that name.' };
    const hash = await hashPassword(password || '', account.salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(account.hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: 'That password does not match.' };
    }
    account.lastLogin = new Date().toISOString();
    this.markDirty();
    return { ok: true, account };
  }

  saveCharacter(name, data) {
    const account = this.get(name);
    if (!account) return false;
    account.save = data;
    account.lastSeen = new Date().toISOString();
    this.markDirty();
    return true;
  }

  markDirty() {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush().catch((err) => console.error('[accounts] save failed:', err.message));
    }, SAVE_DEBOUNCE_MS);
    this.saveTimer.unref?.();
  }

  /** Atomic write: temp file first, then rename over the real one. */
  async flush() {
    if (!this.dirty) return false;
    this.dirty = false;
    const payload = JSON.stringify(
      { version: 1, savedAt: new Date().toISOString(), accounts: Object.fromEntries(this.accounts) },
      null,
      0
    );
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, payload, 'utf8');
    await fs.rename(tmp, this.filePath);
    return true;
  }

  stats() {
    return { accounts: this.accounts.size, file: this.filePath };
  }
}
