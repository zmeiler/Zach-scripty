/**
 * Combat maths.
 *
 * Two rolls per attack: an accuracy roll (attacker's gear and skill against the
 * defender's) and, if it lands, a damage roll from 0 to the attacker's max hit.
 * The numbers are tuned so an unarmed level-1 player can beat a giant rat but
 * will lose to a rock golem.
 */

import { ITEMS } from '../items.js';

export const ATTACK_STYLES = Object.freeze({
  accurate: { id: 'accurate', name: 'Accurate', bonus: { attack: 3 }, xp: { attack: 1 } },
  aggressive: { id: 'aggressive', name: 'Aggressive', bonus: { strength: 3 }, xp: { strength: 1 } },
  defensive: { id: 'defensive', name: 'Defensive', bonus: { defence: 3 }, xp: { defence: 1 } },
  controlled: { id: 'controlled', name: 'Controlled', bonus: {}, xp: { attack: 1 / 3, strength: 1 / 3, defence: 1 / 3 } }
});

export const ATTACK_SPEED_TICKS = 4;

/** Sums equipment bonuses across every worn item. */
export function equipmentBonuses(equipment) {
  const total = { attack: 0, strength: 0, defence: 0 };
  for (const slot of Object.keys(equipment || {})) {
    const worn = equipment[slot];
    if (!worn) continue;
    const def = ITEMS[worn.id];
    if (!def || !def.bonuses) continue;
    total.attack += def.bonuses.attack || 0;
    total.strength += def.bonuses.strength || 0;
    total.defence += def.bonuses.defence || 0;
  }
  return total;
}

function styleBonus(styleId, skill) {
  const style = ATTACK_STYLES[styleId] || ATTACK_STYLES.accurate;
  return style.bonus[skill] || 0;
}

export function attackRoll(level, gearBonus) {
  return (level + 8) * (gearBonus + 64);
}

export function hitChance(attacker, defender) {
  const atk = attackRoll(attacker.level, attacker.bonus);
  const def = attackRoll(defender.level, defender.bonus);
  if (atk > def) return 1 - (def + 2) / (2 * (atk + 1));
  return atk / (2 * (def + 1));
}

export function maxHit(strengthLevel, strengthBonus) {
  return Math.max(1, Math.floor(0.5 + (strengthLevel + 8) * (strengthBonus + 64) / 640));
}

/**
 * Resolves a single attack.
 * @param rng function returning [0,1)
 * @returns {{hit:boolean, damage:number, max:number, chance:number}}
 */
export function resolveAttack(attacker, defender, rng) {
  const chance = hitChance(
    { level: attacker.attackLevel + styleBonus(attacker.style, 'attack'), bonus: attacker.attackBonus },
    { level: defender.defenceLevel + styleBonus(defender.style, 'defence'), bonus: defender.defenceBonus }
  );
  const max = maxHit(attacker.strengthLevel + styleBonus(attacker.style, 'strength'), attacker.strengthBonus);
  if (rng() > chance) return { hit: false, damage: 0, max, chance };
  const damage = Math.max(1, Math.floor(rng() * (max + 1)));
  return { hit: true, damage, max, chance };
}

/** Experience awarded for dealing `damage` with the given style. */
export function combatXp(styleId, damage) {
  const style = ATTACK_STYLES[styleId] || ATTACK_STYLES.accurate;
  const award = { hitpoints: damage * 1.33 };
  for (const [skill, share] of Object.entries(style.xp)) {
    award[skill] = (award[skill] || 0) + damage * 4 * share;
  }
  return award;
}

/** Builds the stat block used by resolveAttack for a player. */
export function playerCombatStats(player) {
  const bonuses = equipmentBonuses(player.equipment);
  return {
    attackLevel: player.skills.attack.level,
    strengthLevel: player.skills.strength.level,
    defenceLevel: player.skills.defence.level,
    attackBonus: bonuses.attack,
    strengthBonus: bonuses.strength,
    defenceBonus: bonuses.defence,
    style: player.attackStyle || 'accurate'
  };
}

/**
 * The strength bonus an NPC needs in order to hit exactly as hard as its
 * definition says.
 *
 * `maxHit` in an NPC definition is meant to be read literally - "this creature
 * can take four hitpoints off you" - but max hit is a function of both strength
 * level and strength bonus, and an NPC's strength level rises with its attack.
 * Multiplying `maxHit` by a constant only lines up while the two happen to be
 * similar; by the time a creature attacks at 70 it hits for twice what its
 * definition claims. So invert `maxHit` instead and solve for the bonus.
 */
export function strengthBonusForMaxHit(strengthLevel, wanted) {
  return Math.max(0, Math.round((640 * wanted) / (strengthLevel + 8) - 64));
}

/** Builds the stat block for an NPC from its definition. */
export function npcCombatStats(def) {
  const level = def.attack ?? 1;
  return {
    attackLevel: level,
    strengthLevel: level,
    defenceLevel: def.defence ?? 1,
    attackBonus: Math.round(level * 1.2),
    strengthBonus: strengthBonusForMaxHit(level, def.maxHit ?? 1),
    defenceBonus: Math.round((def.defence ?? 1) * 1.4),
    style: 'accurate'
  };
}
