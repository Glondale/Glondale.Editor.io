// EditorCanvas.js - Main canvas with drag/drop functionality
// Handles: canvas rendering, node positioning, drag/drop, pan/zoom, node connections, context menus

import ConnectionLine from '../nodes/ConnectionLine.js';
import NodeManager from '../../../editor/NodeManager.js';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "https://esm.sh/react@18";

const EditorCanvas = memo(function EditorCanvas({ 
  nodes = new Map(), 
  connections = new Map(), 
  selectedNodeId = null,
  highlightedNodeIds = new Set(),
  onNodeSelect = () => {},
  onNodeMove = () => {},
  // Called continuously during drag for immediate visual feedback (should update node position without creating history entries)
  onNodeDrag = () => {},
  onNodeCreate = () => {},
  onNodeContextMenu = () => {},
  onConnectionCreate = () => {},
  enableAdvancedCulling = true,
  maxVisibleNodes = 1000,
  className = ''
}) {
  const canvasRef = useRef(null);
  const nodeManagerRef = useRef(null);
  const renderFrameRef = useRef(null);
  const lastRenderTime = useRef(0);
  
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragType: null,
    startPos: { x: 0, y: 0 },
    dragNodeId: null,
    connectionStart: null
  });
  // Ghost overlay shown during node drag for clearer UX
  const [ghost, setGhost] = useState(null);
  
  // Initialize NodeManager for advanced culling
  useEffect(() => {
    if (enableAdvancedCulling) {
      nodeManagerRef.current = new NodeManager({
        enableCulling: true,
        bufferZone: 300,
        enableMemoryOptimization: nodes.size > 100,
        maxVisibleNodes,
        lazyLoadThreshold: 200
      });
      
      // Sync nodes with NodeManager
      for (const [nodeId, node] of nodes) {
        nodeManagerRef.current.addNode(nodeId, node);
      }
      
      nodeManagerRef.current.setViewport(viewport);
      
      return () => {
        if (nodeManagerRef.current) {
          nodeManagerRef.current.destroy();
        }
      };
    }
  }, [enableAdvancedCulling, maxVisibleNodes]);
  
  // Sync viewport with NodeManager
  useEffect(() => {
    if (nodeManagerRef.current) {
      nodeManagerRef.current.setViewport(viewport);
    }
  }, [viewport]);
  
  // Sync nodes with NodeManager
  useEffect(() => {
    if (nodeManagerRef.current && enableAdvancedCulling) {
      // Clear and rebuild node manager state
      for (const [nodeId] of nodeManagerRef.current.getAllNodes()) {
        nodeManagerRef.current.removeNode(nodeId);
      }
      
      for (const [nodeId, node] of nodes) {
        nodeManagerRef.current.addNode(nodeId, node);
      }
    }
  }, [nodes, enableAdvancedCulling]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX, screenY) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - viewport.x) / viewport.zoom,
      y: (screenY - rect.top - viewport.y) / viewport.zoom
    };
  }, [viewport]);

  // Convert canvas coordinates to screen coordinates  
  const canvasToScreen = useCallback((canvasX, canvasY) => {
    return {
      x: canvasX * viewport.zoom + viewport.x,
      y: canvasY * viewport.zoom + viewport.y
    };
  }, [viewport]);

  // Find node at position
  const getNodeAtPosition = useCallback((canvasPos) => {
    for (const [nodeId, node] of nodes) {
      const nodeRect = {
        x: node.position.x,
        y: node.position.y,
        width: 200,
        height: 100
      };
      
      if (canvasPos.x >= nodeRect.x && canvasPos.x <= nodeRect.x + nodeRect.width &&
          canvasPos.y >= nodeRect.y && canvasPos.y <= nodeRect.y + nodeRect.height) {
        return { nodeId, node };
      }
    }
    return null;
  }, [nodes]);

  // Advanced viewport culling with NodeManager integration
  const getVisibleNodes = useMemo(() => {
    if (enableAdvancedCulling && nodeManagerRef.current) {
      // Use NodeManager's advanced culling
      const visibleNodeData = nodeManagerRef.current.getVisibleNodes();
      return visibleNodeData.map(({ nodeId, node }) => [nodeId, node]);
    }
    
    // Fallback to basic culling if NodeManager is not available
    if (!canvasRef.current) return Array.from(nodes.entries());
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const nodeSize = { width: 200, height: 100 };
    const buffer = 200; // Increased buffer for smoother scrolling
    
    const visibleArea = {
      left: (-viewport.x - buffer) / viewport.zoom,
      top: (-viewport.y - buffer) / viewport.zoom,
      right: (-viewport.x + canvasRect.width + buffer) / viewport.zoom,
      bottom: (-viewport.y + canvasRect.height + buffer) / viewport.zoom
    };
    
    const visibleNodes = [];
    for (const [nodeId, node] of nodes) {
      const nodeRect = {
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + nodeSize.width,
        bottom: node.position.y + nodeSize.height
      };
      
      const isVisible = !(nodeRect.right < visibleArea.left || 
                         nodeRect.left > visibleArea.right ||
                         nodeRect.bottom < visibleArea.top || 
                         nodeRect.top > visibleArea.bottom);
      
      if (isVisible) {
        visibleNodes.push([nodeId, node]);
      }
    }

    return visibleNodes;
  }, [nodes, viewport, canvasRef.current?.getBoundingClientRect(), enableAdvancedCulling]);

  // Memoized visible connections - only render connections between visible nodes
  const getVisibleConnections = useMemo(() => {
    const visibleNodeIds = new Set(getVisibleNodes.map(([nodeId]) => nodeId));
    const visibleConnections = [];
    
    for (const [connectionId, connection] of connections) {
      // Only render connection if both nodes are visible or at least one endpoint is visible
      const fromVisible = visibleNodeIds.has(connection.fromNodeId);
      const toVisible = visibleNodeIds.has(connection.toNodeId);
      
      if (fromVisible || toVisible) {
        visibleConnections.push([connectionId, connection]);
      }
    }
    
    return visibleConnections;
  }, [connections, getVisibleNodes]);

  // Enhanced performance monitoring with NodeManager integration
  const performanceStats = useMemo(() => {
    if (!(typeof window !== 'undefined' && window.location.hostname === 'localhost')) return null;
    
    let stats;
    
    if (enableAdvancedCulling && nodeManagerRef.current) {
      // Get comprehensive stats from NodeManager
      const nodeManagerStats = nodeManagerRef.current.getPerformanceStats();
      stats = {
        ...nodeManagerStats,
        totalConnections: connections.size,
        visibleConnections: getVisibleConnections.length,
        connectionCullingRatio: connections.size > 0 ? 
          Math.round((1 - getVisibleConnections.length / connections.size) * 100) : 0,
        advancedCullingEnabled: true,
        memoryOptimizationEnabled: nodeManagerRef.current.memoryOptimizationEnabled
      };
    } else {
      // Basic stats without NodeManager
      const totalNodes = nodes.size;
      const visibleNodes = getVisibleNodes.length;
      const totalConnections = connections.size;
      const visibleConnections = getVisibleConnections.length;
      const cullingRatio = totalNodes > 0 ? Math.round((1 - visibleNodes / totalNodes) * 100) : 0;
      const connectionCullingRatio = totalConnections > 0 ? Math.round((1 - visibleConnections / totalConnections) * 100) : 0;
      
      stats = {
        totalNodes,
        visibleNodes,
        totalConnections,
        visibleConnections,
        cullingRatio,
        connectionCullingRatio,
        advancedCullingEnabled: false,
        memoryOptimizationEnabled: false,
        offScreenNodes: totalNodes - visibleNodes,
        memoryUsage: totalNodes * 2000, // Rough estimate
        renderTime: 0
      };
    }
    
    // Calculate performance metrics
    const renderSavings = stats.cullingRatio + (stats.connectionCullingRatio || 0);
    stats.performanceGain = Math.min(95, renderSavings * 0.8);
    stats.memoryEfficient = stats.totalNodes > 100 && stats.cullingRatio > 40;
    stats.highPerformanceMode = stats.advancedCullingEnabled && stats.totalNodes > 500;
    
    return stats;
  }, [nodes.size, getVisibleNodes.length, connections.size, getVisibleConnections.length, enableAdvancedCulling]);

  // Handle mouse down - start drag operations
  const handleMouseDown = useCallback((e) => {
    // Skip if right-click (context menu)
    if (e.button === 2) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const nodeAtPos = getNodeAtPosition(canvasPos);

    if (nodeAtPos) {
      setDragState({
        isDragging: true,
        dragType: 'node',
        startPos: canvasPos,
        dragNodeId: nodeAtPos.nodeId,
        connectionStart: null
      });
      onNodeSelect(nodeAtPos.nodeId);
    } else {
      setDragState({
        isDragging: true,
        dragType: 'canvas',
        startPos: { x: e.clientX, y: e.clientY },
        dragNodeId: null,
        connectionStart: null
      });
      onNodeSelect(null);
    }

    e.preventDefault();
  }, [screenToCanvas, getNodeAtPosition, onNodeSelect]);

  // Handle context menu (right-click)
  const handleContextMenu = useCallback((e) => {
    e.preventDefault(); // Prevent browser context menu
    
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const nodeAtPos = getNodeAtPosition(canvasPos);
    
    if (nodeAtPos) {
      // Node context menu
      const screenPosition = { x: e.clientX, y: e.clientY };
      onNodeContextMenu(nodeAtPos.nodeId, screenPosition, nodeAtPos.node);
    }
    // Note: Canvas background context menu could be added here if needed
  }, [screenToCanvas, getNodeAtPosition, onNodeContextMenu]);

  // Enhanced mouse move with performance optimization
  const handleMouseMove = useCallback((e) => {
    if (!dragState.isDragging) return;

    // Throttle mouse move events for better performance during rapid movements
    const now = performance.now();
    if (now - lastRenderTime.current < 16) { // ~60fps limit
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
      }
      
      renderFrameRef.current = requestAnimationFrame(() => {
        lastRenderTime.current = now;
        handleMouseMoveInternal(e);
      });
      return;
    }
    
    handleMouseMoveInternal(e);
  }, [dragState]);
  
  const handleMouseMoveInternal = useCallback((e) => {
    if (dragState.dragType === 'node' && dragState.dragNodeId) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const node = nodes.get(dragState.dragNodeId);
      if (node) {
        const deltaX = canvasPos.x - dragState.startPos.x;
        const deltaY = canvasPos.y - dragState.startPos.y;
        
        const newPosition = {
          x: node.position.x + deltaX,
          y: node.position.y + deltaY
        };
        
        // Update NodeManager if available
        if (nodeManagerRef.current) {
          nodeManagerRef.current.updateNode(dragState.dragNodeId, { position: newPosition });
        }


        // Call live-drag callback for immediate visual feedback (does not record command history)
        try { onNodeDrag(dragState.dragNodeId, newPosition); } catch (err) { /* ignore */ }

        // Update ghost overlay to follow the dragged node
        try {
          setGhost({ nodeId: dragState.dragNodeId, position: newPosition, node });
        } catch (e) {
          // ignore
        }

        // Update start position for next delta calculation
        setDragState(prev => ({
          ...prev,
          startPos: canvasPos
        }));
      }
    } else if (dragState.dragType === 'canvas') {
      const deltaX = e.clientX - dragState.startPos.x;
      const deltaY = e.clientY - dragState.startPos.y;
      
      const newViewport = {
        x: viewport.x + deltaX,
        y: viewport.y + deltaY
      };

      setViewport(prev => ({ ...prev, ...newViewport }));

      setDragState(prev => ({
        ...prev,
        startPos: { x: e.clientX, y: e.clientY }
      }));
    }
  }, [dragState, screenToCanvas, nodes, viewport, onNodeMove]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    // If we were dragging a node, commit final position via onNodeMove (to allow history/commands)
    if (dragState.isDragging && dragState.dragType === 'node' && dragState.dragNodeId) {
      const node = nodes.get(dragState.dragNodeId);
      if (node) {
        try { onNodeMove(dragState.dragNodeId, node.position); } catch (err) { /* ignore */ }
      }
    }

    // Clear ghost overlay and reset drag state
    setGhost(null);
    setDragState({
      isDragging: false,
      dragType: null,
      startPos: { x: 0, y: 0 },
      dragNodeId: null,
      connectionStart: null
    });
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.1), 3);
    
    setViewport(prev => ({
      ...prev,
      zoom: newZoom
    }));
  }, [viewport.zoom]);

  // Handle double click
  const handleDoubleClick = useCallback((e) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    onNodeCreate(canvasPos);
  }, [screenToCanvas, onNodeCreate]);

  // Event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', handleContextMenu); // NEW: Context menu
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('dblclick', handleDoubleClick);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('contextmenu', handleContextMenu); // NEW: Context menu cleanup
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [handleMouseDown, handleContextMenu, handleMouseMove, handleMouseUp, handleWheel, handleDoubleClick]);

  // Render node - enhanced for start scene indication
  const renderNode = (nodeId, node) => {
    const screenPos = { x: node.position.x, y: node.position.y }; // world space
    const isSelected = nodeId === selectedNodeId;
    const isStartScene = node.isStartScene || false; // NEW: Start scene indicator
    const isHighlighted = highlightedNodeIds.has(nodeId);

    const borderClass = isSelected
      ? 'border-blue-500 shadow-blue-200'
      : isHighlighted
        ? 'border-yellow-400 shadow-yellow-200'
        : isStartScene
          ? 'border-green-500 shadow-green-200'
          : 'border-gray-300 hover:border-gray-400';

    return React.createElement('div', {
      key: nodeId,
      className: `absolute border-2 rounded-lg p-3 bg-white shadow-lg cursor-move select-none transition-all ${borderClass}`,
      style: {
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `200px`,
        height: `100px`,
  // Note: left/top already account for zoom via canvasToScreen, avoid extra CSS transform
  // transform and transformOrigin removed to keep pointer coordinates consistent
      }
    }, [
      // NEW: Start scene indicator
      isStartScene && React.createElement('div', {
        key: 'start-indicator',
        className: 'absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold',
        title: 'Start Scene'
      }, '🏠'),

      React.createElement('div', {
        key: 'title',
        className: 'font-semibold text-sm text-gray-800 truncate'
      }, node.title || 'Untitled Scene'),
      
      React.createElement('div', {
        key: 'choices',
        className: 'text-xs text-gray-600 mt-1'
      }, `${(node.choices || []).length} choices`),
      
      React.createElement('div', {
        key: 'content',
        className: 'text-xs text-gray-500 mt-2 line-clamp-2'
      }, node.content ? node.content.substring(0, 50) + '...' : 'No content')
    ]);
  };

  return React.createElement('div', {
    ref: canvasRef,
    className: `relative overflow-hidden bg-gray-50 cursor-grab ${className}`,
    style: { 
      cursor: dragState.isDragging && dragState.dragType === 'canvas' ? 'grabbing' : 'grab'
    }
  }, [
    // Grid background (screen space)
    React.createElement('div', {
      key: 'grid',
      className: 'absolute inset-0 opacity-20',
      style: {
        backgroundImage: `
          linear-gradient(#e5e7eb 1px, transparent 1px),
          linear-gradient(90deg, #e5e7eb 1px, transparent 1px)
        `,
        backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`
      }
    }),

    // World container (applies pan/zoom to nodes and connections together)
    React.createElement('div', {
      key: 'world',
      className: 'absolute inset-0',
      style: {
        zIndex: 1,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: '0 0'
      }
    }, [
      // SVG overlay for connections (world space)
      React.createElement('svg', {
        key: 'connections',
        className: 'absolute inset-0',
        style: { 
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          overflow: 'visible'
        }
      }, [
      React.createElement('defs', {
        key: 'defs'
      }, React.createElement('marker', {
        key: 'arrowhead',
        id: 'arrowhead',
        viewBox: '0 0 10 10',
        refX: '9',
        refY: '3',
        markerWidth: 6,
        markerHeight: 6,
        orient: 'auto',
        fill: '#3b82f6'
      }, React.createElement('path', {
        d: 'M0,0 L0,6 L9,3 z'
      }))),

      // Render connections using ConnectionLine component (world space)
      ...getVisibleConnections.map(([connectionId, connection]) => {
        const fromNode = nodes.get(connection.fromNodeId);
        const toNode = nodes.get(connection.toNodeId);
        if (fromNode && toNode) {
          return React.createElement(ConnectionLine, {
            key: connection.id,
            connection: connection,
            fromNode: fromNode,
            toNode: toNode,
            zoom: 1,
            viewport: { x: 0, y: 0, zoom: 1 },
            isSelected: false,
            onClick: () => console.log('Connection clicked:', connection.id),
            onDelete: () => console.log('Delete connection:', connection.id)
          });
        }
        return null;
      }).filter(Boolean)
      ]),

      // Node layer (world space)
      React.createElement('div', {
        key: 'nodes',
        className: 'absolute inset-0'
      }, getVisibleNodes.map(([nodeId, node]) => renderNode(nodeId, node)))
    ]),

    // Ghost overlay for dragging
    ghost && React.createElement('div', {
      key: 'ghost',
      className: 'absolute pointer-events-none',
      style: {
        left: `${canvasToScreen(ghost.position.x, ghost.position.y).x}px`,
        top: `${canvasToScreen(ghost.position.x, ghost.position.y).y}px`,
        width: `${200 * viewport.zoom}px`,
        height: `${100 * viewport.zoom}px`,
        zIndex: 25,
        transform: `translate(0,0)`
      }
    }, React.createElement('div', {
      className: 'w-full h-full border-2 border-dashed border-gray-400 bg-gray-100 bg-opacity-30 rounded-lg',
      style: { opacity: 0.9 }
    })),

    // Instructions overlay
    nodes.size === 0 && React.createElement('div', {
      key: 'instructions',
      className: 'absolute inset-0 flex items-center justify-center pointer-events-none',
      style: { zIndex: 3 }
    }, React.createElement('div', {
      className: 'text-gray-500 text-center'
    }, [
      React.createElement('div', {
        key: 'title',
        className: 'text-lg font-medium'
      }, 'Canvas Ready'),
      React.createElement('div', {
        key: 'instruction1', 
        className: 'text-sm mt-2'
      }, 'Double-click to create a new scene'),
      React.createElement('div', {
        key: 'instruction2',
        className: 'text-sm'
      }, 'Right-click for options • Drag to pan • Scroll to zoom')
    ])),

    // Advanced performance stats with NodeManager metrics
    performanceStats && React.createElement('div', {
      key: 'performance',
      className: `absolute top-4 right-4 bg-black bg-opacity-90 text-white text-xs p-3 rounded-lg font-mono border-l-4 ${
        performanceStats.highPerformanceMode ? 'border-green-400' :
        performanceStats.memoryEfficient ? 'border-blue-400' : 'border-yellow-400'
      }`,
      style: { zIndex: 10, minWidth: '220px', maxHeight: '300px', overflowY: 'auto' }
    }, [
      React.createElement('div', { key: 'title', className: 'font-bold mb-2 text-yellow-300 flex items-center justify-between' }, [
        React.createElement('span', { key: 'text' }, '⚡ Performance Monitor'),
        performanceStats.advancedCullingEnabled && React.createElement('span', { 
          key: 'advanced', 
          className: 'text-xs bg-green-600 px-1 rounded',
          title: 'Advanced culling enabled'
        }, 'ADV')
      ]),
      
      React.createElement('div', { key: 'nodes', className: 'mb-1' }, 
        `Nodes: ${performanceStats.visibleNodes}/${performanceStats.totalNodes} (${performanceStats.cullingRatio}% culled)`
      ),
      
      React.createElement('div', { key: 'connections', className: 'mb-1' }, 
        `Connections: ${performanceStats.visibleConnections}/${performanceStats.totalConnections} (${performanceStats.connectionCullingRatio}% culled)`
      ),
      
      React.createElement('div', { key: 'performance-gain', className: 'text-green-300 mb-1' }, 
        `📈 Performance: +${Math.round(performanceStats.performanceGain)}%`
      ),
      
      React.createElement('div', { key: 'memory', className: 'text-blue-300 mb-1' }, 
        `💾 Memory: ${Math.round((performanceStats.memoryUsage || 0) / 1024)}KB`
      ),
      
      performanceStats.renderTime > 0 && React.createElement('div', { key: 'render-time', className: 'text-purple-300 mb-1' }, 
        `⏱️ Render: ${Math.round(performanceStats.renderTime * 100) / 100}ms`
      ),
      
      React.createElement('div', { key: 'zoom', className: 'mb-1' }, 
        `🔍 Zoom: ${Math.round(viewport.zoom * 100)}%`
      ),
      
      performanceStats.offScreenNodes > 0 && React.createElement('div', { key: 'offscreen', className: 'text-gray-400 text-xs' }, 
        `Off-screen: ${performanceStats.offScreenNodes}`
      ),
      
      performanceStats.memoryOptimizationEnabled && React.createElement('div', { 
        key: 'memory-opt', 
        className: 'text-green-300 text-xs mt-1' 
      }, '🧠 Memory Optimized'),
      
      performanceStats.highPerformanceMode && React.createElement('div', { 
        key: 'high-perf', 
        className: 'text-green-300 text-xs mt-1' 
      }, '🚀 High Performance Mode'),
      
      performanceStats.memoryEfficient && React.createElement('div', { 
        key: 'efficiency', 
        className: 'text-green-300 text-xs mt-1' 
      }, '✅ Memory Efficient')
    ])
  ]);
}, (prevProps, nextProps) => {
  // Custom comparison for memo to optimize re-renders
  return (
    prevProps.nodes === nextProps.nodes &&
    prevProps.connections === nextProps.connections &&
    prevProps.selectedNodeId === nextProps.selectedNodeId &&
    prevProps.enableAdvancedCulling === nextProps.enableAdvancedCulling &&
    prevProps.maxVisibleNodes === nextProps.maxVisibleNodes
  );
});

export default EditorCanvas;
