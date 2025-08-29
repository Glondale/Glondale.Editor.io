// EditorCommands.js - Specific command implementations for editor operations
// Handles: All editor state changes through command pattern

import { Command, CompositeCommand } from '../services/CommandHistory.js';
import { logInfo, logWarning, logError } from '../utils/errorLogger.js';

/**
 * Node creation command
 */
export class CreateNodeCommand extends Command {
  constructor(nodeData, position, editorState, callbacks) {
    super(`Create ${nodeData.type || 'node'}: ${nodeData.title || 'Untitled'}`, {
      type: 'create_node',
      nodeId: nodeData.id,
      groupType: 'node_operations',
      category: 'structure'
    });
    
    this.nodeData = { ...nodeData };
    this.position = { ...position };
    this.editorState = editorState;
    this.callbacks = callbacks;
    this.createdNodeId = null;
  }

  async execute() {
    try {
      // Generate unique ID if not provided
      if (!this.nodeData.id) {
        this.nodeData.id = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const nodeToCreate = {
        ...this.nodeData,
        position: this.position,
        created: Date.now(),
        modified: Date.now()
      };

      // Call the callback to actually create the node
      await this.callbacks.onNodeCreate(this.nodeData.id, nodeToCreate);
      
      this.createdNodeId = this.nodeData.id;
      this.executed = true;
      
      logInfo('Node created via command', { nodeId: this.nodeData.id });
      
    } catch (error) {
      logError('CreateNodeCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo() || !this.createdNodeId) return;

    try {
      await this.callbacks.onNodeDelete(this.createdNodeId);
      this.executed = false;
      
      logInfo('Node creation undone', { nodeId: this.createdNodeId });
      
    } catch (error) {
      logError('CreateNodeCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.callbacks.onNodeCreate && this.nodeData;
  }
}

/**
 * Node deletion command
 */
export class DeleteNodeCommand extends Command {
  constructor(nodeId, editorState, callbacks) {
    const nodeData = editorState.nodes.get(nodeId);
    super(`Delete node: ${nodeData?.title || 'Untitled'}`, {
      type: 'delete_node',
      nodeId,
      groupType: 'node_operations',
      category: 'structure'
    });
    
    this.nodeId = nodeId;
    this.nodeData = nodeData ? { ...nodeData } : null;
    this.affectedConnections = [];
    this.editorState = editorState;
    this.callbacks = callbacks;
  }

  async execute() {
    if (!this.nodeData) {
      throw new Error(`Node ${this.nodeId} not found for deletion`);
    }

    try {
      // Store connections that will be affected
      this.affectedConnections = [];
      for (const [connId, connection] of this.editorState.connections) {
        if (connection.fromNodeId === this.nodeId || connection.toNodeId === this.nodeId) {
          this.affectedConnections.push({ id: connId, ...connection });
        }
      }

      // Delete the node
      await this.callbacks.onNodeDelete(this.nodeId);
      this.executed = true;
      
      logInfo('Node deleted via command', { 
        nodeId: this.nodeId, 
        connectionsAffected: this.affectedConnections.length 
      });
      
    } catch (error) {
      logError('DeleteNodeCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      // Restore the node
      await this.callbacks.onNodeCreate(this.nodeId, this.nodeData);
      
      // Restore connections
      for (const connection of this.affectedConnections) {
        await this.callbacks.onConnectionCreate(connection);
      }
      
      this.executed = false;
      
      logInfo('Node deletion undone', { 
        nodeId: this.nodeId,
        connectionsRestored: this.affectedConnections.length
      });
      
    } catch (error) {
      logError('DeleteNodeCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.callbacks.onNodeDelete && this.nodeData;
  }
}

/**
 * Node movement command with merging support
 */
export class MoveNodeCommand extends Command {
  constructor(nodeId, oldPosition, newPosition, callbacks) {
    super(`Move node: ${nodeId}`, {
      type: 'move_node',
      nodeId,
      groupType: 'node_move',
      category: 'layout',
      mergeable: true,
      groupable: true
    });
    
    this.nodeId = nodeId;
    this.oldPosition = { ...oldPosition };
    this.newPosition = { ...newPosition };
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      await this.callbacks.onNodeMove(this.nodeId, this.newPosition);
      this.executed = true;
    } catch (error) {
      logError('MoveNodeCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      await this.callbacks.onNodeMove(this.nodeId, this.oldPosition);
      this.executed = false;
    } catch (error) {
      logError('MoveNodeCommand undo failed', { error: error.message });
      throw error;
    }
  }

  mergeWith(otherCommand) {
    if (otherCommand instanceof MoveNodeCommand && 
        otherCommand.nodeId === this.nodeId &&
        otherCommand.metadata.type === 'move_node') {
      
      // Update the final position
      this.newPosition = { ...otherCommand.newPosition };
      this.description = `Move node: ${this.nodeId} (merged moves)`;
      return true;
    }
    return false;
  }

  canExecute() {
    return this.callbacks && this.callbacks.onNodeMove;
  }
}

/**
 * Node property update command
 */
export class UpdateNodeCommand extends Command {
  constructor(nodeId, property, oldValue, newValue, callbacks) {
    super(`Update ${property}: ${nodeId}`, {
      type: 'update_node',
      nodeId,
      property,
      groupType: `update_${property}`,
      category: 'content',
      mergeable: property === 'content' || property === 'title', // Allow merging for text content
      groupable: true
    });
    
    this.nodeId = nodeId;
    this.property = property;
    this.oldValue = this.cloneValue(oldValue);
    this.newValue = this.cloneValue(newValue);
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      await this.callbacks.onNodeUpdate(this.nodeId, { [this.property]: this.newValue });
      this.executed = true;
    } catch (error) {
      logError('UpdateNodeCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      await this.callbacks.onNodeUpdate(this.nodeId, { [this.property]: this.oldValue });
      this.executed = false;
    } catch (error) {
      logError('UpdateNodeCommand undo failed', { error: error.message });
      throw error;
    }
  }

  mergeWith(otherCommand) {
    if (otherCommand instanceof UpdateNodeCommand && 
        otherCommand.nodeId === this.nodeId &&
        otherCommand.property === this.property &&
        this.canMerge) {
      
      // Update the final value
      this.newValue = this.cloneValue(otherCommand.newValue);
      this.description = `Update ${this.property}: ${this.nodeId} (merged)`;
      this.timestamp = otherCommand.timestamp;
      return true;
    }
    return false;
  }

  cloneValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') {
      return JSON.parse(JSON.stringify(value));
    }
    return value;
  }

  canExecute() {
    return this.callbacks && this.callbacks.onNodeUpdate;
  }
}

/**
 * Choice creation command
 */
export class CreateChoiceCommand extends Command {
  constructor(nodeId, choiceData, callbacks) {
    super(`Add choice: ${choiceData.text || 'New Choice'}`, {
      type: 'create_choice',
      nodeId,
      choiceId: choiceData.id,
      groupType: 'choice_operations',
      category: 'content'
    });
    
    this.nodeId = nodeId;
    this.choiceData = { ...choiceData };
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      await this.callbacks.onChoiceAdd(this.nodeId, this.choiceData);
      this.executed = true;
      
      logInfo('Choice created via command', { 
        nodeId: this.nodeId, 
        choiceId: this.choiceData.id 
      });
      
    } catch (error) {
      logError('CreateChoiceCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      await this.callbacks.onChoiceDelete(this.nodeId, this.choiceData.id);
      this.executed = false;
      
      logInfo('Choice creation undone', { 
        nodeId: this.nodeId, 
        choiceId: this.choiceData.id 
      });
      
    } catch (error) {
      logError('CreateChoiceCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.callbacks.onChoiceAdd && this.choiceData;
  }
}

/**
 * Choice deletion command
 */
export class DeleteChoiceCommand extends Command {
  constructor(nodeId, choiceId, editorState, callbacks) {
    const node = editorState.nodes.get(nodeId);
    const choice = node?.choices?.find(c => c.id === choiceId);
    
    super(`Delete choice: ${choice?.text || 'Unknown'}`, {
      type: 'delete_choice',
      nodeId,
      choiceId,
      groupType: 'choice_operations',
      category: 'content'
    });
    
    this.nodeId = nodeId;
    this.choiceId = choiceId;
    this.choiceData = choice ? { ...choice } : null;
    this.callbacks = callbacks;
  }

  async execute() {
    if (!this.choiceData) {
      throw new Error(`Choice ${this.choiceId} not found for deletion`);
    }

    try {
      await this.callbacks.onChoiceDelete(this.nodeId, this.choiceId);
      this.executed = true;
      
      logInfo('Choice deleted via command', { 
        nodeId: this.nodeId, 
        choiceId: this.choiceId 
      });
      
    } catch (error) {
      logError('DeleteChoiceCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      await this.callbacks.onChoiceAdd(this.nodeId, this.choiceData);
      this.executed = false;
      
      logInfo('Choice deletion undone', { 
        nodeId: this.nodeId, 
        choiceId: this.choiceId 
      });
      
    } catch (error) {
      logError('DeleteChoiceCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.callbacks.onChoiceDelete && this.choiceData;
  }
}

/**
 * Choice update command
 */
export class UpdateChoiceCommand extends Command {
  constructor(nodeId, choiceId, property, oldValue, newValue, callbacks) {
    super(`Update choice ${property}: ${choiceId}`, {
      type: 'update_choice',
      nodeId,
      choiceId,
      property,
      groupType: `update_choice_${property}`,
      category: 'content',
      mergeable: property === 'text', // Allow merging for text updates
      groupable: true
    });
    
    this.nodeId = nodeId;
    this.choiceId = choiceId;
    this.property = property;
    this.oldValue = this.cloneValue(oldValue);
    this.newValue = this.cloneValue(newValue);
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      await this.callbacks.onChoiceUpdate(this.nodeId, this.choiceId, {
        [this.property]: this.newValue
      });
      this.executed = true;
    } catch (error) {
      logError('UpdateChoiceCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      await this.callbacks.onChoiceUpdate(this.nodeId, this.choiceId, {
        [this.property]: this.oldValue
      });
      this.executed = false;
    } catch (error) {
      logError('UpdateChoiceCommand undo failed', { error: error.message });
      throw error;
    }
  }

  mergeWith(otherCommand) {
    if (otherCommand instanceof UpdateChoiceCommand && 
        otherCommand.nodeId === this.nodeId &&
        otherCommand.choiceId === this.choiceId &&
        otherCommand.property === this.property &&
        this.canMerge) {
      
      this.newValue = this.cloneValue(otherCommand.newValue);
      this.description = `Update choice ${this.property}: ${this.choiceId} (merged)`;
      this.timestamp = otherCommand.timestamp;
      return true;
    }
    return false;
  }

  cloneValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') {
      return JSON.parse(JSON.stringify(value));
    }
    return value;
  }

  canExecute() {
    return this.callbacks && this.callbacks.onChoiceUpdate;
  }
}

/**
 * Adventure stat operations command
 */
export class UpdateStatsCommand extends Command {
  constructor(operation, statData, oldStats, callbacks) {
    super(`${operation} stat: ${statData?.name || 'Unknown'}`, {
      type: 'update_stats',
      operation,
      statId: statData?.id,
      groupType: 'stat_operations',
      category: 'configuration'
    });
    
    this.operation = operation; // 'add', 'update', 'delete'
    this.statData = statData ? { ...statData } : null;
    this.oldStats = oldStats ? [...oldStats] : [];
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      if (this.operation === 'add') {
        await this.callbacks.onStatAdd(this.statData);
      } else if (this.operation === 'update') {
        await this.callbacks.onStatUpdate(this.statData.id, this.statData);
      } else if (this.operation === 'delete') {
        await this.callbacks.onStatDelete(this.statData.id);
      }
      
      this.executed = true;
      
      logInfo('Stats updated via command', { 
        operation: this.operation, 
        statId: this.statData?.id 
      });
      
    } catch (error) {
      logError('UpdateStatsCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      if (this.operation === 'add') {
        await this.callbacks.onStatDelete(this.statData.id);
      } else if (this.operation === 'update') {
        const oldStat = this.oldStats.find(s => s.id === this.statData.id);
        if (oldStat) {
          await this.callbacks.onStatUpdate(this.statData.id, oldStat);
        }
      } else if (this.operation === 'delete') {
        await this.callbacks.onStatAdd(this.statData);
      }
      
      this.executed = false;
      
      logInfo('Stats update undone', { 
        operation: this.operation, 
        statId: this.statData?.id 
      });
      
    } catch (error) {
      logError('UpdateStatsCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.statData;
  }
}

/**
 * Connection creation command
 */
export class CreateConnectionCommand extends Command {
  constructor(fromNodeId, toNodeId, choiceId, connectionData, callbacks) {
    super(`Connect: ${fromNodeId} → ${toNodeId}`, {
      type: 'create_connection',
      fromNodeId,
      toNodeId,
      choiceId,
      connectionId: connectionData?.id,
      groupType: 'connection_operations',
      category: 'structure'
    });
    
    this.fromNodeId = fromNodeId;
    this.toNodeId = toNodeId;
    this.choiceId = choiceId;
    this.connectionData = { ...connectionData };
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      await this.callbacks.onConnectionCreate(this.connectionData);
      this.executed = true;
      
      logInfo('Connection created via command', { 
        fromNodeId: this.fromNodeId,
        toNodeId: this.toNodeId,
        connectionId: this.connectionData.id
      });
      
    } catch (error) {
      logError('CreateConnectionCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      await this.callbacks.onConnectionDelete(this.connectionData.id);
      this.executed = false;
      
      logInfo('Connection creation undone', { 
        connectionId: this.connectionData.id 
      });
      
    } catch (error) {
      logError('CreateConnectionCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.callbacks.onConnectionCreate && this.connectionData;
  }
}

/**
 * Bulk operations command
 */
export class BulkOperationCommand extends CompositeCommand {
  constructor(operationType, items, callbacks, options = {}) {
    const itemCount = Array.isArray(items) ? items.length : Object.keys(items).length;
    
    super(`Bulk ${operationType}: ${itemCount} items`, [], {
      type: 'bulk_operation',
      operationType,
      itemCount,
      category: 'bulk',
      isBulk: true
    });
    
    this.operationType = operationType; // 'delete', 'move', 'update', etc.
    this.items = items;
    this.callbacks = callbacks;
    this.options = options;
    
    // Generate individual commands
    this.generateCommands();
  }

  generateCommands() {
    switch (this.operationType) {
      case 'delete_nodes':
        this.commands = this.items.map(nodeId => 
          new DeleteNodeCommand(nodeId, this.options.editorState, this.callbacks)
        );
        break;
        
      case 'move_nodes':
        this.commands = this.items.map(({ nodeId, newPosition, oldPosition }) =>
          new MoveNodeCommand(nodeId, oldPosition, newPosition, this.callbacks)
        );
        break;
        
      case 'update_nodes':
        this.commands = this.items.map(({ nodeId, updates, oldValues }) =>
          Object.keys(updates).map(property =>
            new UpdateNodeCommand(nodeId, property, oldValues[property], updates[property], this.callbacks)
          )
        ).flat();
        break;
        
      default:
        throw new Error(`Unknown bulk operation type: ${this.operationType}`);
    }
  }

  // Override to provide better progress reporting
  async execute() {
    if (!this.canExecute()) {
      throw new Error(`Bulk operation cannot be executed: ${this.description}`);
    }

    const executedCommands = [];
    let progress = 0;
    
    try {
      for (const command of this.commands) {
        await command.execute();
        executedCommands.push(command);
        progress++;
        
        // Report progress for long operations
        if (this.commands.length > 10) {
          this.notifyProgress(progress, this.commands.length);
        }
      }
      this.executed = true;
      
      logInfo('Bulk operation completed', {
        operationType: this.operationType,
        commandsExecuted: executedCommands.length
      });
      
    } catch (error) {
      // Rollback executed commands in reverse order
      for (let i = executedCommands.length - 1; i >= 0; i--) {
        try {
          await executedCommands[i].undo();
        } catch (rollbackError) {
          logWarning('Bulk operation rollback failed', { 
            commandId: executedCommands[i].id, 
            error: rollbackError.message 
          });
        }
      }
      throw error;
    }
  }

  notifyProgress(completed, total) {
    // Could emit progress events here for UI updates
    if (this.options.onProgress) {
      this.options.onProgress({ completed, total, percentage: (completed / total) * 100 });
    }
  }
}

/**
 * Adventure import command
 */
export class ImportAdventureCommand extends Command {
  constructor(adventureData, oldAdventureData, callbacks) {
    super(`Import adventure: ${adventureData?.title || 'Unknown'}`, {
      type: 'import_adventure',
      category: 'data',
      isLargeOperation: true
    });
    
    this.adventureData = adventureData;
    this.oldAdventureData = oldAdventureData;
    this.callbacks = callbacks;
  }

  async execute() {
    try {
      await this.callbacks.onAdventureImport(this.adventureData);
      this.executed = true;
      
      logInfo('Adventure imported via command', { 
        title: this.adventureData?.title,
        scenes: this.adventureData?.scenes?.length || 0
      });
      
    } catch (error) {
      logError('ImportAdventureCommand execution failed', { error: error.message });
      throw error;
    }
  }

  async undo() {
    if (!this.canUndo()) return;

    try {
      if (this.oldAdventureData) {
        await this.callbacks.onAdventureImport(this.oldAdventureData);
      } else {
        // If no old data, clear the adventure
        await this.callbacks.onAdventureClear();
      }
      
      this.executed = false;
      
      logInfo('Adventure import undone');
      
    } catch (error) {
      logError('ImportAdventureCommand undo failed', { error: error.message });
      throw error;
    }
  }

  canExecute() {
    return this.callbacks && this.callbacks.onAdventureImport && this.adventureData;
  }
}

export {
  Command,
  CompositeCommand
};