 
export class ConditionParser {
  constructor(statsManager, visitedScenes = []) {
    this.statsManager = statsManager;
    this.visitedScenes = visitedScenes;
  }

  // Evaluate a single condition
  evaluateCondition(condition) {
    const { type, operator, key, value } = condition;
    
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
      default:
        return false;
    }

    // Evaluate based on operator
    return this.compareValues(currentValue, operator, value);
  }

  // Evaluate multiple conditions (AND logic)
  evaluateConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(condition => this.evaluateCondition(condition));
  }

  // Compare values with operators
  compareValues(current, operator, target) {
    switch (operator) {
      case 'eq':
        return current === target;
      case 'ne':
        return current !== target;
      case 'gt':
        return current > target;
      case 'gte':
        return current >= target;
      case 'lt':
        return current < target;
      case 'lte':
        return current <= target;
      default:
        return false;
    }
  }

  // Update visited scenes for scene_visited conditions
  updateVisitedScenes(scenes) {
    this.visitedScenes = [...scenes];
  }
}