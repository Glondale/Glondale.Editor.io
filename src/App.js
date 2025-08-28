import { GameProvider } from './contexts/GameContext.js';
import { GameScreen } from './components/player/GameScreen.js';
import EditorScreen from './components/editor/EditorScreen.js';
import { useGameState } from './hooks/useGameState.js';

const { useEffect, createElement, useState } = React;

// Sample adventure for testing
const sampleAdventure = {
  id: 'sample-adventure',
  title: 'The Forest Path',
  author: 'Adventure Engine',
  version: '1.0',
  description: 'A simple adventure to test the engine',
  startSceneId: 'start',
  stats: [
    {
      id: 'health',
      name: 'Health',
      type: 'number',
      defaultValue: 100,
      min: 0,
      max: 100
    },
    {
      id: 'courage',
      name: 'Courage',
      type: 'number',
      defaultValue: 50,
      min: 0,
      max: 100
    },
    {
      id: 'has_sword',
      name: 'Has Sword',
      type: 'boolean',
      defaultValue: false
    }
  ],
  scenes: [
    {
      id: 'start',
      title: 'The Beginning',
      content: 'You stand at the edge of a dark forest. The path ahead splits into two directions.\n\nTo your left, you see a well-worn trail that looks safe but longer. To your right, there\'s a narrow path that disappears into thick undergrowth.',
      choices: [
        {
          id: 'left-path',
          text: 'Take the safe path to the left',
          targetSceneId: 'safe-path'
        },
        {
          id: 'right-path',
          text: 'Brave the dangerous path to the right',
          targetSceneId: 'dangerous-path'
        }
      ]
    },
    {
      id: 'safe-path',
      title: 'The Safe Path',
      content: 'You walk along the well-worn trail. The path is easy and you feel confident.\n\nAfter a while, you come across an old merchant sitting by the roadside.',
      choices: [
        {
          id: 'talk-merchant',
          text: 'Talk to the merchant',
          targetSceneId: 'merchant-talk',
          actions: [
            { type: 'add_stat', key: 'courage', value: 10 }
          ]
        },
        {
          id: 'ignore-merchant',
          text: 'Ignore the merchant and continue',
          targetSceneId: 'continue-safe'
        }
      ],
      onEnter: [
        { type: 'add_stat', key: 'health', value: 5 }
      ]
    },
    {
      id: 'dangerous-path',
      title: 'The Dangerous Path',
      content: 'You push through the thick undergrowth. Branches scratch at your arms and face.\n\nSudenly, you hear a rustling in the bushes ahead. Something is moving towards you!',
      choices: [
        {
          id: 'fight-creature',
          text: 'Stand your ground and fight',
          targetSceneId: 'fight-scene',
          conditions: [
            { type: 'stat', operator: 'gte', key: 'courage', value: 30 }
          ]
        },
        {
          id: 'run-away',
          text: 'Run back to the safe path',
          targetSceneId: 'safe-path'
        },
        {
          id: 'hide-bushes',
          text: 'Hide in the bushes',
          targetSceneId: 'hide-scene'
        }
      ],
      onEnter: [
        { type: 'add_stat', key: 'health', value: -10 }
      ]
    },
    {
      id: 'merchant-talk',
      title: 'The Merchant',
      content: 'The old merchant smiles warmly. "Ah, a traveler! Here, take this sword. You\'ll need it on your journey."\n\nHe hands you a gleaming sword.',
      choices: [
        {
          id: 'thank-merchant',
          text: 'Thank the merchant and continue',
          targetSceneId: 'continue-safe'
        }
      ],
      onEnter: [
        { type: 'set_flag', key: 'has_sword', value: true }
      ]
    },
    {
      id: 'continue-safe',
      title: 'Continuing Forward',
      content: 'You continue along the path. The forest begins to thin out and you can see sunlight ahead.\n\nCongratulations! You have successfully navigated the forest.',
      choices: []
    },
    {
      id: 'fight-scene',
      title: 'The Fight',
      content: 'A large wolf emerges from the bushes! You stand your ground bravely.',
      choices: [
        {
          id: 'win-fight',
          text: 'You defeated the wolf!',
          targetSceneId: 'victory',
          conditions: [
            { type: 'flag', operator: 'eq', key: 'has_sword', value: true }
          ]
        },
        {
          id: 'lose-fight',
          text: 'The wolf is too strong...',
          targetSceneId: 'defeat'
        }
      ]
    },
    {
      id: 'hide-scene',
      title: 'Hiding',
      content: 'You crouch down in the bushes and wait. The creature passes by without noticing you.\n\nAfter it\'s gone, you carefully make your way back to the main path.',
      choices: [
        {
          id: 'back-to-safe',
          text: 'Return to the safe path',
          targetSceneId: 'safe-path'
        }
      ]
    },
    {
      id: 'victory',
      title: 'Victory!',
      content: 'With your sword, you manage to defeat the wolf! You feel much braver now.\n\nThe path ahead is clear and leads out of the forest.',
      choices: [],
      onEnter: [
        { type: 'add_stat', key: 'courage', value: 25 }
      ]
    },
    {
      id: 'defeat',
      title: 'Defeat',
      content: 'Without a weapon, the wolf proves too much for you. You manage to escape but you\'re badly wounded.\n\nYou stumble back towards the safe path.',
      choices: [
        {
          id: 'back-wounded',
          text: 'Retreat to safety',
          targetSceneId: 'safe-path'
        }
      ],
      onEnter: [
        { type: 'add_stat', key: 'health', value: -25 }
      ]
    }
  ]
};

function AppContent() {
  const { loadAdventure, resetGame, isGameLoaded } = useGameState();
  const [mode, setMode] = useState('player');
  const [testAdventure, setTestAdventure] = useState(null);

  // Initialize with sample adventure on first load
  useEffect(() => {
    if (!isGameLoaded && mode === 'player' && !testAdventure) {
      console.log('App: Loading initial sample adventure');
      loadAdventure(sampleAdventure);
    }
  }, [isGameLoaded, loadAdventure, mode, testAdventure]);

  // Load test adventure from editor
  useEffect(() => {
    if (testAdventure && mode === 'player') {
      console.log('App: Loading test adventure from editor:', testAdventure.title);
      // Reset game state first, then load new adventure
      resetGame();
      // Use setTimeout to ensure state reset completes
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

  // Handle mode switch - clear test adventure when switching manually
  const switchMode = (newMode) => {
    if (newMode === 'player' && mode === 'editor') {
      // Switching back to player manually - clear test adventure
      setTestAdventure(null);
    }
    setMode(newMode);
  };

  return createElement('div', { className: 'app min-h-screen bg-gray-50' }, [
    // Mode toggle header
    createElement('div', {
      key: 'mode-toggle',
      className: 'bg-white border-b border-gray-200 shadow-sm'
    }, createElement('div', {
      className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'
    }, createElement('div', {
      className: 'flex items-center justify-between h-16'
    }, [
      // App title
      createElement('div', {
        key: 'app-title',
        className: 'flex items-center'
      }, [
        createElement('h1', {
          key: 'title',
          className: 'text-xl font-bold text-gray-900 mr-8'
        }, 'Adventure Engine'),
        createElement('div', {
          key: 'version',
          className: 'text-sm text-gray-500'
        }, 'Phase 2 - Visual Editor')
      ]),
      
      // Mode toggle buttons
      createElement('div', {
        key: 'mode-buttons',
        className: 'flex items-center space-x-1'
      }, [
        createElement('button', {
          key: 'player-btn',
          onClick: () => switchMode('player'),
          className: `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'player' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
          }`
        }, [
          createElement('span', {
            key: 'player-icon',
            className: 'mr-2'
          }, '🎮'),
          'Player'
        ]),
        createElement('button', {
          key: 'editor-btn',
          onClick: () => switchMode('editor'),
          className: `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'editor' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
          }`
        }, [
          createElement('span', {
            key: 'editor-icon',
            className: 'mr-2'
          }, '🛠️'),
          'Editor'
        ])
      ])
    ]))),

    // Main content area
    createElement('div', {
      key: 'main-content',
      className: 'flex-1'
    }, mode === 'player' 
      ? createElement(GameScreen, { key: 'game-screen' })
      : createElement(EditorScreen, { 
          key: 'editor-screen',
          onExitEditor: handleExitEditor,
          onPlayTest: handlePlayTest
        })
    )
  ]);
}

function App() {
  return createElement(GameProvider, {}, createElement(AppContent));
}

export default App;