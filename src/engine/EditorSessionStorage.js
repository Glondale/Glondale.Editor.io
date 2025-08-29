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

class EditorSessionStorage {
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
    
    // Visual autosave feedback system
    this.saveStatus = 'idle'; // 'idle', 'saving', 'saved', 'error', 'offline', 'conflict'
    this.saveCallbacks = new Set();
    this.saveProgress = 0;
    this.isOnline = navigator.onLine;
    this.lastSaveAttempt = null;
    this.saveRetryCount = 0;
    this.maxRetries = 3;
    
    // Save conflict detection
    this.lastKnownVersion = null;
    this.conflictData = null;
    
    // Initialize online/offline detection
    this.initializeConnectivityMonitoring();
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
  async saveSession(sessionId, sessionData, isAutoSave = false) {
    const saveId = `save_${Date.now()}_${Math.random()}`;
    this.saveQueue.set(saveId, { sessionId, isAutoSave, progress: 0 });
    
    try {
      // Update save status
      this.updateSaveStatus('saving', 0);
      this.lastSaveAttempt = Date.now();
      
      // Check if offline
      if (!this.isOnline) {
        this.updateSaveStatus('offline');
        this.saveQueue.delete(saveId);
        return {
          success: false,
          error: 'Cannot save while offline',
          savedAt: null
        };
      }
      
      // Simulate save progress
      this.updateSaveStatus('saving', 25);
      
      // Check for conflicts
      const conflictCheck = await this.checkForConflicts(sessionId, sessionData);
      if (conflictCheck.hasConflict) {
        this.updateSaveStatus('conflict');
        this.conflictData = conflictCheck.conflictData;
        this.saveQueue.delete(saveId);
        return {
          success: false,
          error: 'Save conflict detected',
          savedAt: null,
          conflict: conflictCheck.conflictData
        };
      }
      
      this.updateSaveStatus('saving', 50);

      // Validate session data
      const validation = this.validateSession(sessionData);
      if (!validation.isValid) {
        this.updateSaveStatus('error');
        this.saveQueue.delete(saveId);
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          savedAt: null
        };
      }

      this.updateSaveStatus('saving', 75);

      // Update metadata with version info for conflict detection
      const versionId = `${Date.now()}_${Math.random()}`;
      const updatedSession = {
        ...sessionData,
        metadata: {
          ...sessionData.metadata,
          lastModified: Date.now(),
          lastSaved: Date.now(),
          saveType: isAutoSave ? 'auto' : 'manual',
          versionId: versionId
        }
      };

      // Prepare storage data
      const storageData = {
        version: this.currentVersion,
        session: updatedSession,
        compressed: this.compressionEnabled,
        savedAt: Date.now(),
        versionId: versionId
      };

      // Compress if enabled
      let dataToStore = JSON.stringify(storageData);
      if (this.compressionEnabled) {
        dataToStore = this.compressData(dataToStore);
      }

      this.updateSaveStatus('saving', 90);

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
      this.lastKnownVersion = versionId;
      this.isDirty = false;
      this.saveRetryCount = 0;
      
      // Complete save
      this.updateSaveStatus('saved', 100);
      this.saveQueue.delete(saveId);
      
      // Reset to idle after showing success
      setTimeout(() => {
        if (this.saveStatus === 'saved') {
          this.updateSaveStatus('idle');
        }
      }, 2000);

      return {
        success: true,
        error: null,
        savedAt: updatedSession.metadata.lastSaved
      };

    } catch (error) {
      console.error('Failed to save session:', error);
      this.saveRetryCount++;
      this.updateSaveStatus('error');
      this.saveQueue.delete(saveId);
      
      // Auto-retry for transient errors
      if (this.saveRetryCount < this.maxRetries && isAutoSave) {
        setTimeout(() => {
          this.saveSession(sessionId, sessionData, isAutoSave);
        }, 5000 * this.saveRetryCount);
      }
      
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

  /**
   * Get the last session that was worked on
   * @returns {Object|null} Last session data or null if none found
   */
  getLastSession() {
    try {
      const sessions = this.listSessions();
      if (sessions.length === 0) return null;
      
      // Sort by lastModified in descending order and return the first one
      const sortedSessions = sessions.sort((a, b) => 
        new Date(b.lastModified) - new Date(a.lastModified)
      );
      
      return sortedSessions[0];
    } catch (error) {
      console.error('Failed to get last session:', error);
      return null;
    }
  }

  /**
   * List all projects (alias for listSessions for compatibility)
   * @returns {Array} Array of project/session metadata
   */
  async listProjects() {
    try {
      const raw = localStorage.getItem('editor_projects');
      const projects = raw ? JSON.parse(raw) : [];

      // Normalize legacy fields so UI always has .name and .modified
      return projects.map(p => ({
        id: p.id,
        name: p.name || p.title || (p.data && p.data.title) || 'Untitled Project',
        data: p.data || p.data || null,
        created: p.created || p.createdAt || p.createdAt || null,
        modified: p.modified || p.modifiedAt || p.updatedAt || p.updatedAt || p.modified || null
      })).sort((a, b) => (b.modified || 0) - (a.modified || 0));
    } catch (err) {
      console.error('EditorSessionStorage.listProjects failed', err);
      return [];
    }
  }

  /**
   * Create a new project (async so callers can await)
   * @param {Object} project - Project configuration
   * @returns {Object} Created project record
   */
  async createNewProject(project = {}) {
    const id = project.id || `proj_${Date.now()}`;
    const now = Date.now();
    const record = {
      id,
      name: project.name || project.title || 'Untitled Project',
      data: project.data || project.adventureData || {},
      created: now,
      modified: now
    };

    try {
      const raw = localStorage.getItem('editor_projects');
      const projects = raw ? JSON.parse(raw) : [];
      projects.push(record);
      localStorage.setItem('editor_projects', JSON.stringify(projects));
      
      // Mark as current project for immediate selection
      localStorage.setItem('editor_current_project', id);
      return record;
    } catch (err) {
      console.error('EditorSessionStorage.createNewProject failed', err);
      throw err;
    }
  }

  /**
   * Backwards-compatibility alias for createNewProject
   * @param {Object} project - Project configuration
   * @returns {Object} Created project record
   */
  async createProject(project = {}) {
    return this.createNewProject(project);
  }

  /**
   * Get project by id
   * @param {string} id - Project ID
   * @returns {Object|null} Project record or null
   */
  async getProject(id) {
  const all = await this.listProjects();
  return all.find(p => p.id === id) || null;
  }

  /**
   * Load and mark project as current
   * @param {string} id - Project ID
   * @returns {Object|null} Project record or null
   */
  async loadProject(id) {
    const proj = await this.getProject(id);
    if (proj) {
      // Keep track of which project is active
      localStorage.setItem('editor_current_project', id);
      return {
        project: proj,
        adventureData: proj.data && proj.data.adventureData ? proj.data.adventureData : proj.data || null
      };
    }
    return null;
  }

  /**
   * Get current project id and project
   * @returns {Object|null} Current project record or null
   */
  async getCurrentProject() {
    const id = localStorage.getItem('editor_current_project');
    if (!id) return null;
  return this.getProject(id);
  }

  /**
   * Create a new project (async so callers can await)
   * @param {Object} project - Project configuration
   * @returns {Object} Created project record
   */
  // -- project save/update API -------------------------------------------------
  /**
   * Save/update an existing project
   * @param {string} projectId
   * @param {Object} update
   * @returns {Object} updated project record
   */
  async saveProject(projectId, update = {}) {
    try {
      const raw = localStorage.getItem('editor_projects');
      const projects = raw ? JSON.parse(raw) : [];
      const idx = projects.findIndex(p => p.id === projectId);
      if (idx === -1) throw new Error('Project not found');

      const existing = projects[idx];
      const now = Date.now();

      const updated = {
        ...existing,
        name: update.name || update.title || existing.name,
        data: { ...(existing.data || {}), ...(update.data || update.adventureData ? { adventureData: update.adventureData || update.data } : {}) },
        modified: now
      };

      projects[idx] = updated;
      localStorage.setItem('editor_projects', JSON.stringify(projects));

      // Make sure the saved project becomes the current project
      localStorage.setItem('editor_current_project', projectId);

      return updated;
    } catch (err) {
      console.error('EditorSessionStorage.saveProject failed', err);
      throw err;
    }
  }

  /**
   * Backwards-compatibility alias for createNewProject
   * @param {Object} project - Project configuration
   * @returns {Object} Created project record
   */
  async createProject(project = {}) {
    return this.createNewProject(project);
  }

  /**
   * Delete a project
   * @param {string} projectId - Project ID to delete
   * @returns {boolean} Success status
   */
  async deleteProject(projectId) {
    try {
      const raw = localStorage.getItem('editor_projects');
      const projects = raw ? JSON.parse(raw) : [];
      
      const filteredProjects = projects.filter(p => p.id !== projectId);
      localStorage.setItem('editor_projects', JSON.stringify(filteredProjects));
      
      // Clear current project if it's the one being deleted
      const currentId = localStorage.getItem('editor_current_project');
      if (currentId === projectId) {
        localStorage.removeItem('editor_current_project');
      }
      
      return true;
    } catch (err) {
      console.error('EditorSessionStorage.deleteProject failed', err);
      throw err;
    }
  }

  /**
   * Visual autosave feedback system methods
   */

  /**
   * Initialize connectivity monitoring
   * @private
   */
  initializeConnectivityMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateSaveStatus('idle');
      // Try to save any pending changes
      if (this.isDirty && this.currentSessionId) {
        this.performAutoSave(this.currentSessionId);
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateSaveStatus('offline');
    });
  }

  /**
   * Update save status and notify callbacks
   * @param {string} status - New save status
   * @param {number} progress - Save progress (0-100)
   */
  updateSaveStatus(status, progress = 0) {
    this.saveStatus = status;
    this.saveProgress = progress;
    
    // Notify all registered callbacks
    this.saveCallbacks.forEach(callback => {
      try {
        callback({
          status: this.saveStatus,
          progress: this.saveProgress,
          isOnline: this.isOnline,
          lastSaved: this.lastSaveTime,
          lastSaveAttempt: this.lastSaveAttempt,
          retryCount: this.saveRetryCount,
          queueSize: this.saveQueue.size,
          conflictData: this.conflictData
        });
      } catch (error) {
        console.error('Save status callback error:', error);
      }
    });
  }

  /**
   * Register callback for save status updates
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onSaveStatusChange(callback) {
    this.saveCallbacks.add(callback);
    
    // Immediately call with current status
    callback({
      status: this.saveStatus,
      progress: this.saveProgress,
      isOnline: this.isOnline,
      lastSaved: this.lastSaveTime,
      lastSaveAttempt: this.lastSaveAttempt,
      retryCount: this.saveRetryCount,
      queueSize: this.saveQueue.size,
      conflictData: this.conflictData
    });
    
    // Return unsubscribe function
    return () => {
      this.saveCallbacks.delete(callback);
    };
  }

  /**
   * Check for save conflicts
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data to save
   * @returns {Object} Conflict check result
   * @private
   */
  async checkForConflicts(sessionId, sessionData) {
    try {
      // For localStorage, we check if the stored version differs from our last known version
      const storageKey = this.getSessionKey(sessionId);
      const storedData = localStorage.getItem(storageKey);
      
      if (!storedData || !this.lastKnownVersion) {
        return { hasConflict: false };
      }

      const parsedData = JSON.parse(storedData);
      const storedVersionId = parsedData.versionId || parsedData.session?.metadata?.versionId;
      
      if (storedVersionId && storedVersionId !== this.lastKnownVersion) {
        // Conflict detected - another instance has saved since our last save
        const storedSession = parsedData.session || parsedData;
        return {
          hasConflict: true,
          conflictData: {
            ourVersion: this.lastKnownVersion,
            serverVersion: storedVersionId,
            ourData: sessionData,
            serverData: storedSession,
            conflictTime: Date.now()
          }
        };
      }
      
      return { hasConflict: false };
    } catch (error) {
      console.error('Conflict check failed:', error);
      return { hasConflict: false };
    }
  }

  /**
   * Get current save queue status
   * @returns {Object} Save queue information
   */
  getSaveQueueStatus() {
    const queue = Array.from(this.saveQueue.entries()).map(([id, data]) => ({
      id,
      sessionId: data.sessionId,
      isAutoSave: data.isAutoSave,
      progress: data.progress
    }));

    return {
      size: this.saveQueue.size,
      queue: queue,
      status: this.saveStatus,
      progress: this.saveProgress,
      isOnline: this.isOnline
    };
  }

  /**
   * Force manual save with visual feedback
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data
   * @returns {Promise<Object>} Save result
   */
  async forceSave(sessionId, sessionData) {
    return this.saveSession(sessionId, sessionData, false);
  }

  /**
   * Resolve save conflict
   * @param {string} resolution - 'ours', 'theirs', or 'merge'
   * @param {Object} mergedData - Merged data (if resolution is 'merge')
   * @returns {Promise<Object>} Resolution result
   */
  async resolveSaveConflict(resolution, mergedData = null) {
    if (!this.conflictData) {
      return { success: false, error: 'No conflict to resolve' };
    }

    let dataToSave;
    switch (resolution) {
      case 'ours':
        dataToSave = this.conflictData.ourData;
        break;
      case 'theirs':
        dataToSave = this.conflictData.serverData;
        break;
      case 'merge':
        dataToSave = mergedData || this.conflictData.ourData;
        break;
      default:
        return { success: false, error: 'Invalid resolution type' };
    }

    // Clear conflict state
    this.conflictData = null;
    this.updateSaveStatus('idle');

    // Force save with conflict resolution
    this.lastKnownVersion = null; // Reset to bypass conflict check
    const result = await this.forceSave(this.currentSessionId, dataToSave);
    
    return result;
  }
}

export default EditorSessionStorage;