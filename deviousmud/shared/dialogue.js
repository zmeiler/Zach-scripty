/**
 * Conversation trees.
 *
 * Each NPC has a list of `entry` rules; the first rule whose condition passes
 * decides where the conversation starts, which is how one NPC can greet a
 * stranger, nudge a quester and congratulate a veteran without any code.
 *
 * Condition shape (all fields optional, all must pass):
 *   { quest, stageMin, stageMax, completed, notStarted, hasItem, itemCount,
 *     skill, level, questPoints }
 *
 * Effect shape:
 *   { type: 'startQuest'|'setStage'|'completeQuest'|'giveItem'|'takeItem'
 *           |'openShop'|'openBank'|'message'|'heal' , ... }
 */

export const DIALOGUE = Object.freeze({
  // -------------------------------------------------------------------------
  mayor_aldric: {
    entry: [
      { when: { quest: 'welcome', completed: true }, node: 'done' },
      { when: { quest: 'welcome', stageMin: 5 }, node: 'finish' },
      { when: { quest: 'welcome', stageMin: 1, stageMax: 4 }, node: 'progress' },
      { node: 'greet' }
    ],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Welcome to Emberfall! You have the look of someone who has just walked a very long road.',
        options: [
          { text: 'Where am I, exactly?', next: 'where' },
          { text: 'Is there anything I can help with?', next: 'offer' },
          { text: 'Just passing through, thanks.', next: 'bye' }
        ]
      },
      where: {
        speaker: 'npc',
        text: 'Emberfall Village - woods to the north, the old copper hollow west, Lake Serene east, and the meadow south. Nothing here bites too hard.',
        options: [{ text: 'Is there anything I can help with?', next: 'offer' }, { text: 'Good to know.', next: 'bye' }]
      },
      offer: {
        speaker: 'npc',
        text: 'There is, as it happens. Every newcomer learns the same three things: cut wood, make fire, cook supper. Do that and I will call you a local.',
        options: [
          { text: 'I will do it.', next: 'accept', effects: [{ type: 'startQuest', quest: 'welcome' }] },
          { text: 'Maybe later.', next: 'bye' }
        ]
      },
      accept: {
        speaker: 'npc',
        text: 'Splendid. Bea sells an axe and a tinderbox if you need them - here, this should cover it. Start with a tree, any tree.',
        effects: [{ type: 'giveItem', id: 'coins', count: 100 }, { type: 'giveItem', id: 'bronze_axe', count: 1 }],
        next: null
      },
      progress: {
        speaker: 'npc',
        text: 'Wood, fire, supper. Take your time - the village is not going anywhere.',
        options: [{ text: 'Where do I get a shrimp?', next: 'hint_fish' }, { text: 'I am on it.', next: null }]
      },
      hint_fish: {
        speaker: 'npc',
        text: 'Lake Serene, east along the road. Finn is usually stood in it up to his knees. A small net is all you need.',
        next: null
      },
      finish: {
        speaker: 'npc',
        text: 'Wood, fire and a hot meal. You are officially an Emberfaller. Take this cape - it will keep the wind off.',
        effects: [{ type: 'completeQuest', quest: 'welcome' }],
        next: null
      },
      done: {
        speaker: 'npc',
        text: 'Good to see you again. Rook has been muttering about wolves, and Mira never stops talking about her seam. Somebody should help them.',
        options: [{ text: 'I will see what I can do.', next: null }]
      },
      bye: { speaker: 'npc', text: 'Mind the fountain. It is slippery.', next: null }
    }
  },

  // -------------------------------------------------------------------------
  tutor_pip: {
    entry: [{ node: 'greet' }],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Hello! I am Pip. I explain things. What would you like explaining?',
        options: [
          { text: 'How do I move and fight?', next: 'controls' },
          { text: 'How do skills work?', next: 'skills' },
          { text: 'What can I do around here?', next: 'activities' },
          { text: 'Can you top me up?', next: 'heal' },
          { text: 'Nothing, thanks.', next: null }
        ]
      },
      controls: {
        speaker: 'npc',
        text: 'Click or tap the ground to walk. Click a creature to fight it, and click again on anything to see what else it can do. Hold the click for a menu of every option.',
        options: [{ text: 'Anything else?', next: 'greet' }]
      },
      skills: {
        speaker: 'npc',
        text: 'Ten skills. Do a thing, get better at that thing. Chopping raises Woodcutting, swinging raises Attack and Strength, and Hitpoints grows whenever you fight.',
        options: [{ text: 'Anything else?', next: 'greet' }]
      },
      activities: {
        speaker: 'npc',
        text: 'Trees north, rocks west, fish east, creatures south. Bea sells tools, Cyrus minds your bank, and the smithy behind me turns ore into swords.',
        options: [{ text: 'Anything else?', next: 'greet' }]
      },
      heal: {
        speaker: 'npc',
        text: 'One cup of Emberfall spring water, and you are as good as new.',
        effects: [{ type: 'heal' }],
        next: null
      }
    }
  },

  // -------------------------------------------------------------------------
  shopkeeper_bea: {
    entry: [{ node: 'greet' }],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Morning! Tools, food, a bit of armour - and cake, if you have had a hard day.',
        options: [
          { text: 'Let me see what you have.', next: null, effects: [{ type: 'openShop', shop: 'general_store' }] },
          { text: 'What sells well?', next: 'gossip' },
          { text: 'Just browsing.', next: null }
        ]
      },
      gossip: {
        speaker: 'npc',
        text: 'Axes, mostly. And bread, after Rook sends people into the woods. Sell me anything you do not need - I pay fairly.',
        options: [{ text: 'Let me see what you have.', next: null, effects: [{ type: 'openShop', shop: 'general_store' }] }, { text: 'Thanks.', next: null }]
      }
    }
  },

  // -------------------------------------------------------------------------
  banker_cyrus: {
    entry: [{ node: 'greet' }],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Good day. Your belongings are exactly where you left them - that is rather the point of a bank.',
        options: [
          { text: 'Open my bank, please.', next: null, effects: [{ type: 'openBank' }] },
          { text: 'Is my stuff safe?', next: 'safe' },
          { text: 'Never mind.', next: null }
        ]
      },
      safe: {
        speaker: 'npc',
        text: 'Perfectly. Nothing in the vault is ever lost, and nothing you carry is lost either - Emberfall is a gentle sort of place.',
        options: [{ text: 'Open my bank, please.', next: null, effects: [{ type: 'openBank' }] }]
      }
    }
  },

  // -------------------------------------------------------------------------
  woodsman_willow: {
    entry: [
      { when: { quest: 'lost_lantern', completed: true }, node: 'done' },
      { when: { quest: 'lost_lantern', stageMin: 2 }, node: 'finish' },
      { when: { quest: 'lost_lantern', stageMin: 1, stageMax: 1 }, node: 'progress' },
      { when: { quest: 'welcome', completed: true }, node: 'offer' },
      { node: 'greet' }
    ],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Careful where you swing that axe. Oaks need fifteen years and fifteen levels; ordinary trees forgive beginners.',
        options: [{ text: 'Thanks for the tip.', next: null }]
      },
      offer: {
        speaker: 'npc',
        text: 'You are the one the mayor keeps talking about. Perhaps you can help me - an imp took the glass out of my lantern, and the woods get very dark.',
        options: [
          { text: 'I will get it back.', next: 'accept', effects: [{ type: 'startQuest', quest: 'lost_lantern' }] },
          { text: 'Imps sound alarming.', next: 'reassure' }
        ]
      },
      reassure: {
        speaker: 'npc',
        text: 'They are knee-high and mostly cheeky. Copper Hollow, west of the village. Take a shield.',
        options: [{ text: 'Fine, I will help.', next: 'accept', effects: [{ type: 'startQuest', quest: 'lost_lantern' }] }, { text: 'Another time.', next: null }]
      },
      accept: {
        speaker: 'npc',
        text: 'Bless you. They hoard shiny things at the back of the hollow. Bring the glass and I will make it worth the walk.',
        next: null
      },
      progress: {
        speaker: 'npc',
        text: 'Still no glass? Keep at the imps - they drop it eventually, and a shield helps more than you would think.',
        next: null
      },
      finish: {
        speaker: 'npc',
        text: 'My glass! Look at that, hardly a scratch. Here - a proper steel axe, and the lantern is yours to carry. I know these woods by heart anyway.',
        effects: [{ type: 'takeItem', id: 'lantern_glass', count: 1 }, { type: 'completeQuest', quest: 'lost_lantern' }],
        next: null
      },
      done: {
        speaker: 'npc',
        text: 'The willows by the lake are ready if you have thirty levels in you. Mira has been asking after you, by the way.',
        next: null
      }
    }
  },

  // -------------------------------------------------------------------------
  miner_mira: {
    entry: [
      { when: { quest: 'the_deep_seam', completed: true }, node: 'done' },
      { when: { quest: 'the_deep_seam', stageMin: 4 }, node: 'finish' },
      { when: { quest: 'the_deep_seam', stageMin: 2, stageMax: 3 }, node: 'golems' },
      { when: { quest: 'the_deep_seam', stageMin: 1, stageMax: 1 }, node: 'bars' },
      { when: { quest: 'lost_lantern', completed: true }, node: 'offer' },
      { node: 'greet' }
    ],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Copper and tin near the mouth, iron in the middle, coal at the back. Smelt one copper with one tin and you have bronze.',
        options: [
          { text: 'How do I smelt?', next: 'smelt' },
          { text: 'Thanks.', next: null }
        ]
      },
      smelt: {
        speaker: 'npc',
        text: 'Furnace in the smithy, south-west corner of the village. Click it with ore in your bag. The anvil next to it turns bars into blades - you will want a hammer.',
        next: null
      },
      offer: {
        speaker: 'npc',
        text: 'There is a seam at the back of the hollow that should not be there. Older than the village. I want to open it properly - which means bronze, and someone who can handle a golem.',
        options: [
          { text: 'Count me in.', next: 'accept', effects: [{ type: 'startQuest', quest: 'the_deep_seam' }] },
          { text: 'Golem?', next: 'golem_info' }
        ]
      },
      golem_info: {
        speaker: 'npc',
        text: 'Big, slow, made of the hollow itself. It will not chase you far. Bring food and a shield and you will be fine.',
        options: [{ text: 'Count me in.', next: 'accept', effects: [{ type: 'startQuest', quest: 'the_deep_seam' }] }, { text: 'I need to prepare.', next: null }]
      },
      accept: {
        speaker: 'npc',
        text: 'Four bronze bars to shore up the roof. Copper and tin, one each, into the furnace. Off you go.',
        next: null
      },
      bars: {
        speaker: 'npc',
        text: 'Four bronze bars. One copper, one tin, one furnace. I will hold the lamp.',
        next: null
      },
      golems: {
        speaker: 'npc',
        text: 'The bars did their job - and woke something up. Two golems, and one of them is carrying a coin older than Emberfall. Bring it to me.',
        next: null
      },
      finish: {
        speaker: 'npc',
        text: 'That is not a coin, that is a key. The seam is a door, and someone locked it from the inside. Keep the blade the smiths made for you - I think you have earned it, and I suspect you will need it.',
        effects: [{ type: 'takeItem', id: 'ancient_coin', count: 1 }, { type: 'completeQuest', quest: 'the_deep_seam' }],
        next: null
      },
      done: {
        speaker: 'npc',
        text: 'I have not opened it yet. When I do, you will be the first to know.',
        next: null
      }
    }
  },

  // -------------------------------------------------------------------------
  fisher_finn: {
    entry: [{ node: 'greet' }],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Shh. They can hear you. Net for shrimp, rod for trout - and salmon if you have thirty levels and the patience of a stone.',
        options: [
          { text: 'Where do I cook these?', next: 'cook' },
          { text: 'Caught anything?', next: 'caught' },
          { text: 'Good luck.', next: null }
        ]
      },
      cook: {
        speaker: 'npc',
        text: 'Any fire will do, or the range in the village kitchen. The range burns fewer of them. Everyone burns a few.',
        next: null
      },
      caught: {
        speaker: 'npc',
        text: 'Not since Tuesday. But that is not the point, is it.',
        next: null
      }
    }
  },

  // -------------------------------------------------------------------------
  captain_rook: {
    entry: [
      { when: { quest: 'wolves_at_the_gate', completed: true }, node: 'done' },
      { when: { quest: 'wolves_at_the_gate', stageMin: 2 }, node: 'finish' },
      { when: { quest: 'wolves_at_the_gate', stageMin: 1, stageMax: 1 }, node: 'progress' },
      { when: { quest: 'welcome', completed: true }, node: 'offer' },
      { node: 'greet' }
    ],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Village watch. Keep your blade sheathed in the square and we will get along fine.',
        options: [{ text: 'Understood.', next: null }]
      },
      offer: {
        speaker: 'npc',
        text: 'You look capable. The wolves in the north woods have started sitting on the road and staring at people. Five of them moved along would settle it.',
        options: [
          { text: 'I will handle it.', next: 'accept', effects: [{ type: 'startQuest', quest: 'wolves_at_the_gate' }] },
          { text: 'Are they dangerous?', next: 'danger' }
        ]
      },
      danger: {
        speaker: 'npc',
        text: 'To a farmer with a rake, yes. To someone with a sword and a shield, they are mostly noise. Eat something if you drop low.',
        options: [{ text: 'I will handle it.', next: 'accept', effects: [{ type: 'startQuest', quest: 'wolves_at_the_gate' }] }, { text: 'Not today.', next: null }]
      },
      accept: {
        speaker: 'npc',
        text: 'Five wolves. North road, into the woods. They will scatter once they get the message.',
        next: null
      },
      progress: {
        speaker: 'npc',
        text: 'Still hearing howls. Keep at it, and mind your health bar.',
        next: null
      },
      finish: {
        speaker: 'npc',
        text: 'The road is quiet again. Take this - proper armour, from the watch stores. You have earned a place at our gate.',
        effects: [{ type: 'completeQuest', quest: 'wolves_at_the_gate' }],
        next: null
      },
      done: {
        speaker: 'npc',
        text: 'Wolves are behaving. Golems, though - Mira will tell you all about the golems.',
        next: null
      }
    }
  }
});

export function dialogueFor(npcType) {
  return DIALOGUE[npcType] || null;
}
