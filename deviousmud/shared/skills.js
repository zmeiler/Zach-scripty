/**
 * Experience curve and level helpers.
 *
 * The curve is the classic "each level costs a little more than the last"
 * progression: fast early levels for new players, a long tail for veterans.
 */

import { MAX_LEVEL, SKILLS } from './constants.js';

/** XP_TABLE[n] is the total experience required to reach level n. */
export const XP_TABLE = buildXpTable();

function buildXpTable() {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level += 1) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
}

export function xpForLevel(level) {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return XP_TABLE[clamped];
}

export function levelForXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= XP_TABLE[level + 1]) level += 1;
  return level;
}

/** Fraction (0..1) of progress from the current level to the next one. */
export function levelProgress(xp) {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const base = XP_TABLE[level];
  const next = XP_TABLE[level + 1];
  return (xp - base) / (next - base);
}

export function createSkillSet() {
  const skills = {};
  for (const skill of SKILLS) {
    skills[skill] = { xp: 0, level: 1 };
  }
  // Everybody starts alive with 10 hitpoints.
  skills.hitpoints.xp = xpForLevel(10);
  skills.hitpoints.level = 10;
  return skills;
}

/**
 * Combat level is a rough "how dangerous am I" number shown next to names.
 */
export function combatLevel(skills) {
  const att = skills.attack.level;
  const str = skills.strength.level;
  const def = skills.defence.level;
  const hp = skills.hitpoints.level;
  return Math.floor((def + hp) * 0.25 + (att + str) * 0.325);
}

export function totalLevel(skills) {
  return SKILLS.reduce((sum, skill) => sum + skills[skill].level, 0);
}

export function totalXp(skills) {
  return SKILLS.reduce((sum, skill) => sum + skills[skill].xp, 0);
}
