// sample_adventure.js - Sample adventure for lazy loading demonstration
export const adventure = {
  id: 'sample_adventure',
  title: 'The Lazy Loading Demo',
  author: 'Performance Team',
  version: '1.0.0',
  description: 'A demonstration adventure that showcases lazy loading capabilities with multiple scenes and choices.',
  startSceneId: 'intro',
  
  scenes: [
    {
      id: 'intro',
      title: 'Welcome to Lazy Loading',
      content: 'Welcome to the Lazy Loading demonstration adventure!\n\nThis adventure showcases how scenes can be loaded dynamically as needed, improving performance for large adventures.\n\nYou can monitor the loading behavior in the developer console.',
      choices: [
        {
          id: 'explore_forest',
          text: 'Explore the enchanted forest',
          targetSceneId: 'forest_entrance',
          conditions: [],
          actions: []
        },
        {
          id: 'visit_village',
          text: 'Visit the nearby village',
          targetSceneId: 'village_square',
          conditions: [],
          actions: []
        },
        {
          id: 'check_inventory',
          text: 'Check your starting equipment',
          targetSceneId: 'inventory_check',
          conditions: [],
          actions: [
            { type: 'add_item', item: 'torch', count: 1 },
            { type: 'add_item', item: 'rope', count: 1 }
          ]
        }
      ],
      onEnter: [
        { type: 'set_flag', key: 'adventure_started', value: true }
      ],
      onExit: [],
      tags: ['intro', 'tutorial']
    },
    
    {
      id: 'forest_entrance',
      title: 'Forest Entrance',
      content: 'You stand before the entrance to an ancient enchanted forest. Tall trees tower above you, their canopy so thick that little sunlight reaches the forest floor.\n\nStrange sounds echo from within - some beautiful, others mysterious.',
      choices: [
        {
          id: 'enter_forest',
          text: 'Enter the forest boldly',
          targetSceneId: 'deep_forest',
          conditions: [],
          actions: [
            { type: 'update_stat', stat: 'courage', value: 1 }
          ]
        },
        {
          id: 'forest_careful',
          text: 'Approach carefully and listen',
          targetSceneId: 'forest_edge',
          conditions: [],
          actions: [
            { type: 'update_stat', stat: 'wisdom', value: 1 }
          ]
        },
        {
          id: 'return_intro',
          text: 'Return to the starting area',
          targetSceneId: 'intro',
          conditions: [],
          actions: []
        }
      ],
      onEnter: [
        { type: 'set_flag', key: 'found_forest', value: true }
      ],
      onExit: [],
      tags: ['forest', 'exploration']
    },
    
    {
      id: 'village_square',
      title: 'Village Square',
      content: 'You arrive at a bustling village square. Merchants hawk their wares, children play games, and the smell of fresh bread wafts from a nearby bakery.\n\nThis seems like a safe place to gather information and supplies.',
      choices: [
        {
          id: 'talk_merchant',
          text: 'Talk to a merchant',
          targetSceneId: 'merchant_shop',
          conditions: [],
          actions: []
        },
        {
          id: 'visit_inn',
          text: 'Visit the village inn',
          targetSceneId: 'village_inn',
          conditions: [],
          actions: []
        },
        {
          id: 'explore_alleys',
          text: 'Explore the side alleys',
          targetSceneId: 'village_alleys',
          conditions: [
            { type: 'flag_equals', key: 'adventure_started', value: true }
          ],
          actions: [
            { type: 'update_stat', stat: 'stealth', value: 1 }
          ]
        },
        {
          id: 'leave_village',
          text: 'Leave the village',
          targetSceneId: 'intro',
          conditions: [],
          actions: []
        }
      ],
      onEnter: [
        { type: 'set_flag', key: 'visited_village', value: true }
      ],
      onExit: [],
      tags: ['village', 'social']
    },
    
    {
      id: 'inventory_check',
      title: 'Equipment Check',
      content: 'You take a moment to check your equipment:\n\n• A sturdy torch for lighting dark places\n• A length of rope for climbing\n• Basic adventuring supplies\n\nYou feel prepared for whatever lies ahead!',
      choices: [
        {
          id: 'ready_adventure',
          text: 'Ready for adventure!',
          targetSceneId: 'intro',
          conditions: [],
          actions: [
            { type: 'update_stat', stat: 'preparedness', value: 2 }
          ]
        }
      ],
      onEnter: [
        { type: 'set_flag', key: 'checked_inventory', value: true }
      ],
      onExit: [],
      tags: ['inventory', 'preparation']
    },
    
    {
      id: 'deep_forest',
      title: 'Deep in the Forest',
      content: 'You venture deep into the forest. Ancient magic seems to pulse through every leaf and branch. The air shimmers with possibility.\n\nSudenly, you hear a voice calling for help!',
      choices: [
        {
          id: 'help_voice',
          text: 'Follow the voice and offer help',
          targetSceneId: 'forest_rescue',
          conditions: [],
          actions: [
            { type: 'update_stat', stat: 'heroism', value: 2 }
          ]
        },
        {
          id: 'ignore_voice',
          text: 'Ignore the voice and continue exploring',
          targetSceneId: 'forest_depths',
          conditions: [],
          actions: []
        }
      ],
      onEnter: [
        { type: 'set_flag', key: 'entered_deep_forest', value: true }
      ],
      onExit: [],
      tags: ['forest', 'mystery', 'choice']
    },
    
    {
      id: 'forest_edge',
      title: 'Forest Edge',
      content: 'You listen carefully at the forest edge. The sounds reveal themselves to be mostly harmless - rustling leaves, bird calls, and the distant babble of a stream.\n\nYour patience has revealed a safer path through the forest.',
      choices: [
        {
          id: 'safe_path',
          text: 'Take the safe path',
          targetSceneId: 'forest_stream',
          conditions: [],
          actions: [
            { type: 'update_stat', stat: 'wisdom', value: 1 }
          ]
        },
        {
          id: 'still_bold',
          text: 'Go in boldly anyway',
          targetSceneId: 'deep_forest',
          conditions: [],
          actions: [
            { type: 'update_stat', stat: 'courage', value: 1 }
          ]
        }
      ],
      onEnter: [],
      onExit: [],
      tags: ['forest', 'wisdom', 'patience']
    },
    
    {
      id: 'merchant_shop',
      title: 'Merchant\'s Shop',
      content: 'The merchant\'s shop is filled with curious items from far-off lands. The merchant, a kindly old woman, smiles at you warmly.\n\n"Welcome, traveler! I have just the thing for someone on an adventure!"',
      choices: [
        {
          id: 'buy_potion',
          text: 'Buy a healing potion (10 gold)',
          targetSceneId: 'village_square',
          conditions: [
            { type: 'stat_greater_than', stat: 'gold', value: 9 }
          ],
          actions: [
            { type: 'add_item', item: 'healing_potion', count: 1 },
            { type: 'update_stat', stat: 'gold', value: -10 }
          ]
        },
        {
          id: 'buy_map',
          text: 'Buy a map of the area (5 gold)',
          targetSceneId: 'village_square',
          conditions: [
            { type: 'stat_greater_than', stat: 'gold', value: 4 }
          ],
          actions: [
            { type: 'add_item', item: 'map', count: 1 },
            { type: 'update_stat', stat: 'gold', value: -5 }
          ]
        },
        {
          id: 'just_browse',
          text: 'Just browse and leave',
          targetSceneId: 'village_square',
          conditions: [],
          actions: []
        }
      ],
      onEnter: [],
      onExit: [],
      tags: ['village', 'merchant', 'shopping']
    },
    
    {
      id: 'village_inn',
      title: 'The Village Inn',
      content: 'The inn is warm and welcoming, filled with the chatter of locals and travelers. The innkeeper waves you over.\n\n"Care for a meal and some local gossip, friend?"',
      choices: [
        {
          id: 'eat_meal',
          text: 'Order a hearty meal (2 gold)',
          targetSceneId: 'village_square',
          conditions: [
            { type: 'stat_greater_than', stat: 'gold', value: 1 }
          ],
          actions: [
            { type: 'update_stat', stat: 'gold', value: -2 },
            { type: 'update_stat', stat: 'health', value: 10 }
          ]
        },
        {
          id: 'listen_gossip',
          text: 'Just listen to the gossip',
          targetSceneId: 'inn_gossip',
          conditions: [],
          actions: [
            { type: 'set_flag', key: 'heard_gossip', value: true }
          ]
        },
        {
          id: 'leave_inn',
          text: 'Leave the inn',
          targetSceneId: 'village_square',
          conditions: [],
          actions: []
        }
      ],
      onEnter: [],
      onExit: [],
      tags: ['village', 'inn', 'social']
    }
  ],
  
  stats: [
    {
      id: 'health',
      name: 'Health',
      type: 'number',
      defaultValue: 100,
      min: 0,
      max: 100,
      category: 'physical'
    },
    {
      id: 'gold',
      name: 'Gold',
      type: 'number',
      defaultValue: 20,
      min: 0,
      category: 'resources'
    },
    {
      id: 'courage',
      name: 'Courage',
      type: 'number',
      defaultValue: 0,
      min: 0,
      category: 'attributes'
    },
    {
      id: 'wisdom',
      name: 'Wisdom',
      type: 'number',
      defaultValue: 0,
      min: 0,
      category: 'attributes'
    },
    {
      id: 'stealth',
      name: 'Stealth',
      type: 'number',
      defaultValue: 0,
      min: 0,
      category: 'skills'
    },
    {
      id: 'heroism',
      name: 'Heroism',
      type: 'number',
      defaultValue: 0,
      min: 0,
      category: 'reputation'
    },
    {
      id: 'preparedness',
      name: 'Preparedness',
      type: 'number',
      defaultValue: 0,
      min: 0,
      category: 'attributes'
    }
  ],
  
  flags: [
    {
      id: 'adventure_started',
      name: 'Adventure Started',
      description: 'The adventure has begun',
      defaultValue: false,
      persistent: true
    },
    {
      id: 'found_forest',
      name: 'Found Forest',
      description: 'Discovered the enchanted forest',
      defaultValue: false,
      persistent: false
    },
    {
      id: 'visited_village',
      name: 'Visited Village',
      description: 'Been to the village',
      defaultValue: false,
      persistent: false
    }
  ],
  
  inventory: [
    {
      id: 'torch',
      name: 'Torch',
      description: 'A reliable source of light',
      category: 'tools',
      value: 2,
      weight: 1,
      consumable: true,
      stackable: true
    },
    {
      id: 'rope',
      name: 'Rope',
      description: 'Strong rope for climbing',
      category: 'tools',
      value: 5,
      weight: 2,
      stackable: false
    },
    {
      id: 'healing_potion',
      name: 'Healing Potion',
      description: 'Restores health when consumed',
      category: 'consumables',
      value: 15,
      weight: 0.5,
      consumable: true,
      stackable: true,
      effects: [
        { target: 'health', value: 25 }
      ]
    },
    {
      id: 'map',
      name: 'Area Map',
      description: 'A detailed map of the local area',
      category: 'tools',
      value: 10,
      weight: 0.1,
      stackable: false
    }
  ],
  
  achievements: [
    {
      id: 'first_steps',
      name: 'First Steps',
      description: 'Begin your adventure',
      trigger: {
        type: 'flag_equals',
        key: 'adventure_started',
        value: true
      }
    },
    {
      id: 'forest_explorer',
      name: 'Forest Explorer',
      description: 'Explore the enchanted forest',
      trigger: {
        type: 'flag_equals',
        key: 'found_forest',
        value: true
      }
    },
    {
      id: 'village_visitor',
      name: 'Village Visitor',
      description: 'Visit the local village',
      trigger: {
        type: 'flag_equals',
        key: 'visited_village',
        value: true
      }
    }
  ],
  
  categories: [
    { id: 'tools', name: 'Tools', description: 'Useful implements and devices' },
    { id: 'consumables', name: 'Consumables', description: 'Items that can be used up' },
    { id: 'misc', name: 'Miscellaneous', description: 'Various other items' }
  ],
  
  metadata: {
    created: Date.now(),
    modified: Date.now(),
    version: '1.0.0',
    isLazyLoadingDemo: true,
    estimatedPlayTime: 15,
    difficulty: 'beginner',
    tags: ['demo', 'tutorial', 'lazy-loading']
  }
};