// GameContext.js - Fixed makeChoice action
import { initialGameState } from '../types/GameState.js';
import { StoryEngine } from '../engine/StoryEngine.js';
import { SaveSystem } from '../engine/SaveSystem.js';

const { createContext, useContext, useReducer } = React;

// Game state reducer
function gameReducer(state, action) {
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
          },
        ],
      };

    case 'LOAD_SAVE':
      return {
        ...state,
        stats: action.payload.stats,
        flags: action.payload.flags,
        visitedScenes: action.payload.visitedScenes,
        choiceHistory: action.payload.choiceHistory,
        isLoading: false,
        error: null,
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

    case 'RESET_GAME':
      return initialGameState;

    default:
      return state;
  }
}

// Create context
const GameContext = createContext();

// Context provider
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  
  // Initialize engines
  const storyEngine = new StoryEngine();
  const saveSystem = new SaveSystem(storyEngine);

  // Action helpers
  const actions = {
    loadAdventure: (adventure) => {
      try {
        storyEngine.loadAdventure(adventure);
        dispatch({ type: 'LOAD_ADVENTURE', payload: adventure });
        const scene = storyEngine.getCurrentScene();
        if (scene) {
          dispatch({ type: 'SET_SCENE', payload: scene });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load adventure' });
      }
    },

    makeChoice: (choiceId) => {
      try {
        console.log('Making choice:', choiceId, 'from scene:', state.currentScene?.id);
        
        // Get current scene ID BEFORE making the choice
        const currentSceneId = state.currentScene?.id;
        
        // Make the choice in the story engine
        const newScene = storyEngine.makeChoice(choiceId);
        
        console.log('Choice result - new scene:', newScene?.id);
        
        if (newScene) {
          // Update to new scene
          dispatch({ type: 'SET_SCENE', payload: newScene });
          
          // Record the choice with the previous scene ID
          if (currentSceneId) {
            dispatch({ 
              type: 'RECORD_CHOICE', 
              payload: { sceneId: currentSceneId, choiceId } 
            });
          }
          
          // Update stats and flags from story engine
          const statsManager = storyEngine.getStatsManager();
          const currentStats = statsManager.getAllStats();
          const currentFlags = statsManager.getAllFlags();
          
          // Dispatch stat updates
          Object.entries(currentStats).forEach(([key, value]) => {
            if (state.stats[key] !== value) {
              dispatch({ type: 'UPDATE_STAT', payload: { key, value } });
            }
          });
          
          // Dispatch flag updates  
          Object.entries(currentFlags).forEach(([key, value]) => {
            if (state.flags[key] !== value) {
              dispatch({ type: 'SET_FLAG', payload: { key, value } });
            }
          });
          
        } else {
          console.error('No new scene returned from makeChoice');
        }
      } catch (error) {
        console.error('makeChoice error:', error);
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to make choice' });
      }
    },

    saveGame: async (name) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await saveSystem.saveGame(name);
        dispatch({ type: 'SET_LOADING', payload: false });
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

    resetGame: () => {
      dispatch({ type: 'RESET_GAME' });
    },
  };

  const value = { state, dispatch, storyEngine, saveSystem, actions };

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