// ValidationEngine.js - Real-time validation and error detection
// Handles: adventure validation, node analysis, connection checking, stat validation

import { validateAdventure } from '../utils/validation.js';

class ValidationEngine {
  constructor(editorEngine) {
    this.editorEngine = editorEngine;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.lastValidation = null;
    this.validationRules = new Map();
    this.autoValidate = true;
    this.validationDebounceMs = 500;
    this.validationTimer = null;

    this.initializeDefaultRules();
    this.setupEventListeners();
  }

  // Initialize default validation rules
  initializeDefaultRules() {
    // Adventure-level validations
    this.addRule('adventure.title', {
      level: 'warning',
      message: 'Adventure has no title',
      validate: (adventure) => !!(adventure.title && adventure.title.trim())
    });

    this.addRule('adventure.description', {
      level: 'info',
      message: 'Adventure has no description',
      validate: (adventure) => !!(adventure.description && adventure.description.trim())
    });

    this.addRule('adventure.author', {
      level: 'info',
      message: 'Adventure has no author specified',
      validate: (adventure) => !!(adventure.author && adventure.author.trim())
    });

    this.addRule('adventure.startScene', {
      level: 'error',
      message: 'No start scene defined',
      validate: (adventure, context) => {
        return !!(adventure.startSceneId && context.nodes.has(adventure.startSceneId));
      }
    });

    // Node-level validations
    this.addRule('node.title', {
      level: 'warning',
      message: (node) => `Scene "${node.id}" has no title`,
      validate: (node) => !!(node.title && node.title.trim()),
      scope: 'node'
    });

    this.addRule('node.content', {
      level: 'warning',
      message: (node) => `Scene "${node.title || node.id}" has no content`,
      validate: (node) => !!(node.content && node.content.trim()),
      scope: 'node'
    });

    this.addRule('node.orphaned', {
      level: 'warning',
      message: (node) => `Scene "${node.title || node.id}" is not reachable from start`,
      validate: (node, context) => {
        return context.reachableNodes.has(node.id);
      },
      scope: 'node'
    });

    this.addRule('node.deadEnd', {
      level: 'info',
      message: (node) => `Scene "${node.title || node.id}" is a dead end (no choices)`,
      validate: (node, context) => {
        if (node.choices && node.choices.length > 0) return true;
        // Allow dead ends if they're intentional ending scenes
        return context.hasIncomingConnections.get(node.id) === false;
      },
      scope: 'node'
    });

    // Choice-level validations
    this.addRule('choice.text', {
      level: 'error',
      message: (choice, node) => `Choice in scene "${node.title || node.id}" has no text`,
      validate: (choice) => !!(choice.text && choice.text.trim()),
      scope: 'choice'
    });

    this.addRule('choice.target', {
      level: 'error',
      message: (choice, node) => `Choice "${choice.text || 'untitled'}" in scene "${node.title || node.id}" has no target`,
      validate: (choice, context) => {
        return !!(choice.targetSceneId && context.nodes.has(choice.targetSceneId));
      },
      scope: 'choice'
    });

    this.addRule('choice.selfReference', {
      level: 'warning',
      message: (choice, node) => `Choice "${choice.text}" in scene "${node.title || node.id}" points to itself`,
      validate: (choice, context, node) => {
        return choice.targetSceneId !== node.id;
      },
      scope: 'choice'
    });

    // Condition validations
    this.addRule('condition.key', {
      level: 'error',
      message: (condition, choice, node) => `Condition in choice "${choice.text}" (scene "${node.title || node.id}") has no key`,
      validate: (condition) => !!(condition.key && condition.key.trim()),
      scope: 'condition'
    });

    this.addRule('condition.statExists', {
      level: 'warning',
      message: (condition, choice, node) => `Condition in choice "${choice.text}" references unknown stat "${condition.key}"`,
      validate: (condition, context) => {
        if (condition.type !== 'stat') return true;
        return context.definedStats.has(condition.key);
      },
      scope: 'condition'
    });

    this.addRule('condition.sceneExists', {
      level: 'error',
      message: (condition, choice, node) => `Condition in choice "${choice.text}" references unknown scene "${condition.key}"`,
      validate: (condition, context) => {
        if (condition.type !== 'scene_visited') return true;
        return context.nodes.has(condition.key);
      },
      scope: 'condition'
    });
  }

  // Setup event listeners for real-time validation
  setupEventListeners() {
    if (this.editorEngine) {
      this.editorEngine.addEventListener('nodesChanged', () => {
        this.scheduleValidation();
      });

      this.editorEngine.addEventListener('adventureChanged', () => {
        this.scheduleValidation();
      });
    }
  }

  // Add custom validation rule
  addRule(id, rule) {
    this.validationRules.set(id, {
      id,
      level: rule.level || 'error',
      message: rule.message || 'Validation failed',
      validate: rule.validate,
      scope: rule.scope || 'adventure',
      category: rule.category || 'general'
    });
  }

  // Remove validation rule
  removeRule(id) {
    return this.validationRules.delete(id);
  }

  // Schedule debounced validation
  scheduleValidation() {
    if (!this.autoValidate) return;

    if (this.validationTimer) {
      clearTimeout(this.validationTimer);
    }

    this.validationTimer = setTimeout(() => {
      this.validateRealTime();
    }, this.validationDebounceMs);
  }

  // Real-time validation
  validateRealTime() {
    try {
      const result = this.validate();
      this.emitValidationUpdate(result);
      return result;
    } catch (error) {
      console.error('Validation error:', error);
      return {
        errors: [`Validation system error: ${error.message}`],
        warnings: [],
        info: [],
        isValid: false
      };
    }
  }

  // Main validation method
  validate() {
    this.errors = [];
    this.warnings = [];
    this.info = [];

    if (!this.editorEngine) {
      this.errors.push('No editor engine available for validation');
      return this.getValidationResult();
    }

    const adventure = this.editorEngine.getAdventure();
    const nodes = this.editorEngine.getNodes();
    const connections = this.editorEngine.getConnections();

    if (!adventure) {
      this.errors.push('No adventure loaded');
      return this.getValidationResult();
    }

    // Build validation context
    const context = this.buildValidationContext(adventure, nodes, connections);

    // Run base validation using existing validation utility
    const baseValidation = validateAdventure({
      ...adventure,
      scenes: Array.from(nodes.values())
    });

    this.errors.push(...baseValidation.errors);
    this.warnings.push(...baseValidation.warnings);

    // Run custom validation rules
    this.runCustomValidations(adventure, nodes, context);

    const result = this.getValidationResult();
    this.lastValidation = {
      ...result,
      timestamp: Date.now(),
      nodeCount: nodes.size,
      connectionCount: connections.size
    };

    return result;
  }

  // Build validation context with precomputed data
  buildValidationContext(adventure, nodes, connections) {
    const context = {
      adventure,
      nodes,
      connections,
      reachableNodes: new Set(),
      hasIncomingConnections: new Map(),
      hasOutgoingConnections: new Map(),
      definedStats: new Set(),
      usedStats: new Set(),
      usedFlags: new Set()
    };

    // Calculate reachable nodes from start
    if (adventure.startSceneId) {
      this.calculateReachableNodes(adventure.startSceneId, nodes, connections, context.reachableNodes);
    }

    // Calculate connection info
    nodes.forEach((node, nodeId) => {
      context.hasIncomingConnections.set(nodeId, false);
      context.hasOutgoingConnections.set(nodeId, node.choices && node.choices.length > 0);
    });

    connections.forEach(conn => {
      context.hasIncomingConnections.set(conn.toNodeId, true);
    });

    // Collect defined stats
    if (adventure.stats) {
      adventure.stats.forEach(stat => {
        context.definedStats.add(stat.id);
      });
    }

    // Collect used stats and flags from conditions and actions
    nodes.forEach(node => {
      this.collectUsedStatsFromNode(node, context);
    });

    return context;
  }

  // Calculate which nodes are reachable from start
  calculateReachableNodes(startNodeId, nodes, connections, reachableNodes, visited = new Set()) {
    if (visited.has(startNodeId) || !nodes.has(startNodeId)) {
      return;
    }

    visited.add(startNodeId);
    reachableNodes.add(startNodeId);

    // Follow all connections from this node
    connections.forEach(conn => {
      if (conn.fromNodeId === startNodeId) {
        this.calculateReachableNodes(conn.toNodeId, nodes, connections, reachableNodes, visited);
      }
    });
  }

  // Collect stats and flags used in node
  collectUsedStatsFromNode(node, context) {
    // Check choices
    if (node.choices) {
      node.choices.forEach(choice => {
        // Check conditions
        if (choice.conditions) {
          choice.conditions.forEach(condition => {
            if (condition.type === 'stat' && condition.key) {
              context.usedStats.add(condition.key);
            } else if (condition.type === 'flag' && condition.key) {
              context.usedFlags.add(condition.key);
            }
          });
        }

        // Check actions
        if (choice.actions) {
          choice.actions.forEach(action => {
            if ((action.type === 'set_stat' || action.type === 'add_stat') && action.key) {
              context.usedStats.add(action.key);
            } else if (action.type === 'set_flag' && action.key) {
              context.usedFlags.add(action.key);
            }
          });
        }
      });
    }

    // Check scene actions
    ['onEnter', 'onExit'].forEach(actionType => {
      if (node[actionType]) {
        node[actionType].forEach(action => {
          if ((action.type === 'set_stat' || action.type === 'add_stat') && action.key) {
            context.usedStats.add(action.key);
          } else if (action.type === 'set_flag' && action.key) {
            context.usedFlags.add(action.key);
          }
        });
      }
    });
  }

  // Run custom validation rules
  runCustomValidations(adventure, nodes, context) {
    for (const rule of this.validationRules.values()) {
      try {
        switch (rule.scope) {
          case 'adventure':
            this.runAdventureRule(rule, adventure, context);
            break;
          case 'node':
            this.runNodeRules(rule, nodes, context);
            break;
          case 'choice':
            this.runChoiceRules(rule, nodes, context);
            break;
          case 'condition':
            this.runConditionRules(rule, nodes, context);
            break;
        }
      } catch (error) {
        this.errors.push(`Validation rule '${rule.id}' failed: ${error.message}`);
      }
    }
  }

  // Run adventure-level rule
  runAdventureRule(rule, adventure, context) {
    if (!rule.validate(adventure, context)) {
      const message = typeof rule.message === 'function' 
        ? rule.message(adventure, context) 
        : rule.message;
      this.addIssue(rule.level, message, rule.category);
    }
  }

  // Run node-level rules
  runNodeRules(rule, nodes, context) {
    nodes.forEach(node => {
      if (!rule.validate(node, context)) {
        const message = typeof rule.message === 'function' 
          ? rule.message(node, context) 
          : rule.message;
        this.addIssue(rule.level, message, rule.category);
      }
    });
  }

  // Run choice-level rules
  runChoiceRules(rule, nodes, context) {
    nodes.forEach(node => {
      if (node.choices) {
        node.choices.forEach(choice => {
          if (!rule.validate(choice, context, node)) {
            const message = typeof rule.message === 'function' 
              ? rule.message(choice, node, context) 
              : rule.message;
            this.addIssue(rule.level, message, rule.category);
          }
        });
      }
    });
  }

  // Run condition-level rules
  runConditionRules(rule, nodes, context) {
    nodes.forEach(node => {
      if (node.choices) {
        node.choices.forEach(choice => {
          if (choice.conditions) {
            choice.conditions.forEach(condition => {
              if (!rule.validate(condition, context, choice, node)) {
                const message = typeof rule.message === 'function' 
                  ? rule.message(condition, choice, node, context) 
                  : rule.message;
                this.addIssue(rule.level, message, rule.category);
              }
            });
          }
        });
      }
    });
  }

  // Add issue to appropriate collection
  addIssue(level, message, category = 'general') {
    const issue = { message, category, timestamp: Date.now() };
    
    switch (level) {
      case 'error':
        this.errors.push(issue);
        break;
      case 'warning':
        this.warnings.push(issue);
        break;
      case 'info':
        this.info.push(issue);
        break;
    }
  }

  // Get validation result
  getValidationResult() {
    return {
      errors: [...this.errors],
      warnings: [...this.warnings],
      info: [...this.info],
      isValid: this.errors.length === 0,
      summary: {
        errorCount: this.errors.length,
        warningCount: this.warnings.length,
        infoCount: this.info.length
      }
    };
  }

  // Emit validation update event
  emitValidationUpdate(result) {
    if (this.editorEngine) {
      this.editorEngine.emit('validationChanged', result);
    }
  }

  // Public getters
  getErrors() {
    return [...this.errors];
  }

  getWarnings() {
    return [...this.warnings];
  }

  getInfo() {
    return [...this.info];
  }

  getLastValidation() {
    return this.lastValidation;
  }

  isValid() {
    return this.errors.length === 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  // Configuration methods
  setAutoValidate(enabled) {
    this.autoValidate = enabled;
    if (enabled) {
      this.scheduleValidation();
    }
  }

  setValidationDebounce(ms) {
    this.validationDebounceMs = Math.max(100, ms);
  }

  // Validation categories for UI grouping
  getValidationsByCategory() {
    const categories = {
      general: { errors: [], warnings: [], info: [] },
      content: { errors: [], warnings: [], info: [] },
      structure: { errors: [], warnings: [], info: [] },
      logic: { errors: [], warnings: [], info: [] }
    };

    const categorize = (issues, level) => {
      issues.forEach(issue => {
        const category = issue.category || 'general';
        if (!categories[category]) {
          categories[category] = { errors: [], warnings: [], info: [] };
        }
        categories[category][level].push(issue);
      });
    };

    categorize(this.errors, 'errors');
    categorize(this.warnings, 'warnings');
    categorize(this.info, 'info');

    return categories;
  }

  // Export readiness check
  getExportReadiness() {
    const validation = this.validate();
    
    return {
      canExport: validation.isValid,
      blockers: validation.errors,
      concerns: validation.warnings,
      notes: validation.info,
      recommendation: validation.isValid 
        ? 'Adventure is ready for export'
        : `Fix ${validation.errors.length} error(s) before exporting`
    };
  }
}

export default ValidationEngine;