// SceneNode.js - Individual draggable scene nodes
// Handles: scene representation, drag behavior, selection, connection points, context menus

const { useState, useRef, useCallback } = React;

export default function SceneNode({
  nodeId,
  node,
  isSelected = false,
  isStartScene = false,
  position = { x: 0, y: 0 },
  zoom = 1,
  onSelect = () => {},
  onDoubleClick = () => {},
  onContextMenu = () => {}, // NEW: Context menu handler
  onConnectionStart = () => {},
  onConnectionEnd = () => {},
  isConnectionTarget = false,
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const nodeRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    // Skip context menu (right-click)
    if (e.button === 2) return;
    
    e.stopPropagation();
    onSelect(nodeId);
    setIsDragging(true);
  }, [nodeId, onSelect]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    onDoubleClick(nodeId);
  }, [nodeId, onDoubleClick]);

  // NEW: Handle context menu (right-click)
  const handleContextMenu = useCallback((e) => {
    e.preventDefault(); // Prevent browser context menu
    e.stopPropagation();
    
    const screenPosition = { x: e.clientX, y: e.clientY };
    onContextMenu(nodeId, screenPosition, node);
  }, [nodeId, node, onContextMenu]);

  const handleConnectionStart = useCallback((e) => {
    e.stopPropagation();
    onConnectionStart(nodeId);
  }, [nodeId, onConnectionStart]);

  const handleConnectionEnd = useCallback((e) => {
    e.stopPropagation();
    if (isConnectionTarget) {
      onConnectionEnd(nodeId);
    }
  }, [nodeId, onConnectionEnd, isConnectionTarget]);

  // Truncate text with ellipsis
  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Get node style classes - enhanced for start scene indication
  const getNodeClasses = () => {
    const baseClasses = 'absolute bg-white rounded-lg shadow-lg border-2 cursor-move select-none transition-all duration-200';
    
    let borderClasses = '';
    if (isSelected) {
      borderClasses = 'border-blue-500 shadow-blue-200';
    } else if (isStartScene) {
      borderClasses = 'border-green-500 shadow-green-200'; // Green for start scene
    } else if (isConnectionTarget) {
      borderClasses = 'border-green-500 shadow-green-200';
    } else if (isHovered) {
      borderClasses = 'border-gray-400 shadow-md';
    } else {
      borderClasses = 'border-gray-300';
    }

    let bgClasses = '';
    if (isStartScene) {
      bgClasses = 'bg-green-50'; // Light green background for start scene
    } else if (isSelected) {
      bgClasses = 'bg-blue-50';
    } else {
      bgClasses = 'bg-white';
    }

    return `${baseClasses} ${borderClasses} ${bgClasses}`;
  };

  // Calculate scaled dimensions
  const nodeWidth = 200 * zoom;
  const nodeHeight = 120 * zoom;
  const fontSize = Math.max(12 * zoom, 10);
  const smallFontSize = Math.max(10 * zoom, 8);

  return React.createElement('div', {
    ref: nodeRef,
    className: `${getNodeClasses()} ${className}`,
    style: {
      left: `${position.x * zoom}px`,
      top: `${position.y * zoom}px`,
      width: `${nodeWidth}px`,
      height: `${nodeHeight}px`,
      zIndex: isSelected ? 20 : isDragging ? 15 : 10
    },
    onMouseDown: handleMouseDown,
    onDoubleClick: handleDoubleClick,
    onContextMenu: handleContextMenu, // NEW: Context menu handler
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onMouseUp: handleConnectionEnd
  }, [
    // Node header with title and indicators
    React.createElement('div', {
      key: 'node-header',
      className: `px-3 py-2 border-b border-gray-200 rounded-t-lg ${isStartScene ? 'bg-green-100' : 'bg-gray-50'}`
    }, [
      React.createElement('div', {
        key: 'header-content',
        className: 'flex items-center justify-between'
      }, [
        React.createElement('h3', {
          key: 'node-title',
          className: 'font-semibold text-gray-800 truncate flex-1',
          style: { fontSize: `${fontSize}px` },
          title: node.title || 'Untitled Scene'
        }, node.title || 'Untitled Scene'),

        React.createElement('div', {
          key: 'node-indicators',
          className: 'flex items-center space-x-1 ml-2'
        }, [
          // Enhanced start scene indicator
          isStartScene && React.createElement('div', {
            key: 'start-indicator',
            className: 'flex items-center bg-green-600 text-white px-2 py-1 rounded-full text-xs font-bold',
            title: 'Start Scene'
          }, [
            React.createElement('span', { key: 'home-icon' }, '🏠'),
            zoom > 0.7 && React.createElement('span', { 
              key: 'start-text',
              className: 'ml-1'
            }, 'START')
          ]),

          (node.onEnter && node.onEnter.length > 0) && React.createElement('span', {
            key: 'enter-action',
            className: 'text-xs text-blue-600',
            title: 'Has onEnter actions'
          }, '↓'),

          (node.onExit && node.onExit.length > 0) && React.createElement('span', {
            key: 'exit-action',
            className: 'text-xs text-orange-600',
            title: 'Has onExit actions'
          }, '↑')
        ])
      ])
    ]),

    // Node content area
    React.createElement('div', {
      key: 'node-content',
      className: 'px-3 py-2 flex-1 flex flex-col justify-between'
    }, [
      // Content preview
      React.createElement('div', {
        key: 'content-preview',
        className: 'text-gray-600 text-sm leading-tight mb-2',
        style: { fontSize: `${smallFontSize}px` }
      }, node.content ? truncateText(node.content, 60) : React.createElement('span', {
        className: 'italic text-gray-400'
      }, 'No content')),

      // Footer with choices and connection point
      React.createElement('div', {
        key: 'node-footer',
        className: 'flex items-center justify-between'
      }, [
        React.createElement('div', {
          key: 'choices-info',
          className: 'text-xs text-gray-500'
        }, [
          React.createElement('span', {
            key: 'choices-count'
          }, `${(node.choices || []).length} choice${(node.choices || []).length !== 1 ? 's' : ''}`),

          // Show conditional choices indicator
          (node.choices || []).some(choice => choice.conditions && choice.conditions.length > 0) && 
          React.createElement('span', {
            key: 'conditional-indicator',
            className: 'ml-1 text-yellow-600',
            title: 'Has conditional choices'
          }, '⚡')
        ]),

        // Connection handle
        React.createElement('button', {
          key: 'connection-handle',
          onMouseDown: handleConnectionStart,
          className: `w-6 h-6 rounded-full border-2 bg-white hover:bg-gray-50 transition-colors ${
            isConnectionTarget ? 'border-green-500 bg-green-50' : 'border-gray-400 hover:border-gray-600'
          }`,
          title: 'Drag to connect scenes'
        }, React.createElement('div', {
          className: `w-2 h-2 rounded-full mx-auto ${
            isConnectionTarget ? 'bg-green-500' : 'bg-gray-400'
          }`
        }))
      ])
    ]),

    // Selection outline overlay
    isSelected && React.createElement('div', {
      key: 'selection-outline',
      className: 'absolute -inset-1 border-2 border-blue-500 rounded-lg pointer-events-none',
      style: {
        boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.5)'
      }
    }),

    // Context menu hint (on hover)
    isHovered && zoom > 0.5 && React.createElement('div', {
      key: 'context-hint',
      className: 'absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-75',
      style: { fontSize: '10px' }
    }, 'Right-click for options')
  ]);
}