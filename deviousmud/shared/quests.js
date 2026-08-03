/**
 * Quest definitions.
 *
 * A quest is a list of stages. Each stage has one objective; objectives of type
 * `collect`, `kill` and `action` advance automatically when their counter is
 * met, while `talk` objectives advance through dialogue effects. The engine
 * stores only { stage, counter, completed } per quest, so save files stay tiny
 * and quests can be re-tuned without migrating player data.
 */

export const QUESTS = Object.freeze({
  welcome: {
    id: 'welcome',
    name: 'Welcome to Emberfall',
    difficulty: 'Novice',
    length: 'Short',
    startHint: 'Speak to Mayor Aldric in the village square.',
    description: 'The mayor wants to show a newcomer how life works in Emberfall: wood, fire and a hot meal.',
    stages: [
      { id: 1, journal: 'Mayor Aldric asked me to chop a tree for logs.', objective: { type: 'collect', item: 'logs', count: 1, label: 'Chop a tree for logs' } },
      { id: 2, journal: 'Now I should light the logs with my tinderbox.', objective: { type: 'action', action: 'light_fire', count: 1, label: 'Light a fire with your tinderbox' } },
      { id: 3, journal: 'A hot meal next: catch a shrimp in Lake Serene.', objective: { type: 'collect', item: 'raw_shrimp', count: 1, label: 'Net a raw shrimp at Lake Serene' } },
      { id: 4, journal: 'I should cook the shrimp on a fire or a range.', objective: { type: 'collect', item: 'shrimp', count: 1, label: 'Cook the shrimp' } },
      { id: 5, journal: 'Time to report back to Mayor Aldric.', objective: { type: 'talk', npc: 'mayor_aldric', label: 'Return to Mayor Aldric' } }
    ],
    rewards: {
      coins: 250,
      items: [{ id: 'travellers_cape', count: 1 }],
      xp: { woodcutting: 120, firemaking: 120, cooking: 120, fishing: 120 },
      text: 'Emberfall feels like home already.'
    }
  },

  lost_lantern: {
    id: 'lost_lantern',
    name: 'Willow\'s Lost Lantern',
    difficulty: 'Novice',
    length: 'Short',
    startHint: 'Speak to Woodsman Willow north of the village.',
    description: 'Willow\'s lantern was borrowed by the imps of Copper Hollow. She would rather like it back.',
    requires: { quests: ['welcome'] },
    stages: [
      { id: 1, journal: 'The cave imps in Copper Hollow took Willow\'s lantern glass.', objective: { type: 'collect', item: 'lantern_glass', count: 1, label: 'Recover the lantern glass from a cave imp' } },
      { id: 2, journal: 'I have the glass. Willow is waiting at the woodland edge.', objective: { type: 'talk', npc: 'woodsman_willow', label: 'Bring the glass to Woodsman Willow' } }
    ],
    rewards: {
      coins: 400,
      items: [{ id: 'steel_axe', count: 1 }, { id: 'lantern', count: 1 }],
      xp: { woodcutting: 500, mining: 250 },
      text: 'Willow hangs the mended lantern outside her hut.'
    }
  },

  wolves_at_the_gate: {
    id: 'wolves_at_the_gate',
    name: 'Wolves at the Gate',
    difficulty: 'Intermediate',
    length: 'Medium',
    startHint: 'Speak to Captain Rook by the south gate.',
    description: 'The wolves of the Whispering Woods have grown bold. Rook needs someone to convince them to move along.',
    requires: { quests: ['welcome'], skills: { attack: 5 } },
    stages: [
      { id: 1, journal: 'Captain Rook asked me to see off five forest wolves.', objective: { type: 'kill', npc: 'forest_wolf', count: 5, label: 'See off 5 forest wolves' } },
      { id: 2, journal: 'The wolves have moved on. Rook will want to hear it.', objective: { type: 'talk', npc: 'captain_rook', label: 'Report back to Captain Rook' } }
    ],
    rewards: {
      coins: 800,
      items: [{ id: 'bronze_platebody', count: 1 }, { id: 'bronze_shield', count: 1 }],
      xp: { attack: 900, strength: 900, defence: 900, hitpoints: 400 },
      text: 'Rook pins a small brass wolf to your cape.'
    }
  },

  the_deep_seam: {
    id: 'the_deep_seam',
    name: 'The Deep Seam',
    difficulty: 'Experienced',
    length: 'Long',
    startHint: 'Speak to Miner Mira at the mouth of Copper Hollow.',
    description: 'Mira believes something very old is buried at the back of the hollow. She needs bronze, and a brave assistant.',
    requires: { quests: ['lost_lantern'], skills: { mining: 5 } },
    stages: [
      { id: 1, journal: 'Mira needs four bronze bars smelted from copper and tin.', objective: { type: 'collect', item: 'bronze_bar', count: 4, label: 'Smelt 4 bronze bars' } },
      { id: 2, journal: 'Mira took the bars. Now to face the golems at the back of the hollow.', objective: { type: 'kill', npc: 'rock_golem', count: 2, label: 'Defeat 2 rock golems' } },
      { id: 3, journal: 'A golem dropped an ancient coin. I should find one to bring back.', objective: { type: 'collect', item: 'ancient_coin', count: 1, label: 'Recover an ancient coin' } },
      { id: 4, journal: 'Mira will want to see the ancient coin at once.', objective: { type: 'talk', npc: 'miner_mira', label: 'Show the ancient coin to Miner Mira' } }
    ],
    rewards: {
      coins: 1500,
      items: [{ id: 'guardian_blade', count: 1 }],
      xp: { mining: 2500, smithing: 2500, attack: 1200, defence: 1200 },
      text: 'Mira names the seam after you. You will never hear the end of it.'
    }
  }
});

export const QUEST_IDS = Object.freeze(Object.keys(QUESTS));

export function questDef(id) {
  return QUESTS[id] || null;
}

export function finalStage(id) {
  const quest = QUESTS[id];
  return quest ? quest.stages[quest.stages.length - 1].id : 0;
}

export function stageDef(questId, stage) {
  const quest = QUESTS[questId];
  if (!quest) return null;
  return quest.stages.find((s) => s.id === stage) || null;
}

/** Total quest points available - one per stage of every quest. */
export function maxQuestPoints() {
  return QUEST_IDS.reduce((sum, id) => sum + QUESTS[id].stages.length, 0);
}
