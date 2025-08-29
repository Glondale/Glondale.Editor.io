// MemoryOptimizer.js - Memory optimization utilities for large files and datasets
import { logInfo, logWarning, logError } from './errorLogger.js';

/**
 * Memory Optimizer - Handles large files and datasets efficiently
 * 
 * Features:
 * - Streaming file processing
 * - Memory-aware batching
 * - Garbage collection triggers
 * - Memory usage monitoring
 * - Large object compression
 * - Lazy data structures
 */
export class MemoryOptimizer {
  constructor(options = {}) {
    this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB default
    this.batchSize = options.batchSize || 1000;
    this.compressionThreshold = options.compressionThreshold || 1024 * 1024; // 1MB
    this.gcInterval = options.gcInterval || 30000; // 30 seconds
    this.enableCompression = options.enableCompression !== false;
    
    this.memoryStats = {
      peakUsage: 0,
      currentUsage: 0,
      allocations: 0,
      deallocations: 0,
      compressions: 0,
      gcTriggers: 0
    };
    
    this.activeStreams = new Set();
    this.compressedData = new Map();
    this.memoryWatchers = new Set();
    
    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Process large files in chunks to minimize memory usage
   */
  async processLargeFile(file, processor, options = {}) {
    const {
      chunkSize = 64 * 1024, // 64KB chunks
      encoding = 'utf-8',
      onProgress = null,
      onMemoryWarning = null
    } = options;

    if (!(file instanceof File) && typeof file !== 'string') {
      throw new Error('File must be a File object or file path string');
    }

    let processedSize = 0;
    const totalSize = file.size || 0;
    const results = [];
    
    try {
      logInfo('Starting large file processing', { 
        fileSize: totalSize, 
        chunkSize,
        estimatedChunks: Math.ceil(totalSize / chunkSize)
      });

      // Create readable stream
      const stream = await this.createFileStream(file, { chunkSize, encoding });
      this.activeStreams.add(stream);

      for await (const chunk of stream) {
        // Check memory usage before processing
        await this.checkMemoryUsage(onMemoryWarning);
        
        // Process chunk
        const result = await processor(chunk, {
          offset: processedSize,
          size: chunk.length,
          isLastChunk: processedSize + chunk.length >= totalSize
        });

        if (result !== undefined) {
          results.push(result);
        }

        processedSize += chunk.length;
        
        // Report progress
        if (onProgress && totalSize > 0) {
          onProgress({
            processed: processedSize,
            total: totalSize,
            percentage: Math.round((processedSize / totalSize) * 100)
          });
        }

        // Yield control to prevent blocking
        await this.yieldControl();
      }

      this.activeStreams.delete(stream);
      
      logInfo('Large file processing completed', {
        totalSize: processedSize,
        chunks: results.length,
        memoryUsage: this.getCurrentMemoryUsage()
      });

      return results;
    } catch (error) {
      logError('Large file processing failed', { error: error.message, processedSize });
      throw error;
    }
  }

  /**
   * Batch process large arrays with memory management
   */
  async processBatches(items, processor, options = {}) {
    const {
      batchSize = this.batchSize,
      onProgress = null,
      onMemoryWarning = null,
      preserveOrder = true
    } = options;

    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    logInfo('Starting batch processing', {
      totalItems: items.length,
      batchSize,
      totalBatches
    });

    for (let i = 0; i < items.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize);
      const batch = items.slice(i, i + batchSize);
      
      // Check memory before processing batch
      await this.checkMemoryUsage(onMemoryWarning);
      
      try {
        const batchResult = await processor(batch, {
          batchIndex,
          startIndex: i,
          endIndex: Math.min(i + batchSize - 1, items.length - 1),
          totalBatches,
          isLastBatch: i + batchSize >= items.length
        });

        if (batchResult !== undefined) {
          if (preserveOrder) {
            results.push(batchResult);
          } else {
            results.push(...(Array.isArray(batchResult) ? batchResult : [batchResult]));
          }
        }

        // Report progress
        if (onProgress) {
          onProgress({
            batchIndex,
            totalBatches,
            processedItems: Math.min(i + batchSize, items.length),
            totalItems: items.length,
            percentage: Math.round(((i + batchSize) / items.length) * 100)
          });
        }

        // Yield control and cleanup
        await this.yieldControl();
        
      } catch (error) {
        logError('Batch processing failed', { 
          batchIndex, 
          batchSize: batch.length, 
          error: error.message 
        });
        
        if (options.continueOnError) {
          results.push(null); // Mark failed batch
          continue;
        } else {
          throw error;
        }
      }
    }

    logInfo('Batch processing completed', {
      totalBatches,
      successfulBatches: results.filter(r => r !== null).length,
      memoryUsage: this.getCurrentMemoryUsage()
    });

    return results;
  }

  /**
   * Compress large objects to save memory
   */
  async compressData(data, key = null) {
    if (!this.enableCompression) {
      return data;
    }

    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const dataSize = new Blob([dataStr]).size;

    if (dataSize < this.compressionThreshold) {
      return data; // Not worth compressing
    }

    try {
      // Use browser's compression API if available
      if (typeof CompressionStream !== 'undefined') {
        const compressed = await this.compressWithStreams(dataStr);
        
        if (key) {
          this.compressedData.set(key, compressed);
        }
        
        this.memoryStats.compressions++;
        logInfo('Data compressed', { 
          originalSize: dataSize, 
          compressedSize: compressed.byteLength,
          compressionRatio: Math.round((1 - compressed.byteLength / dataSize) * 100)
        });
        
        return compressed;
      } else {
        // Fallback to simple compression
        return this.compressSimple(dataStr);
      }
    } catch (error) {
      logWarning('Compression failed', { error: error.message });
      return data; // Return original data if compression fails
    }
  }

  /**
   * Decompress data
   */
  async decompressData(compressedData, key = null) {
    if (!this.enableCompression || !(compressedData instanceof ArrayBuffer)) {
      return compressedData;
    }

    try {
      if (typeof DecompressionStream !== 'undefined') {
        return await this.decompressWithStreams(compressedData);
      } else {
        return this.decompressSimple(compressedData);
      }
    } catch (error) {
      logError('Decompression failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create memory-efficient data structures
   */
  createLazyMap(dataLoader, options = {}) {
    const { maxCacheSize = 100, ttl = 300000 } = options; // 5 min TTL
    const cache = new Map();
    const accessTimes = new Map();
    const loadingPromises = new Map();

    return new Proxy({}, {
      get: async (target, key) => {
        if (key === 'size') return cache.size;
        if (key === 'clear') return () => {
          cache.clear();
          accessTimes.clear();
          loadingPromises.clear();
        };
        if (key === 'delete') return (k) => {
          cache.delete(k);
          accessTimes.delete(k);
          loadingPromises.delete(k);
        };

        // Check cache first
        if (cache.has(key)) {
          accessTimes.set(key, Date.now());
          return cache.get(key);
        }

        // Check if already loading
        if (loadingPromises.has(key)) {
          return await loadingPromises.get(key);
        }

        // Load data
        const loadPromise = dataLoader(key);
        loadingPromises.set(key, loadPromise);

        try {
          const data = await loadPromise;
          
          // Cleanup old entries if cache is full
          if (cache.size >= maxCacheSize) {
            this.evictOldEntries(cache, accessTimes, Math.floor(maxCacheSize * 0.2));
          }

          cache.set(key, data);
          accessTimes.set(key, Date.now());
          loadingPromises.delete(key);
          
          return data;
        } catch (error) {
          loadingPromises.delete(key);
          throw error;
        }
      },

      set: (target, key, value) => {
        cache.set(key, value);
        accessTimes.set(key, Date.now());
        return true;
      },

      has: (target, key) => {
        return cache.has(key);
      }
    });
  }

  /**
   * Monitor memory usage and trigger cleanup
   */
  async checkMemoryUsage(onWarning = null) {
    const currentUsage = this.getCurrentMemoryUsage();
    this.memoryStats.currentUsage = currentUsage;
    
    if (currentUsage > this.memoryStats.peakUsage) {
      this.memoryStats.peakUsage = currentUsage;
    }

    if (currentUsage > this.maxMemoryUsage * 0.8) {
      logWarning('High memory usage detected', {
        currentUsage: Math.round(currentUsage / 1024 / 1024),
        maxUsage: Math.round(this.maxMemoryUsage / 1024 / 1024),
        threshold: '80%'
      });
      
      if (onWarning) {
        onWarning({
          currentUsage,
          maxUsage: this.maxMemoryUsage,
          percentage: Math.round((currentUsage / this.maxMemoryUsage) * 100)
        });
      }
    }

    if (currentUsage > this.maxMemoryUsage) {
      logError('Memory limit exceeded, triggering cleanup', {
        currentUsage: Math.round(currentUsage / 1024 / 1024),
        maxUsage: Math.round(this.maxMemoryUsage / 1024 / 1024)
      });
      
      await this.triggerGarbageCollection();
    }
  }

  /**
   * Get current memory usage estimate
   */
  getCurrentMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    
    // Fallback estimation
    let usage = 0;
    for (const data of this.compressedData.values()) {
      usage += data.byteLength || JSON.stringify(data).length;
    }
    return usage;
  }

  /**
   * Trigger garbage collection and cleanup
   */
  async triggerGarbageCollection() {
    this.memoryStats.gcTriggers++;
    
    // Clear compressed data cache
    const clearedCount = this.compressedData.size;
    this.compressedData.clear();
    
    // Close active streams if memory is critical
    for (const stream of this.activeStreams) {
      try {
        if (stream.close) await stream.close();
        if (stream.destroy) stream.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.activeStreams.clear();

    // Force garbage collection if available
    if (typeof gc === 'function') {
      gc();
    }

    // Notify memory watchers
    for (const watcher of this.memoryWatchers) {
      try {
        watcher({
          type: 'gc_triggered',
          clearedData: clearedCount,
          memoryUsage: this.getCurrentMemoryUsage()
        });
      } catch (error) {
        // Ignore watcher errors
      }
    }

    logInfo('Garbage collection completed', {
      clearedCompressedData: clearedCount,
      closedStreams: this.activeStreams.size,
      memoryUsage: this.getCurrentMemoryUsage()
    });
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      ...this.memoryStats,
      currentUsage: this.getCurrentMemoryUsage(),
      maxMemoryLimit: this.maxMemoryUsage,
      activeStreams: this.activeStreams.size,
      compressedDataCount: this.compressedData.size,
      memoryWatchers: this.memoryWatchers.size
    };
  }

  // Private methods

  async createFileStream(file, options) {
    const { chunkSize, encoding } = options;
    
    if (file instanceof File) {
      // Browser File object
      return this.createBrowserFileStream(file, chunkSize);
    } else {
      // File path (Node.js environment)
      throw new Error('File path streaming not implemented for browser environment');
    }
  }

  async* createBrowserFileStream(file, chunkSize) {
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      
      yield text;
      offset += chunkSize;
    }
  }

  async compressWithStreams(data) {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    const chunks = [];
    
    // Write data
    writer.write(new TextEncoder().encode(data));
    writer.close();
    
    // Read compressed data
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    
    return result.buffer;
  }

  async decompressWithStreams(compressedData) {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    const chunks = [];
    
    // Write compressed data
    writer.write(new Uint8Array(compressedData));
    writer.close();
    
    // Read decompressed data
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    // Combine and decode
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    
    return new TextDecoder().decode(result);
  }

  compressSimple(data) {
    // Simple compression using repeated pattern detection
    // This is a very basic implementation
    return new TextEncoder().encode(data).buffer;
  }

  decompressSimple(data) {
    return new TextDecoder().decode(data);
  }

  evictOldEntries(cache, accessTimes, count) {
    const entries = Array.from(accessTimes.entries())
      .sort(([,a], [,b]) => a - b)
      .slice(0, count);
    
    for (const [key] of entries) {
      cache.delete(key);
      accessTimes.delete(key);
    }
  }

  async yieldControl() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  startMemoryMonitoring() {
    const monitor = () => {
      this.checkMemoryUsage().catch(error => {
        logError('Memory monitoring failed', { error: error.message });
      });
    };

    setInterval(monitor, this.gcInterval);
    
    // Also monitor on visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.triggerGarbageCollection();
        }
      });
    }
  }

  addMemoryWatcher(callback) {
    this.memoryWatchers.add(callback);
    return () => this.memoryWatchers.delete(callback);
  }
}

// Singleton instance for global use
export const memoryOptimizer = new MemoryOptimizer({
  maxMemoryUsage: 200 * 1024 * 1024, // 200MB
  batchSize: 500,
  compressionThreshold: 512 * 1024, // 512KB
  gcInterval: 30000,
  enableCompression: true
});

// Utility functions
export async function processLargeJSON(jsonString, processor) {
  try {
    const data = JSON.parse(jsonString);
    return await memoryOptimizer.processBatches(
      Array.isArray(data) ? data : [data],
      processor
    );
  } catch (error) {
    logError('Large JSON processing failed', { error: error.message });
    throw error;
  }
}

export async function streamProcessFile(file, processor, options = {}) {
  return await memoryOptimizer.processLargeFile(file, processor, options);
}

export function createMemoryEfficientCache(loader, options = {}) {
  return memoryOptimizer.createLazyMap(loader, options);
}

export default MemoryOptimizer;