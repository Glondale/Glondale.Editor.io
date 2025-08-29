// validation.js - Refactored to use ValidationService with backward compatibility
import { validationService } from '../services/ValidationService.js';
import compatibilityChecker from './compatibilityChecker.js';
import { logError, logWarning, logInfo } from './errorLogger.js';

// Enhanced adventure validation with graceful degradation and recovery
// Now delegates to ValidationService for consistency
export async function validateAdventure(adventure, options = {}) {
  try {
    // Use new ValidationService with legacy options mapping
    const serviceOptions = {
      ...options,
      legacyMode: true, // Enable backward compatibility features
      enableFixes: true,
      enableGracefulDegradation: true
    };
    
    const serviceResult = await validationService.validate(adventure, serviceOptions);
    
    // Map ValidationService result to legacy format
    const result = {
      isValid: serviceResult.isValid,
      errors: serviceResult.errors.map(error => 
        typeof error === 'string' ? error : error.message
      ),
      warnings: serviceResult.warnings.map(warning => 
        typeof warning === 'string' ? warning : warning.message
      ),
      fixes: serviceResult.fixes.map(fix => 
        typeof fix === 'string' ? fix : fix.description || fix.message
      ),
      correctedData: serviceResult.correctedData,
      severity: serviceResult.severity
    };

    // Log validation results for backward compatibility
    if (result.errors.length > 0) {
      logWarning('Adventure validation found errors', {
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        fixCount: result.fixes.length,
        adventureId: adventure?.id
      });
    }

    return result;

  } catch (validationError) {
    logError({
      type: 'validation_system_error',
      message: `Validation system error: ${validationError.message}`,
      error: validationError
    }, { adventureId: adventure?.id });

    return {
      isValid: false,
      errors: [`Validation system error: ${validationError.message}`],
      warnings: [],
      fixes: [],
      correctedData: null,
      severity: 'critical'
    };
  }
}

// Validate basic adventure structure with recovery
function validateAdventureStructure(adventure) {
  const result = { errors: [], warnings: [], fixes: [], correctedData: null };
  
  // Handle null/undefined adventure
  if (!adventure) {
    return {
      errors: ['Adventure data is null or undefined'],
      warnings: [],
      fixes: ['Provide valid adventure data object'],
      correctedData: createMinimalAdventure()
    };
  }
  
  // Handle non-object adventure
  if (typeof adventure !== 'object') {
    return {
      errors: ['Adventure data must be an object'],
      warnings: [],
      fixes: ['Ensure adventure data is a valid object'],
      correctedData: createMinimalAdventure()
    };
  }
  
  // Handle array instead of object (common mistake)
  if (Array.isArray(adventure)) {
    result.errors.push('Adventure data is an array, expected object');
    result.fixes.push('Wrap adventure data in an object structure');
    
    // Try to extract adventure from array
    if (adventure.length > 0 && typeof adventure[0] === 'object') {
      result.correctedData = adventure[0];
      result.fixes.push('Using first array element as adventure data');
    } else {
      result.correctedData = createMinimalAdventure();
    }
    
    return result;
  }
  
  result.correctedData = { ...adventure };
  return result;
}

// Validate required fields with auto-correction
function validateRequiredFields(adventure) {
  const result = { errors: [], warnings: [], fixes: [], correctedData: { ...adventure } };
  
  const requiredFields = {
    id: () => `adventure_${Date.now()}`,
    title: () => 'Untitled Adventure',
    author: () => 'Unknown Author',
    version: () => '1.0.0',
    scenes: () => [],
    stats: () => [],
    startSceneId: () => null
  };
  
  let corrected = false;
  
  Object.entries(requiredFields).forEach(([field, defaultGenerator]) => {
    if (!(field in adventure)) {
      result.warnings.push(`Missing required field: ${field}`);
      result.correctedData[field] = defaultGenerator();
      result.fixes.push(`Added default ${field}: ${result.correctedData[field]}`);
      corrected = true;
    } else if (adventure[field] === null || adventure[field] === undefined) {
      result.warnings.push(`Field ${field} is null/undefined`);
      result.correctedData[field] = defaultGenerator();
      result.fixes.push(`Replaced null ${field} with default: ${result.correctedData[field]}`);
      corrected = true;
    }
  });
  
  // Validate array fields
  ['scenes', 'stats'].forEach(field => {
    if (!Array.isArray(result.correctedData[field])) {
      result.warnings.push(`Field ${field} is not an array`);
      result.correctedData[field] = [];
      result.fixes.push(`Converted ${field} to empty array`);
      corrected = true;
    }
  });
  
  if (!corrected) {
    result.correctedData = null; // No changes needed
  }
  
  return result;
}

// Validate scenes with recovery
function validateScenesWithRecovery(scenes, adventure) {
  const result = { errors: [], warnings: [], fixes: [], correctedScenes: null };
  
  if (!Array.isArray(scenes)) {
    result.errors.push('Scenes must be an array');
    result.fixes.push('Convert scenes to array format');
    result.correctedScenes = [];
    return result;
  }
  
  if (scenes.length === 0) {
    result.warnings.push('Adventure has no scenes');
    result.fixes.push('Add at least one scene to the adventure');
    return result;
  }
  
  const correctedScenes = [];
  let correctionsMade = false;
  
  scenes.forEach((scene, index) => {
    const sceneResult = validateSceneWithRecovery(scene, index, adventure);
    
    if (sceneResult.errors.length > 0) {
      result.errors.push(...sceneResult.errors.map(e => `Scene ${index}: ${e}`));
    }
    
    if (sceneResult.warnings.length > 0) {
      result.warnings.push(...sceneResult.warnings.map(w => `Scene ${index}: ${w}`));
    }
    
    if (sceneResult.fixes.length > 0) {
      result.fixes.push(...sceneResult.fixes.map(f => `Scene ${index}: ${f}`));
    }
    
    if (sceneResult.correctedScene) {
      correctedScenes.push(sceneResult.correctedScene);
      correctionsMade = true;
    } else {
      correctedScenes.push(scene);
    }
  });
  
  if (correctionsMade) {
    result.correctedScenes = correctedScenes;
  }
  
  return result;
}

// Validate individual scene with recovery
function validateSceneWithRecovery(scene, index, adventure) {
  const result = { errors: [], warnings: [], fixes: [], correctedScene: null };
  
  if (!scene || typeof scene !== 'object') {
    result.errors.push('Scene is not a valid object');
    result.fixes.push('Create basic scene structure');
    result.correctedScene = createMinimalScene(index);
    return result;
  }
  
  const correctedScene = { ...scene };
  let correctionsMade = false;
  
  // Required scene fields
  if (!scene.id) {
    result.warnings.push('Missing scene ID');
    correctedScene.id = `scene_${index}_${Date.now()}`;
    result.fixes.push(`Generated scene ID: ${correctedScene.id}`);
    correctionsMade = true;
  }
  
  if (!scene.title) {
    result.warnings.push('Missing scene title');
    correctedScene.title = `Scene ${index + 1}`;
    result.fixes.push(`Generated scene title: ${correctedScene.title}`);
    correctionsMade = true;
  }
  
  if (!scene.content) {
    result.warnings.push('Scene has no content');
    correctedScene.content = 'This scene needs content.';
    result.fixes.push('Added placeholder content');
    correctionsMade = true;
  }
  
  // Ensure choices is an array
  if (!scene.choices) {
    result.warnings.push('Scene has no choices array');
    correctedScene.choices = [];
    result.fixes.push('Added empty choices array');
    correctionsMade = true;
  } else if (!Array.isArray(scene.choices)) {
    result.warnings.push('Scene choices is not an array');
    correctedScene.choices = [];
    result.fixes.push('Converted choices to empty array');
    correctionsMade = true;
  }
  
  // Validate choices
  if (scene.choices && Array.isArray(scene.choices)) {
    const choiceResults = validateChoicesWithRecovery(scene.choices, scene.id);
    if (choiceResults.warnings.length > 0) {
      result.warnings.push(...choiceResults.warnings);
    }
    if (choiceResults.fixes.length > 0) {
      result.fixes.push(...choiceResults.fixes);
    }
    if (choiceResults.correctedChoices) {
      correctedScene.choices = choiceResults.correctedChoices;
      correctionsMade = true;
    }
  }
  
  // Ensure optional arrays exist
  ['onEnter', 'onExit', 'tags'].forEach(field => {
    if (!scene[field]) {
      correctedScene[field] = [];
      correctionsMade = true;
    } else if (!Array.isArray(scene[field])) {
      result.warnings.push(`Scene ${field} is not an array`);
      correctedScene[field] = [];
      result.fixes.push(`Converted ${field} to empty array`);
      correctionsMade = true;
    }
  });
  
  if (correctionsMade) {
    result.correctedScene = correctedScene;
  }
  
  return result;
}

// Validate choices with recovery
function validateChoicesWithRecovery(choices, sceneId) {
  const result = { warnings: [], fixes: [], correctedChoices: null };
  
  if (choices.length === 0) {
    result.warnings.push('Scene has no choices (may be an ending scene)');
    return result;
  }
  
  const correctedChoices = [];
  let correctionsMade = false;
  
  choices.forEach((choice, index) => {
    const choiceResult = validateChoiceWithRecovery(choice, index, sceneId);
    
    if (choiceResult.warnings.length > 0) {
      result.warnings.push(...choiceResult.warnings.map(w => `Choice ${index}: ${w}`));
    }
    
    if (choiceResult.fixes.length > 0) {
      result.fixes.push(...choiceResult.fixes.map(f => `Choice ${index}: ${f}`));
    }
    
    if (choiceResult.correctedChoice) {
      correctedChoices.push(choiceResult.correctedChoice);
      correctionsMade = true;
    } else {
      correctedChoices.push(choice);
    }
  });
  
  if (correctionsMade) {
    result.correctedChoices = correctedChoices;
  }
  
  return result;
}

// Validate individual choice with recovery
function validateChoiceWithRecovery(choice, index, sceneId) {
  const result = { warnings: [], fixes: [], correctedChoice: null };
  
  if (!choice || typeof choice !== 'object') {
    result.warnings.push('Invalid choice object');
    result.fixes.push('Create basic choice structure');
    result.correctedChoice = createMinimalChoice(index, sceneId);
    return result;
  }
  
  const correctedChoice = { ...choice };
  let correctionsMade = false;
  
  // Required choice fields
  if (!choice.id) {
    correctedChoice.id = `${sceneId}_choice_${index}_${Date.now()}`;
    result.fixes.push(`Generated choice ID: ${correctedChoice.id}`);
    correctionsMade = true;
  }
  
  if (!choice.text) {
    result.warnings.push('Choice has no text');
    correctedChoice.text = `Choice ${index + 1}`;
    result.fixes.push(`Generated choice text: ${correctedChoice.text}`);
    correctionsMade = true;
  }
  
  if (!choice.targetSceneId) {
    result.warnings.push('Choice has no target scene');
    correctedChoice.targetSceneId = null;
    result.fixes.push('Choice needs a target scene to be functional');
    correctionsMade = true;
  }
  
  // Ensure optional arrays exist
  ['conditions', 'actions', 'requirements'].forEach(field => {
    if (choice[field] !== undefined && !Array.isArray(choice[field])) {
      result.warnings.push(`Choice ${field} is not an array`);
      correctedChoice[field] = [];
      result.fixes.push(`Converted ${field} to empty array`);
      correctionsMade = true;
    }
  });
  
  if (correctionsMade) {
    result.correctedChoice = correctedChoice;
  }
  
  return result;
}

// Validate stats with defaults
function validateStatsWithDefaults(stats) {
  const result = { errors: [], warnings: [], fixes: [], correctedStats: null };
  
  if (!Array.isArray(stats)) {
    result.errors.push('Stats must be an array');
    result.fixes.push('Convert stats to array format');
    result.correctedStats = getDefaultStats();
    return result;
  }
  
  if (stats.length === 0) {
    result.warnings.push('Adventure has no stats defined');
    result.fixes.push('Consider adding basic stats like health, score, etc.');
    return result;
  }
  
  const correctedStats = [];
  let correctionsMade = false;
  
  stats.forEach((stat, index) => {
    const statResult = validateStatWithDefaults(stat, index);
    
    if (statResult.errors.length > 0) {
      result.errors.push(...statResult.errors.map(e => `Stat ${index}: ${e}`));
    }
    
    if (statResult.warnings.length > 0) {
      result.warnings.push(...statResult.warnings.map(w => `Stat ${index}: ${w}`));
    }
    
    if (statResult.fixes.length > 0) {
      result.fixes.push(...statResult.fixes.map(f => `Stat ${index}: ${f}`));
    }
    
    if (statResult.correctedStat) {
      correctedStats.push(statResult.correctedStat);
      correctionsMade = true;
    } else {
      correctedStats.push(stat);
    }
  });
  
  if (correctionsMade) {
    result.correctedStats = correctedStats;
  }
  
  return result;
}

// Validate individual stat with defaults
function validateStatWithDefaults(stat, index) {
  const result = { errors: [], warnings: [], fixes: [], correctedStat: null };
  
  if (!stat || typeof stat !== 'object') {
    result.errors.push('Stat is not a valid object');
    result.fixes.push('Create basic stat structure');
    result.correctedStat = createMinimalStat(index);
    return result;
  }
  
  const correctedStat = { ...stat };
  let correctionsMade = false;
  
  // Required stat fields
  if (!stat.id) {
    result.warnings.push('Missing stat ID');
    correctedStat.id = `stat_${index}`;
    result.fixes.push(`Generated stat ID: ${correctedStat.id}`);
    correctionsMade = true;
  }
  
  if (!stat.name) {
    result.warnings.push('Missing stat name');
    correctedStat.name = `Stat ${index + 1}`;
    result.fixes.push(`Generated stat name: ${correctedStat.name}`);
    correctionsMade = true;
  }
  
  if (!stat.type) {
    result.warnings.push('Missing stat type');
    correctedStat.type = 'number';
    result.fixes.push('Set stat type to number');
    correctionsMade = true;
  }
  
  if (stat.defaultValue === undefined) {
    result.warnings.push('Missing stat default value');
    correctedStat.defaultValue = stat.type === 'boolean' ? false : 0;
    result.fixes.push(`Set default value to ${correctedStat.defaultValue}`);
    correctionsMade = true;
  }
  
  if (correctionsMade) {
    result.correctedStat = correctedStat;
  }
  
  return result;
}

// Validate start scene with auto-selection
function validateStartScene(adventure) {
  const result = { errors: [], warnings: [], fixes: [], correctedData: null };
  
  if (!adventure.startSceneId) {
    if (adventure.scenes && adventure.scenes.length > 0) {
      result.warnings.push('No start scene specified');
      const correctedAdventure = { ...adventure, startSceneId: adventure.scenes[0].id };
      result.fixes.push(`Set start scene to first scene: ${adventure.scenes[0].id}`);
      result.correctedData = correctedAdventure;
    } else {
      result.errors.push('No start scene and no scenes available');
      result.fixes.push('Add scenes and specify a start scene');
    }
    return result;
  }
  
  // Check if start scene exists
  if (!adventure.scenes || !adventure.scenes.some(s => s.id === adventure.startSceneId)) {
    result.errors.push(`Start scene '${adventure.startSceneId}' not found`);
    
    if (adventure.scenes && adventure.scenes.length > 0) {
      const correctedAdventure = { ...adventure, startSceneId: adventure.scenes[0].id };
      result.fixes.push(`Changed start scene to first available scene: ${adventure.scenes[0].id}`);
      result.correctedData = correctedAdventure;
    } else {
      result.fixes.push('Add scenes and specify a valid start scene');
    }
  }
  
  return result;
}

// Validate Phase 3 features with fallbacks
function validatePhase3Features(adventure) {
  const result = { warnings: [], fixes: [], correctedData: null };
  const correctedAdventure = { ...adventure };
  let correctionsMade = false;
  
  // Validate inventory items
  if (adventure.inventory && !Array.isArray(adventure.inventory)) {
    result.warnings.push('Inventory is not an array');
    correctedAdventure.inventory = [];
    result.fixes.push('Converted inventory to empty array');
    correctionsMade = true;
  }
  
  // Validate achievements
  if (adventure.achievements && !Array.isArray(adventure.achievements)) {
    result.warnings.push('Achievements is not an array');
    correctedAdventure.achievements = [];
    result.fixes.push('Converted achievements to empty array');
    correctionsMade = true;
  }
  
  // Validate flags
  if (adventure.flags && !Array.isArray(adventure.flags)) {
    result.warnings.push('Flags is not an array');
    correctedAdventure.flags = [];
    result.fixes.push('Converted flags to empty array');
    correctionsMade = true;
  }
  
  if (correctionsMade) {
    result.correctedData = correctedAdventure;
  }
  
  return result;
}

// Determine severity level based on errors and warnings
function determineSeverity(errors, warnings) {
  if (errors.length > 5) return 'critical';
  if (errors.length > 0) return 'error';
  if (warnings.length > 10) return 'warning';
  return 'info';
}

// Helper functions to create minimal valid structures
function createMinimalAdventure() {
  return {
    id: `adventure_${Date.now()}`,
    title: 'Recovered Adventure',
    author: 'System Recovery',
    version: '1.0.0',
    scenes: [createMinimalScene(0)],
    stats: getDefaultStats(),
    startSceneId: `scene_0_${Date.now()}`
  };
}

function createMinimalScene(index) {
  const id = `scene_${index}_${Date.now()}`;
  return {
    id,
    title: `Scene ${index + 1}`,
    content: 'This scene was recovered from corrupted data.',
    choices: [],
    onEnter: [],
    onExit: [],
    tags: []
  };
}

function createMinimalChoice(index, sceneId) {
  return {
    id: `${sceneId}_choice_${index}_${Date.now()}`,
    text: `Choice ${index + 1}`,
    targetSceneId: null,
    conditions: [],
    actions: [],
    requirements: []
  };
}

function createMinimalStat(index) {
  return {
    id: `stat_${index}`,
    name: `Stat ${index + 1}`,
    type: 'number',
    defaultValue: 0
  };
}

function getDefaultStats() {
  return [
    {
      id: 'health',
      name: 'Health',
      type: 'number',
      defaultValue: 100
    },
    {
      id: 'score',
      name: 'Score',
      type: 'number',
      defaultValue: 0
    }
  ];
}

// Backward compatibility: maintain original boolean function
export async function validateAdventureBoolean(adventure) {
  const result = await validateAdventure(adventure);
  return result.isValid;
}

// Backward compatibility: sync version of validate adventure
export function validateAdventureSync(adventure, options = {}) {
  // For sync compatibility, we'll use a simplified validation
  // that doesn't require async operations
  try {
    // Basic structure validation
    if (!adventure || typeof adventure !== 'object' || Array.isArray(adventure)) {
      return {
        isValid: false,
        errors: ['Invalid adventure structure'],
        warnings: [],
        fixes: ['Provide valid adventure object'],
        correctedData: null,
        severity: 'critical'
      };
    }

    const errors = [];
    const warnings = [];
    const fixes = [];

    // Basic required fields
    if (!adventure.title?.trim()) {
      warnings.push('Adventure has no title');
      fixes.push('Add a title to your adventure');
    }

    if (!adventure.startSceneId) {
      errors.push('No start scene specified');
      fixes.push('Specify a start scene ID');
    }

    if (!adventure.scenes || !Array.isArray(adventure.scenes) || adventure.scenes.length === 0) {
      errors.push('Adventure has no scenes');
      fixes.push('Add at least one scene to your adventure');
    } else {
      // Check if start scene exists
      if (adventure.startSceneId && !adventure.scenes.find(s => s.id === adventure.startSceneId)) {
        errors.push(`Start scene '${adventure.startSceneId}' not found`);
        fixes.push('Ensure start scene ID matches an existing scene');
      }

      // Basic scene validation
      adventure.scenes.forEach((scene, index) => {
        if (!scene.id) {
          warnings.push(`Scene ${index} has no ID`);
          fixes.push(`Add ID to scene ${index}`);
        }
        if (!scene.title?.trim()) {
          warnings.push(`Scene ${scene.id || index} has no title`);
          fixes.push(`Add title to scene ${scene.id || index}`);
        }
      });
    }

    const severity = errors.length > 5 ? 'critical' : 
                    errors.length > 0 ? 'error' : 
                    warnings.length > 10 ? 'warning' : 'info';

    return {
      isValid: errors.length === 0 || options.allowErrors,
      errors,
      warnings,
      fixes,
      correctedData: null,
      severity
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation system error: ${error.message}`],
      warnings: [],
      fixes: [],
      correctedData: null,
      severity: 'critical'
    };
  }
}

// Enhanced scene validation with Phase 3 features
export function validateScene(scene, adventure = null) {
  if (!scene || typeof scene !== 'object') return false;
  
  const required = ['id', 'title', 'content', 'choices'];
  if (!required.every(field => field in scene)) return false;
  
  if (!Array.isArray(scene.choices)) return false;
  
  // Validate all choices with enhanced features
  if (!scene.choices.every(choice => validateChoice(choice, adventure))) return false;
  
  // Validate Phase 3 scene properties
  if (scene.requiredItems && !Array.isArray(scene.requiredItems)) return false;
  if (scene.secretUnlocks && !validateSecretUnlocks(scene.secretUnlocks)) return false;
  if (scene.onEnter && !validateActions(scene.onEnter)) return false;
  if (scene.onExit && !validateActions(scene.onExit)) return false;
  if (scene.tags && !Array.isArray(scene.tags)) return false;
  
  return true;
}

// Enhanced choice validation with Phase 3 features
export function validateChoice(choice, adventure = null) {
  if (!choice || typeof choice !== 'object') return false;
  
  const required = ['id', 'text', 'targetSceneId'];
  if (!required.every(field => field in choice && typeof choice[field] === 'string')) return false;
  
  // Validate Phase 3 choice properties
  if (choice.conditions && !validateConditions(choice.conditions)) return false;
  if (choice.actions && !validateActions(choice.actions)) return false;
  if (choice.requirements && !validateRequirements(choice.requirements)) return false;
  if (choice.consequences && !validateConsequences(choice.consequences)) return false;
  if (choice.secretConditions && !validateConditions(choice.secretConditions)) return false;
  
  // Validate choice state properties
  if (choice.isSecret && typeof choice.isSecret !== 'boolean') return false;
  if (choice.isLocked && typeof choice.isLocked !== 'boolean') return false;
  if (choice.isHidden && typeof choice.isHidden !== 'boolean') return false;
  if (choice.oneTime && typeof choice.oneTime !== 'boolean') return false;
  
  // Validate numeric properties
  if (choice.priority !== undefined && typeof choice.priority !== 'number') return false;
  if (choice.cooldown !== undefined && typeof choice.cooldown !== 'number') return false;
  
  // Validate arrays
  if (choice.lockReasons && !Array.isArray(choice.lockReasons)) return false;
  
  return true;
}

// Enhanced stat definition validation with Phase 3 custom types
export function validateStatDefinition(stat) {
  if (!stat || typeof stat !== 'object') return false;
  
  const required = ['id', 'name', 'type', 'defaultValue'];
  if (!required.every(field => field in stat)) return false;
  
  const validTypes = ['number', 'string', 'boolean', 'percentage', 'currency', 'time'];
  if (!validTypes.includes(stat.type) && typeof stat.type !== 'string') return false;
  
  // Validate Phase 3 stat properties
  if (stat.category && typeof stat.category !== 'string') return false;
  if (stat.description && typeof stat.description !== 'string') return false;
  if (stat.unit && typeof stat.unit !== 'string') return false;
  if (stat.precision !== undefined && typeof stat.precision !== 'number') return false;
  if (stat.noExport && typeof stat.noExport !== 'boolean') return false;
  if (stat.tags && !Array.isArray(stat.tags)) return false;
  if (stat.dependencies && !Array.isArray(stat.dependencies)) return false;
  
  // Validate numeric constraints
  if (stat.min !== undefined && typeof stat.min !== 'number') return false;
  if (stat.max !== undefined && typeof stat.max !== 'number') return false;
  if (stat.min !== undefined && stat.max !== undefined && stat.min > stat.max) return false;
  
  return true;
}

// Enhanced save data validation with Phase 3 features
export function validateSaveData(save) {
  if (!save || typeof save !== 'object') return false;
  
  const required = ['version', 'adventureId', 'adventureVersion', 'timestamp', 'currentSceneId', 'stats', 'flags', 'visitedScenes', 'choiceHistory', 'playthroughId'];
  if (!required.every(field => field in save)) return false;
  
  if (typeof save.stats !== 'object' || typeof save.flags !== 'object') return false;
  if (!Array.isArray(save.visitedScenes) || !Array.isArray(save.choiceHistory)) return false;
  
  // Phase 3 save data validation
  if (save.inventory && !validateInventoryState(save.inventory)) return false;
  if (save.inventoryState && !validateInventoryMetadata(save.inventoryState)) return false;
  if (save.secretsDiscovered && !validateSecretsDiscovered(save.secretsDiscovered)) return false;
  if (save.secretChoicesAvailable && !Array.isArray(save.secretChoicesAvailable)) return false;
  if (save.achievements && !validateAchievementProgress(save.achievements)) return false;
  if (save.exportableData && !validateExportableData(save.exportableData)) return false;
  if (save.gameplayMetrics && !validateGameplayMetrics(save.gameplayMetrics)) return false;
  if (save.crossGameImports && !Array.isArray(save.crossGameImports)) return false;
  
  return true;
}

// Inventory item definition validation
export function validateInventoryItems(inventory) {
  if (!Array.isArray(inventory)) return false;
  
  return inventory.every(item => {
    if (!item || typeof item !== 'object') return false;
    
    const required = ['id', 'name', 'category'];
    if (!required.every(field => field in item)) return false;
    
    // Validate item properties
    if (item.stackable && typeof item.stackable !== 'boolean') return false;
    if (item.maxStack !== undefined && typeof item.maxStack !== 'number') return false;
    if (item.weight !== undefined && typeof item.weight !== 'number') return false;
    if (item.value !== undefined && typeof item.value !== 'number') return false;
    if (item.exportable && typeof item.exportable !== 'boolean') return false;
    if (item.unique && typeof item.unique !== 'boolean') return false;
    
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    if (item.rarity && !validRarities.includes(item.rarity)) return false;
    
    if (item.effects && !validateItemEffects(item.effects)) return false;
    if (item.requirements && !validateRequirements(item.requirements)) return false;
    if (item.tags && !Array.isArray(item.tags)) return false;
    
    return true;
  });
}

// Item effects validation
function validateItemEffects(effects) {
  if (!Array.isArray(effects)) return false;
  
  return effects.every(effect => {
    if (!effect || typeof effect !== 'object') return false;
    
    const validTypes = ['stat_modifier', 'flag_set', 'unlock_choice', 'unlock_scene', 'custom'];
    if (!validTypes.includes(effect.type)) return false;
    
    if (effect.duration !== undefined && typeof effect.duration !== 'number') return false;
    if (effect.conditions && !validateConditions(effect.conditions)) return false;
    
    return true;
  });
}

// Achievement validation
export function validateAchievements(achievements) {
  if (!Array.isArray(achievements)) return false;
  
  return achievements.every(achievement => {
    if (!achievement || typeof achievement !== 'object') return false;
    
    const required = ['id', 'name', 'conditions'];
    if (!required.every(field => field in achievement)) return false;
    
    if (!validateConditions(achievement.conditions)) return false;
    
    if (achievement.rewards && !validateActions(achievement.rewards)) return false;
    if (achievement.points !== undefined && typeof achievement.points !== 'number') return false;
    if (achievement.hidden && typeof achievement.hidden !== 'boolean') return false;
    
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    if (achievement.rarity && !validRarities.includes(achievement.rarity)) return false;
    
    return true;
  });
}

// Flag definitions validation
export function validateFlagDefinitions(flags) {
  if (!Array.isArray(flags)) return false;
  
  return flags.every(flag => {
    if (!flag || typeof flag !== 'object') return false;
    
    const required = ['id', 'name'];
    if (!required.every(field => field in flag)) return false;
    
    if (flag.defaultValue !== undefined && typeof flag.defaultValue !== 'boolean') return false;
    if (flag.persistent && typeof flag.persistent !== 'boolean') return false;
    if (flag.exportable && typeof flag.exportable !== 'boolean') return false;
    
    return true;
  });
}

// Cross-game compatibility validation
export function validateCrossGameCompatibility(compatibility) {
  if (!compatibility || typeof compatibility !== 'object') return false;
  
  const required = ['version'];
  if (!required.every(field => field in compatibility)) return false;
  
  if (compatibility.exportableStats && !Array.isArray(compatibility.exportableStats)) return false;
  if (compatibility.exportableFlags && !Array.isArray(compatibility.exportableFlags)) return false;
  if (compatibility.exportableItems && !Array.isArray(compatibility.exportableItems)) return false;
  if (compatibility.compatibleAdventures && !Array.isArray(compatibility.compatibleAdventures)) return false;
  if (compatibility.importRules && !validateImportRules(compatibility.importRules)) return false;
  
  return true;
}

// Advanced condition validation
export function validateConditions(conditions) {
  if (!Array.isArray(conditions)) return false;
  
  return conditions.every(condition => {
    if (!condition || typeof condition !== 'object') return false;
    
    // Handle complex conditions
    if (condition.conditions && Array.isArray(condition.conditions)) {
      const validLogic = ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'];
      if (condition.logic && !validLogic.includes(condition.logic)) return false;
      return validateConditions(condition.conditions);
    }
    
    // Simple condition validation
    const required = ['type', 'operator'];
    if (!required.every(field => field in condition)) return false;
    
    const validTypes = [
      'stat', 'flag', 'scene_visited', 'has_item', 'item_count',
      'inventory_category', 'choice_made', 'choice_made_count',
      'scene_visit_count', 'total_choices', 'unique_scenes_visited',
      'inventory_total', 'inventory_weight', 'inventory_value'
    ];
    if (!validTypes.includes(condition.type)) return false;
    
    const validOperators = [
      'eq', '==', 'ne', '!=', 'gt', '>', 'gte', '>=', 'lt', '<', 'lte', '<=',
      'contains', 'not_contains', 'starts_with', 'ends_with', 'matches',
      'in', 'not_in', 'between', 'not_between'
    ];
    if (!validOperators.includes(condition.operator)) return false;
    
    // Key is required for most condition types
    const keylessTypes = ['total_choices', 'unique_scenes_visited'];
    if (!keylessTypes.includes(condition.type) && !condition.key) return false;
    
    return true;
  });
}

// Enhanced action validation
export function validateActions(actions) {
  if (!Array.isArray(actions)) return false;
  
  return actions.every(action => {
    if (!action || typeof action !== 'object') return false;
    
    const required = ['type', 'key'];
    if (!required.every(field => field in action)) return false;
    
    const validTypes = [
      'set_stat', 'add_stat', 'multiply_stat', 'set_flag', 'toggle_flag',
      'add_inventory', 'remove_inventory', 'set_inventory',
      'add_achievement', 'unlock_secret', 'trigger_event'
    ];
    if (!validTypes.includes(action.type)) return false;
    
    // Phase 3 action properties
    if (action.conditions && !validateConditions(action.conditions)) return false;
    if (action.probability !== undefined && (typeof action.probability !== 'number' || action.probability < 0 || action.probability > 1)) return false;
    if (action.delay !== undefined && typeof action.delay !== 'number') return false;
    
    return true;
  });
}

// Requirements validation
function validateRequirements(requirements) {
  if (!Array.isArray(requirements)) return false;
  
  return requirements.every(req => {
    if (!req || typeof req !== 'object') return false;
    
    const required = ['type', 'key'];
    if (!required.every(field => field in req)) return false;
    
    const validTypes = ['stat', 'flag', 'item', 'scene_visited', 'choice_made', 'custom'];
    if (!validTypes.includes(req.type)) return false;
    
    return true;
  });
}

// Consequences validation
function validateConsequences(consequences) {
  if (!Array.isArray(consequences)) return false;
  
  return consequences.every(cons => {
    if (!cons || typeof cons !== 'object') return false;
    
    const required = ['type', 'description'];
    if (!required.every(field => field in cons)) return false;
    
    const validTypes = ['stat_change', 'item_gain', 'item_loss', 'scene_unlock', 'ending'];
    if (!validTypes.includes(cons.type)) return false;
    
    const validSeverities = ['minor', 'moderate', 'major', 'critical'];
    if (cons.severity && !validSeverities.includes(cons.severity)) return false;
    
    return true;
  });
}

// Secret unlocks validation
function validateSecretUnlocks(unlocks) {
  if (!Array.isArray(unlocks)) return false;
  
  return unlocks.every(unlock => {
    if (!unlock || typeof unlock !== 'object') return false;
    
    const required = ['id', 'type', 'targetId', 'conditions'];
    if (!required.every(field => field in unlock)) return false;
    
    const validTypes = ['choice', 'scene', 'item', 'achievement'];
    if (!validTypes.includes(unlock.type)) return false;
    
    if (!validateConditions(unlock.conditions)) return false;
    if (unlock.permanent && typeof unlock.permanent !== 'boolean') return false;
    
    return true;
  });
}

// Cross-game save validation
export function validateCrossGameSave(saveData) {
  if (!saveData || typeof saveData !== 'object') return false;
  
  const required = ['version', 'sourceAdventure', 'exportTimestamp', 'transferableData'];
  if (!required.every(field => field in saveData)) return false;
  
  if (!saveData.sourceAdventure || typeof saveData.sourceAdventure !== 'object') return false;
  if (!validateExportableData(saveData.transferableData)) return false;
  
  return true;
}

// Exportable data validation
function validateExportableData(data) {
  if (!data || typeof data !== 'object') return false;
  
  if (data.stats && typeof data.stats !== 'object') return false;
  if (data.flags && typeof data.flags !== 'object') return false;
  if (data.inventory && !Array.isArray(data.inventory)) return false;
  if (data.achievements && !Array.isArray(data.achievements)) return false;
  if (data.metadata && typeof data.metadata !== 'object') return false;
  
  return true;
}

// Helper validation functions for save data
function validateInventoryState(inventory) {
  return Array.isArray(inventory) && inventory.every(item => 
    item && typeof item === 'object' && 
    item.id && typeof item.count === 'number'
  );
}

function validateInventoryMetadata(metadata) {
  return metadata && typeof metadata === 'object' &&
    typeof metadata.totalWeight === 'number' &&
    typeof metadata.totalValue === 'number' &&
    typeof metadata.lastModified === 'number';
}

function validateSecretsDiscovered(secrets) {
  return Array.isArray(secrets) && secrets.every(secret =>
    secret && typeof secret === 'object' &&
    secret.choiceId && secret.sceneId && typeof secret.timestamp === 'number'
  );
}

function validateAchievementProgress(achievements) {
  return Array.isArray(achievements) && achievements.every(achievement =>
    achievement && typeof achievement === 'object' &&
    achievement.id && typeof achievement.unlockedTimestamp === 'number'
  );
}

function validateGameplayMetrics(metrics) {
  return metrics && typeof metrics === 'object' &&
    typeof metrics.totalChoicesMade === 'number' &&
    typeof metrics.uniqueScenesVisited === 'number';
}

function validateImportRules(rules) {
  return Array.isArray(rules) && rules.every(rule =>
    rule && typeof rule === 'object'
  );
}

// Compatibility checking integration
export function checkSaveCompatibility(saveData, adventure) {
  if (!compatibilityChecker) return { compatible: false, score: 0 };
  
  return compatibilityChecker.checkCompatibility(saveData, adventure);
}

// Advanced choice properties validation
export function validateAdvancedChoiceProperties(choice) {
  if (!validateChoice(choice)) return false;
  
  // Additional validation for Phase 3 choice features
  if (choice.isSecret) {
    if (!choice.secretConditions || !validateConditions(choice.secretConditions)) return false;
  }
  
  if (choice.isLocked) {
    if (!choice.requirements || !validateRequirements(choice.requirements)) return false;
  }
  
  return true;
}