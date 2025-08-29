// SaveSystem.js - Enhanced version with Phase 3 advanced features
import { validateSaveData } from '../utils/validation.js';
import { CrossGameSaveSystem } from './CrossGameSaveSystem.js';
import { ExportableDataManager } from './ExportableDataManager.js';
import { logError, logWarning, logInfo } from '../utils/errorLogger.js';

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

  // Enhanced save game with Phase 3 features and comprehensive error handling
  async saveGame(name) {
    const startTime = Date.now();
    const context = { name, operation: 'save' };
    
    try {
      logInfo('Starting save operation', context);
      
      // Step 1: Create save data with validation
      const saveData = await this.createSaveDataSafely(name);

      // Allow overwriting existing saves by name: if a save with the same name exists
      // reuse its ID so the new save overwrites the old one.
      let saveId = this.generateSaveId();
      try {
        const listJson = localStorage.getItem(SaveSystem.SAVE_LIST_KEY) || '[]';
        const savesList = JSON.parse(listJson);
        const existing = savesList.find(s => s.name === name);
        if (existing && existing.id) {
          saveId = existing.id; // overwrite
          logInfo('Overwriting existing save by name', { ...context, saveId });
        }
      } catch (e) {
        // ignore parsing errors and continue with new id
      }
      
      // Step 2: Create backup if existing save exists
      await this.createBackupIfExists(saveId, context);
      
      // Step 3: Create save slot with checksums
      const saveSlot = {
        id: saveId,
        name,
        data: saveData,
        created: Date.now(),
        modified: Date.now(),
        checksum: this.calculateChecksum(saveData),
        version: '2.0'
      };

      // Step 4: Validate save slot integrity
      const validation = await this.validateSaveSlot(saveSlot);
      if (!validation.isValid) {
        throw new Error(`Save validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 5: Atomic save operation with retry logic
      await this.atomicSave(saveId, saveSlot, context);

      // Step 6: Update saves list with error recovery
      await this.updateSavesListSafely(saveId, name, saveData);

      // Step 7: Generate exportable data (non-blocking)
      this.generateExportableDataFile(saveId, saveData).catch(error => {
        logWarning('Failed to generate exportable data', { saveId, error: error.message });
      });

      const elapsed = Date.now() - startTime;
      logInfo('Save operation completed successfully', { ...context, saveId, elapsed });
      
      return saveId;
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorId = logError({
        type: 'save_failure',
        message: `Failed to save game: ${error.message}`,
        error: error,
        stack: error.stack
      }, { ...context, elapsed });
      
      throw new Error(`Save operation failed [${errorId}]: ${error.message}`);
    }
  }

  // Create save data with validation and fallback handling
  async createSaveDataSafely(name) {
    try {
      const saveData = this.createSaveData(name);
      
      // Additional integrity checks
      if (!saveData.adventureId || !saveData.currentSceneId) {
        throw new Error('Critical save data fields missing');
      }
      
      // Validate data size (prevent localStorage overflow)
      const dataSize = JSON.stringify(saveData).length;
      if (dataSize > 5000000) { // 5MB limit
        logWarning('Save data is very large, attempting compression', { size: dataSize });
        // Could implement compression here if needed
      }
      
      return saveData;
      
    } catch (error) {
      logError({
        type: 'save_data_creation_failure',
        message: `Failed to create save data: ${error.message}`,
        error: error
      }, { name });
      throw error;
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

  // === Error Handling and Corruption Recovery Methods ===

  // Calculate checksum for data integrity verification
  calculateChecksum(data) {
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString();
  }

  // Validate save slot integrity with comprehensive checks
  async validateSaveSlot(saveSlot) {
    const errors = [];
    const warnings = [];

    try {
      // Basic structure validation
      if (!saveSlot.id || !saveSlot.name || !saveSlot.data) {
        errors.push('Missing required save slot fields');
      }

      // Data validation
      if (saveSlot.data) {
        const basicValidation = validateSaveData(saveSlot.data);
        if (!basicValidation) {
          errors.push('Save data failed basic validation');
        }

        // Checksum validation
        if (saveSlot.checksum) {
          const calculatedChecksum = this.calculateChecksum(saveSlot.data);
          if (calculatedChecksum !== saveSlot.checksum) {
            errors.push('Checksum mismatch - data may be corrupted');
          }
        } else {
          warnings.push('No checksum available for integrity verification');
        }

        // Size validation
        const dataSize = JSON.stringify(saveSlot.data).length;
        if (dataSize > 10000000) { // 10MB limit
          errors.push('Save data is too large');
        } else if (dataSize < 100) {
          errors.push('Save data is suspiciously small');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logError({
        type: 'save_validation_error',
        message: `Save slot validation failed: ${error.message}`,
        error: error
      }, { saveSlotId: saveSlot?.id });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings
      };
    }
  }

  // Create backup of existing save before overwriting
  async createBackupIfExists(saveId, context) {
    try {
      const existingKey = SaveSystem.SAVE_PREFIX + saveId;
      const existingSave = localStorage.getItem(existingKey);
      
      if (existingSave) {
        const backupKey = `${existingKey}_backup_${Date.now()}`;
        localStorage.setItem(backupKey, existingSave);
        
        logInfo('Created backup of existing save', { ...context, saveId, backupKey });
        
        // Cleanup old backups (keep only 3 most recent)
        this.cleanupOldBackups(saveId);
      }
    } catch (error) {
      logWarning('Failed to create save backup', { ...context, saveId, error: error.message });
      // Don't fail the save operation if backup fails
    }
  }

  // Atomic save operation with retry logic
  async atomicSave(saveId, saveSlot, context, maxRetries = 3) {
    const saveKey = SaveSystem.SAVE_PREFIX + saveId;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Test localStorage availability and space
        await this.testStorageAvailability();
        
        // Serialize data
        const serializedData = JSON.stringify(saveSlot);
        
        // Attempt save
        localStorage.setItem(saveKey, serializedData);
        
        // Verify save was successful
        const verification = localStorage.getItem(saveKey);
        if (!verification || verification !== serializedData) {
          throw new Error('Save verification failed - data mismatch');
        }
        
        logInfo('Atomic save completed successfully', { 
          ...context, 
          saveId, 
          attempt, 
          dataSize: serializedData.length 
        });
        
        return; // Success!
        
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const logLevel = isLastAttempt ? 'error' : 'warning';
        
        (logLevel === 'error' ? logError : logWarning)({
          type: 'atomic_save_attempt_failed',
          message: `Save attempt ${attempt}/${maxRetries} failed: ${error.message}`,
          error: error
        }, { ...context, saveId, attempt });
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  // Test localStorage availability and free space
  async testStorageAvailability() {
    try {
      const testKey = '__storage_test__';
      const testData = 'test';
      
      localStorage.setItem(testKey, testData);
      
      if (localStorage.getItem(testKey) !== testData) {
        throw new Error('localStorage write/read test failed');
      }
      
      localStorage.removeItem(testKey);
      
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        throw new Error('localStorage is full - cannot save data');
      }
      throw new Error(`localStorage is not available: ${error.message}`);
    }
  }

  // Enhanced load game with corruption recovery
  async loadGameSafely(saveId) {
    const startTime = Date.now();
    const context = { saveId, operation: 'load' };
    
    try {
      logInfo('Starting load operation', context);
      
      // Step 1: Attempt primary load
      let saveSlot;
      try {
        saveSlot = await this.loadSaveSlot(saveId);
      } catch (primaryError) {
        logWarning('Primary load failed, attempting recovery', { 
          ...context, 
          primaryError: primaryError.message 
        });
        
        // Step 2: Attempt recovery from backup
        saveSlot = await this.recoverFromBackup(saveId, primaryError);
      }
      
      // Step 3: Validate loaded data
      const validation = await this.validateSaveSlot(saveSlot);
      if (!validation.isValid) {
        // Attempt data repair if possible
        saveSlot = await this.repairSaveData(saveSlot, validation);
      }
      
      // Step 4: Migrate save data if needed
      const migratedData = this.migrateSaveData(saveSlot.data);
      
      // Step 5: Load into story engine with fallback
      await this.loadIntoEngine(migratedData, context);
      
      // Step 6: Update metadata
      await this.updateLoadMetadata(saveId, saveSlot);
      
      const elapsed = Date.now() - startTime;
      logInfo('Load operation completed successfully', { ...context, elapsed });
      
      return migratedData;
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorId = logError({
        type: 'load_failure',
        message: `Failed to load game: ${error.message}`,
        error: error,
        stack: error.stack
      }, { ...context, elapsed });
      
      throw new Error(`Load operation failed [${errorId}]: ${error.message}`);
    }
  }

  // Load save slot with error handling
  async loadSaveSlot(saveId) {
    const saveJson = localStorage.getItem(SaveSystem.SAVE_PREFIX + saveId);
    if (!saveJson) {
      throw new Error('Save file not found');
    }
    
    try {
      const saveSlot = JSON.parse(saveJson);
      return saveSlot;
    } catch (parseError) {
      throw new Error(`Save file is corrupted: ${parseError.message}`);
    }
  }

  // Recover from backup when primary save fails
  async recoverFromBackup(saveId, primaryError) {
    const backupPattern = `${SaveSystem.SAVE_PREFIX}${saveId}_backup_`;
    const backupKeys = [];
    
    // Find all backup keys for this save
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(backupPattern)) {
        backupKeys.push(key);
      }
    }
    
    if (backupKeys.length === 0) {
      throw new Error(`No backups available for recovery. Original error: ${primaryError.message}`);
    }
    
    // Sort by timestamp (most recent first)
    backupKeys.sort((a, b) => {
      const timestampA = parseInt(a.split('_backup_')[1]);
      const timestampB = parseInt(b.split('_backup_')[1]);
      return timestampB - timestampA;
    });
    
    // Try each backup in order
    for (const backupKey of backupKeys) {
      try {
        const backupJson = localStorage.getItem(backupKey);
        if (backupJson) {
          const saveSlot = JSON.parse(backupJson);
          
          logInfo('Successfully recovered from backup', { 
            saveId, 
            backupKey, 
            primaryError: primaryError.message 
          });
          
          return saveSlot;
        }
      } catch (backupError) {
        logWarning('Backup recovery failed, trying next backup', { 
          saveId, 
          backupKey, 
          backupError: backupError.message 
        });
        continue;
      }
    }
    
    throw new Error(`All backup recovery attempts failed. Original error: ${primaryError.message}`);
  }

  // Repair corrupted save data
  async repairSaveData(saveSlot, validation) {
    logInfo('Attempting to repair corrupted save data', { 
      saveSlotId: saveSlot.id, 
      errors: validation.errors 
    });
    
    const repairedSlot = JSON.parse(JSON.stringify(saveSlot)); // Deep clone
    let repairsMade = 0;
    
    try {
      // Repair missing critical fields
      if (!repairedSlot.data.adventureId) {
        repairedSlot.data.adventureId = 'recovered_adventure';
        repairsMade++;
      }
      
      if (!repairedSlot.data.currentSceneId && repairedSlot.data.visitedScenes?.length > 0) {
        repairedSlot.data.currentSceneId = repairedSlot.data.visitedScenes[repairedSlot.data.visitedScenes.length - 1];
        repairsMade++;
      }
      
      if (!repairedSlot.data.stats) {
        repairedSlot.data.stats = {};
        repairsMade++;
      }
      
      if (!repairedSlot.data.flags) {
        repairedSlot.data.flags = {};
        repairsMade++;
      }
      
      if (!Array.isArray(repairedSlot.data.visitedScenes)) {
        repairedSlot.data.visitedScenes = [];
        repairsMade++;
      }
      
      if (!Array.isArray(repairedSlot.data.choiceHistory)) {
        repairedSlot.data.choiceHistory = [];
        repairsMade++;
      }
      
      // Recalculate checksum
      repairedSlot.checksum = this.calculateChecksum(repairedSlot.data);
      
      if (repairsMade > 0) {
        logInfo('Save data repair completed', { 
          saveSlotId: saveSlot.id, 
          repairsMade,
          originalErrors: validation.errors.length 
        });
      }
      
      return repairedSlot;
      
    } catch (repairError) {
      logError({
        type: 'save_repair_failed',
        message: `Failed to repair save data: ${repairError.message}`,
        error: repairError
      }, { saveSlotId: saveSlot.id });
      
      throw new Error(`Save data is too corrupted to repair: ${repairError.message}`);
    }
  }

  // Load data into story engine with fallback handling
  async loadIntoEngine(saveData, context) {
    try {
      this.storyEngine.loadFromSave(saveData);
    } catch (engineError) {
      logError({
        type: 'engine_load_failure',
        message: `Failed to load save into story engine: ${engineError.message}`,
        error: engineError
      }, context);
      
      throw new Error(`Cannot load save into game engine: ${engineError.message}`);
    }
  }

  // Update load metadata
  async updateLoadMetadata(saveId, saveSlot) {
    try {
      saveSlot.modified = Date.now();
      const updatedSaveSlot = {
        ...saveSlot,
        lastLoaded: Date.now()
      };
      
      localStorage.setItem(
        SaveSystem.SAVE_PREFIX + saveId,
        JSON.stringify(updatedSaveSlot)
      );
    } catch (error) {
      logWarning('Failed to update load metadata', { saveId, error: error.message });
      // Don't fail the load operation for metadata update failures
    }
  }

  // Update saves list with error recovery
  async updateSavesListSafely(saveId, name, saveData) {
    try {
      this.updateSavesList(saveId, name, saveData);
    } catch (error) {
      logError({
        type: 'saves_list_update_failure',
        message: `Failed to update saves list: ${error.message}`,
        error: error
      }, { saveId, name });
      
      // Try to recover saves list
      await this.recoverSavesList();
    }
  }

  // Recover corrupted saves list
  async recoverSavesList() {
    try {
      logInfo('Attempting to recover saves list');
      
      const recoveredSaves = [];
      const savePrefix = SaveSystem.SAVE_PREFIX;
      
      // Scan localStorage for save files
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(savePrefix) && !key.includes('_backup_')) {
          try {
            const saveJson = localStorage.getItem(key);
            if (saveJson) {
              const saveSlot = JSON.parse(saveJson);
              const saveId = key.replace(savePrefix, '');
              
              // Create basic save info
              const saveInfo = {
                id: saveId,
                name: saveSlot.name || 'Recovered Save',
                timestamp: saveSlot.data?.timestamp || saveSlot.created || Date.now(),
                adventureTitle: saveSlot.data?.saveMetadata?.adventureTitle || 'Unknown Adventure',
                currentSceneTitle: saveSlot.data?.saveMetadata?.currentSceneTitle || 'Unknown Scene'
              };
              
              recoveredSaves.push(saveInfo);
            }
          } catch (parseError) {
            logWarning('Failed to parse save during recovery', { key, parseError: parseError.message });
          }
        }
      }
      
      // Sort by timestamp (newest first)
      recoveredSaves.sort((a, b) => b.timestamp - a.timestamp);
      
      // Save recovered list
      localStorage.setItem(SaveSystem.SAVE_LIST_KEY, JSON.stringify(recoveredSaves));
      
      logInfo('Saves list recovery completed', { recoveredCount: recoveredSaves.length });
      
    } catch (error) {
      logError({
        type: 'saves_list_recovery_failed',
        message: `Failed to recover saves list: ${error.message}`,
        error: error
      });
    }
  }

  // Cleanup old backup files
  cleanupOldBackups(saveId) {
    try {
      const backupPattern = `${SaveSystem.SAVE_PREFIX}${saveId}_backup_`;
      const backupKeys = [];
      
      // Find all backup keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(backupPattern)) {
          const timestamp = parseInt(key.split('_backup_')[1]);
          backupKeys.push({ key, timestamp });
        }
      }
      
      // Keep only the 3 most recent backups
      if (backupKeys.length > 3) {
        backupKeys.sort((a, b) => b.timestamp - a.timestamp);
        const toDelete = backupKeys.slice(3);
        
        toDelete.forEach(backup => {
          localStorage.removeItem(backup.key);
        });
        
        logInfo('Cleaned up old backups', { saveId, deletedCount: toDelete.length });
      }
    } catch (error) {
      logWarning('Failed to cleanup old backups', { saveId, error: error.message });
    }
  }

  // Replace the original loadGame method with the safe version
  async loadGame(saveId) {
    return await this.loadGameSafely(saveId);
  }
}