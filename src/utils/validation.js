// validation.js - Enhanced with Phase 3 advanced validation features
import { compatibilityChecker } from '../utils/compatibilityChecker.js';

// Enhanced adventure validation with Phase 3 features
export function validateAdventure(adventure) {
  if (!adventure || typeof adventure !== 'object') return false;
  
  const required = ['id', 'title', 'author', 'version', 'scenes', 'stats', 'startSceneId'];
  if (!required.every(field => field in adventure)) return false;
  
  if (!Array.isArray(adventure.scenes) || !Array.isArray(adventure.stats)) return false;
  
  // Validate scenes with Phase 3 features
  if (!adventure.scenes.every(scene => validateScene(scene, adventure))) return false;
  
  // Validate start scene exists
  if (!adventure.scenes.some(s => s.id === adventure.startSceneId)) return false;
  
  // Validate stats with enhanced types
  if (!adventure.stats.every(validateStatDefinition)) return false;
  
  // Phase 3 validations
  if (adventure.inventory && !validateInventoryItems(adventure.inventory)) return false;
  if (adventure.achievements && !validateAchievements(adventure.achievements)) return false;
  if (adventure.flags && !validateFlagDefinitions(adventure.flags)) return false;
  if (adventure.crossGameCompatibility && !validateCrossGameCompatibility(adventure.crossGameCompatibility)) return false;
  
  return true;
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