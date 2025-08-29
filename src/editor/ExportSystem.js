// ExportSystem.js - Adventure export/import functionality
// Handles: editor to adventure conversion, JSON export/import, validation

import { validateAdventure } from '../utils/validation.js';
import { logError, logWarning, logInfo } from '../utils/errorLogger.js';

class ExportSystem {
  constructor(editorEngine) {
    this.editorEngine = editorEngine;
    this.supportedFormats = ['json', 'adventure'];
    this.exportHistory = [];
    this.maxHistorySize = 10;
  }

  // Export adventure in various formats with comprehensive error handling
  async exportAdventure(format = 'json', options = {}) {
    const startTime = Date.now();
    const context = { format, options: Object.keys(options) };
    
    try {
      logInfo('Starting export operation', context);
      
      // Step 1: Validate input parameters
      await this.validateExportParameters(format, options);
      
      // Step 2: Convert editor data with error recovery
      const adventureData = await this.convertEditorToAdventureSafely();
      
      // Step 3: Comprehensive pre-export validation
      const validation = await this.validateExportData(adventureData, options);
      
      // Step 4: Generate export data with format-specific error handling
      const exportResult = await this.generateExportData(format, adventureData, options);
      
      // Step 5: Validate export integrity
      await this.validateExportIntegrity(exportResult, adventureData);
      
      // Step 6: Update export history (non-blocking)
      this.addToExportHistorySafely({
        format,
        filename: exportResult.filename,
        timestamp: Date.now(),
        adventureId: adventureData.id,
        adventureTitle: adventureData.title,
        sceneCount: adventureData.scenes?.length || 0,
        validation,
        dataSize: exportResult.data?.length || 0
      });

      const elapsed = Date.now() - startTime;
      logInfo('Export operation completed successfully', { 
        ...context, 
        filename: exportResult.filename,
        dataSize: exportResult.data?.length || 0,
        elapsed 
      });

      return {
        data: exportResult.data,
        mimeType: exportResult.mimeType,
        filename: exportResult.filename,
        validation
      };
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorId = logError({
        type: 'export_failure',
        message: `Export operation failed: ${error.message}`,
        error: error,
        stack: error.stack
      }, { ...context, elapsed });
      
      throw new Error(`Export failed [${errorId}]: ${error.message}`);
    }
  }

  // Validate export parameters
  async validateExportParameters(format, options) {
    if (!format || typeof format !== 'string') {
      throw new Error('Export format is required and must be a string');
    }
    
    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }
    
    if (options && typeof options !== 'object') {
      throw new Error('Export options must be an object');
    }
  }

  // Convert editor to adventure with error recovery
  async convertEditorToAdventureSafely() {
    try {
      // Check if editor engine is available
      if (!this.editorEngine) {
        throw new Error('Editor engine is not initialized');
      }
      
      const adventureData = this.convertEditorToAdventure();
      
      // Basic sanity checks
      if (!adventureData) {
        throw new Error('Failed to convert editor data - result is null');
      }
      
      if (!adventureData.scenes || !Array.isArray(adventureData.scenes)) {
        throw new Error('Converted data is missing scenes array');
      }
      
      if (adventureData.scenes.length === 0) {
        logWarning('Adventure has no scenes', { adventureId: adventureData.id });
      }
      
      return adventureData;
      
    } catch (error) {
      logError({
        type: 'editor_conversion_failure',
        message: `Failed to convert editor data: ${error.message}`,
        error: error
      });
      
      // Try to create minimal fallback data
      try {
        return this.createFallbackAdventureData();
      } catch (fallbackError) {
        throw new Error(`Editor conversion failed and fallback creation failed: ${error.message}`);
      }
    }
  }

  // Create minimal fallback adventure data
  createFallbackAdventureData() {
    logWarning('Creating fallback adventure data due to conversion failure');
    
    return {
      id: `fallback_${Date.now()}`,
      title: 'Recovered Adventure',
      author: 'Unknown',
      version: '1.0.0',
      description: 'This adventure was recovered from a failed export operation.',
      scenes: [],
      stats: [],
      startSceneId: null,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      recoveryData: {
        originalError: 'Editor conversion failed',
        recoveredAt: new Date().toISOString(),
        dataSource: 'fallback'
      }
    };
  }

  // Comprehensive validation of export data
  async validateExportData(adventureData, options) {
    try {
      const validation = validateAdventure(adventureData);
      
      // Add additional export-specific validations
      const exportValidation = {
        errors: [...validation.errors],
        warnings: [...validation.warnings]
      };
      
      // Check for export-critical issues
      if (!adventureData.id) {
        exportValidation.errors.push('Adventure ID is required for export');
      }
      
      if (!adventureData.title || adventureData.title.trim() === '') {
        exportValidation.warnings.push('Adventure has no title');
      }
      
      if (!adventureData.scenes || adventureData.scenes.length === 0) {
        exportValidation.warnings.push('Adventure has no scenes');
      }
      
      // Check for potential data loss issues
      if (adventureData.scenes) {
        const scenesWithoutContent = adventureData.scenes.filter(scene => 
          !scene.content || scene.content.trim() === ''
        );
        
        if (scenesWithoutContent.length > 0) {
          exportValidation.warnings.push(`${scenesWithoutContent.length} scenes have no content`);
        }
      }
      
      // Fail export on critical errors unless explicitly ignored
      if (exportValidation.errors.length > 0 && !options.ignoreErrors) {
        throw new Error(`Export validation failed: ${exportValidation.errors.join(', ')}`);
      }
      
      // Log warnings
      if (exportValidation.warnings.length > 0) {
        logWarning('Export validation warnings', { 
          warnings: exportValidation.warnings,
          adventureId: adventureData.id 
        });
      }
      
      return exportValidation;
      
    } catch (error) {
      if (error.message.includes('Export validation failed')) {
        throw error;
      }
      
      logError({
        type: 'export_validation_error',
        message: `Export validation error: ${error.message}`,
        error: error
      }, { adventureId: adventureData?.id });
      
      throw new Error(`Export validation failed: ${error.message}`);
    }
  }

  // Generate export data with format-specific error handling
  async generateExportData(format, adventureData, options) {
    try {
      let exportData;
      let mimeType;
      let filename;

      switch (format.toLowerCase()) {
        case 'json':
          exportData = await this.exportToJSONSafely(adventureData, options);
          mimeType = 'application/json';
          filename = this.generateFilenameSafely(adventureData, 'json');
          break;
          
        case 'adventure':
          exportData = await this.exportToAdventureFormatSafely(adventureData, options);
          mimeType = 'application/json';
          filename = this.generateFilenameSafely(adventureData, 'adventure');
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return { data: exportData, mimeType, filename };
      
    } catch (error) {
      logError({
        type: 'export_generation_failure',
        message: `Failed to generate ${format} export: ${error.message}`,
        error: error
      }, { format, adventureId: adventureData?.id });
      
      throw error;
    }
  }

  // Safe JSON export with error handling
  async exportToJSONSafely(adventureData, options = {}) {
    try {
      return this.exportToJSON(adventureData, options);
    } catch (error) {
      logError({
        type: 'json_export_failure',
        message: `JSON export failed: ${error.message}`,
        error: error
      });
      
      // Try with minimal options as fallback
      if (Object.keys(options).length > 0) {
        logWarning('Retrying JSON export with minimal options');
        try {
          return this.exportToJSON(adventureData, { prettify: false });
        } catch (fallbackError) {
          throw new Error(`JSON export failed even with fallback options: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  // Safe adventure format export with error handling
  async exportToAdventureFormatSafely(adventureData, options = {}) {
    try {
      return this.exportToAdventureFormat(adventureData, options);
    } catch (error) {
      logError({
        type: 'adventure_format_export_failure',
        message: `Adventure format export failed: ${error.message}`,
        error: error
      });
      
      // Try with minimal options as fallback
      if (Object.keys(options).length > 0) {
        logWarning('Retrying adventure format export with minimal options');
        try {
          return this.exportToAdventureFormat(adventureData, { 
            optimizeForPlayer: true, 
            includeEditorHints: false 
          });
        } catch (fallbackError) {
          throw new Error(`Adventure format export failed even with fallback options: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  // Safe filename generation with fallback
  generateFilenameSafely(adventureData, format) {
    try {
      return this.generateFilename(adventureData, format);
    } catch (error) {
      logWarning('Filename generation failed, using fallback', { 
        error: error.message, 
        adventureId: adventureData?.id 
      });
      
      // Fallback filename generation
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = format === 'json' ? 'json' : 'adventure';
      return `adventure_export_${timestamp}.${extension}`;
    }
  }

  // Validate export integrity
  async validateExportIntegrity(exportResult, originalData) {
    try {
      // Check if export data exists
      if (!exportResult.data) {
        throw new Error('Export data is empty');
      }
      
      // Check data size
      const dataSize = typeof exportResult.data === 'string' ? 
        exportResult.data.length : 
        JSON.stringify(exportResult.data).length;
        
      if (dataSize < 10) {
        throw new Error('Export data is suspiciously small');
      }
      
      if (dataSize > 50000000) { // 50MB limit
        logWarning('Export data is very large', { dataSize });
      }
      
      // Try to parse JSON exports to verify validity
      if (exportResult.mimeType === 'application/json') {
        try {
          const parsed = JSON.parse(exportResult.data);
          
          // Basic structure check
          if (!parsed.id || !parsed.title) {
            logWarning('Export data missing basic adventure structure');
          }
          
        } catch (parseError) {
          throw new Error(`Exported JSON is invalid: ${parseError.message}`);
        }
      }
      
      logInfo('Export integrity validation passed', { 
        dataSize, 
        filename: exportResult.filename 
      });
      
    } catch (error) {
      logError({
        type: 'export_integrity_failure',
        message: `Export integrity validation failed: ${error.message}`,
        error: error
      });
      
      throw error;
    }
  }

  // Safe export history update
  addToExportHistorySafely(exportInfo) {
    try {
      this.addToExportHistory(exportInfo);
    } catch (error) {
      logWarning('Failed to update export history', { 
        error: error.message, 
        exportInfo: { filename: exportInfo.filename, format: exportInfo.format } 
      });
      // Don't fail the export operation if history update fails
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