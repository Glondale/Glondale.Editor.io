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

  return {
    saves,
    analytics,
    loadSavesList,
    generateAnalytics
  };
}
