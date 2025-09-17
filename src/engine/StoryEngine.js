// StoryEngine.js - Enhanced version with Phase 3 advanced features and validation integration
import { StatsManager } from './StatsManager.js';
import { ConditionParser } from './ConditionParser.js';
import { ChoiceEvaluator } from './ChoiceEvaluator.js';
import { InventoryManager } from './InventoryManager.js';
import { CrossGameSaveSystem } from './CrossGameSaveSystem.js';
import { validationService } from '../services/ValidationService.js';

export class StoryEngine {
  constructor() {
    this.adventure = null;
    this.currentScene = null;
    this.statsManager = new StatsManager();
    this.inventoryManager = new InventoryManager(this.statsManager);
    this.statsManager.setInventoryManager(this.inventoryManager);
    this.conditionParser = new ConditionParser(this.statsManager, [], this.inventoryManager);
    this.choiceEvaluator = new ChoiceEvaluator(this.conditionParser, this.statsManager, this.inventoryManager);
    this.crossGameSaveSystem = new CrossGameSaveSystem();
    this.visitedScenes = [];
    this.choiceHistory = [];
    this.secretsDiscovered = [];
    this.secretChoicesAvailable = new Set(); // Track which secret choices are permanently unlocked
    
    // Validation integration
    this.validationService = validationService;
    this.validationEnabled = true;
    this.lastValidationResult = null;
  }

  // Load an adventure with validation
  async loadAdventure(adventure) {
    console.log('StoryEngine: Loading adventure:', adventure?.title);
    console.log('StoryEngine: Adventure scenes:', adventure?.scenes?.length || 0);
    
    // Validate adventure before loading if validation is enabled
    if (this.validationEnabled && adventure) {
      try {
        const validationResult = await this.validationService.validate(adventure, {
          scope: 'runtime',
          enableFixes: false // Don't auto-fix during runtime
        });
        
        this.lastValidationResult = validationResult;
        
        // Log validation results
        if (validationResult.errors.length > 0) {
          console.warn('StoryEngine: Adventure has validation errors:', validationResult.errors);
        }
        if (validationResult.warnings.length > 0) {
          console.info('StoryEngine: Adventure has validation warnings:', validationResult.warnings);
        }
        
        // Optionally reject adventures with critical errors
        if (validationResult.severity === 'critical') {
          console.error('StoryEngine: Cannot load adventure with critical validation errors');
          throw new Error('Adventure has critical validation errors and cannot be loaded');
        }
        
      } catch (error) {
        console.error('StoryEngine: Adventure validation failed:', error);
        if (this.validationEnabled) {
          throw error;
        }
      }
    }
    
    this.adventure = adventure;
    this.statsManager = new StatsManager(adventure.stats || []);
    this.inventoryManager = new InventoryManager(this.statsManager);
    this.statsManager.setInventoryManager(this.inventoryManager);

    // Initialize inventory with adventure items
    if (adventure.inventory && adventure.inventory.length > 0) {
      this.inventoryManager.initializeInventory(adventure.inventory);
      console.log('StoryEngine: Initialized inventory with', adventure.inventory.length, 'item types');
    }

    this.conditionParser = new ConditionParser(this.statsManager, this.visitedScenes, this.inventoryManager);
    this.choiceEvaluator = new ChoiceEvaluator(this.conditionParser, this.statsManager, this.inventoryManager);
    
    // Update choice evaluator with visit and choice history
    this.choiceEvaluator.updateVisitedScenes(this.visitedScenes);
    this.choiceEvaluator.updateChoiceHistory(this.choiceHistory);
    
    // Navigate to start scene
    if (adventure.startSceneId) {
      this.navigateToScene(adventure.startSceneId);
      console.log('StoryEngine: Started at scene:', this.currentScene?.id);
    } else {
      console.error('StoryEngine: No startSceneId provided');
    }
  }

  // Navigate to a specific scene
  navigateToScene(sceneId) {
    console.log('StoryEngine: Navigating to scene:', sceneId);
    
    if (!this.adventure) {
      console.error('StoryEngine: No adventure loaded');
      return null;
    }

    if (!this.adventure.scenes) {
      console.error('StoryEngine: No scenes array in adventure');
      return null;
    }

    const scene = this.adventure.scenes.find(s => s.id === sceneId);
    if (!scene) {
      console.error('StoryEngine: Scene not found:', sceneId);
      return null;
    }

    // Record scene visit
    if (!this.visitedScenes.includes(sceneId)) {
      this.visitedScenes.push(sceneId);
      this.conditionParser.updateVisitedScenes(this.visitedScenes);
      this.choiceEvaluator.updateVisitedScenes(this.visitedScenes);
    }

    // Execute onExit actions for current scene
    if (this.currentScene?.onExit) {
      this.executeActions(this.currentScene.onExit);
    }

    this.currentScene = scene;
    console.log('StoryEngine: Current scene set to:', scene.title, 'with', scene.choices?.length || 0, 'choices');

    // Execute onEnter actions for new scene
    if (scene.onEnter) {
      this.executeActions(scene.onEnter);
    }

    // Check for newly discovered secret choices
    this.discoverSecretChoices();

    return scene;
  }

  // Discover secret choices based on current conditions
  discoverSecretChoices() {
    if (!this.currentScene?.choices) return;

    this.currentScene.choices.forEach(choice => {
      if (choice.isSecret && !this.secretChoicesAvailable.has(choice.id)) {
        const evaluation = this.choiceEvaluator.evaluateChoice(choice, this.visitedScenes, this.choiceHistory);
        
        if (evaluation.state === 'VISIBLE') {
          this.secretChoicesAvailable.add(choice.id);
          this.secretsDiscovered.push({
            choiceId: choice.id,
            sceneId: this.currentScene.id,
            timestamp: Date.now(),
            choiceText: choice.text
          });
          console.log('StoryEngine: Secret choice discovered:', choice.text);
          
          // Emit event for UI notifications
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('secretChoiceDiscovered', {
              detail: { 
                choice: choice, 
                scene: this.currentScene,
                secretsFound: this.secretsDiscovered.length
              }
            }));
          }
        }
      }
    });
  }

  // Get available choices for current scene with advanced evaluation
  getCurrentChoices() {
    if (!this.currentScene) {
      console.log('StoryEngine: No current scene for choices');
      return [];
    }

    if (!this.currentScene.choices) {
      console.log('StoryEngine: Current scene has no choices array');
      return [];
    }

    console.log('StoryEngine: Processing', this.currentScene.choices.length, 'choices for scene:', this.currentScene.id);

    const evaluatedChoices = this.currentScene.choices.map(choice => {
      // Pass the set of discovered secret choice IDs as the second argument
      const discovered = Array.from(this.secretChoicesAvailable || []);
      const evaluation = this.choiceEvaluator.evaluateChoice(choice, discovered);
      
      // For secret choices, check if they've been discovered
      if (choice.isSecret && evaluation.state === 'VISIBLE') {
        evaluation.isNewlyDiscovered = this.secretChoicesAvailable.has(choice.id);
      }
      
      console.log(`StoryEngine: Choice "${choice.text}" state: ${evaluation.state}`);
      
      return {
        ...choice,
        evaluation: evaluation
      };
    });

    // Filter out hidden choices (keep VISIBLE, LOCKED, and SECRET that are discovered)
    const availableChoices = evaluatedChoices.filter(choice => {
      const state = choice.evaluation.state;
      return state === 'VISIBLE' || state === 'LOCKED' || 
             (state === 'SECRET' && this.secretChoicesAvailable.has(choice.id));
    });

    console.log('StoryEngine: Available choices:', availableChoices.length, 'of', this.currentScene.choices.length);
    return availableChoices;
  }

  // Make a choice with enhanced validation
  makeChoice(choiceId) {
    console.log('StoryEngine: Making choice:', choiceId);
    
    if (!this.currentScene) {
      console.error('StoryEngine: No current scene to make choice from');
      return null;
    }

    if (!this.currentScene.choices) {
      console.error('StoryEngine: Current scene has no choices');
      return null;
    }

    const choice = this.currentScene.choices.find(c => c.id === choiceId);
    if (!choice) {
      console.error('StoryEngine: Choice not found:', choiceId);
      return null;
    }

    console.log('StoryEngine: Found choice:', choice.text, '-> target:', choice.targetSceneId);

    // Evaluate choice state
    const evaluation = this.choiceEvaluator.evaluateChoice(choice, this.visitedScenes, this.choiceHistory);
    
    // Block locked or hidden choices
    if (evaluation.state === 'LOCKED') {
      console.warn('StoryEngine: Cannot select locked choice:', choice.text);
      console.warn('StoryEngine: Lock reasons:', evaluation.lockReasons);
      return null;
    }
    
    if (evaluation.state === 'HIDDEN') {
      console.warn('StoryEngine: Cannot select hidden choice:', choice.text);
      return null;
    }

    // Record choice in history
    const choiceRecord = {
      sceneId: this.currentScene.id,
      choiceId: choice.id,
      timestamp: Date.now()
    };
    this.choiceHistory.push(choiceRecord);
    this.choiceEvaluator.updateChoiceHistory(this.choiceHistory);

    // Execute choice actions (including inventory actions)
    if (choice.actions && choice.actions.length > 0) {
      console.log('StoryEngine: Executing', choice.actions.length, 'choice actions');
      this.executeActions(choice.actions);
    }

    // Navigate to target scene
    if (!choice.targetSceneId) {
      console.error('StoryEngine: Choice has no targetSceneId');
      return null;
    }

    return this.navigateToScene(choice.targetSceneId);
  }

  // Execute actions with inventory support
  executeActions(actions) {
    if (!actions || actions.length === 0) return;
    
    console.log('StoryEngine: Executing', actions.length, 'actions');
    
    actions.forEach(action => {
      console.log('StoryEngine: Executing action:', action.type, action.key, action.value);
      
      switch (action.type) {
        case 'set_stat':
          this.statsManager.setStat(action.key, action.value);
          break;
        case 'add_stat':
          this.statsManager.addToStat(action.key, action.value);
          break;
        case 'set_flag':
          this.statsManager.setFlag(action.key, action.value);
          break;
        case 'add_inventory':
          this.inventoryManager.addItem(action.key, action.value || 1);
          console.log(`StoryEngine: Added ${action.value || 1}x ${action.key} to inventory`);
          break;
        case 'remove_inventory':
          this.inventoryManager.removeItem(action.key, action.value || 1);
          console.log(`StoryEngine: Removed ${action.value || 1}x ${action.key} from inventory`);
          break;
        case 'set_inventory':
          this.inventoryManager.setItemCount(action.key, action.value || 0);
          console.log(`StoryEngine: Set ${action.key} count to ${action.value || 0}`);
          break;
        default:
          console.warn('StoryEngine: Unknown action type:', action.type);
      }
    });
  }

  // Load from save data with Phase 3 features
  loadFromSave(saveData) {
    if (!this.adventure) {
      console.error('StoryEngine: Cannot load save - no adventure loaded');
      return;
    }

    console.log('StoryEngine: Loading from save data');
    
    // Load basic data
    this.visitedScenes = [...(saveData.visitedScenes || [])];
    this.choiceHistory = [...(saveData.choiceHistory || [])];
    this.secretsDiscovered = [...(saveData.secretsDiscovered || [])];
    
    // Rebuild secret choices set
    this.secretChoicesAvailable = new Set(saveData.secretChoicesAvailable || []);
    
    // Load stats and inventory
    this.statsManager.loadFromSave(saveData.stats || {}, saveData.flags || {});
    
    if (saveData.inventory) {
      this.inventoryManager.loadFromSave(saveData.inventory);
    }
    
    // Update evaluators
    this.conditionParser.updateVisitedScenes(this.visitedScenes);
    this.choiceEvaluator.updateVisitedScenes(this.visitedScenes);
    this.choiceEvaluator.updateChoiceHistory(this.choiceHistory);
    
    // Navigate to saved scene
    this.navigateToScene(saveData.currentSceneId);
  }

  // Load from cross-game save data
  loadFromCrossGameSave(crossGameSaveData, transferOptions = {}) {
    if (!this.adventure) {
      console.error('StoryEngine: Cannot load cross-game save - no adventure loaded');
      return false;
    }

    console.log('StoryEngine: Loading from cross-game save data');
    
    try {
      const result = this.crossGameSaveSystem.importSaveData(
        crossGameSaveData, 
        this.adventure, 
        transferOptions
      );
      
      if (result.success) {
        // Apply transferred data
        if (result.transferredStats) {
          Object.entries(result.transferredStats).forEach(([key, value]) => {
            this.statsManager.setStat(key, value);
          });
        }
        
        if (result.transferredFlags) {
          Object.entries(result.transferredFlags).forEach(([key, value]) => {
            this.statsManager.setFlag(key, value);
          });
        }
        
        if (result.transferredInventory) {
          result.transferredInventory.forEach(item => {
            this.inventoryManager.addItem(item.id, item.count);
          });
        }
        
        console.log('StoryEngine: Cross-game save loaded successfully');
        console.log('StoryEngine: Transfer summary:', result.summary);
        return true;
      } else {
        console.error('StoryEngine: Cross-game save import failed:', result.errors);
        return false;
      }
    } catch (error) {
      console.error('StoryEngine: Error loading cross-game save:', error);
      return false;
    }
  }

  // Getters with Phase 3 additions
  getCurrentScene() {
    return this.currentScene;
  }

  getStatsManager() {
    return this.statsManager;
  }

  getInventoryManager() {
    return this.inventoryManager;
  }

  getChoiceEvaluator() {
    return this.choiceEvaluator;
  }

  getVisitedScenes() {
    return [...this.visitedScenes];
  }

  getChoiceHistory() {
    return [...this.choiceHistory];
  }

  getSecretsDiscovered() {
    return [...this.secretsDiscovered];
  }

  getSecretChoicesAvailable() {
    return new Set(this.secretChoicesAvailable);
  }

  /**
   * Validation utility methods
   */
  
  // Enable/disable runtime validation
  setValidationEnabled(enabled) {
    this.validationEnabled = enabled;
  }
  
  // Get last validation result
  getLastValidationResult() {
    return this.lastValidationResult;
  }
  
  // Validate current adventure state
  async validateCurrentState() {
    if (!this.adventure || !this.validationEnabled) return null;
    
    try {
      const result = await this.validationService.validate(this.adventure, {
        scope: 'runtime',
        currentScene: this.currentScene?.id,
        visitedScenes: this.visitedScenes,
        stats: this.statsManager.getAll(),
        inventory: this.inventoryManager.getAll()
      });
      
      this.lastValidationResult = result;
      return result;
    } catch (error) {
      console.error('StoryEngine: Runtime validation failed:', error);
      return null;
    }
  }
  
  // Check if current scene has validation issues
  validateCurrentScene() {
    if (!this.currentScene || !this.lastValidationResult) return [];
    
    const sceneIssues = [];
    
    // Filter issues related to current scene
    ['errors', 'warnings', 'info'].forEach(level => {
      if (this.lastValidationResult[level]) {
        this.lastValidationResult[level].forEach(issue => {
          if (issue.location?.includes(this.currentScene.id)) {
            sceneIssues.push({
              ...issue,
              level
            });
          }
        });
      }
    });
    
    return sceneIssues;
  }
  
  // Get validation health score for current state
  getValidationHealthScore() {
    if (!this.lastValidationResult) return null;
    
    return this.lastValidationResult.summary?.healthScore || 
           this.lastValidationResult.healthScore || 
           null;
  }

  // Generate exportable data for cross-game saves
  generateExportableData() {
    const inventoryExport = (this.inventoryManager && typeof this.inventoryManager.getExportableInventory === 'function')
      ? this.inventoryManager.getExportableInventory()
      : (this.inventoryManager && typeof this.inventoryManager.exportToSave === 'function')
        ? this.inventoryManager.exportToSave()
        : (this.inventoryManager && typeof this.inventoryManager.getAllItems === 'function')
          ? this.inventoryManager.getAllItems()
          : [];

    return {
      stats: this.statsManager.getExportableStats(),
      flags: this.statsManager.getExportableFlags(),
      inventory: inventoryExport,
      achievements: this.secretsDiscovered,
      validation: {
        lastResult: this.lastValidationResult?.summary,
        healthScore: this.getValidationHealthScore(),
        validationEnabled: this.validationEnabled
      },
      metadata: {
        adventureId: this.adventure?.id,
        adventureTitle: this.adventure?.title,
        completionPercentage: this.calculateCompletionPercentage(),
        playTime: Date.now() - (this.startTime || Date.now()),
        totalChoicesMade: this.choiceHistory.length,
        scenesVisited: this.visitedScenes.length,
        secretsFound: this.secretsDiscovered.length
      }
    };
  }

  // Calculate completion percentage
  calculateCompletionPercentage() {
    if (!this.adventure?.scenes) return 0;
    
    const totalScenes = this.adventure.scenes.length;
    const visitedScenes = this.visitedScenes.length;
    
    return Math.round((visitedScenes / totalScenes) * 100);
  }

  // Debug helper with Phase 3 additions
  debugState() {
    return {
      hasAdventure: !!this.adventure,
      adventureTitle: this.adventure?.title,
      scenesCount: this.adventure?.scenes?.length || 0,
      currentSceneId: this.currentScene?.id,
      currentSceneTitle: this.currentScene?.title,
      choicesCount: this.currentScene?.choices?.length || 0,
      visitedScenesCount: this.visitedScenes.length,
      choiceHistoryCount: this.choiceHistory.length,
      secretsDiscovered: this.secretsDiscovered.length,
      secretChoicesAvailable: this.secretChoicesAvailable.size,
      inventoryItems: this.inventoryManager.getAllItems().length,
      completionPercentage: this.calculateCompletionPercentage()
    };
  }

  // Initialize start time for play time tracking
  startAdventure() {
    this.startTime = Date.now();
  }
}