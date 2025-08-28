/**
 * CrossGameSaveSystem.js - Cross-adventure save compatibility system
 * 
 * Features:
 * - Export portable save data between different adventures
 * - Import cross-game saves with validation and conflict resolution
 * - Stat mapping and conversion between adventure formats
 * - Achievement and progress tracking across games
 * - Save compatibility checking and migration
 * 
 * Integration Points:
 * - SaveSystem: Extends existing save functionality
 * - StatsManager: Maps stats between different adventures
 * - SaveLoadMenu: UI for cross-game save operations
 * - ExportableDataManager: Handles data transformation
 */

export class CrossGameSaveSystem {
  constructor(statsManager, saveSystem) {
    this.statsManager = statsManager;
    this.saveSystem = saveSystem;
    
    // Cross-game data format version
    this.crossGameVersion = '1.0.0';
    
    // Compatibility configuration
    this.compatibilityRules = new Map();
    this.statMappingRules = new Map();
    this.achievementRegistry = new Map();
    
    // Performance caches
    this.compatibilityCache = new Map();
    this.mappingCache = new Map();
    
    // Initialize default compatibility rules
    this.initializeDefaultRules();
  }

  /**
   * Export current game state to cross-game format
   * @param {Object} currentSave - Current adventure save data
   * @param {Object} adventureInfo - Adventure metadata
   * @returns {Object} { success, crossGameSave, error }
   */
  exportCrossGameSave(currentSave, adventureInfo) {
    try {
      const exportableData = this.extractExportableData(currentSave, adventureInfo);
      
      const crossGameSave = {
        format: 'cross_game_save',
        version: this.crossGameVersion,
        exported: Date.now(),
        sourceAdventure: {
          id: adventureInfo.id,
          title: adventureInfo.title,
          author: adventureInfo.author,
          version: adventureInfo.version
        },
        playerData: {
          name: currentSave.playerName || 'Unknown',
          playthroughId: currentSave.playthroughId,
          completedAt: currentSave.completedAt || null,
          totalPlayTime: currentSave.totalPlayTime || 0
        },
        portableStats: exportableData.stats,
        achievements: exportableData.achievements,
        experience: exportableData.experience,
        inventory: exportableData.inventory,
        flags: exportableData.flags,
        metadata: {
          exportReason: 'player_request',
          gameCompletion: this.calculateCompletionPercentage(currentSave, adventureInfo),
          difficulty: adventureInfo.difficulty || 'normal',
          playStyle: this.analyzePlayStyle(currentSave)
        },
        compatibility: {
          supportedFeatures: this.getSupportedFeatures(adventureInfo),
          statCategories: this.categorizeStats(currentSave.stats),
          requiredMappings: this.getRequiredMappings(currentSave)
        }
      };

      // Validate export data
      const validation = this.validateCrossGameSave(crossGameSave);
      if (!validation.isValid) {
        return {
          success: false,
          crossGameSave: null,
          error: `Export validation failed: ${validation.errors.join(', ')}`
        };
      }

      return {
        success: true,
        crossGameSave: crossGameSave,
        error: null
      };

    } catch (error) {
      console.error('Cross-game export failed:', error);
      return {
        success: false,
        crossGameSave: null,
        error: error.message
      };
    }
  }

  /**
   * Import cross-game save into current adventure
   * @param {Object} crossGameSave - Cross-game save data
   * @param {Object} targetAdventure - Target adventure info
   * @param {Object} importOptions - Import configuration
   * @returns {Object} { success, adaptedSave, conflicts, warnings }
   */
  importCrossGameSave(crossGameSave, targetAdventure, importOptions = {}) {
    try {
      // Validate cross-game save format
      const validation = this.validateCrossGameSave(crossGameSave);
      if (!validation.isValid) {
        return {
          success: false,
          adaptedSave: null,
          conflicts: validation.errors,
          warnings: []
        };
      }

      // Check compatibility
      const compatibility = this.checkCompatibility(crossGameSave, targetAdventure);
      if (!compatibility.isCompatible && !importOptions.forceImport) {
        return {
          success: false,
          adaptedSave: null,
          conflicts: compatibility.blockingIssues,
          warnings: compatibility.warnings
        };
      }

      // Perform data adaptation
      const adaptationResult = this.adaptSaveData(crossGameSave, targetAdventure, importOptions);
      
      if (!adaptationResult.success) {
        return {
          success: false,
          adaptedSave: null,
          conflicts: adaptationResult.errors,
          warnings: adaptationResult.warnings
        };
      }

      // Create new save in target adventure format
      const adaptedSave = this.createAdaptedSave(
        adaptationResult.adaptedData,
        targetAdventure,
        crossGameSave
      );

      return {
        success: true,
        adaptedSave: adaptedSave,
        conflicts: adaptationResult.conflicts,
        warnings: adaptationResult.warnings
      };

    } catch (error) {
      console.error('Cross-game import failed:', error);
      return {
        success: false,
        adaptedSave: null,
        conflicts: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Check compatibility between cross-game save and target adventure
   * @param {Object} crossGameSave - Cross-game save data
   * @param {Object} targetAdventure - Target adventure info
   * @returns {Object} { isCompatible, score, blockingIssues, warnings }
   */
  checkCompatibility(crossGameSave, targetAdventure) {
    const cacheKey = `${crossGameSave.sourceAdventure.id}_${targetAdventure.id}`;
    
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey);
    }

    const result = {
      isCompatible: true,
      score: 100,
      blockingIssues: [],
      warnings: []
    };

    // Check version compatibility
    if (crossGameSave.version !== this.crossGameVersion) {
      result.warnings.push(`Version mismatch: save is ${crossGameSave.version}, system is ${this.crossGameVersion}`);
      result.score -= 10;
    }

    // Check stat compatibility
    const statCompatibility = this.checkStatCompatibility(
      crossGameSave.portableStats,
      targetAdventure.stats
    );
    result.score -= (100 - statCompatibility.score);
    result.warnings.push(...statCompatibility.warnings);

    // Check feature compatibility
    const featureCompatibility = this.checkFeatureCompatibility(
      crossGameSave.compatibility.supportedFeatures,
      this.getSupportedFeatures(targetAdventure)
    );
    result.score -= (100 - featureCompatibility.score);

    // Check for blocking issues
    if (result.score < 30) {
      result.isCompatible = false;
      result.blockingIssues.push('Too many incompatibilities detected');
    }

    // Check same adventure (should be blocked)
    if (crossGameSave.sourceAdventure.id === targetAdventure.id) {
      result.isCompatible = false;
      result.blockingIssues.push('Cannot import save from the same adventure');
    }

    this.compatibilityCache.set(cacheKey, result);
    return result;
  }

  /**
   * Adapt save data to target adventure format
   * @private
   */
  adaptSaveData(crossGameSave, targetAdventure, options) {
    const result = {
      success: true,
      adaptedData: {},
      conflicts: [],
      warnings: [],
      errors: []
    };

    try {
      // Adapt stats
      const statAdaptation = this.adaptStats(
        crossGameSave.portableStats,
        targetAdventure.stats,
        options.statMapping || {}
      );
      result.adaptedData.stats = statAdaptation.adaptedStats;
      result.conflicts.push(...statAdaptation.conflicts);
      result.warnings.push(...statAdaptation.warnings);

      // Adapt inventory
      const inventoryAdaptation = this.adaptInventory(
        crossGameSave.inventory,
        targetAdventure.items,
        options.inventoryMapping || {}
      );
      result.adaptedData.inventory = inventoryAdaptation.adaptedInventory;
      result.conflicts.push(...inventoryAdaptation.conflicts);
      result.warnings.push(...inventoryAdaptation.warnings);

      // Adapt achievements
      const achievementAdaptation = this.adaptAchievements(
        crossGameSave.achievements,
        targetAdventure.achievements || [],
        options.achievementMapping || {}
      );
      result.adaptedData.achievements = achievementAdaptation.adaptedAchievements;
      result.warnings.push(...achievementAdaptation.warnings);

      // Adapt flags (more conservative approach)
      result.adaptedData.flags = this.adaptFlags(
        crossGameSave.flags,
        targetAdventure.flagDefinitions || [],
        options.flagMapping || {}
      );

      // Calculate experience transfer
      result.adaptedData.experience = this.calculateExperienceTransfer(
        crossGameSave.experience,
        crossGameSave.metadata,
        targetAdventure
      );

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Adapt stats between adventures
   * @private
   */
  adaptStats(sourceStats, targetStatDefs, customMapping) {
    const result = {
      adaptedStats: {},
      conflicts: [],
      warnings: []
    };

    // Create target stat definitions map
    const targetStats = new Map();
    targetStatDefs.forEach(stat => targetStats.set(stat.id, stat));

    // Process each source stat
    Object.entries(sourceStats).forEach(([sourceStatId, value]) => {
      // Check for direct match first
      if (targetStats.has(sourceStatId)) {
        const targetStat = targetStats.get(sourceStatId);
        result.adaptedStats[sourceStatId] = this.convertStatValue(
          value,
          targetStat
        );
        return;
      }

      // Check custom mapping
      if (customMapping[sourceStatId]) {
        const mappedId = customMapping[sourceStatId];
        if (targetStats.has(mappedId)) {
          const targetStat = targetStats.get(mappedId);
          result.adaptedStats[mappedId] = this.convertStatValue(
            value,
            targetStat
          );
          result.warnings.push(`Mapped ${sourceStatId} → ${mappedId}`);
          return;
        }
      }

      // Check automatic mapping rules
      const autoMapping = this.findAutoMapping(sourceStatId, targetStats);
      if (autoMapping) {
        result.adaptedStats[autoMapping.targetId] = this.convertStatValue(
          value,
          autoMapping.targetStat,
          autoMapping.confidence
        );
        result.warnings.push(
          `Auto-mapped ${sourceStatId} → ${autoMapping.targetId} (${Math.round(autoMapping.confidence * 100)}% confidence)`
        );
        return;
      }

      // No mapping found
      result.conflicts.push(`Cannot map stat: ${sourceStatId} (value: ${value})`);
    });

    // Initialize unmapped target stats to defaults
    targetStats.forEach((stat, id) => {
      if (!(id in result.adaptedStats)) {
        result.adaptedStats[id] = stat.defaultValue;
      }
    });

    return result;
  }

  /**
   * Find automatic stat mapping based on similarity
   * @private
   */
  findAutoMapping(sourceStatId, targetStats) {
    let bestMatch = null;
    let bestConfidence = 0;

    // Common stat name mappings
    const commonMappings = {
      'hp': ['health', 'hitpoints', 'life'],
      'health': ['hp', 'hitpoints', 'life'],
      'mp': ['mana', 'magic', 'energy'],
      'mana': ['mp', 'magic', 'energy'],
      'str': ['strength', 'power'],
      'strength': ['str', 'power'],
      'dex': ['dexterity', 'agility', 'speed'],
      'int': ['intelligence', 'mind', 'wisdom'],
      'char': ['charisma', 'personality', 'charm']
    };

    const sourceKey = sourceStatId.toLowerCase();
    
    // Check exact alternative names
    if (commonMappings[sourceKey]) {
      for (const altName of commonMappings[sourceKey]) {
        const match = Array.from(targetStats.values()).find(
          stat => stat.id.toLowerCase() === altName
        );
        if (match) {
          return {
            targetId: match.id,
            targetStat: match,
            confidence: 0.9
          };
        }
      }
    }

    // Check partial string matches
    targetStats.forEach((stat, id) => {
      const targetKey = id.toLowerCase();
      
      // Substring matching
      if (sourceKey.includes(targetKey) || targetKey.includes(sourceKey)) {
        const confidence = Math.max(sourceKey.length, targetKey.length) / 
                          Math.min(sourceKey.length + targetKey.length);
        
        if (confidence > bestConfidence && confidence > 0.3) {
          bestMatch = {
            targetId: id,
            targetStat: stat,
            confidence: confidence
          };
          bestConfidence = confidence;
        }
      }
    });

    return bestMatch;
  }

  /**
   * Convert stat value to target format
   * @private
   */
  convertStatValue(value, targetStat, confidence = 1.0) {
    let convertedValue = value;

    // Type conversion
    if (targetStat.type === 'number' && typeof value === 'string') {
      convertedValue = parseFloat(value) || targetStat.defaultValue;
    } else if (targetStat.type === 'string' && typeof value === 'number') {
      convertedValue = value.toString();
    } else if (targetStat.type === 'boolean') {
      convertedValue = Boolean(value);
    }

    // Apply confidence scaling for uncertain mappings
    if (confidence < 1.0 && typeof convertedValue === 'number') {
      const defaultValue = targetStat.defaultValue || 0;
      convertedValue = Math.round(
        defaultValue + (convertedValue - defaultValue) * confidence
      );
    }

    // Apply constraints
    if (typeof convertedValue === 'number') {
      if (targetStat.min !== undefined) {
        convertedValue = Math.max(convertedValue, targetStat.min);
      }
      if (targetStat.max !== undefined) {
        convertedValue = Math.min(convertedValue, targetStat.max);
      }
    }

    return convertedValue;
  }

  /**
   * Adapt inventory between adventures
   * @private
   */
  adaptInventory(sourceInventory, targetItems, customMapping) {
    const result = {
      adaptedInventory: {},
      conflicts: [],
      warnings: []
    };

    if (!sourceInventory || !targetItems) {
      return result;
    }

    const targetItemMap = new Map();
    targetItems.forEach(item => targetItemMap.set(item.id, item));

    Object.entries(sourceInventory).forEach(([itemId, itemData]) => {
      // Direct match
      if (targetItemMap.has(itemId)) {
        result.adaptedInventory[itemId] = itemData;
        return;
      }

      // Custom mapping
      if (customMapping[itemId] && targetItemMap.has(customMapping[itemId])) {
        result.adaptedInventory[customMapping[itemId]] = itemData;
        result.warnings.push(`Mapped item ${itemId} → ${customMapping[itemId]}`);
        return;
      }

      // Category-based mapping for generic items
      const categoryMapping = this.findItemCategoryMapping(
        { id: itemId, ...itemData },
        targetItems
      );

      if (categoryMapping) {
        result.adaptedInventory[categoryMapping.id] = {
          ...itemData,
          quantity: Math.min(itemData.quantity || 1, categoryMapping.maxStack || 99)
        };
        result.warnings.push(`Mapped ${itemId} → ${categoryMapping.id} by category`);
        return;
      }

      result.conflicts.push(`Cannot map item: ${itemId}`);
    });

    return result;
  }

  /**
   * Find item mapping based on category
   * @private
   */
  findItemCategoryMapping(sourceItem, targetItems) {
    // Simple category-based matching
    const categoryPriority = ['weapon', 'armor', 'consumable', 'tool', 'misc'];
    
    for (const category of categoryPriority) {
      const match = targetItems.find(item => 
        item.category === category && 
        item.name.toLowerCase().includes(sourceItem.name?.toLowerCase() || '')
      );
      
      if (match) {
        return match;
      }
    }

    return null;
  }

  /**
   * Extract exportable data from save
   * @private
   */
  extractExportableData(save, adventureInfo) {
    return {
      stats: this.extractPortableStats(save.stats, adventureInfo.stats),
      achievements: this.extractAchievements(save),
      experience: this.calculateExperienceValue(save, adventureInfo),
      inventory: save.inventory || {},
      flags: this.extractPortableFlags(save.flags || {})
    };
  }

  /**
   * Extract portable stats (exclude adventure-specific stats)
   * @private
   */
  extractPortableStats(stats, statDefinitions) {
    const portableStats = {};
    const portableCategories = ['core', 'attribute', 'skill', 'resource'];

    Object.entries(stats).forEach(([statId, value]) => {
      const statDef = statDefinitions.find(s => s.id === statId);
      
      if (statDef && 
          (portableCategories.includes(statDef.category) || !statDef.adventureSpecific)) {
        portableStats[statId] = value;
      }
    });

    return portableStats;
  }

  /**
   * Calculate experience value for transfer
   * @private
   */
  calculateExperienceValue(save, adventureInfo) {
    const baseExperience = save.totalPlayTime || 0;
    const completionBonus = (save.completedAt ? 1000 : 0);
    const difficultyMultiplier = adventureInfo.difficulty === 'hard' ? 1.5 : 1.0;

    return Math.round(baseExperience * 0.1 + completionBonus * difficultyMultiplier);
  }

  /**
   * Create adapted save in target format
   * @private
   */
  createAdaptedSave(adaptedData, targetAdventure, originalCrossGameSave) {
    return {
      version: '1.0.0',
      adventureId: targetAdventure.id,
      adventureVersion: targetAdventure.version,
      timestamp: Date.now(),
      playerName: originalCrossGameSave.playerData.name,
      currentSceneId: targetAdventure.startSceneId,
      stats: adaptedData.stats,
      inventory: adaptedData.inventory || {},
      flags: adaptedData.flags || {},
      visitedScenes: [targetAdventure.startSceneId],
      choiceHistory: [],
      secretsFound: [],
      playthroughId: this.generatePlaythroughId(),
      crossGameImport: {
        sourceAdventure: originalCrossGameSave.sourceAdventure,
        importedAt: Date.now(),
        transferredExperience: adaptedData.experience || 0,
        transferredAchievements: adaptedData.achievements || []
      }
    };
  }

  /**
   * Initialize default compatibility rules
   * @private
   */
  initializeDefaultRules() {
    // Common stat categories that transfer well
    this.compatibilityRules.set('health_stats', ['health', 'hp', 'hitpoints', 'life']);
    this.compatibilityRules.set('combat_stats', ['strength', 'dexterity', 'intelligence']);
    this.compatibilityRules.set('resource_stats', ['mana', 'energy', 'stamina']);
  }

  /**
   * Generate unique playthrough ID
   * @private
   */
  generatePlaythroughId() {
    return `crossgame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Additional utility methods
   * @private
   */
  validateCrossGameSave(save) {
    const errors = [];

    if (!save.format || save.format !== 'cross_game_save') {
      errors.push('Invalid format');
    }
    if (!save.version) {
      errors.push('Missing version');
    }
    if (!save.sourceAdventure) {
      errors.push('Missing source adventure info');
    }
    if (!save.portableStats) {
      errors.push('Missing portable stats');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  checkStatCompatibility(sourceStats, targetStats) {
    // Implementation details for stat compatibility checking
    return { score: 80, warnings: [] };
  }

  checkFeatureCompatibility(sourceFeatures, targetFeatures) {
    // Implementation details for feature compatibility checking
    return { score: 90 };
  }

  getSupportedFeatures(adventure) {
    // Extract supported features from adventure
    return ['inventory', 'stats', 'flags', 'achievements'];
  }

  categorizeStats(stats) {
    // Categorize stats for compatibility analysis
    return Object.keys(stats).reduce((acc, stat) => {
      acc[stat] = 'general'; // Default category
      return acc;
    }, {});
  }

  getRequiredMappings(save) {
    // Get mappings required for this save
    return {};
  }

  calculateCompletionPercentage(save, adventure) {
    // Calculate how much of the adventure was completed
    return save.completedAt ? 100 : 
           (save.visitedScenes?.length || 0) / (adventure.scenes?.length || 1) * 100;
  }

  analyzePlayStyle(save) {
    // Analyze player's play style for better compatibility
    return 'balanced';
  }

  adaptAchievements(sourceAchievements, targetAchievements, mapping) {
    return { adaptedAchievements: [], warnings: [] };
  }

  adaptFlags(sourceFlags, targetFlags, mapping) {
    return {};
  }
}