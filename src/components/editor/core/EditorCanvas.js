// EditorCanvas.js - Main canvas with drag/drop functionality
// Handles: canvas rendering, node positioning, drag/drop, pan/zoom, node connections, context menus

import ConnectionLine from '../nodes/ConnectionLine.js';

import React, { useState, useEffect, useRef, useCallback } from "https://esm.sh/react@18";

export default function EditorCanvas({ 
  nodes = new Map(), 
  connections = new Map(), 
  selectedNodeId = null,
  onNodeSelect = () => {},
  onNodeMove = () => {},
  onNodeCreate = () => {},
  onNodeContextMenu = () => {}, // NEW: Context menu handler
  onConnectionCreate = () => {},
  className = ''
}) {
  const canvasRef = useRef(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragType: null,
    startPos: { x: 0, y: 0 },
    dragNodeId: null,
    connectionStart: null
  });

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

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!dragState.isDragging) return;

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
        
        onNodeMove(dragState.dragNodeId, newPosition);
        
        setDragState(prev => ({
          ...prev,
          startPos: canvasPos
        }));
      }
    } else if (dragState.dragType === 'canvas') {
      const deltaX = e.clientX - dragState.startPos.x;
      const deltaY = e.clientY - dragState.startPos.y;
      
      setViewport(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setDragState(prev => ({
        ...prev,
        startPos: { x: e.clientX, y: e.clientY }
      }));
    }
  }, [dragState, screenToCanvas, nodes, onNodeMove]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
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
    const screenPos = canvasToScreen(node.position.x, node.position.y);
    const isSelected = nodeId === selectedNodeId;
    const isStartScene = node.isStartScene || false; // NEW: Start scene indicator
    
    return React.createElement('div', {
      key: nodeId,
      className: `absolute border-2 rounded-lg p-3 bg-white shadow-lg cursor-move select-none transition-all ${
        isSelected ? 'border-blue-500 shadow-blue-200' : 
        isStartScene ? 'border-green-500 shadow-green-200' : 
        'border-gray-300 hover:border-gray-400'
      }`,
      style: {
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `${200 * viewport.zoom}px`,
        height: `${100 * viewport.zoom}px`,
        transform: `scale(${viewport.zoom})`,
        transformOrigin: 'top left'
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
    // Grid background
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

    // SVG overlay for connections
    React.createElement('svg', {
      key: 'connections',
      className: 'absolute inset-0',
      style: { 
        zIndex: 50,
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

      // Render connections using ConnectionLine component
      ...Array.from(connections.values()).map(connection => {
        const fromNode = nodes.get(connection.fromNodeId);
        const toNode = nodes.get(connection.toNodeId);
        if (fromNode && toNode) {
          return React.createElement(ConnectionLine, {
            key: connection.id,
            connection: connection,
            fromNode: fromNode,
            toNode: toNode,
            zoom: viewport.zoom,
            viewport: viewport,
            isSelected: false,
            onClick: () => console.log('Connection clicked:', connection.id),
            onDelete: () => console.log('Delete connection:', connection.id)
          });
        }
        return null;
      }).filter(Boolean)
    ]),

    // Node layer
    React.createElement('div', {
      key: 'nodes',
      className: 'absolute inset-0',
      style: { zIndex: 2 }
    }, Array.from(nodes.entries()).map(([nodeId, node]) => renderNode(nodeId, node))),

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
    ]))
  ]);
}