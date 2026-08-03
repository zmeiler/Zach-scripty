/**
 * Runs the data-driven conversation trees in shared/dialogue.js.
 *
 * The server owns the conversation state: the client only ever says "I picked
 * option 2", which keeps quest rewards impossible to fake from the browser.
 */

import { dialogueFor } from '../dialogue.js';

export function evaluateCondition(player, condition, ctx) {
  if (!condition) return true;
  if (condition.quest) {
    const state = player.quests[condition.quest];
    if (!state) return false;
    if (condition.completed === true && !state.completed) return false;
    if (condition.completed === false && state.completed) return false;
    if (condition.notStarted === true && state.stage !== 0) return false;
    if (!state.completed) {
      if (condition.stageMin !== undefined && state.stage < condition.stageMin) return false;
      if (condition.stageMax !== undefined && state.stage > condition.stageMax) return false;
    } else if (condition.stageMin !== undefined || condition.stageMax !== undefined) {
      // A completed quest is past every stage gate.
      if (condition.completed !== true) return false;
    }
  }
  if (condition.hasItem && ctx.countItem(condition.hasItem) < (condition.itemCount || 1)) return false;
  if (condition.skill && player.skills[condition.skill].level < (condition.level || 1)) return false;
  if (condition.questPoints !== undefined && ctx.questPoints() < condition.questPoints) return false;
  return true;
}

/** Picks the entry node for a conversation with `npcType`. */
export function entryNode(player, npcType, ctx) {
  const tree = dialogueFor(npcType);
  if (!tree) return null;
  for (const rule of tree.entry) {
    if (evaluateCondition(player, rule.when, ctx)) return rule.node;
  }
  return null;
}

export function getNode(npcType, nodeId) {
  const tree = dialogueFor(npcType);
  if (!tree || !nodeId) return null;
  return tree.nodes[nodeId] || null;
}

/**
 * Serialises a node for the client, filtering out options whose conditions the
 * player does not meet.
 */
export function presentNode(player, npcType, nodeId, ctx) {
  const node = getNode(npcType, nodeId);
  if (!node) return null;
  const options = (node.options || [])
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => evaluateCondition(player, option.when, ctx));
  return {
    npcType,
    nodeId,
    speaker: node.speaker || 'npc',
    text: node.text,
    options: options.map(({ option, index }) => ({ index, text: option.text })),
    canContinue: options.length === 0 && Boolean(node.next)
  };
}

/** Effects that fire when a node is entered. */
export function nodeEffects(npcType, nodeId) {
  const node = getNode(npcType, nodeId);
  return (node && node.effects) || [];
}

/**
 * Resolves the player's choice.
 * @returns {{ nextNode: string|null, effects: Array }}
 */
export function chooseOption(player, npcType, nodeId, optionIndex, ctx) {
  const node = getNode(npcType, nodeId);
  if (!node) return { nextNode: null, effects: [] };
  if (!node.options || node.options.length === 0) {
    return { nextNode: node.next || null, effects: [] };
  }
  const option = node.options[optionIndex];
  if (!option || !evaluateCondition(player, option.when, ctx)) {
    return { nextNode: null, effects: [] };
  }
  return { nextNode: option.next || null, effects: option.effects || [] };
}
