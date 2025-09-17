// StatsManager.js - Enhanced version with Phase 3 advanced features
export class StatsManager {
  constructor(statDefs = []) {
    this.stats = {};
    this.flags = {};
    this.statDefinitions = {};
    this.inventoryManager = null;
    this.statChangeHistory = [];
    this.customStatTypes = new Map();
    
    // Initialize default custom stat types
    this.registerCustomStatType('percentage', {
      validate: (value) => typeof value === 'number' && value >= 0 && value <= 100,
      normalize: (value) => Math.max(0, Math.min(100, value)),
      display: (value) => `${value}%`
    });
    
    this.registerCustomStatType('currency', {
      validate: (value) => typeof value === 'number' && value >= 0,
      normalize: (value) => Math.max(0, Math.round(value * 100) / 100), // 2 decimal places
      display: (value) => `$${value.toFixed(2)}`
    });
    
    this.registerCustomStatType('time', {
      validate: (value) => typeof value === 'number' && value >= 0,
      normalize: (value) => Math.max(0, Math.floor(value)), // Integer minutes
      display: (value) => {
        const hours = Math.floor(value / 60);
        const minutes = value % 60;
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
    });
    
    this.initializeStats(statDefs);
  }

  // Register custom stat type
  registerCustomStatType(typeName, typeDefinition) {
    if (!typeDefinition.validate || !typeDefinition.normalize || !typeDefinition.display) {
      throw new Error(`Custom stat type ${typeName} must have validate, normalize, and display functions`);
    }
    this.customStatTypes.set(typeName, typeDefinition);
  }

  // Initialize stats with enhanced type support
  initializeStats(statDefs) {
    statDefs.forEach(def => {
      this.statDefinitions[def.id] = def;
      
      // Apply custom type normalization to default value
      if (this.customStatTypes.has(def.type)) {
        const customType = this.customStatTypes.get(def.type);
        this.stats[def.id] = customType.normalize(def.defaultValue);
      } else {
        this.stats[def.id] = def.defaultValue;
      }
    });
  }

  // Set inventory manager reference for unified operations
  setInventoryManager(inventoryManager) {
    this.inventoryManager = inventoryManager;
  }

  hasStatDefinition(statId) {
    return Object.prototype.hasOwnProperty.call(this.statDefinitions, statId);
  }

  // Enhanced stat operations
  getStat(id) {
    return this.stats[id];
  }

  setStat(id, value, recordHistory = true) {
    const oldValue = this.stats[id];
    const def = this.statDefinitions[id];
    let newValue = value;
    
    if (def) {
      // Apply custom type validation and normalization
      if (this.customStatTypes.has(def.type)) {
        const customType = this.customStatTypes.get(def.type);
        if (!customType.validate(value)) {
          console.warn(`StatsManager: Invalid value ${value} for custom stat type ${def.type}`);
          return false;
        }
        newValue = customType.normalize(value);
      }
      // Apply standard type constraints
      else if (def.type === 'number' && typeof newValue === 'number') {
        if (def.min !== undefined) newValue = Math.max(def.min, newValue);
        if (def.max !== undefined) newValue = Math.min(def.max, newValue);
      }
      else if (def.type === 'string' && typeof newValue !== 'string') {
        newValue = String(newValue);
      }
      else if (def.type === 'boolean') {
        newValue = Boolean(newValue);
      }
    }
    
    this.stats[id] = newValue;
    
    // Record change history for analytics
    if (recordHistory && oldValue !== newValue) {
      this.statChangeHistory.push({
        statId: id,
        oldValue,
        newValue,
        timestamp: Date.now(),
        change: typeof oldValue === 'number' && typeof newValue === 'number' 
          ? newValue - oldValue 
          : null
      });
    }
    
    return true;
  }

  addToStat(id, amount) {
    const current = this.getStat(id);
    if (typeof current === 'number') {
      return this.setStat(id, current + amount);
    }
    return false;
  }

  // Multiply stat by factor
  multiplyStat(id, factor) {
    const current = this.getStat(id);
    if (typeof current === 'number') {
      return this.setStat(id, current * factor);
    }
    return false;
  }

  // Enhanced flag operations
  hasFlag(id) {
    return !!this.flags[id];
  }

  setFlag(id, value = true) {
    const oldValue = this.flags[id];
    this.flags[id] = value;
    
    // Record flag change history
    if (oldValue !== value) {
      this.statChangeHistory.push({
        flagId: id,
        oldValue: oldValue || false,
        newValue: value,
        timestamp: Date.now(),
        change: null
      });
    }
  }

  toggleFlag(id) {
    const current = this.hasFlag(id);
    this.setFlag(id, !current);
    return !current;
  }

  // Inventory integration methods
  addItem(itemId, count = 1) {
    if (this.inventoryManager) {
      return this.inventoryManager.addItem(itemId, count);
    }
    console.warn('StatsManager: No inventory manager set for addItem operation');
    return false;
  }

  removeItem(itemId, count = 1) {
    if (this.inventoryManager) {
      return this.inventoryManager.removeItem(itemId, count);
    }
    console.warn('StatsManager: No inventory manager set for removeItem operation');
    return false;
  }

  hasItem(itemId, count = 1) {
    if (this.inventoryManager) {
      return this.inventoryManager.hasItem(itemId, count);
    }
    console.warn('StatsManager: No inventory manager set for hasItem operation');
    return false;
  }

  getItemCount(itemId) {
    if (this.inventoryManager) {
      return this.inventoryManager.getItemCount(itemId);
    }
    console.warn('StatsManager: No inventory manager set for getItemCount operation');
    return 0;
  }

  // Get all inventory items (unified interface)
  getAllItems() {
    if (this.inventoryManager) {
      return this.inventoryManager.getAllItems();
    }
    return [];
  }

  // Batch operations
  setMultipleStats(statUpdates) {
    const results = {};
    Object.entries(statUpdates).forEach(([id, value]) => {
      results[id] = this.setStat(id, value);
    });
    return results;
  }

  setMultipleFlags(flagUpdates) {
    Object.entries(flagUpdates).forEach(([id, value]) => {
      this.setFlag(id, value);
    });
  }

  // Enhanced data retrieval
  getAllStats() {
    return { ...this.stats };
  }

  getAllFlags() {
    return { ...this.flags };
  }

  getStatDefinition(id) {
    return this.statDefinitions[id];
  }

  getAllStatDefinitions() {
    return { ...this.statDefinitions };
  }

  // Load from save data with inventory support
  loadFromSave(stats, flags, inventory = null) {
    this.stats = { ...stats };
    this.flags = { ...flags };
    
    // Load inventory if provided and inventory manager exists
    if (inventory && this.inventoryManager) {
      this.inventoryManager.loadFromSave(inventory);
    }
    
    // Clear change history on load
    this.statChangeHistory = [];
  }

  // Get visible stats for UI with enhanced display
  getVisibleStats() {
    return Object.entries(this.statDefinitions)
      .filter(([_, def]) => !def.hidden)
      .map(([id, def]) => {
        const value = this.stats[id];
        let displayValue = value;
        
        // Apply custom type display formatting
        if (this.customStatTypes.has(def.type)) {
          const customType = this.customStatTypes.get(def.type);
          displayValue = customType.display(value);
        }
        
        return {
          id,
          name: def.name,
          value: value,
          displayValue: displayValue,
          type: def.type,
          category: def.category || 'general',
          min: def.min,
          max: def.max
        };
      });
  }

  // Get stats by category
  getStatsByCategory(category) {
    return this.getVisibleStats().filter(stat => stat.category === category);
  }

  // Get all categories
  getCategories() {
    const categories = new Set();
    Object.values(this.statDefinitions).forEach(def => {
      if (!def.hidden) {
        categories.add(def.category || 'general');
      }
    });
    return Array.from(categories);
  }

  // Analytics and export functions
  getStatChangeHistory(statId = null) {
    if (statId) {
      return this.statChangeHistory.filter(entry => entry.statId === statId);
    }
    return [...this.statChangeHistory];
  }

  getStatSummary(statId) {
    const def = this.statDefinitions[statId];
    const history = this.getStatChangeHistory(statId);
    
    if (!def || history.length === 0) {
      return null;
    }
    
    const numericChanges = history
      .map(entry => entry.change)
      .filter(change => change !== null);
    
    return {
      id: statId,
      name: def.name,
      currentValue: this.stats[statId],
      totalChanges: history.length,
      totalIncrease: numericChanges.filter(c => c > 0).reduce((sum, c) => sum + c, 0),
      totalDecrease: Math.abs(numericChanges.filter(c => c < 0).reduce((sum, c) => sum + c, 0)),
      averageChange: numericChanges.length > 0 
        ? numericChanges.reduce((sum, c) => sum + c, 0) / numericChanges.length 
        : 0,
      firstChanged: history[0]?.timestamp,
      lastChanged: history[history.length - 1]?.timestamp
    };
  }

  // Get exportable data for cross-game saves
  getExportableStats() {
    const exportableStats = {};
    
    Object.entries(this.statDefinitions).forEach(([id, def]) => {
      // Only export stats that are not marked as non-exportable
      if (!def.noExport) {
        exportableStats[id] = {
          value: this.stats[id],
          type: def.type,
          name: def.name,
          category: def.category || 'general'
        };
      }
    });
    
    return exportableStats;
  }

  getExportableFlags() {
    // Export all flags (can be filtered based on adventure design)
    return { ...this.flags };
  }

  // Validation
  validateStatValue(statId, value) {
    const def = this.statDefinitions[statId];
    if (!def) return { valid: false, error: 'Stat definition not found' };
    
    // Custom type validation
    if (this.customStatTypes.has(def.type)) {
      const customType = this.customStatTypes.get(def.type);
      if (!customType.validate(value)) {
        return { valid: false, error: `Invalid value for ${def.type} type` };
      }
    }
    // Standard type validation
    else {
      switch (def.type) {
        case 'number':
          if (typeof value !== 'number') {
            return { valid: false, error: 'Value must be a number' };
          }
          if (def.min !== undefined && value < def.min) {
            return { valid: false, error: `Value must be at least ${def.min}` };
          }
          if (def.max !== undefined && value > def.max) {
            return { valid: false, error: `Value must be at most ${def.max}` };
          }
          break;
        case 'string':
          if (typeof value !== 'string') {
            return { valid: false, error: 'Value must be a string' };
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            return { valid: false, error: 'Value must be a boolean' };
          }
          break;
      }
    }
    
    return { valid: true };
  }

  // Debug helper
  debugStats() {
    return {
      stats: this.getAllStats(),
      flags: this.getAllFlags(),
      definitions: this.getAllStatDefinitions(),
      changeHistory: this.statChangeHistory.length,
      customTypes: Array.from(this.customStatTypes.keys()),
      hasInventoryManager: !!this.inventoryManager,
      categories: this.getCategories()
    };
  }

  // Reset all stats to default values
  resetStats() {
    Object.entries(this.statDefinitions).forEach(([id, def]) => {
      this.stats[id] = def.defaultValue;
    });
    this.flags = {};
    this.statChangeHistory = [];
    
    if (this.inventoryManager) {
      this.inventoryManager.clearInventory();
    }
  }
}