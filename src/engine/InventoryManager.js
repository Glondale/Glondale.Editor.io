 
/**
 * InventoryManager.js - Comprehensive inventory system
 * 
 * Features:
 * - Item collections with quantity tracking
 * - Category-based organization 
 * - Stack limits and unique items
 * - Integration with stats system
 * - Efficient lookup and validation
 * 
 * Integration Points:
 * - StatsManager: Extends stat operations with inventory
 * - ConditionParser: Provides inventory conditions (has_item, item_count)
 * - SaveSystem: Serializes inventory state
 * - UI Components: Provides display-ready inventory data
 */

export class InventoryManager {
  constructor(statsManager, itemDefinitions = []) {
    this.statsManager = statsManager;
    this.itemDefinitions = new Map();
    this.inventory = new Map(); // itemId -> { item, quantity, acquiredAt }
    
    // Performance caches
    this.categoryCache = new Map();
    this.displayCache = null;
    this.lastCacheUpdate = 0;
    
    // Initialize item definitions
    this.loadItemDefinitions(itemDefinitions);
  }

  /**
   * Compatibility: initialize inventory from adventure definitions
   */
  initializeInventory(itemDefinitions = []) {
    this.loadItemDefinitions(itemDefinitions);
    // Initialize empty inventory entries for defined items if desired
    // Keep inventory empty by default; UI or story can add items via actions
  }

  /**
   * Load item definitions from adventure data
   * @param {Array} itemDefinitions - Array of item definition objects
   */
  loadItemDefinitions(itemDefinitions) {
    this.itemDefinitions.clear();
    
    itemDefinitions.forEach(item => {
      if (this.validateItemDefinition(item)) {
        this.itemDefinitions.set(item.id, {
          ...item,
          // Default values for optional properties
          maxStack: item.maxStack || (item.unique ? 1 : 99),
          category: item.category || 'misc',
          value: item.value || 0,
          consumable: item.consumable || false,
          hidden: item.hidden || false
        });
      }
    });
    
    this.clearCaches();
  }

  /**
   * Add item to inventory
   * @param {string} itemId - Item identifier
   * @param {number} quantity - Amount to add (default: 1)
   * @returns {Object} { success, message, newQuantity }
   */
  addItem(itemId, quantity = 1) {
    const itemDef = this.itemDefinitions.get(itemId);
    
    if (!itemDef) {
      return {
        success: false,
        message: `Unknown item: ${itemId}`,
        newQuantity: 0
      };
    }

    if (quantity <= 0) {
      return {
        success: false,
        message: 'Cannot add zero or negative quantity',
        newQuantity: this.getItemCount(itemId)
      };
    }

    const currentEntry = this.inventory.get(itemId);
    const currentQuantity = currentEntry ? currentEntry.quantity : 0;
    const newQuantity = currentQuantity + quantity;

    // Check stack limit
    if (newQuantity > itemDef.maxStack) {
      const canAdd = itemDef.maxStack - currentQuantity;
      if (canAdd <= 0) {
        return {
          success: false,
          message: `Cannot carry more ${itemDef.name} (max: ${itemDef.maxStack})`,
          newQuantity: currentQuantity
        };
      }
      
      // Add what we can
      this.inventory.set(itemId, {
        item: itemDef,
        quantity: itemDef.maxStack,
        acquiredAt: currentEntry?.acquiredAt || Date.now()
      });
      
      this.clearCaches();
      this.updateStatsIntegration(itemId, itemDef.maxStack - currentQuantity);
      
      return {
        success: true,
        message: `Added ${canAdd} ${itemDef.name} (${quantity - canAdd} couldn't fit)`,
        newQuantity: itemDef.maxStack
      };
    }

    // Add the full quantity
    this.inventory.set(itemId, {
      item: itemDef,
      quantity: newQuantity,
      acquiredAt: currentEntry?.acquiredAt || Date.now()
    });

    this.clearCaches();
    this.updateStatsIntegration(itemId, quantity);

    return {
      success: true,
      message: `Added ${quantity} ${itemDef.name}`,
      newQuantity: newQuantity
    };
  }

  /**
   * Remove item from inventory
   * @param {string} itemId - Item identifier
   * @param {number} quantity - Amount to remove (default: 1)
   * @returns {Object} { success, message, newQuantity }
   */
  removeItem(itemId, quantity = 1) {
    const currentEntry = this.inventory.get(itemId);
    
    if (!currentEntry) {
      return {
        success: false,
        message: `Don't have item: ${itemId}`,
        newQuantity: 0
      };
    }

    if (quantity <= 0) {
      return {
        success: false,
        message: 'Cannot remove zero or negative quantity',
        newQuantity: currentEntry.quantity
      };
    }

    if (currentEntry.quantity < quantity) {
      return {
        success: false,
        message: `Don't have enough ${currentEntry.item.name} (have: ${currentEntry.quantity}, need: ${quantity})`,
        newQuantity: currentEntry.quantity
      };
    }

    const newQuantity = currentEntry.quantity - quantity;
    
    if (newQuantity === 0) {
      this.inventory.delete(itemId);
    } else {
      this.inventory.set(itemId, {
        ...currentEntry,
        quantity: newQuantity
      });
    }

    this.clearCaches();
    this.updateStatsIntegration(itemId, -quantity);

    return {
      success: true,
      message: `Removed ${quantity} ${currentEntry.item.name}`,
      newQuantity: newQuantity
    };
  }

  /**
   * Set exact quantity for an inventory item
   * @param {string} itemId - Item identifier
   * @param {number} quantity - Desired quantity (defaults to 0)
   * @returns {Object} { success, message, newQuantity }
   */
  setItemCount(itemId, quantity = 0) {
    const currentEntry = this.inventory.get(itemId);
    const currentQuantity = currentEntry ? currentEntry.quantity : 0;

    if (quantity === undefined || quantity === null) {
      quantity = 0;
    }

    if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
      return {
        success: false,
        message: 'Quantity must be a valid number',
        newQuantity: currentQuantity
      };
    }

    const normalizedQuantity = Math.floor(quantity);

    if (normalizedQuantity < 0) {
      return {
        success: false,
        message: 'Cannot set negative quantity',
        newQuantity: currentQuantity
      };
    }

    if (normalizedQuantity === currentQuantity) {
      return {
        success: true,
        message: currentEntry
          ? `${currentEntry.item.name} already at ${currentQuantity}`
          : `${itemId} already at 0`,
        newQuantity: currentQuantity
      };
    }

    if (normalizedQuantity === 0) {
      if (!currentEntry) {
        return {
          success: true,
          message: `${itemId} already absent from inventory`,
          newQuantity: 0
        };
      }

      this.inventory.delete(itemId);
      this.clearCaches();
      this.updateStatsIntegration(itemId, -currentQuantity);

      return {
        success: true,
        message: `Removed all ${currentEntry.item.name}`,
        newQuantity: 0
      };
    }

    const itemDef = currentEntry?.item || this.itemDefinitions.get(itemId);

    if (!itemDef) {
      return {
        success: false,
        message: `Unknown item: ${itemId}`,
        newQuantity: currentQuantity
      };
    }

    const clampedQuantity = Math.min(normalizedQuantity, itemDef.maxStack);
    const quantityDelta = clampedQuantity - currentQuantity;

    const updatedEntry = {
      item: itemDef,
      quantity: clampedQuantity,
      acquiredAt: currentEntry?.acquiredAt || Date.now()
    };

    this.inventory.set(itemId, updatedEntry);
    this.clearCaches();

    if (quantityDelta !== 0) {
      this.updateStatsIntegration(itemId, quantityDelta);
    }

    let message;

    if (clampedQuantity !== normalizedQuantity) {
      message = `Set ${itemDef.name} count to ${clampedQuantity} (clamped from ${normalizedQuantity})`;
    } else if (!currentEntry) {
      message = `Added ${clampedQuantity} ${itemDef.name}`;
    } else if (quantityDelta > 0) {
      message = `Increased ${itemDef.name} count to ${clampedQuantity}`;
    } else {
      message = `Reduced ${itemDef.name} count to ${clampedQuantity}`;
    }

    return {
      success: true,
      message,
      newQuantity: clampedQuantity
    };
  }

  /**
   * Check if inventory contains item
   * @param {string} itemId - Item identifier
   * @param {number} minQuantity - Minimum required quantity (default: 1)
   * @returns {boolean}
   */
  hasItem(itemId, minQuantity = 1) {
    const entry = this.inventory.get(itemId);
    return entry ? entry.quantity >= minQuantity : false;
  }

  /**
   * Get quantity of specific item
   * @param {string} itemId - Item identifier
   * @returns {number}
   */
  getItemCount(itemId) {
    const entry = this.inventory.get(itemId);
    return entry ? entry.quantity : 0;
  }

  /**
   * Use/consume item (for consumables)
   * @param {string} itemId - Item identifier
   * @param {number} quantity - Amount to consume (default: 1)
   * @returns {Object} { success, message, effects }
   */
  useItem(itemId, quantity = 1) {
    const entry = this.inventory.get(itemId);
    
    if (!entry) {
      return {
        success: false,
        message: `Don't have item: ${itemId}`,
        effects: []
      };
    }

    const itemDef = entry.item;
    
    if (!itemDef.consumable) {
      return {
        success: false,
        message: `${itemDef.name} cannot be used`,
        effects: []
      };
    }

    if (entry.quantity < quantity) {
      return {
        success: false,
        message: `Don't have enough ${itemDef.name}`,
        effects: []
      };
    }

    // Execute item effects
    const effects = this.executeItemEffects(itemDef, quantity);
    
    // Remove consumed items
    const removeResult = this.removeItem(itemId, quantity);
    
    return {
      success: true,
      message: `Used ${quantity} ${itemDef.name}`,
      effects: effects
    };
  }

  /**
   * Execute item effects (for consumables)
   * @private
   */
  executeItemEffects(itemDef, quantity) {
    const effects = [];
    
    if (itemDef.effects) {
      itemDef.effects.forEach(effect => {
        const totalEffect = effect.value * quantity;
        
        switch (effect.type) {
          case 'stat_add':
            this.statsManager.addToStat(effect.target, totalEffect);
            effects.push(`${effect.target} +${totalEffect}`);
            break;
          
          case 'stat_set':
            this.statsManager.setStat(effect.target, effect.value);
            effects.push(`${effect.target} set to ${effect.value}`);
            break;
          
          case 'flag_set':
            this.statsManager.setFlag(effect.target, effect.value);
            effects.push(`${effect.target} flag set`);
            break;
        }
      });
    }
    
    return effects;
  }

  /**
   * Get all inventory items organized by category
   * @param {boolean} includeHidden - Include hidden items (default: false)
   * @returns {Object} { categories: Map, totalItems: number, totalValue: number }
   */
  getInventoryByCategory(includeHidden = false) {
    const cacheKey = `category_${includeHidden}`;

    if (this.categoryCache.has(cacheKey) && this.displayCache &&
        Date.now() - this.lastCacheUpdate < 1000) {
      return this.categoryCache.get(cacheKey);
    }

    const categories = new Map();
    let totalItems = 0;
    let totalValue = 0;

    this.inventory.forEach((entry, itemId) => {
      const item = entry.item;
      
      if (!includeHidden && item.hidden) {
        return;
      }

      const category = item.category;
      
      if (!categories.has(category)) {
        categories.set(category, {
          name: this.getCategoryDisplayName(category),
          items: [],
          totalQuantity: 0,
          totalValue: 0
        });
      }

      const categoryData = categories.get(category);
      categoryData.items.push({
        id: itemId,
        ...entry,
        totalValue: (item.value || 0) * entry.quantity
      });
      categoryData.totalQuantity += entry.quantity;
      categoryData.totalValue += (item.value || 0) * entry.quantity;
      
      totalItems += entry.quantity;
      totalValue += (item.value || 0) * entry.quantity;
    });

    const result = {
      categories,
      totalItems,
      totalValue,
      categoryCount: categories.size
    };

    this.categoryCache.set(cacheKey, result);
    this.lastCacheUpdate = Date.now();

    return result;
  }

  /**
   * Return inventory items belonging to a category
   * @param {string} category - Category identifier
   * @param {boolean} includeHidden - Include hidden items (default: true)
   * @returns {Array}
   */
  getItemsByCategory(category, includeHidden = true) {
    if (!category) {
      return [];
    }

    const categorized = this.getInventoryByCategory(includeHidden);
    const categoryData = categorized.categories.get(category);

    if (!categoryData) {
      return [];
    }

    return categoryData.items.slice();
  }

  /**
   * Get total number of items in inventory (counts quantities)
   * @returns {number}
   */
  getTotalItemCount() {
    const state = this.getInventoryState();
    return state.totalItems || 0;
  }

  /**
   * Get total weight of all items
   * @returns {number}
   */
  getTotalWeight() {
    const state = this.getInventoryState();
    return state.totalWeight || 0;
  }

  /**
   * Get total value of all items
   * @returns {number}
   */
  getTotalValue() {
    const state = this.getInventoryState();
    return state.totalValue || 0;
  }

  /**
   * Get display-ready inventory data for UI
   * @returns {Object} Formatted inventory data
   */
  getDisplayInventory() {
    if (this.displayCache && Date.now() - this.lastCacheUpdate < 1000) {
      return this.displayCache;
    }

    const categorized = this.getInventoryByCategory(false);
    const recentItems = this.getRecentItems(5);
    const valuable = this.getMostValuableItems(5);

    this.displayCache = {
      ...categorized,
      recentItems,
      valuableItems: valuable,
      isEmpty: this.inventory.size === 0
    };

    return this.displayCache;
  }

  /**
   * Get recently acquired items
   * @param {number} limit - Maximum items to return
   * @returns {Array}
   */
  getRecentItems(limit = 10) {
    const items = Array.from(this.inventory.values())
      .sort((a, b) => b.acquiredAt - a.acquiredAt)
      .slice(0, limit);
    
    return items.map(entry => ({
      id: entry.item.id,
      name: entry.item.name,
      quantity: entry.quantity,
      acquiredAt: entry.acquiredAt
    }));
  }

  /**
   * Compatibility: return all items in a simple serializable form
   */
  getAllItems() {
    const items = [];
    this.inventory.forEach((entry, itemId) => {
      items.push({ id: itemId, count: entry.quantity, acquiredAt: entry.acquiredAt });
    });
    return items;
  }

  /**
   * Compatibility alias for older APIs
   */
  getAll() {
    return this.getAllItems();
  }

  /**
   * Compatibility: return lightweight inventoryState
   */
  getInventoryState() {
    const stats = this.getStats();

    // Compute total weight from current inventory entries (compatibility with validator)
    let totalWeight = 0;
    this.inventory.forEach(entry => {
      const itemWeight = entry.item && typeof entry.item.weight === 'number' ? entry.item.weight : 0;
      totalWeight += (entry.quantity || 0) * itemWeight;
    });

    return {
      totalWeight,
      totalItems: stats.totalItems,
      uniqueItems: stats.uniqueItems,
      totalValue: stats.totalValue,
      lastModified: Date.now()
    };
  }

  /**
   * Get most valuable items
   * @param {number} limit - Maximum items to return
   * @returns {Array}
   */
  getMostValuableItems(limit = 10) {
    const items = Array.from(this.inventory.values())
      .map(entry => ({
        ...entry,
        totalValue: (entry.item.value || 0) * entry.quantity
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit);
    
    return items;
  }

  /**
   * Search inventory by name or description
   * @param {string} query - Search term
   * @returns {Array}
   */
  searchInventory(query) {
    const searchTerm = query.toLowerCase();
    const results = [];

    this.inventory.forEach((entry, itemId) => {
      const item = entry.item;
      
      if (item.name.toLowerCase().includes(searchTerm) ||
          (item.description && item.description.toLowerCase().includes(searchTerm))) {
        results.push({
          id: itemId,
          ...entry,
          relevance: this.calculateRelevance(item, searchTerm)
        });
      }
    });

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Calculate search relevance score
   * @private
   */
  calculateRelevance(item, searchTerm) {
    let score = 0;
    
    if (item.name.toLowerCase().includes(searchTerm)) {
      score += 10;
      if (item.name.toLowerCase().startsWith(searchTerm)) {
        score += 5;
      }
    }
    
    if (item.description && item.description.toLowerCase().includes(searchTerm)) {
      score += 5;
    }
    
    return score;
  }

  /**
   * Load inventory from save data
   * @param {Object} saveData - Inventory data from save file
   */
  loadFromSave(saveData) {
    this.inventory.clear();
    
    if (saveData && saveData.inventory) {
      Object.entries(saveData.inventory).forEach(([itemId, data]) => {
        const itemDef = this.itemDefinitions.get(itemId);
        if (itemDef) {
          this.inventory.set(itemId, {
            item: itemDef,
            quantity: data.quantity || 1,
            acquiredAt: data.acquiredAt || Date.now()
          });
        }
      });
    }
    
    this.clearCaches();
  }

  /**
   * Export inventory to save data
   * @returns {Object}
   */
  exportToSave() {
    const inventoryData = {};
    
    this.inventory.forEach((entry, itemId) => {
      inventoryData[itemId] = {
        quantity: entry.quantity,
        acquiredAt: entry.acquiredAt
      };
    });

    return {
      inventory: inventoryData,
      metadata: {
        totalItems: this.inventory.size,
        lastUpdate: Date.now()
      }
    };
  }

  /**
   * Return inventory in an exportable format for cross-game export
   * Backwards-compatible name expected by StoryEngine.generateExportableData()
   * @returns {Array} Array of exportable item objects
   */
  getExportableInventory() {
    const exportItems = [];
    this.inventory.forEach((entry, itemId) => {
      exportItems.push({
        id: itemId,
        name: entry.item?.name || itemId,
        count: entry.quantity,
        acquiredAt: entry.acquiredAt
      });
    });
    return exportItems;
  }

  /**
   * Validate item definition
   * @private
   */
  validateItemDefinition(item) {
    if (!item.id || !item.name) {
      console.warn('Invalid item definition: missing id or name', item);
      return false;
    }
    
    if (item.maxStack && item.maxStack < 1) {
      console.warn(`Invalid maxStack for item ${item.id}: must be >= 1`);
      return false;
    }
    
    return true;
  }

  /**
   * Update stats system integration
   * @private
   */
  updateStatsIntegration(itemId, quantityChange) {
    // Update total item count stat if it exists
    if (!this.statsManager || typeof this.statsManager.hasStatDefinition !== 'function') {
      return;
    }

    if (this.statsManager.hasStatDefinition('total_items')) {
      const currentTotal = this.statsManager.getStat('total_items') || 0;
      this.statsManager.setStat('total_items', Math.max(0, currentTotal + quantityChange));
    }
  }

  /**
   * Get category display name
   * @private
   */
  getCategoryDisplayName(category) {
    const categoryNames = {
      'weapon': 'Weapons',
      'armor': 'Armor',
      'consumable': 'Consumables',
      'tool': 'Tools',
      'key': 'Key Items',
      'misc': 'Miscellaneous'
    };
    
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Clear all caches
   * @private
   */
  clearCaches() {
    this.categoryCache.clear();
    this.displayCache = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * Get inventory statistics
   * @returns {Object}
   */
  getStats() {
    const categorized = this.getInventoryByCategory(true);
    
    return {
      totalItems: categorized.totalItems,
      uniqueItems: this.inventory.size,
      totalValue: categorized.totalValue,
      categories: categorized.categoryCount,
      isEmpty: this.inventory.size === 0
    };
  }
}