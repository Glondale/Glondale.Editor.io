import { logError } from '../utils/errorLogger.js';

/**
 * Centralized validation service with caching and advanced analysis
 * Provides comprehensive validation for adventures including:
 * - Basic structure validation
 * - Dead-end detection
 * - Circular reference detection
 * - Stats/flags analysis
 * - Condition complexity analysis
 * - Custom validation rules support
 */
class ValidationService {
  constructor(options = {}) {
    this.validationRules = new Map();
    this.customRules = new Map();
    this.cacheEnabled = options.enableCache !== false;
    this.validationCache = new Map();
    this.maxCacheAge = options.maxCacheAge || 30000; // 30 seconds default
    this.listeners = new Map();
    
    // Performance tracking
    this.validationStats = {
      totalValidations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      lastCleanupTime: Date.now()
    };
    
    // Cache invalidation tracking
    this.cacheInvalidators = new Set();
    
    this.initializeBuiltInRules();
    
    if (options.autoCleanupCache !== false) {
      this.setupCacheCleanup();
    }
  }
  
  /**
   * Main validation method
   */
  async validate(adventure, options = {}) {
    const startTime = Date.now();
    this.validationStats.totalValidations++;
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(adventure, options);
      
      // Check cache first
      if (this.cacheEnabled && !options.skipCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.validationStats.cacheHits++;
          this.emit('validation-cached', { adventure, result: cached });
          return cached;
        }
        this.validationStats.cacheMisses++;
      }
      
      // Build validation context
      const context = this.buildValidationContext(adventure);
      
      // Perform structural analysis
      this.performStructuralAnalysis(context);
      
      // Create result object
      const result = {
        errors: [],
        warnings: [],
        info: [],
        context: options.includeContext ? context : undefined,
        timestamp: Date.now(),
        validationTime: 0
      };
      
      // Run all validation rules
      await this.runValidationRules(adventure, context, result);
      
      // Post-process results
      this.postProcessResults(result);
      
      // Calculate validation time
      const validationTime = Date.now() - startTime;
      result.validationTime = validationTime;
      this.updatePerformanceStats(validationTime);
      
      // Store in cache
      if (this.cacheEnabled) {
        this.storeInCache(cacheKey, result);
      }
      
      // Emit validation event
      this.emit('validation-complete', { adventure, result });
      
      return result;
      
    } catch (error) {
      logError('Validation failed', error);
      const errorResult = {
        errors: [{
          level: 'error',
          message: `Validation system error: ${error.message}`,
          location: 'system',
          fix: 'Check validation system configuration'
        }],
        warnings: [],
        info: [],
        isValid: false,
        severity: 'critical',
        timestamp: Date.now(),
        validationTime: Date.now() - startTime
      };
      
      this.emit('validation-error', { adventure, error });
      return errorResult;
    }
  }
  
  /**
   * Build validation context with all necessary data structures
   */
  buildValidationContext(adventure) {
    const context = {
      // Core data structures
      nodes: new Map(),
      edges: new Map(),
      stats: new Map(),
      flags: new Map(),
      
      // Analysis results
      deadEnds: new Set(),
      circularReferences: new Set(),
      orphanedNodes: new Set(),
      reachabilityMap: new Map(),
      nodeComplexity: new Map(),
      
      // Stats tracking
      usedStats: new Set(),
      unusedStats: new Set(),
      definedStats: new Set(),
      undefinedStatsUsed: new Set(),
      
      // Adventure metadata
      adventureId: adventure.id,
      title: adventure.title,
      startSceneId: adventure.startSceneId
    };
    
    // Process scenes/nodes
    if (adventure.scenes && Array.isArray(adventure.scenes)) {
      adventure.scenes.forEach(scene => {
        if (scene && scene.id) {
          context.nodes.set(scene.id, scene);
        }
      });
    }
    
    // Process stats definitions
    if (adventure.stats && Array.isArray(adventure.stats)) {
      adventure.stats.forEach(stat => {
        if (stat && stat.name) {
          context.stats.set(stat.name, stat);
          context.definedStats.add(stat.name);
        }
      });
    }
    
    // Process flags definitions
    if (adventure.flags && Array.isArray(adventure.flags)) {
      adventure.flags.forEach(flag => {
        if (flag && flag.name) {
          context.flags.set(flag.name, flag);
        }
      });
    }
    
    return context;
  }
  
  /**
   * Perform comprehensive structural analysis
   */
  performStructuralAnalysis(context) {
    this.performReachabilityAnalysis(context);
    this.performCircularReferenceAnalysis(context);
    this.performStatsFlagsAnalysis(context);
    this.performComplexityAnalysis(context);
  }
  
  /**
   * Analyze reachability and find orphaned nodes
   */
  performReachabilityAnalysis(context) {
    const { nodes } = context;
    const visited = new Set();
    const reachable = new Set();
    
    // DFS to find all reachable nodes
    const dfs = (nodeId) => {
      if (visited.has(nodeId) || !nodes.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      reachable.add(nodeId);
      
      const node = nodes.get(nodeId);
      
      // Follow choices
      if (node.choices && Array.isArray(node.choices)) {
        node.choices.forEach(choice => {
          if (choice.targetSceneId) {
            dfs(choice.targetSceneId);
          }
        });
      }
      
      // Follow actions that change scenes
      if (node.actions && Array.isArray(node.actions)) {
        node.actions.forEach(action => {
          if (action.type === 'changeScene' && action.targetSceneId) {
            dfs(action.targetSceneId);
          }
        });
      }
    };
    
    // Start DFS from start scene
    if (context.startSceneId && nodes.has(context.startSceneId)) {
      dfs(context.startSceneId);
    }
    
    // Store reachability information
    context.reachabilityMap = reachable;
    
    // Find unreachable nodes
    nodes.forEach((node, nodeId) => {
      if (!reachable.has(nodeId) && nodeId !== context.startSceneId) {
        context.orphanedNodes.add(nodeId);
      }
    });
  }
  
  /**
   * Detect circular references in scene flow
   */
  performCircularReferenceAnalysis(context) {
    const { nodes } = context;
    const visiting = new Set();
    const visited = new Set();
    
    const dfs = (nodeId, path = []) => {
      if (!nodes.has(nodeId)) return;
      
      if (visiting.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart >= 0) {
          const cycle = path.slice(cycleStart).concat([nodeId]);
          context.circularReferences.add(cycle.join(' -> '));
        }
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visiting.add(nodeId);
      const node = nodes.get(nodeId);
      const currentPath = [...path, nodeId];
      
      // Check choices
      if (node.choices && Array.isArray(node.choices)) {
        node.choices.forEach(choice => {
          if (choice.targetSceneId) {
            dfs(choice.targetSceneId, currentPath);
          }
        });
      }
      
      visiting.delete(nodeId);
      visited.add(nodeId);
    };
    
    // Check from each node
    nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    });
  }
  
  /**
   * Analyze stats and flags usage
   */
  performStatsFlagsAnalysis(context) {
    const { nodes, definedStats } = context;
    
    // Find which stats are used
    nodes.forEach((node, nodeId) => {
      // Check conditions in choices
      if (node.choices && Array.isArray(node.choices)) {
        node.choices.forEach(choice => {
          if (choice.conditions) {
            this.extractStatsFromConditions(choice.conditions, context);
          }
        });
      }
      
      // Check scene conditions
      if (node.conditions) {
        this.extractStatsFromConditions(node.conditions, context);
      }
      
      // Check actions
      if (node.actions && Array.isArray(node.actions)) {
        node.actions.forEach(action => {
          if (action.type === 'modifyStat' && action.statName) {
            context.usedStats.add(action.statName);
            if (!definedStats.has(action.statName)) {
              context.undefinedStatsUsed.add(action.statName);
            }
          }
        });
      }
    });
    
    // Find unused stats
    definedStats.forEach(statName => {
      if (!context.usedStats.has(statName)) {
        context.unusedStats.add(statName);
      }
    });
    
    // Check for dead-end scenes (no choices and no scene-changing actions)
    nodes.forEach((node, nodeId) => {
      const hasChoices = node.choices && Array.isArray(node.choices) && node.choices.length > 0;
      const hasSceneActions = node.actions && Array.isArray(node.actions) && 
        node.actions.some(action => action.type === 'changeScene');
      
      if (!hasChoices && !hasSceneActions) {
        context.deadEnds.add(nodeId);
      }
    });
  }
  
  /**
   * Extract stats/flags from conditions
   */
  extractStatsFromConditions(conditions, context) {
    if (!conditions || typeof conditions !== 'object') return;
    
    const conditionsStr = JSON.stringify(conditions);
    
    // Simple extraction - look for patterns like stat comparisons
    context.definedStats.forEach(statName => {
      if (conditionsStr.includes(statName)) {
        context.usedStats.add(statName);
      }
    });
    
    // Look for undefined stats usage (basic pattern matching)
    const statPattern = /["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*[><=!]/g;
    let match;
    while ((match = statPattern.exec(conditionsStr)) !== null) {
      const statName = match[1];
      context.usedStats.add(statName);
      if (!context.definedStats.has(statName)) {
        context.undefinedStatsUsed.add(statName);
      }
    }
  }
  
  /**
   * Perform complexity analysis on nodes and choices
   */
  performComplexityAnalysis(context) {
    const { nodes } = context;
    
    nodes.forEach((node, nodeId) => {
      let complexity = 0;
      
      // Count conditions
      if (node.conditions) {
        complexity += this.calculateConditionComplexity(node.conditions);
      }
      
      // Count choices and their complexity
      if (node.choices && Array.isArray(node.choices)) {
        complexity += node.choices.length;
        node.choices.forEach(choice => {
          if (choice.conditions) {
            complexity += this.calculateConditionComplexity(choice.conditions);
          }
        });
      }
      
      context.nodeComplexity.set(nodeId, complexity);
    });
  }
  
  /**
   * Calculate complexity score for conditions
   */
  calculateConditionComplexity(conditions) {
    if (!conditions || typeof conditions !== 'object') return 0;
    
    let complexity = 0;
    const conditionStr = JSON.stringify(conditions);
    
    // Count operators
    complexity += (conditionStr.match(/&&|\|\|/g) || []).length;
    // Count comparisons
    complexity += (conditionStr.match(/>|<|==|!=|>=|<=/g) || []).length;
    // Count nested conditions
    complexity += (conditionStr.match(/\{/g) || []).length - 1;
    
    return Math.max(complexity, 0);
  }
  
  /**
   * Run all validation rules against the adventure
   */
  async runValidationRules(adventure, context, result) {
    // Run built-in rules
    for (const [ruleName, rule] of this.validationRules) {
      try {
        await rule(adventure, context, result);
      } catch (error) {
        logError(`Validation rule ${ruleName} failed`, error);
        result.warnings.push({
          level: 'warning',
          message: `Validation rule ${ruleName} encountered an error: ${error.message}`,
          location: 'system',
          fix: 'Check validation rule implementation'
        });
      }
    }
    
    // Run custom rules
    for (const [ruleName, rule] of this.customRules) {
      try {
        await rule(adventure, context, result);
      } catch (error) {
        logError(`Custom validation rule ${ruleName} failed`, error);
        result.warnings.push({
          level: 'warning',
          message: `Custom rule ${ruleName} encountered an error: ${error.message}`,
          location: 'custom',
          fix: 'Check custom rule implementation'
        });
      }
    }
  }
  
  /**
   * Initialize built-in validation rules
   */
  initializeBuiltInRules() {
    // Basic structure validation
    this.addRule('basic-structure', (adventure, context, result) => {
      if (!adventure || typeof adventure !== 'object' || Array.isArray(adventure)) {
        result.errors.push({
          level: 'error',
          message: 'Adventure must be a valid object',
          location: 'root',
          fix: 'Ensure adventure is a properly structured object'
        });
        return;
      }
      
      if (!adventure.title || typeof adventure.title !== 'string' || !adventure.title.trim()) {
        result.warnings.push({
          level: 'warning',
          message: 'Adventure has no title or empty title',
          location: 'title',
          fix: 'Add a descriptive title to your adventure'
        });
      }
    });
    
    // Start scene validation
    this.addRule('start-scene', (adventure, context, result) => {
      if (!adventure.startSceneId) {
        result.errors.push({
          level: 'error',
          message: 'No start scene specified',
          location: 'startSceneId',
          fix: 'Set a valid start scene ID'
        });
        return;
      }
      
      if (!context.nodes.has(adventure.startSceneId)) {
        result.errors.push({
          level: 'error',
          message: `Start scene '${adventure.startSceneId}' not found`,
          location: 'startSceneId',
          fix: 'Ensure start scene ID references an existing scene'
        });
      }
    });
    
    // Dead-end detection
    this.addRule('dead-ends', (adventure, context, result) => {
      if (context.deadEnds.size > 0) {
        const deadEndList = Array.from(context.deadEnds);
        result.warnings.push({
          level: 'warning',
          message: `Found ${deadEndList.length} dead-end scene(s): ${deadEndList.join(', ')}`,
          location: 'scenes',
          fix: 'Add choices or actions to dead-end scenes, or mark them as intentional endings',
          details: { deadEnds: deadEndList }
        });
      }
    });
    
    // Circular reference detection
    this.addRule('circular-references', (adventure, context, result) => {
      if (context.circularReferences.size > 0) {
        const circles = Array.from(context.circularReferences);
        result.warnings.push({
          level: 'warning',
          message: `Found ${circles.length} circular reference(s) in scene flow`,
          location: 'scenes',
          fix: 'Review scene connections to prevent infinite loops',
          details: { circles }
        });
      }
    });
    
    // Orphaned nodes detection
    this.addRule('orphaned-nodes', (adventure, context, result) => {
      if (context.orphanedNodes.size > 0) {
        const orphaned = Array.from(context.orphanedNodes);
        result.warnings.push({
          level: 'warning',
          message: `Found ${orphaned.length} unreachable scene(s): ${orphaned.join(', ')}`,
          location: 'scenes',
          fix: 'Add connections to unreachable scenes or remove them',
          details: { orphaned }
        });
      }
    });
    
    // Unused stats detection
    this.addRule('unused-stats', (adventure, context, result) => {
      if (context.unusedStats.size > 0) {
        const unused = Array.from(context.unusedStats);
        result.info.push({
          level: 'info',
          message: `Found ${unused.length} unused stat(s): ${unused.join(', ')}`,
          location: 'stats',
          fix: 'Remove unused stats or add conditions/actions that use them',
          details: { unusedStats: unused }
        });
      }
    });
    
    // Undefined stats usage
    this.addRule('undefined-stats', (adventure, context, result) => {
      if (context.undefinedStatsUsed.size > 0) {
        const undefined = Array.from(context.undefinedStatsUsed);
        result.errors.push({
          level: 'error',
          message: `Found usage of undefined stat(s): ${undefined.join(', ')}`,
          location: 'scenes',
          fix: 'Define missing stats or fix references',
          details: { undefinedStats: undefined }
        });
      }
    });
    
    // Condition complexity warnings
    this.addRule('condition-complexity', (adventure, context, result) => {
      const complexityThreshold = 10;
      const highComplexityNodes = [];
      
      context.nodeComplexity.forEach((complexity, nodeId) => {
        if (complexity > complexityThreshold) {
          highComplexityNodes.push({ nodeId, complexity });
        }
      });
      
      if (highComplexityNodes.length > 0) {
        result.warnings.push({
          level: 'warning',
          message: `Found ${highComplexityNodes.length} scene(s) with high complexity`,
          location: 'scenes',
          fix: 'Consider simplifying complex scenes by breaking them into smaller scenes',
          details: { highComplexity: highComplexityNodes }
        });
      }
    });
    
    // Scene content validation
    this.addRule('scene-content', (adventure, context, result) => {
      context.nodes.forEach((node, nodeId) => {
        if (!node.title || !node.title.trim()) {
          result.warnings.push({
            level: 'warning',
            message: `Scene '${nodeId}' has no title`,
            location: `scenes.${nodeId}.title`,
            fix: 'Add a descriptive title to this scene'
          });
        }
        
        if (!node.content || !node.content.trim()) {
          result.warnings.push({
            level: 'warning',
            message: `Scene '${nodeId}' has no content`,
            location: `scenes.${nodeId}.content`,
            fix: 'Add content to describe what happens in this scene'
          });
        }
      });
    });
  }
  
  /**
   * Add a validation rule
   */
  addRule(name, rule) {
    if (typeof rule === 'function') {
      this.validationRules.set(name, rule);
      this.invalidateCache();
    } else {
      throw new Error('Validation rule must be a function');
    }
  }
  
  /**
   * Add a custom validation rule (external API)
   */
  addCustomRule(name, rule) {
    if (typeof rule === 'function') {
      this.customRules.set(name, rule);
      this.invalidateCache();
    } else {
      throw new Error('Custom validation rule must be a function');
    }
  }
  
  /**
   * Remove a validation rule
   */
  removeRule(name) {
    const removed = this.validationRules.delete(name) || this.customRules.delete(name);
    if (removed) {
      this.invalidateCache();
    }
    return removed;
  }
  
  /**
   * Post-process validation results
   */
  postProcessResults(result) {
    // Determine overall severity
    result.severity = this.determineSeverity(result.errors, result.warnings, result.info);
    
    // Set validity based on errors
    result.isValid = result.errors.length === 0;
    
    // Sort results by severity and location
    const sortByPriority = (a, b) => {
      const priorityMap = { error: 3, warning: 2, info: 1 };
      const aPriority = priorityMap[a.level] || 0;
      const bPriority = priorityMap[b.level] || 0;
      return bPriority - aPriority;
    };
    
    result.errors.sort(sortByPriority);
    result.warnings.sort(sortByPriority);
    result.info.sort(sortByPriority);
    
    // Generate summary
    result.summary = {
      totalIssues: result.errors.length + result.warnings.length + result.info.length,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      infoCount: result.info.length,
      severity: result.severity,
      isValid: result.isValid
    };
    
    // Extract all fixes
    result.fixes = [
      ...result.errors.map(e => e.fix),
      ...result.warnings.map(w => w.fix),
      ...result.info.map(i => i.fix)
    ].filter(Boolean);
  }
  
  /**
   * Determine overall severity level
   */
  determineSeverity(errors, warnings, info) {
    if (errors.length > 5) return 'critical';
    if (errors.length > 0) return 'error';
    if (warnings.length > 10) return 'warning';
    return 'info';
  }
  
  /**
   * Cache management methods
   */
  generateCacheKey(adventure, options) {
    const contentHash = this.hashObject({
      title: adventure.title,
      startSceneId: adventure.startSceneId,
      sceneCount: adventure.scenes?.length || 0,
      statsCount: adventure.stats?.length || 0,
      lastModified: adventure.lastModified || Date.now()
    });
    
    const optionsHash = this.hashObject(options);
    return `${contentHash}_${optionsHash}`;
  }
  
  /**
   * Simple object hashing for cache keys
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Get result from cache
   */
  getFromCache(cacheKey) {
    if (!this.cacheEnabled) return null;
    
    const cached = this.validationCache.get(cacheKey);
    if (!cached) return null;
    
    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.maxCacheAge) {
      this.validationCache.delete(cacheKey);
      return null;
    }
    
    return cached.result;
  }
  
  /**
   * Store result in cache
   */
  storeInCache(cacheKey, result) {
    if (!this.cacheEnabled) return;
    
    this.validationCache.set(cacheKey, {
      result: { ...result }, // Deep copy to prevent mutation
      timestamp: Date.now()
    });
    
    // Cleanup old entries if cache is getting large
    if (this.validationCache.size > 100) {
      this.cleanupCache();
    }
  }
  
  /**
   * Invalidate entire cache
   */
  invalidateCache() {
    this.validationCache.clear();
    this.cacheInvalidators.clear();
  }
  
  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const toDelete = [];
    
    this.validationCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.maxCacheAge) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => this.validationCache.delete(key));
    this.validationStats.lastCleanupTime = now;
  }
  
  /**
   * Setup automatic cache cleanup
   */
  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
  }
  
  /**
   * Update performance statistics
   */
  updatePerformanceStats(validationTime) {
    const { totalValidations, averageValidationTime } = this.validationStats;
    
    this.validationStats.averageValidationTime = 
      (averageValidationTime * (totalValidations - 1) + validationTime) / totalValidations;
  }
  
  /**
   * Event system for validation notifications
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }
  
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logError(`Event listener error for ${event}`, error);
        }
      });
    }
  }
  
  /**
   * Get validation statistics
   */
  getStats() {
    return { ...this.validationStats };
  }
  
  /**
   * Reset validation statistics
   */
  resetStats() {
    this.validationStats = {
      totalValidations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      lastCleanupTime: Date.now()
    };
  }
}

// Create and export singleton instance
export const validationService = new ValidationService({
  enableCache: true,
  maxCacheAge: 30000,
  autoCleanupCache: true
});

// Export class for custom instances
export default ValidationService;
