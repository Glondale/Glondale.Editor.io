// AdventureLazyLoader.js - Lazy loading system for large adventure files
import { logInfo, logWarning, logError } from './errorLogger.js';

/**
 * Adventure Lazy Loader - Efficiently loads adventure content only when needed
 * 
 * Features:
 * - Dynamic imports for code splitting
 * - Chunk-based scene loading for large adventures
 * - Memory-efficient scene caching with LRU eviction
 * - Progressive loading with loading states
 * - Error recovery and fallback mechanisms
 */
export class AdventureLazyLoader {
  constructor(options = {}) {
    this.maxCachedScenes = options.maxCachedScenes || 50;
    this.maxCachedAdventures = options.maxCachedAdventures || 5;
    this.chunkSize = options.chunkSize || 10; // Scenes per chunk
    this.preloadDistance = options.preloadDistance || 2; // Preload 2 scenes ahead
    
    // Caches with LRU eviction
    this.sceneCache = new Map();
    this.adventureCache = new Map();
    this.chunkCache = new Map();
    this.loadingStates = new Map();
    
    // Access tracking for LRU
    this.sceneAccessOrder = [];
    this.adventureAccessOrder = [];
    
    // Preloading queue
    this.preloadQueue = new Set();
    
    this.stats = {
      scenesLoaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      preloadHits: 0,
      memoryUsage: 0
    };
  }

  /**
   * Load adventure metadata (basic info without scenes)
   */
  async loadAdventureMetadata(adventureId) {
    const cacheKey = `${adventureId}_metadata`;
    
    if (this.adventureCache.has(cacheKey)) {
      this.stats.cacheHits++;
      this._updateAccessOrder(this.adventureAccessOrder, cacheKey);
      return this.adventureCache.get(cacheKey);
    }

    try {
      logInfo('Loading adventure metadata', { adventureId });
      
      // Dynamic import based on adventure ID
      const adventureModule = await this._importAdventure(adventureId);
      const metadata = {
        id: adventureModule.adventure.id,
        title: adventureModule.adventure.title,
        author: adventureModule.adventure.author,
        version: adventureModule.adventure.version,
        description: adventureModule.adventure.description,
        stats: adventureModule.adventure.stats || [],
        flags: adventureModule.adventure.flags || [],
        inventory: adventureModule.adventure.inventory || [],
        achievements: adventureModule.adventure.achievements || [],
        sceneCount: adventureModule.adventure.scenes?.length || 0,
        startSceneId: adventureModule.adventure.startSceneId,
        // Don't include actual scenes in metadata
        scenes: []
      };

      this._cacheAdventure(cacheKey, metadata);
      this.stats.cacheMisses++;
      
      return metadata;
    } catch (error) {
      logError('Failed to load adventure metadata', { adventureId, error: error.message });
      throw new Error(`Failed to load adventure "${adventureId}": ${error.message}`);
    }
  }

  /**
   * Load a specific scene with lazy loading
   */
  async loadScene(adventureId, sceneId) {
    const cacheKey = `${adventureId}_${sceneId}`;
    
    // Check scene cache first
    if (this.sceneCache.has(cacheKey)) {
      this.stats.cacheHits++;
      this._updateAccessOrder(this.sceneAccessOrder, cacheKey);
      const scene = this.sceneCache.get(cacheKey);
      
      // Trigger preloading of connected scenes
      this._schedulePreload(adventureId, scene);
      
      return scene;
    }

    try {
      // Check if scene is being loaded
      if (this.loadingStates.has(cacheKey)) {
        return await this.loadingStates.get(cacheKey);
      }

      // Start loading
      const loadPromise = this._loadSceneFromChunk(adventureId, sceneId);
      this.loadingStates.set(cacheKey, loadPromise);

      const scene = await loadPromise;
      this.loadingStates.delete(cacheKey);

      if (scene) {
        this._cacheScene(cacheKey, scene);
        this.stats.scenesLoaded++;
        
        // Trigger preloading
        this._schedulePreload(adventureId, scene);
      }

      return scene;
    } catch (error) {
      this.loadingStates.delete(cacheKey);
      logError('Failed to load scene', { adventureId, sceneId, error: error.message });
      throw error;
    }
  }

  /**
   * Load multiple scenes efficiently (batch loading)
   */
  async loadScenes(adventureId, sceneIds) {
    const results = new Map();
    const uncachedScenes = [];

    // Check cache first
    for (const sceneId of sceneIds) {
      const cacheKey = `${adventureId}_${sceneId}`;
      if (this.sceneCache.has(cacheKey)) {
        results.set(sceneId, this.sceneCache.get(cacheKey));
        this.stats.cacheHits++;
      } else {
        uncachedScenes.push(sceneId);
      }
    }

    // Load uncached scenes
    if (uncachedScenes.length > 0) {
      const loadPromises = uncachedScenes.map(sceneId => 
        this.loadScene(adventureId, sceneId).then(scene => ({ sceneId, scene }))
      );

      const loadedScenes = await Promise.all(loadPromises);
      for (const { sceneId, scene } of loadedScenes) {
        if (scene) {
          results.set(sceneId, scene);
        }
      }
    }

    return results;
  }

  /**
   * Preload scenes that are likely to be accessed next
   */
  async preloadConnectedScenes(adventureId, currentSceneId) {
    try {
      const currentScene = await this.loadScene(adventureId, currentSceneId);
      if (!currentScene || !currentScene.choices) return;

      const targetScenes = currentScene.choices
        .map(choice => choice.targetSceneId)
        .filter(Boolean)
        .slice(0, this.preloadDistance);

      // Preload in background without blocking
      targetScenes.forEach(sceneId => {
        const cacheKey = `${adventureId}_${sceneId}`;
        if (!this.sceneCache.has(cacheKey) && !this.preloadQueue.has(cacheKey)) {
          this.preloadQueue.add(cacheKey);
          this._preloadSceneAsync(adventureId, sceneId);
        }
      });
    } catch (error) {
      logWarning('Preload failed', { adventureId, currentSceneId, error: error.message });
    }
  }

  /**
   * Clear cache and free memory
   */
  clearCache(adventureId = null) {
    if (adventureId) {
      // Clear specific adventure
      const keysToRemove = [];
      for (const key of this.sceneCache.keys()) {
        if (key.startsWith(`${adventureId}_`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.sceneCache.delete(key));
      
      this.adventureCache.delete(`${adventureId}_metadata`);
      this._cleanupAccessOrder();
    } else {
      // Clear all caches
      this.sceneCache.clear();
      this.adventureCache.clear();
      this.chunkCache.clear();
      this.sceneAccessOrder = [];
      this.adventureAccessOrder = [];
    }
    
    this._updateMemoryUsage();
    logInfo('Cache cleared', { adventureId });
  }

  /**
   * Get loader statistics
   */
  getStats() {
    return {
      ...this.stats,
      sceneCacheSize: this.sceneCache.size,
      adventureCacheSize: this.adventureCache.size,
      chunkCacheSize: this.chunkCache.size,
      preloadQueueSize: this.preloadQueue.size
    };
  }

  // Private methods

  async _importAdventure(adventureId) {
    try {
      // Try to dynamically import the adventure
      // This assumes adventures are stored as modules in a specific location
      const adventureModule = await import(`../adventures/${adventureId}.js`);
      return adventureModule;
    } catch (importError) {
      // Fallback: try to load from a generic adventures registry
      try {
        const { getAdventure } = await import('../adventures/index.js');
        const adventure = await getAdventure(adventureId);
        return { adventure };
      } catch (fallbackError) {
        logError('Adventure import failed', { 
          adventureId, 
          importError: importError.message, 
          fallbackError: fallbackError.message 
        });
        throw new Error(`Adventure "${adventureId}" not found`);
      }
    }
  }

  async _loadSceneFromChunk(adventureId, sceneId) {
    try {
      // First, try to get the scene from a cached chunk
      const chunkKey = `${adventureId}_chunk`;
      let adventureData = this.chunkCache.get(chunkKey);
      
      if (!adventureData) {
        // Load the full adventure data if not cached
        const adventureModule = await this._importAdventure(adventureId);
        adventureData = adventureModule.adventure;
        this.chunkCache.set(chunkKey, adventureData);
      }

      // Find and return the specific scene
      const scene = adventureData.scenes?.find(s => s.id === sceneId);
      if (!scene) {
        throw new Error(`Scene "${sceneId}" not found in adventure "${adventureId}"`);
      }

      return scene;
    } catch (error) {
      logError('Failed to load scene from chunk', { adventureId, sceneId, error: error.message });
      throw error;
    }
  }

  _schedulePreload(adventureId, scene) {
    if (!scene.choices) return;
    
    // Schedule preloading of target scenes
    scene.choices.forEach(choice => {
      if (choice.targetSceneId) {
        const cacheKey = `${adventureId}_${choice.targetSceneId}`;
        if (!this.sceneCache.has(cacheKey)) {
          this.preloadQueue.add(cacheKey);
          // Don't await - run in background
          setTimeout(() => this._preloadSceneAsync(adventureId, choice.targetSceneId), 100);
        }
      }
    });
  }

  async _preloadSceneAsync(adventureId, sceneId) {
    try {
      const cacheKey = `${adventureId}_${sceneId}`;
      this.preloadQueue.delete(cacheKey);
      
      const scene = await this._loadSceneFromChunk(adventureId, sceneId);
      if (scene) {
        this._cacheScene(cacheKey, scene);
        this.stats.preloadHits++;
      }
    } catch (error) {
      // Preload failures are non-critical
      logWarning('Preload failed', { adventureId, sceneId, error: error.message });
    }
  }

  _cacheScene(key, scene) {
    if (this.sceneCache.size >= this.maxCachedScenes) {
      this._evictLRUScene();
    }
    
    this.sceneCache.set(key, scene);
    this._updateAccessOrder(this.sceneAccessOrder, key);
    this._updateMemoryUsage();
  }

  _cacheAdventure(key, adventure) {
    if (this.adventureCache.size >= this.maxCachedAdventures) {
      this._evictLRUAdventure();
    }
    
    this.adventureCache.set(key, adventure);
    this._updateAccessOrder(this.adventureAccessOrder, key);
  }

  _evictLRUScene() {
    if (this.sceneAccessOrder.length > 0) {
      const lruKey = this.sceneAccessOrder.shift();
      this.sceneCache.delete(lruKey);
      this._updateMemoryUsage();
    }
  }

  _evictLRUAdventure() {
    if (this.adventureAccessOrder.length > 0) {
      const lruKey = this.adventureAccessOrder.shift();
      this.adventureCache.delete(lruKey);
    }
  }

  _updateAccessOrder(accessOrder, key) {
    // Remove key if it exists and add to end
    const index = accessOrder.indexOf(key);
    if (index !== -1) {
      accessOrder.splice(index, 1);
    }
    accessOrder.push(key);
  }

  _cleanupAccessOrder() {
    this.sceneAccessOrder = this.sceneAccessOrder.filter(key => this.sceneCache.has(key));
    this.adventureAccessOrder = this.adventureAccessOrder.filter(key => this.adventureCache.has(key));
  }

  _updateMemoryUsage() {
    // Rough estimate of memory usage
    let usage = 0;
    for (const scene of this.sceneCache.values()) {
      usage += JSON.stringify(scene).length;
    }
    for (const adventure of this.adventureCache.values()) {
      usage += JSON.stringify(adventure).length;
    }
    this.stats.memoryUsage = usage;
  }
}

// Singleton instance for global use
export const adventureLazyLoader = new AdventureLazyLoader({
  maxCachedScenes: 100,
  maxCachedAdventures: 10,
  chunkSize: 20,
  preloadDistance: 3
});

export default AdventureLazyLoader;