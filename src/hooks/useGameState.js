 
import { useGameContext } from '../contexts/GameContext.js';

const { useState, useEffect } = React;

export function useGameState() {
  const { state, actions, storyEngine, saveSystem } = useGameContext();
  const [saves, setSaves] = useState([]);

  // Load saves list on mount
  useEffect(() => {
    loadSavesList();
  }, []);

  // Helper to load saves list
  const loadSavesList = async () => {
    try {
      const savesList = await saveSystem.listSaves();
      setSaves(savesList);
    } catch (error) {
      console.error('Failed to load saves list:', error);
    }
  };

  // Enhanced actions with save list updates
  const enhancedActions = {
    ...actions,
    
    saveGame: async (name) => {
      await actions.saveGame(name);
      await loadSavesList(); // Refresh saves list
    },

    loadGame: async (saveId) => {
      await actions.loadGame(saveId);
    },

    deleteSave: async (saveId) => {
      try {
        await saveSystem.deleteSave(saveId);
        await loadSavesList(); // Refresh saves list
      } catch (error) {
        console.error('Failed to delete save:', error);
      }
    },

    quickSave: async () => {
      try {
        await saveSystem.quickSave();
        await loadSavesList(); // Refresh saves list
      } catch (error) {
        console.error('Failed to quick save:', error);
      }
    },
  };

  // Computed values
  const gameState = {
    ...state,
    
    // Current choices available
    availableChoices: state.currentScene 
      ? storyEngine.getCurrentChoices()
      : [],
    
    // Visible stats for UI
    visibleStats: state.adventure 
      ? storyEngine.getStatsManager().getVisibleStats()
      : [],
    
    // Game progress info
    sceneCount: state.adventure?.scenes.length || 0,
    visitedCount: state.visitedScenes.length,
    progressPercent: state.adventure 
      ? Math.round((state.visitedScenes.length / state.adventure.scenes.length) * 100)
      : 0,
    
    // Can save/load
    canSave: !!state.currentScene && !state.isLoading,
    canLoad: saves.length > 0 && !state.isLoading,
  };

  return {
    // State
    gameState,
    saves,
    
    // Actions
    ...enhancedActions,
    
    // Utilities
    isGameLoaded: !!state.adventure,
    isPlaying: !!state.currentScene,
    hasError: !!state.error,
    isLoading: state.isLoading,
  };
}