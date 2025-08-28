 
import { validateSaveData } from '../utils/validation.js';

export class SaveSystem {
  static SAVE_PREFIX = 'adventure_save_';
  static SAVE_LIST_KEY = 'adventure_saves_list';

  constructor(storyEngine) {
    this.storyEngine = storyEngine;
  }

  // Create save data from current game state
  createSaveData(name) {
    const currentScene = this.storyEngine.getCurrentScene();
    if (!currentScene) throw new Error('No current scene to save');

    const statsManager = this.storyEngine.getStatsManager();
    
    return {
      version: '1.0',
      adventureId: 'current', // Will be set properly when we have adventure loaded
      adventureVersion: '1.0',
      timestamp: Date.now(),
      playerName: name,
      currentSceneId: currentScene.id,
      stats: statsManager.getAllStats(),
      flags: statsManager.getAllFlags(),
      visitedScenes: this.storyEngine.getVisitedScenes(),
      choiceHistory: this.storyEngine.getChoiceHistory(),
      playthroughId: this.generatePlaythroughId()
    };
  }

  // Save game to localStorage
  async saveGame(name) {
    try {
      const saveData = this.createSaveData(name);
      const saveId = this.generateSaveId();
      const saveSlot = {
        id: saveId,
        name,
        data: saveData
      };

      // Save the data
      localStorage.setItem(
        SaveSystem.SAVE_PREFIX + saveId, 
        JSON.stringify(saveSlot)
      );

      // Update saves list
      this.updateSavesList(saveId, name, saveData);

      return saveId;
    } catch (error) {
      throw new Error(`Failed to save game: ${error}`);
    }
  }

  // Load game from localStorage
  async loadGame(saveId) {
    try {
      const saveJson = localStorage.getItem(SaveSystem.SAVE_PREFIX + saveId);
      if (!saveJson) throw new Error('Save not found');

      const saveSlot = JSON.parse(saveJson);
      
      if (!validateSaveData(saveSlot.data)) {
        throw new Error('Invalid save data');
      }

      // Load into story engine
      this.storyEngine.loadFromSave(saveSlot.data);

      return saveSlot.data;
    } catch (error) {
      throw new Error(`Failed to load game: ${error}`);
    }
  }

  // Get list of all saves
  async listSaves() {
    try {
      const savesListJson = localStorage.getItem(SaveSystem.SAVE_LIST_KEY);
      if (!savesListJson) return [];

      return JSON.parse(savesListJson);
    } catch (error) {
      return [];
    }
  }

  // Delete a save
  async deleteSave(saveId) {
    try {
      // Remove save data
      localStorage.removeItem(SaveSystem.SAVE_PREFIX + saveId);

      // Update saves list
      const savesList = await this.listSaves();
      const updatedList = savesList.filter(save => save.id !== saveId);
      localStorage.setItem(SaveSystem.SAVE_LIST_KEY, JSON.stringify(updatedList));
    } catch (error) {
      throw new Error(`Failed to delete save: ${error}`);
    }
  }

  // Quick save (overwrites slot 'quick')
  async quickSave() {
    await this.saveGame('Quick Save');
  }

  // Private helper methods
  generateSaveId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generatePlaythroughId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
  }

  updateSavesList(saveId, name, saveData) {
    const saveInfo = {
      id: saveId,
      name,
      timestamp: saveData.timestamp,
      adventureTitle: 'Current Adventure', // Will be proper when adventure is loaded
      currentSceneTitle: 'Current Scene'
    };

    const savesList = JSON.parse(localStorage.getItem(SaveSystem.SAVE_LIST_KEY) || '[]');
    
    // Remove existing save with same ID
    const filteredList = savesList.filter(save => save.id !== saveId);
    
    // Add new save info
    filteredList.unshift(saveInfo);
    
    // Keep only last 10 saves
    const limitedList = filteredList.slice(0, 10);
    
    localStorage.setItem(SaveSystem.SAVE_LIST_KEY, JSON.stringify(limitedList));
  }
}