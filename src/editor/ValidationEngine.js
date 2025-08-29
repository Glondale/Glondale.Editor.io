// ValidationEngine.js - Real-time validation and error detection using ValidationService
// Handles: adventure validation, node analysis, connection checking, stat validation

import { validationService } from '../services/ValidationService.js';

class ValidationEngine {
  constructor(editorEngine) {
    this.editorEngine = editorEngine;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.lastValidation = null;
    this.autoValidate = true;
    this.validationDebounceMs = 500;
    this.validationTimer = null;

    // Use ValidationService for core validation logic
    this.validationService = validationService;

    // Add custom rules specific to real-time editing
    this.initializeRealtimeRules();
    this.setupEventListeners();
  }

  /**
   * Initialize real-time editor specific validation rules
   */
  initializeRealtimeRules() {
    // Node position validation for editor
    this.validationService.addCustomRule('editor.nodePosition', {
      level: 'warning',
      category: 'editor',
      message: 'Some nodes may be positioned outside visible area',
      validate: async (adventure, context) => {
        const outOfBounds = [];
        const canvasBounds = { x: -1000, y: -1000, width: 2000, height: 2000 }; // Default bounds
        
        context.nodes.forEach((node, nodeId) => {
          if (node.position) {
            const { x, y } = node.position;
            if (x < canvasBounds.x || y < canvasBounds.y || 
                x > canvasBounds.x + canvasBounds.width || 
                y > canvasBounds.y + canvasBounds.height) {
              outOfBounds.push(nodeId);
            }
          }
        });
        
        if (outOfBounds.length === 0) return { passed: true };
        
        return {
          passed: false,
          message: `Found ${outOfBounds.length} node(s) positioned outside canvas bounds`,
          context: { outOfBounds }
        };
      }
    });

    // Node overlap detection
    this.validationService.addCustomRule('editor.nodeOverlap', {
      level: 'info',
      category: 'editor',
      message: 'Some nodes may be overlapping',
      validate: async (adventure, context) => {
        const overlapping = [];
        const nodes = Array.from(context.nodes.values());
        const nodeSize = { width: 200, height: 100 }; // Default node size
        
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];
            
            if (nodeA.position && nodeB.position) {
              const distance = Math.sqrt(
                Math.pow(nodeA.position.x - nodeB.position.x, 2) +
                Math.pow(nodeA.position.y - nodeB.position.y, 2)
              );
              
              if (distance < Math.min(nodeSize.width, nodeSize.height)) {
                overlapping.push([nodeA.id, nodeB.id]);
              }
            }
          }
        }
        
        if (overlapping.length === 0) return { passed: true };
        
        return {
          passed: false,
          message: `Found ${overlapping.length} pair(s) of potentially overlapping nodes`,
          context: { overlapping }
        };
      }
    });
  }

  /**
   * Setup event listeners for real-time validation
   */
  setupEventListeners() {
    if (this.editorEngine) {
      // Listen for editor changes
      this.editorEngine.on('nodeChanged', (nodeId) => {
        if (this.autoValidate) {
          this.scheduleValidation();
        }
      });

      this.editorEngine.on('nodeAdded', (nodeId) => {
        if (this.autoValidate) {
          this.scheduleValidation();
        }
      });

      this.editorEngine.on('nodeDeleted', (nodeId) => {
        if (this.autoValidate) {
          this.scheduleValidation();
        }
      });

      this.editorEngine.on('connectionChanged', () => {
        if (this.autoValidate) {
          this.scheduleValidation();
        }
      });
    }
  }

  /**
   * Schedule debounced validation
   */
  scheduleValidation() {
    if (this.validationTimer) {
      clearTimeout(this.validationTimer);
    }

    this.validationTimer = setTimeout(() => {
      this.validateCurrent();
    }, this.validationDebounceMs);
  }

  /**
   * Validate current adventure state
   */
  async validateCurrent() {
    if (!this.editorEngine) return;

    try {
      const adventure = this.editorEngine.generateAdventure();
      const result = await this.validationService.validate(adventure, {
        realTimeMode: true,
        editorContext: true
      });

      // Update local state
      this.errors = result.errors || [];
      this.warnings = result.warnings || [];
      this.info = result.info || [];
      this.lastValidation = result;

      // Emit validation complete event
      if (this.editorEngine) {
        this.editorEngine.emit('validationComplete', result);
      }

      return result;

    } catch (error) {
      console.error('Validation failed:', error);
      
      this.errors = [{
        level: 'error',
        message: `Validation system error: ${error.message}`,
        location: 'system'
      }];
      this.warnings = [];
      this.info = [];
      
      return {
        isValid: false,
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
        severity: 'critical'
      };
    }
  }

  /**
   * Validate specific node
   */
  async validateNode(nodeId) {
    if (!this.editorEngine) return null;

    const adventure = this.editorEngine.generateAdventure();
    const result = await this.validationService.validate(adventure, {
      scope: 'node',
      targetNode: nodeId
    });

    return result;
  }

  /**
   * Get validation errors for specific node
   */
  getNodeErrors(nodeId) {
    return this.errors.filter(error => 
      error.location === `scenes.${nodeId}` || 
      error.location?.startsWith(`scenes.${nodeId}.`)
    );
  }

  /**
   * Get validation warnings for specific node
   */
  getNodeWarnings(nodeId) {
    return this.warnings.filter(warning => 
      warning.location === `scenes.${nodeId}` || 
      warning.location?.startsWith(`scenes.${nodeId}.`)
    );
  }

  /**
   * Get all issues for specific node
   */
  getNodeIssues(nodeId) {
    return [
      ...this.getNodeErrors(nodeId),
      ...this.getNodeWarnings(nodeId),
      ...this.info.filter(info => 
        info.location === `scenes.${nodeId}` || 
        info.location?.startsWith(`scenes.${nodeId}.`)
      )
    ];
  }

  /**
   * Check if adventure is valid
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Get validation summary
   */
  getSummary() {
    return {
      isValid: this.isValid(),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.info.length,
      lastValidation: this.lastValidation?.metadata?.timestamp || null
    };
  }

  /**
   * Get all validation issues
   */
  getAllIssues() {
    return [
      ...this.errors.map(e => ({ ...e, type: 'error' })),
      ...this.warnings.map(w => ({ ...w, type: 'warning' })),
      ...this.info.map(i => ({ ...i, type: 'info' }))
    ];
  }

  /**
   * Enable/disable auto-validation
   */
  setAutoValidate(enabled) {
    this.autoValidate = enabled;
    
    if (enabled) {
      this.scheduleValidation();
    } else if (this.validationTimer) {
      clearTimeout(this.validationTimer);
      this.validationTimer = null;
    }
  }

  /**
   * Set validation debounce delay
   */
  setDebounceMs(ms) {
    this.validationDebounceMs = Math.max(100, ms);
  }

  /**
   * Force immediate validation
   */
  forceValidation() {
    if (this.validationTimer) {
      clearTimeout(this.validationTimer);
      this.validationTimer = null;
    }
    
    return this.validateCurrent();
  }

  /**
   * Clear all validation results
   */
  clearResults() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.lastValidation = null;
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      ...this.validationService.getStats(),
      realTimeValidations: this.getSummary()
    };
  }
}

export default ValidationEngine;
