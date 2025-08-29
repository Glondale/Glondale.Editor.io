// LargeFileHandler.js - Optimized file handling for large adventure files
import { memoryOptimizer, streamProcessFile } from './MemoryOptimizer.js';
import { logInfo, logWarning, logError } from './errorLogger.js';

/**
 * Large File Handler - Specifically optimized for adventure game files
 * 
 * Features:
 * - Streaming JSON parsing for large adventure files
 * - Progressive loading with validation
 * - Memory-efficient scene processing
 * - Error recovery and partial loading
 * - Progress reporting for large files
 */
export class LargeFileHandler {
  constructor(options = {}) {
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB
    this.chunkSize = options.chunkSize || 64 * 1024; // 64KB
    this.validateOnLoad = options.validateOnLoad !== false;
    this.enableProgressReporting = options.enableProgressReporting !== false;
    
    this.loadingState = new Map();
    this.fileCache = new Map();
    this.compressionEnabled = options.enableCompression !== false;
  }

  /**
   * Load and parse large adventure files with streaming
   */
  async loadAdventureFile(file, options = {}) {
    const {
      onProgress = null,
      onMemoryWarning = null,
      onValidationError = null,
      validateStructure = this.validateOnLoad,
      useStreaming = true,
      maxScenes = 10000
    } = options;

    const fileId = this.generateFileId(file);
    
    if (this.loadingState.has(fileId)) {
      throw new Error('File is already being loaded');
    }

    try {
      this.loadingState.set(fileId, { status: 'loading', progress: 0 });
      
      // Check file size
      const fileSize = file.size || 0;
      if (fileSize > this.maxFileSize) {
        throw new Error(`File too large: ${Math.round(fileSize / 1024 / 1024)}MB (max: ${Math.round(this.maxFileSize / 1024 / 1024)}MB)`);
      }

      logInfo('Loading adventure file', { fileSize, useStreaming, fileName: file.name });

      let adventure;
      
      if (useStreaming && fileSize > 1024 * 1024) { // Stream files > 1MB
        adventure = await this.streamParseAdventure(file, {
          onProgress,
          onMemoryWarning,
          maxScenes
        });
      } else {
        adventure = await this.directParseAdventure(file, onProgress);
      }

      // Validate structure if enabled
      if (validateStructure) {
        const validationResult = this.validateAdventureStructure(adventure);
        if (!validationResult.isValid) {
          if (onValidationError) {
            onValidationError(validationResult.errors);
          }
          if (!options.allowInvalid) {
            throw new Error(`Invalid adventure structure: ${validationResult.errors.join(', ')}`);
          }
        }
      }

      // Optimize memory usage
      if (this.compressionEnabled && fileSize > 512 * 1024) {
        adventure = await this.optimizeAdventureMemory(adventure);
      }

      // Cache the result
      this.fileCache.set(fileId, {
        adventure,
        loadedAt: Date.now(),
        fileSize,
        compressed: this.compressionEnabled
      });

      this.loadingState.delete(fileId);
      
      logInfo('Adventure file loaded successfully', {
        fileName: file.name,
        scenes: adventure.scenes?.length || 0,
        stats: adventure.stats?.length || 0,
        memoryUsage: memoryOptimizer.getCurrentMemoryUsage()
      });

      return adventure;
      
    } catch (error) {
      this.loadingState.delete(fileId);
      logError('Adventure file loading failed', { 
        fileName: file.name, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Save adventure files with compression and chunking
   */
  async saveAdventureFile(adventure, filename, options = {}) {
    const {
      compress = true,
      validate = true,
      chunkScenes = true,
      onProgress = null
    } = options;

    try {
      logInfo('Saving adventure file', { 
        filename, 
        scenes: adventure.scenes?.length || 0,
        compress,
        chunkScenes
      });

      // Validate before saving
      if (validate) {
        const validationResult = this.validateAdventureStructure(adventure);
        if (!validationResult.isValid) {
          throw new Error(`Cannot save invalid adventure: ${validationResult.errors.join(', ')}`);
        }
      }

      let adventureToSave = { ...adventure };

      // Optimize for saving
      if (chunkScenes && adventure.scenes && adventure.scenes.length > 100) {
        adventureToSave = await this.chunkScenesForSave(adventureToSave);
      }

      // Convert to JSON
      const jsonString = JSON.stringify(adventureToSave, null, 2);
      let dataToSave = jsonString;

      // Compress if enabled
      if (compress && jsonString.length > 1024 * 1024) {
        onProgress?.({ stage: 'compressing', progress: 50 });
        dataToSave = await memoryOptimizer.compressData(jsonString);
        filename += '.gz';
      }

      // Create blob and download
      const blob = new Blob([dataToSave], { 
        type: compress ? 'application/gzip' : 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onProgress?.({ stage: 'complete', progress: 100 });

      logInfo('Adventure file saved successfully', {
        filename,
        originalSize: jsonString.length,
        savedSize: dataToSave.length,
        compressionRatio: compress ? Math.round((1 - dataToSave.length / jsonString.length) * 100) : 0
      });

    } catch (error) {
      logError('Adventure file saving failed', { filename, error: error.message });
      throw error;
    }
  }

  /**
   * Load multiple files in batch with memory optimization
   */
  async loadMultipleFiles(files, options = {}) {
    const {
      concurrency = 2, // Process 2 files at a time
      onFileProgress = null,
      onOverallProgress = null,
      continueOnError = true
    } = options;

    const results = [];
    const errors = [];
    let completed = 0;

    // Process in batches to avoid memory overload
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (file, index) => {
        try {
          const result = await this.loadAdventureFile(file, {
            onProgress: onFileProgress ? (progress) => {
              onFileProgress(file, progress);
            } : null
          });
          
          completed++;
          onOverallProgress?.({
            completed,
            total: files.length,
            percentage: Math.round((completed / files.length) * 100)
          });
          
          return { file, result, success: true };
        } catch (error) {
          completed++;
          errors.push({ file, error });
          
          onOverallProgress?.({
            completed,
            total: files.length,
            percentage: Math.round((completed / files.length) * 100),
            errors: errors.length
          });
          
          if (continueOnError) {
            return { file, error, success: false };
          } else {
            throw error;
          }
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Cleanup memory between batches
      if (i + concurrency < files.length) {
        await memoryOptimizer.yieldControl();
        await memoryOptimizer.checkMemoryUsage();
      }
    }

    return {
      results,
      errors,
      successCount: results.filter(r => r.success).length,
      errorCount: errors.length
    };
  }

  // Private methods

  async streamParseAdventure(file, options) {
    const { onProgress, onMemoryWarning, maxScenes } = options;
    let jsonBuffer = '';
    let adventure = null;
    
    await streamProcessFile(file, (chunk, meta) => {
      jsonBuffer += chunk;
      
      if (onProgress) {
        onProgress({
          stage: 'reading',
          progress: Math.round((meta.offset / file.size) * 50) // First 50% for reading
        });
      }
      
      return chunk;
    }, {
      chunkSize: this.chunkSize,
      onMemoryWarning
    });

    // Parse the complete JSON
    try {
      if (onProgress) {
        onProgress({ stage: 'parsing', progress: 75 });
      }
      
      adventure = JSON.parse(jsonBuffer);
      
      // Limit scenes if too many
      if (adventure.scenes && adventure.scenes.length > maxScenes) {
        logWarning('Adventure has too many scenes, truncating', {
          originalCount: adventure.scenes.length,
          maxScenes
        });
        adventure.scenes = adventure.scenes.slice(0, maxScenes);
        adventure.metadata = adventure.metadata || {};
        adventure.metadata.truncated = true;
        adventure.metadata.originalSceneCount = adventure.scenes.length;
      }
      
    } catch (parseError) {
      throw new Error(`JSON parsing failed: ${parseError.message}`);
    } finally {
      jsonBuffer = null; // Clear buffer
    }

    if (onProgress) {
      onProgress({ stage: 'complete', progress: 100 });
    }

    return adventure;
  }

  async directParseAdventure(file, onProgress) {
    const text = await file.text();
    
    if (onProgress) {
      onProgress({ stage: 'parsing', progress: 50 });
    }
    
    const adventure = JSON.parse(text);
    
    if (onProgress) {
      onProgress({ stage: 'complete', progress: 100 });
    }
    
    return adventure;
  }

  validateAdventureStructure(adventure) {
    const errors = [];
    
    if (!adventure || typeof adventure !== 'object') {
      errors.push('Adventure must be an object');
      return { isValid: false, errors };
    }

    // Required fields
    if (!adventure.id) errors.push('Missing adventure ID');
    if (!adventure.title) errors.push('Missing adventure title');
    if (!adventure.scenes || !Array.isArray(adventure.scenes)) {
      errors.push('Missing or invalid scenes array');
    }

    // Validate scenes
    if (adventure.scenes && Array.isArray(adventure.scenes)) {
      adventure.scenes.forEach((scene, index) => {
        if (!scene.id) errors.push(`Scene ${index} missing ID`);
        if (!scene.title) errors.push(`Scene ${index} (${scene.id}) missing title`);
        if (!scene.content) errors.push(`Scene ${index} (${scene.id}) missing content`);
        
        // Validate choices
        if (scene.choices && Array.isArray(scene.choices)) {
          scene.choices.forEach((choice, choiceIndex) => {
            if (!choice.id) errors.push(`Scene ${index} choice ${choiceIndex} missing ID`);
            if (!choice.text) errors.push(`Scene ${index} choice ${choiceIndex} missing text`);
          });
        }
      });
    }

    // Check for circular references in scenes
    if (adventure.scenes && adventure.startSceneId) {
      try {
        this.detectCircularReferences(adventure);
      } catch (error) {
        errors.push(`Circular reference detected: ${error.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  detectCircularReferences(adventure, visited = new Set(), currentPath = []) {
    const scenes = new Map(adventure.scenes.map(s => [s.id, s]));
    
    const visit = (sceneId, path) => {
      if (path.includes(sceneId)) {
        throw new Error(`Circular reference: ${path.join(' -> ')} -> ${sceneId}`);
      }
      
      if (visited.has(sceneId)) return;
      visited.add(sceneId);
      
      const scene = scenes.get(sceneId);
      if (scene && scene.choices) {
        for (const choice of scene.choices) {
          if (choice.targetSceneId) {
            visit(choice.targetSceneId, [...path, sceneId]);
          }
        }
      }
    };
    
    visit(adventure.startSceneId, []);
  }

  async optimizeAdventureMemory(adventure) {
    // Compress large text content
    if (adventure.scenes) {
      for (const scene of adventure.scenes) {
        if (scene.content && scene.content.length > 1000) {
          scene.content = await memoryOptimizer.compressData(scene.content, `scene_${scene.id}_content`);
        }
      }
    }

    return adventure;
  }

  async chunkScenesForSave(adventure) {
    const chunkSize = 50;
    const chunks = [];
    
    for (let i = 0; i < adventure.scenes.length; i += chunkSize) {
      chunks.push({
        index: Math.floor(i / chunkSize),
        scenes: adventure.scenes.slice(i, i + chunkSize)
      });
    }
    
    return {
      ...adventure,
      scenes: adventure.scenes.slice(0, chunkSize), // First chunk
      sceneChunks: chunks.slice(1), // Remaining chunks
      isChunked: true,
      totalScenes: adventure.scenes.length
    };
  }

  generateFileId(file) {
    return `${file.name}_${file.size}_${file.lastModified || Date.now()}`;
  }

  clearCache() {
    this.fileCache.clear();
    this.loadingState.clear();
  }

  getCacheStats() {
    return {
      cachedFiles: this.fileCache.size,
      loadingFiles: this.loadingState.size,
      totalMemoryUsage: Array.from(this.fileCache.values())
        .reduce((sum, cached) => sum + cached.fileSize, 0)
    };
  }
}

// Singleton instance for global use
export const largeFileHandler = new LargeFileHandler({
  maxFileSize: 100 * 1024 * 1024, // 100MB
  chunkSize: 128 * 1024, // 128KB
  validateOnLoad: true,
  enableProgressReporting: true,
  enableCompression: true
});

// Utility functions
export async function loadLargeAdventure(file, options = {}) {
  return await largeFileHandler.loadAdventureFile(file, options);
}

export async function saveLargeAdventure(adventure, filename, options = {}) {
  return await largeFileHandler.saveAdventureFile(adventure, filename, options);
}

export async function batchLoadAdventures(files, options = {}) {
  return await largeFileHandler.loadMultipleFiles(files, options);
}

export default LargeFileHandler;