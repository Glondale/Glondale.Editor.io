// SaveSystem.js - Enhanced version with Phase 3 advanced features
import { validateSaveData } from '../utils/validation.js';
import { CrossGameSaveSystem } from './CrossGameSaveSystem.js';
import { ExportableDataManager } from './ExportableDataManager.js';

export class SaveSystem {
  static SAVE_PREFIX = 'adventure_save_';
  static SAVE_LIST_KEY = 'adventure_saves_list';
  static CROSS_GAME_SAVE_PREFIX = 'cross_game_save_';
  static EXPORT_DATA_PREFIX = 'export_data_';

  constructor(storyEngine) {
    this.storyEngine = storyEngine;
    this.crossGameSaveSystem = new CrossGameSaveSystem();
    this.exportableDataManager = new ExportableDataManager();
  }

  // Create enhanced save data from current game state
  createSaveData(name) {
    const currentScene = this.storyEngine.getCurrentScene();
    if (!currentScene) throw new Error('No current scene to save');

    const statsManager = this.storyEngine.getStatsManager();
    const inventoryManager = this.storyEngine.getInventoryManager();
    const adventure = this.storyEngine.adventure;
    
    const saveData = {
      version: '2.0', // Updated version for Phase 3
      adventureId: adventure?.id || 'current',
      adventureVersion: adventure?.version || '1.0',
      timestamp: Date.now(),
      playerName: name,
      currentSceneId: currentScene.id,
      stats: statsManager.getAllStats(),
      flags: statsManager.getAllFlags(),
      visitedScenes: this.storyEngine.getVisitedScenes(),
      choiceHistory: this.storyEngine.getChoiceHistory(),
      playthroughId: this.generatePlaythroughId(),
      
      // Phase 3 additions
      secretsDiscovered: this.storyEngine.getSecretsDiscovered(),
      secretChoicesAvailable: Array.from(this.storyEngine.getSecretChoicesAvailable()),
      inventory: inventoryManager ? inventoryManager.getAllItems() : [],
      inventoryState: inventoryManager ? inventoryManager.getInventoryState() : {},
      
      // Analytics and export data
      exportableData: this.storyEngine.generateExportableData(),
      gameplayMetrics: this.generateGameplayMetrics(),
      saveMetadata: this.generateSaveMetadata(name, adventure)
    };

    return saveData;
  }

  // Generate gameplay metrics for analytics
  generateGameplayMetrics() {
    const choiceHistory = this.storyEngine.getChoiceHistory();
    const visitedScenes = this.storyEngine.getVisitedScenes();
    const secretsDiscovered = this.storyEngine.getSecretsDiscovered();
    
    // Calculate session time (rough estimate based on choice intervals)
    let estimatedPlayTime = 0;
    if (choiceHistory.length > 1) {
      const firstChoice = choiceHistory[0].timestamp;
      const lastChoice = choiceHistory[choiceHistory.length - 1].timestamp;
      estimatedPlayTime = lastChoice - firstChoice;
    }

    // Calculate choice frequency
    const sceneChoiceCounts = {};
    choiceHistory.forEach(choice => {
      sceneChoiceCounts[choice.sceneId] = (sceneChoiceCounts[choice.sceneId] || 0) + 1;
    });

    return {
      totalChoicesMade: choiceHistory.length,
      uniqueScenesVisited: visitedScenes.length,
      secretsFound: secretsDiscovered.length,
      estimatedPlayTime: estimatedPlayTime,
      averageChoicesPerScene: visitedScenes.length > 0 
        ? choiceHistory.length / visitedScenes.length 
        : 0,
      mostVisitedScenes: Object.entries(sceneChoiceCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      completionPercentage: this.storyEngine.calculateCompletionPercentage()
    };
  }

  // Generate save metadata
  generateSaveMetadata(name, adventure) {
    return {
      saveName: name,
      adventureTitle: adventure?.title || 'Unknown Adventure',
      adventureAuthor: adventure?.author || 'Unknown Author',
      currentSceneTitle: this.storyEngine.getCurrentScene()?.title || 'Unknown Scene',
      saveVersion: '2.0',
      engineVersion: 'Phase 3',
      compatibilityFlags: {
        hasInventory: !!this.storyEngine.getInventoryManager(),
        hasSecrets: this.storyEngine.getSecretsDiscovered().length > 0,
        hasCrossGameData: true,
        hasAnalytics: true
      }
    };
  }

  // Enhanced save game with Phase 3 features
  async saveGame(name) {
    try {
      const saveData = this.createSaveData(name);
      const saveId = this.generateSaveId();
      const saveSlot = {
        id: saveId,
        name,
        data: saveData,
        created: Date.now(),
        modified: Date.now()
      };

      // Validate save data before saving
      if (!validateSaveData(saveData)) {
        throw new Error('Generated save data is invalid');
      }

      // Save the data
      localStorage.setItem(
        SaveSystem.SAVE_PREFIX + saveId, 
        JSON.stringify(saveSlot)
      );

      // Update saves list
      this.updateSavesList(saveId, name, saveData);

      // Generate and save exportable data for cross-game compatibility
      await this.generateExportableDataFile(saveId, saveData);

      console.log('SaveSystem: Game saved successfully:', saveId);
      return saveId;
    } catch (error) {
      console.error('SaveSystem: Failed to save game:', error);
      throw new Error(`Failed to save game: ${error.message}`);
    }
  }

  // Generate exportable data file for cross-game saves
  async generateExportableDataFile(saveId, saveData) {
    try {
      const exportableData = this.exportableDataManager.generateExportData(saveData);
      localStorage.setItem(
        SaveSystem.EXPORT_DATA_PREFIX + saveId,
        JSON.stringify(exportableData)
      );
    } catch (error) {
      console.warn('SaveSystem: Failed to generate exportable data:', error);
      // Don't fail the save if export data generation fails
    }
  }

  // Enhanced load game with Phase 3 compatibility
  async loadGame(saveId) {
    try {
      const saveJson = localStorage.getItem(SaveSystem.SAVE_PREFIX + saveId);
      if (!saveJson) throw new Error('Save not found');

      const saveSlot = JSON.parse(saveJson);
      
      // Handle version compatibility
      const saveData = this.migrateSaveData(saveSlot.data);
      
      if (!validateSaveData(saveData)) {
        throw new Error('Invalid save data');
      }

      // Load into story engine with Phase 3 features
      this.storyEngine.loadFromSave(saveData);

      // Update modified timestamp
      saveSlot.modified = Date.now();
      localStorage.setItem(
        SaveSystem.SAVE_PREFIX + saveId, 
        JSON.stringify(saveSlot)
      );

      console.log('SaveSystem: Game loaded successfully:', saveId);
      return saveData;
    } catch (error) {
      console.error('SaveSystem: Failed to load game:', error);
      throw new Error(`Failed to load game: ${error.message}`);
    }
  }

  // Migrate save data between versions
  migrateSaveData(saveData) {
    if (!saveData.version) {
      // Migrate from version 1.0 to 2.0
      return {
        ...saveData,
        version: '2.0',
        secretsDiscovered: [],
        secretChoicesAvailable: [],
        inventory: [],
        inventoryState: {},
        exportableData: null,
        gameplayMetrics: null,
        saveMetadata: null
      };
    }
    return saveData;
  }

  // Export save data for cross-game compatibility
  async exportSaveForCrossGame(saveId, format = 'json') {
    try {
      const saveJson = localStorage.getItem(SaveSystem.SAVE_PREFIX + saveId);
      if (!saveJson) throw new Error('Save not found');

      const saveSlot = JSON.parse(saveJson);
      const exportableData = saveSlot.data.exportableData || 
        this.exportableDataManager.generateExportData(saveSlot.data);

      // Generate cross-game save data
      const crossGameSave = this.crossGameSaveSystem.generateCrossGameSave(
        saveSlot.data,
        exportableData
      );

      // Format based on requested format
      switch (format.toLowerCase()) {
        case 'json':
          return {
            data: crossGameSave,
            blob: new Blob([JSON.stringify(crossGameSave, null, 2)], 
              { type: 'application/json' }),
            filename: `cross-game-save-${saveId}.json`
          };
        
        case 'compact':
          const compactData = JSON.stringify(crossGameSave);
          return {
            data: crossGameSave,
            blob: new Blob([compactData], { type: 'application/json' }),
            filename: `cross-game-save-${saveId}-compact.json`
          };
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('SaveSystem: Failed to export save for cross-game:', error);
      throw new Error(`Failed to export save: ${error.message}`);
    }
  }

  // Import cross-game save data
  async importCrossGameSave(crossGameSaveData, transferOptions = {}) {
    try {
      // Validate cross-game save format
      if (!this.crossGameSaveSystem.validateCrossGameSave(crossGameSaveData)) {
        throw new Error('Invalid cross-game save format');
      }

      // Load the cross-game save into the current story engine
      const success = this.storyEngine.loadFromCrossGameSave(
        crossGameSaveData,
        transferOptions
      );

      if (success) {
        console.log('SaveSystem: Cross-game save imported successfully');
        return {
          success: true,
          message: 'Cross-game save imported successfully'
        };
      } else {
        throw new Error('Story engine rejected cross-game save data');
      }
    } catch (error) {
      console.error('SaveSystem: Failed to import cross-game save:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get enhanced list of all saves
  async listSaves() {
    try {
      const savesListJson = localStorage.getItem(SaveSystem.SAVE_LIST_KEY);
      if (!savesListJson) return [];

      const savesList = JSON.parse(savesListJson);
      
      // Enhance save info with additional metadata
      return savesList.map(save => ({
        ...save,
        hasExportData: !!localStorage.getItem(SaveSystem.EXPORT_DATA_PREFIX + save.id),
        canExportCrossGame: true,
        version: save.version || '1.0'
      }));
    } catch (error) {
      console.error('SaveSystem: Failed to list saves:', error);
      return [];
    }
  }

  // Delete a save with cleanup
  async deleteSave(saveId) {
    try {
      // Remove save data
      localStorage.removeItem(SaveSystem.SAVE_PREFIX + saveId);
      
      // Remove export data
      localStorage.removeItem(SaveSystem.EXPORT_DATA_PREFIX + saveId);

      // Update saves list
      const savesList = await this.listSaves();
      const updatedList = savesList.filter(save => save.id !== saveId);
      localStorage.setItem(SaveSystem.SAVE_LIST_KEY, JSON.stringify(updatedList));
      
      console.log('SaveSystem: Save deleted successfully:', saveId);
    } catch (error) {
      console.error('SaveSystem: Failed to delete save:', error);
      throw new Error(`Failed to delete save: ${error.message}`);
    }
  }

  // Enhanced quick save
  async quickSave() {
    return await this.saveGame('Quick Save');
  }

  // Auto-save functionality
  async autoSave() {
    try {
      const autoSaveId = 'autosave';
      const saveData = this.createSaveData('Auto Save');
      
      const saveSlot = {
        id: autoSaveId,
        name: 'Auto Save',
        data: saveData,
        created: Date.now(),
        modified: Date.now(),
        isAutoSave: true
      };

      localStorage.setItem(
        SaveSystem.SAVE_PREFIX + autoSaveId, 
        JSON.stringify(saveSlot)
      );

      console.log('SaveSystem: Auto save completed');
      return autoSaveId;
    } catch (error) {
      console.warn('SaveSystem: Auto save failed:', error);
      // Don't throw for auto save failures
      return null;
    }
  }

  // Get save analytics
  async getSaveAnalytics(saveId) {
    try {
      const saveJson = localStorage.getItem(SaveSystem.SAVE_PREFIX + saveId);
      if (!saveJson) throw new Error('Save not found');

      const saveSlot = JSON.parse(saveJson);
      const saveData = saveSlot.data;

      return {
        saveInfo: {
          name: saveSlot.name,
          created: saveSlot.created,
          modified: saveSlot.modified,
          version: saveData.version
        },
        gameplayMetrics: saveData.gameplayMetrics || {},
        exportableData: saveData.exportableData || {},
        compatibility: {
          hasInventory: !!saveData.inventory && saveData.inventory.length > 0,
          hasSecrets: !!saveData.secretsDiscovered && saveData.secretsDiscovered.length > 0,
          canExportCrossGame: !!saveData.exportableData
        }
      };
    } catch (error) {
      console.error('SaveSystem: Failed to get save analytics:', error);
      throw new Error(`Failed to get save analytics: ${error.message}`);
    }
  }

  // Private helper methods
  generateSaveId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generatePlaythroughId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
  }

  updateSavesList(saveId, name, saveData) {
    const adventure = this.storyEngine.adventure;
    const currentScene = this.storyEngine.getCurrentScene();
    
    const saveInfo = {
      id: saveId,
      name,
      timestamp: saveData.timestamp,
      adventureTitle: adventure?.title || 'Current Adventure',
      adventureId: adventure?.id || 'current',
      currentSceneTitle: currentScene?.title || 'Current Scene',
      version: saveData.version || '2.0',
      completionPercentage: saveData.gameplayMetrics?.completionPercentage || 0,
      secretsFound: saveData.secretsDiscovered?.length || 0,
      choicesMade: saveData.choiceHistory?.length || 0
    };

    const savesList = JSON.parse(localStorage.getItem(SaveSystem.SAVE_LIST_KEY) || '[]');
    
    // Remove existing save with same ID
    const filteredList = savesList.filter(save => save.id !== saveId);
    
    // Add new save info
    filteredList.unshift(saveInfo);
    
    // Keep only last 20 saves (increased from 10)
    const limitedList = filteredList.slice(0, 20);
    
    localStorage.setItem(SaveSystem.SAVE_LIST_KEY, JSON.stringify(limitedList));
  }

  // Cleanup old saves and data
  async cleanupOldSaves(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    try {
      const savesList = await this.listSaves();
      const cutoffTime = Date.now() - maxAge;
      
      let cleanedCount = 0;
      for (const save of savesList) {
        if (save.timestamp < cutoffTime && !save.name.includes('Auto Save')) {
          await this.deleteSave(save.id);
          cleanedCount++;
        }
      }
      
      console.log(`SaveSystem: Cleaned up ${cleanedCount} old saves`);
      return cleanedCount;
    } catch (error) {
      console.error('SaveSystem: Failed to cleanup old saves:', error);
      return 0;
    }
  }
}