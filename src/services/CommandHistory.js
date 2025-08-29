// CommandHistory.js - Comprehensive undo/redo system using command pattern
// Handles: command execution, history management, bulk operations, state snapshots

import { logInfo, logWarning, logError } from '../utils/errorLogger.js';

/**
 * Base Command class - Template for all commands
 */
export class Command {
  constructor(description, metadata = {}) {
    this.id = this.generateId();
    this.description = description;
    this.metadata = metadata;
    this.timestamp = Date.now();
    this.executed = false;
    this.canMerge = metadata.mergeable || false;
    this.groupId = metadata.groupId || null;
    this.validation = {
      beforeExecute: metadata.beforeExecute || null,
      beforeUndo: metadata.beforeUndo || null
    };
  }

  /**
   * Execute the command - must be implemented by subclasses
   */
  async execute() {
    if (this.validation.beforeExecute) {
      const isValid = await this.validation.beforeExecute();
      if (!isValid) {
        throw new Error(`Command validation failed: ${this.description}`);
      }
    }
    
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Undo the command - must be implemented by subclasses
   */
  async undo() {
    if (this.validation.beforeUndo) {
      const isValid = await this.validation.beforeUndo();
      if (!isValid) {
        throw new Error(`Command undo validation failed: ${this.description}`);
      }
    }
    
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
   * Merge with another command if possible
   */
  mergeWith(otherCommand) {
    return false; // Override in subclasses that support merging
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
      metadata: this.metadata,
      canMerge: this.canMerge,
      groupId: this.groupId
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
    super(description, { ...metadata, isComposite: true });
    this.commands = commands;
  }

  async execute() {
    if (!this.canExecute()) {
      throw new Error(`Composite command cannot be executed: ${this.description}`);
    }

    const executedCommands = [];
    
    try {
      for (const command of this.commands) {
        await command.execute();
        executedCommands.push(command);
      }
      this.executed = true;
    } catch (error) {
      // Rollback executed commands in reverse order
      for (let i = executedCommands.length - 1; i >= 0; i--) {
        try {
          await executedCommands[i].undo();
        } catch (rollbackError) {
          logWarning('Command rollback failed', { 
            commandId: executedCommands[i].id, 
            error: rollbackError.message 
          });
        }
      }
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

  canExecute() {
    return this.commands.every(cmd => cmd.canExecute());
  }

  canUndo() {
    return this.executed && this.commands.some(cmd => cmd.executed);
  }

  addCommand(command) {
    this.commands.push(command);
  }

  getCommandCount() {
    return this.commands.length;
  }
}

/**
 * Advanced Command History Manager
 */
export class CommandHistory {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 100;
    this.enableSnapshots = options.enableSnapshots !== false;
    this.snapshotInterval = options.snapshotInterval || 10;
    this.enableGrouping = options.enableGrouping !== false;
    this.groupTimeout = options.groupTimeout || 1000; // 1 second
    this.enableMerging = options.enableMerging !== false;
    
    this.history = [];
    this.currentIndex = -1;
    this.snapshots = new Map();
    this.pendingGroup = null;
    this.groupTimer = null;
    this.listeners = new Set();
    this.mergeTimeout = null;
    this.lastCommand = null;
    
    this.stats = {
      totalCommands: 0,
      undoOperations: 0,
      redoOperations: 0,
      snapshotCount: 0,
      groupCount: 0,
      mergedCommands: 0,
      failedCommands: 0
    };

    this.state = {
      isExecuting: false,
      isUndoing: false,
      isRedoing: false
    };
  }

  /**
   * Execute a command and add it to history
   */
  async executeCommand(command) {
    if (this.state.isExecuting) {
      throw new Error('Cannot execute command while another command is executing');
    }

    this.state.isExecuting = true;
    
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

      // Try to merge with last command if possible
      if (this.enableMerging && this.lastCommand && this.lastCommand.canMerge && 
          command.canMerge && this.lastCommand.mergeWith(command)) {
        
        this.stats.mergedCommands++;
        this.notifyListeners('merge', { 
          command, 
          mergedWith: this.lastCommand,
          canUndo: this.canUndo(), 
          canRedo: this.canRedo() 
        });
        
        return this.lastCommand;
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
      this.lastCommand = command;
      this.notifyListeners('execute', { 
        command, 
        canUndo: this.canUndo(), 
        canRedo: this.canRedo(),
        historySize: this.history.length
      });
      
      logInfo('Command executed', { 
        description: command.description, 
        historySize: this.history.length,
        commandId: command.id
      });

      return command;
      
    } catch (error) {
      this.stats.failedCommands++;
      logError('Command execution failed', { 
        description: command.description, 
        error: error.message,
        commandId: command.id
      });
      throw error;
    } finally {
      this.state.isExecuting = false;
    }
  }

  /**
   * Undo the last command
   */
  async undo() {
    if (!this.canUndo()) {
      throw new Error('Nothing to undo');
    }

    if (this.state.isUndoing) {
      throw new Error('Undo operation already in progress');
    }

    this.state.isUndoing = true;
    this.finalizePendingGroup();
    
    try {
      const command = this.history[this.currentIndex];
      await command.undo();
      this.currentIndex--;
      this.stats.undoOperations++;
      
      this.notifyListeners('undo', { 
        command, 
        canUndo: this.canUndo(), 
        canRedo: this.canRedo(),
        currentIndex: this.currentIndex
      });
      
      logInfo('Command undone', { 
        description: command.description, 
        currentIndex: this.currentIndex,
        commandId: command.id
      });

      return command;
      
    } catch (error) {
      logError('Undo failed', { 
        currentIndex: this.currentIndex, 
        error: error.message 
      });
      throw error;
    } finally {
      this.state.isUndoing = false;
    }
  }

  /**
   * Redo the next command
   */
  async redo() {
    if (!this.canRedo()) {
      throw new Error('Nothing to redo');
    }

    if (this.state.isRedoing) {
      throw new Error('Redo operation already in progress');
    }

    this.state.isRedoing = true;
    this.finalizePendingGroup();
    
    try {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      await command.execute();
      this.stats.redoOperations++;
      
      this.notifyListeners('redo', { 
        command, 
        canUndo: this.canUndo(), 
        canRedo: this.canRedo(),
        currentIndex: this.currentIndex
      });
      
      logInfo('Command redone', { 
        description: command.description, 
        currentIndex: this.currentIndex,
        commandId: command.id
      });

      return command;
      
    } catch (error) {
      this.currentIndex--;
      logError('Redo failed', { 
        currentIndex: this.currentIndex, 
        error: error.message 
      });
      throw error;
    } finally {
      this.state.isRedoing = false;
    }
  }

  /**
   * Execute multiple commands as a single operation
   */
  async executeBatch(commands, description = 'Batch Operation') {
    if (!Array.isArray(commands) || commands.length === 0) {
      throw new Error('Invalid commands array for batch execution');
    }

    const batchCommand = new CompositeCommand(description, commands, {
      isBatch: true,
      commandCount: commands.length
    });

    return await this.executeCommand(batchCommand);
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.currentIndex >= 0 && !this.state.isExecuting && !this.state.isUndoing;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1 && !this.state.isExecuting && !this.state.isRedoing;
  }

  /**
   * Get undo description
   */
  getUndoDescription() {
    if (!this.canUndo()) return null;
    const command = this.history[this.currentIndex];
    return command.description;
  }

  /**
   * Get redo description
   */
  getRedoDescription() {
    if (!this.canRedo()) return null;
    const command = this.history[this.currentIndex + 1];
    return command.description;
  }

  /**
   * Create a state snapshot
   */
  createSnapshot(state, description = 'Snapshot') {
    if (!this.enableSnapshots) return null;
    
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
    this.lastCommand = null;
    
    if (this.mergeTimeout) {
      clearTimeout(this.mergeTimeout);
      this.mergeTimeout = null;
    }
    
    this.notifyListeners('clear', { canUndo: false, canRedo: false });
    logInfo('Command history cleared');
  }

  /**
   * Get complete history information
   */
  getHistory() {
    return {
      commands: this.history.map((cmd, index) => ({
        ...cmd.getInfo(),
        isCurrent: index === this.currentIndex,
        canExecute: index > this.currentIndex,
        index
      })),
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      stats: this.stats,
      state: this.state
    };
  }

  /**
   * Get commands that can be undone (for UI display)
   */
  getUndoableCommands(limit = 10) {
    if (this.currentIndex < 0) return [];
    
    const start = Math.max(0, this.currentIndex - limit + 1);
    return this.history.slice(start, this.currentIndex + 1).reverse().map((cmd, index) => ({
      ...cmd.getInfo(),
      undoIndex: this.currentIndex - index
    }));
  }

  /**
   * Get commands that can be redone (for UI display)
   */
  getRedoableCommands(limit = 10) {
    if (this.currentIndex >= this.history.length - 1) return [];
    
    const end = Math.min(this.history.length, this.currentIndex + limit + 1);
    return this.history.slice(this.currentIndex + 1, end).map((cmd, index) => ({
      ...cmd.getInfo(),
      redoIndex: this.currentIndex + index + 1
    }));
  }

  /**
   * Jump to specific point in history
   */
  async jumpToIndex(targetIndex) {
    if (targetIndex < -1 || targetIndex >= this.history.length) {
      throw new Error(`Invalid history index: ${targetIndex}`);
    }

    if (targetIndex === this.currentIndex) return;

    const isUndo = targetIndex < this.currentIndex;
    const operations = [];

    if (isUndo) {
      // Collect undo operations
      for (let i = this.currentIndex; i > targetIndex; i--) {
        operations.push({ type: 'undo', command: this.history[i] });
      }
    } else {
      // Collect redo operations
      for (let i = this.currentIndex + 1; i <= targetIndex; i++) {
        operations.push({ type: 'redo', command: this.history[i] });
      }
    }

    // Execute operations
    for (const operation of operations) {
      if (operation.type === 'undo') {
        await this.undo();
      } else {
        await this.redo();
      }
    }
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
      // Note: Snapshot creation requires external state - implement in caller
      this.notifyListeners('snapshotNeeded', { index: this.currentIndex });
    }
  }

  shouldGroupCommand(command) {
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
      // Handle Map objects specially
      if (state instanceof Map) {
        const cloned = new Map();
        for (const [key, value] of state) {
          cloned.set(key, this.cloneState(value));
        }
        return cloned;
      }
      
      // Handle Arrays
      if (Array.isArray(state)) {
        return state.map(item => this.cloneState(item));
      }
      
      // Handle plain objects
      if (state && typeof state === 'object' && state.constructor === Object) {
        const cloned = {};
        for (const [key, value] of Object.entries(state)) {
          cloned[key] = this.cloneState(value);
        }
        return cloned;
      }
      
      // Primitive values
      return state;
    } catch (error) {
      logWarning('State cloning failed', { error: error.message });
      return JSON.parse(JSON.stringify(state));
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

  /**
   * Get performance and usage statistics
   */
  getStats() {
    const hitRate = this.stats.totalCommands > 0 ? 
      (this.stats.totalCommands - this.stats.failedCommands) / this.stats.totalCommands : 1;
    
    return {
      ...this.stats,
      successRate: Math.round(hitRate * 100),
      historySize: this.history.length,
      currentPosition: this.currentIndex + 1,
      snapshotSize: this.snapshots.size,
      memoryUsage: this.calculateMemoryUsage(),
      averageCommandsPerGroup: this.stats.groupCount > 0 ? 
        Math.round(this.stats.totalCommands / this.stats.groupCount * 100) / 100 : 0
    };
  }

  calculateMemoryUsage() {
    // Rough estimate of memory usage
    let size = 0;
    size += this.history.length * 1000; // Base command size
    size += this.snapshots.size * 10000; // Snapshot size estimate
    return Math.round(size / 1024); // Return in KB
  }
}

// Export singleton instance for global use
export const commandHistory = new CommandHistory({
  maxHistorySize: 200,
  enableSnapshots: true,
  snapshotInterval: 5,
  enableGrouping: true,
  groupTimeout: 2000,
  enableMerging: true
});

export default CommandHistory;