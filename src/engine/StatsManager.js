 
export class StatsManager {
  constructor(statDefs = []) {
    this.stats = {};
    this.flags = {};
    this.statDefinitions = {};
    this.initializeStats(statDefs);
  }

  initializeStats(statDefs) {
    statDefs.forEach(def => {
      this.statDefinitions[def.id] = def;
      this.stats[def.id] = def.defaultValue;
    });
  }

  // Stat operations
  getStat(id) {
    return this.stats[id];
  }

  setStat(id, value) {
    const def = this.statDefinitions[id];
    if (def) {
      // Apply constraints
      if (def.type === 'number' && typeof value === 'number') {
        if (def.min !== undefined) value = Math.max(def.min, value);
        if (def.max !== undefined) value = Math.min(def.max, value);
      }
    }
    this.stats[id] = value;
  }

  addToStat(id, amount) {
    const current = this.getStat(id);
    if (typeof current === 'number') {
      this.setStat(id, current + amount);
    }
  }

  // Flag operations
  hasFlag(id) {
    return !!this.flags[id];
  }

  setFlag(id, value = true) {
    this.flags[id] = value;
  }

  // Get all data
  getAllStats() {
    return { ...this.stats };
  }

  getAllFlags() {
    return { ...this.flags };
  }

  // Load from save data
  loadFromSave(stats, flags) {
    this.stats = { ...stats };
    this.flags = { ...flags };
  }

  // Get visible stats for UI
  getVisibleStats() {
    return Object.entries(this.statDefinitions)
      .filter(([_, def]) => !def.hidden)
      .map(([id, def]) => ({
        id,
        name: def.name,
        value: this.stats[id],
        type: def.type
      }));
  }
}