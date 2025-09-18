// ConnectionLine.js - Visual choice connections between nodes
// Handles: SVG line rendering, curved paths, connection labels, hover states
// FIXED: Now properly handles viewport transforms for canvas panning

import React, { useState, memo } from "https://esm.sh/react@18";

const ConnectionLine = memo(function ConnectionLine({
  connection,
  fromNode,
  toNode,
  zoom = 1,
  viewport = { x: 0, y: 0, zoom: 1 }, // Add viewport parameter for coordinate transforms
  isSelected = false,
  isPreview = false,
  onClick = () => {},
  onDelete = () => {},
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Use connection data or fallback to individual props
  const choice = connection?.choice || { text: 'Unknown Choice', conditions: [] };
  const connectionId = connection?.id || 'unknown';

  // World-transform is applied at parent; positions are already in world space
  const canvasToScreen = (x, y) => ({ x, y });

  // Calculate node centers and connection points - FIXED VERSION
  const getConnectionPoints = () => {
    // Keep these in sync with EditorCanvas renderNode dimensions
    const nodeWidth = 200;
    const nodeHeight = 100;
    
    // Calculate centers in canvas coordinates first
    const fromCenterCanvas = {
      x: fromNode.position.x + nodeWidth / 2,
      y: fromNode.position.y + nodeHeight / 2
    };
    
    const toCenterCanvas = {
      x: toNode.position.x + nodeWidth / 2,
      y: toNode.position.y + nodeHeight / 2
    };

    // Convert to screen coordinates
    const fromCenter = canvasToScreen(fromCenterCanvas.x, fromCenterCanvas.y);
    const toCenter = canvasToScreen(toCenterCanvas.x, toCenterCanvas.y);

    // Calculate connection points on node edges using screen coordinates
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return { from: fromCenter, to: toCenter };

    const unitX = dx / distance;
    const unitY = dy / distance;
    
    // Scale node radius with viewport zoom
    const nodeRadius = Math.min(nodeWidth, nodeHeight) / 3 * viewport.zoom;
    
    return {
      from: {
        x: fromCenter.x + unitX * nodeRadius,
        y: fromCenter.y + unitY * nodeRadius
      },
      to: {
        x: toCenter.x - unitX * nodeRadius,
        y: toCenter.y - unitY * nodeRadius
      }
    };
  };

  // Generate curved path
  const generatePath = (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Control points for curve - use viewport zoom instead of zoom prop
    const curveFactor = Math.min(distance * 0.3, 100);
    const cp1x = from.x + (dx > 0 ? curveFactor : -curveFactor);
    const cp1y = from.y;
    const cp2x = to.x - (dx > 0 ? curveFactor : -curveFactor);
    const cp2y = to.y;
    
    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  };

  // Generate arrow marker
  const getArrowMarkerId = () => {
    const suffix = isPreview ? 'preview' : isSelected ? 'selected' : isHovered ? 'hovered' : 'default';
    return `arrowhead-${suffix}-${connectionId}`;
  };

  // Get line styles - use viewport zoom for consistent scaling
  const getLineStyles = () => {
    if (isPreview) {
      return {
        stroke: '#94a3b8',
        strokeWidth: 2,
        strokeDasharray: '5,5',
        opacity: 0.7
      };
    }
    
    if (isSelected) {
      return {
        stroke: '#3b82f6',
        strokeWidth: 3,
        opacity: 1
      };
    }
    
    if (isHovered) {
      return {
        stroke: '#1f2937',
        strokeWidth: 2.5,
        opacity: 1
      };
    }
    
    return {
      stroke: '#6b7280',
      strokeWidth: 2,
      opacity: 0.8
    };
  };

  const { from, to } = getConnectionPoints();
  const path = generatePath(from, to);
  const lineStyles = getLineStyles();
  const arrowMarkerId = getArrowMarkerId();

  // Calculate label position (midpoint of curve) - use viewport zoom
  const labelX = (from.x + to.x) / 2;
  const labelY = (from.y + to.y) / 2 - 10;

  return React.createElement('g', {
    className: `connection-line ${className}`,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onClick: () => onClick(connectionId)
  }, [
    // Define arrow markers
    React.createElement('defs', {
      key: 'defs'
    }, [
      React.createElement('marker', {
        key: `marker-${arrowMarkerId}`,
        id: arrowMarkerId,
        viewBox: '0 0 10 10',
        refX: '9',
        refY: '3',
        markerWidth: Math.max(4, 6 * viewport.zoom),
        markerHeight: Math.max(4, 6 * viewport.zoom),
        orient: 'auto',
        markerUnits: 'strokeWidth'
      }, React.createElement('path', {
        d: 'M0,0 L0,6 L9,3 z',
        fill: lineStyles.stroke,
        opacity: lineStyles.opacity
      }))
    ]),

    // Main connection path
    React.createElement('path', {
      key: 'connection-path',
      d: path,
      fill: 'none',
      stroke: lineStyles.stroke,
      strokeWidth: lineStyles.strokeWidth,
      strokeDasharray: lineStyles.strokeDasharray || 'none',
      opacity: lineStyles.opacity,
      markerEnd: `url(#${arrowMarkerId})`,
      vectorEffect: 'non-scaling-stroke',
      className: 'cursor-pointer'
    }),

    // Invisible wider path for easier clicking
    React.createElement('path', {
      key: 'click-target',
      d: path,
      fill: 'none',
      stroke: 'transparent',
      strokeWidth: Math.max(10, lineStyles.strokeWidth * 3),
      className: 'cursor-pointer'
    }),

    // Choice label (only show if zoom is reasonable) - use viewport zoom
    choice && viewport.zoom > 0.3 && React.createElement('g', {
      key: 'choice-label'
    }, [
      // Label background
      React.createElement('rect', {
        key: 'label-bg',
        x: labelX - (choice.text.length * 3),
        y: labelY - 8,
        width: choice.text.length * 6,
        height: 16,
        fill: 'white',
        stroke: lineStyles.stroke,
        strokeWidth: 1,
        rx: 3,
        opacity: isHovered || isSelected ? 1 : 0.9
      }),
      
      // Label text
      React.createElement('text', {
        key: 'label-text',
        x: labelX,
        y: labelY + 2,
        textAnchor: 'middle',
        fontSize: 10,
        fill: '#374151',
        className: 'pointer-events-none select-none'
      }, choice.text.length > 15 ? choice.text.substring(0, 15) + '...' : choice.text),

      // Conditional indicator
      choice.conditions && choice.conditions.length > 0 && React.createElement('circle', {
        key: 'conditional-indicator',
        cx: labelX + (choice.text.length * 3) + 8,
        cy: labelY,
        r: 4,
        fill: '#fbbf24',
        stroke: '#f59e0b',
        strokeWidth: 1,
        title: `${choice.conditions.length} condition(s)`
      }, [
        React.createElement('title', {
          key: 'condition-tooltip'
        }, `${choice.conditions.length} condition(s)`)
      ])
    ]),

    // Delete button (on hover/select) - use viewport zoom
    (isHovered || isSelected) && !isPreview && React.createElement('g', {
      key: 'delete-button'
    }, [
      React.createElement('circle', {
        key: 'delete-bg',
        cx: labelX + 20 * viewport.zoom,
        cy: labelY - 15 * viewport.zoom,
        r: 8 * viewport.zoom,
        fill: '#ef4444',
        stroke: '#dc2626',
        strokeWidth: 1 * viewport.zoom,
        className: 'cursor-pointer',
        onClick: (e) => {
          e.stopPropagation();
          onDelete(connectionId);
        }
      }),
      
      React.createElement('text', {
        key: 'delete-icon',
        x: labelX + 20 * viewport.zoom,
        y: labelY - 11 * viewport.zoom,
        textAnchor: 'middle',
        fontSize: Math.max(8, 10 * viewport.zoom),
        fill: 'white',
        className: 'pointer-events-none select-none'
      }, '×')
    ])
  ]);
});

export default ConnectionLine;
