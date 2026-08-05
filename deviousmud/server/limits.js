/**
 * Abuse limits.
 *
 * Everything here answers the same question: "how much of this may one stranger
 * do?" The game rules themselves are enforced by the engine; these limits stop
 * someone from exhausting the server's resources before the engine ever sees a
 * command.
 *
 * All limits are per-process and in memory. That is the right trade for a
 * single-server game: a restart forgives everyone, which is fine, because
 * durable punishment is what bans are for.
 */

/** Environment-tunable, with defaults chosen for a small friendly server. */
export const LIMITS = Object.freeze({
  /** Concurrent WebSocket connections from one address. */
  connectionsPerIp: num('DM_MAX_CONN_PER_IP', 8),
  /** Commands per second once logged in. */
  commandsPerSecond: num('DM_MAX_COMMANDS', 40),
  /** Commands per second before logging in - only auth and ping are useful. */
  preAuthCommandsPerSecond: num('DM_MAX_PREAUTH_COMMANDS', 8),
  /** A connection that never authenticates is closed after this long. */
  preAuthTimeoutMs: num('DM_PREAUTH_TIMEOUT', 45_000),
  /** Failed logins allowed before a cool-off starts. */
  loginFailures: num('DM_LOGIN_FAILURES', 6),
  /** First cool-off, doubling with each further failure, up to the cap. */
  loginBackoffMs: num('DM_LOGIN_BACKOFF', 15_000),
  loginBackoffMaxMs: num('DM_LOGIN_BACKOFF_MAX', 15 * 60_000),
  /** New accounts one address may create per hour. */
  registrationsPerHour: num('DM_REGISTRATIONS_PER_HOUR', 4),
  /** Total accounts the server will hold (stops disk-filling by registration). */
  maxAccounts: num('DM_MAX_ACCOUNTS', 5000),
  /** Public chat messages per ten seconds. */
  chatPerTenSeconds: num('DM_CHAT_PER_10S', 8),
  /** Identical messages in a row before it counts as spam. */
  chatRepeats: num('DM_CHAT_REPEATS', 3),
  /** Auto-mute length when the chat limits are tripped. */
  chatAutoMuteSeconds: num('DM_CHAT_AUTOMUTE', 60),
  /** Players are disconnected after this long with no command at all. */
  idleTimeoutMs: num('DM_IDLE_TIMEOUT', 30 * 60_000),
  /** Reports one player may file per hour. */
  reportsPerHour: num('DM_REPORTS_PER_HOUR', 10),
  /** Party invitations one player may send per minute. An invite is a prompt
   *  on somebody else's screen, so it is a harassment vector like any other. */
  partyInvitesPerMinute: num('DM_PARTY_INVITES_PER_MIN', 6)
});

function num(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Counts events per key inside a sliding window.
 *
 * Keys are pruned as they are touched, plus a periodic sweep, so an attacker
 * cycling through addresses cannot grow the map without bound.
 */
export class SlidingWindow {
  constructor(windowMs, limit) {
    this.windowMs = windowMs;
    this.limit = limit;
    this.hits = new Map();
  }

  /** Records one event; returns true when the key is still within its limit. */
  hit(key, now = Date.now()) {
    const times = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    times.push(now);
    this.hits.set(key, times);
    return times.length <= this.limit;
  }

  count(key, now = Date.now()) {
    const times = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (times.length) this.hits.set(key, times);
    else this.hits.delete(key);
    return times.length;
  }

  clear(key) {
    this.hits.delete(key);
  }

  /** Drops keys whose events have all aged out. */
  sweep(now = Date.now()) {
    for (const [key, times] of this.hits) {
      const live = times.filter((t) => now - t < this.windowMs);
      if (live.length) this.hits.set(key, live);
      else this.hits.delete(key);
    }
    return this.hits.size;
  }
}

/** Concurrent connections per address. */
export class ConnectionLimiter {
  constructor(limit = LIMITS.connectionsPerIp) {
    this.limit = limit;
    this.counts = new Map();
  }

  /** Returns false when the address is already at its limit. */
  add(address) {
    const key = normaliseAddress(address);
    const count = (this.counts.get(key) || 0) + 1;
    if (count > this.limit) return false;
    this.counts.set(key, count);
    return true;
  }

  remove(address) {
    const key = normaliseAddress(address);
    const count = (this.counts.get(key) || 0) - 1;
    if (count > 0) this.counts.set(key, count);
    else this.counts.delete(key);
  }

  count(address) {
    return this.counts.get(normaliseAddress(address)) || 0;
  }
}

/**
 * Failed-login backoff, keyed by address *and* by account name, so neither
 * "guess one password against many accounts" nor "guess many passwords against
 * one account" gets very far.
 */
export class LoginThrottle {
  constructor(options = {}) {
    this.allowance = options.failures ?? LIMITS.loginFailures;
    this.base = options.backoffMs ?? LIMITS.loginBackoffMs;
    this.max = options.backoffMaxMs ?? LIMITS.loginBackoffMaxMs;
    this.state = new Map();
  }

  /** Milliseconds the key must wait, or 0 if it may try now. */
  blockedFor(key, now = Date.now()) {
    const entry = this.state.get(key);
    if (!entry || !entry.until) return 0;
    if (entry.until <= now) {
      entry.until = 0;
      return 0;
    }
    return entry.until - now;
  }

  /** Records a failure and returns the wait it triggered, in milliseconds. */
  fail(key, now = Date.now()) {
    const entry = this.state.get(key) || { failures: 0, until: 0 };
    entry.failures += 1;
    if (entry.failures >= this.allowance) {
      const over = entry.failures - this.allowance;
      entry.until = now + Math.min(this.max, this.base * 2 ** over);
    }
    this.state.set(key, entry);
    return Math.max(0, entry.until - now);
  }

  /** A successful login forgives the key entirely. */
  succeed(key) {
    this.state.delete(key);
  }

  sweep(now = Date.now()) {
    for (const [key, entry] of this.state) {
      if (!entry.until && entry.failures === 0) this.state.delete(key);
      else if (entry.until && entry.until + this.max < now) this.state.delete(key);
    }
    return this.state.size;
  }
}

/** IPv6-mapped IPv4 addresses arrive as ::ffff:1.2.3.4; treat them as one. */
export function normaliseAddress(address) {
  if (!address) return 'unknown';
  return String(address).replace(/^::ffff:/, '');
}

export function describeWait(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
