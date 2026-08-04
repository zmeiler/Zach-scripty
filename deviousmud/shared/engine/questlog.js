/**
 * Quest bookkeeping: starting quests, tracking objective progress and paying
 * out rewards. The engine calls `refreshQuests` after anything that could move
 * a quest forward (inventory change, kill, skill action, dialogue).
 */

import { QUESTS, QUEST_IDS, questDef, stageDef } from '../quests.js';

export function createQuestState() {
  const state = {};
  for (const id of QUEST_IDS) state[id] = { stage: 0, counter: 0, completed: false };
  return state;
}

export function normaliseQuestState(saved) {
  const state = createQuestState();
  if (!saved || typeof saved !== 'object') return state;
  for (const id of QUEST_IDS) {
    const entry = saved[id];
    if (!entry) continue;
    state[id] = {
      stage: Math.max(0, Math.floor(entry.stage || 0)),
      counter: Math.max(0, Math.floor(entry.counter || 0)),
      completed: Boolean(entry.completed)
    };
  }
  return state;
}

export function questPoints(questState) {
  let points = 0;
  for (const id of QUEST_IDS) {
    const entry = questState[id];
    if (!entry) continue;
    points += entry.completed ? QUESTS[id].stages.length : Math.max(0, entry.stage - 1);
  }
  return points;
}

/** Requirement check used before a quest can be started. */
export function canStart(player, questId) {
  const quest = questDef(questId);
  if (!quest) return { ok: false, reason: 'That quest does not exist.' };
  const state = player.quests[questId];
  if (state.completed) return { ok: false, reason: 'You have already finished that.' };
  if (state.stage > 0) return { ok: false, reason: 'You are already on that quest.' };
  const req = quest.requires;
  if (req) {
    for (const other of req.quests || []) {
      if (!player.quests[other] || !player.quests[other].completed) {
        return { ok: false, reason: `You must finish "${QUESTS[other].name}" first.` };
      }
    }
    for (const [skill, level] of Object.entries(req.skills || {})) {
      if (player.skills[skill].level < level) {
        return { ok: false, reason: `You need ${skill} level ${level} first.` };
      }
    }
  }
  return { ok: true };
}

export function startQuest(player, questId) {
  const check = canStart(player, questId);
  if (!check.ok) return { started: false, reason: check.reason };
  player.quests[questId] = { stage: 1, counter: 0, completed: false };
  return { started: true, quest: questDef(questId) };
}

/**
 * Records a countable event. Returns true when it advanced a counter.
 */
export function recordEvent(player, type, key, amount = 1) {
  let changed = false;
  for (const id of QUEST_IDS) {
    const state = player.quests[id];
    if (!state || state.completed || state.stage === 0) continue;
    const stage = stageDef(id, state.stage);
    if (!stage || stage.objective.type !== type) continue;
    const objective = stage.objective;
    const matches =
      (type === 'kill' && objective.npc === key) ||
      (type === 'action' && objective.action === key);
    if (!matches) continue;
    state.counter += amount;
    changed = true;
  }
  return changed;
}

/**
 * Advances any quest whose current objective is satisfied.
 * @param countItem (itemId) => number   how many the player is carrying
 * @returns array of { questId, stage, journal, completedStage }
 */
export function refreshQuests(player, countItem) {
  const advanced = [];
  for (const id of QUEST_IDS) {
    const state = player.quests[id];
    if (!state || state.completed || state.stage === 0) continue;
    let guard = 0;
    while (guard < 10) {
      guard += 1;
      const stage = stageDef(id, state.stage);
      if (!stage) break;
      const objective = stage.objective;
      let done = false;
      if (objective.type === 'collect') done = countItem(objective.item) >= (objective.count || 1);
      else if (objective.type === 'kill' || objective.type === 'action') done = state.counter >= (objective.count || 1);
      if (!done) break;

      const quest = questDef(id);
      const nextStage = quest.stages.find((s) => s.id === state.stage + 1);
      if (!nextStage) break; // final stage waits for its `talk` hand-in
      state.stage = nextStage.id;
      state.counter = 0;
      advanced.push({ questId: id, stage: nextStage.id, journal: nextStage.journal });
    }
  }
  return advanced;
}

/** Progress text for the quest journal UI. */
export function objectiveProgress(player, questId) {
  const state = player.quests[questId];
  if (!state || state.completed || state.stage === 0) return null;
  const stage = stageDef(questId, state.stage);
  if (!stage) return null;
  const objective = stage.objective;
  return {
    label: objective.label,
    type: objective.type,
    have: objective.type === 'collect' ? null : state.counter,
    need: objective.count || 1
  };
}

export function isComplete(player, questId) {
  return Boolean(player.quests[questId] && player.quests[questId].completed);
}
