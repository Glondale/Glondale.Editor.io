// NodeManager.js - Advanced node management with viewport culling and memory optimization
// Handles: node layout, drag/drop, auto-positioning, viewport management, performance optimization

class NodeManager {
  constructor(options = {}) {
    this.nodes = new Map();
    this.viewport = { x: 0, y: 0, zoom: 1 };
    this.nodeSize = { width: 200, height: 120 };
    this.gridSize = 20;
    this.snapToGrid = false;
    this.listeners = new Map();
    
    // Performance optimization settings
    this.cullingEnabled = options.enableCulling !== false;
    this.bufferZone = options.bufferZone || 200; // Extra rendering area around viewport
    this.memoryOptimizationEnabled = options.enableMemoryOptimization !== false;
    this.maxVisibleNodes = options.maxVisibleNodes || 1000;
    this.lazyLoadThreshold = options.lazyLoadThreshold || 500;
    
    // Caching and optimization
    this.visibilityCache = new Map();
    this.lastViewportHash = null;
    this.nodeRenderCache = new Map();
    this.offScreenNodes = new Set();
    this.performanceStats = {
      totalNodes: 0,
      visibleNodes: 0,
      culledNodes: 0,
      memoryUsage: 0,
      renderTime: 0
    };
    
    // Debouncing for performance
    this.updateDebounceTimeout = null;
    this.lastUpdateTime = 0;
  }

  // Event system
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  removeEventListener(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Enhanced node management with performance tracking
  addNode(nodeId, node) {
    const nodeData = {
      ...node,
      position: this.snapPosition(node.position || { x: 0, y: 0 }),
      lastAccessed: Date.now(),
      renderPriority: node.isStartScene ? 10 : 1,
      memoryFootprint: this.calculateNodeMemoryFootprint(node)
    };
    
    this.nodes.set(nodeId, nodeData);
    this.invalidateVisibilityCache();
    this.updatePerformanceStats();
    this.emit('nodeAdded', { nodeId, node: nodeData });
  }

  updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const updatedNode = { 
      ...node, 
      ...updates,
      lastAccessed: Date.now(),
      memoryFootprint: updates.content ? this.calculateNodeMemoryFootprint({ ...node, ...updates }) : node.memoryFootprint
    };
    
    if (updates.position) {
      updatedNode.position = this.snapPosition(updates.position);
      this.invalidateVisibilityCache(); // Position changes affect visibility
    }

    this.nodes.set(nodeId, updatedNode);
    this.updatePerformanceStats();
    this.emit('nodeUpdated', { nodeId, node: updatedNode });
    return updatedNode;
  }

  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    this.nodes.delete(nodeId);
    this.visibilityCache.delete(nodeId);
    this.nodeRenderCache.delete(nodeId);
    this.offScreenNodes.delete(nodeId);
    this.updatePerformanceStats();
    this.emit('nodeRemoved', { nodeId, node });
    return true;
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  getAllNodes() {
    return new Map(this.nodes);
  }

  // Position management
  setNodePosition(nodeId, position) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const snappedPosition = this.snapPosition(position);
    return this.updateNode(nodeId, { position: snappedPosition });
  }

  getNodePosition(nodeId) {
    const node = this.nodes.get(nodeId);
    return node ? node.position : null;
  }

  snapPosition(position) {
    if (!this.snapToGrid) return position;
    
    return {
      x: Math.round(position.x / this.gridSize) * this.gridSize,
      y: Math.round(position.y / this.gridSize) * this.gridSize
    };
  }

  // Collision detection
  getNodeBounds(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    return {
      x: node.position.x,
      y: node.position.y,
      width: this.nodeSize.width,
      height: this.nodeSize.height,
      right: node.position.x + this.nodeSize.width,
      bottom: node.position.y + this.nodeSize.height,
      centerX: node.position.x + this.nodeSize.width / 2,
      centerY: node.position.y + this.nodeSize.height / 2
    };
  }

  isPositionOccupied(position, excludeNodeId = null) {
    const testBounds = {
      x: position.x,
      y: position.y,
      right: position.x + this.nodeSize.width,
      bottom: position.y + this.nodeSize.height
    };

    for (const [nodeId, node] of this.nodes) {
      if (nodeId === excludeNodeId) continue;

      const nodeBounds = this.getNodeBounds(nodeId);
      if (this.boundsOverlap(testBounds, nodeBounds)) {
        return true;
      }
    }

    return false;
  }

  boundsOverlap(bounds1, bounds2) {
    return !(bounds1.right < bounds2.x || 
             bounds1.x > bounds2.right || 
             bounds1.bottom < bounds2.y || 
             bounds1.y > bounds2.bottom);
  }

  // Optimal positioning
  findOptimalPosition(preferredPosition = null, padding = 50) {
    if (this.nodes.size === 0) {
      return preferredPosition || { x: 100, y: 100 };
    }

    // If preferred position is free, use it
    if (preferredPosition && !this.isPositionOccupied(preferredPosition)) {
      return this.snapPosition(preferredPosition);
    }

    // Find center of existing nodes
    const center = this.calculateNodesCenter();
    
    // Try positions in expanding spiral from center
    const step = this.nodeSize.width + padding;
    let radius = step;
    const maxRadius = step * 15;
    const angleStep = Math.PI / 6; // 30 degree steps

    while (radius < maxRadius) {
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        const position = {
          x: Math.round(center.x + radius * Math.cos(angle)),
          y: Math.round(center.y + radius * Math.sin(angle))
        };

        if (!this.isPositionOccupied(position)) {
          return this.snapPosition(position);
        }
      }
      radius += step;
    }

    // Fallback: grid search
    return this.findGridPosition(padding);
  }

  calculateNodesCenter() {
    if (this.nodes.size === 0) return { x: 0, y: 0 };

    let totalX = 0;
    let totalY = 0;

    for (const node of this.nodes.values()) {
      const bounds = this.getNodeBounds(node.id);
      totalX += bounds.centerX;
      totalY += bounds.centerY;
    }

    return {
      x: totalX / this.nodes.size,
      y: totalY / this.nodes.size
    };
  }

  findGridPosition(padding = 50) {
    const step = this.nodeSize.width + padding;
    let x = 100;
    let y = 100;

    while (y < 2000) { // Reasonable limit
      while (x < 2000) {
        if (!this.isPositionOccupied({ x, y })) {
          return this.snapPosition({ x, y });
        }
        x += step;
      }
      x = 100;
      y += this.nodeSize.height + padding;
    }

    // Ultimate fallback
    return { x: 100, y: 100 };
  }

  // Auto-layout algorithms
  autoLayoutNodes(connections = new Map(), options = {}) {
    if (this.nodes.size === 0) return;

    const {
      algorithm = 'force-directed',
      iterations = 100,
      width = 1200,
      height = 800,
      padding = 50
    } = options;

    switch (algorithm) {
      case 'force-directed':
        this.forceDirectedLayout(connections, iterations, width, height);
        break;
      case 'hierarchical':
        this.hierarchicalLayout(connections, padding);
        break;
      case 'circular':
        this.circularLayout(padding);
        break;
      case 'grid':
        this.gridLayout(padding);
        break;
      default:
        this.forceDirectedLayout(connections, iterations, width, height);
    }

    this.emit('layoutComplete', { algorithm, nodeCount: this.nodes.size });
  }

  forceDirectedLayout(connections, iterations = 100, width = 1200, height = 800) {
    const nodes = Array.from(this.nodes.values());
    const positions = new Map();
    const velocities = new Map();

    // Physics parameters
    const springLength = 200;
    const springStrength = 0.05;
    const repulsionStrength = 5000;
    const damping = 0.9;
    const centerForce = 0.01;

    // Initialize positions and velocities
    nodes.forEach(node => {
      positions.set(node.id, { 
        x: node.position.x || Math.random() * width,
        y: node.position.y || Math.random() * height
      });
      velocities.set(node.id, { x: 0, y: 0 });
    });

    const center = { x: width / 2, y: height / 2 };

    // Run simulation
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map();
      
      // Initialize forces
      nodes.forEach(node => {
        forces.set(node.id, { x: 0, y: 0 });
      });

      // Repulsion forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          const pos1 = positions.get(node1.id);
          const pos2 = positions.get(node2.id);
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          
          const force = repulsionStrength / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const force1 = forces.get(node1.id);
          const force2 = forces.get(node2.id);
          force1.x += fx;
          force1.y += fy;
          force2.x -= fx;
          force2.y -= fy;
        }
      }

      // Spring forces for connected nodes
      if (connections) {
        connections.forEach(conn => {
          const fromPos = positions.get(conn.fromNodeId);
          const toPos = positions.get(conn.toNodeId);
          
          if (fromPos && toPos) {
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
              const force = springStrength * (distance - springLength);
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;
              
              const fromForce = forces.get(conn.fromNodeId);
              const toForce = forces.get(conn.toNodeId);
              if (fromForce && toForce) {
                fromForce.x += fx;
                fromForce.y += fy;
                toForce.x -= fx;
                toForce.y -= fy;
              }
            }
          }
        });
      }

      // Center attraction force
      nodes.forEach(node => {
        const pos = positions.get(node.id);
        const force = forces.get(node.id);
        
        const dx = center.x - pos.x;
        const dy = center.y - pos.y;
        
        force.x += dx * centerForce;
        force.y += dy * centerForce;
      });

      // Update positions
      nodes.forEach(node => {
        const pos = positions.get(node.id);
        const vel = velocities.get(node.id);
        const force = forces.get(node.id);
        
        vel.x = (vel.x + force.x) * damping;
        vel.y = (vel.y + force.y) * damping;
        
        pos.x += vel.x;
        pos.y += vel.y;
        
        // Keep within bounds
        pos.x = Math.max(50, Math.min(width - this.nodeSize.width - 50, pos.x));
        pos.y = Math.max(50, Math.min(height - this.nodeSize.height - 50, pos.y));
      });
    }

    // Apply final positions
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      this.setNodePosition(node.id, pos);
    });
  }

  hierarchicalLayout(connections, padding = 50) {
    // Simple top-down hierarchical layout
    const levels = this.calculateNodeLevels(connections);
    const levelNodes = new Map();

    // Group nodes by level
    for (const [nodeId, level] of levels) {
      if (!levelNodes.has(level)) {
        levelNodes.set(level, []);
      }
      levelNodes.get(level).push(nodeId);
    }

    // Position nodes
    let y = 100;
    for (const level of Array.from(levelNodes.keys()).sort((a, b) => a - b)) {
      const nodesAtLevel = levelNodes.get(level);
      const totalWidth = nodesAtLevel.length * (this.nodeSize.width + padding) - padding;
      let x = (1200 - totalWidth) / 2; // Center horizontally

      nodesAtLevel.forEach(nodeId => {
        this.setNodePosition(nodeId, { x, y });
        x += this.nodeSize.width + padding;
      });

      y += this.nodeSize.height + padding;
    }
  }

  calculateNodeLevels(connections) {
    const levels = new Map();
    const visited = new Set();
    
    // Find root nodes (no incoming connections)
    const hasIncoming = new Set();
    if (connections) {
      connections.forEach(conn => {
        hasIncoming.add(conn.toNodeId);
      });
    }

    const roots = Array.from(this.nodes.keys()).filter(nodeId => !hasIncoming.has(nodeId));
    
    // BFS to assign levels
    const queue = roots.map(nodeId => ({ nodeId, level: 0 }));
    
    while (queue.length > 0) {
      const { nodeId, level } = queue.shift();
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      levels.set(nodeId, level);
      
      // Add connected nodes to queue
      if (connections) {
        connections.forEach(conn => {
          if (conn.fromNodeId === nodeId && !visited.has(conn.toNodeId)) {
            queue.push({ nodeId: conn.toNodeId, level: level + 1 });
          }
        });
      }
    }

    // Handle unvisited nodes
    this.nodes.forEach((node, nodeId) => {
      if (!levels.has(nodeId)) {
        levels.set(nodeId, 0);
      }
    });

    return levels;
  }

  circularLayout(padding = 50) {
    const nodes = Array.from(this.nodes.values());
    const centerX = 600;
    const centerY = 400;
    const radius = Math.min(300, (nodes.length * (this.nodeSize.width + padding)) / (2 * Math.PI));

    nodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length;
      const x = centerX + radius * Math.cos(angle) - this.nodeSize.width / 2;
      const y = centerY + radius * Math.sin(angle) - this.nodeSize.height / 2;
      
      this.setNodePosition(node.id, { x, y });
    });
  }

  gridLayout(padding = 50) {
    const nodes = Array.from(this.nodes.values());
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const stepX = this.nodeSize.width + padding;
    const stepY = this.nodeSize.height + padding;

    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 100 + col * stepX;
      const y = 100 + row * stepY;
      
      this.setNodePosition(node.id, { x, y });
    });
  }

  // Viewport management
  setViewport(viewport) {
    this.viewport = { ...this.viewport, ...viewport };
    this.emit('viewportChanged', this.viewport);
  }

  getViewport() {
    return { ...this.viewport };
  }

  centerOnNodes() {
    if (this.nodes.size === 0) return;

    const bounds = this.getNodesBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.setViewport({
      x: 600 - centerX,
      y: 400 - centerY
    });
  }

  getNodesBounds() {
    if (this.nodes.size === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.nodes.values()) {
      const bounds = this.getNodeBounds(node.id);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.right);
      maxY = Math.max(maxY, bounds.bottom);
    }

    return { minX, minY, maxX, maxY };
  }

  // Advanced viewport culling and visibility management
  getVisibleNodes(viewportBounds = null, forceUpdate = false) {
    const bounds = viewportBounds || this.calculateViewportBounds();
    const viewportHash = this.hashViewport(bounds);

    // Use cached result if viewport hasn't changed significantly
    if (!forceUpdate && this.lastViewportHash === viewportHash && this.visibilityCache.size > 0) {
      return Array.from(this.visibilityCache.values());
    }

    const startTime = performance.now();
    const visibleNodes = [];
    const culledNodes = [];

    // Enhanced culling with buffer zone for smooth scrolling
    const bufferedBounds = {
      left: bounds.left - this.bufferZone,
      right: bounds.right + this.bufferZone,
      top: bounds.top - this.bufferZone,
      bottom: bounds.bottom + this.bufferZone
    };

    this.visibilityCache.clear();

    for (const [nodeId, node] of this.nodes) {
      const nodeBounds = this.getNodeBounds(nodeId);

      if (this.boundsIntersect(nodeBounds, bufferedBounds)) {
        // Node is visible - update access time and add to visible list
        node.lastAccessed = Date.now();
        const visibleNodeData = {
          nodeId,
          node,
          priority: this.calculateRenderPriority(node, bounds),
          distance: this.calculateDistanceToViewport(nodeBounds, bounds)
        };

        visibleNodes.push(visibleNodeData);
        this.visibilityCache.set(nodeId, visibleNodeData);
        this.offScreenNodes.delete(nodeId);
      } else {
        // Node is off-screen
        culledNodes.push(nodeId);
        this.offScreenNodes.add(nodeId);

        // Unload node content if memory optimization is enabled
        if (this.memoryOptimizationEnabled && this.shouldUnloadNode(node)) {
          this.unloadNodeContent(nodeId);
        }
      }
    }

    // Sort visible nodes by priority for optimal rendering
    visibleNodes.sort((a, b) => b.priority - a.priority);

    // Limit visible nodes if necessary for performance
    const finalVisibleNodes = visibleNodes.slice(0, this.maxVisibleNodes);

    this.lastViewportHash = viewportHash;
    this.performanceStats.renderTime = performance.now() - startTime;
    this.performanceStats.visibleNodes = finalVisibleNodes.length;
    this.performanceStats.culledNodes = culledNodes.length;

    this.emit('visibilityUpdated', {
      visible: finalVisibleNodes,
      culled: culledNodes,
      performance: this.performanceStats
    });

    return finalVisibleNodes;
  }
  calculateViewportBounds() {
    const { x, y, zoom } = this.viewport;
    const viewportWidth = (typeof window !== 'undefined' ? window.innerWidth : 1200) / zoom;
    const viewportHeight = (typeof window !== 'undefined' ? window.innerHeight : 800) / zoom;
    
    return {
      left: -x / zoom,
      right: (-x + viewportWidth) / zoom,
      top: -y / zoom,
      bottom: (-y + viewportHeight) / zoom
    };
  }
  
  boundsIntersect(bounds1, bounds2) {
    return !(bounds1.right < bounds2.left || 
             bounds1.x > bounds2.right ||
             bounds1.bottom < bounds2.top ||
             bounds1.y > bounds2.bottom);
  }
  
  calculateRenderPriority(node, viewportBounds) {
    let priority = node.renderPriority || 1;
    
    // Boost priority for start scenes
    if (node.isStartScene) priority += 10;
    
    // Boost priority for recently accessed nodes
    const timeSinceAccess = Date.now() - (node.lastAccessed || 0);
    if (timeSinceAccess < 30000) priority += 5; // Within 30 seconds
    
    // Boost priority for nodes with many connections
    if (node.choices && node.choices.length > 5) priority += 3;
    
    // Distance-based priority (closer = higher priority)
    const nodeBounds = this.getNodeBounds(node.id);
    const distance = this.calculateDistanceToViewport(nodeBounds, viewportBounds);
    priority += Math.max(0, 10 - distance / 100);
    
    return priority;
  }
  
  calculateDistanceToViewport(nodeBounds, viewportBounds) {
    const nodeCenter = {
      x: nodeBounds.centerX,
      y: nodeBounds.centerY
    };
    
    const viewportCenter = {
      x: (viewportBounds.left + viewportBounds.right) / 2,
      y: (viewportBounds.top + viewportBounds.bottom) / 2
    };
    
    const dx = nodeCenter.x - viewportCenter.x;
    const dy = nodeCenter.y - viewportCenter.y;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  hashViewport(bounds) {
    // Create a hash of the viewport for caching purposes
    const precision = 10; // Round to nearest 10 pixels for stability
    return [
      Math.round(bounds.left / precision),
      Math.round(bounds.top / precision),
      Math.round(bounds.right / precision),
      Math.round(bounds.bottom / precision)
    ].join(',');
  }
  
  invalidateVisibilityCache() {
    this.visibilityCache.clear();
    this.lastViewportHash = null;
  }
  
  // Memory optimization methods
  calculateNodeMemoryFootprint(node) {
    let size = 1000; // Base size
    if (node.content) size += node.content.length * 2;
    if (node.choices) size += node.choices.length * 500;
    if (node.metadata) size += JSON.stringify(node.metadata).length;
    return size;
  }
  
  shouldUnloadNode(node) {
    const timeSinceAccess = Date.now() - (node.lastAccessed || 0);
    const isLargeNode = node.memoryFootprint > 10000;
    const isOldAccess = timeSinceAccess > 300000; // 5 minutes
    
    return isLargeNode && isOldAccess && !node.isStartScene;
  }
  
  unloadNodeContent(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || node.isContentUnloaded) return;
    
    // Store original content in compressed cache
    if (node.content && node.content.length > 1000) {
      this.nodeRenderCache.set(`${nodeId}_content`, node.content);
      node.content = '[Content unloaded - will reload when visible]';
      node.isContentUnloaded = true;
      
      this.emit('nodeContentUnloaded', { nodeId, memorySaved: node.memoryFootprint });
    }
  }
  
  reloadNodeContent(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isContentUnloaded) return;
    
    const cachedContent = this.nodeRenderCache.get(`${nodeId}_content`);
    if (cachedContent) {
      node.content = cachedContent;
      node.isContentUnloaded = false;
      node.lastAccessed = Date.now();
      this.nodeRenderCache.delete(`${nodeId}_content`);
      
      this.emit('nodeContentReloaded', { nodeId });
    }
  }
  
  // Performance monitoring and optimization
  updatePerformanceStats() {
    this.performanceStats.totalNodes = this.nodes.size;
    this.performanceStats.memoryUsage = Array.from(this.nodes.values())
      .reduce((total, node) => total + (node.memoryFootprint || 1000), 0);
  }
  
  getPerformanceStats() {
    const stats = { ...this.performanceStats };
    stats.cullingRatio = stats.totalNodes > 0 ? 
      Math.round((stats.culledNodes / stats.totalNodes) * 100) : 0;
    stats.memoryEfficiency = stats.totalNodes > this.lazyLoadThreshold;
    stats.offScreenNodes = this.offScreenNodes.size;
    
    return stats;
  }
  
  optimizeMemoryUsage() {
    if (!this.memoryOptimizationEnabled) return;
    
    let unloadedCount = 0;
    const currentTime = Date.now();
    
    for (const [nodeId, node] of this.nodes) {
      if (this.offScreenNodes.has(nodeId) && this.shouldUnloadNode(node)) {
        this.unloadNodeContent(nodeId);
        unloadedCount++;
      }
    }
    
    // Cleanup old cache entries
    const cacheKeys = Array.from(this.nodeRenderCache.keys());
    for (const key of cacheKeys) {
      const nodeId = key.split('_')[0];
      const node = this.nodes.get(nodeId);
      if (!node || currentTime - (node.lastAccessed || 0) > 600000) { // 10 minutes
        this.nodeRenderCache.delete(key);
      }
    }
    
    this.emit('memoryOptimized', { unloadedNodes: unloadedCount });
    return unloadedCount;
  }
  
  // Enhanced viewport management with culling integration
  setViewport(viewport, skipCullingUpdate = false) {
    const oldViewport = { ...this.viewport };
    this.viewport = { ...this.viewport, ...viewport };
    
    // Debounce visibility updates during rapid viewport changes
    if (!skipCullingUpdate && this.cullingEnabled) {
      if (this.updateDebounceTimeout) {
        clearTimeout(this.updateDebounceTimeout);
      }
      
      this.updateDebounceTimeout = setTimeout(() => {
        this.getVisibleNodes(null, true); // Force update
        this.updateDebounceTimeout = null;
      }, 16); // ~60fps
    }
    
    this.emit('viewportChanged', { old: oldViewport, new: this.viewport });
  }
  
  // Settings with performance implications
  setSnapToGrid(enabled) {
    this.snapToGrid = enabled;
    this.emit('settingsChanged', { snapToGrid: this.snapToGrid });
  }

  setGridSize(size) {
    this.gridSize = Math.max(10, size);
    this.emit('settingsChanged', { gridSize: this.gridSize });
  }

  setNodeSize(width, height) {
    this.nodeSize = { width, height };
    this.invalidateVisibilityCache(); // Node size affects visibility
    this.emit('settingsChanged', { nodeSize: this.nodeSize });
  }
  
  setCullingEnabled(enabled) {
    this.cullingEnabled = enabled;
    if (enabled) {
      this.getVisibleNodes(null, true);
    } else {
      this.invalidateVisibilityCache();
    }
    this.emit('settingsChanged', { cullingEnabled: this.cullingEnabled });
  }
  
  setMemoryOptimization(enabled) {
    this.memoryOptimizationEnabled = enabled;
    if (enabled) {
      this.optimizeMemoryUsage();
    } else {
      // Reload all unloaded content
      for (const nodeId of Array.from(this.nodes.keys())) {
        this.reloadNodeContent(nodeId);
      }
    }
    this.emit('settingsChanged', { memoryOptimizationEnabled: this.memoryOptimizationEnabled });
  }
  
  // Search and highlighting functionality
  searchNodes(query, options = {}) {
    if (!query.trim()) return [];
    
    const {
      searchTitles = true,
      searchContent = true,
      searchChoices = true,
      caseSensitive = false,
      wholeWords = false,
      useRegex = false
    } = options;
    
    const results = [];
    let searchRegex;
    
    try {
      const flags = `g${!caseSensitive ? 'i' : ''}`;
      if (useRegex) {
        searchRegex = new RegExp(query, flags);
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = wholeWords ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchRegex = new RegExp(pattern, flags);
      }
    } catch (error) {
      // Invalid regex - fall back to literal search
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escapedQuery, `g${!caseSensitive ? 'i' : ''}`);
    }
    
    for (const [nodeId, node] of this.nodes) {
      const nodeMatches = [];
      
      // Search in title
      if (searchTitles && node.title) {
        const matches = [...node.title.matchAll(searchRegex)];
        matches.forEach(match => {
          nodeMatches.push({
            type: 'title',
            text: node.title,
            match: match[0],
            index: match.index
          });
        });
      }
      
      // Search in content
      if (searchContent && node.content) {
        const matches = [...node.content.matchAll(searchRegex)];
        matches.forEach(match => {
          nodeMatches.push({
            type: 'content',
            text: node.content,
            match: match[0],
            index: match.index
          });
        });
      }
      
      // Search in choices
      if (searchChoices && node.choices) {
        node.choices.forEach((choice, choiceIndex) => {
          if (choice.text) {
            const matches = [...choice.text.matchAll(searchRegex)];
            matches.forEach(match => {
              nodeMatches.push({
                type: 'choice',
                text: choice.text,
                match: match[0],
                index: match.index,
                choiceIndex: choiceIndex,
                choiceId: choice.id
              });
            });
          }
        });
      }
      
      if (nodeMatches.length > 0) {
        results.push({
          nodeId,
          node,
          matches: nodeMatches,
          matchCount: nodeMatches.length
        });
      }
    }
    
    return results.sort((a, b) => b.matchCount - a.matchCount);
  }
  
  setSearchHighlights(highlights) {
    this.searchHighlights = highlights || [];
    this.emit('searchHighlightsChanged', this.searchHighlights);
  }
  
  getSearchHighlights() {
    return this.searchHighlights || [];
  }
  
  clearSearchHighlights() {
    this.searchHighlights = [];
    this.emit('searchHighlightsChanged', []);
  }

  // Cleanup method for component unmounting
  destroy() {
    if (this.updateDebounceTimeout) {
      clearTimeout(this.updateDebounceTimeout);
    }
    
    this.nodes.clear();
    this.visibilityCache.clear();
    this.nodeRenderCache.clear();
    this.offScreenNodes.clear();
    this.listeners.clear();
    this.searchHighlights = [];
  }
}

export default NodeManager;