// EditorEngine.js - Central editor state management
// Handles: adventure editing, node management, validation coordination

import { validateAdventure } from '../utils/validation.js';
import { 
  commandHistory, 
  CreateNodeCommand, 
  DeleteNodeCommand, 
  UpdateNodeCommand, 
  CreateConnectionCommand 
} from './CommandSystem.js';
import { logInfo, logWarning, logError } from '../utils/errorLogger.js';

class EditorEngine {
  constructor() {
    this.adventure = null;
    this.nodes = new Map();
    this.connections = new Map();
    this.selectedNode = null;
    this.clipboardNode = null;
    this.isDirty = false;
    this.listeners = new Map();
    this.commandHistory = commandHistory;
    this.snapshots = new Map();
    
    // Listen to command history events
    this.commandHistory.addListener(this.handleCommandHistoryEvent.bind(this));
    
    // Initialize command system
    this.initializeCommandSystem();
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

  // Command system integration
  initializeCommandSystem() {
    // Create initial snapshot
    this.createSnapshot('Initial state');
    
    logInfo('Command system initialized', {
      maxHistorySize: this.commandHistory.maxHistorySize,
      snapshotsEnabled: this.commandHistory.enableSnapshots
    });
  }

  handleCommandHistoryEvent(event) {
    this.markDirty();
    this.emit('commandHistory', event);
    
    // Create snapshots periodically
    if (event.type === 'execute' && this.commandHistory.history.length % 5 === 0) {
      this.createSnapshot('Auto-snapshot');
    }
  }

  // Command execution methods
  async executeCommand(command) {
    try {
      await this.commandHistory.executeCommand(command);
      this.markDirty();
      return command;
    } catch (error) {
      logError('Command execution failed', { 
        command: command.description, 
        error: error.message 
      });
      throw error;
    }
  }

  async undo() {
    try {
      const command = await this.commandHistory.undo();
      this.emit('undo', { command });
      return command;
    } catch (error) {
      logWarning('Undo failed', { error: error.message });
      throw error;
    }
  }

  async redo() {
    try {
      const command = await this.commandHistory.redo();
      this.emit('redo', { command });
      return command;
    } catch (error) {
      logWarning('Redo failed', { error: error.message });
      throw error;
    }
  }

  canUndo() {
    return this.commandHistory.canUndo();
  }

  canRedo() {
    return this.commandHistory.canRedo();
  }

  getUndoDescription() {
    return this.commandHistory.getUndoDescription();
  }

  getRedoDescription() {
    return this.commandHistory.getRedoDescription();
  }

  // State snapshot management
  createSnapshot(description = 'Snapshot') {
    const state = {
      adventure: this.adventure ? { ...this.adventure } : null,
      nodes: new Map(this.nodes),
      connections: new Map(this.connections),
      selectedNode: this.selectedNode,
      timestamp: Date.now()
    };
    
    const snapshotId = this.commandHistory.createSnapshot(state, description);
    this.snapshots.set(snapshotId, state);
    
    return snapshotId;
  }

  restoreSnapshot(snapshotId) {
    const snapshot = this.commandHistory.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    this.adventure = snapshot.state.adventure;
    this.nodes = new Map(snapshot.state.nodes);
    this.connections = new Map(snapshot.state.connections);
    this.selectedNode = snapshot.state.selectedNode;
    
    this.emit('snapshotRestored', { snapshotId, description: snapshot.description });
    this.markDirty();
  }

  clearCommandHistory() {
    this.commandHistory.clear();
    this.snapshots.clear();
    this.emit('historyCleared');
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

  // Node operations with command pattern
  async createNode(position, options = {}) {
    const nodeId = this.generateNodeId();
    const nodeData = {
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
    
    const command = new CreateNodeCommand(
      nodeData,
      position,
      (node, pos) => this._addNodeInternal(node, pos),
      (nodeId) => this._removeNodeInternal(nodeId)
    );
    
    await this.executeCommand(command);
    this.selectedNode = nodeId;
    
    // Set as start scene if this is the first node
    if (this.nodes.size === 1 && !this.adventure.startSceneId) {
      this.adventure.startSceneId = nodeId;
      this.emit('adventureChanged', this.adventure);
    }
    
    return this.nodes.get(nodeId);
  }

  // Internal method for direct node addition (used by commands)
  _addNodeInternal(nodeData, position) {
    this.nodes.set(nodeData.id, nodeData);
    this.emit('nodesChanged', this.nodes);
    this.emit('nodeCreated', nodeData);
  }

  async updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    
    // Import CompositeCommand if not already imported
    const { CompositeCommand } = await import('./CommandSystem.js');
    
    // Create commands for each property being updated
    const commands = [];
    for (const [property, newValue] of Object.entries(updates)) {
      const oldValue = node[property];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const command = new UpdateNodeCommand(
          nodeId,
          property,
          oldValue,
          newValue,
          (id, prop, value) => this._updateNodePropertyInternal(id, prop, value)
        );
        commands.push(command);
      }
    }
    
    if (commands.length === 0) return node;
    
    // Execute as a single command or composite command
    if (commands.length === 1) {
      await this.executeCommand(commands[0]);
    } else {
      const compositeCommand = new CompositeCommand(
        `Update ${nodeId}`,
        commands,
        { nodeId, type: 'node_update' }
      );
      await this.executeCommand(compositeCommand);
    }
    
    return this.nodes.get(nodeId);
  }

  // Internal method for direct property updates (used by commands)
  _updateNodePropertyInternal(nodeId, property, value) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const updatedNode = { ...node, [property]: value };
    this.nodes.set(nodeId, updatedNode);
    
    // Update connections if choices changed
    if (property === 'choices') {
      this.regenerateConnections();
      this.emit('connectionsChanged', this.connections);
    }
    
    this.emit('nodesChanged', this.nodes);
    this.emit('nodeUpdated', { nodeId, node: updatedNode, updates: { [property]: value } });
  }

  async deleteNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    
    // Collect connections to be removed
    const connections = [];
    for (const [connId, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        connections.push({ id: connId, ...conn });
      }
    }
    
    const command = new DeleteNodeCommand(
      nodeId,
      { ...node },
      connections,
      (id) => this._removeNodeInternal(id),
      (nodeData, position) => this._addNodeInternal(nodeData, position),
      (conns) => this._restoreConnectionsInternal(conns)
    );
    
    await this.executeCommand(command);
    
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
    
    return true;
  }

  // Internal method for direct node removal (used by commands)
  _removeNodeInternal(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    this.nodes.delete(nodeId);
    
    // Remove connections
    const connectionsToDelete = [];
    for (const [connId, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        connectionsToDelete.push(connId);
      }
    }
    connectionsToDelete.forEach(connId => this.connections.delete(connId));
    
    this.emit('nodesChanged', this.nodes);
    this.emit('connectionsChanged', this.connections);
    this.emit('nodeDeleted', { nodeId, node });
  }

  // Internal method for restoring connections (used by commands)
  _restoreConnectionsInternal(connections) {
    for (const conn of connections) {
      this.connections.set(conn.id, conn);
    }
    this.emit('connectionsChanged', this.connections);
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

  // History management (now handled by command system)
  // Legacy method kept for compatibility - now creates snapshots
  saveState() {
    this.createSnapshot('Legacy save state');
  }

  // Legacy undo/redo methods - now delegate to command system
  async legacyUndo() {
    return await this.undo();
  }

  async legacyRedo() {
    return await this.redo();
  }

  // Legacy restore state - now handled by snapshot system
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

  // Legacy clear history - now delegates to command system
  clearHistory() {
    this.clearCommandHistory();
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