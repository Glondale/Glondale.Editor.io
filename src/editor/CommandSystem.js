// CommandSystem.js - Command pattern implementation for undo/redo functionality
import { logInfo, logWarning, logError } from '../utils/errorLogger.js';

/**
 * Command System - Implements command pattern for undo/redo functionality
 * 
 * Features:
 * - Command pattern with execute/undo operations
 * - Command history with configurable limits
 * - Command grouping and batching
 * - State snapshots for complex operations
 * - Memory-efficient history management
 * - Command validation and error recovery
 */

/**
 * Base Command interface
 */
export class Command {
  constructor(description, metadata = {}) {
    this.id = this.generateId();
    this.description = description;
    this.metadata = metadata;
    this.timestamp = Date.now();
    this.executed = false;
  }

  /**
   * Execute the command - must be implemented by subclasses
   */
  async execute() {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Undo the command - must be implemented by subclasses
   */
  async undo() {
    throw new Error('undo() must be implemented by subclass');
  }

  /**
   * Validate if the command can be executed
   */
  canExecute() {
    return true;
  }

  /**
   * Validate if the command can be undone
   */
  canUndo() {
    return this.executed;
  }

  /**
   * Get command info for UI display
   */
  getInfo() {
    return {
      id: this.id,
      description: this.description,
      timestamp: this.timestamp,
      executed: this.executed,
      metadata: this.metadata
    };
  }

  generateId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Composite Command for grouping multiple commands
 */
export class CompositeCommand extends Command {
  constructor(description, commands = [], metadata = {}) {
    super(description, metadata);
    this.commands = commands;
  }

  async execute() {
    try {
      for (const command of this.commands) {
        await command.execute();
      }
      this.executed = true;
    } catch (error) {
      // If execution fails, try to undo any completed commands
      await this.rollback();
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      // Undo commands in reverse order
      for (let i = this.commands.length - 1; i >= 0; i--) {
        const command = this.commands[i];
        if (command.executed) {
          await command.undo();
        }
      }
      this.executed = false;
    } catch (error) {
      logError('Composite command undo failed', { 
        commandId: this.id, 
        error: error.message 
      });
      throw error;
    }
  }

  async rollback() {
    // Undo any executed commands in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const command = this.commands[i];
      if (command.executed) {
        try {
          await command.undo();
        } catch (error) {
          logWarning('Command rollback failed', { 
            commandId: command.id, 
            error: error.message 
          });
        }
      }
    }
  }

  canExecute() {
    return this.commands.every(cmd => cmd.canExecute());
  }

  canUndo() {
    return this.executed && this.commands.some(cmd => cmd.executed);
  }

  addCommand(command) {
    this.commands.push(command);
  }
}

/**
 * Command History Manager
 */
export class CommandHistory {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 50;
    this.enableSnapshots = options.enableSnapshots !== false;
    this.snapshotInterval = options.snapshotInterval || 10;
    this.enableGrouping = options.enableGrouping !== false;
    this.groupTimeout = options.groupTimeout || 1000; // 1 second
    
    this.history = [];
    this.currentIndex = -1;
    this.snapshots = new Map();
    this.pendingGroup = null;
    this.groupTimer = null;
    this.listeners = new Set();
    
    this.stats = {
      totalCommands: 0,
      undoOperations: 0,
      redoOperations: 0,
      snapshotCount: 0,
      groupCount: 0
    };
  }

  /**
   * Execute a command and add it to history
   */
  async executeCommand(command) {
    try {
      // Validate command
      if (!command.canExecute()) {
        throw new Error(`Command cannot be executed: ${command.description}`);
      }

      // Clear any redo history when new command is executed
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.clearSnapshotsAfter(this.currentIndex);
      }

      // Execute the command
      await command.execute();
      
      // Handle command grouping
      if (this.enableGrouping && this.shouldGroupCommand(command)) {
        this.addToGroup(command);
      } else {
        this.finalizePendingGroup();
        this.addCommandToHistory(command);
      }

      this.stats.totalCommands++;
      this.notifyListeners('execute', { command, canUndo: this.canUndo(), canRedo: this.canRedo() });
      
      logInfo('Command executed', { 
        description: command.description, 
        historySize: this.history.length 
      });

      return command;
    } catch (error) {
      logError('Command execution failed', { 
        description: command.description, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Undo the last command
   */
  async undo() {
    if (!this.canUndo()) {
      throw new Error('Nothing to undo');
    }

    this.finalizePendingGroup();
    
    try {
      const command = this.history[this.currentIndex];
      await command.undo();
      this.currentIndex--;
      this.stats.undoOperations++;
      
      this.notifyListeners('undo', { command, canUndo: this.canUndo(), canRedo: this.canRedo() });
      
      logInfo('Command undone', { 
        description: command.description, 
        currentIndex: this.currentIndex 
      });

      return command;
    } catch (error) {
      logError('Undo failed', { 
        currentIndex: this.currentIndex, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Redo the next command
   */
  async redo() {
    if (!this.canRedo()) {
      throw new Error('Nothing to redo');
    }

    this.finalizePendingGroup();
    
    try {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      await command.execute();
      this.stats.redoOperations++;
      
      this.notifyListeners('redo', { command, canUndo: this.canUndo(), canRedo: this.canRedo() });
      
      logInfo('Command redone', { 
        description: command.description, 
        currentIndex: this.currentIndex 
      });

      return command;
    } catch (error) {
      this.currentIndex--;
      logError('Redo failed', { 
        currentIndex: this.currentIndex, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get undo description
   */
  getUndoDescription() {
    if (!this.canUndo()) return null;
    return this.history[this.currentIndex].description;
  }

  /**
   * Get redo description
   */
  getRedoDescription() {
    if (!this.canRedo()) return null;
    return this.history[this.currentIndex + 1].description;
  }

  /**
   * Create a state snapshot
   */
  createSnapshot(state, description = 'Snapshot') {
    const snapshotId = `snapshot_${Date.now()}_${this.currentIndex}`;
    this.snapshots.set(snapshotId, {
      state: this.cloneState(state),
      description,
      index: this.currentIndex,
      timestamp: Date.now()
    });
    this.stats.snapshotCount++;
    
    // Limit snapshot count
    if (this.snapshots.size > this.maxHistorySize) {
      const oldest = Array.from(this.snapshots.keys())[0];
      this.snapshots.delete(oldest);
    }
    
    return snapshotId;
  }

  /**
   * Restore from snapshot
   */
  getSnapshot(snapshotId) {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Clear all history
   */
  clear() {
    this.finalizePendingGroup();
    this.history = [];
    this.currentIndex = -1;
    this.snapshots.clear();
    this.notifyListeners('clear', { canUndo: false, canRedo: false });
    logInfo('Command history cleared');
  }

  /**
   * Get history information
   */
  getHistory() {
    return {
      commands: this.history.map((cmd, index) => ({
        ...cmd.getInfo(),
        isCurrent: index === this.currentIndex,
        canExecute: index > this.currentIndex
      })),
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      stats: this.stats
    };
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Private methods

  addCommandToHistory(command) {
    this.history.push(command);
    this.currentIndex++;
    
    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      const removed = this.history.shift();
      this.currentIndex--;
      this.clearSnapshotsFor(removed);
    }

    // Create snapshot if needed
    if (this.enableSnapshots && this.currentIndex % this.snapshotInterval === 0) {
      // Note: Snapshot creation requires external state - implement in EditorEngine
    }
  }

  shouldGroupCommand(command) {
    // Group similar commands that happen within the timeout period
    return command.metadata.groupable !== false && 
           this.pendingGroup && 
           this.pendingGroup.metadata.groupType === command.metadata.groupType;
  }

  addToGroup(command) {
    if (!this.pendingGroup) {
      this.startNewGroup(command);
      return;
    }

    this.pendingGroup.addCommand(command);
    
    // Reset group timer
    if (this.groupTimer) {
      clearTimeout(this.groupTimer);
    }
    
    this.groupTimer = setTimeout(() => {
      this.finalizePendingGroup();
    }, this.groupTimeout);
  }

  startNewGroup(command) {
    this.finalizePendingGroup();
    
    this.pendingGroup = new CompositeCommand(
      `Group: ${command.description}`,
      [command],
      { groupType: command.metadata.groupType, isGroup: true }
    );
    
    this.groupTimer = setTimeout(() => {
      this.finalizePendingGroup();
    }, this.groupTimeout);
  }

  finalizePendingGroup() {
    if (this.groupTimer) {
      clearTimeout(this.groupTimer);
      this.groupTimer = null;
    }

    if (this.pendingGroup) {
      if (this.pendingGroup.commands.length === 1) {
        // Single command - add directly
        this.addCommandToHistory(this.pendingGroup.commands[0]);
      } else {
        // Multiple commands - add as group
        this.addCommandToHistory(this.pendingGroup);
        this.stats.groupCount++;
      }
      this.pendingGroup = null;
    }
  }

  clearSnapshotsAfter(index) {
    const toRemove = [];
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.index > index) {
        toRemove.push(id);
      }
    }
    toRemove.forEach(id => this.snapshots.delete(id));
  }

  clearSnapshotsFor(command) {
    const toRemove = [];
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.commandId === command.id) {
        toRemove.push(id);
      }
    }
    toRemove.forEach(id => this.snapshots.delete(id));
  }

  cloneState(state) {
    try {
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      logWarning('State cloning failed', { error: error.message });
      return state;
    }
  }

  notifyListeners(type, data) {
    for (const listener of this.listeners) {
      try {
        listener({ type, ...data });
      } catch (error) {
        logWarning('Command history listener error', { error: error.message });
      }
    }
  }
}

// Specific command implementations for editor operations

/**
 * Node creation command
 */
export class CreateNodeCommand extends Command {
  constructor(nodeData, position, addNodeFunction, removeNodeFunction) {
    super(`Create ${nodeData.type || 'node'}: ${nodeData.title || 'Untitled'}`, {
      type: 'create_node',
      nodeId: nodeData.id,
      groupType: 'node_operations'
    });
    
    this.nodeData = nodeData;
    this.position = position;
    this.addNode = addNodeFunction;
    this.removeNode = removeNodeFunction;
  }

  async execute() {
    this.addNode(this.nodeData, this.position);
    this.executed = true;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.removeNode(this.nodeData.id);
    this.executed = false;
  }
}

/**
 * Node deletion command
 */
export class DeleteNodeCommand extends Command {
  constructor(nodeId, nodeData, connections, removeNodeFunction, addNodeFunction, restoreConnectionsFunction) {
    super(`Delete node: ${nodeData.title || 'Untitled'}`, {
      type: 'delete_node',
      nodeId,
      groupType: 'node_operations'
    });
    
    this.nodeId = nodeId;
    this.nodeData = nodeData;
    this.connections = connections;
    this.removeNode = removeNodeFunction;
    this.addNode = addNodeFunction;
    this.restoreConnections = restoreConnectionsFunction;
  }

  async execute() {
    this.removeNode(this.nodeId);
    this.executed = true;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.addNode(this.nodeData, this.nodeData.position);
    if (this.connections.length > 0) {
      this.restoreConnections(this.connections);
    }
    this.executed = false;
  }
}

/**
 * Node property update command
 */
export class UpdateNodeCommand extends Command {
  constructor(nodeId, property, oldValue, newValue, updateFunction) {
    super(`Update ${property}: ${nodeId}`, {
      type: 'update_node',
      nodeId,
      property,
      groupType: `update_${property}`,
      groupable: true
    });
    
    this.nodeId = nodeId;
    this.property = property;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.updateFunction = updateFunction;
  }

  async execute() {
    this.updateFunction(this.nodeId, this.property, this.newValue);
    this.executed = true;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.updateFunction(this.nodeId, this.property, this.oldValue);
    this.executed = false;
  }
}

/**
 * Connection creation command
 */
export class CreateConnectionCommand extends Command {
  constructor(fromNodeId, toNodeId, choiceId, connectionData, addConnectionFunction, removeConnectionFunction) {
    super(`Connect: ${fromNodeId} → ${toNodeId}`, {
      type: 'create_connection',
      fromNodeId,
      toNodeId,
      choiceId,
      groupType: 'connection_operations'
    });
    
    this.fromNodeId = fromNodeId;
    this.toNodeId = toNodeId;
    this.choiceId = choiceId;
    this.connectionData = connectionData;
    this.addConnection = addConnectionFunction;
    this.removeConnection = removeConnectionFunction;
  }

  async execute() {
    this.addConnection(this.connectionData);
    this.executed = true;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.removeConnection(this.connectionData.id);
    this.executed = false;
  }
}

// Export singleton command history instance
export const commandHistory = new CommandHistory({
  maxHistorySize: 100,
  enableSnapshots: true,
  snapshotInterval: 5,
  enableGrouping: true,
  groupTimeout: 2000
});

export default CommandHistory;