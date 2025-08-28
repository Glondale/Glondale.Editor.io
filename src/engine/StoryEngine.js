// StoryEngine.js - Fixed version with better debugging and choice handling
import { StatsManager } from './StatsManager.js';
import { ConditionParser } from './ConditionParser.js';

export class StoryEngine {
  constructor() {
    this.adventure = null;
    this.currentScene = null;
    this.statsManager = new StatsManager();
    this.conditionParser = new ConditionParser(this.statsManager, []);
    this.visitedScenes = [];
    this.choiceHistory = [];
  }

  // Load an adventure
  loadAdventure(adventure) {
    console.log('StoryEngine: Loading adventure:', adventure?.title);
    console.log('StoryEngine: Adventure scenes:', adventure?.scenes?.length || 0);
    
    this.adventure = adventure;
    this.statsManager = new StatsManager(adventure.stats || []);
    this.conditionParser = new ConditionParser(this.statsManager, this.visitedScenes);
    
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

    return scene;
  }

  // Get available choices for current scene
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

    const availableChoices = this.currentScene.choices.filter(choice => {
      // Check if choice should be hidden
      if (choice.isHidden && choice.conditions) {
        const shouldShow = this.conditionParser.evaluateConditions(choice.conditions);
        console.log('StoryEngine: Hidden choice', choice.id, 'evaluation:', shouldShow);
        return shouldShow;
      }
      
      // Show non-hidden choices
      const shouldShow = !choice.isHidden;
      console.log('StoryEngine: Choice', choice.id, 'visible:', shouldShow);
      return shouldShow;
    });

    console.log('StoryEngine: Available choices:', availableChoices.length, 'of', this.currentScene.choices.length);
    return availableChoices;
  }

  // Make a choice
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

    // Check conditions
    if (choice.conditions && choice.conditions.length > 0) {
      const canMakeChoice = this.conditionParser.evaluateConditions(choice.conditions);
      console.log('StoryEngine: Choice conditions evaluation:', canMakeChoice);
      if (!canMakeChoice) {
        return null;
      }
    }

    // Record choice
    this.choiceHistory.push({
      sceneId: this.currentScene.id,
      choiceId: choice.id,
      timestamp: Date.now()
    });

    // Execute choice actions
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

  // Execute actions
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
        default:
          console.warn('StoryEngine: Unknown action type:', action.type);
      }
    });
  }

  // Getters
  getCurrentScene() {
    return this.currentScene;
  }

  getStatsManager() {
    return this.statsManager;
  }

  getVisitedScenes() {
    return [...this.visitedScenes];
  }

  getChoiceHistory() {
    return [...this.choiceHistory];
  }

  // Debug helper
  debugState() {
    return {
      hasAdventure: !!this.adventure,
      adventureTitle: this.adventure?.title,
      scenesCount: this.adventure?.scenes?.length || 0,
      currentSceneId: this.currentScene?.id,
      currentSceneTitle: this.currentScene?.title,
      choicesCount: this.currentScene?.choices?.length || 0,
      visitedScenesCount: this.visitedScenes.length,
      choiceHistoryCount: this.choiceHistory.length
    };
  }

  // Load from save data
 loadFromSave(saveData) {
    if (!this.adventure) {
      console.error('StoryEngine: Cannot load save - no adventure loaded');
      return;
    }

    console.log('StoryEngine: Loading from save data');
    
    this.visitedScenes = [...saveData.visitedScenes];
    this.choiceHistory = [...saveData.choiceHistory];
    this.statsManager.loadFromSave(saveData.stats, saveData.flags);
    this.conditionParser.updateVisitedScenes(this.visitedScenes);
    this.navigateToScene(saveData.currentSceneId);
  }
}