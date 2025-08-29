// ConditionParser.js - Enhanced version with Phase 3 advanced features and caching
export class ConditionParser {
  constructor(statsManager, visitedScenes = [], inventoryManager = null, choiceHistory = []) {
    this.statsManager = statsManager;
    this.visitedScenes = visitedScenes;
    this.inventoryManager = inventoryManager;
    this.choiceHistory = choiceHistory;
    
    // Performance optimization: condition evaluation cache
    this.evaluationCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalEvaluations: 0
    };
    
    // Cache invalidation tracking
    this.lastStatsVersion = this.statsManager?.getVersion?.() || 0;
    this.lastVisitedScenesLength = visitedScenes.length;
    this.lastInventoryVersion = this.inventoryManager?.getVersion?.() || 0;
    this.lastChoiceHistoryLength = choiceHistory.length;
    
    // Performance: limit cache size to prevent memory bloat
    this.maxCacheSize = 1000;
    this.cacheCleanupThreshold = 800; // Start cleanup when we hit this
  }

  // Generate a cache key for a condition
  generateCacheKey(condition) {
    // Create a deterministic key based on condition properties
    const keyParts = [
      condition.type,
      condition.operator,
      condition.key,
      JSON.stringify(condition.value), // Handle complex values
      condition.logic,
      // Include relevant state versions for cache invalidation
      this.lastStatsVersion,
      this.lastVisitedScenesLength,
      this.lastInventoryVersion,
      this.lastChoiceHistoryLength
    ];
    
    // Handle nested conditions for complex conditions
    if (condition.conditions) {
      keyParts.push(JSON.stringify(condition.conditions));
    }
    
    return keyParts.join('|');
  }

  // Check if cache needs invalidation due to state changes
  shouldInvalidateCache() {
    const statsVersion = this.statsManager?.getVersion?.() || 0;
    const visitedScenesLength = this.visitedScenes.length;
    const inventoryVersion = this.inventoryManager?.getVersion?.() || 0;
    const choiceHistoryLength = this.choiceHistory.length;
    
    const hasChanged = (
      statsVersion !== this.lastStatsVersion ||
      visitedScenesLength !== this.lastVisitedScenesLength ||
      inventoryVersion !== this.lastInventoryVersion ||
      choiceHistoryLength !== this.lastChoiceHistoryLength
    );
    
    if (hasChanged) {
      this.lastStatsVersion = statsVersion;
      this.lastVisitedScenesLength = visitedScenesLength;
      this.lastInventoryVersion = inventoryVersion;
      this.lastChoiceHistoryLength = choiceHistoryLength;
      return true;
    }
    
    return false;
  }

  // Clean up cache when it gets too large
  cleanupCache() {
    if (this.evaluationCache.size <= this.cacheCleanupThreshold) return;
    
    // Convert to array and sort by access frequency (if we tracked it) or just clear oldest
    const entries = Array.from(this.evaluationCache.entries());
    
    // Simple strategy: keep the most recent half of entries
    const keepCount = Math.floor(this.maxCacheSize / 2);
    const toKeep = entries.slice(-keepCount);
    
    this.evaluationCache.clear();
    toKeep.forEach(([key, value]) => {
      this.evaluationCache.set(key, value);
    });
  }

  // Get cache performance stats (for debugging/monitoring)
  getCacheStats() {
    const hitRate = this.cacheStats.totalEvaluations > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalEvaluations * 100).toFixed(1)
      : '0.0';
      
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      cacheSize: this.evaluationCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }

  // Clear all caches (useful for testing or major state changes)
  clearCache() {
    this.evaluationCache.clear();
    this.cacheStats = { hits: 0, misses: 0, totalEvaluations: 0 };
  }

  // Evaluate a single condition with caching
  evaluateCondition(condition) {
    // Performance tracking
    this.cacheStats.totalEvaluations++;
    
    // Check for cache invalidation
    if (this.shouldInvalidateCache()) {
      this.clearCache();
    }
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(condition);
    
    // Check cache first
    if (this.evaluationCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.evaluationCache.get(cacheKey);
    }
    
    // Cache miss - perform actual evaluation
    this.cacheStats.misses++;
    const result = this.evaluateConditionInternal(condition);
    
    // Store in cache
    this.evaluationCache.set(cacheKey, result);
    
    // Cleanup cache if needed
    if (this.evaluationCache.size > this.maxCacheSize) {
      this.cleanupCache();
    }
    
    return result;
  }

  // Internal evaluation method (the original logic)
  evaluateConditionInternal(condition) {
    const { type, operator, key, value, logic } = condition;
    
    // Handle complex conditions with logical operators
    if (condition.conditions && Array.isArray(condition.conditions)) {
      return this.evaluateComplexCondition(condition);
    }
    
    let currentValue;

    // Get current value based on condition type
    switch (type) {
      case 'stat':
        currentValue = this.statsManager.getStat(key);
        break;
      case 'flag':
        currentValue = this.statsManager.hasFlag(key);
        break;
      case 'scene_visited':
        currentValue = this.visitedScenes.includes(key);
        break;
      case 'has_item':
        if (!this.inventoryManager) {
          console.warn('ConditionParser: has_item condition requires inventoryManager');
          return false;
        }
        currentValue = this.inventoryManager.hasItem(key);
        break;
      case 'item_count':
        if (!this.inventoryManager) {
          console.warn('ConditionParser: item_count condition requires inventoryManager');
          return false;
        }
        currentValue = this.inventoryManager.getItemCount(key);
        break;
      case 'inventory_category':
        if (!this.inventoryManager) {
          console.warn('ConditionParser: inventory_category condition requires inventoryManager');
          return false;
        }
        const categoryItems = this.inventoryManager.getItemsByCategory(key);
        currentValue = categoryItems.length;
        break;
      case 'choice_made':
        currentValue = this.choiceHistory.some(choice => 
          choice.choiceId === key || 
          (choice.sceneId === key && choice.choiceId === value)
        );
        break;
      case 'choice_made_count':
        if (value) {
          // Count specific choice in specific scene
          currentValue = this.choiceHistory.filter(choice => 
            choice.sceneId === key && choice.choiceId === value
          ).length;
        } else {
          // Count all choices made in scene
          currentValue = this.choiceHistory.filter(choice => 
            choice.sceneId === key
          ).length;
        }
        break;
      case 'scene_visit_count':
        currentValue = this.choiceHistory.filter(choice => 
          choice.sceneId === key
        ).length;
        break;
      case 'total_choices':
        currentValue = this.choiceHistory.length;
        break;
      case 'unique_scenes_visited':
        currentValue = this.visitedScenes.length;
        break;
      case 'inventory_total':
        if (!this.inventoryManager) {
          console.warn('ConditionParser: inventory_total condition requires inventoryManager');
          return false;
        }
        currentValue = this.inventoryManager.getTotalItemCount();
        break;
      case 'inventory_weight':
        if (!this.inventoryManager) {
          console.warn('ConditionParser: inventory_weight condition requires inventoryManager');
          return false;
        }
        currentValue = this.inventoryManager.getTotalWeight();
        break;
      case 'inventory_value':
        if (!this.inventoryManager) {
          console.warn('ConditionParser: inventory_value condition requires inventoryManager');
          return false;
        }
        currentValue = this.inventoryManager.getTotalValue();
        break;
      default:
        console.warn('ConditionParser: Unknown condition type:', type);
        return false;
    }

    // Evaluate based on operator
    return this.compareValues(currentValue, operator, value);
  }

  // Evaluate complex conditions with logical operators (AND, OR, NOT)
  evaluateComplexCondition(condition) {
    const { logic = 'AND', conditions } = condition;
    
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return true;
    }

    switch (logic.toUpperCase()) {
      case 'AND':
        return conditions.every(subCondition => this.evaluateCondition(subCondition));
      
      case 'OR':
        return conditions.some(subCondition => this.evaluateCondition(subCondition));
      
      case 'NOT':
        // NOT logic applies to all sub-conditions (none should be true)
        return !conditions.some(subCondition => this.evaluateCondition(subCondition));
      
      case 'XOR':
        // Exclusive OR - exactly one condition should be true
        const trueCount = conditions.filter(subCondition => 
          this.evaluateCondition(subCondition)
        ).length;
        return trueCount === 1;
      
      case 'NAND':
        // NOT AND - not all conditions are true
        return !conditions.every(subCondition => this.evaluateCondition(subCondition));
      
      case 'NOR':
        // NOT OR - none of the conditions are true
        return !conditions.some(subCondition => this.evaluateCondition(subCondition));
      
      default:
        console.warn('ConditionParser: Unknown logic operator:', logic);
        return false;
    }
  }

  // Evaluate multiple conditions (defaults to AND logic for backward compatibility)
  evaluateConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;
    
    // Check if this is a complex condition structure
    if (conditions.length === 1 && conditions[0].logic && conditions[0].conditions) {
      return this.evaluateComplexCondition(conditions[0]);
    }
    
    // Default to AND logic for simple condition arrays
    return conditions.every(condition => this.evaluateCondition(condition));
  }

  // Compare values with enhanced operators
  compareValues(current, operator, target) {
    switch (operator) {
      case 'eq':
      case '==':
        return current === target;
      case 'ne':
      case '!=':
        return current !== target;
      case 'gt':
      case '>':
        return current > target;
      case 'gte':
      case '>=':
        return current >= target;
      case 'lt':
      case '<':
        return current < target;
      case 'lte':
      case '<=':
        return current <= target;
      case 'contains':
        if (typeof current === 'string' && typeof target === 'string') {
          return current.toLowerCase().includes(target.toLowerCase());
        }
        if (Array.isArray(current)) {
          return current.includes(target);
        }
        return false;
      case 'not_contains':
        if (typeof current === 'string' && typeof target === 'string') {
          return !current.toLowerCase().includes(target.toLowerCase());
        }
        if (Array.isArray(current)) {
          return !current.includes(target);
        }
        return true;
      case 'starts_with':
        if (typeof current === 'string' && typeof target === 'string') {
          return current.toLowerCase().startsWith(target.toLowerCase());
        }
        return false;
      case 'ends_with':
        if (typeof current === 'string' && typeof target === 'string') {
          return current.toLowerCase().endsWith(target.toLowerCase());
        }
        return false;
      case 'matches':
        if (typeof current === 'string' && typeof target === 'string') {
          try {
            const regex = new RegExp(target, 'i');
            return regex.test(current);
          } catch (e) {
            console.warn('ConditionParser: Invalid regex pattern:', target);
            return false;
          }
        }
        return false;
      case 'in':
        if (Array.isArray(target)) {
          return target.includes(current);
        }
        return false;
      case 'not_in':
        if (Array.isArray(target)) {
          return !target.includes(current);
        }
        return true;
      case 'between':
        if (Array.isArray(target) && target.length === 2) {
          return current >= target[0] && current <= target[1];
        }
        return false;
      case 'not_between':
        if (Array.isArray(target) && target.length === 2) {
          return current < target[0] || current > target[1];
        }
        return true;
      default:
        console.warn('ConditionParser: Unknown operator:', operator);
        return false;
    }
  }

  // Update visited scenes for scene_visited conditions
  updateVisitedScenes(scenes) {
    this.visitedScenes = [...scenes];
  }

  // Update choice history for choice-related conditions
  updateChoiceHistory(history) {
    this.choiceHistory = [...history];
  }

  // Update inventory manager reference
  updateInventoryManager(inventoryManager) {
    this.inventoryManager = inventoryManager;
  }

  // Validate condition syntax
  validateCondition(condition) {
    if (!condition || typeof condition !== 'object') {
      return { valid: false, error: 'Condition must be an object' };
    }

    // Handle complex conditions
    if (condition.conditions && Array.isArray(condition.conditions)) {
      const { logic } = condition;
      const validLogic = ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'];
      
      if (logic && !validLogic.includes(logic.toUpperCase())) {
        return { valid: false, error: `Invalid logic operator: ${logic}` };
      }

      // Validate sub-conditions
      for (const subCondition of condition.conditions) {
        const subValidation = this.validateCondition(subCondition);
        if (!subValidation.valid) {
          return subValidation;
        }
      }
      return { valid: true };
    }

    // Validate simple conditions
    const { type, operator, key } = condition;
    
    if (!type) {
      return { valid: false, error: 'Condition must have a type' };
    }

    if (!operator) {
      return { valid: false, error: 'Condition must have an operator' };
    }

    if (!key && type !== 'total_choices' && type !== 'unique_scenes_visited') {
      return { valid: false, error: 'Condition must have a key' };
    }

    const validTypes = [
      'stat', 'flag', 'scene_visited', 'has_item', 'item_count', 
      'inventory_category', 'choice_made', 'choice_made_count', 
      'scene_visit_count', 'total_choices', 'unique_scenes_visited',
      'inventory_total', 'inventory_weight', 'inventory_value'
    ];

    if (!validTypes.includes(type)) {
      return { valid: false, error: `Invalid condition type: ${type}` };
    }

    const validOperators = [
      'eq', '==', 'ne', '!=', 'gt', '>', 'gte', '>=', 'lt', '<', 'lte', '<=',
      'contains', 'not_contains', 'starts_with', 'ends_with', 'matches',
      'in', 'not_in', 'between', 'not_between'
    ];

    if (!validOperators.includes(operator)) {
      return { valid: false, error: `Invalid operator: ${operator}` };
    }

    return { valid: true };
  }

  // Get condition description for UI display
  getConditionDescription(condition) {
    if (!condition) return 'Invalid condition';

    // Handle complex conditions
    if (condition.conditions && Array.isArray(condition.conditions)) {
      const { logic = 'AND', conditions } = condition;
      const descriptions = conditions.map(c => this.getConditionDescription(c));
      
      switch (logic.toUpperCase()) {
        case 'AND':
          return descriptions.join(' AND ');
        case 'OR':
          return descriptions.join(' OR ');
        case 'NOT':
          return `NOT (${descriptions.join(' OR ')})`;
        case 'XOR':
          return `ONLY ONE OF (${descriptions.join(', ')})`;
        default:
          return descriptions.join(` ${logic} `);
      }
    }

    // Handle simple conditions
    const { type, operator, key, value } = condition;
    
    const typeDescriptions = {
      stat: `Stat "${key}"`,
      flag: `Flag "${key}"`,
      scene_visited: `Visited scene "${key}"`,
      has_item: `Has item "${key}"`,
      item_count: `Count of "${key}"`,
      inventory_category: `Items in category "${key}"`,
      choice_made: `Made choice "${key}"`,
      choice_made_count: `Times made choice "${key}"`,
      scene_visit_count: `Times visited "${key}"`,
      total_choices: 'Total choices made',
      unique_scenes_visited: 'Unique scenes visited',
      inventory_total: 'Total inventory items',
      inventory_weight: 'Total inventory weight',
      inventory_value: 'Total inventory value'
    };

    const operatorDescriptions = {
      'eq': 'equals', '==': 'equals',
      'ne': 'not equals', '!=': 'not equals',
      'gt': 'greater than', '>': 'greater than',
      'gte': 'greater than or equal', '>=': 'greater than or equal',
      'lt': 'less than', '<': 'less than',
      'lte': 'less than or equal', '<=': 'less than or equal',
      'contains': 'contains',
      'not_contains': 'does not contain',
      'starts_with': 'starts with',
      'ends_with': 'ends with',
      'matches': 'matches pattern',
      'in': 'is one of',
      'not_in': 'is not one of',
      'between': 'is between',
      'not_between': 'is not between'
    };

    const typeDesc = typeDescriptions[type] || type;
    const operatorDesc = operatorDescriptions[operator] || operator;
    
    if (value !== undefined) {
      if (Array.isArray(value)) {
        return `${typeDesc} ${operatorDesc} [${value.join(', ')}]`;
      }
      return `${typeDesc} ${operatorDesc} ${value}`;
    }
    
    return `${typeDesc} ${operatorDesc}`;
  }

  // Debug helper
  debugCondition(condition, includeEvaluation = true) {
    const description = this.getConditionDescription(condition);
    const validation = this.validateCondition(condition);
    
    const debug = {
      description,
      valid: validation.valid,
      error: validation.error || null
    };

    if (includeEvaluation && validation.valid) {
      debug.result = this.evaluateCondition(condition);
    }

    return debug;
  }
}