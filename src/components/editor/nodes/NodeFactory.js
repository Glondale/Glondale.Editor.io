// NodeFactory.js - Node creation utilities and helpers
// Handles: node creation, positioning, ID generation, auto-layout algorithms

export const NodeFactory = {
  // Generate unique node ID
  generateNodeId() {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate unique choice ID
  generateChoiceId() {
    return `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate unique connection ID
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Create new scene node with default properties
  createSceneNode(position = { x: 0, y: 0 }, options = {}) {
    return {
      id: options.id || this.generateNodeId(),
      title: options.title || 'New Scene',
      content: options.content || '',
      choices: options.choices || [],
      onEnter: options.onEnter || [],
      onExit: options.onExit || [],
      tags: options.tags || [],
      position: { ...position },
      ...options
    };
  },

  // Create new choice with default properties
  createChoice(targetSceneId = null, options = {}) {
    return {
      id: options.id || this.generateChoiceId(),
      text: options.text || 'New Choice',
      targetSceneId: targetSceneId,
      conditions: options.conditions || [],
      actions: options.actions || [],
      isHidden: options.isHidden || false,
      isSecret: options.isSecret || false,
      requirements: options.requirements || [],
      ...options
    };
  },

  // Create connection between nodes
  createConnection(fromNodeId, toNodeId, choiceId, options = {}) {
    return {
      id: options.id || this.generateConnectionId(),
      fromNodeId,
      toNodeId,
      choiceId,
      ...options
    };
  },

  // Find optimal position for new node
  findOptimalPosition(existingNodes, canvasViewport = { x: 0, y: 0, zoom: 1 }) {
    const nodeWidth = 200;
    const nodeHeight = 120;
    const padding = 50;
    
    if (existingNodes.size === 0) {
      // First node at canvas center
      return {
        x: Math.max(50, -canvasViewport.x / canvasViewport.zoom + 100),
        y: Math.max(50, -canvasViewport.y / canvasViewport.zoom + 100)
      };
    }

    // Try positions in expanding spiral from canvas center
    const centerX = -canvasViewport.x / canvasViewport.zoom + 200;
    const centerY = -canvasViewport.y / canvasViewport.zoom + 200;
    
    const step = nodeWidth + padding;
    let radius = step;
    const maxRadius = step * 10;
    
    while (radius < maxRadius) {
      const positions = this.generateCirclePositions(centerX, centerY, radius, 8);
      
      for (const pos of positions) {
        if (this.isPositionFree(pos, existingNodes, nodeWidth, nodeHeight, padding)) {
          return pos;
        }
      }
      
      radius += step;
    }

    // Fallback: grid position
    return this.findGridPosition(existingNodes, nodeWidth, nodeHeight, padding);
  },

  // Generate positions in a circle
  generateCirclePositions(centerX, centerY, radius, count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count;
      positions.push({
        x: Math.round(centerX + radius * Math.cos(angle)),
        y: Math.round(centerY + radius * Math.sin(angle))
      });
    }
    return positions;
  },

  // Check if position is free of other nodes
  isPositionFree(position, existingNodes, nodeWidth, nodeHeight, padding) {
    for (const node of existingNodes.values()) {
      const distance = Math.sqrt(
        Math.pow(position.x - node.position.x, 2) + 
        Math.pow(position.y - node.position.y, 2)
      );
      
      const minDistance = Math.max(nodeWidth, nodeHeight) + padding;
      if (distance < minDistance) {
        return false;
      }
    }
    return true;
  },

  // Find position in grid layout
  findGridPosition(existingNodes, nodeWidth, nodeHeight, padding) {
    const step = nodeWidth + padding;
    let x = 100;
    let y = 100;
    
    while (true) {
      if (this.isPositionFree({ x, y }, existingNodes, nodeWidth, nodeHeight, padding)) {
        return { x, y };
      }
      
      x += step;
      if (x > step * 10) {
        x = 100;
        y += step;
      }
    }
  },

  // Auto-layout nodes using force-directed algorithm
  autoLayoutNodes(nodes, connections, options = {}) {
    const {
      width = 1200,
      height = 800,
      iterations = 100,
      springLength = 200,
      springStrength = 0.1,
      repulsionStrength = 1000,
      damping = 0.9
    } = options;

    const nodeArray = Array.from(nodes.values());
    const positions = new Map();
    const velocities = new Map();

    // Initialize positions and velocities
    nodeArray.forEach(node => {
      positions.set(node.id, { 
        x: node.position.x || Math.random() * width, 
        y: node.position.y || Math.random() * height 
      });
      velocities.set(node.id, { x: 0, y: 0 });
    });

    // Run simulation
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map();
      
      // Initialize forces
      nodeArray.forEach(node => {
        forces.set(node.id, { x: 0, y: 0 });
      });

      // Repulsion forces between all nodes
      for (let i = 0; i < nodeArray.length; i++) {
        for (let j = i + 1; j < nodeArray.length; j++) {
          const node1 = nodeArray[i];
          const node2 = nodeArray[j];
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
      connections.forEach(conn => {
        const fromPos = positions.get(conn.fromNodeId);
        const toPos = positions.get(conn.toNodeId);
        
        if (fromPos && toPos) {
          const dx = toPos.x - fromPos.x;
          const dy = toPos.y - fromPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const force = springStrength * (distance - springLength);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const fromForce = forces.get(conn.fromNodeId);
          const toForce = forces.get(conn.toNodeId);
          if (fromForce) {
            fromForce.x += fx;
            fromForce.y += fy;
          }
          if (toForce) {
            toForce.x -= fx;
            toForce.y -= fy;
          }
        }
      });

      // Update positions
      nodeArray.forEach(node => {
        const pos = positions.get(node.id);
        const vel = velocities.get(node.id);
        const force = forces.get(node.id);
        
        vel.x = (vel.x + force.x) * damping;
        vel.y = (vel.y + force.y) * damping;
        
        pos.x += vel.x;
        pos.y += vel.y;
        
        // Keep within bounds
        pos.x = Math.max(50, Math.min(width - 50, pos.x));
        pos.y = Math.max(50, Math.min(height - 50, pos.y));
      });
    }

    // Return updated node positions
    const updatedNodes = new Map();
    nodeArray.forEach(node => {
      const pos = positions.get(node.id);
      updatedNodes.set(node.id, {
        ...node,
        position: { x: Math.round(pos.x), y: Math.round(pos.y) }
      });
    });

    return updatedNodes;
  },

  // Create adventure template with sample nodes
  createSampleAdventure() {
    const startNode = this.createSceneNode({ x: 100, y: 100 }, {
      id: 'start_scene',
      title: 'The Beginning',
      content: 'You stand at the entrance of a mysterious forest. The path splits in two directions.',
      choices: [
        this.createChoice('forest_left', {
          text: 'Take the left path',
          id: 'choice_left'
        }),
        this.createChoice('forest_right', {
          text: 'Take the right path',
          id: 'choice_right'
        })
      ]
    });

    const leftNode = this.createSceneNode({ x: 50, y: 300 }, {
      id: 'forest_left',
      title: 'Dark Grove',
      content: 'The left path leads to a dark grove filled with ancient trees.',
      choices: [
        this.createChoice('start_scene', {
          text: 'Return to the beginning',
          id: 'choice_return_left'
        })
      ]
    });

    const rightNode = this.createSceneNode({ x: 300, y: 300 }, {
      id: 'forest_right',
      title: 'Sunny Meadow',
      content: 'The right path opens into a beautiful sunny meadow.',
      choices: [
        this.createChoice('start_scene', {
          text: 'Return to the beginning',
          id: 'choice_return_right'
        })
      ]
    });

    return {
      nodes: new Map([
        [startNode.id, startNode],
        [leftNode.id, leftNode],
        [rightNode.id, rightNode]
      ]),
      startSceneId: startNode.id
    };
  },

  // Validate node structure
  validateNode(node) {
    const errors = [];
    const warnings = [];

    if (!node.id) errors.push('Node missing ID');
    if (!node.title?.trim()) warnings.push('Node missing title');
    if (!node.content?.trim()) warnings.push('Node has no content');
    
    if (node.choices) {
      node.choices.forEach((choice, index) => {
        if (!choice.id) errors.push(`Choice ${index + 1} missing ID`);
        if (!choice.text?.trim()) errors.push(`Choice ${index + 1} missing text`);
        if (!choice.targetSceneId) warnings.push(`Choice ${index + 1} has no target`);
      });
    }

    return { errors, warnings };
  },

  // Deep clone node (for copying)
  cloneNode(node, newPosition) {
    return {
      ...node,
      id: this.generateNodeId(),
      position: newPosition || { 
        x: node.position.x + 50, 
        y: node.position.y + 50 
      },
      choices: node.choices?.map(choice => ({
        ...choice,
        id: this.generateChoiceId()
      })) || []
    };
  }
};