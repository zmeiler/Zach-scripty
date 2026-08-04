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
  },

  // ---------------------------------------------------------------- the mine
  // Four quests that walk a player down the shaft one level at a time: get a
  // light, earn the first level, reach the second, and finally settle what is
  // keeping the whole hollow warm.

  lights_in_the_dark: {
    id: 'lights_in_the_dark',
    name: 'Lights in the Dark',
    difficulty: 'Novice',
    length: 'Short',
    startHint: 'Speak to Miner Mira once the seam is open.',
    description: 'Mira has opened the old seam. Before anyone goes down it, they will need something to see by.',
    requires: { quests: ['the_deep_seam'] },
    stages: [
      { id: 1, journal: 'Mira wants me to get hold of a torch before going down.', objective: { type: 'collect', item: 'torch', count: 1, label: 'Get a torch (Bea sells them)' } },
      { id: 2, journal: 'Now to climb down into the mine itself.', objective: { type: 'action', action: 'climb_mine_upper', count: 1, label: 'Climb down into Copper Hollow Mine' } },
      { id: 3, journal: 'Somebody is already down here. I should find them.', objective: { type: 'talk', npc: 'foreman_dorn', label: 'Find Foreman Dorn at the foot of the ladder' } }
    ],
    rewards: {
      coins: 600,
      items: [{ id: 'miners_lantern', count: 1 }],
      xp: { mining: 800, firemaking: 400 },
      text: 'Dorn hands you a proper lantern. "Torches blow out," he says. "This one does not."'
    }
  },

  the_foremans_tally: {
    id: 'the_foremans_tally',
    name: 'The Foreman\'s Tally',
    difficulty: 'Intermediate',
    length: 'Medium',
    startHint: 'Speak to Foreman Dorn in Copper Hollow Mine.',
    description: 'Dorn has been counting the years the mine stood empty. He would rather start counting ore again.',
    requires: { quests: ['lights_in_the_dark'], skills: { mining: 15 } },
    stages: [
      { id: 1, journal: 'Dorn wants the bats cleared out of the upper galleries.', objective: { type: 'kill', npc: 'cave_bat', count: 6, label: 'See off 6 cave bats' } },
      { id: 2, journal: 'And the crawlers in the far tunnels.', objective: { type: 'kill', npc: 'tunnel_crawler', count: 4, label: 'See off 4 tunnel crawlers' } },
      { id: 3, journal: 'Now to prove the seam is worth working: eight iron ore.', objective: { type: 'collect', item: 'iron_ore', count: 8, label: 'Mine 8 iron ore' } },
      { id: 4, journal: 'Dorn will want to see the ore counted.', objective: { type: 'talk', npc: 'foreman_dorn', label: 'Bring the ore to Foreman Dorn' } }
    ],
    rewards: {
      coins: 1200,
      items: [{ id: 'miners_boots', count: 1 }, { id: 'dorns_tally', count: 1 }],
      xp: { mining: 2500, smithing: 1200, attack: 800, defence: 800 },
      text: 'Dorn notches the tally stick one last time, then gives it to you.'
    }
  },

  deeper_than_dorn_went: {
    id: 'deeper_than_dorn_went',
    name: 'Deeper Than Dorn Went',
    difficulty: 'Experienced',
    length: 'Long',
    startHint: 'Speak to Foreman Dorn once the upper mine is working again.',
    description: 'There is a second ladder, and a metal nobody in Emberfall has ever smelted. Dorn will not go down it himself.',
    requires: { quests: ['the_foremans_tally'], skills: { mining: 30, defence: 15 } },
    stages: [
      { id: 1, journal: 'Dorn pointed me at the second ladder, down to the Deep Seam.', objective: { type: 'action', action: 'climb_mine_deep', count: 1, label: 'Climb down into The Deep Seam' } },
      { id: 2, journal: 'The blue-green rock down here is mithril. Three should do.', objective: { type: 'collect', item: 'mithril_ore', count: 3, label: 'Mine 3 mithril ore' } },
      { id: 3, journal: 'One mithril bar - the furnace will want coal with it.', objective: { type: 'collect', item: 'mithril_bar', count: 1, label: 'Smelt a mithril bar' } },
      { id: 4, journal: 'The deep golems will not let anyone work the seam.', objective: { type: 'kill', npc: 'deep_golem', count: 3, label: 'See off 3 deep golems' } },
      { id: 5, journal: 'Dorn has been waiting at the top of the ladder this whole time.', objective: { type: 'talk', npc: 'foreman_dorn', label: 'Report back to Foreman Dorn' } }
    ],
    rewards: {
      coins: 2500,
      items: [{ id: 'mithril_pickaxe', count: 1 }],
      xp: { mining: 7000, smithing: 5000, attack: 2000, defence: 2000, hitpoints: 1500 },
      text: 'Dorn holds the bar up to his lantern for a long time without saying anything.'
    }
  },

  the_sleeping_forge: {
    id: 'the_sleeping_forge',
    name: 'The Sleeping Forge',
    difficulty: 'Master',
    length: 'Long',
    startHint: 'Speak to Miner Mira with the Deep Seam behind you.',
    description: 'Something at the bottom of the mine has been dreaming too hot for a very long time. Mira would like it to sleep more quietly.',
    requires: { quests: ['deeper_than_dorn_went'], skills: { attack: 40, defence: 35, mining: 40 } },
    stages: [
      { id: 1, journal: 'Mira wants two ember shards from the bottom of the mine.', objective: { type: 'collect', item: 'ember_shard', count: 2, label: 'Recover 2 ember shards' } },
      { id: 2, journal: 'The guardians of the Ember Chamber will have to be moved aside.', objective: { type: 'kill', npc: 'cinder_guardian', count: 3, label: 'See off 3 cinder guardians' } },
      { id: 3, journal: 'Cinderheart itself. Mira says to settle it, not to hurt it.', objective: { type: 'kill', npc: 'cinderheart', count: 1, label: 'Settle Cinderheart back to sleep' } },
      { id: 4, journal: 'It is sleeping quietly. Mira should hear it from her.', objective: { type: 'talk', npc: 'miner_mira', label: 'Tell Miner Mira it is over' } }
    ],
    rewards: {
      coins: 6000,
      items: [{ id: 'forge_wardens_ring', count: 1 }],
      xp: { attack: 12000, strength: 12000, defence: 12000, hitpoints: 8000, mining: 8000, smithing: 8000 },
      text: 'Mira calls you Forge-warden, and means it. The hollow has never been so quiet.'
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
