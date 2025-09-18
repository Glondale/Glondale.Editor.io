// GameContext.js - Enhanced with Phase 3 advanced features
import { initialGameState } from '../types/GameState.js';
import { StoryEngine } from '../engine/StoryEngine.js';
import { SaveSystem } from '../engine/SaveSystem.js';
import { CrossGameSaveSystem } from '../engine/CrossGameSaveSystem.js';
import { ExportableDataManager } from '../engine/ExportableDataManager.js';

import React, { createContext, useContext, useReducer, useEffect } from "https://esm.sh/react@18";

// Enhanced game state reducer with Phase 3 features
export function gameReducer(state, action) {
  switch (action.type) {
    case 'LOAD_ADVENTURE':
      return {
        ...state,
        adventure: action.payload,
        isLoading: false,
        error: null,
      };

    case 'SET_SCENE':
      return {
        ...state,
        currentScene: action.payload,
        visitedScenes: state.currentScene 
          ? [...new Set([...state.visitedScenes, state.currentScene.id])]
          : state.visitedScenes,
      };

    case 'UPDATE_STAT':
      return {
        ...state,
        stats: {
          ...state.stats,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'ADD_TO_STAT':
      return {
        ...state,
        stats: {
          ...state.stats,
          [action.payload.key]: (state.stats[action.payload.key] || 0) + action.payload.amount,
        },
      };

    case 'SET_FLAG':
      return {
        ...state,
        flags: {
          ...state.flags,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'RECORD_CHOICE':
      return {
        ...state,
        choiceHistory: [
          ...state.choiceHistory,
          {
            sceneId: action.payload.sceneId,
            choiceId: action.payload.choiceId,
            timestamp: Date.now(),
            choiceText: action.payload.choiceText,
            wasSecret: action.payload.wasSecret,
            wasLocked: action.payload.wasLocked,
          },
        ],
      };

    // Phase 3 inventory actions
    case 'ADD_INVENTORY_ITEM':
      const existingItemIndex = state.inventory.findIndex(item => item.id === action.payload.id);
      if (existingItemIndex >= 0) {
        // Update existing item count
        const updatedInventory = [...state.inventory];
        updatedInventory[existingItemIndex] = {
          ...updatedInventory[existingItemIndex],
          count: updatedInventory[existingItemIndex].count + (action.payload.count || 1)
        };
        return {
          ...state,
          inventory: updatedInventory
        };
      } else {
        // Add new item
        return {
          ...state,
          inventory: [
            ...state.inventory,
            {
              id: action.payload.id,
              count: action.payload.count || 1,
              acquiredTimestamp: Date.now(),
              source: action.payload.source || 'unknown'
            }
          ]
        };
      }

    case 'REMOVE_INVENTORY_ITEM':
      return {
        ...state,
        inventory: state.inventory.map(item => 
          item.id === action.payload.id
            ? { ...item, count: Math.max(0, item.count - (action.payload.count || 1)) }
            : item
        ).filter(item => item.count > 0)
      };

    case 'SET_INVENTORY_ITEM':
      const itemIndex = state.inventory.findIndex(item => item.id === action.payload.id);
      if (itemIndex >= 0) {
        const updatedInventory = [...state.inventory];
        if (action.payload.count === 0) {
          // Remove item if count is 0
          updatedInventory.splice(itemIndex, 1);
        } else {
          updatedInventory[itemIndex] = {
            ...updatedInventory[itemIndex],
            count: action.payload.count
          };
        }
        return {
          ...state,
          inventory: updatedInventory
        };
      } else if (action.payload.count > 0) {
        // Add new item if count > 0
        return {
          ...state,
          inventory: [
            ...state.inventory,
            {
              id: action.payload.id,
              count: action.payload.count,
              acquiredTimestamp: Date.now()
            }
          ]
        };
      }
      return state;

    case 'UPDATE_INVENTORY_STATE':
      return {
        ...state,
        inventoryState: {
          ...state.inventoryState,
          ...action.payload,
          lastModified: Date.now()
        }
      };

    // Phase 3 secret discovery actions
    case 'DISCOVER_SECRET':
      if (state.secretsDiscovered.some(secret => 
          secret.choiceId === action.payload.choiceId && 
          secret.sceneId === action.payload.sceneId)) {
        return state; // Already discovered
      }
      return {
        ...state,
        secretsDiscovered: [
          ...state.secretsDiscovered,
          {
            choiceId: action.payload.choiceId,
            sceneId: action.payload.sceneId,
            timestamp: Date.now(),
            choiceText: action.payload.choiceText,
            discoveryMethod: action.payload.discoveryMethod || 'condition_met'
          }
        ],
        secretChoicesAvailable: [
          ...new Set([...state.secretChoicesAvailable, action.payload.choiceId])
        ]
      };

    case 'ADD_SECRET_CHOICE':
      if (state.secretChoicesAvailable.includes(action.payload)) {
        return state; // Already available
      }
      return {
        ...state,
        secretChoicesAvailable: [...state.secretChoicesAvailable, action.payload]
      };

    // Phase 3 achievement actions
    case 'UNLOCK_ACHIEVEMENT':
      if (state.achievements.some(achievement => achievement.id === action.payload.id)) {
        return state; // Already unlocked
      }
      return {
        ...state,
        achievements: [
          ...state.achievements,
          {
            id: action.payload.id,
            unlockedTimestamp: Date.now(),
            progress: 1.0,
            metadata: action.payload.metadata || {},
            notificationShown: false
          }
        ]
      };

    case 'UPDATE_ACHIEVEMENT_PROGRESS':
      return {
        ...state,
        achievements: state.achievements.map(achievement =>
          achievement.id === action.payload.id
            ? { ...achievement, progress: action.payload.progress }
            : achievement
        )
      };

    case 'MARK_ACHIEVEMENT_NOTIFICATION_SHOWN':
      return {
        ...state,
        achievements: state.achievements.map(achievement =>
          achievement.id === action.payload
            ? { ...achievement, notificationShown: true }
            : achievement
        )
      };

    // Enhanced load save with Phase 3 data
    case 'LOAD_SAVE':
      return {
        ...state,
        stats: action.payload.stats || {},
        flags: action.payload.flags || {},
        visitedScenes: action.payload.visitedScenes || [],
        choiceHistory: action.payload.choiceHistory || [],
        inventory: action.payload.inventory || [],
        inventoryState: action.payload.inventoryState || {
          totalWeight: 0,
          totalValue: 0,
          categories: {},
          lastModified: Date.now()
        },
        secretsDiscovered: action.payload.secretsDiscovered || [],
        secretChoicesAvailable: action.payload.secretChoicesAvailable || [],
        achievements: action.payload.achievements || [],
        crossGameImports: action.payload.crossGameImports || [],
        isLoading: false,
        error: null,
      };

    // Cross-game save actions
    case 'IMPORT_CROSS_GAME_SAVE':
      return {
        ...state,
        crossGameImports: [
          ...state.crossGameImports,
          {
            sourceAdventureId: action.payload.sourceAdventureId,
            sourceAdventureTitle: action.payload.sourceAdventureTitle,
            importTimestamp: Date.now(),
            importedStats: action.payload.importedStats || {},
            importedFlags: action.payload.importedFlags || {},
            importedItems: action.payload.importedItems || [],
            importMethod: action.payload.importMethod || 'full',
            success: action.payload.success || false
          }
        ]
      };

    // Analytics actions
    case 'UPDATE_GAMEPLAY_METRICS':
      return {
        ...state,
        gameplayMetrics: {
          ...state.gameplayMetrics,
          ...action.payload,
          lastUpdated: Date.now()
        }
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    case 'RESET_GAME':
      return {
        ...initialGameState,
        // Re-create Phase 3 additions so reset preserves expected shape
        inventory: [],
        inventoryState: {
          totalWeight: 0,
          totalValue: 0,
          categories: {},
          lastModified: Date.now()
        },
        secretsDiscovered: [],
        secretChoicesAvailable: [],
        achievements: [],
        crossGameImports: [],
        gameplayMetrics: {
          totalChoicesMade: 0,
          uniqueScenesVisited: 0,
          secretsFound: 0,
          achievementsUnlocked: 0,
          estimatedPlayTime: 0
        },
        autoSaveEnabled: true,
        autoSaveInterval: 300000
      };

    // Auto-save management
    case 'SET_AUTO_SAVE_ENABLED':
      return {
        ...state,
        autoSaveEnabled: action.payload
      };

    case 'UPDATE_AUTO_SAVE_INTERVAL':
      return {
        ...state,
        autoSaveInterval: action.payload
      };

    default:
      return state;
  }
}

// Create context
const GameContext = createContext();

// Context provider with Phase 3 enhancements
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, {
    ...initialGameState,
    // Phase 3 additions to initial state
    inventory: [],
    inventoryState: {
      totalWeight: 0,
      totalValue: 0,
      categories: {},
      lastModified: Date.now()
    },
    secretsDiscovered: [],
    secretChoicesAvailable: [],
    achievements: [],
    crossGameImports: [],
    gameplayMetrics: {
      totalChoicesMade: 0,
      uniqueScenesVisited: 0,
      secretsFound: 0,
      achievementsUnlocked: 0,
      estimatedPlayTime: 0
    },
    autoSaveEnabled: true,
    autoSaveInterval: 300000 // 5 minutes
  });
  
  // Initialize engines with Phase 3 support and keep them stable across re-renders
  const storyEngineRef = React.useRef(null);
  if (!storyEngineRef.current) {
    storyEngineRef.current = new StoryEngine();
  }
  const storyEngine = storyEngineRef.current;

  const saveSystemRef = React.useRef(null);
  if (!saveSystemRef.current) {
    saveSystemRef.current = new SaveSystem(storyEngine);
  }
  const saveSystem = saveSystemRef.current;

  const crossGameSaveSystemRef = React.useRef(null);
  if (!crossGameSaveSystemRef.current) {
    crossGameSaveSystemRef.current = new CrossGameSaveSystem();
  }
  const crossGameSaveSystem = crossGameSaveSystemRef.current;

  const exportableDataManagerRef = React.useRef(null);
  if (!exportableDataManagerRef.current) {
    exportableDataManagerRef.current = new ExportableDataManager();
  }
  const exportableDataManager = exportableDataManagerRef.current;

  // Prevent rapid duplicate choice selections
  const isChoosingRef = React.useRef(false);

  // Auto-save effect
  useEffect(() => {
    if (!state.autoSaveEnabled || !state.adventure) return;

    const interval = setInterval(() => {
      if (state.currentScene && !state.isLoading) {
        saveSystem.autoSave().catch(error => {
          console.warn('Auto-save failed:', error);
        });
      }
    }, state.autoSaveInterval);

    return () => clearInterval(interval);
  }, [state.autoSaveEnabled, state.autoSaveInterval, state.adventure, state.currentScene, state.isLoading]);

  // Secret discovery event listener
  useEffect(() => {
    const handleSecretDiscovered = (event) => {
      const { choice, scene } = event.detail;
      dispatch({
        type: 'DISCOVER_SECRET',
        payload: {
          choiceId: choice.id,
          sceneId: scene.id,
          choiceText: choice.text,
                inputValue: submission?.inputValue ?? null,
          discoveryMethod: 'condition_met'
        }
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('secretChoiceDiscovered', handleSecretDiscovered);
      return () => window.removeEventListener('secretChoiceDiscovered', handleSecretDiscovered);
    }
  }, []);

  // Enhanced action helpers with Phase 3 features
  const actions = {
    loadAdventure: async (adventure) => {
      try {
        console.log('GameContext: loadAdventure called with:', adventure?.title);
        // Wait for the story engine to finish loading and navigating to the start scene
        await storyEngine.loadAdventure(adventure);
        dispatch({ type: 'LOAD_ADVENTURE', payload: adventure });
        const scene = storyEngine.getCurrentScene();
        console.log('GameContext: storyEngine current scene after load:', scene?.id, scene?.title);
        if (scene) {
          dispatch({ type: 'SET_SCENE', payload: scene });
        } else {
          console.warn('GameContext: no scene returned by storyEngine after loadAdventure');
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load adventure' });
      }
    },

    makeChoice: (choiceId, submission = {}) => {
      if (isChoosingRef.current) {
        // Ignore rapid repeat clicks while processing a choice
        return;
      }
      isChoosingRef.current = true;
      try {
        console.log('Making choice:', choiceId, 'from scene:', state.currentScene?.id);
        
        // Get current scene and choice info BEFORE making the choice
        const currentSceneId = state.currentScene?.id;
        const choice = state.currentScene?.choices?.find(c => c.id === choiceId);
        const wasSecret = choice?.isSecret || false;
        const wasLocked = choice?.evaluation?.state === 'LOCKED';
        
        // Make the choice in the story engine
        const newScene = storyEngine.makeChoice(choiceId, submission);
        
        console.log('Choice result - new scene:', newScene?.id);
        
        if (newScene) {
          // Update to new scene
          dispatch({ type: 'SET_SCENE', payload: newScene });
          
          // Record the choice with enhanced data
          if (currentSceneId && choice) {
            dispatch({ 
              type: 'RECORD_CHOICE', 
              payload: { 
                sceneId: currentSceneId, 
                choiceId,
                choiceText: choice.text,
                inputValue: submission?.inputValue ?? null,
                wasSecret,
                wasLocked
              } 
            });
          }
          
          // Update stats, flags, and inventory from story engine
          const statsManager = storyEngine.getStatsManager();
          const inventoryManager = storyEngine.getInventoryManager();
          
          // Update stats
          const currentStats = statsManager.getAllStats();
          Object.entries(currentStats).forEach(([key, value]) => {
            if (state.stats[key] !== value) {
              dispatch({ type: 'UPDATE_STAT', payload: { key, value } });
            }
          });
          
          // Update flags
          const currentFlags = statsManager.getAllFlags();
          Object.entries(currentFlags).forEach(([key, value]) => {
            if (state.flags[key] !== value) {
              dispatch({ type: 'SET_FLAG', payload: { key, value } });
            }
          });
          
          // Update inventory if available
          if (inventoryManager) {
            const inventoryItems = inventoryManager.getAllItems();
            const inventoryState = inventoryManager.getInventoryState();
            
            // Sync inventory items
            inventoryItems.forEach(item => {
              const stateItem = state.inventory.find(i => i.id === item.id);
              if (!stateItem || stateItem.count !== item.count) {
                dispatch({
                  type: 'SET_INVENTORY_ITEM',
                  payload: { id: item.id, count: item.count }
                });
              }
            });
            
            // Update inventory state
            dispatch({
              type: 'UPDATE_INVENTORY_STATE',
              payload: inventoryState
            });
          }
          
          // Update gameplay metrics
          dispatch({
            type: 'UPDATE_GAMEPLAY_METRICS',
            payload: {
              totalChoicesMade: state.choiceHistory.length + 1,
              uniqueScenesVisited: new Set([...state.visitedScenes, newScene.id]).size,
              secretsFound: state.secretsDiscovered.length,
              achievementsUnlocked: state.achievements.length
            }
          });
          
        } else {
          console.error('No new scene returned from makeChoice');
        }
      } catch (error) {
        console.error('makeChoice error:', error);
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to make choice' });
      } finally {
        isChoosingRef.current = false;
      }
    },

    // Enhanced save/load with Phase 3 support
    saveGame: async (name) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const saveId = await saveSystem.saveGame(name);
        dispatch({ type: 'SET_LOADING', payload: false });
        return saveId;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to save game' });
      }
    },

    loadGame: async (saveId) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const saveData = await saveSystem.loadGame(saveId);
        dispatch({ type: 'LOAD_SAVE', payload: saveData });
        const scene = storyEngine.getCurrentScene();
        if (scene) {
          dispatch({ type: 'SET_SCENE', payload: scene });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load game' });
      }
    },

    // Cross-game save operations
    exportCrossGameSave: async (saveId, format = 'json') => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const exportResult = await saveSystem.exportSaveForCrossGame(saveId, format);
        dispatch({ type: 'SET_LOADING', payload: false });
        return exportResult;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to export cross-game save' });
      }
    },

    importCrossGameSave: async (crossGameSaveData, transferOptions = {}) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const importResult = await saveSystem.importCrossGameSave(crossGameSaveData, transferOptions);
        
        if (importResult.success) {
          dispatch({
            type: 'IMPORT_CROSS_GAME_SAVE',
            payload: {
              sourceAdventureId: crossGameSaveData.sourceAdventure?.id,
              sourceAdventureTitle: crossGameSaveData.sourceAdventure?.title,
              importedStats: importResult.importedStats || {},
              importedFlags: importResult.importedFlags || {},
              importedItems: importResult.importedItems || [],
              success: true
            }
          });
        }
        
        dispatch({ type: 'SET_LOADING', payload: false });
        return importResult;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to import cross-game save' });
      }
    },

    // Inventory actions
    addInventoryItem: (itemId, count = 1, source = 'action') => {
      dispatch({
        type: 'ADD_INVENTORY_ITEM',
        payload: { id: itemId, count, source }
      });
    },

    removeInventoryItem: (itemId, count = 1) => {
      dispatch({
        type: 'REMOVE_INVENTORY_ITEM',
        payload: { id: itemId, count }
      });
    },

    setInventoryItemCount: (itemId, count) => {
      dispatch({
        type: 'SET_INVENTORY_ITEM',
        payload: { id: itemId, count }
      });
    },

    // Secret and achievement actions
    discoverSecret: (choiceId, sceneId, choiceText, method = 'condition_met') => {
      dispatch({
        type: 'DISCOVER_SECRET',
        payload: { choiceId, sceneId, choiceText, discoveryMethod: method }
      });
    },

    unlockAchievement: (achievementId, metadata = {}) => {
      dispatch({
        type: 'UNLOCK_ACHIEVEMENT',
        payload: { id: achievementId, metadata }
      });
    },

    updateAchievementProgress: (achievementId, progress) => {
      dispatch({
        type: 'UPDATE_ACHIEVEMENT_PROGRESS',
        payload: { id: achievementId, progress }
      });
    },

    // Analytics actions
    generateAnalyticsReport: () => {
      const metrics = {
        totalChoicesMade: state.choiceHistory.length,
        uniqueScenesVisited: state.visitedScenes.length,
        secretsFound: state.secretsDiscovered.length,
        achievementsUnlocked: state.achievements.length,
        completionPercentage: storyEngine.calculateCompletionPercentage?.() || 0,
        playTime: Date.now() - (state.startTime || Date.now())
      };
      
      dispatch({
        type: 'UPDATE_GAMEPLAY_METRICS',
        payload: metrics
      });
      
      return metrics;
    },

    // Auto-save configuration
    setAutoSaveEnabled: (enabled) => {
      dispatch({ type: 'SET_AUTO_SAVE_ENABLED', payload: enabled });
    },

    setAutoSaveInterval: (interval) => {
      dispatch({ type: 'UPDATE_AUTO_SAVE_INTERVAL', payload: interval });
    },

    // Error management
    clearError: () => {
      dispatch({ type: 'CLEAR_ERROR' });
    },

    resetGame: () => {
      dispatch({ type: 'RESET_GAME' });
    },
  };

  const value = { 
    state, 
    dispatch, 
    storyEngine, 
    saveSystem, 
    crossGameSaveSystem,
    exportableDataManager,
    actions 
  };

  return React.createElement(GameContext.Provider, { value }, children);
}

// Hook to use game context
export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}
