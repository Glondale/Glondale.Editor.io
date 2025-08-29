/**
 * compatibilityChecker.js - Save and adventure compatibility validation
 * 
 * Features:
 * - Validate save compatibility with adventure versions
 * - Check cross-game save compatibility
 * - Detect breaking changes between versions
 * - Provide migration suggestions and warnings
 * - Performance-optimized compatibility scoring
 * 
 * Integration Points:
 * - CrossGameSaveSystem: Pre-import compatibility validation
 * - SaveSystem: Version compatibility checking
 * - EditorSessionStorage: Session format validation
 * - ValidationEngine: Adventure format compatibility
 */

export class CompatibilityChecker {
  constructor() {
    // Compatibility matrix for different versions
    this.versionCompatibility = new Map();
    
    // Feature compatibility rules
    this.featureCompatibility = new Map();
    
    // Breaking change definitions
    this.breakingChanges = new Map();
    
    // Performance caches
    this.compatibilityCache = new Map();
    this.featureCache = new Map();
    
    // Compatibility scoring weights
    this.scoringWeights = {
      version: 20,
      stats: 25,
      scenes: 20,
      choices: 15,
      inventory: 10,
      features: 10
    };
    
    // Initialize compatibility rules
    this.initializeCompatibilityRules();
  }

  /**
   * Check comprehensive compatibility between save and adventure
   * @param {Object} saveData - Save data to validate
   * @param {Object} adventureData - Adventure data to validate against
   * @param {Object} options - Compatibility check options
   * @returns {Object} Detailed compatibility report
   */
  checkSaveCompatibility(saveData, adventureData, options = {}) {
    try {
      const cacheKey = this.generateCacheKey('save', saveData, adventureData, options);
      
      if (this.compatibilityCache.has(cacheKey) && !options.skipCache) {
        return this.compatibilityCache.get(cacheKey);
      }

      const compatibility = {
        isCompatible: true,
        overallScore: 100,
        issues: {
          blocking: [],
          warnings: [],
          suggestions: []
        },
        details: {
          version: this.checkVersionCompatibility(saveData, adventureData),
          stats: this.checkStatsCompatibility(saveData, adventureData),
          scenes: this.checkScenesCompatibility(saveData, adventureData),
          choices: this.checkChoicesCompatibility(saveData, adventureData),
          inventory: this.checkInventoryCompatibility(saveData, adventureData),
          features: this.checkFeaturesCompatibility(saveData, adventureData)
        },
        migration: {
          required: false,
          automatic: false,
          steps: [],
          risks: []
        },
        performance: {
          checkDuration: 0,
          cacheHit: false,
          complexity: 'medium'
        }
      };

      const startTime = Date.now();

      // Calculate overall compatibility score
      let totalScore = 0;
      let totalWeight = 0;

      Object.entries(compatibility.details).forEach(([category, result]) => {
        const weight = this.scoringWeights[category] || 5;
        totalScore += result.score * weight;
        totalWeight += weight;

        // Collect issues
        compatibility.issues.blocking.push(...(result.blocking || []));
        compatibility.issues.warnings.push(...(result.warnings || []));
        compatibility.issues.suggestions.push(...(result.suggestions || []));

        // Check for migration requirements
        if (result.migrationRequired) {
          compatibility.migration.required = true;
          compatibility.migration.steps.push(...(result.migrationSteps || []));
          compatibility.migration.risks.push(...(result.migrationRisks || []));
        }

        if (result.automaticMigration) {
          compatibility.migration.automatic = true;
        }
      });

      compatibility.overallScore = Math.round(totalScore / totalWeight);

      // Determine final compatibility
      compatibility.isCompatible = 
        compatibility.overallScore >= 50 && 
        compatibility.issues.blocking.length === 0;

      // Performance metrics
      compatibility.performance.checkDuration = Date.now() - startTime;
      compatibility.performance.complexity = this.calculateComplexity(saveData, adventureData);

      // Cache result
      this.compatibilityCache.set(cacheKey, compatibility);

      return compatibility;

    } catch (error) {
      console.error('Compatibility check failed:', error);
      return {
        isCompatible: false,
        overallScore: 0,
        error: error.message,
        issues: {
          blocking: [`Compatibility check failed: ${error.message}`],
          warnings: [],
          suggestions: []
        }
      };
    }
  }

  /**
   * Check cross-game save compatibility
   * @param {Object} crossGameSave - Cross-game save data
   * @param {Object} targetAdventure - Target adventure data
   * @param {Object} options - Check options
   * @returns {Object} Cross-game compatibility report
   */
  checkCrossGameCompatibility(crossGameSave, targetAdventure, options = {}) {
    try {
      const cacheKey = this.generateCacheKey('crossgame', crossGameSave, targetAdventure, options);
      
      if (this.compatibilityCache.has(cacheKey) && !options.skipCache) {
        return this.compatibilityCache.get(cacheKey);
      }

      const compatibility = {
        isCompatible: true,
        compatibilityScore: 100,
        transferScore: 0,
        issues: {
          blocking: [],
          warnings: [],
          suggestions: []
        },
        transferAnalysis: {
          stats: this.analyzeCrossGameStats(crossGameSave, targetAdventure),
          inventory: this.analyzeCrossGameInventory(crossGameSave, targetAdventure),
          achievements: this.analyzeCrossGameAchievements(crossGameSave, targetAdventure),
          features: this.analyzeCrossGameFeatures(crossGameSave, targetAdventure)
        },
        recommendations: {
          mappings: this.generateMappingRecommendations(crossGameSave, targetAdventure),
          customizations: this.generateCustomizationSuggestions(crossGameSave, targetAdventure),
          alternatives: this.generateAlternativeSuggestions(crossGameSave, targetAdventure)
        },
        metadata: {
          sourceGame: crossGameSave.sourceAdventure?.title || 'Unknown',
          targetGame: targetAdventure.title || 'Unknown',
          transferPotential: 'medium',
          complexity: 'medium'
        }
      };

      // Check basic format compatibility
      const formatCheck = this.checkCrossGameFormat(crossGameSave);
      if (!formatCheck.isValid) {
        compatibility.isCompatible = false;
        compatibility.issues.blocking.push(...formatCheck.errors);
        return compatibility;
      }

      // Analyze transfer potential
      const transferAnalysis = this.analyzeCrossGameTransferPotential(crossGameSave, targetAdventure);
      compatibility.transferScore = transferAnalysis.score;
      compatibility.issues.warnings.push(...transferAnalysis.warnings);
      compatibility.issues.suggestions.push(...transferAnalysis.suggestions);

      // Check for blocking incompatibilities
      const blockingCheck = this.checkCrossGameBlockingIssues(crossGameSave, targetAdventure);
      if (blockingCheck.hasBlockingIssues) {
        compatibility.isCompatible = false;
        compatibility.issues.blocking.push(...blockingCheck.issues);
      }

      // Calculate final compatibility score
      const scoreFactors = [
        compatibility.transferAnalysis.stats.compatibilityScore * 0.3,
        compatibility.transferAnalysis.inventory.compatibilityScore * 0.2,
        compatibility.transferAnalysis.achievements.compatibilityScore * 0.2,
        compatibility.transferAnalysis.features.compatibilityScore * 0.3
      ];

      compatibility.compatibilityScore = Math.round(
        scoreFactors.reduce((sum, score) => sum + score, 0)
      );

      // Determine transfer potential
      if (compatibility.compatibilityScore >= 80) {
        compatibility.metadata.transferPotential = 'high';
      } else if (compatibility.compatibilityScore >= 50) {
        compatibility.metadata.transferPotential = 'medium';
      } else {
        compatibility.metadata.transferPotential = 'low';
      }

      // Final compatibility decision
      compatibility.isCompatible = 
        compatibility.compatibilityScore >= 30 && 
        compatibility.issues.blocking.length === 0;

      // Cache result
      this.compatibilityCache.set(cacheKey, compatibility);

      return compatibility;

    } catch (error) {
      console.error('Cross-game compatibility check failed:', error);
      return {
        isCompatible: false,
        compatibilityScore: 0,
        transferScore: 0,
        error: error.message,
        issues: {
          blocking: [`Cross-game compatibility check failed: ${error.message}`],
          warnings: [],
          suggestions: []
        }
      };
    }
  }

  /**
   * Check version compatibility between save and adventure
   * @private
   */
  checkVersionCompatibility(saveData, adventureData) {
    const result = {
      score: 100,
      blocking: [],
      warnings: [],
      suggestions: [],
      migrationRequired: false,
      automaticMigration: false
    };

    const saveVersion = saveData.version || '1.0.0';
    const adventureVersion = adventureData.version || '1.0.0';

    // Exact version match
    if (saveVersion === adventureVersion) {
      return result;
    }

    // Check version compatibility matrix
    const compatibility = this.getVersionCompatibility(saveVersion, adventureVersion);
    
    if (compatibility.isCompatible) {
      result.score = compatibility.score;
      result.warnings.push(`Version mismatch: save(${saveVersion}) vs adventure(${adventureVersion})`);
      
      if (compatibility.migrationRequired) {
        result.migrationRequired = true;
        result.automaticMigration = compatibility.automaticMigration;
        result.migrationSteps = compatibility.migrationSteps;
        result.migrationRisks = compatibility.risks;
      }
    } else {
      result.score = 0;
      result.blocking.push(`Incompatible versions: save(${saveVersion}) vs adventure(${adventureVersion})`);
      result.suggestions.push(`Update save format or use adventure version ${compatibility.recommendedVersion}`);
    }

    return result;
  }

  /**
   * Check stats compatibility
   * @private
   */
  checkStatsCompatibility(saveData, adventureData) {
    const result = {
      score: 100,
      blocking: [],
      warnings: [],
      suggestions: []
    };

    const saveStats = saveData.stats || {};
    const adventureStats = new Map();
    
    (adventureData.stats || []).forEach(stat => {
      adventureStats.set(stat.id, stat);
    });

    let matchedStats = 0;
    let totalSaveStats = Object.keys(saveStats).length;
    let missingStats = [];
    let typeConflicts = [];

    // Check each save stat against adventure stats
    Object.entries(saveStats).forEach(([statId, value]) => {
      if (adventureStats.has(statId)) {
        const statDef = adventureStats.get(statId);
        
        // Type compatibility check
        if (!this.isTypeCompatible(value, statDef.type)) {
          typeConflicts.push({
            stat: statId,
            saveType: typeof value,
            expectedType: statDef.type,
            value: value
          });
        } else {
          matchedStats++;
        }
      } else {
        missingStats.push(statId);
      }
    });

    // Calculate score based on compatibility
    const compatibilityRatio = totalSaveStats > 0 ? matchedStats / totalSaveStats : 1;
    result.score = Math.round(compatibilityRatio * 100);

    // Generate issues and suggestions
    if (missingStats.length > 0) {
      result.warnings.push(`Stats not found in adventure: ${missingStats.join(', ')}`);
      result.suggestions.push('These stats will be ignored or reset to defaults');
    }

    if (typeConflicts.length > 0) {
      typeConflicts.forEach(conflict => {
        result.warnings.push(
          `Type mismatch for ${conflict.stat}: ${conflict.saveType} vs ${conflict.expectedType}`
        );
      });
      result.suggestions.push('Type conflicts will be resolved through automatic conversion');
    }

    return result;
  }

  /**
   * Check scenes compatibility
   * @private
   */
  checkScenesCompatibility(saveData, adventureData) {
    const result = {
      score: 100,
      blocking: [],
      warnings: [],
      suggestions: []
    };

    const currentSceneId = saveData.currentSceneId;
    const visitedScenes = saveData.visitedScenes || [];
    const adventureScenes = new Map();
    
    (adventureData.scenes || []).forEach(scene => {
      adventureScenes.set(scene.id, scene);
    });

    // Check current scene exists
    if (currentSceneId && !adventureScenes.has(currentSceneId)) {
      result.blocking.push(`Current scene '${currentSceneId}' not found in adventure`);
      result.suggestions.push(`Will reset to start scene: ${adventureData.startSceneId}`);
      result.score -= 30;
    }

    // Check visited scenes
    const missingVisitedScenes = visitedScenes.filter(sceneId => !adventureScenes.has(sceneId));
    
    if (missingVisitedScenes.length > 0) {
      const missingRatio = missingVisitedScenes.length / Math.max(visitedScenes.length, 1);
      result.score -= Math.round(missingRatio * 20);
      result.warnings.push(`${missingVisitedScenes.length} visited scenes no longer exist`);
      result.suggestions.push('Progress tracking may be affected');
    }

    return result;
  }

  /**
   * Check choices compatibility
   * @private
   */
  checkChoicesCompatibility(saveData, adventureData) {
    const result = {
      score: 100,
      blocking: [],
      warnings: [],
      suggestions: []
    };

    const choiceHistory = saveData.choiceHistory || [];
    const adventureScenes = new Map();
    
    (adventureData.scenes || []).forEach(scene => {
      adventureScenes.set(scene.id, scene);
    });

    let validChoices = 0;
    let invalidChoices = 0;
    const invalidChoiceDetails = [];

    // Validate each choice in history
    choiceHistory.forEach(choiceRecord => {
      const scene = adventureScenes.get(choiceRecord.sceneId);
      
      if (!scene) {
        invalidChoices++;
        invalidChoiceDetails.push({
          type: 'missing_scene',
          sceneId: choiceRecord.sceneId,
          choiceId: choiceRecord.choiceId
        });
        return;
      }

      const choice = scene.choices?.find(c => c.id === choiceRecord.choiceId);
      
      if (!choice) {
        invalidChoices++;
        invalidChoiceDetails.push({
          type: 'missing_choice',
          sceneId: choiceRecord.sceneId,
          choiceId: choiceRecord.choiceId
        });
      } else {
        validChoices++;
      }
    });

    // Calculate score
    const totalChoices = validChoices + invalidChoices;
    if (totalChoices > 0) {
      result.score = Math.round((validChoices / totalChoices) * 100);
    }

    // Generate warnings and suggestions
    if (invalidChoices > 0) {
      result.warnings.push(`${invalidChoices} choice(s) in history are no longer valid`);
      result.suggestions.push('Choice history will be partially preserved');
      
      const sceneIssues = invalidChoiceDetails.filter(d => d.type === 'missing_scene').length;
      const choiceIssues = invalidChoiceDetails.filter(d => d.type === 'missing_choice').length;
      
      if (sceneIssues > 0) {
        result.warnings.push(`${sceneIssues} choices reference deleted scenes`);
      }
      if (choiceIssues > 0) {
        result.warnings.push(`${choiceIssues} choices have been modified or removed`);
      }
    }

    return result;
  }

  /**
   * Check inventory compatibility
   * @private
   */
  checkInventoryCompatibility(saveData, adventureData) {
    const result = {
      score: 100,
      blocking: [],
      warnings: [],
      suggestions: []
    };

    const saveInventory = saveData.inventory || {};
    const adventureItems = new Map();
    
    (adventureData.items || []).forEach(item => {
      adventureItems.set(item.id, item);
    });

    let validItems = 0;
    let invalidItems = 0;
    const invalidItemDetails = [];

    // Check each item in save inventory
    Object.entries(saveInventory).forEach(([itemId, itemData]) => {
      if (adventureItems.has(itemId)) {
        validItems++;
      } else {
        invalidItems++;
        invalidItemDetails.push({
          itemId: itemId,
          quantity: itemData.quantity || 1
        });
      }
    });

    // Calculate score
    const totalItems = validItems + invalidItems;
    if (totalItems > 0) {
      result.score = Math.round((validItems / totalItems) * 100);
    }

    // Generate warnings and suggestions
    if (invalidItems > 0) {
      result.warnings.push(`${invalidItems} item(s) in inventory are no longer available`);
      result.suggestions.push('Invalid items will be removed from inventory');
      
      const totalInvalidQuantity = invalidItemDetails.reduce((sum, item) => sum + item.quantity, 0);
      if (totalInvalidQuantity > 1) {
        result.warnings.push(`${totalInvalidQuantity} total items will be lost`);
      }
    }

    return result;
  }

  /**
   * Check features compatibility
   * @private
   */
  checkFeaturesCompatibility(saveData, adventureData) {
    const result = {
      score: 100,
      blocking: [],
      warnings: [],
      suggestions: []
    };

    // Check for save features that adventure might not support
    const saveFeatures = this.extractSaveFeatures(saveData);
    const adventureFeatures = this.extractAdventureFeatures(adventureData);

    const unsupportedFeatures = saveFeatures.filter(
      feature => !adventureFeatures.includes(feature)
    );

    if (unsupportedFeatures.length > 0) {
      const featureRatio = unsupportedFeatures.length / Math.max(saveFeatures.length, 1);
      result.score -= Math.round(featureRatio * 30);
      
      result.warnings.push(`Unsupported features: ${unsupportedFeatures.join(', ')}`);
      result.suggestions.push('Some save data may not function as expected');
    }

    return result;
  }

  /**
   * Analyze cross-game transfer potential
   * @private
   */
  analyzeCrossGameTransferPotential(crossGameSave, targetAdventure) {
    const analysis = {
      score: 50,
      warnings: [],
      suggestions: []
    };

    // Analyze genre compatibility
    const genreCompatibility = this.checkGenreCompatibility(
      crossGameSave.sourceAdventure,
      targetAdventure
    );
    analysis.score += genreCompatibility.bonus;
    analysis.warnings.push(...genreCompatibility.warnings);

    // Analyze complexity compatibility
    const complexityCompatibility = this.checkComplexityCompatibility(
      crossGameSave,
      targetAdventure
    );
    analysis.score += complexityCompatibility.bonus;
    analysis.warnings.push(...complexityCompatibility.warnings);

    // Analyze feature overlap
    const featureOverlap = this.calculateFeatureOverlap(
      crossGameSave.compatibility.supportedFeatures,
      this.extractAdventureFeatures(targetAdventure)
    );
    analysis.score += featureOverlap.bonus;
    analysis.suggestions.push(...featureOverlap.suggestions);

    return analysis;
  }

  /**
   * Utility methods
   * @private
   */
  getVersionCompatibility(saveVersion, adventureVersion) {
    const key = `${saveVersion}_${adventureVersion}`;
    
    if (this.versionCompatibility.has(key)) {
      return this.versionCompatibility.get(key);
    }

    // Default compatibility logic
    const saveParts = saveVersion.split('.').map(Number);
    const advParts = adventureVersion.split('.').map(Number);

    // Major version mismatch is incompatible
    if (saveParts[0] !== advParts[0]) {
      return {
        isCompatible: false,
        score: 0,
        recommendedVersion: adventureVersion
      };
    }

    // Minor version differences may require migration
    if (saveParts[1] !== advParts[1]) {
      return {
        isCompatible: true,
        score: 80,
        migrationRequired: true,
        automaticMigration: Math.abs(saveParts[1] - advParts[1]) <= 2
      };
    }

    // Patch version differences are usually compatible
    return {
      isCompatible: true,
      score: 95,
      migrationRequired: false
    };
  }

  isTypeCompatible(value, expectedType) {
    const actualType = typeof value;
    
    if (expectedType === 'number') {
      return actualType === 'number' || !isNaN(Number(value));
    }
    
    if (expectedType === 'string') {
      return true; // Most things can be converted to string
    }
    
    if (expectedType === 'boolean') {
      return actualType === 'boolean' || value === 0 || value === 1;
    }
    
    return actualType === expectedType;
  }

  generateCacheKey(type, data1, data2, options) {
    const hash1 = this.simpleHash(JSON.stringify(data1));
    const hash2 = this.simpleHash(JSON.stringify(data2));
    const optionsHash = this.simpleHash(JSON.stringify(options));
    
    return `${type}_${hash1}_${hash2}_${optionsHash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  calculateComplexity(saveData, adventureData) {
    const factors = [
      (saveData.choiceHistory?.length || 0) > 50,
      (adventureData.scenes?.length || 0) > 20,
      (adventureData.stats?.length || 0) > 10,
      Object.keys(saveData.inventory || {}).length > 10
    ];
    
    const complexityScore = factors.filter(Boolean).length;
    
    if (complexityScore >= 3) return 'high';
    if (complexityScore >= 2) return 'medium';
    return 'low';
  }

  extractSaveFeatures(saveData) {
    const features = [];
    
    if (saveData.inventory && Object.keys(saveData.inventory).length > 0) {
      features.push('inventory');
    }
    if (saveData.flags && Object.keys(saveData.flags).length > 0) {
      features.push('flags');
    }
    if (saveData.secretsFound && saveData.secretsFound.length > 0) {
      features.push('secrets');
    }
    if (saveData.achievements && saveData.achievements.length > 0) {
      features.push('achievements');
    }
    
    return features;
  }

  extractAdventureFeatures(adventureData) {
    const features = [];
    
    if (adventureData.items && adventureData.items.length > 0) {
      features.push('inventory');
    }
    if (adventureData.flagDefinitions && adventureData.flagDefinitions.length > 0) {
      features.push('flags');
    }
    // Additional feature detection logic...
    
    return features;
  }

  initializeCompatibilityRules() {
    // Version compatibility rules
    this.versionCompatibility.set('1.0.0_1.0.1', {
      isCompatible: true,
      score: 100,
      migrationRequired: false
    });
    
    this.versionCompatibility.set('1.0.0_1.1.0', {
      isCompatible: true,
      score: 90,
      migrationRequired: true,
      automaticMigration: true
    });
    
    // Feature compatibility rules
    this.featureCompatibility.set('inventory', ['items', 'equipment', 'tools']);
    this.featureCompatibility.set('stats', ['attributes', 'skills', 'properties']);
  }

  // Additional placeholder methods for cross-game analysis
  analyzeCrossGameStats() { return { compatibilityScore: 80 }; }
  analyzeCrossGameInventory() { return { compatibilityScore: 70 }; }
  analyzeCrossGameAchievements() { return { compatibilityScore: 90 }; }
  analyzeCrossGameFeatures() { return { compatibilityScore: 75 }; }
  checkCrossGameFormat() { return { isValid: true, errors: [] }; }
  checkCrossGameBlockingIssues() { return { hasBlockingIssues: false, issues: [] }; }
  generateMappingRecommendations() { return []; }
  generateCustomizationSuggestions() { return []; }
  generateAlternativeSuggestions() { return []; }
  checkGenreCompatibility() { return { bonus: 10, warnings: [] }; }
  checkComplexityCompatibility() { return { bonus: 5, warnings: [] }; }
  calculateFeatureOverlap() { return { bonus: 15, suggestions: [] }; }
}

export default new CompatibilityChecker();