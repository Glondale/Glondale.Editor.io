// LazyAdventureLoader.js - React component for lazy loading adventures
import { adventureLazyLoader } from '../../utils/AdventureLazyLoader.js';
import { logInfo, logError } from '../../utils/errorLogger.js';

import React, { useState, useEffect, useCallback, memo, createElement } from "https://esm.sh/react@18";

/**
 * Lazy Adventure Loader Component
 * 
 * Features:
 * - Progressive loading with loading states
 * - Error boundaries and retry mechanisms
 * - Memory-efficient scene loading
 * - Preloading of connected scenes
 * - Loading progress indicators
 */
export const LazyAdventureLoader = memo(function LazyAdventureLoader({
  adventureId,
  onAdventureLoaded,
  onSceneLoaded,
  onLoadingStateChange,
  fallbackComponent = null,
  errorComponent = null,
  loadingComponent = null,
  retryAttempts = 3,
  preloadConnectedScenes = true,
  children
}) {
  const [loadingState, setLoadingState] = useState({
    isLoadingMetadata: false,
    isLoadingScene: false,
    loadedAdventure: null,
    currentScene: null,
    error: null,
    progress: 0,
    retryCount: 0
  });

  // Update parent component about loading state changes
  useEffect(() => {
    if (onLoadingStateChange) {
      onLoadingStateChange(loadingState);
    }
  }, [loadingState, onLoadingStateChange]);

  // Load adventure metadata when component mounts
  useEffect(() => {
    if (adventureId && !loadingState.loadedAdventure && !loadingState.isLoadingMetadata) {
      loadAdventureMetadata();
    }
  }, [adventureId]);

  const loadAdventureMetadata = useCallback(async () => {
    if (!adventureId) return;

    setLoadingState(prev => ({
      ...prev,
      isLoadingMetadata: true,
      error: null,
      progress: 10
    }));

    try {
      logInfo('Loading adventure metadata', { adventureId });
      
      const metadata = await adventureLazyLoader.loadAdventureMetadata(adventureId);
      
      setLoadingState(prev => ({
        ...prev,
        isLoadingMetadata: false,
        loadedAdventure: metadata,
        progress: 100,
        retryCount: 0
      }));

      if (onAdventureLoaded) {
        onAdventureLoaded(metadata);
      }

      // Start loading the initial scene if specified
      if (metadata.startSceneId) {
        loadScene(metadata.startSceneId);
      }

    } catch (error) {
      logError('Failed to load adventure metadata', { 
        adventureId, 
        error: error.message,
        retryCount: loadingState.retryCount 
      });

      setLoadingState(prev => ({
        ...prev,
        isLoadingMetadata: false,
        error: error.message,
        progress: 0
      }));
    }
  }, [adventureId, onAdventureLoaded]);

  const loadScene = useCallback(async (sceneId, isRetry = false) => {
    if (!adventureId || !sceneId) return;

    setLoadingState(prev => ({
      ...prev,
      isLoadingScene: true,
      error: isRetry ? null : prev.error,
      progress: prev.loadedAdventure ? 50 : prev.progress
    }));

    try {
      logInfo('Loading scene', { adventureId, sceneId });
      
      const scene = await adventureLazyLoader.loadScene(adventureId, sceneId);
      
      setLoadingState(prev => ({
        ...prev,
        isLoadingScene: false,
        currentScene: scene,
        progress: 100,
        retryCount: 0
      }));

      if (onSceneLoaded) {
        onSceneLoaded(scene);
      }

      // Preload connected scenes in background
      if (preloadConnectedScenes && scene) {
        adventureLazyLoader.preloadConnectedScenes(adventureId, sceneId);
      }

    } catch (error) {
      logError('Failed to load scene', { 
        adventureId, 
        sceneId, 
        error: error.message,
        retryCount: loadingState.retryCount 
      });

      setLoadingState(prev => ({
        ...prev,
        isLoadingScene: false,
        error: error.message,
        progress: prev.loadedAdventure ? prev.progress : 0
      }));
    }
  }, [adventureId, onSceneLoaded, preloadConnectedScenes]);

  const retryLoading = useCallback(async () => {
    const { retryCount, loadedAdventure } = loadingState;
    
    if (retryCount >= retryAttempts) {
      logError('Max retry attempts reached', { adventureId, retryCount });
      return;
    }

    setLoadingState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null
    }));

    if (!loadedAdventure) {
      // Retry loading adventure metadata
      await loadAdventureMetadata();
    } else if (loadedAdventure.startSceneId) {
      // Retry loading initial scene
      await loadScene(loadedAdventure.startSceneId, true);
    }
  }, [loadingState, retryAttempts, loadAdventureMetadata, loadScene]);

  const clearCache = useCallback(() => {
    if (adventureId) {
      adventureLazyLoader.clearCache(adventureId);
      logInfo('Adventure cache cleared', { adventureId });
    }
  }, [adventureId]);

  // Expose loading methods to children via render prop pattern
  const loaderAPI = {
    loadScene,
    retryLoading,
    clearCache,
    loadingState,
    stats: adventureLazyLoader.getStats()
  };

  // Error state
  if (loadingState.error) {
    if (errorComponent) {
      return createElement(errorComponent, {
        error: loadingState.error,
        onRetry: loadingState.retryCount < retryAttempts ? retryLoading : null,
        retryCount: loadingState.retryCount,
        maxRetries: retryAttempts
      });
    }

    return createElement('div', {
      className: 'lazy-adventure-error p-6 bg-red-50 border border-red-200 rounded-lg'
    }, [
      createElement('div', {
        key: 'error-content',
        className: 'text-center'
      }, [
        createElement('div', {
          key: 'error-icon',
          className: 'text-4xl mb-4'
        }, '⚠️'),
        createElement('h3', {
          key: 'error-title',
          className: 'text-lg font-medium text-red-800 mb-2'
        }, 'Failed to Load Adventure'),
        createElement('p', {
          key: 'error-message',
          className: 'text-sm text-red-600 mb-4'
        }, loadingState.error),
        loadingState.retryCount < retryAttempts && createElement('button', {
          key: 'retry-button',
          onClick: retryLoading,
          className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
        }, `Retry (${loadingState.retryCount}/${retryAttempts})`)
      ])
    ]);
  }

  // Loading state
  if (loadingState.isLoadingMetadata || loadingState.isLoadingScene) {
    if (loadingComponent) {
      return createElement(loadingComponent, {
        progress: loadingState.progress,
        isLoadingMetadata: loadingState.isLoadingMetadata,
        isLoadingScene: loadingState.isLoadingScene
      });
    }

    return createElement('div', {
      className: 'lazy-adventure-loading p-6 bg-gray-50 border border-gray-200 rounded-lg'
    }, [
      createElement('div', {
        key: 'loading-content',
        className: 'text-center'
      }, [
        createElement('div', {
          key: 'loading-spinner',
          className: 'inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4'
        }),
        createElement('h3', {
          key: 'loading-title',
          className: 'text-lg font-medium text-gray-800 mb-2'
        }, loadingState.isLoadingMetadata ? 'Loading Adventure...' : 'Loading Scene...'),
        createElement('div', {
          key: 'progress-bar',
          className: 'w-full bg-gray-200 rounded-full h-2 mb-2'
        }, createElement('div', {
          className: 'bg-blue-600 h-2 rounded-full transition-all duration-300',
          style: { width: `${loadingState.progress}%` }
        })),
        createElement('p', {
          key: 'progress-text',
          className: 'text-sm text-gray-600'
        }, `${loadingState.progress}% complete`)
      ])
    ]);
  }

  // No adventure loaded yet
  if (!loadingState.loadedAdventure) {
    if (fallbackComponent) {
      return createElement(fallbackComponent);
    }

    return createElement('div', {
      className: 'lazy-adventure-empty p-6 bg-gray-50 border border-gray-200 rounded-lg text-center'
    }, [
      createElement('div', {
        key: 'empty-icon',
        className: 'text-4xl mb-4'
      }, '📚'),
      createElement('h3', {
        key: 'empty-title',
        className: 'text-lg font-medium text-gray-800 mb-2'
      }, 'No Adventure Loaded'),
      createElement('p', {
        key: 'empty-message',
        className: 'text-sm text-gray-600'
      }, 'Select an adventure to begin')
    ]);
  }

  // Adventure loaded - render children with loader API
  if (typeof children === 'function') {
    return children(loaderAPI);
  }

  return children || createElement('div', {
    className: 'lazy-adventure-ready'
  }, [
    createElement('div', {
      key: 'ready-message',
      className: 'p-4 bg-green-50 border border-green-200 rounded-lg text-center'
    }, [
      createElement('div', {
        key: 'ready-icon',
        className: 'text-2xl mb-2'
      }, '✅'),
      createElement('h3', {
        key: 'ready-title',
        className: 'text-lg font-medium text-green-800'
      }, 'Adventure Ready'),
      createElement('p', {
        key: 'ready-subtitle',
        className: 'text-sm text-green-600'
      }, loadingState.loadedAdventure.title)
    ])
  ]);
});

// Loading state component
export const AdventureLoadingIndicator = memo(function AdventureLoadingIndicator({
  progress = 0,
  isLoadingMetadata = false,
  isLoadingScene = false,
  compact = false
}) {
  const message = isLoadingMetadata ? 'Loading adventure...' : 
                  isLoadingScene ? 'Loading scene...' : 
                  'Loading...';

  if (compact) {
    return createElement('div', {
      className: 'flex items-center space-x-2'
    }, [
      createElement('div', {
        key: 'spinner',
        className: 'w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin'
      }),
      createElement('span', {
        key: 'message',
        className: 'text-sm text-gray-600'
      }, message)
    ]);
  }

  return createElement('div', {
    className: 'text-center p-6'
  }, [
    createElement('div', {
      key: 'spinner',
      className: 'inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4'
    }),
    createElement('h3', {
      key: 'message',
      className: 'text-lg font-medium text-gray-800 mb-2'
    }, message),
    createElement('div', {
      key: 'progress-bar',
      className: 'w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2'
    }, createElement('div', {
      className: 'bg-blue-600 h-2 rounded-full transition-all duration-300',
      style: { width: `${Math.max(10, progress)}%` }
    }))
  ]);
});

// Error state component
export const AdventureErrorIndicator = memo(function AdventureErrorIndicator({
  error,
  onRetry,
  retryCount = 0,
  maxRetries = 3
}) {
  return createElement('div', {
    className: 'text-center p-6 bg-red-50 border border-red-200 rounded-lg'
  }, [
    createElement('div', {
      key: 'error-icon',
      className: 'text-4xl mb-4'
    }, '⚠️'),
    createElement('h3', {
      key: 'error-title',
      className: 'text-lg font-medium text-red-800 mb-2'
    }, 'Loading Failed'),
    createElement('p', {
      key: 'error-message',
      className: 'text-sm text-red-600 mb-4 max-w-md mx-auto'
    }, error || 'Failed to load adventure content'),
    onRetry && createElement('button', {
      key: 'retry-button',
      onClick: onRetry,
      className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors',
      disabled: retryCount >= maxRetries
    }, retryCount >= maxRetries ? 'Max retries reached' : `Retry (${retryCount}/${maxRetries})`)
  ]);
});

export default LazyAdventureLoader;