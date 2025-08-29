 
import { useGameState } from '../../hooks/useGameState.js';
import { SceneDisplay } from './SceneDisplay.js';
import { ChoiceList } from './ChoiceList.js';
import { StatsPanel } from './StatsPanel.js';
import { SaveLoadMenu } from './SaveLoadMenu.js';
import { Button } from '../common/Button.js';

import React, { useState, createElement } from "https://esm.sh/react@18";

export function GameScreen() {
  const {
    gameState,
    saves,
    makeChoice,
    saveGame,
    loadGame,
    deleteSave,
    quickSave,
    isGameLoaded,
    isPlaying,
    hasError,
    isLoading
  } = useGameState();

  const [showSaveMenu, setShowSaveMenu] = useState(false);

  if (!isGameLoaded) {
    return createElement('div', {
      className: 'min-h-screen bg-gray-100 flex items-center justify-center'
    }, createElement('div', {
      className: 'text-center'
    }, [
      createElement('h1', {
        key: 'title',
        className: 'text-2xl font-bold text-gray-800 mb-4'
      }, 'Adventure Engine'),
      createElement('p', {
        key: 'message',
        className: 'text-gray-600'
      }, 'No adventure loaded')
    ]));
  }

  if (hasError) {
    return createElement('div', {
      className: 'min-h-screen bg-gray-100 flex items-center justify-center'
    }, createElement('div', {
      className: 'text-center'
    }, [
      createElement('h1', {
        key: 'title',
        className: 'text-2xl font-bold text-red-600 mb-4'
      }, 'Error'),
      createElement('p', {
        key: 'message',
        className: 'text-gray-600'
      }, gameState.error)
    ]));
  }

  return createElement('div', {
    className: 'min-h-screen bg-gray-100'
  }, [
    // Header
    createElement('header', {
      key: 'header',
      className: 'bg-white shadow-sm border-b'
    }, createElement('div', {
      className: 'max-w-4xl mx-auto px-4 py-3'
    }, createElement('div', {
      className: 'flex items-center justify-between'
    }, [
      createElement('div', {
        key: 'title-section'
      }, [
        createElement('h1', {
          key: 'title',
          className: 'text-xl font-bold text-gray-800'
        }, gameState.adventure?.title || 'Adventure'),
        gameState.adventure?.author && createElement('p', {
          key: 'author',
          className: 'text-sm text-gray-600'
        }, `by ${gameState.adventure.author}`)
      ]),

      createElement('div', {
        key: 'actions',
        className: 'flex items-center space-x-2'
      }, createElement(Button, {
        onClick: () => setShowSaveMenu(true),
        variant: 'secondary',
        size: 'sm',
        disabled: !isPlaying || isLoading
      }, 'Save/Load'))
    ]))),

    // Main Content
    createElement('div', {
      key: 'main',
      className: 'max-w-4xl mx-auto px-4 py-6'
    }, createElement('div', {
      className: 'grid grid-cols-1 lg:grid-cols-3 gap-6'
    }, [
      // Main Game Area
      createElement('div', {
        key: 'game-area',
        className: 'lg:col-span-2 space-y-6'
      }, [
        // Scene Display
        createElement(SceneDisplay, {
          key: 'scene',
          scene: gameState.currentScene
        }),

        // Loading State
        isLoading && createElement('div', {
          key: 'loading',
          className: 'text-center py-4'
        }, [
          createElement('div', {
            key: 'spinner',
            className: 'inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'
          }),
          createElement('p', {
            key: 'text',
            className: 'text-gray-600 mt-2'
          }, 'Loading...')
        ]),

        // Choices
        !isLoading && gameState.availableChoices.length > 0 && createElement(ChoiceList, {
          key: 'choices',
          choices: gameState.availableChoices,
          onChoiceSelect: makeChoice,
          disabled: isLoading
        }),

        // No Choices (End State)
        !isLoading && gameState.availableChoices.length === 0 && isPlaying && createElement('div', {
          key: 'end',
          className: 'text-center py-8 bg-white rounded-lg border'
        }, [
          createElement('h3', {
            key: 'title',
            className: 'text-xl font-semibold text-gray-800 mb-2'
          }, 'The End'),
          createElement('p', {
            key: 'message',
            className: 'text-gray-600 mb-4'
          }, 'You have reached the end of this adventure.'),
          createElement(Button, {
            key: 'save-button',
            onClick: () => setShowSaveMenu(true),
            variant: 'secondary'
          }, 'Save Progress')
        ])
      ]),

      // Stats Sidebar
      createElement('div', {
        key: 'sidebar',
        className: 'space-y-4'
      }, [
        createElement(StatsPanel, {
          key: 'stats',
          stats: gameState.visibleStats,
          visitedScenes: gameState.visitedCount,
          totalScenes: gameState.sceneCount,
          progressPercent: gameState.progressPercent
        }),

        // Quick Actions
        createElement('div', {
          key: 'quick-actions',
          className: 'bg-white rounded-lg border p-4 space-y-2'
        }, [
          createElement('h4', {
            key: 'title',
            className: 'font-semibold text-gray-800'
          }, 'Quick Actions'),
          createElement(Button, {
            key: 'quick-save',
            onClick: quickSave,
            variant: 'secondary',
            size: 'sm',
            className: 'w-full',
            disabled: !gameState.canSave || isLoading
          }, 'Quick Save')
        ])
      ])
    ])),

    // Save/Load Menu
    showSaveMenu && createElement(SaveLoadMenu, {
      key: 'save-menu',
      saves,
      onSave: saveGame,
      onLoad: loadGame,
      onDelete: deleteSave,
      onQuickSave: quickSave,
      canSave: gameState.canSave,
      canLoad: gameState.canLoad,
      isLoading,
      onClose: () => setShowSaveMenu(false)
    })
  ]);
}