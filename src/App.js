import { GameProvider } from './contexts/GameContext.js';
import { GameScreen } from './components/player/GameScreen.js';
import EditorScreen from './components/editor/EditorScreen.js';
import { useGameState } from './hooks/useGameState.js';

const { useEffect, createElement, useState } = React;

// Enhanced Phase 3 sample adventure showcasing all advanced features
const enhancedSampleAdventure = {
  id: 'phase3-demo-adventure',
  title: 'The Enchanted Realm - Phase 3 Demo',
  author: 'Adventure Engine Team',
  version: '2.0.0',
  description: 'A comprehensive demonstration of Phase 3 features including inventory, secrets, achievements, and cross-game compatibility',
  startSceneId: 'mystical_gateway',
  
  // Enhanced stats with Phase 3 custom types
  stats: [
    {
      id: 'health',
      name: 'Health Points',
      type: 'number',
      defaultValue: 100,
      min: 0,
      max: 100,
      category: 'vital',
      description: 'Your physical well-being and life force'
    },
    {
      id: 'mana',
      name: 'Magical Energy',
      type: 'number', 
      defaultValue: 50,
      min: 0,
      max: 100,
      category: 'vital',
      description: 'Your magical power reserves'
    },
    {
      id: 'courage',
      name: 'Courage',
      type: 'percentage',
      defaultValue: 25,
      min: 0,
      max: 100,
      category: 'attributes',
      description: 'Your bravery in the face of danger'
    },
    {
      id: 'wisdom',
      name: 'Wisdom',
      type: 'number',
      defaultValue: 10,
      min: 0,
      max: 100,
      category: 'attributes', 
      description: 'Your knowledge and understanding of the world'
    },
    {
      id: 'stealth',
      name: 'Stealth',
      type: 'number',
      defaultValue: 5,
      min: 0,
      max: 100,
      category: 'skills',
      description: 'Your ability to move unseen and unheard'
    },
    {
      id: 'gold',
      name: 'Gold Coins',
      type: 'currency',
      defaultValue: 25,
      min: 0,
      category: 'resources',
      description: 'Your monetary wealth'
    },
    {
      id: 'playtime',
      name: 'Adventure Time',
      type: 'time',
      defaultValue: 0,
      min: 0,
      category: 'meta',
      description: 'Time spent on your adventure',
      hidden: true
    }
  ],

  // Phase 3 inventory system
  inventory: [
    {
      id: 'healing_potion',
      name: 'Healing Potion',
      description: 'A magical elixir that restores health',
      category: 'consumables',
      stackable: true,
      maxStack: 5,
      weight: 0.5,
      value: 25,
      rarity: 'common',
      effects: [
        {
          type: 'stat_modifier',
          target: 'health',
          value: 30
        }
      ],
      exportable: true
    },
    {
      id: 'mystic_sword',
      name: 'Mystic Sword',
      description: 'An enchanted blade that glows with inner light',
      category: 'weapons',
      stackable: false,
      weight: 2.5,
      value: 150,
      rarity: 'rare',
      effects: [
        {
          type: 'stat_modifier',
          target: 'courage',
          value: 15
        }
      ],
      exportable: true,
      unique: true
    },
    {
      id: 'stealth_cloak',
      name: 'Cloak of Shadows',
      description: 'A mysterious cloak that bends light around the wearer',
      category: 'armor',
      stackable: false,
      weight: 1.0,
      value: 100,
      rarity: 'uncommon',
      effects: [
        {
          type: 'stat_modifier',
          target: 'stealth',
          value: 20
        }
      ],
      exportable: true
    },
    {
      id: 'wisdom_scroll',
      name: 'Ancient Scroll',
      description: 'Contains the wisdom of ages past',
      category: 'consumables',
      stackable: true,
      maxStack: 3,
      weight: 0.1,
      value: 75,
      rarity: 'uncommon',
      effects: [
        {
          type: 'stat_modifier',
          target: 'wisdom',
          value: 25
        }
      ],
      exportable: true
    },
    {
      id: 'mana_crystal',
      name: 'Mana Crystal',
      description: 'A crystalline source of pure magical energy',
      category: 'consumables',
      stackable: true,
      maxStack: 10,
      weight: 0.2,
      value: 35,
      rarity: 'common',
      effects: [
        {
          type: 'stat_modifier',
          target: 'mana',
          value: 20
        }
      ],
      exportable: true
    }
  ],

  // Phase 3 achievement system
  achievements: [
    {
      id: 'first_steps',
      name: 'First Steps',
      description: 'Begin your adventure in the enchanted realm',
      category: 'progression',
      conditions: [
        {
          type: 'scene_visited',
          key: 'mystical_gateway',
          operator: 'eq',
          value: true
        }
      ],
      points: 10,
      rarity: 'common'
    },
    {
      id: 'secret_seeker',
      name: 'Secret Seeker',
      description: 'Discover your first hidden choice',
      category: 'exploration',
      conditions: [
        {
          type: 'choice_made',
          key: 'secret_examine_runes',
          operator: 'eq',
          value: true
        }
      ],
      points: 25,
      rarity: 'uncommon'
    },
    {
      id: 'master_collector',
      name: 'Master Collector',
      description: 'Gather 3 different types of items',
      category: 'collection',
      conditions: [
        {
          type: 'inventory_category',
          key: 'consumables',
          operator: 'gte',
          value: 1
        },
        {
          type: 'inventory_category', 
          key: 'weapons',
          operator: 'gte',
          value: 1
        },
        {
          type: 'inventory_category',
          key: 'armor',
          operator: 'gte',
          value: 1
        }
      ],
      points: 50,
      rarity: 'rare'
    },
    {
      id: 'brave_heart',
      name: 'Brave Heart',
      description: 'Reach maximum courage',
      category: 'attributes',
      conditions: [
        {
          type: 'stat',
          key: 'courage',
          operator: 'eq',
          value: 100
        }
      ],
      points: 75,
      rarity: 'epic'
    }
  ],

  // Phase 3 flag definitions
  flags: [
    {
      id: 'discovered_secret_passage',
      name: 'Secret Passage Discovered',
      description: 'Player found the hidden passage',
      category: 'secrets',
      defaultValue: false,
      exportable: true
    },
    {
      id: 'talked_to_sage',
      name: 'Consulted the Sage',
      description: 'Player spoke with the wise sage',
      category: 'npcs',
      defaultValue: false,
      exportable: true
    },
    {
      id: 'mastered_magic',
      name: 'Magic Mastery',
      description: 'Player has learned advanced magic',
      category: 'progression',
      defaultValue: false,
      exportable: true
    }
  ],

  // Phase 3 categories for organization
  categories: [
    { id: 'vital', name: 'Vital Stats', color: '#ef4444', order: 1 },
    { id: 'attributes', name: 'Core Attributes', color: '#3b82f6', order: 2 },
    { id: 'skills', name: 'Skills', color: '#10b981', order: 3 },
    { id: 'resources', name: 'Resources', color: '#f59e0b', order: 4 },
    { id: 'meta', name: 'Meta Information', color: '#6b7280', order: 5 }
  ],

  // Cross-game compatibility for save transfers
  crossGameCompatibility: {
    version: '2.0',
    exportableStats: ['courage', 'wisdom', 'stealth', 'gold'],
    exportableFlags: ['discovered_secret_passage', 'mastered_magic'],
    exportableItems: ['mystic_sword', 'stealth_cloak', 'healing_potion'],
    compatibleAdventures: ['fantasy_quest_series', 'magic_realm_adventures']
  },

  // Adventure metadata
  metadata: {
    created: Date.now(),
    modified: Date.now(),
    estimatedPlayTime: 45,
    difficulty: 'medium',
    genre: ['fantasy', 'adventure', 'mystery'],
    language: 'en',
    contentRating: 'T',
    keywords: ['magic', 'exploration', 'secrets', 'inventory', 'achievements']
  },

  scenes: [
    {
      id: 'mystical_gateway',
      title: 'The Mystical Gateway',
      content: 'You stand before an ancient stone archway covered in glowing runes. The air shimmers with magical energy, and you can sense powerful enchantments at work.\n\nThrough the archway, you see a path leading into an enchanted forest. Strange lights dance between the trees, and you hear the distant sound of flowing water.\n\nAncient runes pulse with different colors around the gateway\'s edges.',
      category: 'introduction',
      tags: ['magical', 'gateway', 'starting_point'],
      choices: [
        {
          id: 'enter_gateway',
          text: 'Step through the magical gateway',
          targetSceneId: 'enchanted_forest',
          actions: [
            { type: 'add_stat', key: 'courage', value: 5 },
            { type: 'add_stat', key: 'playtime', value: 1 }
          ],
          consequences: [
            {
              type: 'scene_unlock',
              description: 'Enter the enchanted realm',
              severity: 'minor'
            }
          ],
          priority: 1
        },
        {
          id: 'examine_gateway',
          text: 'Study the runes carefully before entering',
          targetSceneId: 'rune_study',
          actions: [
            { type: 'add_stat', key: 'wisdom', value: 10 }
          ],
          consequences: [
            {
              type: 'stat_change', 
              description: 'Gain valuable knowledge',
              severity: 'moderate'
            }
          ]
        },
        {
          id: 'secret_examine_runes',
          text: 'Touch the glowing runes with your hand',
          targetSceneId: 'secret_rune_power',
          isSecret: true,
          secretConditions: [
            {
              type: 'stat',
              key: 'wisdom',
              operator: 'gte',
              value: 15
            }
          ],
          actions: [
            { type: 'add_inventory', key: 'mana_crystal', value: 2 },
            { type: 'set_flag', key: 'discovered_secret_passage', value: true }
          ],
          consequences: [
            {
              type: 'item_gain',
              description: 'Discover hidden magical power',
              severity: 'major'
            }
          ]
        }
      ],
      onEnter: [
        { 
          type: 'add_inventory', 
          key: 'healing_potion', 
          value: 1 
        }
      ]
    },
    {
      id: 'rune_study',
      title: 'Ancient Knowledge',
      content: 'You spend time carefully examining the ancient runes. As you study them, their meaning becomes clearer. These are protective wards, designed to keep something powerful contained within the realm beyond.\n\nYour careful study reveals a hidden mechanism - a small crystal embedded in the archway that pulses with inner light.',
      category: 'exploration',
      tags: ['knowledge', 'runes', 'mystery'],
      choices: [
        {
          id: 'activate_crystal',
          text: 'Touch the hidden crystal',
          targetSceneId: 'crystal_activation',
          actions: [
            { type: 'add_stat', key: 'mana', value: 15 },
            { type: 'add_inventory', key: 'wisdom_scroll', value: 1 }
          ]
        },
        {
          id: 'enter_prepared',
          text: 'Enter the gateway, now better prepared',
          targetSceneId: 'enchanted_forest',
          actions: [
            { type: 'add_stat', key: 'courage', value: 10 }
          ]
        }
      ]
    },
    {
      id: 'secret_rune_power',
      title: 'Awakening Ancient Power',
      content: 'As you touch the runes, they flare with brilliant light! Ancient magic courses through you, and you feel a profound connection to the mystical energies of this place.\n\nThe gateway responds to your touch, revealing a hidden compartment containing ancient artifacts. You have awakened powers that few have ever discovered.',
      category: 'secrets',
      tags: ['secret', 'power', 'magic', 'ancient'],
      choices: [
        {
          id: 'embrace_power',
          text: 'Embrace the magical power flowing through you',
          targetSceneId: 'power_awakening',
          actions: [
            { type: 'add_stat', key: 'mana', value: 25 },
            { type: 'add_stat', key: 'wisdom', value: 15 },
            { type: 'set_flag', key: 'mastered_magic', value: true }
          ]
        }
      ],
      onEnter: [
        { 
          type: 'add_inventory', 
          key: 'mystic_sword', 
          value: 1 
        }
      ]
    },
    {
      id: 'enchanted_forest',
      title: 'The Enchanted Forest',
      content: 'You find yourself in a magical forest where the very air seems to sparkle with enchantment. Towering trees with silver bark stretch toward a sky painted in impossible colors.\n\nA crystal-clear stream winds through the forest, and you can see magical creatures darting between the trees. In the distance, you spot what appears to be a cottage with smoke rising from its chimney.',
      category: 'exploration',
      tags: ['forest', 'magical', 'nature', 'creatures'],
      requiredItems: [],
      choices: [
        {
          id: 'follow_stream',
          text: 'Follow the crystal stream deeper into the forest',
          targetSceneId: 'crystal_stream',
          actions: [
            { type: 'add_stat', key: 'stealth', value: 5 }
          ]
        },
        {
          id: 'approach_cottage',
          text: 'Walk toward the cottage',
          targetSceneId: 'sage_cottage',
          actions: [
            { type: 'add_stat', key: 'courage', value: 5 }
          ]
        },
        {
          id: 'climb_silver_tree',
          text: 'Climb one of the silver-barked trees for a better view',
          targetSceneId: 'treetop_view',
          requirements: [
            {
              type: 'stat',
              key: 'courage',
              operator: 'gte',
              value: 30,
              description: 'Requires 30+ courage to attempt the climb'
            }
          ],
          isLocked: true,
          lockReasons: ['Need more courage to attempt this dangerous climb']
        },
        {
          id: 'secret_shadow_path',
          text: 'Slip into the shadows and find a hidden path',
          targetSceneId: 'shadow_realm',
          isSecret: true,
          secretConditions: [
            {
              type: 'stat',
              key: 'stealth',
              operator: 'gte',
              value: 15
            }
          ],
          requirements: [
            {
              type: 'item',
              key: 'stealth_cloak',
              operator: 'eq',
              value: 1
            }
          ],
          actions: [
            { type: 'add_inventory', key: 'stealth_cloak', value: 1 }
          ]
        }
      ],
      onEnter: [
        { 
          type: 'add_stat', 
          key: 'health', 
          value: 10 
        }
      ]
    },
    {
      id: 'sage_cottage',
      title: 'The Sage\'s Cottage',
      content: 'You approach a cozy cottage with a thatched roof and ivy-covered walls. Smoke curls peacefully from the chimney, and you can smell herbs and something delicious cooking.\n\nAn elderly figure emerges from the cottage - a wise-looking sage with twinkling eyes and a long white beard. "Welcome, young traveler," the sage says warmly. "I have been expecting you."',
      category: 'dialogue',
      tags: ['npc', 'sage', 'cottage', 'wisdom'],
      choices: [
        {
          id: 'ask_for_help',
          text: 'Ask the sage for guidance on your journey',
          targetSceneId: 'sage_wisdom',
          actions: [
            { type: 'set_flag', key: 'talked_to_sage', value: true },
            { type: 'add_stat', key: 'wisdom', value: 20 }
          ]
        },
        {
          id: 'offer_trade',
          text: 'Offer to trade items with the sage',
          targetSceneId: 'sage_trading',
          requirements: [
            {
              type: 'stat',
              key: 'gold',
              operator: 'gte',
              value: 20
            }
          ]
        },
        {
          id: 'polite_decline',
          text: 'Thank the sage but continue on your journey',
          targetSceneId: 'forest_path',
          actions: [
            { type: 'add_stat', key: 'courage', value: 5 }
          ]
        }
      ],
      onEnter: [
        {
          type: 'add_inventory',
          key: 'healing_potion',
          value: 1,
          probability: 0.7
        }
      ]
    },
    {
      id: 'crystal_stream', 
      title: 'The Crystal Stream',
      content: 'The stream sparkles like liquid diamonds as it flows over smooth stones. The water is so clear you can see colorful fish swimming below, and the gentle sound is incredibly peaceful.\n\nAs you follow the stream, you discover that the water has magical properties - just being near it makes you feel more energetic and alert.',
      category: 'exploration',
      tags: ['stream', 'magical', 'peaceful', 'restoration'],
      choices: [
        {
          id: 'drink_water',
          text: 'Drink from the magical stream',
          targetSceneId: 'stream_blessing',
          actions: [
            { type: 'add_stat', key: 'health', value: 25 },
            { type: 'add_stat', key: 'mana', value: 15 }
          ]
        },
        {
          id: 'follow_upstream',
          text: 'Follow the stream to its source',
          targetSceneId: 'mystic_spring',
          actions: [
            { type: 'add_stat', key: 'stealth', value: 10 }
          ]
        }
      ]
    },
    {
      id: 'treetop_view',
      title: 'Canopy Vista',
      content: 'From high in the silver tree, you have a breathtaking view of the entire enchanted realm. You can see distant mountains crowned with clouds, a shimmering lake, and what appears to be an ancient castle on a far hill.\n\nThis elevated perspective gives you valuable knowledge about the lay of the land and possible destinations for your adventure.',
      category: 'exploration',
      tags: ['high_ground', 'vista', 'planning', 'overview'],
      choices: [
        {
          id: 'plan_route',
          text: 'Use this view to plan your route to the castle',
          targetSceneId: 'castle_approach',
          actions: [
            { type: 'add_stat', key: 'wisdom', value: 15 }
          ]
        },
        {
          id: 'descend_carefully',
          text: 'Climb down and continue exploring the forest',
          targetSceneId: 'enchanted_forest'
        }
      ],
      onEnter: [
        { 
          type: 'add_stat', 
          key: 'courage', 
          value: 20 
        }
      ]
    },
    {
      id: 'victory_ending',
      title: 'Master of the Enchanted Realm',
      content: 'Through courage, wisdom, and clever use of magical items, you have successfully navigated the challenges of the enchanted realm. You have grown stronger, wiser, and more capable.\n\nAs you stand at the heart of the magical forest, you realize that this is not an ending, but a beginning. The skills and items you have gained here will serve you well in future adventures.\n\nCongratulations, brave adventurer! Your legend begins here.',
      category: 'ending',
      tags: ['victory', 'completion', 'legend'],
      choices: [],
      onEnter: [
        { 
          type: 'add_stat', 
          key: 'courage', 
          value: 25 
        },
        {
          type: 'add_inventory',
          key: 'mystic_sword',
          value: 1
        }
      ]
    }
  ]
};

function AppContent() {
  const { loadAdventure, resetGame, isGameLoaded } = useGameState();
  const [mode, setMode] = useState('player');
  const [testAdventure, setTestAdventure] = useState(null);

  // Initialize with enhanced sample adventure on first load
  useEffect(() => {
    if (!isGameLoaded && mode === 'player' && !testAdventure) {
      console.log('App: Loading Phase 3 enhanced sample adventure');
      loadAdventure(enhancedSampleAdventure);
    }
  }, [isGameLoaded, loadAdventure, mode, testAdventure]);

  // Load test adventure from editor
  useEffect(() => {
    if (testAdventure && mode === 'player') {
      console.log('App: Loading test adventure from editor:', testAdventure.title);
      resetGame();
      setTimeout(() => {
        loadAdventure(testAdventure);
      }, 10);
    }
  }, [testAdventure, mode, loadAdventure, resetGame]);

  // Handle play testing from editor
  const handlePlayTest = (adventure) => {
    console.log('App: Play test requested for:', adventure.title);
    setTestAdventure(adventure);
    setMode('player');
  };

  // Handle exit editor
  const handleExitEditor = () => {
    setMode('player');
  };

  // Handle mode switch
  const switchMode = (newMode) => {
    if (newMode === 'player' && mode === 'editor') {
      setTestAdventure(null);
    }
    setMode(newMode);
  };

  return createElement('div', { className: 'app min-h-screen bg-gray-50' }, [
    // Enhanced mode toggle header
    createElement('div', {
      key: 'mode-toggle',
      className: 'bg-white border-b border-gray-200 shadow-sm'
    }, createElement('div', {
      className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'
    }, createElement('div', {
      className: 'flex items-center justify-between h-16'
    }, [
      // Enhanced app title with Phase 3 branding
      createElement('div', {
        key: 'app-title',
        className: 'flex items-center'
      }, [
        createElement('div', {
          key: 'title-group',
          className: 'flex items-center mr-8'
        }, [
          createElement('div', {
            key: 'logo',
            className: 'w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mr-3'
          }, createElement('span', {
            className: 'text-white font-bold text-sm'
          }, 'AE')),
          createElement('div', {
            key: 'titles'
          }, [
            createElement('h1', {
              key: 'main-title',
              className: 'text-xl font-bold text-gray-900'
            }, 'Adventure Engine'),
            createElement('div', {
              key: 'subtitle',
              className: 'text-xs text-gray-500'
            }, 'Phase 3 - Advanced Features Demo')
          ])
        ]),
        createElement('div', {
          key: 'features-badge',
          className: 'hidden sm:flex items-center space-x-2 text-xs'
        }, [
          createElement('span', {
            key: 'inventory',
            className: 'px-2 py-1 bg-green-100 text-green-700 rounded-full'
          }, 'Inventory'),
          createElement('span', {
            key: 'secrets',
            className: 'px-2 py-1 bg-purple-100 text-purple-700 rounded-full'
          }, 'Secrets'),
          createElement('span', {
            key: 'achievements',
            className: 'px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full'
          }, 'Achievements'),
          createElement('span', {
            key: 'cross-game',
            className: 'px-2 py-1 bg-blue-100 text-blue-700 rounded-full'
          }, 'Cross-Game Saves')
        ])
      ]),
      
      // Enhanced mode toggle buttons
      createElement('div', {
        key: 'mode-buttons',
        className: 'flex items-center space-x-1'
      }, [
        createElement('button', {
          key: 'player-btn',
          onClick: () => switchMode('player'),
          className: `px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            mode === 'player' 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
              : 'text-gray-700 bg-gray-100 hover:bg-gray-200 hover:shadow-md'
          }`
        }, [
          createElement('span', {
            key: 'player-icon',
            className: 'mr-2'
          }, '🎮'),
          'Play Demo'
        ]),
        createElement('button', {
          key: 'editor-btn', 
          onClick: () => switchMode('editor'),
          className: `px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            mode === 'editor' 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
              : 'text-gray-700 bg-gray-100 hover:bg-gray-200 hover:shadow-md'
          }`
        }, [
          createElement('span', {
            key: 'editor-icon',
            className: 'mr-2'
          }, '⚙️'),
          'Create Adventures'
        ])
      ])
    ]))),

    // Main content area
    createElement('div', {
      key: 'main-content', 
      className: 'flex-1'
    }, mode === 'player' 
      ? createElement(GameScreen, { 
          key: 'game-screen',
          className: 'phase3-demo' 
        })
      : createElement(EditorScreen, { 
          key: 'editor-screen',
          onExitEditor: handleExitEditor,
          onPlayTest: handlePlayTest,
          className: 'phase3-editor'
        })
    ),

    // Phase 3 demo information footer (only in player mode)
    mode === 'player' && createElement('div', {
      key: 'demo-info',
      className: 'bg-gradient-to-r from-blue-50 to-purple-50 border-t border-gray-200 p-4'
    }, createElement('div', {
      className: 'max-w-7xl mx-auto'
    }, createElement('div', {
      className: 'text-center'
    }, [
      createElement('h3', {
        key: 'demo-title',
        className: 'text-sm font-semibold text-gray-800 mb-2'
      }, 'Phase 3 Features Showcase'),
      createElement('div', {
        key: 'demo-features',
        className: 'flex flex-wrap justify-center gap-4 text-xs text-gray-600'
      }, [
        createElement('div', {
          key: 'inventory-demo',
          className: 'flex items-center space-x-1'
        }, [
          createElement('span', { key: 'icon' }, '🎒'),
          createElement('span', { key: 'text' }, 'Dynamic Inventory System')
        ]),
        createElement('div', {
          key: 'secrets-demo',
          className: 'flex items-center space-x-1'
        }, [
          createElement('span', { key: 'icon' }, '✨'),
          createElement('span', { key: 'text' }, 'Hidden Secret Choices')
        ]),
        createElement('div', {
          key: 'achievements-demo',
          className: 'flex items-center space-x-1'
        }, [
          createElement('span', { key: 'icon' }, '🏆'),
          createElement('span', { key: 'text' }, 'Achievement Tracking')
        ]),
         createElement('div', {
          key: 'stats-demo',
          className: 'flex items-center space-x-1'
        }, [
          createElement('span', { key: 'icon' }, '📊'),
          createElement('span', { key: 'text' }, 'Enhanced Stats System')
        ]),
         createElement('div', {
          key: 'stats-demo',
          className: 'flex items-center space-x-1'
        }, [
          createElement('span', { key: 'icon' }, '📊'),
          createElement('span', { key: 'text' }, 'Enhanced Stats System')
        ]),
        createElement('div', {
          key: 'saves-demo',
          className: 'flex items-center space-x-1'
        }, [
          createElement('span', { key: 'icon' }, '💾'),
          createElement('span', { key: 'text' }, 'Cross-Game Save Support')
        ])
      ])
    ])))
  ]);
}

// Wrap the app content with necessary providers
function App() {
  return createElement(GameProvider, null,
    createElement(AppContent)
  );
}

export default App;