// ExportSystem.js - Adventure export/import functionality
// Handles: editor to adventure conversion, JSON export/import, validation

import { validateAdventure } from '../utils/validation.js';

class ExportSystem {
  constructor(editorEngine) {
    this.editorEngine = editorEngine;
    this.supportedFormats = ['json', 'adventure'];
    this.exportHistory = [];
    this.maxHistorySize = 10;
  }

  // Export adventure in various formats
  async exportAdventure(format = 'json', options = {}) {
    try {
      const adventureData = this.convertEditorToAdventure();
      
      // Validate before export
      const validation = validateAdventure(adventureData);
      if (validation.errors.length > 0 && !options.ignoreErrors) {
        throw new Error(`Cannot export: ${validation.errors.join(', ')}`);
      }

      let exportData;
      let mimeType;
      let filename;

      switch (format) {
        case 'json':
          exportData = this.exportToJSON(adventureData, options);
          mimeType = 'application/json';
          filename = this.generateFilename(adventureData, 'json');
          break;
        case 'adventure':
          exportData = this.exportToAdventureFormat(adventureData, options);
          mimeType = 'application/json';
          filename = this.generateFilename(adventureData, 'adventure');
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Save to history
      this.addToExportHistory({
        format,
        filename,
        timestamp: Date.now(),
        adventureId: adventureData.id,
        adventureTitle: adventureData.title,
        sceneCount: adventureData.scenes.length,
        validation
      });

      return {
        data: exportData,
        mimeType,
        filename,
        validation
      };
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  // Convert editor state to adventure format
  convertEditorToAdventure() {
    const adventure = this.editorEngine.getAdventure();
    const nodes = this.editorEngine.getNodes();

    if (!adventure) {
      throw new Error('No adventure loaded in editor');
    }

    // Convert nodes to scenes (remove editor-specific properties)
    const scenes = Array.from(nodes.values()).map(node => {
      const { position, ...scene } = node;
      return {
        ...scene,
        // Ensure required properties
        id: scene.id,
        title: scene.title || 'Untitled Scene',
        content: scene.content || '',
        choices: scene.choices || [],
        onEnter: scene.onEnter || [],
        onExit: scene.onExit || [],
        tags: scene.tags || []
      };
    });

    return {
      ...adventure,
      scenes,
      // Add export metadata
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0'
    };
  }

  // Export to JSON format
  exportToJSON(adventureData, options = {}) {
    const {
      prettify = true,
      includeMetadata = true,
      minify = false
    } = options;

    let data = { ...adventureData };

    if (!includeMetadata) {
      const { exportedAt, exportVersion, ...cleanData } = data;
      data = cleanData;
    }

    if (minify) {
      return JSON.stringify(data);
    } else if (prettify) {
      return JSON.stringify(data, null, 2);
    } else {
      return JSON.stringify(data);
    }
  }

  // Export to adventure format (player-ready)
  exportToAdventureFormat(adventureData, options = {}) {
    const {
      optimizeForPlayer = true,
      includeEditorHints = false
    } = options;

    let data = { ...adventureData };

    if (optimizeForPlayer) {
      // Remove development/debug information
      data = this.optimizeForPlayer(data);
    }

    if (includeEditorHints) {
      // Add hints for re-importing into editor
      data.editorHints = this.generateEditorHints();
    }

    return JSON.stringify(data, null, 2);
  }

  // Optimize adventure for player consumption
  optimizeForPlayer(adventureData) {
    return {
      ...adventureData,
      scenes: adventureData.scenes.map(scene => ({
        ...scene,
        // Remove empty arrays to reduce file size
        onEnter: scene.onEnter?.length > 0 ? scene.onEnter : undefined,
        onExit: scene.onExit?.length > 0 ? scene.onExit : undefined,
        tags: scene.tags?.length > 0 ? scene.tags : undefined,
        choices: scene.choices.map(choice => ({
          ...choice,
          // Remove empty conditions/actions
          conditions: choice.conditions?.length > 0 ? choice.conditions : undefined,
          actions: choice.actions?.length > 0 ? choice.actions : undefined
        }))
      })),
      // Remove empty stats definitions
      stats: adventureData.stats?.length > 0 ? adventureData.stats : undefined
    };
  }

  // Generate editor hints for re-import
  generateEditorHints() {
    const nodes = this.editorEngine.getNodes();
    const nodePositions = {};
    
    nodes.forEach((node, nodeId) => {
      if (node.position) {
        nodePositions[nodeId] = node.position;
      }
    });

    return {
      nodePositions,
      viewport: this.editorEngine.nodeManager?.getViewport(),
      lastModified: new Date().toISOString()
    };
  }

  // Import adventure into editor
  async importAdventure(data, options = {}) {
    try {
      let adventureData;

      // Parse data if it's a string
      if (typeof data === 'string') {
        adventureData = JSON.parse(data);
      } else {
        adventureData = data;
      }

      // Validate imported data
      const validation = validateAdventure(adventureData);
      if (validation.errors.length > 0 && !options.ignoreErrors) {
        throw new Error(`Invalid adventure data: ${validation.errors.join(', ')}`);
      }

      // Convert adventure to editor format
      const editorData = this.convertAdventureToEditor(adventureData, options);

      // Load into editor
      this.editorEngine.loadAdventure(editorData.adventure);
      
      // Restore editor-specific properties
      if (editorData.editorState) {
        this.applyEditorState(editorData.editorState);
      }

      return {
        success: true,
        adventure: editorData.adventure,
        validation,
        restoredState: !!editorData.editorState
      };
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Convert adventure format back to editor format
  convertAdventureToEditor(adventureData, options = {}) {
    const {
      generatePositions = true,
      preserveEditorHints = true
    } = options;

    // Extract editor hints if available
    let editorHints = null;
    if (preserveEditorHints && adventureData.editorHints) {
      editorHints = adventureData.editorHints;
    }

    // Convert scenes back to nodes
    const scenes = adventureData.scenes.map(scene => {
      let position = { x: 0, y: 0 };

      // Try to restore position from editor hints
      if (editorHints?.nodePositions?.[scene.id]) {
        position = editorHints.nodePositions[scene.id];
      } else if (generatePositions) {
        // Generate reasonable positions
        position = this.generateNodePosition(scene.id, adventureData.scenes);
      }

      return {
        ...scene,
        position,
        // Ensure arrays exist
        choices: scene.choices || [],
        onEnter: scene.onEnter || [],
        onExit: scene.onExit || [],
        tags: scene.tags || []
      };
    });

    const adventure = {
      ...adventureData,
      scenes
    };

    const editorState = editorHints ? {
      viewport: editorHints.viewport,
      nodePositions: editorHints.nodePositions,
      lastModified: editorHints.lastModified
    } : null;

    return {
      adventure,
      editorState
    };
  }

  // Generate reasonable positions for imported nodes
  generateNodePosition(sceneId, allScenes) {
    const index = allScenes.findIndex(s => s.id === sceneId);
    const cols = Math.ceil(Math.sqrt(allScenes.length));
    const nodeWidth = 200;
    const nodeHeight = 120;
    const padding = 50;

    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      x: 100 + col * (nodeWidth + padding),
      y: 100 + row * (nodeHeight + padding)
    };
  }

  // Apply editor state after import
  applyEditorState(editorState) {
    if (editorState.viewport && this.editorEngine.nodeManager) {
      this.editorEngine.nodeManager.setViewport(editorState.viewport);
    }

    // Additional state restoration can be added here
  }

  // File operations
  async downloadFile(exportResult) {
    const { data, mimeType, filename } = exportResult;
    
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          resolve(content);
        } catch (error) {
          reject(new Error(`Failed to read file: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  // Batch operations
  async exportMultipleFormats(formats = ['json']) {
    const results = {};
    const errors = {};

    for (const format of formats) {
      try {
        results[format] = await this.exportAdventure(format);
      } catch (error) {
        errors[format] = error.message;
      }
    }

    return { results, errors };
  }

  // Utility functions
  generateFilename(adventureData, format) {
    const title = adventureData.title || 'untitled_adventure';
    const cleanTitle = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = format === 'json' ? 'json' : 'adventure';
    
    return `${cleanTitle}_${timestamp}.${extension}`;
  }

  addToExportHistory(exportInfo) {
    this.exportHistory.unshift(exportInfo);
    
    // Limit history size
    if (this.exportHistory.length > this.maxHistorySize) {
      this.exportHistory = this.exportHistory.slice(0, this.maxHistorySize);
    }
  }

  getExportHistory() {
    return [...this.exportHistory];
  }

  clearExportHistory() {
    this.exportHistory = [];
  }

  // Quick export methods for common use cases
  async quickExportJSON() {
    return await this.exportAdventure('json', {
      prettify: true,
      includeMetadata: true
    });
  }

  async quickExportForPlayer() {
    return await this.exportAdventure('adventure', {
      optimizeForPlayer: true,
      includeEditorHints: false
    });
  }

  async quickExportForSharing() {
    return await this.exportAdventure('adventure', {
      optimizeForPlayer: false,
      includeEditorHints: true
    });
  }

  // Validation helpers
  validateBeforeExport(options = {}) {
    const adventureData = this.convertEditorToAdventure();
    const validation = validateAdventure(adventureData);
    
    const issues = {
      critical: validation.errors,
      warnings: validation.warnings,
      canExport: validation.errors.length === 0 || options.ignoreErrors
    };

    return issues;
  }

  getExportReadiness() {
    const validation = this.validateBeforeExport();
    const nodes = this.editorEngine.getNodes();
    const adventure = this.editorEngine.getAdventure();

    return {
      ready: validation.canExport,
      sceneCount: nodes.size,
      hasStartScene: !!adventure?.startSceneId,
      hasTitle: !!(adventure?.title?.trim()),
      issues: {
        errors: validation.critical.length,
        warnings: validation.warnings.length
      }
    };
  }

  // Format information
  getSupportedFormats() {
    return [
      {
        key: 'json',
        name: 'JSON Format',
        description: 'Raw adventure data in JSON format',
        extension: '.json',
        mimeType: 'application/json'
      },
      {
        key: 'adventure',
        name: 'Adventure Format',
        description: 'Optimized format for playing adventures',
        extension: '.adventure',
        mimeType: 'application/json'
      }
    ];
  }
}

export default ExportSystem;