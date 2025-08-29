// useLazyAdventure.js - Hook for integrating lazy loading with game context
import { adventureLazyLoader } from '../utils/AdventureLazyLoader.js';
import { useGame } from '../contexts/GameContext.js';
import { logInfo, logWarning, logError } from '../utils/errorLogger.js';

import { useState, useEffect, useCallback, useMemo } from "https://esm.sh/react@18";

/**
 * Custom hook for lazy adventure loading
 * 
 * Features:
 * - Integrates with GameContext
 * - Automatic scene preloading
 * - Memory management
 * - Loading state management
 * - Error handling and recovery
 */
export function useLazyAdventure(options = {}) {
  const { state, actions } = useGame();
  const {
    preloadConnectedScenes = true,
    maxCacheSize = 50,
    preloadDistance = 2,
    autoCleanup = true
  } = options;

  const [lazyState, setLazyState] = useState({
    isLazyLoading: false,
    loadingProgress: 0,
    cachedScenes: new Set(),
    preloadedScenes: new Set(),
    loadingError: null,
    lastLoadedScene: null
  });

  // Configure lazy loader based on options
  useEffect(() => {
    if (adventureLazyLoader) {
      adventureLazyLoader.maxCachedScenes = maxCacheSize;
      adventureLazyLoader.preloadDistance = preloadDistance;
    }
  }, [maxCacheSize, preloadDistance]);

  // Auto-cleanup on unmount or adventure change
  useEffect(() => {
    return () => {
      if (autoCleanup && state.adventure?.id) {
        adventureLazyLoader.clearCache(state.adventure.id);
      }
    };
  }, [state.adventure?.id, autoCleanup]);

  // Enhanced adventure loader with lazy loading
  const loadAdventureLazy = useCallback(async (adventureId) => {
    if (!adventureId) return;

    setLazyState(prev => ({
      ...prev,
      isLazyLoading: true,
      loadingProgress: 0,
      loadingError: null
    }));

    try {
      logInfo('Starting lazy adventure load', { adventureId });

      // Load adventure metadata first (lightweight)
      setLazyState(prev => ({ ...prev, loadingProgress: 20 }));
      const adventureMetadata = await adventureLazyLoader.loadAdventureMetadata(adventureId);
      
      // Load the adventure using the existing system with metadata
      actions.loadAdventure(adventureMetadata);
      setLazyState(prev => ({ ...prev, loadingProgress: 60 }));

      // Load the starting scene
      if (adventureMetadata.startSceneId) {
        const startScene = await adventureLazyLoader.loadScene(adventureId, adventureMetadata.startSceneId);
        if (startScene) {
          // Update the scene in the existing system
          actions.setScene(startScene);
          setLazyState(prev => ({ 
            ...prev, 
            loadingProgress: 100,
            cachedScenes: new Set([adventureMetadata.startSceneId]),
            lastLoadedScene: adventureMetadata.startSceneId
          }));
        }
      }

      setLazyState(prev => ({
        ...prev,
        isLazyLoading: false,
        loadingProgress: 100
      }));

    } catch (error) {
      logError('Lazy adventure loading failed', { adventureId, error: error.message });
      setLazyState(prev => ({
        ...prev,
        isLazyLoading: false,
        loadingError: error.message,
        loadingProgress: 0
      }));
      throw error;
    }
  }, [actions]);

  // Enhanced scene loader with caching
  const loadSceneLazy = useCallback(async (sceneId) => {
    if (!state.adventure?.id || !sceneId) return null;

    try {
      setLazyState(prev => ({ ...prev, isLazyLoading: true }));

      const scene = await adventureLazyLoader.loadScene(state.adventure.id, sceneId);
      
      if (scene) {
        // Update cached scenes
        setLazyState(prev => ({
          ...prev,
          cachedScenes: new Set([...prev.cachedScenes, sceneId]),
          lastLoadedScene: sceneId,
          isLazyLoading: false
        }));

        // Preload connected scenes if enabled
        if (preloadConnectedScenes) {
          adventureLazyLoader.preloadConnectedScenes(state.adventure.id, sceneId);
        }

        return scene;
      }
    } catch (error) {
      logError('Scene loading failed', { sceneId, error: error.message });
      setLazyState(prev => ({
        ...prev,
        isLazyLoading: false,
        loadingError: error.message
      }));
      throw error;
    }

    return null;
  }, [state.adventure?.id, preloadConnectedScenes]);

  // Enhanced choice making with lazy scene loading
  const makeChoiceLazy = useCallback(async (choiceId) => {
    if (!state.currentScene || !state.adventure?.id) return;

    try {
      const choice = state.currentScene.choices?.find(c => c.id === choiceId);
      if (!choice || !choice.targetSceneId) {
        // Fallback to normal choice making
        return actions.makeChoice(choiceId);
      }

      // Check if target scene is already cached
      if (lazyState.cachedScenes.has(choice.targetSceneId)) {
        // Scene is cached, use normal flow
        return actions.makeChoice(choiceId);
      }

      // Scene not cached, load it lazily
      setLazyState(prev => ({ ...prev, isLazyLoading: true }));
      
      const targetScene = await loadSceneLazy(choice.targetSceneId);
      
      if (targetScene) {
        // Now make the choice with the scene loaded
        const result = actions.makeChoice(choiceId);
        setLazyState(prev => ({ ...prev, isLazyLoading: false }));
        return result;
      } else {
        // Fallback to normal choice making
        setLazyState(prev => ({ ...prev, isLazyLoading: false }));
        return actions.makeChoice(choiceId);
      }
    } catch (error) {
      logError('Lazy choice making failed', { choiceId, error: error.message });
      setLazyState(prev => ({
        ...prev,
        isLazyLoading: false,
        loadingError: error.message
      }));
      // Fallback to normal choice making
      return actions.makeChoice(choiceId);
    }
  }, [state.currentScene, state.adventure?.id, lazyState.cachedScenes, actions, loadSceneLazy]);

  // Batch load multiple scenes
  const loadScenesBatch = useCallback(async (sceneIds) => {
    if (!state.adventure?.id || !sceneIds.length) return new Map();

    try {
      setLazyState(prev => ({ ...prev, isLazyLoading: true }));
      
      const scenes = await adventureLazyLoader.loadScenes(state.adventure.id, sceneIds);
      
      setLazyState(prev => ({
        ...prev,
        cachedScenes: new Set([...prev.cachedScenes, ...sceneIds]),
        isLazyLoading: false
      }));

      return scenes;
    } catch (error) {
      logError('Batch scene loading failed', { sceneIds, error: error.message });
      setLazyState(prev => ({
        ...prev,
        isLazyLoading: false,
        loadingError: error.message
      }));
      throw error;
    }
  }, [state.adventure?.id]);

  // Preload scenes around current scene
  const preloadNearbyScenes = useCallback(async () => {
    if (!state.currentScene || !state.adventure?.id || !preloadConnectedScenes) return;

    try {
      const connectedSceneIds = state.currentScene.choices
        ?.map(choice => choice.targetSceneId)
        .filter(Boolean) || [];

      const uncachedScenes = connectedSceneIds.filter(id => !lazyState.cachedScenes.has(id));
      
      if (uncachedScenes.length > 0) {
        adventureLazyLoader.preloadConnectedScenes(state.adventure.id, state.currentScene.id);
        
        setLazyState(prev => ({
          ...prev,
          preloadedScenes: new Set([...prev.preloadedScenes, ...uncachedScenes])
        }));
      }
    } catch (error) {
      logWarning('Scene preloading failed', { error: error.message });
    }
  }, [state.currentScene, state.adventure?.id, lazyState.cachedScenes, preloadConnectedScenes]);

  // Auto-preload when scene changes
  useEffect(() => {
    if (state.currentScene && preloadConnectedScenes) {
      preloadNearbyScenes();
    }
  }, [state.currentScene?.id, preloadConnectedScenes, preloadNearbyScenes]);

  // Clear cache for specific adventure
  const clearAdventureCache = useCallback((adventureId = null) => {
    const targetId = adventureId || state.adventure?.id;
    if (targetId) {
      adventureLazyLoader.clearCache(targetId);
      setLazyState(prev => ({
        ...prev,
        cachedScenes: new Set(),
        preloadedScenes: new Set(),
        loadingError: null
      }));
      logInfo('Adventure cache cleared', { adventureId: targetId });
    }
  }, [state.adventure?.id]);

  // Get loading statistics
  const getLoadingStats = useCallback(() => {
    const loaderStats = adventureLazyLoader.getStats();
    return {
      ...loaderStats,
      cachedScenes: lazyState.cachedScenes.size,
      preloadedScenes: lazyState.preloadedScenes.size,
      memoryUsageKB: Math.round(loaderStats.memoryUsage / 1024)
    };
  }, [lazyState.cachedScenes.size, lazyState.preloadedScenes.size]);

  // Compute loading status
  const isLoading = useMemo(() => {
    return lazyState.isLazyLoading || state.isLoading;
  }, [lazyState.isLazyLoading, state.isLoading]);

  // Return hook interface
  return {
    // Enhanced loading functions
    loadAdventure: loadAdventureLazy,
    loadScene: loadSceneLazy,
    makeChoice: makeChoiceLazy,
    loadScenesBatch,
    preloadNearbyScenes,
    
    // Cache management
    clearAdventureCache,
    getLoadingStats,
    
    // State
    isLoading,
    loadingProgress: lazyState.loadingProgress,
    loadingError: lazyState.loadingError,
    cachedScenesCount: lazyState.cachedScenes.size,
    preloadedScenesCount: lazyState.preloadedScenes.size,
    
    // Compatibility with existing game actions
    ...actions,
    
    // Game state (unchanged)
    state
  };
}

// Hook for monitoring lazy loading performance
export function useLazyLoadingStats() {
  const [stats, setStats] = useState(null);
  
  const refreshStats = useCallback(() => {
    if (adventureLazyLoader) {
      setStats(adventureLazyLoader.getStats());
    }
  }, []);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [refreshStats]);

  return {
    stats,
    refreshStats,
    clearStats: () => setStats(null)
  };
}

export default useLazyAdventure;