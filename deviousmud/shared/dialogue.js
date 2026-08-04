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
          { text: 'Is there anywhere I should not go?', next: 'mine' },
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
      mine: {
        speaker: 'npc',
        text: 'West, in Copper Hollow, there is a shaft going down under the quarry. Two braziers burning either side of it - you cannot miss them. It goes down a long way, and it is very dark.',
        options: [
          { text: 'Can I go down it?', next: 'mine_yes' },
          { text: 'Anything else?', next: 'greet' }
        ]
      },
      mine_yes: {
        speaker: 'npc',
        text: 'Anyone can. Buy a torch from Bea first - a few coins, and worth every one. Mira knows more about what is down there than I do.',
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
      { when: { quest: 'the_sleeping_forge', completed: true }, node: 'forge_done' },
      { when: { quest: 'the_sleeping_forge', stageMin: 4 }, node: 'forge_finish' },
      { when: { quest: 'the_sleeping_forge', stageMin: 1, stageMax: 3 }, node: 'forge_progress' },
      { when: { quest: 'deeper_than_dorn_went', completed: true }, node: 'forge_offer' },
      { when: { quest: 'lights_in_the_dark', stageMin: 1 }, node: 'lights_progress' },
      { when: { quest: 'the_deep_seam', completed: true }, node: 'lights_offer' },
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
          { text: 'What is that shaft with the braziers?', next: 'shaft' },
          { text: 'Thanks.', next: null }
        ]
      },
      shaft: {
        speaker: 'npc',
        text: 'The old mine. Three levels that I know of, and warmer every one. Go down if you like - take a light, and do not be proud about coming back up.',
        options: [{ text: 'Thanks.', next: null }]
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
      },

      // ------------------------------------------------ Lights in the Dark
      lights_offer: {
        speaker: 'npc',
        text: 'Well. The coin turned the lock, and there is a shaft down there going a long way further than I expected. I am not sending anyone into that in the dark.',
        options: [
          { text: 'I will get a light and go down.', next: 'lights_accept', effects: [{ type: 'startQuest', quest: 'lights_in_the_dark' }] },
          { text: 'What is down there?', next: 'lights_what' }
        ]
      },
      lights_what: {
        speaker: 'npc',
        text: 'Ore, mostly. Bats, certainly. And it is warm - far warmer than a hole in the ground has any business being. Get a torch from Bea first.',
        options: [
          { text: 'I will get a light and go down.', next: 'lights_accept', effects: [{ type: 'startQuest', quest: 'lights_in_the_dark' }] },
          { text: 'Let me think about it.', next: null }
        ]
      },
      lights_accept: {
        speaker: 'npc',
        text: 'Bea keeps torches by the door. The shaft is right where the old quarry meets the west wall - you cannot miss the timbers.',
        next: null
      },
      lights_progress: {
        speaker: 'npc',
        text: 'Torch first, then the shaft by the west wall. And say hello to whoever is down there - I heard someone singing.',
        next: null
      },

      // ------------------------------------------------ The Sleeping Forge
      forge_offer: {
        speaker: 'npc',
        text: 'Dorn showed me the mithril. He also told me how hot it gets on the way down. That is not a furnace, that is something breathing.',
        options: [
          { text: 'Then I will go and see it.', next: 'forge_accept', effects: [{ type: 'startQuest', quest: 'the_sleeping_forge' }] },
          { text: 'Breathing?', next: 'forge_what' }
        ]
      },
      forge_what: {
        speaker: 'npc',
        text: 'Cinderheart. My grandmother had a word for it. It is not wicked - it is asleep, and it has been dreaming much too hot for a hundred years. Settle it. Do not hurt it.',
        options: [
          { text: 'Then I will go and see it.', next: 'forge_accept', effects: [{ type: 'startQuest', quest: 'the_sleeping_forge' }] },
          { text: 'I need to prepare properly.', next: null }
        ]
      },
      forge_accept: {
        speaker: 'npc',
        text: 'Bring me two ember shards from the bottom, and take the best armour Emberfall can make. The guardians will not step aside politely.',
        next: null
      },
      forge_progress: {
        speaker: 'npc',
        text: 'Two shards, past the guardians, and then be gentle with it. It is only having a bad dream.',
        next: null
      },
      forge_finish: {
        speaker: 'npc',
        text: 'The whole hollow has gone cool. I can hear it breathing slowly from up here. Forge-warden - that is what my grandmother called whoever did this last time. It suits you.',
        effects: [{ type: 'takeItem', id: 'ember_shard', count: 2 }, { type: 'completeQuest', quest: 'the_sleeping_forge' }],
        next: null
      },
      forge_done: {
        speaker: 'npc',
        text: 'Warm rock, cool air, and ore for a hundred years. You did that. Go and put your feet up.',
        next: null
      }
    }
  },

  // -------------------------------------------------------------------------
  foreman_dorn: {
    entry: [
      { when: { quest: 'deeper_than_dorn_went', completed: true }, node: 'deeper_done' },
      { when: { quest: 'deeper_than_dorn_went', stageMin: 5 }, node: 'deeper_finish' },
      { when: { quest: 'deeper_than_dorn_went', stageMin: 1, stageMax: 4 }, node: 'deeper_progress' },
      { when: { quest: 'the_foremans_tally', completed: true }, node: 'deeper_offer' },
      { when: { quest: 'the_foremans_tally', stageMin: 4 }, node: 'tally_finish' },
      { when: { quest: 'the_foremans_tally', stageMin: 1, stageMax: 3 }, node: 'tally_progress' },
      { when: { quest: 'lights_in_the_dark', completed: true }, node: 'tally_offer' },
      { when: { quest: 'lights_in_the_dark', stageMin: 3 }, node: 'lights_finish' },
      { node: 'greet' }
    ],
    nodes: {
      greet: {
        speaker: 'npc',
        text: 'Thirty years I have sat at the bottom of this ladder with a lamp and a stick, waiting for someone to open the top of it. Mind the bats.',
        options: [
          { text: 'Thirty years?', next: 'why' },
          { text: 'What is worth mining down here?', next: 'ore' },
          { text: 'I will mind the bats.', next: null }
        ]
      },
      why: {
        speaker: 'npc',
        text: 'Somebody had to. A mine with nobody in it stops being a mine and starts being a hole. I kept the braziers lit.',
        next: null
      },
      ore: {
        speaker: 'npc',
        text: 'Copper and tin at this level, iron and coal deeper in. And further down than I have ever been, something blue-green that I could never get out of the rock.',
        next: null
      },

      // ------------------------------------------------ Lights in the Dark
      lights_finish: {
        speaker: 'npc',
        text: 'Well I never. Somebody came down. Put that torch away before it blows out and take this - it is a proper miner\'s lantern, and it has outlasted three foremen.',
        effects: [{ type: 'completeQuest', quest: 'lights_in_the_dark' }],
        next: null
      },

      // ------------------------------------------------ The Foreman's Tally
      tally_offer: {
        speaker: 'npc',
        text: 'Now you are here with a light that works, I have a proposition. This mine is worth reopening, and I need to be able to prove it to the mayor. Clear the vermin, and bring me eight iron.',
        options: [
          { text: 'Consider it counted.', next: 'tally_accept', effects: [{ type: 'startQuest', quest: 'the_foremans_tally' }] },
          { text: 'Vermin?', next: 'tally_what' }
        ]
      },
      tally_what: {
        speaker: 'npc',
        text: 'Six bats in the upper galleries, four crawlers in the far tunnels. Neither will do you much harm, but neither will let a miner work.',
        options: [
          { text: 'Consider it counted.', next: 'tally_accept', effects: [{ type: 'startQuest', quest: 'the_foremans_tally' }] },
          { text: 'Another time.', next: null }
        ]
      },
      tally_accept: {
        speaker: 'npc',
        text: 'Six bats, four crawlers, eight iron. I will notch the stick as you go.',
        next: null
      },
      tally_progress: {
        speaker: 'npc',
        text: 'Bats, crawlers, iron. Take your time - I have had thirty years of practice at waiting.',
        next: null
      },
      tally_finish: {
        speaker: 'npc',
        text: 'Eight iron and a quiet gallery. That is a working mine. Here - boots, and the stick. I have no more use for counting empty years.',
        effects: [{ type: 'completeQuest', quest: 'the_foremans_tally' }],
        next: null
      },

      // --------------------------------------------- Deeper Than Dorn Went
      deeper_offer: {
        speaker: 'npc',
        text: 'There is a second ladder in the far gallery. I have stood at the top of it for thirty years and never once gone down. My knees, you understand.',
        options: [
          { text: 'I will go down it.', next: 'deeper_accept', effects: [{ type: 'startQuest', quest: 'deeper_than_dorn_went' }] },
          { text: 'What is down there?', next: 'deeper_what' }
        ]
      },
      deeper_what: {
        speaker: 'npc',
        text: 'The blue-green rock. Mithril, my grandfather called it - lighter than steel and twice as sharp. Bring me three ore and a bar smelted from it, and see off the golems while you are at it.',
        options: [
          { text: 'I will go down it.', next: 'deeper_accept', effects: [{ type: 'startQuest', quest: 'deeper_than_dorn_went' }] },
          { text: 'Not yet.', next: null }
        ]
      },
      deeper_accept: {
        speaker: 'npc',
        text: 'Mithril wants coal with it in the furnace - three lumps to the ore, and a hot fire. Mind the golems down there; they are not the polite sort we get up here.',
        next: null
      },
      deeper_progress: {
        speaker: 'npc',
        text: 'Second ladder, far gallery. Three ore, one bar, and three golems moved along. I will be right here.',
        next: null
      },
      deeper_finish: {
        speaker: 'npc',
        text: 'Thirty years, and a stranger brings it up in a week. Take this pickaxe - it is made of the stuff, and it is wasted on me. Go and tell Mira. She will want to know how warm it was.',
        effects: [{ type: 'completeQuest', quest: 'deeper_than_dorn_went' }],
        next: null
      },
      deeper_done: {
        speaker: 'npc',
        text: 'Careful how far down you go. It gets warmer, and warm rock means something is making it warm.',
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
