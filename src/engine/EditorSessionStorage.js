/**
 * EditorSessionStorage.js - Editor session persistence system
 * 
 * Features:
 * - Save/load editor sessions with metadata
 * - Auto-save functionality with configurable intervals
 * - Session versioning and conflict resolution
 * - Canvas state persistence (viewport, selections)
 * - Project templates and quick-start options
 * 
 * Integration Points:
 * - EditorScreen: Auto-save integration and session restoration
 * - EditorToolbar: Save/Load/New project buttons
 * - ExportSystem: Convert sessions to playable adventures
 * - ValidationEngine: Validate sessions before save
 */

export class EditorSessionStorage {
  constructor() {
    this.storagePrefix = 'adventure_editor_';
    this.autoSaveInterval = null;
    this.autoSaveDelay = 30000; // 30 seconds
    this.lastSaveTime = 0;
    this.isDirty = false;
    
    // Session format version for migration
    this.currentVersion = '1.0.0';
    
    // Auto-save configuration
    this.autoSaveEnabled = true;
    this.maxAutoSaves = 5;
    
    // Performance optimization
    this.compressionEnabled = true;
    this.saveQueue = new Map();
  }

  /**
   * Create new editor session
   * @param {string} projectName - Name for the new project
   * @param {string} template - Template type ('blank', 'simple', 'tutorial')
   * @returns {Object} { success, sessionId, session }
   */
  createNewSession(projectName, template = 'blank') {
    const sessionId = this.generateSessionId();
    const templateData = this.getTemplate(template);
    
    const session = {
      id: sessionId,
      version: this.currentVersion,
      metadata: {
        name: projectName,
        created: Date.now(),
        lastModified: Date.now(),
        lastSaved: null,
        template: template,
        author: '',
        description: ''
      },
      adventure: {
        id: sessionId,
        title: projectName,
        author: '',
        version: '1.0.0',
        description: '',
        startSceneId: templateData.startSceneId,
        scenes: templateData.scenes,
        stats: templateData.stats,
        items: templateData.items || []
      },
      editorState: {
        viewport: { x: 0, y: 0, zoom: 1 },
        selectedNodeId: null,
        selectedConnectionId: null,
        nodePositions: templateData.positions || new Map(),
        gridEnabled: true,
        snapToGrid: true,
        showMinimap: false
      },
      settings: {
        autoSave: this.autoSaveEnabled,
        autoSaveInterval: this.autoSaveDelay,
        validateOnSave: true,
        showWarnings: true
      }
    };

    const saveResult = this.saveSession(sessionId, session);
    
    if (saveResult.success) {
      this.startAutoSave(sessionId);
      return {
        success: true,
        sessionId: sessionId,
        session: session
      };
    }

    return {
      success: false,
      error: saveResult.error,
      sessionId: null,
      session: null
    };
  }

  /**
   * Save editor session to localStorage
   * @param {string} sessionId - Session identifier
   * @param {Object} sessionData - Complete session data
   * @param {boolean} isAutoSave - Whether this is an auto-save
   * @returns {Object} { success, error, savedAt }
   */
  saveSession(sessionId, sessionData, isAutoSave = false) {
    try {
      // Validate session data
      const validation = this.validateSession(sessionData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          savedAt: null
        };
      }

      // Update metadata
      const updatedSession = {
        ...sessionData,
        metadata: {
          ...sessionData.metadata,
          lastModified: Date.now(),
          lastSaved: Date.now(),
          saveType: isAutoSave ? 'auto' : 'manual'
        }
      };

      // Prepare storage data
      const storageData = {
        version: this.currentVersion,
        session: updatedSession,
        compressed: this.compressionEnabled,
        savedAt: Date.now()
      };

      // Compress if enabled
      let dataToStore = JSON.stringify(storageData);
      if (this.compressionEnabled) {
        dataToStore = this.compressData(dataToStore);
      }

      // Store with error handling
      const storageKey = this.getSessionKey(sessionId);
      localStorage.setItem(storageKey, dataToStore);

      // Update session list
      this.updateSessionList(sessionId, updatedSession.metadata);

      // Handle auto-save cleanup
      if (isAutoSave) {
        this.cleanupAutoSaves(sessionId);
      }

      this.lastSaveTime = Date.now();
      this.isDirty = false;

      return {
        success: true,
        error: null,
        savedAt: updatedSession.metadata.lastSaved
      };

    } catch (error) {
      console.error('Failed to save session:', error);
      return {
        success: false,
        error: error.message,
        savedAt: null
      };
    }
  }

  /**
   * Load editor session from localStorage
   * @param {string} sessionId - Session identifier
   * @returns {Object} { success, session, error, needsMigration }
   */
  loadSession(sessionId) {
    try {
      const storageKey = this.getSessionKey(sessionId);
      const storedData = localStorage.getItem(storageKey);

      if (!storedData) {
        return {
          success: false,
          session: null,
          error: 'Session not found',
          needsMigration: false
        };
      }

      // Decompress if needed
      let parsedData;
      try {
        parsedData = JSON.parse(storedData);
        
        // Handle compressed data
        if (parsedData.compressed) {
          const decompressedData = this.decompressData(storedData);
          parsedData = JSON.parse(decompressedData);
        }
      } catch (parseError) {
        return {
          success: false,
          session: null,
          error: 'Invalid session data format',
          needsMigration: false
        };
      }

      // Check version and migrate if needed
      const migrationResult = this.migrateSession(parsedData);
      
      if (!migrationResult.success) {
        return {
          success: false,
          session: null,
          error: migrationResult.error,
          needsMigration: true
        };
      }

      const session = migrationResult.session;
      
      // Validate loaded session
      const validation = this.validateSession(session.session);
      if (!validation.isValid) {
        console.warn('Loaded session has validation issues:', validation.errors);
      }

      // Start auto-save for this session
      this.startAutoSave(sessionId);

      return {
        success: true,
        session: session.session,
        error: null,
        needsMigration: migrationResult.wasMigrated
      };

    } catch (error) {
      console.error('Failed to load session:', error);
      return {
        success: false,
        session: null,
        error: error.message,
        needsMigration: false
      };
    }
  }

  /**
   * Get list of all saved sessions
   * @returns {Array} Array of session metadata
   */
  listSessions() {
    try {
      const sessionListKey = `${this.storagePrefix}session_list`;
      const storedList = localStorage.getItem(sessionListKey);
      
      if (!storedList) {
        return [];
      }

      const sessionList = JSON.parse(storedList);
      
      // Sort by last modified (most recent first)
      return sessionList.sort((a, b) => b.lastModified - a.lastModified);

    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Delete editor session
   * @param {string} sessionId - Session identifier
   * @returns {Object} { success, error }
   */
  deleteSession(sessionId) {
    try {
      const storageKey = this.getSessionKey(sessionId);
      
      // Remove main session data
      localStorage.removeItem(storageKey);
      
      // Remove auto-saves
      this.cleanupAutoSaves(sessionId, true);
      
      // Remove from session list
      this.removeFromSessionList(sessionId);
      
      // Stop auto-save if active
      if (this.autoSaveInterval && this.currentSessionId === sessionId) {
        this.stopAutoSave();
      }

      return {
        success: true,
        error: null
      };

    } catch (error) {
      console.error('Failed to delete session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start auto-save for current session
   * @param {string} sessionId - Session identifier
   */
  startAutoSave(sessionId) {
    this.stopAutoSave(); // Stop any existing auto-save
    
    if (!this.autoSaveEnabled) {
      return;
    }

    this.currentSessionId = sessionId;
    
    this.autoSaveInterval = setInterval(() => {
      if (this.isDirty && this.onAutoSave) {
        this.performAutoSave(sessionId);
      }
    }, this.autoSaveDelay);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      this.currentSessionId = null;
    }
  }

  /**
   * Perform auto-save operation
   * @private
   */
  performAutoSave(sessionId) {
    if (this.onAutoSave && typeof this.onAutoSave === 'function') {
      const sessionData = this.onAutoSave();
      if (sessionData) {
        const autoSaveKey = `${sessionId}_autosave_${Date.now()}`;
        this.saveSession(autoSaveKey, sessionData, true);
      }
    }
  }

  /**
   * Mark session as dirty (needs saving)
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * Export session to downloadable file
   * @param {string} sessionId - Session identifier
   * @returns {Object} { success, blob, filename, error }
   */
  exportSession(sessionId) {
    try {
      const loadResult = this.loadSession(sessionId);
      
      if (!loadResult.success) {
        return {
          success: false,
          blob: null,
          filename: null,
          error: loadResult.error
        };
      }

      const session = loadResult.session;
      const exportData = {
        type: 'adventure_editor_session',
        version: this.currentVersion,
        exported: Date.now(),
        session: session
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const filename = `${session.metadata.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_session.json`;

      return {
        success: true,
        blob: blob,
        filename: filename,
        error: null
      };

    } catch (error) {
      return {
        success: false,
        blob: null,
        filename: null,
        error: error.message
      };
    }
  }

  /**
   * Import session from file
   * @param {File} file - JSON file containing session data
   * @returns {Promise<Object>} { success, sessionId, session, error }
   */
  async importSession(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate import format
      if (importData.type !== 'adventure_editor_session') {
        return {
          success: false,
          sessionId: null,
          session: null,
          error: 'Invalid session file format'
        };
      }

      // Generate new session ID to avoid conflicts
      const newSessionId = this.generateSessionId();
      const session = {
        ...importData.session,
        id: newSessionId,
        metadata: {
          ...importData.session.metadata,
          created: Date.now(),
          lastModified: Date.now(),
          lastSaved: null
        }
      };

      // Save imported session
      const saveResult = this.saveSession(newSessionId, session);
      
      if (saveResult.success) {
        return {
          success: true,
          sessionId: newSessionId,
          session: session,
          error: null
        };
      }

      return {
        success: false,
        sessionId: null,
        session: null,
        error: saveResult.error
      };

    } catch (error) {
      return {
        success: false,
        sessionId: null,
        session: null,
        error: `Import failed: ${error.message}`
      };
    }
  }

  /**
   * Get project templates
   * @private
   */
  getTemplate(templateType) {
    const templates = {
      blank: {
        startSceneId: 'start',
        scenes: [{
          id: 'start',
          title: 'Beginning',
          content: 'This is where your adventure begins...',
          choices: []
        }],
        stats: [{
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100
        }],
        positions: new Map([['start', { x: 400, y: 300 }]])
      },
      
      simple: {
        startSceneId: 'intro',
        scenes: [
          {
            id: 'intro',
            title: 'The Adventure Begins',
            content: 'You stand at the entrance to a mysterious forest. What do you do?',
            choices: [
              { id: 'forest', text: 'Enter the forest', targetSceneId: 'forest' },
              { id: 'village', text: 'Return to village', targetSceneId: 'village' }
            ]
          },
          {
            id: 'forest',
            title: 'Dark Forest',
            content: 'The forest is darker than you expected...',
            choices: []
          },
          {
            id: 'village',
            title: 'Village',
            content: 'The village is quiet and peaceful.',
            choices: []
          }
        ],
        stats: [
          { id: 'health', name: 'Health', type: 'number', defaultValue: 100, min: 0, max: 100 },
          { id: 'courage', name: 'Courage', type: 'number', defaultValue: 50, min: 0, max: 100 }
        ],
        positions: new Map([
          ['intro', { x: 400, y: 200 }],
          ['forest', { x: 300, y: 400 }],
          ['village', { x: 500, y: 400 }]
        ])
      }
    };

    return templates[templateType] || templates.blank;
  }

  /**
   * Generate unique session ID
   * @private
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get storage key for session
   * @private
   */
  getSessionKey(sessionId) {
    return `${this.storagePrefix}${sessionId}`;
  }

  /**
   * Update session list metadata
   * @private
   */
  updateSessionList(sessionId, metadata) {
    try {
      const sessionListKey = `${this.storagePrefix}session_list`;
      const storedList = localStorage.getItem(sessionListKey);
      let sessionList = storedList ? JSON.parse(storedList) : [];

      // Remove existing entry
      sessionList = sessionList.filter(s => s.id !== sessionId);

      // Add updated entry
      sessionList.push({
        id: sessionId,
        name: metadata.name,
        created: metadata.created,
        lastModified: metadata.lastModified,
        lastSaved: metadata.lastSaved,
        template: metadata.template
      });

      localStorage.setItem(sessionListKey, JSON.stringify(sessionList));

    } catch (error) {
      console.error('Failed to update session list:', error);
    }
  }

  /**
   * Remove session from session list
   * @private
   */
  removeFromSessionList(sessionId) {
    try {
      const sessionListKey = `${this.storagePrefix}session_list`;
      const storedList = localStorage.getItem(sessionListKey);
      
      if (storedList) {
        const sessionList = JSON.parse(storedList);
        const filtered = sessionList.filter(s => s.id !== sessionId);
        localStorage.setItem(sessionListKey, JSON.stringify(filtered));
      }

    } catch (error) {
      console.error('Failed to remove from session list:', error);
    }
  }

  /**
   * Validate session data
   * @private
   */
  validateSession(session) {
    const errors = [];

    if (!session.id) errors.push('Missing session ID');
    if (!session.adventure) errors.push('Missing adventure data');
    if (!session.metadata) errors.push('Missing metadata');
    if (!session.editorState) errors.push('Missing editor state');

    if (session.adventure) {
      if (!session.adventure.scenes || !Array.isArray(session.adventure.scenes)) {
        errors.push('Invalid scenes data');
      }
      if (!session.adventure.startSceneId) {
        errors.push('Missing start scene ID');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Migrate session to current version
   * @private
   */
  migrateSession(data) {
    try {
      // Currently only one version exists, but this is prepared for future migrations
      if (!data.version || data.version === this.currentVersion) {
        return {
          success: true,
          session: data,
          wasMigrated: false
        };
      }

      // Future migration logic would go here
      return {
        success: true,
        session: data,
        wasMigrated: false
      };

    } catch (error) {
      return {
        success: false,
        session: null,
        error: error.message,
        wasMigrated: false
      };
    }
  }

  /**
   * Simple compression (placeholder for real compression)
   * @private
   */
  compressData(data) {
    // In a real implementation, you might use LZ-string or similar
    return data;
  }

  /**
   * Simple decompression (placeholder)
   * @private
   */
  decompressData(data) {
    return data;
  }

  /**
   * Cleanup old auto-saves
   * @private
   */
  cleanupAutoSaves(sessionId, deleteAll = false) {
    try {
      const keys = Object.keys(localStorage);
      const autoSaveKeys = keys.filter(key => 
        key.startsWith(`${this.storagePrefix}${sessionId}_autosave_`)
      );

      if (deleteAll) {
        autoSaveKeys.forEach(key => localStorage.removeItem(key));
      } else if (autoSaveKeys.length > this.maxAutoSaves) {
        // Sort by timestamp and remove oldest
        const sorted = autoSaveKeys.sort();
        const toRemove = sorted.slice(0, sorted.length - this.maxAutoSaves);
        toRemove.forEach(key => localStorage.removeItem(key));
      }

    } catch (error) {
      console.error('Failed to cleanup auto-saves:', error);
    }
  }
}