// ValidationService.js - Comprehensive validation system with caching and advanced analysis
import { logError, logWarning, logInfo } from '../utils/errorLogger.js';

export class ValidationService {
  constructor(options = {}) {
    this.validationRules = new Map();
    this.validationCache = new Map();
    this.cacheInvalidators = new Set();
    this.customRules = new Map();
    
    // Configuration
    this.cacheEnabled = options.enableCache !== false;
    this.maxCacheAge = options.maxCacheAge || 30000; // 30 seconds
    this.autoCleanupCache = options.autoCleanupCache !== false;
    
    // Performance tracking
    this.validationStats = {
      totalValidations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      lastCleanupTime: Date.now()
    };
    
    // Event listeners
    this.listeners = new Map();
    
    // Initialize built-in validation rules
    this.initializeBuiltInRules();
    
    // Setup cache cleanup
    if (this.autoCleanupCache) {
      this.setupCacheCleanup();
    }
  }
  
  /**
   * Main validation entry point
   */
  async validate(adventure, options = {}) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(adventure, options);
    
    // Check cache first
    if (this.cacheEnabled && !options.forceRevalidate) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.validationStats.cacheHits++;
        return cached;
      }
    }
    
    this.validationStats.cacheMisses++;
    this.validationStats.totalValidations++;
    
    try {
      // Build validation context
      const context = this.buildValidationContext(adventure, options);
      
      // Initialize result
      const result = {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        fixes: [],
        correctedData: null,
        severity: 'info',
        context,
        metadata: {
          validationTime: 0,
          ruleCount: this.validationRules.size + this.customRules.size,
          cacheKey,
          timestamp: Date.now()
        }
      };
      
      // Run all validation rules
      await this.runValidationRules(adventure, context, result);
      
      // Post-process results
      this.postProcessResults(result);
      
      // Cache the result
      if (this.cacheEnabled) {
        this.storeInCache(cacheKey, result);
      }
      
      // Update performance stats
      const validationTime = performance.now() - startTime;
      result.metadata.validationTime = validationTime;
      this.updatePerformanceStats(validationTime);
      
      // Emit validation complete event
      this.emit('validationComplete', result);
      
      return result;
      
    } catch (error) {
      logError('ValidationService validation failed', error);
      
      return {
        isValid: false,
        errors: [`Validation system error: ${error.message}`],
        warnings: [],
        info: [],
        fixes: [],
        correctedData: null,
        severity: 'critical',
        metadata: {
          validationTime: performance.now() - startTime,
          error: error.message,
          timestamp: Date.now()
        }
      };
    }
  }
  
  /**
   * Build comprehensive validation context
   */
  buildValidationContext(adventure, options = {}) {
    const nodes = this.extractNodes(adventure);
    const connections = this.extractConnections(adventure, nodes);
    
    const context = {
      adventure,
      nodes: new Map(nodes.map(node => [node.id, node])),
      connections: new Map(connections.map(conn => [conn.id, conn])),
      options,
      
      // Precomputed analysis data
      reachabilityMap: new Map(),
      dependencyGraph: new Map(),
      circularReferences: new Set(),
      deadEnds: new Set(),
      orphanedNodes: new Set(),
      
      // Stats and flags analysis
      definedStats: new Set(),
      usedStats: new Set(),
      unusedStats: new Set(),
      undefinedStatsUsed: new Set(),
      definedFlags: new Set(),
      usedFlags: new Set(),
      unusedFlags: new Set(),
      undefinedFlagsUsed: new Set(),
      
      // Complexity analysis
      conditionComplexity: new Map(),
      choiceComplexity: new Map(),
      nodeComplexity: new Map(),
      
      // Validation metadata
      analysisTime: 0,
      cacheHits: 0
    };
    
    // Run all analysis
    const analysisStart = performance.now();
    this.performStructuralAnalysis(context);
    this.performReachabilityAnalysis(context);
    this.performStatsFlagsAnalysis(context);
    this.performComplexityAnalysis(context);
    context.analysisTime = performance.now() - analysisStart;
    
    return context;
  }
  
  /**
   * Extract nodes from adventure (supporting various formats)
   */
  extractNodes(adventure) {
    if (!adventure) return [];
    
    // Direct scenes array
    if (Array.isArray(adventure.scenes)) {
      return adventure.scenes;
    }
    
    // Nodes map/object
    if (adventure.nodes) {
      if (adventure.nodes instanceof Map) {
        return Array.from(adventure.nodes.values());
      }
      if (Array.isArray(adventure.nodes)) {
        return adventure.nodes;
      }
      if (typeof adventure.nodes === 'object') {
        return Object.values(adventure.nodes);
      }
    }
    
    return [];
  }
  
  /**
   * Extract connections from adventure and nodes
   */
  extractConnections(adventure, nodes) {
    const connections = [];
    
    nodes.forEach(node => {
      if (node.choices && Array.isArray(node.choices)) {
        node.choices.forEach(choice => {
          if (choice.targetSceneId) {
            connections.push({
              id: `${node.id}_${choice.id}_${choice.targetSceneId}`,
              fromNodeId: node.id,
              toNodeId: choice.targetSceneId,
              choiceId: choice.id,
              choice
            });
          }
        });
      }
    });
    
    return connections;
  }
  
  /**
   * Perform structural analysis on the adventure graph
   */
  performStructuralAnalysis(context) {
    const { nodes, connections } = context;
    
    // Build dependency graph
    nodes.forEach((node, nodeId) => {
      context.dependencyGraph.set(nodeId, new Set());
    });
    
    connections.forEach(conn => {
      if (context.dependencyGraph.has(conn.fromNodeId)) {
        context.dependencyGraph.get(conn.fromNodeId).add(conn.toNodeId);
      }
    });
    
    // Find orphaned nodes (no incoming connections except start scene)
    const hasIncoming = new Set([context.adventure.startSceneId]);
    connections.forEach(conn => {
      hasIncoming.add(conn.toNodeId);
    });
    
    nodes.forEach((node, nodeId) => {
      if (!hasIncoming.has(nodeId) && nodeId !== context.adventure.startSceneId) {
        context.orphanedNodes.add(nodeId);
      }
    });
    
    // Find dead ends (nodes with no outgoing connections)
    nodes.forEach((node, nodeId) => {
      const hasOutgoing = connections.some(conn => conn.fromNodeId === nodeId);
      if (!hasOutgoing) {
        context.deadEnds.add(nodeId);
      }
    });
  }
  
  /**
   * Perform reachability analysis to find circular references
   */
  performReachabilityAnalysis(context) {
    const { nodes, dependencyGraph, adventure } = context;
    const visited = new Set();
    const recursionStack = new Set();
    const reachable = new Set();
    
    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        // Found circular reference
        const circleStart = path.indexOf(nodeId);
        const circle = path.slice(circleStart).concat([nodeId]);
        context.circularReferences.add(circle.join(' -> '));
        return;
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      reachable.add(nodeId);
      
      const dependencies = dependencyGraph.get(nodeId) || new Set();
      dependencies.forEach(depId => {
        if (nodes.has(depId)) {
          dfs(depId, [...path, nodeId]);
        }
      });
      
      recursionStack.delete(nodeId);
    };
    
    // Start DFS from start scene
    if (adventure.startSceneId && nodes.has(adventure.startSceneId)) {
      dfs(adventure.startSceneId);
    }
    
    // Store reachability information
    context.reachabilityMap = reachable;
    
    // Find unreachable nodes
    nodes.forEach((node, nodeId) => {
      if (!reachable.has(nodeId) && nodeId !== adventure.startSceneId) {
        context.orphanedNodes.add(nodeId);
      }
    });
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
        node.choices.forEach(choice => {
          complexity += 1; // Base choice complexity
          
          if (choice.conditions) {
            const choiceComplexity = this.calculateConditionComplexity(choice.conditions);
            complexity += choiceComplexity;
            context.choiceComplexity.set(`${nodeId}_${choice.id}`, choiceComplexity);
          }
          
          if (choice.actions) {
            complexity += choice.actions.length * 0.5; // Actions add moderate complexity
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
    if (!conditions || !Array.isArray(conditions)) return 0;
    
    let complexity = 0;
    conditions.forEach(condition => {
      complexity += 1; // Base condition complexity
      
      if (condition.type === 'group' && condition.conditions) {
        complexity += this.calculateConditionComplexity(condition.conditions) * 1.2;
      }
      
      if (condition.operator === 'and' || condition.operator === 'or') {
        complexity += 0.5; // Logical operators add complexity
      }
    });
    
    return complexity;
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
        result.warnings.push(`Validation rule ${ruleName} encountered an error: ${error.message}`);
      }
    }
    
    // Run custom rules
    for (const [ruleName, rule] of this.customRules) {
      try {
        await rule(adventure, context, result);
      } catch (error) {
        logError(`Custom validation rule ${ruleName} failed`, error);
        result.warnings.push(`Custom rule ${ruleName} encountered an error: ${error.message}`);
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
   * Add a custom validation rule
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
    // Create a hash-like key based on adventure content and options
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
    // Store reachability information
    context.reachabilityMap = reachable;
    
    // Find unreachable nodes
    nodes.forEach((node, nodeId) => {
      if (!reachable.has(nodeId) && nodeId !== adventure.startSceneId) {
        context.orphanedNodes.add(nodeId);
      }
    });
  }
  
