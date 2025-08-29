// LazyContentLoader.js - Lazy loading system for large adventure content
// Handles: content lazy loading, memory management, content caching, priority loading

export class LazyContentLoader {
  constructor(options = {}) {
    this.cache = new Map();
    this.loadingQueue = new Map();
    this.priorities = new Map();
    
    // Configuration
    this.maxCacheSize = options.maxCacheSize || 100;
    this.preloadDistance = options.preloadDistance || 2; // Load content 2 scenes ahead
    this.unloadDistance = options.unloadDistance || 5; // Unload content 5 scenes away
    this.compressionEnabled = options.enableCompression !== false;
    this.performanceMode = options.performanceMode || 'auto';
    
    // Performance tracking
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      contentLoaded: 0,
      contentUnloaded: 0,
      memoryUsage: 0,
      averageLoadTime: 0,
      totalRequests: 0
    };
    
    // Memory management
    this.memoryThreshold = options.memoryThreshold || 50 * 1024 * 1024; // 50MB
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.lastCleanup = Date.now();
    
    // Start background cleanup
    this.startBackgroundCleanup();
  }
  
  /**
   * Load content with lazy loading and caching
   */
  async loadContent(contentId, contentLoader, priority = 1) {
    const startTime = performance.now();
    this.stats.totalRequests++;
    
    // Check cache first
    if (this.cache.has(contentId)) {
      const cachedItem = this.cache.get(contentId);
      cachedItem.lastAccessed = Date.now();
      cachedItem.accessCount++;
      this.stats.cacheHits++;
      
      // Decompress if needed
      if (cachedItem.compressed) {
        return this.decompressContent(cachedItem.content);
      }
      
      return cachedItem.content;
    }
    
    this.stats.cacheMisses++;
    
    // Check if already loading
    if (this.loadingQueue.has(contentId)) {
      return this.loadingQueue.get(contentId);
    }
    
    // Start loading
    const loadPromise = this.loadContentInternal(contentId, contentLoader, priority, startTime);
    this.loadingQueue.set(contentId, loadPromise);
    
    try {
      const content = await loadPromise;
      this.loadingQueue.delete(contentId);
      return content;
    } catch (error) {
      this.loadingQueue.delete(contentId);
      throw error;
    }
  }
  
  async loadContentInternal(contentId, contentLoader, priority, startTime) {
    try {
      // Load the content
      const rawContent = await contentLoader(contentId);
      
      // Process and cache the content
      const processedContent = await this.processContent(rawContent, contentId);
      const cacheItem = {
        content: processedContent,
        size: this.calculateContentSize(processedContent),
        priority,
        lastAccessed: Date.now(),
        accessCount: 1,
        compressed: false,
        loadTime: performance.now() - startTime
      };
      
      // Compress large content if enabled
      if (this.compressionEnabled && cacheItem.size > 10000) {
        cacheItem.content = await this.compressContent(processedContent);
        cacheItem.compressed = true;
        cacheItem.size = this.calculateContentSize(cacheItem.content);
      }
      
      // Add to cache
      this.cache.set(contentId, cacheItem);
      this.priorities.set(contentId, priority);
      
      // Update stats
      this.stats.contentLoaded++;
      this.stats.memoryUsage += cacheItem.size;
      this.updateAverageLoadTime(cacheItem.loadTime);
      
      // Cleanup if cache is too large
      if (this.cache.size > this.maxCacheSize || this.stats.memoryUsage > this.memoryThreshold) {
        await this.cleanup();
      }
      
      return cacheItem.compressed ? this.decompressContent(cacheItem.content) : cacheItem.content;
      
    } catch (error) {
      console.error('Failed to load content:', contentId, error);
      throw error;
    }
  }
  
  /**
   * Preload content based on current scene and connections
   */
  async preloadAdjacentContent(currentSceneId, sceneGraph, contentLoader) {
    const preloadTargets = this.findPreloadTargets(currentSceneId, sceneGraph);
    const preloadPromises = [];
    
    for (const { sceneId, distance } of preloadTargets) {
      if (!this.cache.has(sceneId) && !this.loadingQueue.has(sceneId)) {
        const priority = Math.max(1, 10 - distance); // Closer = higher priority
        preloadPromises.push(
          this.loadContent(sceneId, contentLoader, priority)
            .catch(error => console.warn('Preload failed for', sceneId, error))
        );
      }
    }
    
    // Load preload targets in parallel but don't wait for all to complete
    if (preloadPromises.length > 0) {
      Promise.allSettled(preloadPromises);
    }
  }
  
  findPreloadTargets(currentSceneId, sceneGraph) {
    const targets = [];
    const visited = new Set();
    const queue = [{ sceneId: currentSceneId, distance: 0 }];
    
    while (queue.length > 0 && targets.length < 10) {
      const { sceneId, distance } = queue.shift();
      
      if (visited.has(sceneId) || distance > this.preloadDistance) {
        continue;
      }
      
      visited.add(sceneId);
      
      if (distance > 0) {
        targets.push({ sceneId, distance });
      }
      
      // Add connected scenes
      const scene = sceneGraph.get(sceneId);
      if (scene && scene.choices) {
        for (const choice of scene.choices) {
          if (choice.targetSceneId && !visited.has(choice.targetSceneId)) {
            queue.push({ sceneId: choice.targetSceneId, distance: distance + 1 });
          }
        }
      }
    }
    
    return targets.sort((a, b) => a.distance - b.distance);
  }
  
  /**
   * Unload distant content to free memory
   */
  unloadDistantContent(currentSceneId, sceneGraph) {
    const distantScenes = this.findDistantScenes(currentSceneId, sceneGraph);
    let unloadedCount = 0;
    
    for (const sceneId of distantScenes) {
      if (this.cache.has(sceneId)) {
        const cacheItem = this.cache.get(sceneId);
        
        // Don't unload high-priority or recently accessed content
        if (cacheItem.priority < 5 && Date.now() - cacheItem.lastAccessed > 300000) {
          this.cache.delete(sceneId);
          this.priorities.delete(sceneId);
          this.stats.memoryUsage -= cacheItem.size;
          this.stats.contentUnloaded++;
          unloadedCount++;
        }
      }
    }
    
    return unloadedCount;
  }
  
  findDistantScenes(currentSceneId, sceneGraph) {
    const distant = [];
    const reachable = new Set();
    const queue = [{ sceneId: currentSceneId, distance: 0 }];
    
    // Find all scenes within unload distance
    while (queue.length > 0) {
      const { sceneId, distance } = queue.shift();
      
      if (reachable.has(sceneId) || distance > this.unloadDistance) {
        continue;
      }
      
      reachable.add(sceneId);
      
      const scene = sceneGraph.get(sceneId);
      if (scene && scene.choices) {
        for (const choice of scene.choices) {
          if (choice.targetSceneId && !reachable.has(choice.targetSceneId)) {
            queue.push({ sceneId: choice.targetSceneId, distance: distance + 1 });
          }
        }
      }
    }
    
    // Find cached scenes not in reachable set
    for (const sceneId of this.cache.keys()) {
      if (!reachable.has(sceneId)) {
        distant.push(sceneId);
      }
    }
    
    return distant;
  }
  
  /**
   * Process content before caching
   */
  async processContent(content, contentId) {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object') {
      // Deep clone to avoid reference issues
      return JSON.parse(JSON.stringify(content));
    }
    
    return content;
  }
  
  /**
   * Compress content for storage
   */
  async compressContent(content) {
    try {
      const jsonString = typeof content === 'string' ? content : JSON.stringify(content);
      
      // Simple compression using built-in compression if available
      if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(new TextEncoder().encode(jsonString));
        writer.close();
        
        const chunks = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
      }
      
      // Fallback: simple string compression
      return this.simpleCompress(jsonString);
      
    } catch (error) {
      console.warn('Content compression failed, storing uncompressed:', error);
      return content;
    }
  }
  
  /**
   * Decompress content
   */
  async decompressContent(compressedContent) {
    try {
      if (compressedContent instanceof Uint8Array && typeof DecompressionStream !== 'undefined') {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(compressedContent);
        writer.close();
        
        const chunks = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const decompressed = new TextDecoder().decode(
          new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []))
        );
        
        try {
          return JSON.parse(decompressed);
        } catch {
          return decompressed;
        }
      }
      
      // Fallback: simple decompression
      return this.simpleDecompress(compressedContent);
      
    } catch (error) {
      console.error('Content decompression failed:', error);
      return compressedContent;
    }
  }
  
  simpleCompress(str) {
    // Simple RLE-style compression for demonstration
    return str.replace(/(.)\1{2,}/g, (match, char) => `${char}*${match.length}`);
  }
  
  simpleDecompress(str) {
    return str.replace(/(.)\\*(\d+)/g, (match, char, count) => char.repeat(parseInt(count)));
  }
  
  calculateContentSize(content) {
    if (content instanceof Uint8Array) {
      return content.byteLength;
    }
    
    if (typeof content === 'string') {
      return new TextEncoder().encode(content).length;
    }
    
    return JSON.stringify(content).length * 2; // Rough estimate
  }
  
  updateAverageLoadTime(loadTime) {
    const totalTime = this.stats.averageLoadTime * (this.stats.contentLoaded - 1) + loadTime;
    this.stats.averageLoadTime = totalTime / this.stats.contentLoaded;
  }
  
  /**
   * Cleanup old and low-priority content
   */
  async cleanup(force = false) {
    const now = Date.now();
    
    if (!force && now - this.lastCleanup < this.cleanupInterval) {
      return 0;
    }
    
    this.lastCleanup = now;
    const itemsToRemove = [];
    
    // Sort cache items by priority and access time
    const cacheItems = Array.from(this.cache.entries()).map(([id, item]) => ({
      id,
      ...item,
      score: this.calculateCleanupScore(item, now)
    }));
    
    cacheItems.sort((a, b) => a.score - b.score);
    
    // Remove items until under threshold
    let removedCount = 0;
    while ((this.cache.size > this.maxCacheSize || this.stats.memoryUsage > this.memoryThreshold) && 
           cacheItems.length > removedCount) {
      
      const item = cacheItems[removedCount];
      this.cache.delete(item.id);
      this.priorities.delete(item.id);
      this.stats.memoryUsage -= item.size;
      this.stats.contentUnloaded++;
      removedCount++;
    }
    
    return removedCount;
  }
  
  calculateCleanupScore(item, now) {
    const timeSinceAccess = now - item.lastAccessed;
    const priorityWeight = item.priority || 1;
    const accessWeight = Math.log(item.accessCount + 1);
    const timeWeight = timeSinceAccess / (1000 * 60 * 60); // Hours
    
    // Lower score = more likely to be removed
    return priorityWeight * accessWeight - timeWeight;
  }
  
  startBackgroundCleanup() {
    if (typeof window === 'undefined') return;
    
    const cleanupTask = () => {
      this.cleanup().then(() => {
        setTimeout(cleanupTask, this.cleanupInterval);
      });
    };
    
    setTimeout(cleanupTask, this.cleanupInterval);
  }
  
  /**
   * Get performance statistics
   */
  getStats() {
    const hitRate = this.stats.totalRequests > 0 ? 
      (this.stats.cacheHits / this.stats.totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate),
      cacheSize: this.cache.size,
      averageLoadTime: Math.round(this.stats.averageLoadTime * 100) / 100,
      memoryUsageMB: Math.round(this.stats.memoryUsage / (1024 * 1024) * 100) / 100,
      compressionEnabled: this.compressionEnabled
    };
  }
  
  /**
   * Prefetch content based on user behavior patterns
   */
  async prefetchByPattern(userBehavior, sceneGraph, contentLoader) {
    // Analyze user behavior to predict next scenes
    const predictions = this.predictNextScenes(userBehavior, sceneGraph);
    
    for (const { sceneId, probability } of predictions) {
      if (probability > 0.3 && !this.cache.has(sceneId)) {
        // Prefetch with priority based on probability
        const priority = Math.ceil(probability * 10);
        this.loadContent(sceneId, contentLoader, priority)
          .catch(error => console.warn('Prefetch failed for', sceneId, error));
      }
    }
  }
  
  predictNextScenes(userBehavior, sceneGraph) {
    // Simple prediction based on choice patterns
    const predictions = new Map();
    const recentChoices = userBehavior.slice(-10); // Last 10 choices
    
    for (const choice of recentChoices) {
      const scene = sceneGraph.get(choice.sceneId);
      if (scene && scene.choices) {
        for (const sceneChoice of scene.choices) {
          if (sceneChoice.targetSceneId) {
            const current = predictions.get(sceneChoice.targetSceneId) || 0;
            predictions.set(sceneChoice.targetSceneId, current + 0.1);
          }
        }
      }
    }
    
    return Array.from(predictions.entries())
      .map(([sceneId, probability]) => ({ sceneId, probability }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5); // Top 5 predictions
  }
  
  /**
   * Clear all cached content
   */
  clearCache() {
    this.cache.clear();
    this.priorities.clear();
    this.loadingQueue.clear();
    this.stats.memoryUsage = 0;
  }
  
  /**
   * Destroy the loader and cleanup resources
   */
  destroy() {
    this.clearCache();
  }
}

// Singleton instance for global use
export const lazyContentLoader = new LazyContentLoader({
  maxCacheSize: 200,
  preloadDistance: 3,
  unloadDistance: 8,
  enableCompression: true,
  performanceMode: 'auto'
});

export default LazyContentLoader;