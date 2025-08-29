// fallbackData.js - Fallback states and recovery data for corrupted or missing data
import { logWarning, logInfo } from './errorLogger.js';

// Fallback game state for when save data is corrupted
export const FALLBACK_GAME_STATE = {
  adventure: null,
  currentScene: null,
  stats: {},
  flags: {},
  visitedScenes: [],
  choiceHistory: [],
  isLoading: false,
  error: null,
  // Phase 3 additions
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
  gameplayMetrics: null,
  playthroughId: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  recoveryInfo: {
    isRecovered: true,
    recoveredAt: new Date().toISOString(),
    reason: 'Corrupted save data recovered with fallback state'
  }
};

// Minimal adventure template for when adventure data is corrupted
export const MINIMAL_ADVENTURE_TEMPLATE = {
  id: `recovered_adventure_${Date.now()}`,
  title: 'Recovered Adventure',
  author: 'System Recovery',
  version: '1.0.0',
  description: 'This adventure was recovered from corrupted data. Content may be incomplete.',
  startSceneId: 'recovery_start',
  
  scenes: [
    {
      id: 'recovery_start',
      title: 'Adventure Recovery',
      content: 'Your adventure data was corrupted, but has been recovered with minimal content. You can continue playing or restart the adventure.',
      choices: [
        {
          id: 'continue_recovery',
          text: 'Continue with recovered data',
          targetSceneId: 'recovery_continue',
          conditions: [],
          actions: []
        },
        {
          id: 'restart_adventure',
          text: 'Restart adventure',
          targetSceneId: 'recovery_start',
          conditions: [],
          actions: [
            { type: 'set_flag', key: 'restarted', value: true }
          ]
        }
      ],
      onEnter: [],
      onExit: [],
      tags: ['recovery', 'system']
    },
    {
      id: 'recovery_continue',
      title: 'Recovery Complete',
      content: 'Adventure recovery is complete. Your progress has been restored as much as possible.',
      choices: [],
      onEnter: [
        { type: 'set_flag', key: 'recovery_complete', value: true }
      ],
      onExit: [],
      tags: ['recovery', 'ending']
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
    },
    {
      id: 'score',
      name: 'Score',
      type: 'number',
      defaultValue: 0,
      min: 0
    },
    {
      id: 'recovery_flags',
      name: 'Recovery Status',
      type: 'string',
      defaultValue: 'recovered',
      hidden: true
    }
  ],
  
  flags: [
    {
      id: 'is_recovered',
      name: 'Data Recovered',
      description: 'This adventure was recovered from corrupted data',
      defaultValue: true,
      persistent: true
    }
  ],
  
  inventory: [],
  achievements: [],
  categories: [],
  
  metadata: {
    created: Date.now(),
    modified: Date.now(),
    isRecovery: true,
    originalCorruption: 'Adventure data was corrupted and recovered',
    recoveryVersion: '1.0.0'
  }
};

// Default save data structure for corrupted saves
export const DEFAULT_SAVE_DATA_FALLBACK = {
  version: '2.0',
  adventureId: 'recovered_adventure',
  adventureVersion: '1.0.0',
  timestamp: Date.now(),
  playerName: null,
  currentSceneId: 'recovery_start',
  stats: {
    health: 100,
    score: 0,
    recovery_flags: 'recovered'
  },
  flags: {
    is_recovered: true,
    recovery_complete: false
  },
  visitedScenes: ['recovery_start'],
  choiceHistory: [],
  playthroughId: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  // Phase 3 defaults
  secretsDiscovered: [],
  secretChoicesAvailable: [],
  inventory: [],
  inventoryState: {
    totalWeight: 0,
    totalValue: 0,
    categories: {},
    lastModified: Date.now()
  },
  achievements: [],
  
  // Recovery metadata
  exportableData: null,
  gameplayMetrics: {
    totalChoicesMade: 0,
    uniqueScenesVisited: 1,
    secretsFound: 0,
    estimatedPlayTime: 0,
    completionPercentage: 0,
    isRecoveredData: true
  },
  saveMetadata: {
    saveName: 'Recovery Save',
    adventureTitle: 'Recovered Adventure',
    adventureAuthor: 'System Recovery',
    currentSceneTitle: 'Adventure Recovery',
    saveVersion: '2.0',
    engineVersion: 'Phase 3',
    isRecovery: true,
    recoveredAt: new Date().toISOString()
  }
};

// Fallback editor state for corrupted editor data
export const FALLBACK_EDITOR_STATE = {
  adventure: {
    ...MINIMAL_ADVENTURE_TEMPLATE,
    id: `editor_recovery_${Date.now()}`,
    title: 'New Adventure (Recovered)'
  },
  nodes: new Map([
    ['recovery_start', {
      id: 'recovery_start',
      type: 'scene',
      position: { x: 400, y: 300 },
      data: MINIMAL_ADVENTURE_TEMPLATE.scenes[0]
    }]
  ]),
  connections: new Map(),
  selectedNode: null,
  clipboardNode: null,
  history: [],
  historyIndex: -1,
  isDirty: true,
  recoveryInfo: {
    isRecovered: true,
    recoveredAt: new Date().toISOString(),
    reason: 'Editor data was corrupted and recovered with minimal template'
  }
};

// Recovery utility functions
export class FallbackDataManager {
  static createRecoveredGameState(originalState = null, corruptionReason = 'Unknown corruption') {
    logWarning('Creating recovered game state due to corruption', { corruptionReason });
    
    const fallbackState = { ...FALLBACK_GAME_STATE };
    
    // Try to salvage any valid data from the original state
    if (originalState && typeof originalState === 'object') {
      // Salvage adventure if it exists and is somewhat valid
      if (originalState.adventure && typeof originalState.adventure === 'object' && originalState.adventure.id) {
        try {
          fallbackState.adventure = this.createRecoveredAdventure(originalState.adventure, corruptionReason);
        } catch (error) {
          logWarning('Could not recover adventure data, using template', { error: error.message });
          fallbackState.adventure = { ...MINIMAL_ADVENTURE_TEMPLATE };
        }
      }
      
      // Salvage basic stats if they exist
      if (originalState.stats && typeof originalState.stats === 'object') {
        try {
          const recoveredStats = this.recoverStatsData(originalState.stats);
          fallbackState.stats = { ...fallbackState.stats, ...recoveredStats };
        } catch (error) {
          logWarning('Could not recover stats data', { error: error.message });
        }
      }
      
      // Salvage visited scenes if valid
      if (Array.isArray(originalState.visitedScenes)) {
        fallbackState.visitedScenes = originalState.visitedScenes.slice(0, 100); // Limit to prevent bloat
      }
      
      // Salvage playthrough ID if it exists
      if (originalState.playthroughId && typeof originalState.playthroughId === 'string') {
        fallbackState.playthroughId = originalState.playthroughId;
      }
    }
    
    // Set recovery information
    fallbackState.recoveryInfo = {
      isRecovered: true,
      recoveredAt: new Date().toISOString(),
      reason: corruptionReason,
      originalDataFound: !!originalState,
      salvageAttempted: true
    };
    
    return fallbackState;
  }

  static createRecoveredAdventure(originalAdventure, corruptionReason = 'Adventure data corrupted') {
    logInfo('Attempting to recover adventure data', { 
      originalId: originalAdventure?.id,
      corruptionReason 
    });
    
    const recoveredAdventure = { ...MINIMAL_ADVENTURE_TEMPLATE };
    
    // Preserve basic adventure metadata if valid
    if (originalAdventure.id && typeof originalAdventure.id === 'string') {
      recoveredAdventure.id = originalAdventure.id;
    }
    
    if (originalAdventure.title && typeof originalAdventure.title === 'string') {
      recoveredAdventure.title = originalAdventure.title;
    }
    
    if (originalAdventure.author && typeof originalAdventure.author === 'string') {
      recoveredAdventure.author = originalAdventure.author;
    }
    
    if (originalAdventure.version && typeof originalAdventure.version === 'string') {
      recoveredAdventure.version = originalAdventure.version;
    }
    
    if (originalAdventure.description && typeof originalAdventure.description === 'string') {
      recoveredAdventure.description = originalAdventure.description;
    }
    
    // Try to recover scenes
    if (Array.isArray(originalAdventure.scenes) && originalAdventure.scenes.length > 0) {
      const recoveredScenes = this.recoverScenesData(originalAdventure.scenes);
      if (recoveredScenes.length > 0) {
        recoveredAdventure.scenes.push(...recoveredScenes);
        // Update start scene if possible
        if (originalAdventure.startSceneId && recoveredScenes.some(s => s.id === originalAdventure.startSceneId)) {
          recoveredAdventure.startSceneId = originalAdventure.startSceneId;
        } else {
          recoveredAdventure.startSceneId = recoveredScenes[0].id;
        }
      }
    }
    
    // Try to recover stats
    if (Array.isArray(originalAdventure.stats) && originalAdventure.stats.length > 0) {
      const recoveredStats = this.recoverStatDefinitions(originalAdventure.stats);
      if (recoveredStats.length > 0) {
        recoveredAdventure.stats = recoveredStats;
      }
    }
    
    // Add recovery metadata
    recoveredAdventure.metadata = {
      ...recoveredAdventure.metadata,
      originalCorruption: corruptionReason,
      recoveryAttempt: true,
      recoveredSceneCount: recoveredAdventure.scenes.length - 2, // Excluding recovery scenes
      recoveredStatCount: recoveredAdventure.stats.length
    };
    
    return recoveredAdventure;
  }

  static recoverScenesData(originalScenes) {
    const recoveredScenes = [];
    
    originalScenes.forEach((scene, index) => {
      try {
        if (!scene || typeof scene !== 'object') return;
        
        const recoveredScene = {
          id: scene.id || `recovered_scene_${index}_${Date.now()}`,
          title: scene.title || `Recovered Scene ${index + 1}`,
          content: scene.content || `This scene was recovered from corrupted data.`,
          choices: [],
          onEnter: [],
          onExit: [],
          tags: ['recovered']
        };
        
        // Try to recover choices
        if (Array.isArray(scene.choices)) {
          scene.choices.forEach((choice, choiceIndex) => {
            try {
              if (choice && typeof choice === 'object' && choice.text) {
                recoveredScene.choices.push({
                  id: choice.id || `${recoveredScene.id}_choice_${choiceIndex}`,
                  text: choice.text,
                  targetSceneId: choice.targetSceneId || null,
                  conditions: [],
                  actions: []
                });
              }
            } catch (choiceError) {
              logWarning('Failed to recover choice', { choiceIndex, error: choiceError.message });
            }
          });
        }
        
        recoveredScenes.push(recoveredScene);
      } catch (sceneError) {
        logWarning('Failed to recover scene', { sceneIndex: index, error: sceneError.message });
      }
    });
    
    return recoveredScenes;
  }

  static recoverStatDefinitions(originalStats) {
    const recoveredStats = [];
    
    originalStats.forEach((stat, index) => {
      try {
        if (!stat || typeof stat !== 'object') return;
        
        const recoveredStat = {
          id: stat.id || `recovered_stat_${index}`,
          name: stat.name || `Recovered Stat ${index + 1}`,
          type: stat.type || 'number',
          defaultValue: stat.defaultValue !== undefined ? stat.defaultValue : 0
        };
        
        // Preserve additional stat properties if they exist
        if (stat.min !== undefined) recoveredStat.min = stat.min;
        if (stat.max !== undefined) recoveredStat.max = stat.max;
        if (stat.hidden !== undefined) recoveredStat.hidden = stat.hidden;
        
        recoveredStats.push(recoveredStat);
      } catch (statError) {
        logWarning('Failed to recover stat', { statIndex: index, error: statError.message });
      }
    });
    
    return recoveredStats;
  }

  static recoverStatsData(originalStats) {
    const recoveredStats = {};
    
    if (typeof originalStats === 'object' && originalStats !== null) {
      Object.entries(originalStats).forEach(([key, value]) => {
        try {
          // Only recover stats with valid keys and reasonable values
          if (typeof key === 'string' && key.length > 0 && key.length < 50) {
            if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
              recoveredStats[key] = value;
            } else if (typeof value === 'string' && value.length < 200) {
              recoveredStats[key] = value;
            } else if (typeof value === 'boolean') {
              recoveredStats[key] = value;
            }
          }
        } catch (error) {
          logWarning('Failed to recover stat value', { key, error: error.message });
        }
      });
    }
    
    return recoveredStats;
  }

  static createRecoveredSaveData(originalSaveData = null, corruptionReason = 'Save data corrupted') {
    logWarning('Creating recovered save data', { corruptionReason });
    
    const fallbackSave = { ...DEFAULT_SAVE_DATA_FALLBACK };
    
    // Try to salvage data from original save
    if (originalSaveData && typeof originalSaveData === 'object') {
      // Preserve basic identifiers
      if (originalSaveData.adventureId) fallbackSave.adventureId = originalSaveData.adventureId;
      if (originalSaveData.playthroughId) fallbackSave.playthroughId = originalSaveData.playthroughId;
      
      // Recover stats
      if (originalSaveData.stats) {
        const recoveredStats = this.recoverStatsData(originalSaveData.stats);
        fallbackSave.stats = { ...fallbackSave.stats, ...recoveredStats };
      }
      
      // Recover flags
      if (originalSaveData.flags && typeof originalSaveData.flags === 'object') {
        try {
          Object.entries(originalSaveData.flags).forEach(([key, value]) => {
            if (typeof key === 'string' && typeof value === 'boolean') {
              fallbackSave.flags[key] = value;
            }
          });
        } catch (error) {
          logWarning('Failed to recover flags', { error: error.message });
        }
      }
      
      // Recover visited scenes
      if (Array.isArray(originalSaveData.visitedScenes)) {
        fallbackSave.visitedScenes = originalSaveData.visitedScenes.slice(0, 100);
      }
    }
    
    // Add recovery metadata
    fallbackSave.saveMetadata = {
      ...fallbackSave.saveMetadata,
      originalCorruption: corruptionReason,
      recoveryAttempt: true,
      recoveredAt: new Date().toISOString(),
      originalDataFound: !!originalSaveData
    };
    
    return fallbackSave;
  }

  static createMinimalEditorState(corruptionReason = 'Editor data corrupted') {
    logWarning('Creating minimal editor state', { corruptionReason });
    
    const fallbackEditor = { ...FALLBACK_EDITOR_STATE };
    
    // Add corruption reason to recovery info
    fallbackEditor.recoveryInfo.reason = corruptionReason;
    
    return fallbackEditor;
  }

  // Utility to check if data appears to be recovered/fallback data
  static isRecoveredData(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Check for recovery markers
    if (data.recoveryInfo?.isRecovered) return true;
    if (data.metadata?.isRecovery) return true;
    if (data.saveMetadata?.isRecovery) return true;
    
    // Check for recovery-specific content
    if (data.id?.includes('recovery') || data.id?.includes('recovered')) return true;
    if (data.title?.includes('Recovery') || data.title?.includes('Recovered')) return true;
    
    return false;
  }

  // Get recovery information from data
  static getRecoveryInfo(data) {
    if (!this.isRecoveredData(data)) {
      return { isRecovered: false };
    }
    
    return {
      isRecovered: true,
      reason: data.recoveryInfo?.reason || data.metadata?.originalCorruption || 'Unknown',
      recoveredAt: data.recoveryInfo?.recoveredAt || data.metadata?.recoveredAt || new Date().toISOString(),
      originalDataFound: data.recoveryInfo?.originalDataFound || false,
      salvageAttempted: data.recoveryInfo?.salvageAttempted || false
    };
  }
}

export default FallbackDataManager;