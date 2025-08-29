  // useGameState.js - Enhanced with Phase 3 advanced features
import React, { useState, useEffect, useCallback } from "https://esm.sh/react@18";
import { useGameContext } from '../contexts/GameContext.js';

export function useGameState() {
  const { 
    state, 
    actions, 
    storyEngine, 
    saveSystem, 
    crossGameSaveSystem, 
    exportableDataManager 
  } = useGameContext();
  
  const [saves, setSaves] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  // Expose explicit available choices to avoid subtle re-evaluation ordering
  const [availableChoices, setAvailableChoices] = useState([]);

  // Load saves list on mount
  useEffect(() => {
    loadSavesList();
  }, []);

  // Helper to fetch analytics for a specific save
  const getSaveAnalytics = async (saveId) => {
    try {
      const result = await saveSystem.getSaveAnalytics(saveId);
      return result;
    } catch (error) {
      console.error('Failed to get save analytics:', error);
      throw error;
    }
  };

  // Helper to load saves list
  const loadSavesList = async () => {
    try {
      const savesList = await saveSystem.listSaves();
      setSaves(savesList);
    } catch (error) {
      console.error('Failed to load saves list:', error);
    }
  };

  // Generate real-time analytics
  const generateAnalytics = useCallback(() => {
    if (!state.adventure || !storyEngine) return null;

    const totalScenes = state.adventure.scenes?.length || 0;
    const visitedScenes = state.visitedScenes.length;
    const totalChoices = state.choiceHistory.length;
    const secretsFound = state.secretsDiscovered?.length || 0;
    const achievementsUnlocked = state.achievements?.length || 0;
    
    const completionPercentage = totalScenes > 0 ? Math.round((visitedScenes / totalScenes) * 100) : 0;
    
    // Calculate choice frequency by scene
    const choiceFrequency = {};
    state.choiceHistory.forEach(choice => {
      choiceFrequency[choice.sceneId] = (choiceFrequency[choice.sceneId] || 0) + 1;
    });
    
    const mostVisitedScenes = Object.entries(choiceFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([sceneId, count]) => ({ sceneId, count }));
    
    const averageChoicesPerScene = visitedScenes > 0 ? totalChoices / visitedScenes : 0;
    
    // Estimate play time based on choice intervals
    let estimatedPlayTime = 0;
    if (state.choiceHistory.length > 1) {
      const timeSpans = [];
      for (let i = 1; i < state.choiceHistory.length; i++) {
        const timeDiff = state.choiceHistory[i].timestamp - state.choiceHistory[i-1].timestamp;
        if (timeDiff < 300000) { // Less than 5 minutes between choices
          timeSpans.push(timeDiff);
        }
      }
      if (timeSpans.length > 0) {
        estimatedPlayTime = timeSpans.reduce((sum, time) => sum + time, 0);
      }
    }
    
    return {
      totalChoicesMade: totalChoices,
      uniqueScenesVisited: visitedScenes,
      secretsFound: secretsFound,
      achievementsUnlocked: achievementsUnlocked,
      completionPercentage: completionPercentage,
      averageChoicesPerScene: Math.round(averageChoicesPerScene * 100) / 100,
      mostVisitedScenes: mostVisitedScenes,
      estimatedPlayTime: Math.round(estimatedPlayTime / 60000), // Convert to minutes
      progressionRate: totalChoices > 0 ? visitedScenes / totalChoices : 0,
      totalScenes: totalScenes
    };
  }, [state.adventure, state.visitedScenes, state.choiceHistory, state.secretsDiscovered, state.achievements]);

  // Update analytics when relevant state changes
  useEffect(() => {
    setAnalytics(generateAnalytics());
  }, [generateAnalytics]);

  // Build a compatibility-friendly gameState object expected by UI components
  const gameState = {
    // Core state
    adventure: state.adventure,
    currentScene: state.currentScene,
  availableChoices: availableChoices,
    // Convert stats object to array of stat objects for UI components
    visibleStats: Array.isArray(state.stats)
      ? state.stats
      : Object.keys(state.stats || {}).map(key => ({ id: key, name: key, value: state.stats[key] })),
    visitedCount: state.visitedScenes?.length || 0,
    sceneCount: state.adventure?.scenes?.length || 0,
    progressPercent: state.adventure?.scenes?.length > 0 ? Math.round((state.visitedScenes.length / state.adventure.scenes.length) * 100) : 0,
    // Flags
    canSave: !!saveSystem,
    canLoad: !!saveSystem,
    canQuickSave: !!saveSystem,
    // Misc
    error: state.error,
    isLoading: state.isLoading,
    canPlay: !!state.currentScene,
    availableSaves: saves
  };

  // Keep available choices in sync with story engine and game state
  useEffect(() => {
    try {
      const choices = storyEngine?.getCurrentChoices?.() || [];
      setAvailableChoices(choices);
      if (typeof window !== 'undefined') {
        // Helpful debug info during playtesting (use log so it's visible by default)
        // eslint-disable-next-line no-console
        console.log('useGameState: availableChoices updated', choices.length, choices.map(c => c.id));
        if (storyEngine?.debugState) {
          // eslint-disable-next-line no-console
          console.log('useGameState: storyEngine.debugState()', storyEngine.debugState());
        }
      }
      // Fallback: sometimes the engine instance may not expose current choices promptly
      // If choices empty but there's a scene in React state, evaluate choices directly
      if ((choices == null || choices.length === 0) && state.currentScene && storyEngine?.getChoiceEvaluator) {
        try {
          const evaluator = storyEngine.getChoiceEvaluator();
          const discovered = Array.from(storyEngine.getSecretChoicesAvailable ? storyEngine.getSecretChoicesAvailable() : []);
          const evalResults = evaluator.evaluateChoices(state.currentScene.choices || [], discovered) || [];
          const mapped = evalResults.map(r => ({ ...r.choice, evaluation: r.evaluation }));
          setAvailableChoices(mapped);
          // eslint-disable-next-line no-console
          console.log('useGameState: fallback evaluated choices from state.currentScene', mapped.length, mapped.map(c => c.id));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('useGameState: fallback evaluation failed', e);
        }
      }
    } catch (e) {
      console.warn('useGameState: failed to read choices from storyEngine', e);
      setAvailableChoices([]);
    }
  }, [state.adventure, state.currentScene, state.visitedScenes, state.choiceHistory]);

  return {
    // Provide the compatibility gameState
    gameState,
    saves,
    analytics,

    // Booleans used by UI
    isGameLoaded: !!state.adventure,
    isPlaying: !!state.currentScene,
    hasError: !!state.error,
    isLoading: !!state.isLoading,

    // Actions and helpers
    loadSavesList,
    generateAnalytics,
    loadAdventure: actions.loadAdventure,
    resetGame: actions.resetGame,
    saveGame: async (name) => {
      const fn = actions.saveGame || (n => saveSystem && saveSystem.saveGame(n));
      const res = await fn(name);
      // Refresh saves list so UI updates immediately
      await loadSavesList();
      return res;
    },
    loadGame: actions.loadGame || (id => saveSystem && saveSystem.loadGame(id)),
    deleteSave: async (id) => {
      const res = await (saveSystem && saveSystem.deleteSave(id));
      await loadSavesList();
      return res;
    },
    quickSave: async () => {
      const res = await (saveSystem && saveSystem.quickSave());
      await loadSavesList();
      return res;
    },
    exportCrossGameSave: (id, format) => saveSystem && saveSystem.exportSaveForCrossGame(id, format),
    importCrossGameSave: async (data, opts) => {
      const res = await (saveSystem && saveSystem.importCrossGameSave(data, opts));
      // If import created or changed saves, refresh list
      if (res && res.success) {
        await loadSavesList();
      }
      return res;
    },
    getSaveAnalytics: getSaveAnalytics,
    makeChoice: actions.makeChoice
  };
}
