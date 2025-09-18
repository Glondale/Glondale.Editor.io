/**
 * ChoiceEvaluator.js - Advanced choice state evaluation system
 * 
 * Handles four choice types:
 * 1. VISIBLE - Always shown, always selectable
 * 2. HIDDEN - Not shown until conditions met
 * 3. LOCKED - Visible but not selectable until conditions met  
 * 4. SECRET - Hidden until discovered, then permanently visible
 * 
 * Integration Points:
 * - StoryEngine: getCurrentChoices() uses this for choice filtering
 * - ConditionParser: Leverages existing condition evaluation
 * - SaveSystem: Tracks secret discoveries in save data
 */

export class ChoiceEvaluator {
  constructor(conditionParser, statsManager) {
    this.conditionParser = conditionParser;
    this.statsManager = statsManager;
    
    // Cache for performance - cleared when game state changes
    this.evaluationCache = new Map();
    this.visitedScenes = [];
    this.choiceHistory = [];
    this._lastStatsVersion = this.statsManager?.getVersion?.() || 0;
  }

  // Allow StoryEngine to update visited scenes (compatibility)
  updateVisitedScenes(scenes = []) {
    this.visitedScenes = Array.isArray(scenes) ? scenes : [];
    this.clearCache();
  }

  // Allow StoryEngine to update choice history (compatibility)
  updateChoiceHistory(history = []) {
    this.choiceHistory = Array.isArray(history) ? history : [];
    this.clearCache();
  }

  /**
   * Main evaluation method - determines choice availability
   * @param {Object} choice - Choice object from adventure data
   * @param {Array} discoveredSecrets - Array of discovered secret choice IDs
   * @returns {Object} { isVisible, isSelectable, reason, type }
   */
  evaluateChoice(choice, discoveredSecrets = []) {
    // Invalidate cache when stats/flags have changed
    const currentVersion = this.statsManager?.getVersion?.() || 0;
    if (currentVersion !== this._lastStatsVersion) {
      this.clearCache();
      this._lastStatsVersion = currentVersion;
    }
    // Cache key for performance
    const cacheKey = this.generateCacheKey(choice, discoveredSecrets);
    if (this.evaluationCache.has(cacheKey)) {
      return this.evaluationCache.get(cacheKey);
    }

    const result = this._performEvaluation(choice, discoveredSecrets);

    if (result) {
      this._decorateEvaluation(choice, result);
    }

    // Enforce usage limits (one-time, maxUses, cooldown) on selectable results
    if (result && result.isSelectable) {
      const usageLock = this._applyUsageLimits(choice);
      if (usageLock) {
        // Override selectability due to usage restrictions
        result.isSelectable = false;
        result.type = 'LOCKED';
        result.state = 'LOCKED';
        // Merge/append reasons
        const reasons = [];
        if (Array.isArray(result.lockReasons)) reasons.push(...result.lockReasons);
        if (usageLock.reason) reasons.push(usageLock.reason);
        if (reasons.length > 0) result.lockReasons = reasons;
        // Expose cooldown remaining for UI if present
        if (usageLock.cooldownRemainingMs != null) {
          result.cooldownRemainingMs = usageLock.cooldownRemainingMs;
        }
      }
    }

    // Backwards-compatibility: some callers expect `evaluation.state`; mirror `type` to `state` when missing
    if (!result.state && result.type) {
      result.state = result.type;
    }

    // Cache result for subsequent calls
    this.evaluationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Core evaluation logic
   * @private
   */
  _performEvaluation(choice, discoveredSecrets) {
    // Handle secret choices first
    if (choice.isSecret) {
      return this._evaluateSecretChoice(choice, discoveredSecrets);
    }

    // Handle locked choices
    if (choice.isLocked || choice.requirements) {
      return this._evaluateLockedChoice(choice);
    }

    // Handle hidden choices
    if (choice.isHidden || choice.conditions) {
      return this._evaluateHiddenChoice(choice);
    }

    // Default: visible and selectable
    return {
      isVisible: true,
      isSelectable: true,
      type: 'VISIBLE',
      state: 'VISIBLE',
      reason: null
    };
  }

  /**
   * Enforce per-choice usage limits and cooldowns.
   * Returns null if selectable, or an object { reason, cooldownRemainingMs? } when locked.
   * @private
   */
  _applyUsageLimits(choice) {
    if (!choice) return null;

    const now = Date.now();
    const history = Array.isArray(this.choiceHistory) ? this.choiceHistory : [];

    // Count how many times this choice has been made
    const records = history.filter(h => h && h.choiceId === choice.id);
    const timesUsed = records.length;

    // One-time or maxUses limit
    const oneTime = !!choice.oneTime;
    const maxUses = typeof choice.maxUses === 'number' ? choice.maxUses : 0; // 0 = unlimited
    const allowed = oneTime ? 1 : (maxUses > 0 ? maxUses : Infinity);
    if (timesUsed >= allowed) {
      const remaining = Math.max(0, allowed - timesUsed);
      const reason = oneTime
        ? 'This choice can only be used once'
        : 'No uses remaining for this choice';
      return { reason: remaining > 0 ? `${reason} (${remaining} left)` : reason };
    }

    // Cooldown check (milliseconds). If set and used before, enforce delay
    const cooldownMs = typeof choice.cooldown === 'number' ? choice.cooldown : 0;
    if (cooldownMs > 0 && records.length > 0) {
      const lastUse = records[records.length - 1];
      const elapsed = now - (lastUse.timestamp || 0);
      const remainingMs = cooldownMs - elapsed;
      if (remainingMs > 0) {
        const secs = Math.ceil(remainingMs / 1000);
        return {
          reason: `On cooldown (${secs}s remaining)`,
          cooldownRemainingMs: remainingMs
        };
      }
    }

    return null;
  }

  _decorateEvaluation(choice, evaluation) {
    if (!evaluation) return null;

    evaluation.inputType = choice?.inputType || 'static';
    evaluation.inputConfig = choice?.inputConfig || {};
    evaluation.isFake = !!choice?.isFake;

    if (Array.isArray(choice?.selectableIf) && choice.selectableIf.length > 0) {
      this._applySelectableIf(choice, evaluation);
    } else {
      evaluation.selectableIfMet = true;
    }

    return evaluation;
  }

  _applySelectableIf(choice, evaluation) {
    const selectableIf = Array.isArray(choice?.selectableIf) ? choice.selectableIf : [];
    if (selectableIf.length === 0) return evaluation;

    const conditionsMet = this.conditionParser.evaluateConditions(selectableIf);
    evaluation.selectableIfMet = conditionsMet;

    if (!conditionsMet) {
      evaluation.isSelectable = false;
      if (evaluation.type !== 'HIDDEN') {
        evaluation.type = 'LOCKED';
      }
      if (evaluation.state !== 'HIDDEN') {
        evaluation.state = 'LOCKED';
      }
      const reason = 'Selectable conditions not met';
      if (Array.isArray(evaluation.lockReasons)) {
        if (!evaluation.lockReasons.includes(reason)) {
          evaluation.lockReasons.push(reason);
        }
      } else {
        evaluation.lockReasons = [reason];
      }
    }

    return evaluation;
  }

  /**
   * Evaluate secret choices - hidden until discovered
   * @private
   */
  _evaluateSecretChoice(choice, discoveredSecrets) {
    const isDiscovered = discoveredSecrets.includes(choice.id);

    if (!isDiscovered) {
      // Check if conditions are met to discover this secret
      const shouldDiscover = this._checkDiscoveryConditions(choice);

      if (shouldDiscover) {
        // When discoverable, report as VISIBLE so UI can show and mark discovery
        return {
          isVisible: true,
          isSelectable: true,
          type: 'SECRET_DISCOVERED',
          state: 'VISIBLE',
          reason: 'Secret choice discovered!',
          shouldMarkAsDiscovered: true
        };
      }

      // Hidden secrets should be treated as HIDDEN for UI filtering
      return {
        isVisible: false,
        isSelectable: false,
        type: 'SECRET_HIDDEN',
        state: 'HIDDEN',
        reason: 'Secret choice not yet discovered'
      };
    }

    // Secret is discovered - check if it's still available
    if (choice.requirements) {
      const requirementsMet = this._checkRequirements(choice.requirements);
      return {
        isVisible: true,
        isSelectable: requirementsMet,
        type: 'SECRET_AVAILABLE',
        state: requirementsMet ? 'VISIBLE' : 'LOCKED',
        reason: requirementsMet ? null : this._getRequirementsFailureReason(choice.requirements)
      };
    }

    return {
      isVisible: true,
      isSelectable: true,
      type: 'SECRET_AVAILABLE',
      state: 'VISIBLE',
      reason: null
    };
  }

  /**
   * Evaluate locked choices - visible but may not be selectable
   * @private
   */
  _evaluateLockedChoice(choice) {
    // Fallback: if author marked the choice as locked but only provided conditions,
    // treat those conditions as requirements (selectability gate) to match author intent.
    const requirements = (choice.requirements && choice.requirements.length > 0)
      ? choice.requirements
      : (choice.conditions && choice.conditions.length > 0)
        ? choice.conditions
        : [];
    const requirementsMet = this._checkRequirements(requirements);

    return {
      isVisible: true,
      isSelectable: requirementsMet,
      type: requirementsMet ? 'UNLOCKED' : 'LOCKED',
  state: requirementsMet ? 'VISIBLE' : 'LOCKED',
  reason: requirementsMet ? null : this._getRequirementsFailureReason(requirements)
    };
  }

  /**
   * Evaluate hidden choices - not visible until conditions met
   * @private
   */
  _evaluateHiddenChoice(choice) {
    const conditions = choice.conditions || [];
    const conditionsMet = this.conditionParser.evaluateConditions(conditions);

    if (!conditionsMet) {
      return {
        isVisible: false,
        isSelectable: false,
  type: 'HIDDEN',
  state: 'HIDDEN',
  reason: 'Conditions not met'
      };
    }

    // Conditions met - check requirements for selectability
    if (choice.requirements) {
      const requirementsMet = this._checkRequirements(choice.requirements);
      return {
        isVisible: true,
        isSelectable: requirementsMet,
        type: requirementsMet ? 'VISIBLE' : 'LOCKED',
        state: requirementsMet ? 'VISIBLE' : 'LOCKED',
        reason: requirementsMet ? null : this._getRequirementsFailureReason(choice.requirements)
      };
    }

    return {
      isVisible: true,
      isSelectable: true,
      type: 'VISIBLE',
      state: 'VISIBLE',
      reason: null
    };
  }

  /**
   * Check discovery conditions for secret choices
   * @private
   */
  _checkDiscoveryConditions(choice) {
    // Secret choices use 'conditions' for discovery triggers
    if (choice.conditions) {
      return this.conditionParser.evaluateConditions(choice.conditions);
    }

    // No conditions means it's discoverable immediately
    return true;
  }

  /**
   * Check requirements for choice selectability
   * Uses same format as conditions but different semantic meaning
   * @private
   */
  _checkRequirements(requirements) {
    if (!requirements || requirements.length === 0) {
      return true;
    }

    return this.conditionParser.evaluateConditions(requirements);
  }

  /**
   * Generate human-readable reason for requirement failures
   * @private
   */
  _getRequirementsFailureReason(requirements) {
    if (!requirements || requirements.length === 0) {
      return null;
    }

    // Find first failing requirement for user feedback
    for (const requirement of requirements) {
      if (!this.conditionParser.evaluateCondition(requirement)) {
        return this._formatRequirementMessage(requirement);
      }
    }

    return 'Requirements not met';
  }

  /**
   * Format individual requirement for display
   * @private
   */
  _formatRequirementMessage(requirement) {
    switch (requirement.type) {
      case 'stat':
        const statValue = this.statsManager.getStat(requirement.key);
        return `Requires ${requirement.key} ${this._formatOperator(requirement.operator)} ${requirement.value} (currently ${statValue})`;
      
      case 'flag':
        return `Requires ${requirement.key} to be ${requirement.value}`;
      
      case 'inventory':
        return `Requires item: ${requirement.value}`;
      
      case 'scene_visited':
        return `Must visit scene: ${requirement.value}`;
      
      default:
        return `Requirements not met: ${requirement.key}`;
    }
  }

  /**
   * Format operator for display
   * @private
   */
  _formatOperator(operator) {
    const operatorMap = {
      'eq': '=',
      'ne': '≠',
      'gt': '>',
      'gte': '≥',
      'lt': '<',
      'lte': '≤'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Generate cache key for performance optimization
   * @private
   */
  generateCacheKey(choice, discoveredSecrets) {
    // Include relevant game state that affects choice evaluation
    const statsHash = this._hashCurrentStats();
    const secretsHash = discoveredSecrets.sort().join(',');
    
    return `${choice.id}_${statsHash}_${secretsHash}`;
  }

  /**
   * Create hash of current stats for cache invalidation
   * @private
   */
  _hashCurrentStats() {
    // Simple hash of stats that could affect choices
    const relevantStats = this.statsManager.getAllStats();
    const relevantFlags = this.statsManager.getAllFlags ? this.statsManager.getAllFlags() : {};
    const statsString = JSON.stringify({ stats: relevantStats, flags: relevantFlags });
    
    // Simple string hash for cache keys
    let hash = 0;
    for (let i = 0; i < statsString.length; i++) {
      const char = statsString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Clear evaluation cache when game state changes
   * Should be called by StoryEngine when stats/flags change
   */
  clearCache() {
    this.evaluationCache.clear();
  }

  /**
   * Batch evaluate multiple choices for efficiency
   * @param {Array} choices - Array of choice objects
   * @param {Array} discoveredSecrets - Array of discovered secret IDs
   * @returns {Array} Array of evaluation results
   */
  evaluateChoices(choices, discoveredSecrets = []) {
    return choices.map(choice => ({
      choice,
      evaluation: this.evaluateChoice(choice, discoveredSecrets)
    }));
  }

  /**
   * Get only visible choices (for UI rendering)
   * @param {Array} choices - Array of choice objects
   * @param {Array} discoveredSecrets - Array of discovered secret IDs
   * @returns {Array} Array of visible choices with evaluation data
   */
  getVisibleChoices(choices, discoveredSecrets = []) {
    return this.evaluateChoices(choices, discoveredSecrets)
      .filter(result => result.evaluation.isVisible);
  }

  /**
   * Get newly discovered secrets from this evaluation
   * @param {Array} choices - Array of choice objects  
   * @param {Array} discoveredSecrets - Array of discovered secret IDs
   * @returns {Array} Array of newly discovered secret choice IDs
   */
  getNewlyDiscoveredSecrets(choices, discoveredSecrets = []) {
    const results = this.evaluateChoices(choices, discoveredSecrets);
    
    return results
      .filter(result => result.evaluation.shouldMarkAsDiscovered)
      .map(result => result.choice.id);
  }
}



