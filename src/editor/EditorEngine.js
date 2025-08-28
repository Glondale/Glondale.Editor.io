// EditorEngine.js - Central editor state management
// Handles: adventure editing, node management, validation coordination

import { validateAdventure } from '../utils/validation.js';

class EditorEngine {
  constructor() {
    this.adventure = null;
    this.nodes = new Map();
    this.connections = new Map();
    this.selectedNode = null;
    this.clipboardNode = null;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    this.isDirty = false;
    this.listeners = new Map();
  }

  // Event system for UI updates
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

  // Adventure management
  newAdventure(options = {}) {
    this.adventure = {
      id: options.id || `adventure_${Date.now()}`,
      title: options.title || 'Untitled Adventure',
      author: options.author || '',
      version: options.version || '1.0.0',
      description: options.description || '',
      startSceneId: null,
      scenes: [],
      stats: options.stats || []
    };
    
    this.nodes.clear();
    this.connections.clear();
    this.selectedNode = null;
    this.clearHistory();
    this.isDirty = false;
    
    this.emit('adventureChanged', this.adventure);
    this.emit('nodesChanged', this.nodes);
    return this.adventure;
  }

  loadAdventure(adventureData) {
    try {
      const validation = validateAdventure(adventureData);
      if (validation.errors.length > 0) {
        throw new Error(`Invalid adventure: ${validation.errors.join(', ')}`);
      }

      this.adventure = { ...adventureData };
      this.nodes.clear();
      this.connections.clear();
      
      // Load scenes as nodes
      (adventureData.scenes || []).forEach(scene => {
        this.nodes.set(scene.id, {
          ...scene,
          position: scene.position || this.generateNodePosition()
        });
      });

      // Generate connections from choices
      this.regenerateConnections();
      
      this.selectedNode = null;
      this.clearHistory();
      this.isDirty = false;
      
      this.emit('adventureChanged', this.adventure);
      this.emit('nodesChanged', this.nodes);
      this.emit('connectionsChanged', this.connections);
      
      return this.adventure;
    } catch (error) {
      throw new Error(`Failed to load adventure: ${error.message}`);
    }
  }

  // Node operations
  createNode(position, options = {}) {
    const nodeId = this.generateNodeId();
    const node = {
      id: nodeId,
      title: options.title || 'New Scene',
      content: options.content || '',
      choices: options.choices || [],
      onEnter: options.onEnter || [],
      onExit: options.onExit || [],
      tags: options.tags || [],
      position: { ...position },
      ...options
    };
    
    this.saveState();
    this.nodes.set(nodeId, node);
    this.selectedNode = nodeId;
    this.markDirty();
    
    // Set as start scene if this is the first node
    if (this.nodes.size === 1 && !this.adventure.startSceneId) {
      this.adventure.startSceneId = nodeId;
      this.emit('adventureChanged', this.adventure);
    }
    
    this.emit('nodesChanged', this.nodes);
    this.emit('nodeCreated', node);
    
    return node;
  }

  updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    
    this.saveState();
    const updatedNode = { ...node, ...updates };
    this.nodes.set(nodeId, updatedNode);
    this.markDirty();
    
    // Update connections if choices changed
    if (updates.choices) {
      this.regenerateConnections();
      this.emit('connectionsChanged', this.connections);
    }
    
    this.emit('nodesChanged', this.nodes);
    this.emit('nodeUpdated', { nodeId, node: updatedNode, updates });
    
    return updatedNode;
  }

  deleteNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    
    this.saveState();
    this.nodes.delete(nodeId);
    this.markDirty();
    
    // Remove connections
    const connectionsToDelete = [];
    for (const [connId, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        connectionsToDelete.push(connId);
      }
    }
    connectionsToDelete.forEach(connId => this.connections.delete(connId));
    
    // Clear selection if deleted node was selected
    if (this.selectedNode === nodeId) {
      this.selectedNode = null;
    }
    
    // Update start scene if necessary
    if (this.adventure.startSceneId === nodeId) {
      const remainingNodes = Array.from(this.nodes.keys());
      this.adventure.startSceneId = remainingNodes.length > 0 ? remainingNodes[0] : null;
      this.emit('adventureChanged', this.adventure);
    }
    
    this.emit('nodesChanged', this.nodes);
    this.emit('connectionsChanged', this.connections);
    this.emit('nodeDeleted', { nodeId, node });
    
    return true;
  }

  cloneNode(nodeId, offset = { x: 50, y: 50 }) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    
    const clonedNode = {
      ...node,
      id: this.generateNodeId(),
      title: `${node.title} (Copy)`,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      },
      choices: node.choices.map(choice => ({
        ...choice,
        id: this.generateChoiceId()
      }))
    };
    
    this.saveState();
    this.nodes.set(clonedNode.id, clonedNode);
    this.selectedNode = clonedNode.id;
    this.markDirty();
    
    this.regenerateConnections();
    this.emit('nodesChanged', this.nodes);
    this.emit('connectionsChanged', this.connections);
    this.emit('nodeCreated', clonedNode);
    
    return clonedNode;
  }

  // Choice operations
  addChoice(nodeId, choiceData = {}) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    
    const choice = {
      id: this.generateChoiceId(),
      text: choiceData.text || 'New Choice',
      targetSceneId: choiceData.targetSceneId || '',
      conditions: choiceData.conditions || [],
      actions: choiceData.actions || [],
      isHidden: choiceData.isHidden || false,
      isSecret: choiceData.isSecret || false,
      ...choiceData
    };
    
    const updatedChoices = [...node.choices, choice];
    this.updateNode(nodeId, { choices: updatedChoices });
    
    return choice;
  }

  updateChoice(nodeId, choiceId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    
    const updatedChoices = node.choices.map(choice =>
      choice.id === choiceId ? { ...choice, ...updates } : choice
    );
    
    this.updateNode(nodeId, { choices: updatedChoices });
    return updatedChoices.find(c => c.id === choiceId);
  }

  deleteChoice(nodeId, choiceId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    
    const updatedChoices = node.choices.filter(choice => choice.id !== choiceId);
    this.updateNode(nodeId, { choices: updatedChoices });
    
    return true;
  }

  // Connection management
  regenerateConnections() {
    this.connections.clear();
    
    for (const node of this.nodes.values()) {
      node.choices?.forEach(choice => {
        if (choice.targetSceneId && this.nodes.has(choice.targetSceneId)) {
          const connectionId = `${node.id}_${choice.id}_${choice.targetSceneId}`;
          this.connections.set(connectionId, {
            id: connectionId,
            fromNodeId: node.id,
            toNodeId: choice.targetSceneId,
            choiceId: choice.id,
            choice: choice
          });
        }
      });
    }
  }

  // Validation
  validate() {
    const adventureData = this.exportToAdventure();
    const validation = validateAdventure(adventureData);
    
    // Add editor-specific validations
    const editorWarnings = [];
    
    // Check for orphaned nodes
    const connectedNodes = new Set();
    connectedNodes.add(this.adventure.startSceneId);
    
    for (const conn of this.connections.values()) {
      connectedNodes.add(conn.toNodeId);
    }
    
    for (const nodeId of this.nodes.keys()) {
      if (!connectedNodes.has(nodeId) && nodeId !== this.adventure.startSceneId) {
        editorWarnings.push(`Scene "${this.nodes.get(nodeId).title}" is not reachable`);
      }
    }
    
    // Check for dead ends
    for (const node of this.nodes.values()) {
      if (node.choices.length === 0 && node.id !== this.adventure.startSceneId) {
        const hasIncomingConnections = Array.from(this.connections.values())
          .some(conn => conn.toNodeId === node.id);
        if (hasIncomingConnections) {
          editorWarnings.push(`Scene "${node.title}" is a dead end (no choices)`);
        }
      }
    }
    
    return {
      ...validation,
      warnings: [...validation.warnings, ...editorWarnings]
    };
  }

  // Export/Import
  exportToAdventure() {
    return {
      ...this.adventure,
      scenes: Array.from(this.nodes.values()).map(node => ({
        ...node,
        // Remove editor-specific properties
        position: undefined
      })).map(({position, ...scene}) => scene)
    };
  }

  exportToJSON() {
    const adventureData = this.exportToAdventure();
    return JSON.stringify(adventureData, null, 2);
  }

  // History management
  saveState() {
    const state = {
      nodes: new Map(this.nodes),
      connections: new Map(this.connections),
      adventure: { ...this.adventure },
      selectedNode: this.selectedNode,
      timestamp: Date.now()
    };
    
    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    this.history.push(state);
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState(this.history[this.historyIndex]);
      this.markDirty();
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState(this.history[this.historyIndex]);
      this.markDirty();
      return true;
    }
    return false;
  }

  restoreState(state) {
    this.nodes = new Map(state.nodes);
    this.connections = new Map(state.connections);
    this.adventure = { ...state.adventure };
    this.selectedNode = state.selectedNode;
    
    this.emit('adventureChanged', this.adventure);
    this.emit('nodesChanged', this.nodes);
    this.emit('connectionsChanged', this.connections);
    this.emit('selectionChanged', this.selectedNode);
  }

  clearHistory() {
    this.history = [];
    this.historyIndex = -1;
  }

  // Utility methods
  generateNodeId() {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateChoiceId() {
    return `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNodePosition() {
    // Find empty space for new nodes
    const existingPositions = Array.from(this.nodes.values()).map(n => n.position);
    let x = 100;
    let y = 100;
    const step = 250;
    
    while (existingPositions.some(pos => 
      Math.abs(pos.x - x) < 150 && Math.abs(pos.y - y) < 100
    )) {
      x += step;
      if (x > 1000) {
        x = 100;
        y += 200;
      }
    }
    
    return { x, y };
  }

  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this.emit('dirtyChanged', true);
    }
  }

  markClean() {
    if (this.isDirty) {
      this.isDirty = false;
      this.emit('dirtyChanged', false);
    }
  }

  // Getters
  getAdventure() {
    return this.adventure;
  }

  getNodes() {
    return this.nodes;
  }

  getConnections() {
    return this.connections;
  }

  getSelectedNode() {
    return this.selectedNode ? this.nodes.get(this.selectedNode) : null;
  }

  getSelectedNodeId() {
    return this.selectedNode;
  }

  isDirtyState() {
    return this.isDirty;
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }
}

export default EditorEngine;