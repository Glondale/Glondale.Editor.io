// adventures/index.js - Adventure registry for lazy loading
import { logWarning, logError } from '../utils/errorLogger.js';

/**
 * Adventure Registry for Dynamic Loading
 * 
 * This registry supports lazy loading of adventure content by providing
 * dynamic imports and fallback mechanisms for adventure files.
 */

// Registry of available adventures
const ADVENTURE_REGISTRY = new Map();

// Initialize with default adventures
const DEFAULT_ADVENTURES = [
  {
    id: 'sample_adventure',
    title: 'Sample Adventure',
    description: 'A basic adventure for testing and demonstration',
    path: './sample_adventure.js',
    size: 'small'
  }
];

// Register default adventures
DEFAULT_ADVENTURES.forEach(adventure => {
  ADVENTURE_REGISTRY.set(adventure.id, adventure);
});

/**
 * Register a new adventure in the registry
 */
export function registerAdventure(adventureInfo) {
  const { id, title, description, path, size = 'medium' } = adventureInfo;
  
  if (!id || !title || !path) {
    logError('Invalid adventure registration', { adventureInfo });
    throw new Error('Adventure registration requires id, title, and path');
  }
  
  ADVENTURE_REGISTRY.set(id, {
    id,
    title,
    description: description || '',
    path,
    size,
    registeredAt: Date.now()
  });
  
  console.log(`Adventure "${title}" registered with ID: ${id}`);
}

/**
 * Get list of registered adventures
 */
export function getAvailableAdventures() {
  return Array.from(ADVENTURE_REGISTRY.values());
}

/**
 * Get adventure metadata by ID
 */
export function getAdventureInfo(adventureId) {
  return ADVENTURE_REGISTRY.get(adventureId);
}

/**
 * Dynamically load adventure by ID
 */
export async function getAdventure(adventureId) {
  const adventureInfo = ADVENTURE_REGISTRY.get(adventureId);
  
  if (!adventureInfo) {
    logError('Adventure not found in registry', { adventureId, available: Array.from(ADVENTURE_REGISTRY.keys()) });
    throw new Error(`Adventure "${adventureId}" not found in registry`);
  }

  try {
    // Try dynamic import
    const adventureModule = await import(adventureInfo.path);
    
    if (!adventureModule.adventure) {
      throw new Error(`Adventure module "${adventureId}" does not export an 'adventure' object`);
    }
    
    return adventureModule.adventure;
  } catch (importError) {
    logError('Failed to import adventure', { adventureId, path: adventureInfo.path, error: importError.message });
    
    // Fallback to inline adventure creation
    try {
      return await createFallbackAdventure(adventureId, adventureInfo);
    } catch (fallbackError) {
      logError('Fallback adventure creation failed', { adventureId, error: fallbackError.message });
      throw new Error(`Failed to load adventure "${adventureId}": ${importError.message}`);
    }
  }
}

/**
 * Create a fallback adventure when import fails
 */
async function createFallbackAdventure(adventureId, adventureInfo) {
  logWarning('Creating fallback adventure', { adventureId });
  
  return {
    id: adventureId,
    title: adventureInfo.title,
    author: 'System Generated',
    version: '1.0.0',
    description: adventureInfo.description || 'A fallback adventure created when the original could not be loaded.',
    startSceneId: 'fallback_start',
    
    scenes: [
      {
        id: 'fallback_start',
        title: 'Adventure Unavailable',
        content: `The adventure "${adventureInfo.title}" could not be loaded properly. This is a fallback scene to prevent errors.\n\nYou can try reloading the page or selecting a different adventure.`,
        choices: [
          {
            id: 'fallback_choice',
            text: 'Try again',
            targetSceneId: 'fallback_start',
            conditions: [],
            actions: []
          }
        ],
        onEnter: [],
        onExit: [],
        tags: ['fallback', 'error']
      }
    ],
    
    stats: [
      {
        id: 'health',
        name: 'Health',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100
      }
    ],
    
    flags: [],
    inventory: [],
    achievements: [],
    categories: [],
    
    metadata: {
      created: Date.now(),
      modified: Date.now(),
      isFallback: true,
      originalError: 'Import failed',
      fallbackVersion: '1.0.0'
    }
  };
}

/**
 * Load adventure with size-based optimization
 */
export async function getAdventureOptimized(adventureId, options = {}) {
  const adventureInfo = ADVENTURE_REGISTRY.get(adventureId);
  
  if (!adventureInfo) {
    throw new Error(`Adventure "${adventureId}" not found`);
  }

  const { loadMetadataOnly = false, chunkSize = null } = options;
  
  try {
    const adventure = await getAdventure(adventureId);
    
    // For large adventures, optionally return metadata only
    if (loadMetadataOnly && adventureInfo.size === 'large') {
      return {
        ...adventure,
        scenes: [], // Remove scenes for metadata-only loading
        _originalSceneCount: adventure.scenes?.length || 0,
        _isMetadataOnly: true
      };
    }
    
    // For large adventures with chunking enabled
    if (chunkSize && adventureInfo.size === 'large' && adventure.scenes) {
      return chunkAdventure(adventure, chunkSize);
    }
    
    return adventure;
  } catch (error) {
    logError('Optimized adventure loading failed', { adventureId, options, error: error.message });
    throw error;
  }
}

/**
 * Split large adventure into chunks for progressive loading
 */
function chunkAdventure(adventure, chunkSize) {
  const chunks = [];
  const scenes = adventure.scenes || [];
  
  for (let i = 0; i < scenes.length; i += chunkSize) {
    chunks.push({
      index: Math.floor(i / chunkSize),
      scenes: scenes.slice(i, i + chunkSize),
      startIndex: i,
      endIndex: Math.min(i + chunkSize - 1, scenes.length - 1)
    });
  }
  
  return {
    ...adventure,
    scenes: scenes.slice(0, chunkSize), // Load first chunk immediately
    _chunks: chunks,
    _isChunked: true,
    _totalScenes: scenes.length,
    _chunkSize: chunkSize
  };
}

/**
 * Get scene chunk by index for chunked adventures
 */
export function getAdventureChunk(adventure, chunkIndex) {
  if (!adventure._isChunked || !adventure._chunks) {
    throw new Error('Adventure is not chunked');
  }
  
  const chunk = adventure._chunks[chunkIndex];
  if (!chunk) {
    throw new Error(`Chunk ${chunkIndex} not found`);
  }
  
  return chunk.scenes;
}

/**
 * Check if adventure exists in registry
 */
export function hasAdventure(adventureId) {
  return ADVENTURE_REGISTRY.has(adventureId);
}

/**
 * Remove adventure from registry
 */
export function unregisterAdventure(adventureId) {
  const removed = ADVENTURE_REGISTRY.delete(adventureId);
  if (removed) {
    console.log(`Adventure "${adventureId}" unregistered`);
  }
  return removed;
}

/**
 * Clear all registered adventures (except defaults)
 */
export function clearRegistry(keepDefaults = true) {
  if (keepDefaults) {
    // Keep only default adventures
    const toRemove = [];
    for (const [id, info] of ADVENTURE_REGISTRY) {
      if (!DEFAULT_ADVENTURES.some(def => def.id === id)) {
        toRemove.push(id);
      }
    }
    toRemove.forEach(id => ADVENTURE_REGISTRY.delete(id));
  } else {
    ADVENTURE_REGISTRY.clear();
  }
  
  console.log('Adventure registry cleared');
}

/**
 * Get registry statistics
 */
export function getRegistryStats() {
  const adventures = Array.from(ADVENTURE_REGISTRY.values());
  const sizeDistribution = adventures.reduce((acc, adv) => {
    acc[adv.size] = (acc[adv.size] || 0) + 1;
    return acc;
  }, {});
  
  return {
    totalAdventures: adventures.length,
    sizeDistribution,
    registeredIds: adventures.map(adv => adv.id),
    memoryEstimate: adventures.length * 100 // rough estimate in bytes
  };
}

export default {
  registerAdventure,
  getAvailableAdventures,
  getAdventureInfo,
  getAdventure,
  getAdventureOptimized,
  getAdventureChunk,
  hasAdventure,
  unregisterAdventure,
  clearRegistry,
  getRegistryStats
};